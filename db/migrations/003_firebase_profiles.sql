alter table users
  add column if not exists firebase_uid text unique,
  add column if not exists display_name text,
  add column if not exists photo_url text,
  add column if not exists provider text,
  add column if not exists last_login_at timestamptz;

create index if not exists idx_users_firebase_uid on users(firebase_uid);
