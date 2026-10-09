-- Deactivate seeded/example.com catalog rows without deleting data.
-- Customer-linked records are checked before any backup or update.
-- The application is intentionally separate; this file is not being run here.

BEGIN;

CREATE TEMP TABLE _cleanup_targets (
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  PRIMARY KEY (table_name, row_id)
) ON COMMIT DROP;

INSERT INTO _cleanup_targets (table_name, row_id)
SELECT 'merchants', m.id
FROM public.merchants m
WHERE m.id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '14443cda-0e5f-405b-9629-8c9e3f95fa2d',
  '2437b9fa-2a2c-4f79-8cec-4ef97a44acb8',
  '2a4ae439-ca99-4c29-828d-1d280ecfa604',
  '46bd3c91-4a66-4f82-b606-d8f311da8848',
  '6c7680b7-e448-4a35-a817-8e7eb93e3b9a',
  '70361b30-d32f-4ecf-b47a-99ce00dd781f',
  '8c7c5b21-7006-4311-a0bc-0c71d56ece72',
  'dce78b3c-a922-4317-8f16-b5acbb21c71d'
)
OR m.storefront_url ILIKE '%example.com%'
ON CONFLICT DO NOTHING;

INSERT INTO _cleanup_targets (table_name, row_id)
SELECT 'products', p.id
FROM public.products p
WHERE p.id IN (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '0186a9af-ca0d-4b9d-9c94-99612ba1d935',
  '06546416-a5a9-4b42-9b00-4e42d66b0ae6',
  '2f540909-5d9f-4c83-b2ba-c6c2a782ccda',
  '32394f62-83e2-45c5-ac23-e6c90c9411d6',
  '35219328-e698-49ec-bd60-d17174115eb2',
  '3804a6ca-d2f0-4f71-a86b-667156045126',
  '3f0cf79f-527f-4d02-9fb7-a919420c2ed1',
  '58643c89-213e-452b-a2c7-48bdb0f7e676',
  '62614d6e-f41a-430c-82df-73469c53c045',
  '652e863f-2727-4a19-b4bb-0d7c22f1c269',
  '7c9028a7-287e-4497-a8d8-d5beaf2da427',
  '8a2ebe88-5eaf-4d3a-9f62-40dd0980edde',
  '9f3de594-b8a4-492d-bbcb-49419bd0d50a',
  'ac7ec048-3d91-4818-b325-a0d2d749c4bf',
  'dc0fef1f-722a-41ac-bc6c-56ae0d3aab97',
  'e7d697e1-8629-4d4b-ac1a-3fc701ef5650'
)
ON CONFLICT DO NOTHING;

INSERT INTO _cleanup_targets (table_name, row_id)
SELECT 'offers', o.id
FROM public.offers o
WHERE o.id IN (
  '90000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000002',
  '90000000-0000-0000-0000-000000000003',
  '90000000-0000-0000-0000-000000000004'
)
OR o.destination_url ILIKE '%example.com%'
ON CONFLICT DO NOTHING;

INSERT INTO _cleanup_targets (table_name, row_id)
SELECT 'homepage_campaigns', hc.id
FROM public.homepage_campaigns hc
WHERE hc.offer_id IN (
  SELECT row_id FROM _cleanup_targets WHERE table_name = 'offers'
)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  merchant_count integer;
  product_count integer;
  offer_count integer;
  campaign_count integer;
  linked_redirect_customers integer;
  linked_referral_conversions integer;
  linked_cashback_claims integer;
  linked_cashback_awards integer;
  linked_wallet_entries integer;
  linked_saved_offers integer;
  linked_price_alerts integer;
BEGIN
  SELECT count(*) INTO merchant_count FROM _cleanup_targets WHERE table_name = 'merchants';
  SELECT count(*) INTO product_count FROM _cleanup_targets WHERE table_name = 'products';
  SELECT count(*) INTO offer_count FROM _cleanup_targets WHERE table_name = 'offers';
  SELECT count(*) INTO campaign_count FROM _cleanup_targets WHERE table_name = 'homepage_campaigns';

  IF merchant_count <> 12 OR product_count <> 20 OR offer_count <> 31 OR campaign_count <> 1 THEN
    RAISE EXCEPTION 'Seed cleanup target drift: merchants %, products %, offers %, campaigns %; expected 12, 20, 31, 1. No rows were deactivated.',
      merchant_count, product_count, offer_count, campaign_count;
  END IF;

  SELECT count(*) INTO linked_redirect_customers
  FROM public.redirect_events re
  JOIN _cleanup_targets t ON t.table_name = 'offers' AND t.row_id = re.offer_id
  JOIN public.profiles p ON p.id = re.profile_id
  WHERE p.role = 'customer';

  SELECT count(*) INTO linked_referral_conversions
  FROM public.referral_conversions rc
  WHERE rc.offer_id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'offers')
     OR rc.redirect_event_id IN (
       SELECT re.id FROM public.redirect_events re
       JOIN _cleanup_targets t ON t.table_name = 'offers' AND t.row_id = re.offer_id
     );

  SELECT count(*) INTO linked_cashback_claims
  FROM public.cashback_claims cc
  WHERE cc.offer_id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'offers')
     OR cc.conversion_id IN (
       SELECT rc.id FROM public.referral_conversions rc
       WHERE rc.offer_id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'offers')
          OR rc.redirect_event_id IN (
            SELECT re.id FROM public.redirect_events re
            JOIN _cleanup_targets t ON t.table_name = 'offers' AND t.row_id = re.offer_id
          )
     );

  SELECT count(*) INTO linked_cashback_awards
  FROM public.cashback_awards ca
  WHERE ca.conversion_id IN (
    SELECT rc.id FROM public.referral_conversions rc
    WHERE rc.offer_id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'offers')
       OR rc.redirect_event_id IN (
         SELECT re.id FROM public.redirect_events re
         JOIN _cleanup_targets t ON t.table_name = 'offers' AND t.row_id = re.offer_id
       )
  );

  SELECT count(*) INTO linked_wallet_entries
  FROM public.wallet_entries we
  WHERE we.claim_id IN (SELECT cc.id FROM public.cashback_claims cc
                        WHERE cc.offer_id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'offers')
                           OR cc.conversion_id IN (SELECT rc.id FROM public.referral_conversions rc
                              WHERE rc.offer_id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'offers')))
     OR we.award_id IN (SELECT ca.id FROM public.cashback_awards ca
                        WHERE ca.conversion_id IN (SELECT rc.id FROM public.referral_conversions rc
                           WHERE rc.offer_id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'offers')));

  SELECT count(*) INTO linked_saved_offers
  FROM public.saved_offers so
  WHERE so.offer_id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'offers');

  SELECT count(*) INTO linked_price_alerts
  FROM public.price_alerts pa
  WHERE pa.offer_id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'offers');

  -- commerce_finance_orders has no offer_id, product_id, or merchant_id.
  -- Its catalog_item_id references voucher_catalog_items, a separate voucher catalog.

  IF linked_redirect_customers + linked_referral_conversions + linked_cashback_claims +
     linked_cashback_awards + linked_wallet_entries + linked_saved_offers +
     linked_price_alerts > 0 THEN
    RAISE EXCEPTION 'Cleanup stopped: linked customer records exist. redirect_events(customer) %, referral_conversions %, cashback_claims %, cashback_awards %, wallet_entries %, saved_offers %, price_alerts %. No rows were deactivated.',
      linked_redirect_customers, linked_referral_conversions, linked_cashback_claims,
      linked_cashback_awards, linked_wallet_entries, linked_saved_offers, linked_price_alerts;
  END IF;
END $$;

CREATE TABLE public.cleanup_backup_20261009 (
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  row_data jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, row_id)
);

ALTER TABLE public.cleanup_backup_20261009 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cleanup_backup_20261009 FROM anon, authenticated;

INSERT INTO public.cleanup_backup_20261009 (table_name, row_id, row_data)
SELECT 'merchants', m.id, to_jsonb(m)
FROM public.merchants m
JOIN _cleanup_targets t ON t.table_name = 'merchants' AND t.row_id = m.id;

INSERT INTO public.cleanup_backup_20261009 (table_name, row_id, row_data)
SELECT 'products', p.id, to_jsonb(p)
FROM public.products p
JOIN _cleanup_targets t ON t.table_name = 'products' AND t.row_id = p.id;

INSERT INTO public.cleanup_backup_20261009 (table_name, row_id, row_data)
SELECT 'offers', o.id, to_jsonb(o)
FROM public.offers o
JOIN _cleanup_targets t ON t.table_name = 'offers' AND t.row_id = o.id;

INSERT INTO public.cleanup_backup_20261009 (table_name, row_id, row_data)
SELECT 'homepage_campaigns', hc.id, to_jsonb(hc)
FROM public.homepage_campaigns hc
JOIN _cleanup_targets t ON t.table_name = 'homepage_campaigns' AND t.row_id = hc.id;

DO $$
DECLARE backup_count integer;
BEGIN
  SELECT count(*) INTO backup_count FROM public.cleanup_backup_20261009;
  IF backup_count <> 64 THEN
    RAISE EXCEPTION 'Expected 64 backup rows (12 merchants + 20 products + 31 offers + 1 campaign), found %. No rows were deactivated.', backup_count;
  END IF;
END $$;

UPDATE public.offers o
SET status = 'inactive'
WHERE o.id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'offers');

UPDATE public.products p
SET is_active = false
WHERE p.id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'products');

UPDATE public.merchants m
SET is_active = false
WHERE m.id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'merchants');

UPDATE public.homepage_campaigns hc
SET status = 'paused'
WHERE hc.id IN (SELECT row_id FROM _cleanup_targets WHERE table_name = 'homepage_campaigns');

COMMIT;
