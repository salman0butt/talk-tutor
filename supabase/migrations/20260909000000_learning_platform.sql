-- Talk Tutor persistent learning platform
-- Stacked on feat/saas-home-auth. All learner-owned access is protected by RLS.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  preferred_language text not null default 'en-US'
    check (preferred_language in ('en-US','en-GB','es-ES','es-MX','fr-FR','de-DE','ja-JP','ko-KR','zh-CN','hi-IN','pt-BR')),
  proficiency_level text not null default 'Basic'
    check (proficiency_level in ('Basic','Intermediate','Top Class')),
  preferred_voice text not null default 'Charon'
    check (preferred_voice in ('Charon','Puck','Kore','Fenrir','Aoede')),
  learning_goal text not null default 'general_fluency'
    check (learning_goal in ('everyday_conversation','travel','business','interview_preparation','academic_language','general_fluency')),
  daily_practice_target_minutes integer not null default 15
    check (daily_practice_target_minutes between 5 and 180),
  timezone text not null default 'UTC'
    check (char_length(timezone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null
    check (language in ('en-US','en-GB','es-ES','es-MX','fr-FR','de-DE','ja-JP','ko-KR','zh-CN','hi-IN','pt-BR')),
  proficiency_level text not null
    check (proficiency_level in ('Basic','Intermediate','Top Class')),
  topic text not null check (char_length(topic) between 1 and 120),
  assistant_voice text not null
    check (assistant_voice in ('Charon','Puck','Kore','Fenrir','Aoede')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  status text not null default 'active'
    check (status in ('active','completed','abandoned')),
  feedback_status text not null default 'not_requested'
    check (feedback_status in ('not_requested','pending','processing','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_sessions_end_after_start check (ended_at is null or ended_at >= started_at),
  constraint learning_sessions_owner_key unique (id, user_id)
);

create table public.session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('user','assistant')),
  sequence integer not null check (sequence between 0 and 10000),
  text text not null check (char_length(btrim(text)) between 1 and 12000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint session_messages_session_owner_fk
    foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete cascade,
  constraint session_messages_sequence_key unique (session_id, sequence)
);

create table public.session_feedback (
  session_id uuid primary key,
  user_id uuid not null,
  summary text not null check (char_length(btrim(summary)) between 1 and 4000),
  grammar_corrections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(grammar_corrections) = 'array'),
  better_sentences jsonb not null default '[]'::jsonb
    check (jsonb_typeof(better_sentences) = 'array'),
  vocabulary jsonb not null default '[]'::jsonb
    check (jsonb_typeof(vocabulary) = 'array'),
  fluency jsonb not null
    check (jsonb_typeof(fluency) = 'object'),
  pronunciation_notes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(pronunciation_notes) = 'array'),
  next_steps jsonb not null default '[]'::jsonb
    check (jsonb_typeof(next_steps) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_feedback_session_owner_fk
    foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete cascade
);

create index learning_sessions_user_ended_idx
  on public.learning_sessions (user_id, ended_at desc)
  where status = 'completed';
create index learning_sessions_user_status_idx
  on public.learning_sessions (user_id, status);
create index session_messages_user_session_idx
  on public.session_messages (user_id, session_id, sequence);
create index session_feedback_user_created_idx
  on public.session_feedback (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.session_messages enable row level security;
alter table public.session_feedback enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.learning_sessions from anon;
revoke all on table public.session_messages from anon;
revoke all on table public.session_feedback from anon;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.learning_sessions to authenticated;
grant select, insert on table public.session_messages to authenticated;
grant select, insert, update on table public.session_feedback to authenticated;

create policy "profiles_select_own"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "learning_sessions_select_own"
on public.learning_sessions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "learning_sessions_insert_own"
on public.learning_sessions for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "learning_sessions_update_own"
on public.learning_sessions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "session_messages_select_own"
on public.session_messages for select to authenticated
using ((select auth.uid()) = user_id);

create policy "session_messages_insert_own"
on public.session_messages for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "session_feedback_select_own"
on public.session_feedback for select to authenticated
using ((select auth.uid()) = user_id);

create policy "session_feedback_insert_own"
on public.session_feedback for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "session_feedback_update_own"
on public.session_feedback for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Atomically create a session only after the first finalized user turn exists.
create or replace function public.start_learning_session(
  p_language text,
  p_proficiency_level text,
  p_topic text,
  p_assistant_voice text,
  p_messages jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_message jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(p_messages) <> 'array'
     or not exists (
       select 1
       from jsonb_array_elements(p_messages) as item
       where item->>'role' = 'user'
         and char_length(btrim(coalesce(item->>'text', ''))) > 0
     ) then
    raise exception 'a finalized user message is required' using errcode = '22023';
  end if;

  insert into public.learning_sessions (
    user_id, language, proficiency_level, topic, assistant_voice, feedback_status
  )
  values (
    v_user_id, p_language, p_proficiency_level, p_topic, p_assistant_voice, 'not_requested'
  )
  returning id into v_session_id;

  for v_message in select value from jsonb_array_elements(p_messages)
  loop
    insert into public.session_messages (
      session_id,
      user_id,
      role,
      sequence,
      text,
      occurred_at
    )
    values (
      v_session_id,
      v_user_id,
      v_message->>'role',
      (v_message->>'sequence')::integer,
      btrim(v_message->>'text'),
      coalesce((v_message->>'occurredAt')::timestamptz, now())
    );
  end loop;

  return v_session_id;
end;
$$;

create or replace function public.append_learning_message(
  p_session_id uuid,
  p_role text,
  p_sequence integer,
  p_text text,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_message_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.learning_sessions
    where id = p_session_id and user_id = v_user_id and status = 'active'
  ) then
    raise exception 'learning session not found' using errcode = 'P0002';
  end if;

  insert into public.session_messages (
    session_id, user_id, role, sequence, text, occurred_at
  )
  values (
    p_session_id, v_user_id, p_role, p_sequence, btrim(p_text), p_occurred_at
  )
  on conflict (session_id, sequence) do nothing
  returning id into v_message_id;

  return v_message_id;
end;
$$;

create or replace function public.finalize_learning_session(p_session_id uuid)
returns jsonb
language plpgsql
security invoker
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
  where session_id = p_session_id and user_id = v_user_id and role = 'user';

  if v_session.status = 'active' then
    v_ended_at := now();
    update public.learning_sessions
    set
      status = 'completed',
      ended_at = v_ended_at,
      duration_seconds = greatest(0, floor(extract(epoch from (v_ended_at - started_at)))::integer),
      feedback_status = case when v_user_message_count > 0 then 'pending' else 'not_requested' end,
      updated_at = now()
    where id = p_session_id and user_id = v_user_id
    returning * into v_session;
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

-- Aggregate dashboard data without accepting an owner argument.
create or replace function public.get_learning_dashboard()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with
profile as (
  select coalesce(
    (select p.timezone from public.profiles p where p.id = auth.uid()),
    'UTC'
  ) as timezone
),
message_counts as (
  select m.session_id, count(*) filter (where m.role = 'user')::integer as user_message_count
  from public.session_messages m
  where m.user_id = auth.uid()
  group by m.session_id
),
completed as (
  select s.*, coalesce(mc.user_message_count, 0) as user_message_count
  from public.learning_sessions s
  left join message_counts mc on mc.session_id = s.id
  where s.user_id = auth.uid()
    and s.status = 'completed'
    and s.ended_at is not null
    and coalesce(mc.user_message_count, 0) > 0
),
meaningful as (
  select * from completed where duration_seconds >= 60
),
local_completed as (
  select c.*, (c.ended_at at time zone p.timezone)::date as local_date
  from completed c cross join profile p
),
local_meaningful as (
  select m.*, (m.ended_at at time zone p.timezone)::date as local_date
  from meaningful m cross join profile p
),
weekly_rows as (
  select local_date, floor(sum(duration_seconds) / 60.0)::integer as minutes
  from local_completed, profile
  where local_date >= ((now() at time zone profile.timezone)::date - 6)
  group by local_date
  order by local_date
),
vocabulary_terms as (
  select distinct lower(regexp_replace(btrim(item->>'term'), '\s+', ' ', 'g')) as term
  from public.session_feedback f
  cross join lateral jsonb_array_elements(f.vocabulary) item
  where f.user_id = auth.uid()
    and char_length(btrim(coalesce(item->>'term',''))) > 0
),
mistake_rows as (
  select item->>'category' as category, count(*)::integer as count
  from public.session_feedback f
  cross join lateral jsonb_array_elements(f.grammar_corrections) item
  where f.user_id = auth.uid()
    and char_length(btrim(coalesce(item->>'category',''))) > 0
  group by item->>'category'
  order by count desc, category
),
recent_languages as (
  select language
  from completed
  group by language
  order by max(ended_at) desc
  limit 5
),
recent_scores as (
  select (f.fluency->>'score')::integer as score
  from public.session_feedback f
  join public.learning_sessions s
    on s.id = f.session_id and s.user_id = f.user_id
  where f.user_id = auth.uid()
    and (f.fluency->>'score') ~ '^\d{1,3}$'
  order by s.ended_at desc nulls last
  limit 10
),
practice_dates as (
  select distinct local_date from local_meaningful order by local_date
)
select jsonb_build_object(
  'totalMinutes', coalesce((select floor(sum(duration_seconds) / 60.0)::integer from completed), 0),
  'completedSessions', (select count(*)::integer from completed),
  'sessionsThisWeek', coalesce((
    select count(*)::integer
    from local_completed, profile
    where local_date >= date_trunc('week', now() at time zone profile.timezone)::date
  ), 0),
  'vocabularyLearned', (select count(*)::integer from vocabulary_terms),
  'weeklyPractice', coalesce((select jsonb_agg(jsonb_build_object('date', local_date, 'minutes', minutes) order by local_date) from weekly_rows), '[]'::jsonb),
  'commonMistakes', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'count', count) order by count desc, category) from mistake_rows), '[]'::jsonb),
  'recentLanguages', coalesce((select jsonb_agg(language) from recent_languages), '[]'::jsonb),
  'recentScores', coalesce((select jsonb_agg(score) from recent_scores), '[]'::jsonb),
  'practiceDates', coalesce((select jsonb_agg(local_date order by local_date) from practice_dates), '[]'::jsonb)
);
$$;

revoke all on function public.start_learning_session(text,text,text,text,jsonb) from public, anon;
revoke all on function public.append_learning_message(uuid,text,integer,text,timestamptz) from public, anon;
revoke all on function public.finalize_learning_session(uuid) from public, anon;
revoke all on function public.get_learning_dashboard() from public, anon;

grant execute on function public.start_learning_session(text,text,text,text,jsonb) to authenticated;
grant execute on function public.append_learning_message(uuid,text,integer,text,timestamptz) to authenticated;
grant execute on function public.finalize_learning_session(uuid) to authenticated;
grant execute on function public.get_learning_dashboard() to authenticated;
