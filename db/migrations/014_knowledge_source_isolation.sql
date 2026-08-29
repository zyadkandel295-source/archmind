-- Backfill the durable owner scope for pre-existing sources before enforcing
-- it for all newly ingested knowledge files.
update data_sources ds
set user_id = a.user_id
from assistants a
where a.id = ds.assistant_id
  and ds.user_id is null;

create index if not exists idx_data_sources_user_assistant_ready
  on data_sources(user_id, assistant_id, status);

alter table knowledge_chunks enable row level security;

drop policy if exists knowledge_chunks_owner_access on knowledge_chunks;
create policy knowledge_chunks_owner_access on knowledge_chunks
  using (
    exists (
      select 1
      from assistants a
      where a.id = knowledge_chunks.assistant_id
        and a.user_id::text = current_app_user_id()::text
        and knowledge_chunks.user_id = a.user_id
    )
  )
  with check (
    exists (
      select 1
      from assistants a
      where a.id = knowledge_chunks.assistant_id
        and a.user_id::text = current_app_user_id()::text
        and knowledge_chunks.user_id = a.user_id
    )
  );
