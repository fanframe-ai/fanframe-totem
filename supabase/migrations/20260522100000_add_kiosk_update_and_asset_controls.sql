COMMENT ON TABLE storage.objects IS
'FanFrame: revisar limites de upload do bucket tryon-assets para imagens e videos do totem antes do go-live.';

-- Keep the tryon-assets bucket aligned with the admin 80 MB video upload limit.
UPDATE storage.buckets
SET file_size_limit = 83886080
WHERE id = 'tryon-assets';
