-- Bring the deployed Supabase schema in line with the application's
-- ownership model and remove non-destructive Security Advisor findings.

-- Knowledge chunks contain uploaded document content and must never be
-- reachable through the public API without an owner check.
alter table public.knowledge_chunks enable row level security;

drop policy if exists knowledge_chunks_owner_access on public.knowledge_chunks;
create policy knowledge_chunks_owner_access on public.knowledge_chunks
  using (
    exists (
      select 1
      from public.assistants a
      where a.id = knowledge_chunks.assistant_id
        and a.user_id::text = public.current_app_user_id()::text
        and knowledge_chunks.user_id::text = a.user_id
    )
  )
  with check (
    exists (
      select 1
      from public.assistants a
      where a.id = knowledge_chunks.assistant_id
        and a.user_id::text = public.current_app_user_id()::text
        and knowledge_chunks.user_id::text = a.user_id
    )
  );

-- Use the shared identity helper, rather than duplicating a raw session
-- setting in a policy expression. This keeps the policy consistent with the
-- rest of the application's owner-scoped tables.
drop policy if exists assistant_actions_owner_access on public.assistant_actions;
create policy assistant_actions_owner_access on public.assistant_actions
  using (
    exists (
      select 1
      from public.assistants a
      where a.id = assistant_actions.assistant_id
        and a.user_id::text = public.current_app_user_id()::text
    )
  )
  with check (
    exists (
      select 1
      from public.assistants a
      where a.id = assistant_actions.assistant_id
        and a.user_id::text = public.current_app_user_id()::text
    )
  );

-- Split the assistant policy by operation so a public read and owner access
-- do not create overlapping permissive SELECT policies.
drop policy if exists assistants_owner_access on public.assistants;
drop policy if exists assistants_public_read on public.assistants;

create policy assistants_select_access on public.assistants
  for select
  using (is_public = true or user_id::text = public.current_app_user_id()::text);

create policy assistants_insert_owner on public.assistants
  for insert
  with check (user_id::text = public.current_app_user_id()::text);

create policy assistants_update_owner on public.assistants
  for update
  using (user_id::text = public.current_app_user_id()::text)
  with check (user_id::text = public.current_app_user_id()::text);

create policy assistants_delete_owner on public.assistants
  for delete
  using (user_id::text = public.current_app_user_id()::text);

-- Supabase's Security Advisor requires a fixed search path for public
-- functions. This function has no arguments and relies only on pg_catalog.
alter function public.reject_published_package_version_mutation()
  set search_path = pg_catalog, public;
