-- Agentia App Export foundation. This extends the existing package/version and
-- desktop_builds model without deleting or rewriting production data.

alter table desktop_builds add column if not exists manifest_checksum text;
alter table desktop_builds add column if not exists source_package_version integer;
alter table desktop_builds add column if not exists correlation_id uuid;
alter table desktop_builds add column if not exists current_stage text check (current_stage in ('validate','prepare','package','upload','finalize'));
alter table desktop_builds add column if not exists progress integer not null default 0 check (progress between 0 and 100);

create index if not exists idx_desktop_builds_manifest_checksum
  on desktop_builds(owner_id, manifest_checksum, created_at desc)
  where manifest_checksum is not null;
create index if not exists idx_desktop_builds_active_stage
  on desktop_builds(status, current_stage, updated_at)
  where status in ('validating','queued','building','packaging','validating_artifact');

-- assistant_packages/package_versions are the normalized immutable application
-- definition store. Lock published versions against in-place mutation.
create or replace function reject_published_package_version_mutation() returns trigger language plpgsql as $$
begin
  if old.status = 'published' and (new.manifest is distinct from old.manifest or new.checksum is distinct from old.checksum or new.version is distinct from old.version) then
    raise exception 'published package versions are immutable';
  end if;
  return new;
end $$;
drop trigger if exists package_versions_immutable on package_versions;
create trigger package_versions_immutable before update on package_versions
  for each row execute function reject_published_package_version_mutation();

-- Tables were RLS-enabled in migration 005. This policy makes the ownership
-- condition explicit for package-version reads performed through Supabase.
alter table package_versions enable row level security;
drop policy if exists package_versions_owner_access on package_versions;
create policy package_versions_owner_access on package_versions
  using (exists (select 1 from assistant_packages p where p.id = package_id and p.owner_id = current_app_user_id()))
  with check (exists (select 1 from assistant_packages p where p.id = package_id and p.owner_id = current_app_user_id()));
