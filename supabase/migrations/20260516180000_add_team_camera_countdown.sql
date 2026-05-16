ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS kiosk_camera_countdown_seconds INTEGER NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_kiosk_camera_countdown_range'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_kiosk_camera_countdown_range
      CHECK (kiosk_camera_countdown_seconds BETWEEN 0 AND 10);
  END IF;
END $$;

UPDATE public.teams
SET
  kiosk_camera_countdown_seconds = COALESCE(kiosk_camera_countdown_seconds, 5),
  draft_config = COALESCE(draft_config, '{}'::jsonb) || jsonb_build_object(
    'kiosk_camera_countdown_seconds',
    COALESCE(kiosk_camera_countdown_seconds, 5)
  ),
  published_config = COALESCE(published_config, '{}'::jsonb) || jsonb_build_object(
    'kiosk_camera_countdown_seconds',
    COALESCE(kiosk_camera_countdown_seconds, 5)
  )
WHERE NOT (COALESCE(published_config, '{}'::jsonb) ? 'kiosk_camera_countdown_seconds');
