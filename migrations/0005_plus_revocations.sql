-- Remember complimentary Plus that an admin took back.
create table if not exists plus_revocations (
  user_id text primary key,
  email text,
  revoked_at timestamptz not null default now()
);

-- The gift for this account was already removed before the table existed.
insert into plus_revocations (user_id, email)
select u.id, lower(u.email)
from "user" u
where lower(u.email) = 'projectsounddesign@gmail.com'
  and not exists (select 1 from plus_members p where p.user_id = u.id)
on conflict (user_id) do nothing;
