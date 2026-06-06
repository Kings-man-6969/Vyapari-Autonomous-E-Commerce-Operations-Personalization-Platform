
-- Reviews: photo URLs
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Orders: coupon tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code text;

-- Coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  percent_off integer CHECK (percent_off IS NULL OR (percent_off BETWEEN 1 AND 90)),
  amount_off_cents integer CHECK (amount_off_cents IS NULL OR amount_off_cents > 0),
  min_subtotal_cents integer NOT NULL DEFAULT 0,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY coupons_public_read ON public.coupons FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY coupons_admin_all ON public.coupons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Product alerts (price drop / back in stock)
CREATE TABLE IF NOT EXISTS public.product_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('price_drop','back_in_stock')),
  threshold_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_alerts TO authenticated;
GRANT ALL ON public.product_alerts TO service_role;
ALTER TABLE public.product_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_alerts_own ON public.product_alerts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY product_alerts_admin_select ON public.product_alerts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for review photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "review_photos_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'review-photos');

CREATE POLICY "review_photos_user_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'review-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "review_photos_user_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'review-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Seed a few demo coupons
INSERT INTO public.coupons (code, description, percent_off, min_subtotal_cents) VALUES
  ('WELCOME10', '10% off your first order', 10, 0),
  ('SAVE25', '25% off orders over $100', 25, 10000)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.coupons (code, description, amount_off_cents, min_subtotal_cents) VALUES
  ('FLAT15', '$15 off orders over $75', 1500, 7500)
ON CONFLICT (code) DO NOTHING;
