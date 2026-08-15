alter table assistant_install_intents
  add column if not exists download_token_hashes jsonb not null default '[]'::jsonb;

create index if not exists idx_assistant_install_intents_download_hashes
  on assistant_install_intents using gin(download_token_hashes);
