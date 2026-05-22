-- FanFrame: tryon-assets precisa aceitar videos curtos usados no totem.
-- O painel limita videos a 80 MB antes do upload.
UPDATE storage.buckets
SET file_size_limit = 83886080
WHERE id = 'tryon-assets';
