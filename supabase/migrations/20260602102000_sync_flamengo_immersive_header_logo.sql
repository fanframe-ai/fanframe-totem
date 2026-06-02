with flamengo_devices as (
  select kd.id
  from public.kiosk_devices kd
  join public.teams t on t.id = kd.team_id
  where t.slug ilike '%flamengo%' or t.name ilike '%flamengo%'
),
updated_devices as (
  update public.kiosk_devices kd
  set
    config_version = coalesce(kd.config_version, 0) + 1,
    updated_at = now()
  from flamengo_devices fd
  where kd.id = fd.id
  returning kd.id
)
insert into public.kiosk_device_commands (device_id, command_type, payload, expires_at)
select
  id,
  'sync_config',
  jsonb_build_object('reason', 'flamengo_immersive_header_logo'),
  now() + interval '10 minutes'
from updated_devices;
