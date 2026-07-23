create table if not exists desktop_runtime_releases (
  id uuid primary key,
  version text not null,
  platform text not null check (platform in ('windows')),
  architecture text not null check (architecture in ('x64')),
  channel text not null check (channel in ('development', 'stable')),
  status text not null check (status in ('building', 'ready', 'failed', 'retired')),
  artifact_key text not null,
  artifact_path text,
  filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  signature_status text not null check (signature_status in ('unsigned-dev', 'signed', 'blocked')),
  minimum_api_version text not null,
  manifest_schema_version integer not null check (manifest_schema_version > 0),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  retired_at timestamptz,
  unique(version, platform, architecture, channel)
);

create index if not exists idx_desktop_runtime_releases_ready
  on desktop_runtime_releases(platform, architecture, channel, status, published_at desc);

create table if not exists assistant_snapshots (
  id uuid primary key,
  owner_id uuid not null references users(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade,
  assistant_version integer not null check (assistant_version > 0),
  display_name text not null check (char_length(display_name) between 1 and 120),
  icon text,
  icon_digest text,
  instruction_digest text not null check (instruction_digest ~ '^[a-f0-9]{64}$'),
  manifest_schema_version integer not null check (manifest_schema_version > 0),
  manifest jsonb not null,
  manifest_digest text not null check (manifest_digest ~ '^[a-f0-9]{64}$'),
  signature text not null,
  signature_key_id text not null,
  status text not null check (status in ('published', 'retired')),
  created_at timestamptz not null default now(),
  unique(owner_id, assistant_id, assistant_version, manifest_schema_version)
);

create index if not exists idx_assistant_snapshots_owner_assistant
  on assistant_snapshots(owner_id, assistant_id, created_at desc);

create table if not exists assistant_install_intents (
  id uuid primary key,
  owner_id uuid not null references users(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade,
  snapshot_id uuid not null references assistant_snapshots(id) on delete restrict,
  runtime_release_id uuid not null references desktop_runtime_releases(id) on delete restrict,
  platform text not null check (platform in ('windows')),
  architecture text not null check (architecture in ('x64')),
  status text not null check (status in ('created', 'runtime_required', 'awaiting_claim', 'claimed', 'activated', 'expired', 'revoked', 'failed')),
  idempotency_key text not null,
  request_fingerprint text not null,
  claim_secret_hash text not null,
  download_token_hash text not null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  activated_at timestamptz,
  revoked_at timestamptz,
  claimed_device_id uuid,
  error_code text,
  error_message text,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, idempotency_key)
);

create unique index if not exists uq_assistant_install_active
  on assistant_install_intents(owner_id, assistant_id, snapshot_id, platform, architecture)
  where status in ('created', 'runtime_required', 'awaiting_claim');

create index if not exists idx_assistant_install_intents_owner
  on assistant_install_intents(owner_id, assistant_id, created_at desc);
create index if not exists idx_assistant_install_intents_claim_secret
  on assistant_install_intents(claim_secret_hash);
create index if not exists idx_assistant_install_intents_download
  on assistant_install_intents(download_token_hash);

create table if not exists device_assistants (
  id uuid primary key,
  device_session_id uuid not null references device_sessions(id) on delete cascade,
  owner_id uuid not null references users(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade,
  snapshot_id uuid not null references assistant_snapshots(id) on delete restrict,
  assistant_version integer not null check (assistant_version > 0),
  local_profile_id text not null,
  status text not null check (status in ('active', 'revoked', 'removed')),
  installed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(device_session_id, assistant_id)
);

create index if not exists idx_device_assistants_owner_assistant
  on device_assistants(owner_id, assistant_id, status);
