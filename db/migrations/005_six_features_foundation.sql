-- ArchMind six-feature foundation. Additive and reversible; does not rewrite existing user data.
do $$ begin
  create type workflow_status as enum ('draft', 'active', 'paused', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type workflow_run_status as enum ('queued', 'validating', 'waiting_for_permission', 'running', 'completed', 'failed', 'cancelled', 'undo_requested', 'undone', 'undo_failed');
exception when duplicate_object then null; end $$;

create table if not exists workflows (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade, organization_id uuid,
  name text not null, purpose text not null, status workflow_status not null default 'draft',
  created_version int not null default 1, active_version int, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists workflow_versions (
  id uuid primary key default gen_random_uuid(), workflow_id uuid not null references workflows(id) on delete cascade,
  version int not null, definition jsonb not null, validation jsonb not null, created_by uuid not null references users(id), created_at timestamptz not null default now(), unique(workflow_id, version)
);
create table if not exists workflow_runs (
  id uuid primary key default gen_random_uuid(), workflow_id uuid not null references workflows(id) on delete cascade,
  workflow_version int not null, owner_id uuid not null references users(id) on delete cascade, assistant_id uuid not null references assistants(id) on delete cascade,
  status workflow_run_status not null, idempotency_key text not null, input jsonb not null default '{}', output jsonb, error text, trace_id uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id, idempotency_key)
);
create table if not exists workflow_steps (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade, workflow_id uuid not null references workflows(id) on delete cascade,
  run_id uuid not null references workflow_runs(id) on delete cascade, action_id text not null, action_type text not null,
  status text not null check(status in ('pending','waiting_for_permission','completed','failed','undone')),
  preview jsonb, result jsonb, error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(run_id, action_id)
);
create table if not exists permission_grants (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete cascade,
  assistant_id uuid references assistants(id) on delete cascade, workflow_id uuid references workflows(id) on delete cascade,
  action_type text not null, resource text not null, mode text not null check(mode in ('once','workflow','assistant','resource','until','deny')),
  expires_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade, workflow_id uuid not null references workflows(id) on delete cascade,
  run_id uuid not null references workflow_runs(id) on delete cascade, action jsonb not null, preview jsonb not null,
  status text not null check(status in ('pending','approved','denied','expired')), decided_by uuid references users(id), decided_at timestamptz,
  idempotency_key text, created_at timestamptz not null default now()
);
create table if not exists audit_events (
  id uuid primary key, owner_id uuid not null references users(id) on delete cascade, organization_id uuid,
  assistant_id uuid references assistants(id) on delete set null, workflow_id uuid references workflows(id) on delete set null,
  run_id uuid references workflow_runs(id) on delete set null, action_type text not null, risk_level text not null,
  decision text, status text not null, preview jsonb, details jsonb not null default '{}', trace_id uuid not null,
  previous_hash text not null, hash text not null, created_at timestamptz not null default now()
);
create or replace function reject_audit_mutation() returns trigger language plpgsql as $$ begin raise exception 'audit_events are append-only'; end $$;
drop trigger if exists audit_events_immutable on audit_events;
create trigger audit_events_immutable before update or delete on audit_events for each row execute function reject_audit_mutation();
create table if not exists undo_records (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete cascade,
  audit_event_id uuid references audit_events(id), action_type text not null, payload jsonb not null,
  expected_resource_hash text, status text not null check(status in ('available','undone','conflict','failed')),
  idempotency_key text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists memory_records (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete cascade,
  scope text not null check(scope in ('conversation','assistant','user','workflow','session')), assistant_id uuid references assistants(id) on delete cascade,
  workflow_id uuid references workflows(id) on delete cascade, source text not null, category text not null, content text not null,
  confidence numeric(4,3) not null check(confidence between 0 and 1), sensitivity text not null,
  assistant_visibility jsonb not null default '[]', provenance jsonb not null default '{}', expires_at timestamptz,
  last_used_at timestamptz, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists memory_settings (
  owner_id uuid not null references users(id) on delete cascade,
  assistant_id uuid references assistants(id) on delete cascade,
  memory_enabled boolean not null default true,
  default_sensitivity text not null default 'normal' check(default_sensitivity in ('normal','sensitive')),
  retention_days int check(retention_days is null or retention_days > 0),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_memory_settings_owner_assistant_null on memory_settings(owner_id, coalesce(assistant_id, '00000000-0000-0000-0000-000000000000'::uuid));
create table if not exists automation_pause_states (
  owner_id uuid primary key references users(id) on delete cascade, global_paused boolean not null default false,
  assistant_ids jsonb not null default '[]', workflow_ids jsonb not null default '[]', updated_at timestamptz not null default now()
);

create index if not exists idx_workflows_owner_assistant on workflows(owner_id, assistant_id);
create index if not exists idx_runs_owner_created on workflow_runs(owner_id, created_at desc);
create index if not exists idx_steps_run on workflow_steps(run_id, created_at);
create index if not exists idx_approvals_owner_status on approval_requests(owner_id, status, created_at desc);
create index if not exists idx_audit_owner_created on audit_events(owner_id, created_at desc);
create index if not exists idx_memories_owner_scope on memory_records(owner_id, scope, created_at desc) where deleted_at is null;

do $$ declare table_name text; begin
  foreach table_name in array array['workflows','workflow_runs','workflow_steps','permission_grants','approval_requests','audit_events','undo_records','memory_records','memory_settings','automation_pause_states'] loop
    execute format('alter table %I enable row level security', table_name);
    execute format('drop policy if exists owner_access on %I', table_name);
    execute format('create policy owner_access on %I using (owner_id = current_app_user_id()) with check (owner_id = current_app_user_id())', table_name);
  end loop;
end $$;
alter table workflow_versions enable row level security;
drop policy if exists owner_access on workflow_versions;
create policy owner_access on workflow_versions using (exists(select 1 from workflows w where w.id=workflow_id and w.owner_id=current_app_user_id()));
