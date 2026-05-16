ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS draft_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_config_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE public.teams
SET
  published_config = jsonb_strip_nulls(jsonb_build_object(
    'name', name,
    'generation_prompt', generation_prompt,
    'shirts', shirts,
    'backgrounds', backgrounds,
    'tutorial_assets', tutorial_assets,
    'primary_color', primary_color,
    'secondary_color', secondary_color,
    'logo_url', logo_url,
    'watermark_url', watermark_url,
    'is_active', is_active,
    'text_overrides', text_overrides,
    'kiosk_enabled', kiosk_enabled,
    'kiosk_price_cents', kiosk_price_cents,
    'kiosk_currency', kiosk_currency,
    'kiosk_timeout_seconds', kiosk_timeout_seconds,
    'kiosk_default_mode', kiosk_default_mode,
    'kiosk_show_shirt_step', kiosk_show_shirt_step,
    'kiosk_show_background_step', kiosk_show_background_step
  )),
  draft_config = CASE
    WHEN draft_config = '{}'::jsonb THEN jsonb_strip_nulls(jsonb_build_object(
      'name', name,
      'generation_prompt', generation_prompt,
      'shirts', shirts,
      'backgrounds', backgrounds,
      'tutorial_assets', tutorial_assets,
      'primary_color', primary_color,
      'secondary_color', secondary_color,
      'logo_url', logo_url,
      'watermark_url', watermark_url,
      'is_active', is_active,
      'text_overrides', text_overrides,
      'kiosk_enabled', kiosk_enabled,
      'kiosk_price_cents', kiosk_price_cents,
      'kiosk_currency', kiosk_currency,
      'kiosk_timeout_seconds', kiosk_timeout_seconds,
      'kiosk_default_mode', kiosk_default_mode,
      'kiosk_show_shirt_step', kiosk_show_shirt_step,
      'kiosk_show_background_step', kiosk_show_background_step
    ))
    ELSE draft_config
  END,
  published_at = COALESCE(published_at, now())
WHERE published_config = '{}'::jsonb;

ALTER TABLE public.teams
  ADD CONSTRAINT teams_published_config_version_positive CHECK (published_config_version >= 1);
