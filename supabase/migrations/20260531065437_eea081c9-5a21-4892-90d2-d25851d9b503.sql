-- Break recursion between orders and order_items policies using SECURITY DEFINER helpers

CREATE OR REPLACE FUNCTION public.is_order_owner(_order_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_order_seller(_order_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.sellers s ON s.id = oi.seller_id
    WHERE oi.order_id = _order_id AND s.user_id = _user_id
  )
$$;

-- orders policies
DROP POLICY IF EXISTS orders_select_seller ON public.orders;
CREATE POLICY orders_select_seller ON public.orders FOR SELECT TO authenticated
USING (public.is_order_seller(id, auth.uid()));

-- order_items policies
DROP POLICY IF EXISTS order_items_select_own ON public.order_items;
CREATE POLICY order_items_select_own ON public.order_items FOR SELECT TO authenticated
USING (public.is_order_owner(order_id, auth.uid()));

DROP POLICY IF EXISTS order_items_insert_own ON public.order_items;
CREATE POLICY order_items_insert_own ON public.order_items FOR INSERT TO authenticated
WITH CHECK (public.is_order_owner(order_id, auth.uid()));

-- disputes seller select also joins order_items -> safe via function
DROP POLICY IF EXISTS disputes_seller_select ON public.disputes;
CREATE POLICY disputes_seller_select ON public.disputes FOR SELECT TO authenticated
USING (public.is_order_seller(order_id, auth.uid()));
