alter table public.teams
  add column if not exists kiosk_foreground_filter_enabled boolean not null default true,
  add column if not exists kiosk_max_foreground_people integer not null default 2,
  add column if not exists kiosk_foreground_min_area_ratio numeric not null default 0.08,
  add column if not exists kiosk_foreground_warning_text text;

alter table public.generation_queue
  add column if not exists foreground_filter_applied boolean,
  add column if not exists foreground_people_count integer;
