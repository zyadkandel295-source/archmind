-- Additive metadata and durable checkpoints. Identity is text to support existing
-- JWT and Firebase users. API/worker database roles must be trusted server roles.
create table if not exists public.generated_files (
  id uuid primary key,
  user_id text not null,
  conversation_id uuid not null,
  assistant_id text,
  request_id uuid not null,
  status text not null check (status in ('queued','generating','rendering','completed','failed')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, request_id)
);
create index if not exists generated_files_history on public.generated_files(user_id, conversation_id, created_at desc);
create index if not exists generated_files_pending on public.generated_files(status, updated_at) where status in ('queued','generating','rendering');
alter table public.generated_files enable row level security;
do $$ begin
  if exists(select 1 from pg_roles where rolname='anon') then revoke all on public.generated_files from anon; end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on public.generated_files from authenticated; end if;
  if exists(select 1 from pg_roles where rolname='agentia_worker') then
    grant select,insert,update on public.generated_files to agentia_worker;
  end if;
end $$;
-- No client policies: access is exclusively through verified API ownership checks.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('generated-files','generated-files',false,26214400,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
    on conflict(id) do update set public=false,file_size_limit=26214400,allowed_mime_types=excluded.allowed_mime_types;
  end if;
end $$;
