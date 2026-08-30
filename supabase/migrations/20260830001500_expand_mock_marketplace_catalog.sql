insert into public.categories(name,slug,display_order,is_active) values
('Mobiles & Tablets','mobiles-tablets',1,true),('Electronics','electronics',2,true),('Fashion','fashion',3,true),('Home & Kitchen','home-kitchen',4,true),('Beauty','beauty',5,true),('Sports & Fitness','sports-fitness',6,true),('Groceries','groceries',7,true),('Appliances','appliances',8,true),('Laptops','laptops',9,true),('Kids & Toys','kids-toys',10,true),('Travel','travel',11,true),('Daily Essentials','daily-essentials',12,true)
on conflict (name) do update set display_order=excluded.display_order,is_active=true;

insert into public.merchants(name,slug,storefront_url,homepage_position,is_active) values
('Amazon','amazon','https://example.com/mock/amazon',1,true),('Flipkart','flipkart','https://example.com/mock/flipkart',2,true),('Myntra','myntra','https://example.com/mock/myntra',3,true),('Nykaa','nykaa','https://example.com/mock/nykaa',4,true),('AJIO','ajio','https://example.com/mock/ajio',5,true),('Meesho','meesho','https://example.com/mock/meesho',6,true),('Croma','croma','https://example.com/mock/croma',7,true),('Tata CLiQ','tata-cliq','https://example.com/mock/tata-cliq',8,true)
on conflict (slug) do update set name=excluded.name,storefront_url=excluded.storefront_url,homepage_position=excluded.homepage_position,is_active=true;

with product_seed(slug,title,brand,category_slug,image_url,description) as (values
('luma-x5-5g','Luma X5 5G Smartphone','Luma','mobiles-tablets','https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=700&q=80','A mock 5G smartphone listing used to test price comparison.'),
('orbit-buds-pro','Orbit Buds Pro','Orbit','electronics','https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=700&q=80','A mock wireless earbud product for the Glonni catalog.'),
('vertex-book-air','VertexBook Air 14','Vertex','laptops','https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=700&q=80','A lightweight mock laptop listing.'),
('stride-runner-2','Stride Runner 2','Stride','sports-fitness','https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80','Mock running shoes with multiple store offers.'),
('silk-glow-serum','Silk Glow Vitamin C Serum','Silk Glow','beauty','https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=700&q=80','Mock beauty product for reward-rule testing.'),
('nordic-cookware-set','Nordic Cookware Set','Nordic','home-kitchen','https://images.unsplash.com/photo-1584990347449-a68d11c0d2f3?auto=format&fit=crop&w=700&q=80','Mock non-stick cookware bundle.'),
('cotton-cloud-kurta','Cotton Cloud Kurta Set','Cotton Cloud','fashion','https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=700&q=80','Mock women’s fashion offer.'),
('urban-linen-shirt','Urban Linen Shirt','Urban Edit','fashion','https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=700&q=80','Mock men’s fashion offer.'),
('fresh-basket-combo','Fresh Basket Essentials Combo','Fresh Basket','groceries','https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=80','Mock grocery essentials bundle.'),
('breeze-air-fryer','Breeze Air Fryer 4L','Breeze','appliances','https://images.unsplash.com/photo-1585515656973-2b1cba3c47d2?auto=format&fit=crop&w=700&q=80','Mock kitchen appliance with a merchant promotion.'),
('pocket-tab-11','PocketTab 11','Pocket','mobiles-tablets','https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=700&q=80','Mock tablet listing for store comparison.'),
('build-play-kit','Build & Play Kit','Playwise','kids-toys','https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=700&q=80','Mock kids construction kit.'),
('weekend-travel-bag','Weekend Travel Bag','Trailmark','travel','https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80','Mock travel bag for multi-store comparison.'),
('pure-home-cleaning-kit','Pure Home Cleaning Kit','Pure Home','daily-essentials','https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=700&q=80','Mock daily essentials cleaning kit.'),
('pulse-watch-mini','Pulse Watch Mini','Pulse','electronics','https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80','Mock smartwatch product.'),
('luna-lip-set','Luna Lip Colour Set','Luna','beauty','https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=700&q=80','Mock beauty gift set.'))
insert into public.products(title,slug,brand,category_id,image_url,description,is_active)
select title,slug,brand,(select id from public.categories where slug=category_slug),image_url,description,true from product_seed
on conflict (slug) do update set title=excluded.title,brand=excluded.brand,category_id=excluded.category_id,image_url=excluded.image_url,description=excluded.description,is_active=true;

with offer_seed(product_slug,merchant_slug,price,list_price,reward_type,cashback_amount,cashback_percent,cashback_cap,coupon_code,reward_terms,funding) as (values
('luma-x5-5g','amazon',21999,24999,'none',null,null,null,null,null,'none'),('luma-x5-5g','flipkart',22499,24999,'fixed_cashback',350,null,null,null,'Tracked in 48 hours; confirmed after merchant validation.','provider'),
('orbit-buds-pro','amazon',1999,2999,'none',null,null,null,null,null,'none'),('orbit-buds-pro','croma',2099,2999,'percentage_cashback',null,5,150,null,'Eligible cashback is capped at ₹150.','merchant'),
('vertex-book-air','amazon',52990,59990,'none',null,null,null,null,null,'none'),('vertex-book-air','flipkart',53990,59990,'coupon',null,null,null,'VERTEX1000','Apply code at checkout on the merchant site.','none'),
('stride-runner-2','myntra',1499,2499,'percentage_cashback',null,8,180,null,'Cashback is available after a successful, eligible order.','provider'),('stride-runner-2','ajio',1399,2499,'none',null,null,null,null,null,'none'),
('silk-glow-serum','nykaa',599,799,'fixed_cashback',50,null,null,null,'Tracked in 48 hours; confirmed after merchant validation.','provider'),('silk-glow-serum','amazon',579,799,'none',null,null,null,null,null,'none'),
('nordic-cookware-set','amazon',1799,2399,'none',null,null,null,null,null,'none'),('nordic-cookware-set','flipkart',1899,2399,'fixed_cashback',120,null,null,null,'Eligible after a successful order.','provider'),
('cotton-cloud-kurta','myntra',1299,1999,'coupon',null,null,null,'STYLE150','Apply code at checkout on the merchant site.','none'),('cotton-cloud-kurta','meesho',1199,1999,'none',null,null,null,null,null,'none'),
('urban-linen-shirt','ajio',899,1499,'percentage_cashback',null,6,90,null,'Eligible cashback is capped at ₹90.','provider'),('urban-linen-shirt','myntra',949,1499,'merchant_promotion',null,null,null,null,'Merchant promotion available at checkout.','none'),
('fresh-basket-combo','meesho',699,899,'none',null,null,null,null,null,'none'),('fresh-basket-combo','amazon',749,899,'fixed_cashback',40,null,null,null,'Eligible after merchant validation.','provider'),
('breeze-air-fryer','croma',3499,4999,'merchant_promotion',null,null,null,null,'Merchant promotion available at checkout.','none'),('breeze-air-fryer','flipkart',3599,4999,'fixed_cashback',200,null,null,null,'Tracked in 48 hours; confirmed after merchant validation.','provider'),
('pocket-tab-11','amazon',15999,18999,'none',null,null,null,null,null,'none'),('pocket-tab-11','tata-cliq',16499,18999,'percentage_cashback',null,4,500,null,'Eligible cashback is capped at ₹500.','merchant'),
('build-play-kit','meesho',799,1199,'none',null,null,null,null,null,'none'),('weekend-travel-bag','ajio',1199,1799,'fixed_cashback',85,null,null,null,'Eligible after a successful order.','provider'),
('pure-home-cleaning-kit','amazon',499,699,'none',null,null,null,null,null,'none'),('pulse-watch-mini','flipkart',3299,4499,'fixed_cashback',175,null,null,null,'Tracked in 48 hours; confirmed after merchant validation.','provider'),
('luna-lip-set','nykaa',899,1199,'percentage_cashback',null,7,100,null,'Eligible cashback is capped at ₹100.','provider'))
insert into public.offers(product_id,merchant_id,destination_url,current_price,list_price,reward_type,cashback_amount,cashback_percent,cashback_cap,coupon_code,reward_terms,cashback_tracking_supported,reward_funding_source,status)
select p.id,m.id,'https://example.com/mock/'||o.merchant_slug||'/'||o.product_slug,o.price,o.list_price,o.reward_type,o.cashback_amount,o.cashback_percent,o.cashback_cap,o.coupon_code,o.reward_terms,o.reward_type in ('fixed_cashback','percentage_cashback'),o.funding,'active'
from offer_seed o join public.products p on p.slug=o.product_slug join public.merchants m on m.slug=o.merchant_slug
where not exists (select 1 from public.offers old where old.product_id=p.id and old.merchant_id=m.id and old.destination_url='https://example.com/mock/'||o.merchant_slug||'/'||o.product_slug);
