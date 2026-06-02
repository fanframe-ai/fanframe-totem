update public.teams
set
  kiosk_max_foreground_people = 2,
  draft_config = coalesce(draft_config, '{}'::jsonb) || jsonb_build_object('kiosk_max_foreground_people', 2),
  published_config = coalesce(published_config, '{}'::jsonb) || jsonb_build_object('kiosk_max_foreground_people', 2),
  published_config_version = coalesce(published_config_version, 1) + 1,
  published_at = now()
where coalesce(kiosk_max_foreground_people, 2) <> 2
  or case
    when jsonb_typeof(coalesce(draft_config, '{}'::jsonb)->'kiosk_max_foreground_people') = 'number'
      then (draft_config->>'kiosk_max_foreground_people')::integer <> 2
    else false
  end
  or case
    when jsonb_typeof(coalesce(published_config, '{}'::jsonb)->'kiosk_max_foreground_people') = 'number'
      then (published_config->>'kiosk_max_foreground_people')::integer <> 2
    else false
  end;
