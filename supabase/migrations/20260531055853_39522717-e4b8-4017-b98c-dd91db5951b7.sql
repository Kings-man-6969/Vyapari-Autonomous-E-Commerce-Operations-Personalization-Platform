-- 1) Add seller SELECT policy on orders (sellers can see orders that contain their items)
CREATE POLICY "orders_select_seller"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.sellers s ON s.id = oi.seller_id
    WHERE oi.order_id = orders.id AND s.user_id = auth.uid()
  )
);

-- 2/3) Lock down SECURITY DEFINER functions so signed-in users cannot call them directly via RPC.
-- has_role is only referenced inside RLS policies (executed by the policy engine), and
-- handle_new_user is only invoked from an auth trigger — neither needs EXECUTE for end users.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;