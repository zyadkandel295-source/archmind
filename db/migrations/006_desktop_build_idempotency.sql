alter table desktop_builds add column if not exists idempotency_key text;
create unique index if not exists idx_desktop_builds_owner_idempotency
  on desktop_builds(owner_id, idempotency_key)
  where idempotency_key is not null;
