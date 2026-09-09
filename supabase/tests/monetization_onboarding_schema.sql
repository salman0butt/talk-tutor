\set ON_ERROR_STOP on

do $$
declare
  missing_columns integer;
  missing_tables integer;
  missing_rls integer;
  insecure_session_functions integer;
begin
  select count(*) into missing_columns
  from (
    values
      ('profiles', 'onboarding_completed_at'),
      ('profiles', 'placement_completed_at'),
      ('profiles', 'placement_score'),
      ('profiles', 'recommended_level')
  ) expected(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = expected.table_name
      and c.column_name = expected.column_name
  );

  if missing_columns <> 0 then
    raise exception 'Onboarding columns are missing: %', missing_columns;
  end if;

  select count(*) into missing_tables
  from (
    values
      ('billing_accounts'),
      ('tutor_usage_events'),
      ('stripe_webhook_events'),
      ('tutor_session_leases')
  ) expected(table_name)
  where to_regclass('public.' || expected.table_name) is null;

  if missing_tables <> 0 then
    raise exception 'Billing/usage tables are missing: %', missing_tables;
  end if;

  select count(*) into missing_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'billing_accounts',
      'tutor_usage_events',
      'stripe_webhook_events',
      'tutor_session_leases'
    )
    and not c.relrowsecurity;

  if missing_rls <> 0 then
    raise exception 'Expected RLS on every billing/usage table; % missing', missing_rls;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_accounts'
      and policyname = 'billing_accounts_select_own'
  ) then
    raise exception 'Own billing-account read policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tutor_usage_events'
      and policyname = 'tutor_usage_events_select_own'
  ) then
    raise exception 'Own usage-event read policy missing';
  end if;

  if has_table_privilege('anon', 'public.billing_accounts', 'select')
     or has_table_privilege('anon', 'public.tutor_usage_events', 'select')
     or has_table_privilege('anon', 'public.stripe_webhook_events', 'select')
     or has_table_privilege('anon', 'public.tutor_session_leases', 'select') then
    raise exception 'anon unexpectedly has billing/usage privileges';
  end if;

  if not has_table_privilege('authenticated', 'public.billing_accounts', 'select')
     or not has_table_privilege('authenticated', 'public.tutor_usage_events', 'select') then
    raise exception 'authenticated role is missing read-only billing/usage access';
  end if;

  if has_table_privilege('authenticated', 'public.billing_accounts', 'insert')
     or has_table_privilege('authenticated', 'public.billing_accounts', 'update')
     or has_table_privilege('authenticated', 'public.billing_accounts', 'delete')
     or has_table_privilege('authenticated', 'public.tutor_usage_events', 'insert')
     or has_table_privilege('authenticated', 'public.tutor_usage_events', 'update')
     or has_table_privilege('authenticated', 'public.tutor_usage_events', 'delete')
     or has_table_privilege('authenticated', 'public.stripe_webhook_events', 'insert')
     or has_table_privilege('authenticated', 'public.tutor_session_leases', 'insert') then
    raise exception 'authenticated role can mutate authoritative billing/usage state';
  end if;

  if has_table_privilege('authenticated', 'public.learning_sessions', 'insert')
     or has_table_privilege('authenticated', 'public.learning_sessions', 'update')
     or has_table_privilege('authenticated', 'public.session_messages', 'insert') then
    raise exception 'authenticated role can still mutate billing-authoritative session state directly';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and (
        (tablename = 'learning_sessions' and policyname in (
          'learning_sessions_insert_own',
          'learning_sessions_update_own'
        ))
        or
        (tablename = 'session_messages' and policyname = 'session_messages_insert_own')
      )
  ) then
    raise exception 'Direct session mutation policies should be removed after hardening';
  end if;

  select count(*) into insecure_session_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'start_learning_session',
      'append_learning_message',
      'finalize_learning_session'
    )
    and not p.prosecdef;

  if insecure_session_functions <> 0 then
    raise exception 'Session mutation RPCs must be SECURITY DEFINER after billing hardening';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_usage_events_session_key'
      and contype = 'u'
  ) then
    raise exception 'Usage idempotency constraint missing';
  end if;

  if to_regprocedure('public.acquire_tutor_session_lease(uuid,integer)') is null
     or to_regprocedure('public.release_tutor_session_lease(uuid,uuid)') is null then
    raise exception 'Tutor lease functions are missing';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.acquire_tutor_session_lease(uuid,integer)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.release_tutor_session_lease(uuid,uuid)',
       'execute'
     ) then
    raise exception 'authenticated role can call service-only lease functions';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.acquire_tutor_session_lease(uuid,integer)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.release_tutor_session_lease(uuid,uuid)',
       'execute'
     ) then
    raise exception 'service_role is missing lease function access';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_learning_goal_check'
      and pg_get_constraintdef(oid) like '%immigration%'
  ) then
    raise exception 'Immigration learning goal was not added to the canonical profile constraint';
  end if;
end
$$;
