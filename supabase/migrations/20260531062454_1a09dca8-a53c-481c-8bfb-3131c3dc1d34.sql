-- 1. Coupons: allow seller-scoped coupons
alter table public.coupons add column if not exists seller_id uuid;
create index if not exists coupons_seller_id_idx on public.coupons(seller_id);

drop policy if exists coupons_seller_manage on public.coupons;
create policy coupons_seller_manage on public.coupons
  for all to authenticated
  using (
    seller_id is not null and exists (
      select 1 from public.sellers s where s.id = coupons.seller_id and s.user_id = auth.uid()
    )
  )
  with check (
    seller_id is not null and exists (
      select 1 from public.sellers s where s.id = coupons.seller_id and s.user_id = auth.uid()
    )
  );

-- 2. Shipping tracking on order_items
alter table public.order_items add column if not exists tracking_carrier text;
alter table public.order_items add column if not exists tracking_number text;
alter table public.order_items add column if not exists shipped_at timestamptz;

drop policy if exists order_items_update_seller on public.order_items;
create policy order_items_update_seller on public.order_items
  for update to authenticated
  using (exists (
    select 1 from public.sellers s where s.id = order_items.seller_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.sellers s where s.id = order_items.seller_id and s.user_id = auth.uid()
  ));

-- 3. AI/uploaded product images bucket
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "product_images_seller_write" on storage.objects;
create policy "product_images_seller_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (select 1 from public.sellers s where s.user_id = auth.uid())
  );

drop policy if exists "product_images_owner_delete" on storage.objects;
create policy "product_images_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and owner = auth.uid());