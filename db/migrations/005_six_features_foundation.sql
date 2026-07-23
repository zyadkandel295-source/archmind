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
create table if not exists assistant_packages (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade, product_name text not null, description text not null,
  publisher_name text not null, category text not null, pricing_type text not null, status text not null default 'draft',
  current_version int, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists package_versions (
  id uuid primary key default gen_random_uuid(), package_id uuid not null references assistant_packages(id) on delete cascade,
  version int not null, release_notes text not null, manifest jsonb not null, checksum text not null, status text not null,
  created_at timestamptz not null default now(), unique(package_id, version)
);
create table if not exists entitlements (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete cascade,
  package_id uuid not null references assistant_packages(id) on delete cascade, package_version int not null,
  status text not null, seats int not null check(seats > 0), expires_at timestamptz, created_at timestamptz not null default now(), unique(owner_id, package_id)
);
create table if not exists package_licenses (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete cascade,
  package_id uuid not null references assistant_packages(id) on delete cascade,
  entitlement_id uuid not null references entitlements(id) on delete cascade,
  status text not null check(status in ('active','expired','revoked')),
  seats int not null check(seats > 0), issued_at timestamptz not null default now(),
  expires_at timestamptz, revoked_at timestamptz
);
create table if not exists bootstrap_tokens (
  id uuid primary key default gen_random_uuid(), token_hash text not null unique, owner_id uuid not null references users(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade, package_id uuid references assistant_packages(id) on delete cascade,
  expires_at timestamptz not null, used_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists device_sessions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade, installation_id text not null, device_name text not null,
  session_token_hash text not null unique, revoked_at timestamptz, last_seen_at timestamptz not null, created_at timestamptz not null default now(), unique(assistant_id, installation_id)
);
create table if not exists desktop_builds (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade, package_id uuid references assistant_packages(id) on delete set null,
  platform text not null check(platform in ('win32','darwin','linux')),
  architecture text not null default 'x64' check(architecture in ('x64','arm64')),
  status text not null check(status in ('idle','validating','queued','building','packaging','validating_artifact','ready','downloading','failed','expired','cancelled')),
  app_id text not null, product_name text not null, protocol text not null,
  runtime_version text not null default 'unknown', assistant_version int not null default 1, branding_hash text not null default 'unknown',
  build_queue_id text,
  artifact_path text, artifact_size bigint, artifact_sha256 text, download_token_hash text not null,
  error text, expires_at timestamptz not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_id, app_id), unique(owner_id, protocol)
);
alter table desktop_builds add column if not exists architecture text not null default 'x64';
alter table desktop_builds add column if not exists runtime_version text not null default 'unknown';
alter table desktop_builds add column if not exists assistant_version int not null default 1;
alter table desktop_builds add column if not exists branding_hash text not null default 'unknown';
alter table desktop_builds add column if not exists build_queue_id text;
create table if not exists installer_downloads (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references users(id) on delete cascade,
  build_id uuid not null references desktop_builds(id) on delete cascade,
  status text not null check(status in ('issued','downloaded','expired','revoked')),
  token_hash text not null, downloaded_at timestamptz, expires_at timestamptz not null, created_at timestamptz not null default now()
);
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
create index if not exists idx_entitlements_owner_status on entitlements(owner_id, status);
create index if not exists idx_licenses_owner_status on package_licenses(owner_id, status);
create index if not exists idx_devices_owner on device_sessions(owner_id, revoked_at);
create index if not exists idx_desktop_builds_owner_status on desktop_builds(owner_id, status, created_at desc);
create index if not exists idx_installer_downloads_owner on installer_downloads(owner_id, created_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['workflows','workflow_runs','workflow_steps','permission_grants','approval_requests','audit_events','undo_records','memory_records','memory_settings','assistant_packages','entitlements','package_licenses','bootstrap_tokens','device_sessions','desktop_builds','installer_downloads','automation_pause_states'] loop
    execute format('alter table %I enable row level security', table_name);
    execute format('drop policy if exists owner_access on %I', table_name);
    execute format('create policy owner_access on %I using (owner_id = current_app_user_id()) with check (owner_id = current_app_user_id())', table_name);
  end loop;
end $$;
alter table workflow_versions enable row level security;
drop policy if exists owner_access on workflow_versions;
create policy owner_access on workflow_versions using (exists(select 1 from workflows w where w.id=workflow_id and w.owner_id=current_app_user_id()));
alter table package_versions enable row level security;
drop policy if exists owner_access on package_versions;
create policy owner_access on package_versions using (exists(select 1 from assistant_packages p where p.id=package_id and p.owner_id=current_app_user_id()));
