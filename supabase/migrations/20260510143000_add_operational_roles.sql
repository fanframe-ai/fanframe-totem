DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype
      AND enumlabel = 'support'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'support';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype
      AND enumlabel = 'finance'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'finance';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY['super_admin', 'admin', 'support', 'finance'])
$$;

CREATE OR REPLACE FUNCTION public.can_support_operations(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY['super_admin', 'admin', 'support'])
$$;

CREATE OR REPLACE FUNCTION public.can_view_finance(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY['super_admin', 'admin', 'finance'])
$$;

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Operations roles can view kiosk devices" ON public.kiosk_devices;
CREATE POLICY "Operations roles can view kiosk devices"
ON public.kiosk_devices
FOR SELECT
TO authenticated
USING (public.can_access_admin(auth.uid()));

DROP POLICY IF EXISTS "Support roles can update kiosk devices" ON public.kiosk_devices;
CREATE POLICY "Support roles can update kiosk devices"
ON public.kiosk_devices
FOR UPDATE
TO authenticated
USING (public.can_support_operations(auth.uid()))
WITH CHECK (public.can_support_operations(auth.uid()));

DROP POLICY IF EXISTS "Operations roles can view kiosk sessions" ON public.kiosk_sessions;
CREATE POLICY "Operations roles can view kiosk sessions"
ON public.kiosk_sessions
FOR SELECT
TO authenticated
USING (public.can_access_admin(auth.uid()));

DROP POLICY IF EXISTS "Operations roles can view kiosk payments" ON public.kiosk_payments;
CREATE POLICY "Operations roles can view kiosk payments"
ON public.kiosk_payments
FOR SELECT
TO authenticated
USING (public.can_access_admin(auth.uid()));

DROP POLICY IF EXISTS "Support roles can view kiosk events" ON public.kiosk_device_events;
CREATE POLICY "Support roles can view kiosk events"
ON public.kiosk_device_events
FOR SELECT
TO authenticated
USING (public.can_support_operations(auth.uid()));

DROP POLICY IF EXISTS "Support roles can manage kiosk commands" ON public.kiosk_device_commands;
CREATE POLICY "Support roles can manage kiosk commands"
ON public.kiosk_device_commands
FOR ALL
TO authenticated
USING (public.can_support_operations(auth.uid()))
WITH CHECK (public.can_support_operations(auth.uid()));

DROP POLICY IF EXISTS "Support roles can view generation queue" ON public.generation_queue;
CREATE POLICY "Support roles can view generation queue"
ON public.generation_queue
FOR SELECT
TO authenticated
USING (public.can_support_operations(auth.uid()));

DROP POLICY IF EXISTS "Support roles can view generations" ON public.generations;
CREATE POLICY "Support roles can view generations"
ON public.generations
FOR SELECT
TO authenticated
USING (public.can_support_operations(auth.uid()));

DROP POLICY IF EXISTS "Support roles can view alerts" ON public.system_alerts;
CREATE POLICY "Support roles can view alerts"
ON public.system_alerts
FOR SELECT
TO authenticated
USING (public.can_support_operations(auth.uid()));
