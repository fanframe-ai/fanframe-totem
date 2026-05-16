ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS kiosk_font_family TEXT;

UPDATE public.teams
SET
  kiosk_font_family = COALESCE(kiosk_font_family, 'Inter, system-ui, sans-serif'),
  draft_config = COALESCE(draft_config, '{}'::jsonb) || jsonb_build_object(
    'kiosk_font_family',
    COALESCE(kiosk_font_family, 'Inter, system-ui, sans-serif')
  ),
  published_config = COALESCE(published_config, '{}'::jsonb) || jsonb_build_object(
    'kiosk_font_family',
    COALESCE(kiosk_font_family, 'Inter, system-ui, sans-serif')
  );
