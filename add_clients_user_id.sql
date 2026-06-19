-- RUN THIS IN YOUR SUPABASE SQL EDITOR TO UPDATE THE SCHEMA FOR CLIENT AND STAFF AUTHENTICATION (USERNAME-BASED)

-- 1. Add user_id column to clients table referencing auth.users(id) if not exists
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Add username column to clients and technical_staff tables if not exists
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS username VARCHAR UNIQUE;
ALTER TABLE public.technical_staff ADD COLUMN IF NOT EXISTS username VARCHAR UNIQUE;

-- 3. Populate existing rows with default usernames derived from names/companies (if any are NULL)
UPDATE public.clients 
SET username = LOWER(REGEXP_REPLACE(company_name, '[^a-zA-Z0-9]', '', 'g'))
WHERE username IS NULL;

UPDATE public.technical_staff 
SET username = LOWER(firstname || lastname || CAST(FLOOR(RANDOM() * 1000) AS INT))
WHERE username IS NULL;

-- 4. Update the handles signup trigger function to support 'Client' roles and 'username' sync
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_firstname VARCHAR;
    v_lastname VARCHAR;
    v_position VARCHAR;
    v_branch VARCHAR;
    v_is_active BOOLEAN;
    v_role VARCHAR;
    v_company_name VARCHAR;
    v_username VARCHAR;
    v_contact_email VARCHAR;
BEGIN
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Technical');
    v_username := COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1));
    v_contact_email := NEW.raw_user_meta_data->>'contact_email';
    
    IF v_role = 'Client' THEN
        v_company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Company ' || NEW.id);
        
        INSERT INTO public.clients (user_id, company_name, contact_person, contact_number, email, username)
        VALUES (
            NEW.id,
            v_company_name,
            COALESCE(NEW.raw_user_meta_data->>'firstname', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'lastname', ''),
            NEW.raw_user_meta_data->>'contact_number',
            v_contact_email,
            v_username
        )
        ON CONFLICT (company_name) DO UPDATE 
        SET user_id = EXCLUDED.user_id, 
            email = EXCLUDED.email,
            contact_person = EXCLUDED.contact_person,
            contact_number = EXCLUDED.contact_number,
            username = COALESCE(public.clients.username, EXCLUDED.username);
            
        RETURN NEW;
    END IF;

    -- Otherwise, register as technical staff
    v_firstname := COALESCE(NEW.raw_user_meta_data->>'firstname', 'New');
    v_lastname := COALESCE(NEW.raw_user_meta_data->>'lastname', 'Staff');
    v_position := COALESCE(NEW.raw_user_meta_data->>'position', 'Technical');
    v_branch := COALESCE(NEW.raw_user_meta_data->>'branch', 'DAVAO');
    
    -- If registering with passcode 'Admin2026', automatically activate and make Admin
    IF NEW.raw_user_meta_data->>'admin_passcode' = 'Admin2026' THEN
        v_is_active := true;
        v_position := 'Admin';
    ELSE
        v_is_active := false;
    END IF;

    INSERT INTO public.technical_staff (
        user_id, firstname, lastname, email, branch, position, is_active,
        can_view_tickets, can_view_technical, can_view_reports, username
    )
    VALUES (
        NEW.id, v_firstname, v_lastname, COALESCE(v_contact_email, NEW.email), v_branch, v_position, v_is_active,
        true, true, true, v_username
    )
    ON CONFLICT (email) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        firstname = EXCLUDED.firstname,
        lastname = EXCLUDED.lastname,
        username = COALESCE(public.technical_staff.username, EXCLUDED.username);
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
