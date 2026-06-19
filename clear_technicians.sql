-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- =====================================================================
-- OPTION A: Delete all technicians/staff EXCEPT Admin accounts
-- (Recommended so you do not lock yourself out of your admin account)
-- =====================================================================

-- 1. Delete all non-admin staff rows from public.technical_staff table
DELETE FROM public.technical_staff 
WHERE position != 'Admin';

-- 2. Delete corresponding auth accounts in Supabase so they can register again
DELETE FROM auth.users 
WHERE id NOT IN (
    SELECT user_id 
    FROM public.technical_staff 
    WHERE position = 'Admin' AND user_id IS NOT NULL
);


-- =====================================================================
-- OPTION B: Absolute Wipe (Deletes ALL staff, including Admin accounts)
-- (WARNING: This will delete the admin account we just created)
-- =====================================================================

-- -- 1. Delete all staff rows from public.technical_staff
-- DELETE FROM public.technical_staff;
--
-- -- 2. Delete all auth users from Supabase Auth
-- DELETE FROM auth.users;
