-- Restore the exact pre-cleanup status/active values from the backup.
-- No catalog, backup, or customer rows are deleted.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.cleanup_backup_20261009
    WHERE table_name IN ('offers', 'products', 'merchants', 'homepage_campaigns')
  ) THEN
    RAISE EXCEPTION 'cleanup_backup_20261009 is missing or empty; rollback stopped.';
  END IF;
END $$;

UPDATE public.offers o
SET status = (b.row_data->>'status')
FROM public.cleanup_backup_20261009 b
WHERE b.table_name = 'offers' AND b.row_id = o.id;

UPDATE public.products p
SET is_active = (b.row_data->>'is_active')::boolean
FROM public.cleanup_backup_20261009 b
WHERE b.table_name = 'products' AND b.row_id = p.id;

UPDATE public.merchants m
SET is_active = (b.row_data->>'is_active')::boolean
FROM public.cleanup_backup_20261009 b
WHERE b.table_name = 'merchants' AND b.row_id = m.id;

UPDATE public.homepage_campaigns hc
SET status = (b.row_data->>'status')
FROM public.cleanup_backup_20261009 b
WHERE b.table_name = 'homepage_campaigns' AND b.row_id = hc.id;

COMMIT;
