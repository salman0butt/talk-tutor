\set ON_ERROR_STOP on

do $$
declare
  missing_rls integer;
  missing_policies integer;
  insecure_function integer;
begin
  select count(*) into missing_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('profiles', 'learning_sessions', 'session_messages', 'session_feedback')
    and not c.relrowsecurity;

  if missing_rls <> 0 then
    raise exception 'Expected RLS on every learning platform table; % missing', missing_rls;
  end if;

  select count(*) into missing_policies
  from (
    values
      ('profiles', 'profiles_select_own'),
      ('profiles', 'profiles_insert_own'),
      ('profiles', 'profiles_update_own'),
      ('learning_sessions', 'learning_sessions_select_own'),
      ('learning_sessions', 'learning_sessions_insert_own'),
      ('learning_sessions', 'learning_sessions_update_own'),
      ('session_messages', 'session_messages_select_own'),
      ('session_messages', 'session_messages_insert_own'),
      ('session_feedback', 'session_feedback_select_own'),
      ('session_feedback', 'session_feedback_insert_own'),
      ('session_feedback', 'session_feedback_update_own')
  ) expected(table_name, policy_name)
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = expected.table_name
      and p.policyname = expected.policy_name
  );

  if missing_policies <> 0 then
    raise exception 'Expected RLS policies are missing: %', missing_policies;
  end if;

  if has_table_privilege('anon', 'public.profiles', 'select')
     or has_table_privilege('anon', 'public.learning_sessions', 'select')
     or has_table_privilege('anon', 'public.session_messages', 'select')
     or has_table_privilege('anon', 'public.session_feedback', 'select') then
    raise exception 'anon unexpectedly has learning-data SELECT privileges';
  end if;

  if not has_table_privilege('authenticated', 'public.profiles', 'select')
     or not has_table_privilege('authenticated', 'public.learning_sessions', 'select')
     or not has_table_privilege('authenticated', 'public.session_messages', 'select')
     or not has_table_privilege('authenticated', 'public.session_feedback', 'select') then
    raise exception 'authenticated role is missing expected SELECT privileges';
  end if;

  select count(*) into insecure_function
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'start_learning_session',
      'append_learning_message',
      'finalize_learning_session',
      'get_learning_dashboard'
    )
    and p.prosecdef;

  if insecure_function <> 0 then
    raise exception 'Learning RPCs must remain SECURITY INVOKER';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'session_messages_session_owner_fk'
      and contype = 'f'
  ) then
    raise exception 'Composite message/session ownership foreign key missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'session_feedback_session_owner_fk'
      and contype = 'f'
  ) then
    raise exception 'Composite feedback/session ownership foreign key missing';
  end if;
end
$$;
