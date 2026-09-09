\set ON_ERROR_STOP on

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

update public.profiles
set correction_frequency = 'frequent',
    conversation_difficulty = 'challenging'
where id = '11111111-1111-4111-8111-111111111111';

select public.save_vocabulary_item(
  'Departure',
  'en-US',
  'the act of leaving',
  null,
  'The departure is at nine.',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'We discussed airport departure times.'
);

select public.save_vocabulary_item(
  ' departure ',
  'en-US',
  'duplicate meaning must not create another row',
  null,
  null,
  null,
  null
);

do $$
declare
  v_count integer;
  v_item_id uuid;
begin
  select count(*)::integer
  into v_count
  from public.vocabulary_items
  where user_id = '11111111-1111-4111-8111-111111111111'
    and language = 'en-US'
    and normalized_term = 'departure';

  if v_count <> 1 then
    raise exception 'Vocabulary save did not deduplicate normalized terms';
  end if;

  select id into v_item_id
  from public.vocabulary_items
  where user_id = '11111111-1111-4111-8111-111111111111'
    and language = 'en-US'
    and normalized_term = 'departure'
  limit 1;

  perform public.review_vocabulary_item(v_item_id, 'good');

  if not exists (
    select 1
    from public.vocabulary_reviews
    where vocabulary_item_id = v_item_id
      and user_id = '11111111-1111-4111-8111-111111111111'
      and rating = 'good'
      and next_interval_days = 1
  ) then
    raise exception 'Vocabulary review history was not written';
  end if;
end
$$;

select public.start_learning_session(
  'en-US',
  'Intermediate',
  'Software engineering interview',
  'Aoede',
  '[{"role":"user","text":"Tell me about the role.","sequence":0,"occurredAt":"2026-09-09T12:00:00Z"}]'::jsonb,
  'roleplay',
  'job-interview',
  'A technical job interview.',
  'Candidate',
  'Hiring manager',
  array['articles','verb_tense']::text[],
  'frequent',
  'challenging'
);

do $$
begin
  if not exists (
    select 1
    from public.learning_sessions
    where user_id = '11111111-1111-4111-8111-111111111111'
      and practice_mode = 'roleplay'
      and correction_frequency = 'frequent'
      and conversation_difficulty = 'challenging'
      and target_mistake_categories = array['articles','verb_tense']::text[]
  ) then
    raise exception 'Personalized practice metadata was not persisted';
  end if;
end
$$;

reset role;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

do $$
declare
  v_foreign_item uuid;
begin
  select id into v_foreign_item
  from public.vocabulary_items
  where user_id = '11111111-1111-4111-8111-111111111111'
  limit 1;

  if v_foreign_item is not null then
    raise exception 'RLS leaked another learner vocabulary item';
  end if;

  if exists (
    select 1
    from public.vocabulary_reviews
    where user_id = '11111111-1111-4111-8111-111111111111'
  ) then
    raise exception 'RLS leaked another learner vocabulary review';
  end if;

  update public.vocabulary_items
  set meaning = 'cross-user mutation'
  where user_id = '11111111-1111-4111-8111-111111111111';

  if found then
    raise exception 'RLS allowed cross-user vocabulary update';
  end if;
end
$$;

reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

do $$
begin
  begin
    insert into public.vocabulary_items (
      user_id,
      term,
      normalized_term,
      language,
      meaning,
      source_session_id
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'bonjour',
      'bonjour',
      'fr-FR',
      'hello',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    );
    raise exception 'Cross-owner source session was accepted';
  exception
    when foreign_key_violation then
      null;
  end;
end
$$;

reset role;
