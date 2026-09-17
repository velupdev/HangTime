-- HangTime Plus: lifetime membership + coach roster
create table if not exists plus_members (
  user_id text primary key,
  unlocked_at timestamptz not null default now()
);

create table if not exists players (
  id serial primary key,
  user_id text not null,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists players_user_id_idx on players (user_id);

create table if not exists jumps (
  id serial primary key,
  user_id text not null,
  player_id integer not null references players (id) on delete cascade,
  height_in double precision not null,
  flight_s double precision not null,
  fps integer not null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists jumps_user_player_idx on jumps (user_id, player_id);
