alter table assistants
  alter column model set default 'openrouter/auto',
  add column if not exists slug text,
  add column if not exists visibility text not null default 'private',
  add column if not exists icon text,
  add column if not exists color text,
  add column if not exists starter_prompts jsonb not null default '[]'::jsonb,
  add column if not exists enabled_tools jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

update assistants
set
  slug = coalesce(
    slug,
    public_slug,
    lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) || '-' || left(id::text, 6)
  ),
  visibility = case when is_public then 'public' else 'private' end,
  icon = coalesce(icon, 'Sparkles'),
  color = coalesce(color, '#06b6d4'),
  updated_at = coalesce(updated_at, created_at, now())
where slug is null or icon is null or color is null;

create unique index if not exists idx_assistants_slug on assistants(slug);

create table if not exists assistant_actions (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references assistants(id) on delete cascade,
  name text not null,
  type text not null check (type in ('webhook', 'whatsapp_share', 'copy', 'mailto', 'external_url')),
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assistant_actions_assistant_id on assistant_actions(assistant_id);

alter table assistant_actions enable row level security;

drop policy if exists assistant_actions_owner_access on assistant_actions;
create policy assistant_actions_owner_access on assistant_actions
  using (
    exists (
      select 1 from assistants a
      where a.id = assistant_actions.assistant_id
        and a.user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  with check (
    exists (
      select 1 from assistants a
      where a.id = assistant_actions.assistant_id
        and a.user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
    )
  );
