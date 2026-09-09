-- Talk Tutor personalized learning, progress and vocabulary review
-- Extends the existing persistent learning platform without replacing it.

alter table public.profiles
  add column correction_frequency text not null default 'balanced'
    check (correction_frequency in ('minimal','balanced','frequent')),
  add column conversation_difficulty text not null default 'normal'
    check (conversation_difficulty in ('easy','normal','challenging'));

alter table public.learning_sessions
  add column practice_mode text not null default 'conversation'
    check (practice_mode in ('conversation','roleplay','mistakes','custom')),
  add column scenario_id text
    check (scenario_id is null or char_length(btrim(scenario_id)) between 1 and 64),
  add column custom_scenario text
    check (custom_scenario is null or char_length(btrim(custom_scenario)) between 1 and 600),
  add column learner_role text
    check (learner_role is null or char_length(btrim(learner_role)) between 1 and 80),
  add column tutor_role text
    check (tutor_role is null or char_length(btrim(tutor_role)) between 1 and 80),
  add column target_mistake_categories text[] not null default '{}'::text[]
    check (
      cardinality(target_mistake_categories) <= 3
      and target_mistake_categories <@ array[
        'articles','verb_tense','prepositions','word_order','pluralization',
        'vocabulary_misuse','agreement','other'
      ]::text[]
    );

create table public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term text not null check (char_length(btrim(term)) between 1 and 200),
  normalized_term text not null check (char_length(normalized_term) between 1 and 200),
  language text not null
    check (language in ('en-US','en-GB','es-ES','es-MX','fr-FR','de-DE','ja-JP','ko-KR','zh-CN','hi-IN','pt-BR')),
  meaning text not null check (char_length(btrim(meaning)) between 1 and 1000),
  part_of_speech text
    check (part_of_speech is null or char_length(btrim(part_of_speech)) between 1 and 80),
  example_sentence text
    check (example_sentence is null or char_length(btrim(example_sentence)) between 1 and 2000),
  personalized_example text
    check (personalized_example is null or char_length(btrim(personalized_example)) between 1 and 2000),
  personalized_explanation text
    check (personalized_explanation is null or char_length(btrim(personalized_explanation)) between 1 and 2000),
  personalized_example_mistake_category text
    check (
      personalized_example_mistake_category is null
      or personalized_example_mistake_category in (
        'articles','verb_tense','prepositions','word_order','pluralization',
        'vocabulary_misuse','agreement','other'
      )
    ),
  source_session_id uuid,
  source_context text
    check (source_context is null or char_length(btrim(source_context)) between 1 and 4000),
  status text not null default 'learning'
    check (status in ('learning','strong')),
  ease_factor numeric(4,2) not null default 2.50
    check (ease_factor between 1.30 and 3.00),
  interval_days integer not null default 0
    check (interval_days between 0 and 3650),
  repetition_count integer not null default 0
    check (repetition_count between 0 and 10000),
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_items_owner_key unique (id, user_id),
  constraint vocabulary_items_user_language_term_key
    unique (user_id, language, normalized_term),
  constraint vocabulary_items_normalization_matches_term
    check (
      normalized_term =
      lower(regexp_replace(btrim(normalize(term, NFKC)), '\s+', ' ', 'g'))
    ),
  constraint vocabulary_items_source_session_owner_fk
    foreign key (source_session_id, user_id)
    references public.learning_sessions(id, user_id)
    on delete set null (source_session_id)
);

create table public.vocabulary_reviews (
  id uuid primary key default gen_random_uuid(),
  vocabulary_item_id uuid not null,
  user_id uuid not null,
  rating text not null check (rating in ('again','hard','good','easy')),
  previous_interval_days integer not null check (previous_interval_days between 0 and 3650),
  next_interval_days integer not null check (next_interval_days between 1 and 3650),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint vocabulary_reviews_item_owner_fk
    foreign key (vocabulary_item_id, user_id)
    references public.vocabulary_items(id, user_id)
    on delete cascade
);

create index vocabulary_items_user_due_idx
  on public.vocabulary_items (user_id, next_review_at, created_at);
create index vocabulary_items_user_status_idx
  on public.vocabulary_items (user_id, status, created_at desc);
create index vocabulary_reviews_item_reviewed_idx
  on public.vocabulary_reviews (vocabulary_item_id, reviewed_at desc);
create index learning_sessions_user_practice_mode_idx
  on public.learning_sessions (user_id, practice_mode, ended_at desc);

alter table public.vocabulary_items enable row level security;
alter table public.vocabulary_reviews enable row level security;

revoke all on table public.vocabulary_items from public, anon;
revoke all on table public.vocabulary_reviews from public, anon;

grant select, insert, update, delete on table public.vocabulary_items to authenticated;
grant select, insert on table public.vocabulary_reviews to authenticated;

create policy "vocabulary_items_select_own"
on public.vocabulary_items for select to authenticated
using ((select auth.uid()) = user_id);

create policy "vocabulary_items_insert_own"
on public.vocabulary_items for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "vocabulary_items_update_own"
on public.vocabulary_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "vocabulary_items_delete_own"
on public.vocabulary_items for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "vocabulary_reviews_select_own"
on public.vocabulary_reviews for select to authenticated
using ((select auth.uid()) = user_id);

create policy "vocabulary_reviews_insert_own"
on public.vocabulary_reviews for insert to authenticated
with check ((select auth.uid()) = user_id);

create or replace function public.save_vocabulary_item(
  p_term text,
  p_language text,
  p_meaning text,
  p_part_of_speech text default null,
  p_example_sentence text default null,
  p_source_session_id uuid default null,
  p_source_context text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized_term text;
  v_item_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_normalized_term :=
    lower(regexp_replace(btrim(normalize(coalesce(p_term, ''), NFKC)), '\s+', ' ', 'g'));

  if char_length(v_normalized_term) < 1
     or char_length(v_normalized_term) > 200
     or char_length(btrim(coalesce(p_meaning, ''))) < 1
     or char_length(btrim(p_meaning)) > 1000 then
    raise exception 'invalid vocabulary item' using errcode = '22023';
  end if;

  if p_source_session_id is not null
     and not exists (
       select 1 from public.learning_sessions
       where id = p_source_session_id and user_id = v_user_id
     ) then
    raise exception 'source learning session not found' using errcode = 'P0002';
  end if;

  insert into public.vocabulary_items (
    user_id,
    term,
    normalized_term,
    language,
    meaning,
    part_of_speech,
    example_sentence,
    source_session_id,
    source_context
  )
  values (
    v_user_id,
    btrim(p_term),
    v_normalized_term,
    p_language,
    btrim(p_meaning),
    nullif(btrim(p_part_of_speech), ''),
    nullif(btrim(p_example_sentence), ''),
    p_source_session_id,
    nullif(btrim(p_source_context), '')
  )
  on conflict (user_id, language, normalized_term)
  do update set
    meaning = case
      when char_length(public.vocabulary_items.meaning) = 0 then excluded.meaning
      else public.vocabulary_items.meaning
    end,
    part_of_speech = coalesce(public.vocabulary_items.part_of_speech, excluded.part_of_speech),
    example_sentence = coalesce(public.vocabulary_items.example_sentence, excluded.example_sentence),
    source_session_id = coalesce(public.vocabulary_items.source_session_id, excluded.source_session_id),
    source_context = coalesce(public.vocabulary_items.source_context, excluded.source_context),
    updated_at = now()
  returning id into v_item_id;

  return v_item_id;
end;
$$;

create or replace function public.review_vocabulary_item(
  p_item_id uuid,
  p_rating text,
  p_ease_factor numeric,
  p_interval_days integer,
  p_repetition_count integer,
  p_status text,
  p_next_review_at timestamptz,
  p_reviewed_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.vocabulary_items%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_rating not in ('again','hard','good','easy')
     or p_ease_factor < 1.30 or p_ease_factor > 3.00
     or p_interval_days < 1 or p_interval_days > 3650
     or p_repetition_count < 0 or p_repetition_count > 10000
     or p_status not in ('learning','strong')
     or p_next_review_at <= p_reviewed_at then
    raise exception 'invalid vocabulary review state' using errcode = '22023';
  end if;

  select * into v_item
  from public.vocabulary_items
  where id = p_item_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'vocabulary item not found' using errcode = 'P0002';
  end if;

  insert into public.vocabulary_reviews (
    vocabulary_item_id,
    user_id,
    rating,
    previous_interval_days,
    next_interval_days,
    reviewed_at
  ) values (
    v_item.id,
    v_user_id,
    p_rating,
    v_item.interval_days,
    p_interval_days,
    p_reviewed_at
  );

  update public.vocabulary_items
  set
    ease_factor = p_ease_factor,
    interval_days = p_interval_days,
    repetition_count = p_repetition_count,
    status = p_status,
    next_review_at = p_next_review_at,
    last_reviewed_at = p_reviewed_at,
    updated_at = now()
  where id = v_item.id and user_id = v_user_id;

  return jsonb_build_object(
    'id', v_item.id,
    'rating', p_rating,
    'easeFactor', p_ease_factor,
    'intervalDays', p_interval_days,
    'repetitionCount', p_repetition_count,
    'status', p_status,
    'nextReviewAt', p_next_review_at,
    'lastReviewedAt', p_reviewed_at
  );
end;
$$;

create or replace function public.get_vocabulary_overview()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
select jsonb_build_object(
  'saved', count(*)::integer,
  'learning', count(*) filter (where status = 'learning')::integer,
  'strong', count(*) filter (where status = 'strong')::integer,
  'due', count(*) filter (where next_review_at <= now())::integer,
  'nextDueAt', min(next_review_at) filter (where next_review_at > now()),
  'recent', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'term', r.term,
        'language', r.language,
        'meaning', r.meaning,
        'status', r.status,
        'nextReviewAt', r.next_review_at,
        'createdAt', r.created_at
      )
      order by r.created_at desc
    )
    from (
      select *
      from public.vocabulary_items
      where user_id = auth.uid()
      order by created_at desc
      limit 8
    ) r
  ), '[]'::jsonb)
)
from public.vocabulary_items
where user_id = auth.uid();
$$;

-- Personalized session creation overload. The original five-argument function
-- remains available for backwards compatibility with already-deployed clients.
create or replace function public.start_learning_session(
  p_language text,
  p_proficiency_level text,
  p_topic text,
  p_assistant_voice text,
  p_messages jsonb,
  p_practice_mode text,
  p_scenario_id text,
  p_custom_scenario text,
  p_learner_role text,
  p_tutor_role text,
  p_target_mistake_categories text[]
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

  if char_length(btrim(coalesce(p_topic, ''))) < 1
     or char_length(btrim(p_topic)) > 120
     or p_practice_mode not in ('conversation','roleplay','mistakes','custom')
     or cardinality(coalesce(p_target_mistake_categories, '{}'::text[])) > 3
     or not (
       coalesce(p_target_mistake_categories, '{}'::text[]) <@ array[
         'articles','verb_tense','prepositions','word_order','pluralization',
         'vocabulary_misuse','agreement','other'
       ]::text[]
     ) then
    raise exception 'invalid practice configuration' using errcode = '22023';
  end if;

  if jsonb_typeof(p_messages) <> 'array'
     or jsonb_array_length(p_messages) < 1
     or jsonb_array_length(p_messages) > 20
     or not exists (
       select 1
       from jsonb_array_elements(p_messages) as item
       where item->>'role' = 'user'
         and char_length(btrim(coalesce(item->>'text', ''))) > 0
     ) then
    raise exception 'a finalized user message is required' using errcode = '22023';
  end if;

  insert into public.learning_sessions (
    user_id,
    language,
    proficiency_level,
    topic,
    assistant_voice,
    feedback_status,
    practice_mode,
    scenario_id,
    custom_scenario,
    learner_role,
    tutor_role,
    target_mistake_categories
  )
  values (
    v_user_id,
    p_language,
    p_proficiency_level,
    btrim(p_topic),
    p_assistant_voice,
    'not_requested',
    p_practice_mode,
    nullif(btrim(p_scenario_id), ''),
    nullif(btrim(p_custom_scenario), ''),
    nullif(btrim(p_learner_role), ''),
    nullif(btrim(p_tutor_role), ''),
    coalesce(p_target_mistake_categories, '{}'::text[])
  )
  returning id into v_session_id;

  for v_message in select value from jsonb_array_elements(p_messages)
  loop
    insert into public.session_messages (
      session_id, user_id, role, sequence, text, occurred_at
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
  select distinct lower(regexp_replace(btrim(normalize(item->>'term', NFKC)), '\s+', ' ', 'g')) as term
  from public.session_feedback f
  cross join lateral jsonb_array_elements(f.vocabulary) item
  where f.user_id = auth.uid()
    and char_length(btrim(coalesce(item->>'term',''))) > 0
),
mistake_rows as (
  select
    item->>'category' as category,
    count(*)::integer as count,
    count(distinct f.session_id)::integer as affected_sessions,
    count(*) filter (
      where (s.ended_at at time zone profile.timezone)::date
        >= ((now() at time zone profile.timezone)::date - 6)
    )::integer as recent_count,
    count(*) filter (
      where (s.ended_at at time zone profile.timezone)::date
        between ((now() at time zone profile.timezone)::date - 13)
            and ((now() at time zone profile.timezone)::date - 7)
    )::integer as previous_count
  from public.session_feedback f
  join public.learning_sessions s
    on s.id = f.session_id and s.user_id = f.user_id
  cross join lateral jsonb_array_elements(f.grammar_corrections) item
  cross join profile
  where f.user_id = auth.uid()
    and s.status = 'completed'
    and s.ended_at is not null
    and char_length(btrim(coalesce(item->>'category',''))) > 0
  group by item->>'category'
),
recent_languages as (
  select language
  from completed
  group by language
  order by max(ended_at) desc
  limit 5
),
recent_scores as (
  select score
  from (
    select
      (f.fluency->>'score')::integer as score,
      s.ended_at
    from public.session_feedback f
    join public.learning_sessions s
      on s.id = f.session_id and s.user_id = f.user_id
    where f.user_id = auth.uid()
      and (f.fluency->>'score') ~ '^\d{1,3}$'
    order by s.ended_at desc nulls last
    limit 12
  ) recent
  order by ended_at asc
),
practice_dates as (
  select distinct local_date from local_meaningful order by local_date
),
vocabulary_growth as (
  select
    (v.created_at at time zone profile.timezone)::date as local_date,
    count(*)::integer as count
  from public.vocabulary_items v
  cross join profile
  where v.user_id = auth.uid()
  group by (v.created_at at time zone profile.timezone)::date
  order by local_date
)
select jsonb_build_object(
  'totalMinutes', coalesce((select floor(sum(duration_seconds) / 60.0)::integer from completed), 0),
  'thisWeekMinutes', coalesce((
    select floor(sum(duration_seconds) / 60.0)::integer
    from local_completed, profile
    where local_date >= date_trunc('week', now() at time zone profile.timezone)::date
  ), 0),
  'thisMonthMinutes', coalesce((
    select floor(sum(duration_seconds) / 60.0)::integer
    from local_completed, profile
    where local_date >= date_trunc('month', now() at time zone profile.timezone)::date
  ), 0),
  'previousWeekMinutes', coalesce((
    select floor(sum(duration_seconds) / 60.0)::integer
    from local_completed, profile
    where local_date >= (date_trunc('week', now() at time zone profile.timezone)::date - 7)
      and local_date < date_trunc('week', now() at time zone profile.timezone)::date
  ), 0),
  'minutesToday', coalesce((
    select floor(sum(duration_seconds) / 60.0)::integer
    from local_completed, profile
    where local_date = (now() at time zone profile.timezone)::date
  ), 0),
  'completedSessions', (select count(*)::integer from completed),
  'sessionsThisWeek', coalesce((
    select count(*)::integer
    from local_completed, profile
    where local_date >= date_trunc('week', now() at time zone profile.timezone)::date
  ), 0),
  'vocabularyLearned', (select count(*)::integer from vocabulary_terms),
  'vocabularySaved', (select count(*)::integer from public.vocabulary_items where user_id = auth.uid()),
  'vocabularyLearning', (select count(*)::integer from public.vocabulary_items where user_id = auth.uid() and status = 'learning'),
  'vocabularyStrong', (select count(*)::integer from public.vocabulary_items where user_id = auth.uid() and status = 'strong'),
  'vocabularyDue', (select count(*)::integer from public.vocabulary_items where user_id = auth.uid() and next_review_at <= now()),
  'newVocabularyThisWeek', coalesce((
    select count(*)::integer
    from public.vocabulary_items v, profile
    where v.user_id = auth.uid()
      and (v.created_at at time zone profile.timezone)::date
        >= date_trunc('week', now() at time zone profile.timezone)::date
  ), 0),
  'weeklyPractice', coalesce((
    select jsonb_agg(jsonb_build_object('date', local_date, 'minutes', minutes) order by local_date)
    from weekly_rows
  ), '[]'::jsonb),
  'commonMistakes', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'category', category,
        'count', count,
        'affectedSessions', affected_sessions,
        'recentCount', recent_count,
        'previousCount', previous_count
      )
      order by count desc, category
    )
    from mistake_rows
  ), '[]'::jsonb),
  'recentLanguages', coalesce((select jsonb_agg(language) from recent_languages), '[]'::jsonb),
  'recentScores', coalesce((select jsonb_agg(score) from recent_scores), '[]'::jsonb),
  'practiceDates', coalesce((select jsonb_agg(local_date order by local_date) from practice_dates), '[]'::jsonb),
  'vocabularyGrowth', coalesce((
    select jsonb_agg(jsonb_build_object('date', local_date, 'count', count) order by local_date)
    from vocabulary_growth
  ), '[]'::jsonb)
);
$$;

revoke all on function public.save_vocabulary_item(text,text,text,text,text,uuid,text) from public, anon;
revoke all on function public.review_vocabulary_item(uuid,text,numeric,integer,integer,text,timestamptz,timestamptz) from public, anon;
revoke all on function public.get_vocabulary_overview() from public, anon;
revoke all on function public.start_learning_session(text,text,text,text,jsonb,text,text,text,text,text,text[]) from public, anon;

grant execute on function public.save_vocabulary_item(text,text,text,text,text,uuid,text) to authenticated;
grant execute on function public.review_vocabulary_item(uuid,text,numeric,integer,integer,text,timestamptz,timestamptz) to authenticated;
grant execute on function public.get_vocabulary_overview() to authenticated;
grant execute on function public.start_learning_session(text,text,text,text,jsonb,text,text,text,text,text,text[]) to authenticated;
