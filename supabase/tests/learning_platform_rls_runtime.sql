\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

insert into public.profiles (
  id,
  preferred_language,
  proficiency_level,
  preferred_voice,
  learning_goal,
  daily_practice_target_minutes,
  timezone
) values (
  '11111111-1111-4111-8111-111111111111',
  'en-US',
  'Intermediate',
  'Aoede',
  'general_fluency',
  20,
  'Asia/Karachi'
);

insert into public.learning_sessions (
  id,
  user_id,
  language,
  proficiency_level,
  topic,
  assistant_voice,
  status
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'en-US',
  'Intermediate',
  'Free Chat',
  'Aoede',
  'active'
);

reset role;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

insert into public.profiles (
  id,
  preferred_language,
  proficiency_level,
  preferred_voice,
  learning_goal,
  daily_practice_target_minutes,
  timezone
) values (
  '22222222-2222-4222-8222-222222222222',
  'fr-FR',
  'Basic',
  'Charon',
  'travel',
  15,
  'Europe/Paris'
);

insert into public.learning_sessions (
  id,
  user_id,
  language,
  proficiency_level,
  topic,
  assistant_voice,
  status
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  'fr-FR',
  'Basic',
  'Travel & Directions',
  'Charon',
  'active'
);

reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

do $$
begin
  if exists (
    select 1
    from public.profiles
    where id = '22222222-2222-4222-8222-222222222222'
  ) then
    raise exception 'RLS leaked another learner profile';
  end if;

  if exists (
    select 1
    from public.learning_sessions
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ) then
    raise exception 'RLS leaked another learner session';
  end if;

  update public.profiles
  set preferred_language = 'de-DE'
  where id = '22222222-2222-4222-8222-222222222222';

  if found then
    raise exception 'RLS allowed updating another learner profile';
  end if;

  begin
    insert into public.session_messages (
      session_id,
      user_id,
      role,
      sequence,
      text
    ) values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '11111111-1111-4111-8111-111111111111',
      'user',
      0,
      'Cross-owner write'
    );

    raise exception 'Composite ownership foreign key allowed cross-owner message';
  exception
    when foreign_key_violation then
      null;
  end;

  begin
    update public.profiles
    set timezone = 'Not/ARealZone'
    where id = '11111111-1111-4111-8111-111111111111';

    raise exception 'Invalid timezone was accepted';
  exception
    when check_violation then
      null;
  end;
end
$$;

select public.start_learning_session(
  'en-US',
  'Intermediate',
  'Free Chat',
  'Aoede',
  '[{"role":"user","sequence":0,"text":"Hello","occurredAt":"2026-09-09T05:00:00Z"}]'::jsonb
) as created_session \gset

do $$
begin
  if not exists (
    select 1
    from public.learning_sessions
    where id = :'created_session'::uuid
      and user_id = '11111111-1111-4111-8111-111111111111'
  ) then
    raise exception 'start_learning_session did not derive auth.uid ownership';
  end if;
end
$$;

reset role;
