-- Fix confirmed_at for existing seeded users
UPDATE auth.users 
SET confirmed_at = COALESCE(confirmed_at, email_confirmed_at, now())
WHERE confirmed_at IS NULL;
