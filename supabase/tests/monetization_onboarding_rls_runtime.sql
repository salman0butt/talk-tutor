\set ON_ERROR_STOP on

-- Existing learners created by prior runtime tests are backfilled as onboarded.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'
      and onboarding_completed_at is not null
  ) then
    raise exception 'Existing learner was incorrectly forced into onboarding';
  end if;

  begin
    insert into public.learning_sessions (
      user_id,
      language,
      proficiency_level,
      topic,
      assistant_voice
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'en-US',
      'Intermediate',
      'Direct write must fail',
      'Aoede'
    );
    raise exception 'Direct learning-session insert was accepted';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

-- Session RPCs still work after direct table mutation is revoked, and usage is recorded once.
do $$
declare
  v_session_id uuid;
  v_first jsonb;
  v_second jsonb;
  v_usage_count integer;
  v_session_duration integer;
  v_usage_duration integer;
begin
  v_session_id := public.start_learning_session(
    'en-US',
    'Intermediate',
    'Billing-safe practice',
    'Aoede',
    '[{"role":"user","text":"Hello there","sequence":0,"occurredAt":"2026-09-09T12:00:00Z"}]'::jsonb,
    'conversation',
    null,
    null,
    null,
    null,
    '{}'::text[],
    'balanced',
    'normal'
  );

  perform pg_sleep(1);

  v_first := public.finalize_learning_session(v_session_id);
  v_second := public.finalize_learning_session(v_session_id);

  select count(*)::integer
  into v_usage_count
  from public.tutor_usage_events
  where learning_session_id = v_session_id;

  select duration_seconds
  into v_session_duration
  from public.learning_sessions
  where id = v_session_id;

  select duration_seconds
  into v_usage_duration
  from public.tutor_usage_events
  where learning_session_id = v_session_id;

  if v_usage_count <> 1 then
    raise exception 'Repeated finalization double-counted usage';
  end if;

  if v_session_duration <> v_usage_duration then
    raise exception 'Usage duration did not use authoritative finalized session duration';
  end if;

  if (v_first->>'id')::uuid <> v_session_id
     or (v_second->>'id')::uuid <> v_session_id then
    raise exception 'Finalization response changed across retries';
  end if;
end
$$;

reset role;

-- Seed authoritative billing state as the trusted database owner.
insert into public.billing_accounts (
  user_id,
  stripe_customer_id,
  stripe_subscription_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end
) values
(
  '11111111-1111-4111-8111-111111111111',
  'cus_test_user_1',
  'sub_test_user_1',
  'starter',
  'active',
  now() - interval '1 day',
  now() + interval '29 days',
  false
),
(
  '22222222-2222-4222-8222-222222222222',
  'cus_test_user_2',
  'sub_test_user_2',
  'pro',
  'active',
  now() - interval '1 day',
  now() + interval '29 days',
  false
);

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

do $$
begin
  if not exists (
    select 1 from public.billing_accounts
    where user_id = '11111111-1111-4111-8111-111111111111'
      and plan_id = 'starter'
  ) then
    raise exception 'Learner cannot read own billing account';
  end if;

  if exists (
    select 1 from public.billing_accounts
    where user_id = '22222222-2222-4222-8222-222222222222'
  ) then
    raise exception 'Billing-account RLS leaked another learner';
  end if;

  if exists (
    select 1 from public.tutor_usage_events
    where user_id <> '11111111-1111-4111-8111-111111111111'
  ) then
    raise exception 'Usage-event RLS leaked another learner';
  end if;

  begin
    update public.billing_accounts
    set plan_id = 'pro'
    where user_id = '11111111-1111-4111-8111-111111111111';
    raise exception 'Learner changed authoritative subscription state';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

reset role;

-- New learners after the migration remain eligible for onboarding and can choose Immigration.
insert into auth.users (id)
values ('33333333-3333-4333-8333-333333333333');

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

insert into public.profiles (
  id,
  preferred_language,
  proficiency_level,
  preferred_voice,
  learning_goal,
  daily_practice_target_minutes,
  timezone
) values (
  '33333333-3333-4333-8333-333333333333',
  'en-US',
  'Basic',
  'Charon',
  'immigration',
  15,
  'UTC'
);

do $$
begin
  if exists (
    select 1 from public.profiles
    where id = '33333333-3333-4333-8333-333333333333'
      and onboarding_completed_at is not null
  ) then
    raise exception 'New learner was incorrectly auto-completed through onboarding';
  end if;
end
$$;

reset role;

-- One active lease per learner; release requires the matching lease id.
set role service_role;

do $$
declare
  v_first uuid;
  v_second uuid;
  v_third uuid;
begin
  v_first := public.acquire_tutor_session_lease(
    '11111111-1111-4111-8111-111111111111',
    600
  );
  if v_first is null then
    raise exception 'First tutor lease was not acquired';
  end if;

  v_second := public.acquire_tutor_session_lease(
    '11111111-1111-4111-8111-111111111111',
    600
  );
  if v_second is not null then
    raise exception 'Concurrent tutor lease was incorrectly acquired';
  end if;

  if public.release_tutor_session_lease(
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444'
  ) then
    raise exception 'Wrong lease id released an active tutor lease';
  end if;

  if not public.release_tutor_session_lease(
    '11111111-1111-4111-8111-111111111111',
    v_first
  ) then
    raise exception 'Matching tutor lease was not released';
  end if;

  v_third := public.acquire_tutor_session_lease(
    '11111111-1111-4111-8111-111111111111',
    600
  );
  if v_third is null then
    raise exception 'Tutor lease was not reacquired after release';
  end if;
end
$$;

reset role;
