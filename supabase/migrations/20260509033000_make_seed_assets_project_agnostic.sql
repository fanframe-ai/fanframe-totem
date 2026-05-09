-- Make older seeded team assets project-agnostic for new Supabase projects.
-- Admin-uploaded assets remain absolute Supabase Storage URLs.

UPDATE public.teams
SET
  shirts = replace(
    shirts::text,
    'https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets',
    '/assets'
  )::jsonb,
  backgrounds = replace(
    backgrounds::text,
    'https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets',
    '/assets'
  )::jsonb,
  tutorial_assets = replace(
    COALESCE(tutorial_assets, '{}'::jsonb)::text,
    'https://qmjvsftlounkitclmzzw.supabase.co/storage/v1/object/public/tryon-assets',
    '/assets'
  )::jsonb
WHERE
  shirts::text LIKE '%qmjvsftlounkitclmzzw.supabase.co%'
  OR backgrounds::text LIKE '%qmjvsftlounkitclmzzw.supabase.co%'
  OR COALESCE(tutorial_assets, '{}'::jsonb)::text LIKE '%qmjvsftlounkitclmzzw.supabase.co%';
