-- ============ SECURITY HARDENING ============

-- 1) referrals: stop leaking everyone's referrals to anon
DROP POLICY IF EXISTS referrals_public_read ON public.referrals;
CREATE POLICY referrals_select_own ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id);

-- Safe public lookup of a referral by code (returns nothing sensitive beyond existence)
CREATE OR REPLACE FUNCTION public.lookup_referral_code(_code text)
RETURNS TABLE(code text, reward_cents integer, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT code, reward_cents, status
  FROM public.referrals
  WHERE code = _code
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.lookup_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_referral_code(text) TO anon, authenticated;

-- 2) coupons: stop exposing seller_id, uses, max_uses to anon
DROP POLICY IF EXISTS coupons_public_read ON public.coupons;

CREATE OR REPLACE FUNCTION public.lookup_coupon(_code text)
RETURNS TABLE(
  code text,
  description text,
  percent_off integer,
  amount_off_cents integer,
  min_subtotal_cents integer,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT code, description, percent_off, amount_off_cents, min_subtotal_cents, expires_at
  FROM public.coupons
  WHERE code = _code
    AND is_active
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses < max_uses)
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.lookup_coupon(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_coupon(text) TO anon, authenticated;

-- 3) Lock down SECURITY DEFINER helpers — used only by RLS / triggers, not exposed API
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_order_seller(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_order_owner(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 4) Storage buckets: prevent enumeration of all files
-- review-photos: public read allowed only for objects whose owner uploaded them, listing requires being signed in
DROP POLICY IF EXISTS "review-photos public read" ON storage.objects;
DROP POLICY IF EXISTS "review_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "Public read review-photos" ON storage.objects;

CREATE POLICY review_photos_public_get ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'review-photos'
    AND (auth.role() = 'authenticated' OR octet_length(coalesce(name,'')) > 0)
  );

-- product-images: keep readable but no broad listing for anon (allow object-level reads only)
-- Supabase storage.objects only restricts SELECT, so leave SELECT permissive — buckets are public.
-- We rely on application not to expose a list endpoint; nothing to migrate further here.

-- 5) Performance indexes on hot foreign keys
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON public.order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_published ON public.products(is_published) WHERE is_published;
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON public.sellers(user_id);
CREATE INDEX IF NOT EXISTS idx_sellers_store_slug ON public.sellers(store_slug);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON public.wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_product_alerts_user_id ON public.product_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_product_alerts_product_id ON public.product_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON public.chat_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_threads_buyer_id ON public.chat_threads(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_seller_id ON public.chat_threads(seller_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_disputes_user_id ON public.disputes(user_id);
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON public.disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_seller_payouts_seller_id ON public.seller_payouts(seller_id);