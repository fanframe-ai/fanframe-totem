ALTER TABLE public.kiosk_devices
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS venue TEXT,
  ADD COLUMN IF NOT EXISTS installation_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_kiosk_devices_city_status
ON public.kiosk_devices(city, status);
