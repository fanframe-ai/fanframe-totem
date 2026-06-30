create table if not exists public.kiosk_test_links (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.kiosk_devices(id) on delete cascade,
  token_hash text not null unique,
  enabled boolean not null default true,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

create unique index if not exists kiosk_test_links_one_active_per_device
  on public.kiosk_test_links(device_id)
  where enabled = true;

create index if not exists kiosk_test_links_device_created
  on public.kiosk_test_links(device_id, created_at desc);

alter table public.kiosk_test_links enable row level security;

drop policy if exists "Business admins manage kiosk test links" on public.kiosk_test_links;
create policy "Business admins manage kiosk test links"
  on public.kiosk_test_links
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
