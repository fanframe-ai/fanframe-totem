ALTER TABLE public.kiosk_payments
  ADD COLUMN IF NOT EXISTS customer_tax_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_tax_id_last4 TEXT;

CREATE INDEX IF NOT EXISTS idx_kiosk_payments_customer_tax_id_last4
  ON public.kiosk_payments(customer_tax_id_last4);
