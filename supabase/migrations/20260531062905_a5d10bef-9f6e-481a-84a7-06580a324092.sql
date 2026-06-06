do $$ begin
  if not exists (select 1 from pg_constraint where conname='product_alerts_product_id_fkey') then
    alter table public.product_alerts
      add constraint product_alerts_product_id_fkey foreign key (product_id) references public.products(id) on delete cascade;
  end if;
end $$;