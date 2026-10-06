-- Anonymous usage counts for the free measure page. No name or email.
create table if not exists site_events (
  id bigserial primary key,
  event text not null,
  visitor_id text,
  created_at timestamptz not null default now()
);

create index if not exists site_events_event_created_idx
  on site_events (event, created_at desc);
