
-- 1) Hide admin_notes from dispute owners via column-level revoke.
-- service_role (admin server fns) bypasses this and still reads the column.
REVOKE SELECT ON public.disputes FROM authenticated;
GRANT SELECT (id, order_id, user_id, reason, details, status, refund_cents, resolution, created_at, updated_at) ON public.disputes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.disputes TO authenticated;

-- 2) Realtime topic authorization for chat threads.
-- Topics are named "thread-<uuid>" by the client; restrict subscription to participants.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_thread_topic_authz" ON realtime.messages;
CREATE POLICY "chat_thread_topic_authz"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'thread-%' THEN EXISTS (
      SELECT 1
      FROM public.chat_threads t
      WHERE t.id = NULLIF(substring(realtime.topic() from 8), '')::uuid
        AND (
          t.buyer_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.sellers s
            WHERE s.id = t.seller_id AND s.user_id = (SELECT auth.uid())
          )
        )
    )
    ELSE true
  END
);
