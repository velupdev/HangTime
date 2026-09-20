-- Admin complimentary Plus for emails that have not signed in yet.
create table if not exists plus_grants (
  email text primary key,
  created_at timestamptz not null default now()
);
