DROP POLICY IF EXISTS "Operations roles can insert audit events" ON public.kiosk_admin_audit_events;
CREATE POLICY "Operations roles can insert audit events"
ON public.kiosk_admin_audit_events
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_support_operations(auth.uid())
  AND actor_user_id = auth.uid()
);

DROP POLICY IF EXISTS "Operations roles can view audit events" ON public.kiosk_admin_audit_events;
CREATE POLICY "Operations roles can view audit events"
ON public.kiosk_admin_audit_events
FOR SELECT
TO authenticated
USING (public.can_support_operations(auth.uid()));
