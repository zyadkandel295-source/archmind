create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

do $$ begin
  create type plan_type as enum ('free', 'pro', 'team');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tone_type as enum ('professional', 'casual', 'teacher', 'custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type source_type as enum ('pdf', 'text', 'url', 'notion');
exception when duplicate_object then null; end $$;

do $$ begin
  create type source_status as enum ('pending', 'processing', 'ready', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_role as enum ('user', 'assistant', 'system');
exception when duplicate_object then null; end $$;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text,
  google_id text,
  plan plan_type not null default 'free',
  token_usage bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assistants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text,
  system_prompt text not null,
  tone tone_type not null default 'professional',
  is_public boolean not null default false,
  public_slug text unique,
  model text not null default 'openrouter/auto',
  temperature double precision not null default 0.7,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists data_sources (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references assistants(id) on delete cascade,
  type source_type not null,
  name text not null,
  s3_key text,
  url text,
  status source_status not null default 'pending',
  chunk_count int not null default 0,
  token_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references assistants(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  session_id text,
  title text,
  message_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role message_role not null,
  content text not null,
  tokens_used int not null default 0,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references assistants(id) on delete cascade,
  event_type text not null,
  tokens int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistants_user_id on assistants(user_id);
create index if not exists idx_assistants_public_slug on assistants(public_slug) where public_slug is not null;
create index if not exists idx_data_sources_assistant_id on data_sources(assistant_id);
create index if not exists idx_conversations_assistant_id on conversations(assistant_id);
create index if not exists idx_conversations_user_id on conversations(user_id);
create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_messages_sources on messages using gin(sources);
create index if not exists idx_analytics_assistant_id_created_at on analytics_events(assistant_id, created_at desc);
create index if not exists idx_analytics_event_type on analytics_events(event_type);

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at before update on users
for each row execute function set_updated_at();

drop trigger if exists data_sources_set_updated_at on data_sources;
create trigger data_sources_set_updated_at before update on data_sources
for each row execute function set_updated_at();

alter table users enable row level security;
alter table assistants enable row level security;
alter table data_sources enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table analytics_events enable row level security;

create or replace function current_app_user_id()
returns uuid as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$ language sql stable;

drop policy if exists users_own_row on users;
create policy users_own_row on users
  using (id = current_app_user_id())
  with check (id = current_app_user_id());

drop policy if exists assistants_owner_access on assistants;
create policy assistants_owner_access on assistants
  using (user_id = current_app_user_id())
  with check (user_id = current_app_user_id());

drop policy if exists assistants_public_read on assistants;
create policy assistants_public_read on assistants
  for select using (is_public = true);

drop policy if exists sources_owner_access on data_sources;
create policy sources_owner_access on data_sources
  using (
    exists (
      select 1 from assistants a
      where a.id = data_sources.assistant_id
        and a.user_id = current_app_user_id()
    )
  )
  with check (
    exists (
      select 1 from assistants a
      where a.id = data_sources.assistant_id
        and a.user_id = current_app_user_id()
    )
  );

drop policy if exists conversations_owner_or_public on conversations;
create policy conversations_owner_or_public on conversations
  using (
    user_id = current_app_user_id()
    or exists (
      select 1 from assistants a
      where a.id = conversations.assistant_id
        and (a.user_id = current_app_user_id() or a.is_public = true)
    )
  )
  with check (
    user_id = current_app_user_id()
    or exists (
      select 1 from assistants a
      where a.id = conversations.assistant_id
        and (a.user_id = current_app_user_id() or a.is_public = true)
    )
  );

drop policy if exists messages_conversation_access on messages;
create policy messages_conversation_access on messages
  using (
    exists (
      select 1 from conversations c
      join assistants a on a.id = c.assistant_id
      where c.id = messages.conversation_id
        and (c.user_id = current_app_user_id() or a.user_id = current_app_user_id() or a.is_public = true)
    )
  )
  with check (
    exists (
      select 1 from conversations c
      join assistants a on a.id = c.assistant_id
      where c.id = messages.conversation_id
        and (c.user_id = current_app_user_id() or a.user_id = current_app_user_id() or a.is_public = true)
    )
  );

drop policy if exists analytics_owner_access on analytics_events;
create policy analytics_owner_access on analytics_events
  using (
    exists (
      select 1 from assistants a
      where a.id = analytics_events.assistant_id
        and a.user_id = current_app_user_id()
    )
  )
  with check (
    exists (
      select 1 from assistants a
      where a.id = analytics_events.assistant_id
        and a.user_id = current_app_user_id()
    )
  );
