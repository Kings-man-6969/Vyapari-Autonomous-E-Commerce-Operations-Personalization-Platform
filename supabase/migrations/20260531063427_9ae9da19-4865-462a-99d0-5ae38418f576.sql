
DROP POLICY IF EXISTS mq_insert_any ON public.moderation_queue;
REVOKE INSERT ON public.moderation_queue FROM authenticated;
