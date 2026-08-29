-- Remove obsolete desktop-delivery tables from existing deployments.
-- This migration is intentionally limited to tables owned exclusively by that
-- feature. Run through the normal reviewed migration workflow; it does not
-- touch assistants, conversations, sources, Redis, or shared storage data.

drop table if exists device_assistants;
drop table if exists assistant_install_intents;
drop table if exists assistant_snapshots;
drop table if exists desktop_runtime_releases;
drop table if exists installer_downloads;
drop table if exists desktop_builds;
drop table if exists device_sessions;
drop table if exists bootstrap_tokens;
drop table if exists package_licenses;
drop table if exists entitlements;
drop table if exists package_versions;
drop table if exists assistant_packages;
