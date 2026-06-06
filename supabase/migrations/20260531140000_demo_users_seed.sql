-- Seed Demo Users (Admin, Seller, Customer)
-- We insert into auth.users and auth.identities to support password login, and assign roles in public.user_roles.

-- 1. Demo Admin (admin@vyapari.com / demo_admin_123)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  'e336b9e5-4a1b-adb2-eb6b-9e5460130001',
  'authenticated',
  'authenticated',
  'admin@vyapari.com',
  crypt('demo_admin_123', gen_salt('bf')),
  now(),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Demo Admin"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130001' OR email = 'admin@vyapari.com'
);

-- Ensure existing user is also updated if they were created without confirmed_at
UPDATE auth.users 
SET confirmed_at = COALESCE(confirmed_at, email_confirmed_at, now())
WHERE id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130001';

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  'e336b9e5-4a1b-adb2-eb6b-9e5460130001',
  'e336b9e5-4a1b-adb2-eb6b-9e5460130001',
  jsonb_build_object('sub', 'e336b9e5-4a1b-adb2-eb6b-9e5460130001', 'email', 'admin@vyapari.com', 'email_verified', true),
  'email',
  'admin@vyapari.com',
  now(),
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130001' OR (provider_id = 'admin@vyapari.com' AND provider = 'email')
);

INSERT INTO public.user_roles (user_id, role)
SELECT 'e336b9e5-4a1b-adb2-eb6b-9e5460130001', 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130001' AND role = 'admin'
);

DELETE FROM public.user_roles 
WHERE user_id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130001' AND role = 'customer';


-- 2. Demo Seller (seller@vyapari.com / demo_seller_123)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  'e336b9e5-4a1b-adb2-eb6b-9e5460130002',
  'authenticated',
  'authenticated',
  'seller@vyapari.com',
  crypt('demo_seller_123', gen_salt('bf')),
  now(),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Demo Seller"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130002' OR email = 'seller@vyapari.com'
);

-- Ensure existing user is also updated if they were created without confirmed_at
UPDATE auth.users 
SET confirmed_at = COALESCE(confirmed_at, email_confirmed_at, now())
WHERE id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130002';

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  'e336b9e5-4a1b-adb2-eb6b-9e5460130002',
  'e336b9e5-4a1b-adb2-eb6b-9e5460130002',
  jsonb_build_object('sub', 'e336b9e5-4a1b-adb2-eb6b-9e5460130002', 'email', 'seller@vyapari.com', 'email_verified', true),
  'email',
  'seller@vyapari.com',
  now(),
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130002' OR (provider_id = 'seller@vyapari.com' AND provider = 'email')
);

INSERT INTO public.user_roles (user_id, role)
SELECT 'e336b9e5-4a1b-adb2-eb6b-9e5460130002', 'seller'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130002' AND role = 'seller'
);

DELETE FROM public.user_roles 
WHERE user_id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130002' AND role = 'customer';

UPDATE public.sellers 
SET user_id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130002' 
WHERE store_slug = 'novatech' AND user_id IS NULL;


-- 3. Demo Customer (customer@vyapari.com / demo_customer_123)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  'e336b9e5-4a1b-adb2-eb6b-9e5460130003',
  'authenticated',
  'authenticated',
  'customer@vyapari.com',
  crypt('demo_customer_123', gen_salt('bf')),
  now(),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Demo Customer"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130003' OR email = 'customer@vyapari.com'
);

-- Ensure existing user is also updated if they were created without confirmed_at
UPDATE auth.users 
SET confirmed_at = COALESCE(confirmed_at, email_confirmed_at, now())
WHERE id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130003';

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  'e336b9e5-4a1b-adb2-eb6b-9e5460130003',
  'e336b9e5-4a1b-adb2-eb6b-9e5460130003',
  jsonb_build_object('sub', 'e336b9e5-4a1b-adb2-eb6b-9e5460130003', 'email', 'customer@vyapari.com', 'email_verified', true),
  'email',
  'customer@vyapari.com',
  now(),
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE id = 'e336b9e5-4a1b-adb2-eb6b-9e5460130003' OR (provider_id = 'customer@vyapari.com' AND provider = 'email')
);
