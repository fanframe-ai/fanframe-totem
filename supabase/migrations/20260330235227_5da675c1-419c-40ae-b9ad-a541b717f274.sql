-- Legacy seed for the original project owner.
-- New Supabase projects do not have this auth user, so keep the migration
-- portable and let create-first-admin create the first real administrator.
INSERT INTO public.user_roles (user_id, role)
SELECT '53ee3e7f-21bb-4fc6-9294-a6a116f6d819', 'super_admin'
WHERE EXISTS (
  SELECT 1
  FROM auth.users
  WHERE id = '53ee3e7f-21bb-4fc6-9294-a6a116f6d819'
);
