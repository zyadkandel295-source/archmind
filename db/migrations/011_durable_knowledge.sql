do $$ begin
  alter type source_status add value if not exists 'uploading';
  alter type source_status add value if not exists 'failed';
exception when undefined_object then null; end $$;

alter table data_sources add column if not exists user_id uuid references users(id) on delete cascade;
alter table data_sources add column if not exists original_filename text;
alter table data_sources add column if not exists safe_filename text;
alter table data_sources add column if not exists mime_type text;
alter table data_sources add column if not exists size_bytes bigint;
alter table data_sources add column if not exists storage_path text;
alter table data_sources add column if not exists extracted_text_length bigint not null default 0;
alter table data_sources add column if not exists processing_error text;

create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references data_sources(id) on delete cascade,
  assistant_id uuid not null references assistants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  document_name text not null,
  page_number int not null default 1,
  chunk_index int not null,
  content text not null,
  token_count int not null default 0,
  created_at timestamptz not null default now(),
  unique(source_id, chunk_index)
);

create index if not exists idx_data_sources_assistant_user on data_sources(assistant_id, user_id);
create index if not exists idx_knowledge_chunks_assistant_user on knowledge_chunks(assistant_id, user_id, source_id);
create index if not exists idx_knowledge_chunks_search on knowledge_chunks using gin(to_tsvector('simple', content));
