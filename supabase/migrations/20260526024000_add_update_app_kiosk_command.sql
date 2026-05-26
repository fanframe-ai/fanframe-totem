ALTER TABLE public.kiosk_device_commands
  DROP CONSTRAINT IF EXISTS kiosk_device_commands_type_supported;

ALTER TABLE public.kiosk_device_commands
  ADD CONSTRAINT kiosk_device_commands_type_supported
  CHECK (command_type IN ('sync_config', 'enter_maintenance', 'exit_maintenance', 'send_diagnostics', 'restart_app', 'update_app'));
