ALTER TABLE public.kiosk_devices
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone TEXT,
  ADD COLUMN IF NOT EXISTS install_status TEXT NOT NULL DEFAULT 'not_paired',
  ADD COLUMN IF NOT EXISTS paired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS config_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expected_app_version TEXT,
  ADD COLUMN IF NOT EXISTS update_channel TEXT NOT NULL DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS support_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_health_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_health_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_error_code TEXT,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT,
  ADD COLUMN IF NOT EXISTS maintenance_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kiosk_devices_install_status_supported'
  ) THEN
    ALTER TABLE public.kiosk_devices
      ADD CONSTRAINT kiosk_devices_install_status_supported
      CHECK (install_status IN ('not_paired', 'paired', 'revoked'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kiosk_devices_update_channel_supported'
  ) THEN
    ALTER TABLE public.kiosk_devices
      ADD CONSTRAINT kiosk_devices_update_channel_supported
      CHECK (update_channel IN ('stable', 'beta', 'maintenance'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.kiosk_install_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.kiosk_devices(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  redeemed_by_fingerprint TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kiosk_install_codes_expiry_future CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS public.kiosk_device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.kiosk_devices(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.kiosk_sessions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  error_code TEXT,
  message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kiosk_device_events_severity_supported
    CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical'))
);

CREATE TABLE IF NOT EXISTS public.kiosk_device_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.kiosk_devices(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '10 minutes',
  CONSTRAINT kiosk_device_commands_type_supported
    CHECK (command_type IN ('sync_config', 'enter_maintenance', 'exit_maintenance', 'send_diagnostics', 'restart_app')),
  CONSTRAINT kiosk_device_commands_status_supported
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'expired'))
);

CREATE TABLE IF NOT EXISTS public.kiosk_admin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kiosk_install_codes_device ON public.kiosk_install_codes(device_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_install_codes_expires ON public.kiosk_install_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_kiosk_device_events_device_created ON public.kiosk_device_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kiosk_device_events_type ON public.kiosk_device_events(event_type);
CREATE INDEX IF NOT EXISTS idx_kiosk_device_commands_device_status ON public.kiosk_device_commands(device_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kiosk_devices_health ON public.kiosk_devices(last_health_at DESC);

ALTER TABLE public.kiosk_install_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_device_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_admin_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage kiosk install codes" ON public.kiosk_install_codes;
CREATE POLICY "Admins can manage kiosk install codes" ON public.kiosk_install_codes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view kiosk events" ON public.kiosk_device_events;
CREATE POLICY "Admins can view kiosk events" ON public.kiosk_device_events
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage kiosk commands" ON public.kiosk_device_commands;
CREATE POLICY "Admins can manage kiosk commands" ON public.kiosk_device_commands
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view audit events" ON public.kiosk_admin_audit_events;
CREATE POLICY "Admins can view audit events" ON public.kiosk_admin_audit_events
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
