-- Application identity stays stable across rebuilds. Migration 006 remains the
-- owner-scoped, request-idempotency guard; build history may contain versions
-- for the same assistant identity and protocol.
alter table desktop_builds drop constraint if exists desktop_builds_owner_id_app_id_key;
alter table desktop_builds drop constraint if exists desktop_builds_owner_id_protocol_key;
create index if not exists idx_desktop_builds_owner_app_id_created
  on desktop_builds(owner_id, app_id, created_at desc);
create index if not exists idx_desktop_builds_owner_protocol_created
  on desktop_builds(owner_id, protocol, created_at desc);
