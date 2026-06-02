do $$
declare
  immersive_header jsonb := jsonb_build_object(
    'headerLogo', '/flamengo/logo_imersivo.png',
    'headerLogoMode', 'horizontal'
  );
begin
  update public.teams
  set
    tutorial_assets = coalesce(tutorial_assets, '{}'::jsonb) || immersive_header,
    draft_config = coalesce(draft_config, '{}'::jsonb) || jsonb_build_object(
      'tutorial_assets',
      coalesce(draft_config->'tutorial_assets', '{}'::jsonb) || immersive_header
    ),
    published_config = coalesce(published_config, '{}'::jsonb) || jsonb_build_object(
      'tutorial_assets',
      coalesce(published_config->'tutorial_assets', '{}'::jsonb) || immersive_header
    ),
    published_config_version = coalesce(published_config_version, 1) + 1,
    published_at = now()
  where slug ilike '%flamengo%' or name ilike '%flamengo%';
end $$;
