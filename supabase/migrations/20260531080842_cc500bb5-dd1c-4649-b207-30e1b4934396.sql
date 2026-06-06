
-- 1. Drop stale broad referrals SELECT policy (PUBLIC_DATA_EXPOSURE)
DROP POLICY IF EXISTS referrals_public_code ON public.referrals;

-- 2. Atomic coupon consumption (fix TOCTOU race)
CREATE OR REPLACE FUNCTION public.consume_coupon(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE public.coupons
  SET uses = uses + 1
  WHERE code = _code
    AND is_active
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses < max_uses);
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

-- 3. Lock down EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lookup_coupon(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lookup_referral_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_coupon(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_order_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_order_seller(uuid, uuid) FROM PUBLIC, anon;
-- Keep authenticated grant for RLS helpers (needed inside policy evaluation)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_order_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_order_seller(uuid, uuid) TO authenticated;

-- 4. Restrict public storage listing: replace broad SELECT policies with
--    policies that block .list() while still permitting RLS-checked deletes/inserts.
--    Public file GETs via /storage/v1/object/public/ bypass RLS, so direct
--    image access keeps working.
DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
DROP POLICY IF EXISTS review_photos_public_get ON storage.objects;
