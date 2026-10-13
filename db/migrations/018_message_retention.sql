-- Agentia chat-message retention. Apply as the database owner after reviewing
-- the read-only dry run. This migration does not delete any message immediately.
-- pg_cron runs the cleanup every day at 03:00 UTC.

do $$
begin
  if to_regclass('public.messages') is null or to_regclass('public.chats') is null then
    raise exception 'Expected public.messages and public.chats before enabling retention';
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.messages'::regclass
      and attname = 'created_at' and atttypid = 'timestamptz'::regtype
      and not attisdropped
  ) or not exists (
    select 1 from pg_attribute
    where attrelid = 'public.messages'::regclass
      and attname = 'id' and atttypid = 'uuid'::regtype
      and not attisdropped
  ) or not exists (
    select 1 from pg_attribute
    where attrelid = 'public.messages'::regclass
      and attname = 'chat_id' and atttypid = 'uuid'::regtype
      and not attisdropped
  ) then
    raise exception 'Message columns differ from the inspected schema; review retention first';
  end if;

  if not exists (
    select 1 from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attname = 'id'
    where i.indrelid = 'public.messages'::regclass
      and i.indisunique and i.indisvalid and i.indpred is null
      and i.indnkeyatts = 1 and i.indkey[0] = a.attnum
  ) then
    raise exception 'Message id must have a unique index before batched deletion';
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.chats'::regclass
      and attname = 'is_favorite' and atttypid = 'bool'::regtype
      and not attisdropped
  ) or not exists (
    select 1 from pg_attribute
    where attrelid = 'public.chats'::regclass
      and attname = 'is_archived' and atttypid = 'bool'::regtype
      and not attisdropped
  ) then
    raise exception 'Chat exemption columns differ from the inspected schema';
  end if;

  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.messages'::regclass
      and attname in ('is_pinned', 'is_saved', 'pinned_at', 'saved_at')
      and not attisdropped
  ) then
    raise exception 'Message-level retention exemptions now exist; review cleanup before enabling it';
  end if;

  if exists (
    select 1 from pg_constraint
    where contype = 'f' and confrelid = 'public.messages'::regclass
  ) then
    raise exception 'Another table references messages; review delete effects before enabling retention';
  end if;

  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.messages'::regclass
      and not tgisinternal and (tgtype & 8) = 8
  ) then
    raise exception 'A custom message DELETE trigger exists; review it before enabling retention';
  end if;

  if exists (
    select 1 from pg_rewrite
    where ev_class = 'public.messages'::regclass and ev_type = '4'
  ) then
    raise exception 'A custom message DELETE rule exists; review it before enabling retention';
  end if;
end $$;

-- Supabase Cron creates and owns the cron schema. A missing/unsupported
-- extension causes this migration to fail, leaving no scheduled deletion.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create schema if not exists agentia_maintenance;
revoke all on schema agentia_maintenance from public, anon, authenticated, service_role;

create table if not exists agentia_maintenance.settings (
  name text primary key check (name = 'MESSAGE_RETENTION_DAYS'),
  value integer not null check (value in (3, 5))
);
insert into agentia_maintenance.settings(name, value)
values ('MESSAGE_RETENTION_DAYS', 5)
on conflict (name) do nothing;

create table if not exists agentia_maintenance.message_cleanup_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  retention_days integer,
  cutoff_at timestamptz,
  deleted_messages integer not null default 0,
  status text not null check (status in ('success', 'skipped', 'error')),
  error text
);
create index if not exists message_cleanup_runs_started_at_idx
  on agentia_maintenance.message_cleanup_runs(started_at desc);
revoke all on agentia_maintenance.settings,
  agentia_maintenance.message_cleanup_runs from public, anon, authenticated, service_role;

-- The oldest eligible rows are read through an existing leading created_at
-- btree index when possible. Only create one if the project has none.
do $$
begin
  if not exists (
    select 1
    from pg_index i
    join pg_class index_relation on index_relation.oid = i.indexrelid
    join pg_am am on am.oid = index_relation.relam
    join pg_attribute age_column
      on age_column.attrelid = i.indrelid and age_column.attname = 'created_at'
    where i.indrelid = 'public.messages'::regclass
      and i.indisvalid and i.indisready
      and i.indkey[0] = age_column.attnum
      and i.indpred is null
      and am.amname = 'btree'
  ) then
    execute 'create index message_cleanup_created_at_idx '
      || 'on public.messages(created_at, id)';
  end if;
end $$;

create or replace function agentia_maintenance.cleanup_messages()
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_cutoff_at timestamptz;
  v_retention_days integer;
  v_batch_deleted integer;
  v_total_deleted integer := 0;
  v_batch integer;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(171054, 90510) then
    insert into agentia_maintenance.message_cleanup_runs
      (started_at, finished_at, deleted_messages, status)
    values (v_started_at, clock_timestamp(), 0, 'skipped');
    return 0;
  end if;

  begin
    select value into strict v_retention_days
    from agentia_maintenance.settings
    where name = 'MESSAGE_RETENTION_DAYS';
    v_cutoff_at := v_started_at - pg_catalog.make_interval(days => v_retention_days);

    -- At most 10,000 messages per daily run; each statement locks no more
    -- than 250 message rows. Any larger backlog continues the next day.
    for v_batch in 1..40 loop
      with candidates as materialized (
        select m.id
        from public.messages m
        where m.created_at < v_cutoff_at
          and not exists (
            select 1 from public.chats c
            where c.id = m.chat_id
              and (coalesce(c.is_favorite, false) or coalesce(c.is_archived, false))
          )
        order by m.created_at, m.id
        limit 250
        for update of m skip locked
      ), deleted as (
        delete from public.messages m
        using candidates c
        where m.id = c.id
        returning m.id
      )
      select count(*)::integer into v_batch_deleted from deleted;

      v_total_deleted := v_total_deleted + v_batch_deleted;
      exit when v_batch_deleted < 250;
    end loop;

    insert into agentia_maintenance.message_cleanup_runs
      (started_at, finished_at, retention_days, cutoff_at, deleted_messages, status)
    values (v_started_at, clock_timestamp(), v_retention_days, v_cutoff_at,
            v_total_deleted, 'success');
    raise log 'Agentia message cleanup completed: deleted %, retention % days, started %',
      v_total_deleted, v_retention_days, v_started_at;
    return v_total_deleted;
  exception when others then
    insert into agentia_maintenance.message_cleanup_runs
      (started_at, finished_at, retention_days, cutoff_at, deleted_messages, status, error)
    values (v_started_at, clock_timestamp(), v_retention_days, v_cutoff_at,
            0, 'error', sqlstate || ': ' || sqlerrm);
    raise warning 'Agentia message cleanup failed: %: %', sqlstate, sqlerrm;
    return 0;
  end;
end;
$$;
revoke all on function agentia_maintenance.cleanup_messages()
  from public, anon, authenticated, service_role;

-- The job name is stable, so reapplying this migration updates its schedule
-- instead of creating a second job. 03:00 UTC, once every 24 hours.
select cron.schedule(
  'agentia-message-cleanup',
  '0 3 * * *',
  $$select agentia_maintenance.cleanup_messages();$$
);

do $$
begin
  if not exists (
    select 1 from cron.job
    where jobname = 'agentia-message-cleanup'
      and schedule = '0 3 * * *'
      and command = 'select agentia_maintenance.cleanup_messages();'
      and active
  ) then
    raise exception 'Message cleanup cron job was not enabled as expected';
  end if;
end $$;
