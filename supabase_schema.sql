-- TICKET MONITORING SUPABASE POSTGRESQL SCHEMA SETUP
-- Copy and run this script in your Supabase SQL Editor.

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing triggers and functions if they exist to allow clean runs
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();
DROP TRIGGER IF EXISTS tr_tickets_sync_stats ON public.tickets;
DROP FUNCTION IF EXISTS public.sync_technician_stats();
DROP TRIGGER IF EXISTS tr_tickets_updated_at ON public.tickets;
DROP TRIGGER IF EXISTS tr_technical_staff_updated_at ON public.technical_staff;
DROP TRIGGER IF EXISTS tr_clients_updated_at ON public.clients;
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Drop existing tables (order matters to resolve constraints)
DROP TABLE IF EXISTS public.activity_log;
DROP TABLE IF EXISTS public.remarks;
DROP TABLE IF EXISTS public.tickets_archive;
DROP TABLE IF EXISTS public.tickets;
DROP TABLE IF EXISTS public.concerns;
DROP TABLE IF EXISTS public.products;
DROP TABLE IF EXISTS public.technical_staff;
DROP TABLE IF EXISTS public.clients;
DROP TYPE IF EXISTS ticket_priority;
DROP TYPE IF EXISTS ticket_status;

-- 1. Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
    client_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR NOT NULL UNIQUE,
    contact_person VARCHAR NOT NULL,
    contact_number VARCHAR,
    email VARCHAR,
    username VARCHAR UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Technical Staff Table
CREATE TABLE IF NOT EXISTS public.technical_staff (
    technical_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    firstname VARCHAR NOT NULL,
    lastname VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    username VARCHAR UNIQUE,
    contact_viber VARCHAR,
    branch VARCHAR,
    position VARCHAR CHECK (position IN ('Technical', 'Sales', 'Support', 'Admin')) DEFAULT 'Technical',
    total_ticket INT DEFAULT 0 NOT NULL,
    resolve INT DEFAULT 0 NOT NULL,
    unresolve INT DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT false NOT NULL,
    can_view_tickets BOOLEAN DEFAULT true NOT NULL,
    can_view_technical BOOLEAN DEFAULT true NOT NULL,
    can_view_reports BOOLEAN DEFAULT true NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. Products Table
CREATE TABLE IF NOT EXISTS public.products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR NOT NULL UNIQUE,
    version VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. Concerns Table
CREATE TABLE IF NOT EXISTS public.concerns (
    concern_id SERIAL PRIMARY KEY,
    concern_name VARCHAR NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 5. Create ENUM types for Tickets if they do not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
        CREATE TYPE ticket_priority AS ENUM ('Low', 'Medium', 'High');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE ticket_status AS ENUM ('Pending', 'Assigned', 'In Progress', 'Paused', 'Resolved', 'Closed');
    END IF;
END$$;

-- 6. Tickets Table
CREATE TABLE IF NOT EXISTS public.tickets (
    ticket_id SERIAL PRIMARY KEY,
    company_id UUID REFERENCES public.clients(client_id) ON DELETE RESTRICT NOT NULL,
    technical_id UUID REFERENCES public.technical_staff(technical_id) ON DELETE SET NULL,
    product_id INT REFERENCES public.products(product_id) ON DELETE RESTRICT NOT NULL,
    concern_id INT REFERENCES public.concerns(concern_id) ON DELETE RESTRICT NOT NULL,
    concern_description TEXT,
    date_requested TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    assigned_date TIMESTAMP WITH TIME ZONE,
    submitted_date TIMESTAMP WITH TIME ZONE,
    finish_date TIMESTAMP WITH TIME ZONE,
    solution TEXT,
    remarks TEXT,
    priority ticket_priority DEFAULT 'Medium'::ticket_priority NOT NULL,
    status ticket_status DEFAULT 'Pending'::ticket_status NOT NULL,
    assigned BOOLEAN DEFAULT false NOT NULL,
    is_viewed BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_company_id ON public.tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_tickets_technical_id ON public.tickets(technical_id);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);

-- 7. Tickets Archive Table
CREATE TABLE IF NOT EXISTS public.tickets_archive (
    archive_id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL,
    company_id UUID NOT NULL,
    technical_id UUID,
    product_id INT NOT NULL,
    concern_id INT NOT NULL,
    concern_description TEXT,
    date_requested TIMESTAMP WITH TIME ZONE,
    assigned_date TIMESTAMP WITH TIME ZONE,
    submitted_date TIMESTAMP WITH TIME ZONE,
    finish_date TIMESTAMP WITH TIME ZONE,
    solution TEXT,
    remarks TEXT,
    priority VARCHAR,
    status VARCHAR,
    assigned BOOLEAN,
    is_viewed BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    archived_by UUID REFERENCES public.technical_staff(technical_id) ON DELETE SET NULL,
    archive_reason TEXT
);

-- 8. Remarks Table
CREATE TABLE IF NOT EXISTS public.remarks (
    remark_id SERIAL PRIMARY KEY,
    ticket_id INT REFERENCES public.tickets(ticket_id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES public.technical_staff(technical_id) ON DELETE SET NULL,
    remark_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 9. Activity Log Table
CREATE TABLE IF NOT EXISTS public.activity_log (
    log_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.technical_staff(technical_id) ON DELETE SET NULL,
    action VARCHAR NOT NULL,
    ticket_id INT,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- FUNCTIONS & TRIGGERS

-- A. Auto-update updated_at Trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_technical_staff_updated_at BEFORE UPDATE ON public.technical_staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- B. Technician Statistics Synchronization Trigger
CREATE OR REPLACE FUNCTION public.sync_technician_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_old_tech UUID;
    v_new_tech UUID;
    v_old_status ticket_status;
    v_new_status ticket_status;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.technical_id IS NOT NULL THEN
            UPDATE public.technical_staff
            SET total_ticket = total_ticket + 1,
                resolve = CASE WHEN NEW.status = 'Resolved'::ticket_status THEN resolve + 1 ELSE resolve END,
                unresolve = CASE WHEN NEW.status != 'Resolved'::ticket_status THEN unresolve + 1 ELSE unresolve END
            WHERE technical_id = NEW.technical_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_tech := OLD.technical_id;
        v_new_tech := NEW.technical_id;
        v_old_status := OLD.status;
        v_new_status := NEW.status;

        -- 1. If technician changed
        IF COALESCE(v_old_tech, '00000000-0000-0000-0000-000000000000'::uuid) != COALESCE(v_new_tech, '00000000-0000-0000-0000-000000000000'::uuid) THEN
            -- Decrement old tech
            IF v_old_tech IS NOT NULL THEN
                UPDATE public.technical_staff
                SET total_ticket = GREATEST(0, total_ticket - 1),
                    resolve = CASE WHEN v_old_status = 'Resolved'::ticket_status THEN GREATEST(0, resolve - 1) ELSE resolve END,
                    unresolve = CASE WHEN v_old_status != 'Resolved'::ticket_status THEN GREATEST(0, unresolve - 1) ELSE unresolve END
                WHERE technical_id = v_old_tech;
            END IF;

            -- Increment new tech
            IF v_new_tech IS NOT NULL THEN
                UPDATE public.technical_staff
                SET total_ticket = total_ticket + 1,
                    resolve = CASE WHEN v_new_status = 'Resolved'::ticket_status THEN resolve + 1 ELSE resolve END,
                    unresolve = CASE WHEN v_new_status != 'Resolved'::ticket_status THEN unresolve + 1 ELSE unresolve END
                WHERE technical_id = v_new_tech;
            END IF;
        
        -- 2. If status changed but technician is the same
        ELSIF v_new_tech IS NOT NULL AND v_old_status != v_new_status THEN
            IF v_old_status = 'Resolved'::ticket_status AND v_new_status != 'Resolved'::ticket_status THEN
                UPDATE public.technical_staff
                SET resolve = GREATEST(0, resolve - 1), unresolve = unresolve + 1
                WHERE technical_id = v_new_tech;
            ELSIF v_old_status != 'Resolved'::ticket_status AND v_new_status = 'Resolved'::ticket_status THEN
                UPDATE public.technical_staff
                SET resolve = resolve + 1, unresolve = GREATEST(0, unresolve - 1)
                WHERE technical_id = v_new_tech;
            END IF;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.technical_id IS NOT NULL THEN
            UPDATE public.technical_staff
            SET total_ticket = GREATEST(0, total_ticket - 1),
                resolve = CASE WHEN OLD.status = 'Resolved'::ticket_status THEN GREATEST(0, resolve - 1) ELSE resolve END,
                unresolve = CASE WHEN OLD.status != 'Resolved'::ticket_status THEN GREATEST(0, unresolve - 1) ELSE unresolve END
            WHERE technical_id = OLD.technical_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_tickets_sync_stats
AFTER INSERT OR UPDATE OR DELETE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.sync_technician_stats();


-- C. Auth User Signup Hook Trigger
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

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Enable Row Level Security (optional but recommended in Supabase)
-- To ensure normal operation while keeping it easy, we keep tables accessible, 
-- or we can write the policies. By default, Supabase creates tables without RLS 
-- unless explicit ALTER TABLE ENABLE RLS is issued.
-- We will enable RLS on technical_staff to demonstrate compliance, but let's provide policy bypass or open access for testing if desired.
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concerns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Policies:
-- 1. Anyone can read clients/products/concerns. Admins/Staff can modify.
CREATE POLICY "Allow read for authenticated" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write for authenticated" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow read for authenticated" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write for authenticated" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow read for authenticated" ON public.concerns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write for authenticated" ON public.concerns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Technical staff RLS:
CREATE POLICY "Allow read technical staff" ON public.technical_staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update technical staff" ON public.technical_staff FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow insert technical staff" ON public.technical_staff FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Tickets policies:
CREATE POLICY "Allow read tickets" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update tickets" ON public.tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete tickets" ON public.tickets FOR DELETE TO authenticated USING (true);

-- 4. Archive, Remarks, activity log
CREATE POLICY "Allow all archive" ON public.tickets_archive FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all remarks" ON public.remarks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all activity_log" ON public.activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =================================================================
-- MOCK SEED DATA (Safe to run multiple times)
-- =================================================================

-- Seed Clients
INSERT INTO public.clients (company_name, contact_person, contact_number, email) VALUES
('Acme Corporation', 'John Watson', '+639171234567', 'watson@acme.com'),
('Globex Corporation', 'Hank Scorpio', '+639189876543', 'scorpio@globex.com'),
('Initech LLC', 'Peter Gibbons', '+639195550123', 'peter@initech.com'),
('Umbrella Corp', 'Albert Wesker', '+639088889999', 'wesker@umbrella.com'),
('Wayne Enterprises', 'Lucius Fox', '+639201112222', 'fox@wayne.com')
ON CONFLICT (company_name) DO NOTHING;

-- Seed Products
INSERT INTO public.products (product_name, version) VALUES
('Workmonitoring Suite', 'v2.5'),
('Billing Gateway API', 'v1.1'),
('Realtime Dashboard Server', 'v3.0'),
('HR Portal Core', 'v1.8'),
('Inventory Tracker', 'v4.2')
ON CONFLICT (product_name) DO NOTHING;

-- Seed Concern Categories
INSERT INTO public.concerns (concern_name, description) VALUES
('System Crash', 'Critical application crash or unhandled runtime exceptions causing disruption.'),
('Slow Performance', 'High latency, slow page transitions, or lagging database operations.'),
('Account Lockout', 'Users unable to login or verify passwords due to credentials lock.'),
('Feature Request', 'Requests for new features, widgets, exports or system enhancements.'),
('Integration Error', 'Failed synchronization or data sync errors between internal APIs.')
ON CONFLICT (concern_name) DO NOTHING;
