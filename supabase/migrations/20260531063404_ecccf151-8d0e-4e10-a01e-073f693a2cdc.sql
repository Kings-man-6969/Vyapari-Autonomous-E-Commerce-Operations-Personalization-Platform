
-- DISPUTES
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  refund_cents INTEGER NOT NULL DEFAULT 0,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY disputes_own ON public.disputes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY disputes_admin_all ON public.disputes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY disputes_seller_select ON public.disputes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_items oi JOIN public.sellers s ON s.id = oi.seller_id
    WHERE oi.order_id = disputes.order_id AND s.user_id = auth.uid()
  ));

-- PAYOUTS LEDGER
CREATE TABLE public.seller_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  amount_cents INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'payout',
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_payouts TO authenticated;
GRANT ALL ON public.seller_payouts TO service_role;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY payouts_admin_all ON public.seller_payouts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY payouts_seller_select ON public.seller_payouts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_payouts.seller_id AND s.user_id = auth.uid()));

-- MODERATION QUEUE
CREATE TABLE public.moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  reason TEXT,
  ai_score NUMERIC,
  ai_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.moderation_queue TO authenticated;
GRANT ALL ON public.moderation_queue TO service_role;
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY mq_admin_all ON public.moderation_queue FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY mq_insert_any ON public.moderation_queue FOR INSERT TO authenticated WITH CHECK (true);

-- REFERRALS
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_user_id UUID,
  code TEXT NOT NULL UNIQUE,
  reward_cents INTEGER NOT NULL DEFAULT 500,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT SELECT ON public.referrals TO anon;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY referrals_public_code ON public.referrals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY referrals_insert_own ON public.referrals FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_id);

-- BLOG POSTS
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  author_id UUID,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY blog_public_read ON public.blog_posts FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY blog_admin_all ON public.blog_posts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- CHAT
CREATE TABLE public.chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  product_id UUID,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, seller_id, product_id)
);
GRANT SELECT, INSERT, UPDATE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_threads_participants ON public.chat_threads FOR ALL TO authenticated
  USING (auth.uid() = buyer_id OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = chat_threads.seller_id AND s.user_id = auth.uid()))
  WITH CHECK (auth.uid() = buyer_id OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = chat_threads.seller_id AND s.user_id = auth.uid()));

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_participants ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_threads t WHERE t.id = chat_messages.thread_id
      AND (t.buyer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = t.seller_id AND s.user_id = auth.uid()))
  ));
CREATE POLICY chat_messages_send ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.chat_threads t WHERE t.id = chat_messages.thread_id
      AND (t.buyer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = t.seller_id AND s.user_id = auth.uid()))
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;

-- CURRENCY RATES (USD base)
CREATE TABLE public.currency_rates (
  code TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.currency_rates TO anon, authenticated;
GRANT ALL ON public.currency_rates TO service_role;
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY rates_public_read ON public.currency_rates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY rates_admin_write ON public.currency_rates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.currency_rates(code, symbol, rate, name) VALUES
  ('USD','$',1,'US Dollar'),
  ('EUR','€',0.92,'Euro'),
  ('GBP','£',0.79,'British Pound'),
  ('INR','₹',83.2,'Indian Rupee'),
  ('JPY','¥',155.0,'Japanese Yen'),
  ('AUD','A$',1.51,'Australian Dollar'),
  ('CAD','C$',1.36,'Canadian Dollar')
ON CONFLICT (code) DO NOTHING;
