
-- Roles
create type public.app_role as enum ('customer', 'seller', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Auto-create profile + default customer role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sellers (storefronts). user_id nullable so we can seed a demo store.
create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  store_name text not null,
  store_slug text not null unique,
  logo_url text,
  banner_url text,
  bio text,
  rating numeric(3,2) default 4.8,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  description text not null default '',
  short_description text,
  price_cents integer not null check (price_cents >= 0),
  compare_at_cents integer,
  stock integer not null default 0,
  brand text,
  images jsonb not null default '[]'::jsonb,
  specs jsonb not null default '{}'::jsonb,
  rating numeric(3,2) default 4.5,
  review_count integer default 0,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index products_category_idx on public.products(category_id);
create index products_seller_idx on public.products(seller_id);
create index products_published_idx on public.products(is_published) where is_published;
create index products_search_idx on public.products using gin (to_tsvector('english', title || ' ' || coalesce(description,'') || ' ' || coalesce(brand,'')));

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- GRANTS
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

grant select, insert, update, delete on public.sellers to authenticated;
grant all on public.sellers to service_role;

grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;

grant select, insert, delete on public.wishlists to authenticated;
grant all on public.wishlists to service_role;

-- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.sellers enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.wishlists enable row level security;

-- profiles: each user can read/update their own
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);

-- user_roles: user can read their own roles
create policy "user_roles_select_own" on public.user_roles for select to authenticated using (auth.uid() = user_id);

-- sellers: public read; owner can manage
create policy "sellers_public_read" on public.sellers for select to anon, authenticated using (true);
create policy "sellers_insert_own" on public.sellers for insert to authenticated with check (auth.uid() = user_id);
create policy "sellers_update_own" on public.sellers for update to authenticated using (auth.uid() = user_id);
create policy "sellers_delete_own" on public.sellers for delete to authenticated using (auth.uid() = user_id);

-- categories: public read
create policy "categories_public_read" on public.categories for select to anon, authenticated using (true);

-- products: public read of published; seller can manage their products
create policy "products_public_read" on public.products for select to anon, authenticated using (is_published);
create policy "products_seller_manage" on public.products for all to authenticated
  using (exists (select 1 from public.sellers s where s.id = seller_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.sellers s where s.id = seller_id and s.user_id = auth.uid()));

-- wishlists: each user manages their own
create policy "wishlists_select_own" on public.wishlists for select to authenticated using (auth.uid() = user_id);
create policy "wishlists_insert_own" on public.wishlists for insert to authenticated with check (auth.uid() = user_id);
create policy "wishlists_delete_own" on public.wishlists for delete to authenticated using (auth.uid() = user_id);

-- Seed: categories, demo seller, products
insert into public.categories (slug, name, icon) values
  ('smartphones', 'Smartphones', 'Smartphone'),
  ('laptops', 'Laptops', 'Laptop'),
  ('audio', 'Audio', 'Headphones'),
  ('wearables', 'Wearables', 'Watch'),
  ('cameras', 'Cameras', 'Camera'),
  ('accessories', 'Accessories', 'Cable');

insert into public.sellers (store_name, store_slug, bio, logo_url, banner_url, rating) values
  ('NovaTech', 'novatech', 'Curated electronics from the future.', null, null, 4.9),
  ('PrimeSound', 'primesound', 'Audiophile-grade gear, fair pricing.', null, null, 4.8),
  ('PixelForge', 'pixelforge', 'For photographers and creators.', null, null, 4.7);

-- Insert products via DO block to map seller/category ids
do $$
declare
  s_nova uuid; s_prime uuid; s_pixel uuid;
  c_phone uuid; c_laptop uuid; c_audio uuid; c_wear uuid; c_cam uuid; c_acc uuid;
begin
  select id into s_nova from public.sellers where store_slug='novatech';
  select id into s_prime from public.sellers where store_slug='primesound';
  select id into s_pixel from public.sellers where store_slug='pixelforge';
  select id into c_phone from public.categories where slug='smartphones';
  select id into c_laptop from public.categories where slug='laptops';
  select id into c_audio from public.categories where slug='audio';
  select id into c_wear from public.categories where slug='wearables';
  select id into c_cam from public.categories where slug='cameras';
  select id into c_acc from public.categories where slug='accessories';

  insert into public.products (seller_id, category_id, title, slug, description, short_description, price_cents, compare_at_cents, stock, brand, is_featured, specs) values
    (s_nova, c_phone, 'Aether 15 Pro', 'aether-15-pro', 'Flagship smartphone with a 6.7" OLED display, titanium frame, and an AI-tuned triple camera system. All-day battery and on-device AI assistant.', 'Flagship AI smartphone with titanium frame', 119900, 129900, 24, 'Aether', true, '{"Display":"6.7\" OLED 120Hz","Chip":"A18 Pro","Storage":"256GB","Battery":"4500mAh"}'),
    (s_nova, c_phone, 'Aether SE', 'aether-se', 'Compact, powerful smartphone for those who want flagship performance in a smaller form factor.', 'Compact flagship at a smarter price', 69900, null, 60, 'Aether', false, '{"Display":"6.1\" OLED","Chip":"A18","Storage":"128GB"}'),
    (s_nova, c_laptop, 'Volt Book 14', 'volt-book-14', 'Ultraportable 14" laptop with all-day battery, fanless silicon, and a stunning 3K display. Perfect for creators on the move.', 'Fanless 14" creator laptop', 149900, 169900, 12, 'Volt', true, '{"Display":"14\" 3K","Chip":"M-class","RAM":"16GB","SSD":"512GB"}'),
    (s_nova, c_laptop, 'Volt Studio 16', 'volt-studio-16', '16" performance laptop built for video editing, 3D, and ML workloads.', 'Pro 16" for creators and engineers', 249900, null, 8, 'Volt', true, '{"Display":"16\" mini-LED","RAM":"32GB","SSD":"1TB"}'),
    (s_prime, c_audio, 'Aurora Wireless ANC', 'aurora-wireless-anc', 'Over-ear wireless headphones with industry-leading active noise cancellation and 40h battery life.', 'Reference-grade ANC headphones', 34900, 39900, 80, 'Aurora', true, '{"Type":"Over-ear","ANC":"Adaptive","Battery":"40h"}'),
    (s_prime, c_audio, 'Aurora Buds Pro', 'aurora-buds-pro', 'True wireless earbuds with spatial audio and class-leading transparency mode.', 'Spatial-audio true wireless buds', 17900, null, 150, 'Aurora', false, '{"ANC":"Yes","Battery":"30h with case"}'),
    (s_prime, c_audio, 'Stage One Studio Monitor', 'stage-one-monitor', 'Compact studio monitor with neutral tuning and DSP room correction.', 'Neutral studio monitor with DSP', 89900, null, 14, 'Stage', false, '{"Driver":"6.5\"","DSP":"Room correction"}'),
    (s_pixel, c_cam, 'PixelForge X1 Mirrorless', 'pixelforge-x1', 'Full-frame mirrorless camera with 45MP sensor and AI subject tracking.', '45MP full-frame with AI tracking', 219900, 239900, 6, 'PixelForge', true, '{"Sensor":"45MP full-frame","Video":"8K30"}'),
    (s_pixel, c_cam, 'PixelForge Lens 35mm f/1.4', 'pixelforge-35-14', 'Sharp, fast prime lens for portraits and low light.', 'Fast 35mm prime', 89900, null, 20, 'PixelForge', false, '{"Mount":"PX-mount","Aperture":"f/1.4"}'),
    (s_nova, c_wear, 'Aether Watch 3', 'aether-watch-3', 'Health-focused smartwatch with on-device AI coaching and 7-day battery.', 'AI health watch with 7d battery', 39900, null, 100, 'Aether', false, '{"Battery":"7d","Sensors":"ECG, SpO2"}'),
    (s_nova, c_acc, 'Aether MagCharge 3-in-1', 'aether-magcharge', 'Foldable 3-in-1 wireless charger for phone, watch, and buds.', '3-in-1 foldable wireless charger', 12900, null, 200, 'Aether', false, '{}'),
    (s_prime, c_acc, 'Aurora USB-C DAC', 'aurora-usbc-dac', 'Pocket DAC/amp for high-resolution audio on the go.', 'Pocket DAC/amp', 14900, null, 75, 'Aurora', false, '{"DAC":"32-bit/384kHz"}');
end $$;
