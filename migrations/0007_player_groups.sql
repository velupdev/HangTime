-- Optional group on a player: class period, sport, or any label the coach types.
alter table players
  add column if not exists group_name text;
