\set ON_ERROR_STOP on

do $$
declare
  missing_columns integer;
  missing_tables integer;
  missing_rls integer;
  missing_policies integer;
  insecure_functions integer;
begin
  select count(*) into missing_columns
  from (
    values
      ('profiles', 'correction_frequency'),
      ('profiles', 'conversation_difficulty'),
      ('learning_sessions', 'practice_mode'),
      ('learning_sessions', 'scenario_id'),
      ('learning_sessions', 'custom_scenario'),
      ('learning_sessions', 'learner_role'),
      ('learning_sessions', 'tutor_role'),
      ('learning_sessions', 'target_mistake_categories')
  ) expected(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = expected.table_name
      and c.column_name = expected.column_name
  );

  if missing_columns <> 0 then
    raise exception 'Personalized practice columns are missing: %', missing_columns;
  end if;

  select count(*) into missing_tables
  from (values ('vocabulary_items'), ('vocabulary_reviews')) expected(table_name)
  where to_regclass('public.' || expected.table_name) is null;

  if missing_tables <> 0 then
    raise exception 'Vocabulary tables are missing: %', missing_tables;
  end if;

  select count(*) into missing_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('vocabulary_items', 'vocabulary_reviews')
    and not c.relrowsecurity;

  if missing_rls <> 0 then
    raise exception 'Expected RLS on vocabulary tables; % missing', missing_rls;
  end if;

  select count(*) into missing_policies
  from (
    values
      ('vocabulary_items', 'vocabulary_items_select_own'),
      ('vocabulary_items', 'vocabulary_items_insert_own'),
      ('vocabulary_items', 'vocabulary_items_update_own'),
      ('vocabulary_items', 'vocabulary_items_delete_own'),
      ('vocabulary_reviews', 'vocabulary_reviews_select_own'),
      ('vocabulary_reviews', 'vocabulary_reviews_insert_own')
  ) expected(table_name, policy_name)
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = expected.table_name
      and p.policyname = expected.policy_name
  );

  if missing_policies <> 0 then
    raise exception 'Vocabulary RLS policies are missing: %', missing_policies;
  end if;

  if has_table_privilege('anon', 'public.vocabulary_items', 'select')
     or has_table_privilege('anon', 'public.vocabulary_reviews', 'select') then
    raise exception 'anon unexpectedly has vocabulary SELECT privileges';
  end if;

  if not has_table_privilege('authenticated', 'public.vocabulary_items', 'select')
     or not has_table_privilege('authenticated', 'public.vocabulary_items', 'insert')
     or not has_table_privilege('authenticated', 'public.vocabulary_items', 'update')
     or not has_table_privilege('authenticated', 'public.vocabulary_items', 'delete')
     or not has_table_privilege('authenticated', 'public.vocabulary_reviews', 'select')
     or not has_table_privilege('authenticated', 'public.vocabulary_reviews', 'insert') then
    raise exception 'authenticated vocabulary privileges are incomplete';
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'vocabulary_items_owner_key'
  ) then
    raise exception 'Vocabulary composite owner key missing';
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'vocabulary_reviews_item_owner_fk'
      and contype = 'f'
  ) then
    raise exception 'Vocabulary review composite ownership FK missing';
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'vocabulary_items_source_session_owner_fk'
      and contype = 'f'
  ) then
    raise exception 'Vocabulary source-session composite ownership FK missing';
  end if;

  select count(*) into insecure_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'save_vocabulary_item',
      'review_vocabulary_item',
      'get_vocabulary_overview',
      'start_learning_session',
      'get_learning_dashboard'
    )
    and p.prosecdef;

  if insecure_functions <> 0 then
    raise exception 'Personalized learning RPCs must remain SECURITY INVOKER';
  end if;
end
$$;
