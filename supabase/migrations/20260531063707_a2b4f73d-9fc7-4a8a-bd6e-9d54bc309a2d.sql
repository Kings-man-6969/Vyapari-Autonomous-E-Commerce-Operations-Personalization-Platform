
ALTER TABLE public.chat_threads
  ADD CONSTRAINT chat_threads_seller_fk FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE,
  ADD CONSTRAINT chat_threads_product_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_thread_fk FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id) ON DELETE CASCADE;

ALTER TABLE public.seller_payouts
  ADD CONSTRAINT seller_payouts_seller_fk FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;

ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_order_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
