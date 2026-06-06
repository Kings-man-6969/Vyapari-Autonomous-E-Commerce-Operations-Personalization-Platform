GRANT EXECUTE ON FUNCTION public.is_order_seller(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_order_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;