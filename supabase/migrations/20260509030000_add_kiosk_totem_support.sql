-- FanFrame kiosk/totem support.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS kiosk_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kiosk_price_cents INTEGER NOT NULL DEFAULT 2500,
  ADD COLUMN IF NOT EXISTS kiosk_currency TEXT NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS kiosk_timeout_seconds INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS kiosk_default_mode TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS kiosk_show_shirt_step BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS kiosk_show_background_step BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.teams
  ADD CONSTRAINT teams_kiosk_price_non_negative CHECK (kiosk_price_cents >= 0),
  ADD CONSTRAINT teams_kiosk_timeout_range CHECK (kiosk_timeout_seconds BETWEEN 15 AND 180),
  ADD CONSTRAINT teams_kiosk_currency_supported CHECK (kiosk_currency IN ('BRL')),
  ADD CONSTRAINT teams_kiosk_default_mode_supported CHECK (kiosk_default_mode IN ('standard', 'event'));

CREATE TABLE IF NOT EXISTS public.kiosk_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  device_code TEXT NOT NULL UNIQUE,
  device_secret_hash TEXT,
  label TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  app_version TEXT,
  last_seen_at TIMESTAMPTZ,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kiosk_devices_status_supported CHECK (status IN ('active', 'maintenance', 'disabled'))
);

CREATE TABLE IF NOT EXISTS public.kiosk_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.kiosk_devices(id) ON DELETE SET NULL,
  payment_id UUID,
  generation_queue_id UUID REFERENCES public.generation_queue(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'started',
  selected_shirt_id TEXT,
  selected_background_id TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  delivery_token TEXT,
  delivery_expires_at TIMESTAMPTZ,
  result_image_url TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT kiosk_sessions_amount_non_negative CHECK (amount_cents >= 0),
  CONSTRAINT kiosk_sessions_status_supported CHECK (
    status IN ('started', 'awaiting_payment', 'paid', 'capturing', 'generating', 'completed', 'failed', 'expired', 'cancelled')
  )
);

CREATE TABLE IF NOT EXISTS public.kiosk_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.kiosk_sessions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.kiosk_devices(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  reference_id TEXT NOT NULL UNIQUE,
  pagbank_order_id TEXT,
  pagbank_charge_id TEXT,
  qr_code_text TEXT,
  qr_code_url TEXT,
  expires_at TIMESTAMPTZ,
  provider_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  CONSTRAINT kiosk_payments_amount_non_negative CHECK (amount_cents >= 0),
  CONSTRAINT kiosk_payments_provider_supported CHECK (provider IN ('pagbank_pix', 'plugpag_card', 'simulated')),
  CONSTRAINT kiosk_payments_method_supported CHECK (method IN ('pix', 'credit', 'debit', 'card')),
  CONSTRAINT kiosk_payments_status_supported CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired'))
);

ALTER TABLE public.kiosk_sessions
  ADD CONSTRAINT kiosk_sessions_payment_id_fkey FOREIGN KEY (payment_id)
  REFERENCES public.kiosk_payments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.kiosk_delivery_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.kiosk_sessions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  result_image_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generation_queue
  ADD COLUMN IF NOT EXISTS kiosk_session_id UUID REFERENCES public.kiosk_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.kiosk_payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web';

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS kiosk_session_id UUID REFERENCES public.kiosk_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.kiosk_payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web';

CREATE INDEX IF NOT EXISTS idx_kiosk_devices_team ON public.kiosk_devices(team_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_team ON public.kiosk_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_device ON public.kiosk_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_status ON public.kiosk_sessions(status);
CREATE INDEX IF NOT EXISTS idx_kiosk_payments_session ON public.kiosk_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_payments_reference ON public.kiosk_payments(reference_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_payments_status ON public.kiosk_payments(status);
CREATE INDEX IF NOT EXISTS idx_kiosk_delivery_links_token ON public.kiosk_delivery_links(token);
CREATE INDEX IF NOT EXISTS idx_generation_queue_kiosk_session ON public.generation_queue(kiosk_session_id);

ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_delivery_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage kiosk devices" ON public.kiosk_devices
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can view kiosk sessions" ON public.kiosk_sessions
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view kiosk payments" ON public.kiosk_payments
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view kiosk delivery links" ON public.kiosk_delivery_links
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE TRIGGER update_kiosk_devices_updated_at
  BEFORE UPDATE ON public.kiosk_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kiosk_sessions_updated_at
  BEFORE UPDATE ON public.kiosk_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kiosk_payments_updated_at
  BEFORE UPDATE ON public.kiosk_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
