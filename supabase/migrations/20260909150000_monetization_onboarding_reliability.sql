-- Talk Tutor monetization, onboarding and realtime reliability persistence.
-- Extends the existing learning platform without duplicating profile/session models.

-- ---------------------------------------------------------------------------
-- Onboarding metadata and canonical goal extension
-- ---------------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_learning_goal_check;

alter table public.profiles
  add constraint profiles_learning_goal_check
    check (
      learning_goal in (
        'everyday_conversation',
        'travel',
        'business',
        'interview_preparation',
        'academic_language',
        'general_fluency',
        'immigration'
      )
    );

alter table public.profiles
  add column onboarding_completed_at timestamptz,
  add column placement_completed_at timestamptz,
  add column placement_score smallint
    check (placement_score between 0 and 6),
  add column recommended_level text
    check (recommended_level in ('Basic', 'Intermediate', 'Top Class'));

-- Profiles that existed before this migration already belong to established
-- learners. Backfill only those rows; new profiles keep the nullable default
-- and are routed through onboarding.
update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, now());

-- ---------------------------------------------------------------------------
-- Billing account snapshot
-- ---------------------------------------------------------------------------

create table public.billing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique
    check (char_length(stripe_customer_id) between 3 and 255),
  stripe_subscription_id text unique
    check (
      stripe_subscription_id is null
      or char_length(stripe_subscription_id) between 3 and 255
    ),
  plan_id text
    check (plan_id is null or plan_id in ('starter', 'pro')),
  status text
    check (
      status is null
      or status in (
        'active',
        'trialing',
        'past_due',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
        'paused'
      )
    ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_accounts_period_order
    check (
      current_period_start is null
      or current_period_end is null
      or current_period_end > current_period_start
    ),
  constraint billing_accounts_subscription_shape
    check (
      (
        stripe_subscription_id is null
        and plan_id is null
        and status is null
        and current_period_start is null
        and current_period_end is null
        and cancel_at_period_end = false
      )
      or
      (
        stripe_subscription_id is not null
        and plan_id is not null
        and status is not null
        and current_period_start is not null
        and current_period_end is not null
      )
    )
);

create index billing_accounts_subscription_idx
  on public.billing_accounts (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- ---------------------------------------------------------------------------
-- Auditable, idempotent tutor usage
-- ---------------------------------------------------------------------------

create table public.tutor_usage_events (
  id uuid primary key default gen_random_uuid(),
  learning_session_id uuid not null,
  user_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null
    check (duration_seconds >= 0),
  created_at timestamptz not null default now(),
  constraint tutor_usage_events_period_order
    check (ended_at >= started_at),
  constraint tutor_usage_events_session_key
    unique (learning_session_id),
  constraint tutor_usage_events_session_owner_fk
    foreign key (learning_session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete cascade
);

create index tutor_usage_events_user_ended_idx
  on public.tutor_usage_events (user_id, ended_at desc);

-- Existing completed sessions count toward current-period allowance instead of
-- receiving an accidental fresh allowance on deployment.
insert into public.tutor_usage_events (
  learning_session_id,
  user_id,
  started_at,
  ended_at,
  duration_seconds
)
select
  id,
  user_id,
  started_at,
  ended_at,
  duration_seconds
from public.learning_sessions
where status = 'completed'
  and ended_at is not null
on conflict (learning_session_id) do nothing;

-- ---------------------------------------------------------------------------
-- Stripe webhook idempotency
-- ---------------------------------------------------------------------------

create table public.stripe_webhook_events (
  event_id text primary key
    check (char_length(event_id) between 3 and 255),
  event_type text not null
    check (char_length(event_type) between 3 and 255),
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- One normal application tutor token lease per learner
-- ---------------------------------------------------------------------------

create table public.tutor_session_leases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lease_id uuid not null unique default gen_random_uuid(),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint tutor_session_leases_expiry_check
    check (expires_at > started_at)
);

create index tutor_session_leases_expiry_idx
  on public.tutor_session_leases (expires_at);

-- ---------------------------------------------------------------------------
-- RLS and privileges: learner reads, trusted billing writes
-- ---------------------------------------------------------------------------

alter table public.billing_accounts enable row level security;
alter table public.tutor_usage_events enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.tutor_session_leases enable row level security;

revoke all on table public.billing_accounts from public, anon, authenticated;
revoke all on table public.tutor_usage_events from public, anon, authenticated;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
revoke all on table public.tutor_session_leases from public, anon, authenticated;

grant select on table public.billing_accounts to authenticated;
grant select on table public.tutor_usage_events to authenticated;

grant all on table public.billing_accounts to service_role;
grant all on table public.tutor_usage_events to service_role;
grant all on table public.stripe_webhook_events to service_role;
grant all on table public.tutor_session_leases to service_role;

create policy "billing_accounts_select_own"
on public.billing_accounts for select to authenticated
using ((select auth.uid()) = user_id);

create policy "tutor_usage_events_select_own"
on public.tutor_usage_events for select to authenticated
using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Harden billing-authoritative session mutations
-- ---------------------------------------------------------------------------

revoke insert, update on table public.learning_sessions from authenticated;
revoke insert on table public.session_messages from authenticated;

drop policy if exists "learning_sessions_insert_own"
  on public.learning_sessions;
drop policy if exists "learning_sessions_update_own"
  on public.learning_sessions;
drop policy if exists "session_messages_insert_own"
  on public.session_messages;

-- Both session-start overloads and append already derive auth.uid() and validate
-- owner-bound data. Make them the trusted mutation boundary now that direct
-- table writes are revoked.
alter function public.start_learning_session(
  text,
  text,
  text,
  text,
  jsonb
) security definer;

alter function public.start_learning_session(
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  text,
  text,
  text[],
  text,
  text
) security definer;

alter function public.append_learning_message(
  uuid,
  text,
  integer,
  text,
  timestamptz
) security definer;

-- Finalization is authoritative for both learning history and billing usage.
-- Repeated finalization returns the existing session and inserts at most one
-- usage event through the unique learning_session_id constraint.
create or replace function public.finalize_learning_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.learning_sessions%rowtype;
  v_user_message_count integer;
  v_ended_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_session
  from public.learning_sessions
  where id = p_session_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'learning session not found' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_user_message_count
  from public.session_messages
  where session_id = p_session_id
    and user_id = v_user_id
    and role = 'user';

  if v_session.status = 'active' then
    v_ended_at := now();

    update public.learning_sessions
    set
      status = 'completed',
      ended_at = v_ended_at,
      duration_seconds = greatest(
        0,
        floor(extract(epoch from (v_ended_at - started_at)))::integer
      ),
      feedback_status = case
        when v_user_message_count > 0 then 'pending'
        else 'not_requested'
      end,
      updated_at = now()
    where id = p_session_id
      and user_id = v_user_id
    returning * into v_session;
  end if;

  if v_session.status = 'completed'
     and v_session.ended_at is not null then
    insert into public.tutor_usage_events (
      learning_session_id,
      user_id,
      started_at,
      ended_at,
      duration_seconds
    ) values (
      v_session.id,
      v_session.user_id,
      v_session.started_at,
      v_session.ended_at,
      v_session.duration_seconds
    )
    on conflict (learning_session_id) do nothing;
  end if;

  return jsonb_build_object(
    'id', v_session.id,
    'status', v_session.status,
    'endedAt', v_session.ended_at,
    'durationSeconds', v_session.duration_seconds,
    'feedbackStatus', v_session.feedback_status,
    'userMessageCount', v_user_message_count
  );
end;
$$;

-- Preserve only the intended authenticated session RPC access.
revoke all on function public.start_learning_session(text,text,text,text,jsonb)
  from public, anon;
revoke all on function public.start_learning_session(
  text,text,text,text,jsonb,text,text,text,text,text,text[],text,text
) from public, anon;
revoke all on function public.append_learning_message(
  uuid,text,integer,text,timestamptz
) from public, anon;
revoke all on function public.finalize_learning_session(uuid)
  from public, anon;

grant execute on function public.start_learning_session(text,text,text,text,jsonb)
  to authenticated;
grant execute on function public.start_learning_session(
  text,text,text,text,jsonb,text,text,text,text,text,text[],text,text
) to authenticated;
grant execute on function public.append_learning_message(
  uuid,text,integer,text,timestamptz
) to authenticated;
grant execute on function public.finalize_learning_session(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Service-role-only lease functions
-- ---------------------------------------------------------------------------

create or replace function public.acquire_tutor_session_lease(
  p_user_id uuid,
  p_ttl_seconds integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_lease_id uuid;
begin
  if p_user_id is null then
    raise exception 'user id is required' using errcode = '22023';
  end if;

  if p_ttl_seconds is null
     or p_ttl_seconds < 1
     or p_ttl_seconds > 600 then
    raise exception 'lease ttl must be between 1 and 600 seconds'
      using errcode = '22023';
  end if;

  delete from public.tutor_session_leases
  where user_id = p_user_id
    and expires_at <= v_now;

  insert into public.tutor_session_leases (
    user_id,
    lease_id,
    started_at,
    expires_at
  ) values (
    p_user_id,
    gen_random_uuid(),
    v_now,
    v_now + make_interval(secs => p_ttl_seconds)
  )
  on conflict (user_id) do nothing
  returning lease_id into v_lease_id;

  return v_lease_id;
end;
$$;

create or replace function public.release_tutor_session_lease(
  p_user_id uuid,
  p_lease_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_user_id is null or p_lease_id is null then
    return false;
  end if;

  delete from public.tutor_session_leases
  where user_id = p_user_id
    and lease_id = p_lease_id;

  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;

revoke all on function public.acquire_tutor_session_lease(uuid,integer)
  from public, anon, authenticated;
revoke all on function public.release_tutor_session_lease(uuid,uuid)
  from public, anon, authenticated;

grant execute on function public.acquire_tutor_session_lease(uuid,integer)
  to service_role;
grant execute on function public.release_tutor_session_lease(uuid,uuid)
  to service_role;
