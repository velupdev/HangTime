-- Shared rosters: teams, members, invites. Comp Plus does not count toward 100.

alter table plus_members
  add column if not exists source text not null default 'paid';

create table if not exists teams (
  id serial primary key,
  owner_user_id text not null,
  name text not null default 'Roster',
  created_at timestamptz not null default now()
);
create unique index if not exists teams_owner_user_id_idx on teams (owner_user_id);

create table if not exists team_members (
  team_id integer not null references teams (id) on delete cascade,
  user_id text not null,
  role text not null default 'coach',
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists team_members_user_id_idx on team_members (user_id);

create table if not exists team_invites (
  token text primary key,
  team_id integer not null references teams (id) on delete cascade,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists team_invites_team_id_idx on team_invites (team_id);

alter table players
  add column if not exists team_id integer references teams (id) on delete cascade;
create index if not exists players_team_id_idx on players (team_id);

insert into teams (owner_user_id, name)
select p.user_id, 'Roster'
from plus_members p
where not exists (
  select 1 from teams t where t.owner_user_id = p.user_id
);

insert into teams (owner_user_id, name)
select distinct pl.user_id, 'Roster'
from players pl
where not exists (
  select 1 from teams t where t.owner_user_id = pl.user_id
);

insert into team_members (team_id, user_id, role)
select t.id, t.owner_user_id, 'owner'
from teams t
on conflict do nothing;

update players p
set team_id = t.id
from teams t
where t.owner_user_id = p.user_id
  and p.team_id is null;
