-- Database initialization script for Bank Loan Recovery System

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom types
DO $$
BEGIN
    -- User role enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMIN', 'AGENT', 'AUDITOR');
    END IF;
    
    -- User status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
    END IF;
    
    -- Batch status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_status') THEN
        CREATE TYPE batch_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
    END IF;
    
    -- Visit type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visit_type') THEN
        CREATE TYPE visit_type AS ENUM ('PHONE', 'FIELD', 'FOLLOWUP', 'PTP');
    END IF;
    
    -- Collection type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'collection_type') THEN
        CREATE TYPE collection_type AS ENUM ('BKASH', 'NAGAD', 'CASH', 'BANK_DEPOSIT');
    END IF;
    
    -- Collection status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'collection_status') THEN
        CREATE TYPE collection_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    END IF;
    
    -- Alert type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_type') THEN
        CREATE TYPE alert_type AS ENUM ('SLA_BREACH', 'VARIANCE', 'MISSED_PTP', 'HIGH_OVERDUE', 'NO_UPDATE', 'SYSTEM');
    END IF;
    
    -- Alert severity enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
        CREATE TYPE alert_severity AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');
    END IF;
END$$;

-- Create audit function for tracking changes
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_at = COALESCE(NEW.created_at, NOW());
        NEW.updated_at = NOW();
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.updated_at = NOW();
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create search function for accounts
CREATE OR REPLACE FUNCTION search_accounts(search_term TEXT)
RETURNS TABLE(
    id UUID,
    file_no TEXT,
    client_name TEXT,
    contact_phone TEXT,
    address TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.file_no,
        a.client_name,
        a.contact_phone,
        a.address,
        similarity(
            COALESCE(a.file_no, '') || ' ' ||
            COALESCE(a.client_name, '') || ' ' ||
            COALESCE(a.contact_phone, '') || ' ' ||
            COALESCE(a.address, ''),
            search_term
        ) as rank
    FROM accounts a
    WHERE similarity(
        COALESCE(a.file_no, '') || ' ' ||
        COALESCE(a.client_name, '') || ' ' ||
        COALESCE(a.contact_phone, '') || ' ' ||
        COALESCE(a.address, ''),
        search_term
    ) > 0.3
    ORDER BY rank DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Create function for calculating collection rate
CREATE OR REPLACE FUNCTION calculate_collection_rate(account_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    outstanding DECIMAL(15,2);
    collected DECIMAL(15,2);
BEGIN
    -- Get outstanding amount
    SELECT outstanding_amount INTO outstanding
    FROM accounts
    WHERE id = account_id;
    
    -- Get total collected amount
    SELECT COALESCE(SUM(amount), 0) INTO collected
    FROM collections
    WHERE account_id = account_id AND status = 'APPROVED';
    
    -- Calculate rate
    IF outstanding > 0 THEN
        RETURN ROUND((collected / outstanding * 100), 2);
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function for SLA breach detection
CREATE OR REPLACE FUNCTION check_sla_breaches()
RETURNS TABLE(
    account_id UUID,
    breach_type TEXT,
    breach_hours INTEGER,
    severity alert_severity
) AS $$
BEGIN
    -- Deposit SLA breaches
    RETURN QUERY
    SELECT 
        c.account_id,
        'DEPOSIT_DELAY'::TEXT as breach_type,
        EXTRACT(EPOCH FROM (NOW() - c.created_at))::INTEGER / 3600 as breach_hours,
        CASE 
            WHEN EXTRACT(EPOCH FROM (NOW() - c.created_at)) > 172800 THEN 'CRITICAL'::alert_severity
            WHEN EXTRACT(EPOCH FROM (NOW() - c.created_at)) > 86400 THEN 'ERROR'::alert_severity
            ELSE 'WARNING'::alert_severity
        END as severity
    FROM collections c
    JOIN accounts a ON c.account_id = a.id
    JOIN banks b ON a.bank_id = b.id
    WHERE c.status = 'PENDING'
    AND c.type IN ('CASH', 'BANK_DEPOSIT')
    AND EXTRACT(EPOCH FROM (NOW() - c.created_at)) > 
        COALESCE((b.sla_settings->>'depositHours')::INTEGER * 3600, 172800);
    
    -- Update SLA breaches
    RETURN QUERY
    SELECT 
        a.id as account_id,
        'NO_UPDATE'::TEXT as breach_type,
        EXTRACT(EPOCH FROM (NOW() - COALESCE(a.last_contact_date, a.created_at)))::INTEGER / 3600 as breach_hours,
        CASE 
            WHEN EXTRACT(EPOCH FROM (NOW() - COALESCE(a.last_contact_date, a.created_at))) > 1209600 THEN 'CRITICAL'::alert_severity
            WHEN EXTRACT(EPOCH FROM (NOW() - COALESCE(a.last_contact_date, a.created_at))) > 604800 THEN 'ERROR'::alert_severity
            ELSE 'WARNING'::alert_severity
        END as severity
    FROM accounts a
    JOIN banks b ON a.bank_id = b.id
    WHERE EXTRACT(EPOCH FROM (NOW() - COALESCE(a.last_contact_date, a.created_at))) > 
        COALESCE((b.sla_settings->>'updateDays')::INTEGER * 86400, 604800);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO bankuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bankuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bankuser;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO bankuser;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_search ON accounts USING gin(
    (file_no || ' ' || client_name || ' ' || COALESCE(contact_phone, '') || ' ' || COALESCE(address, '')) gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS idx_collections_account_status ON collections(account_id, status);
CREATE INDEX IF NOT EXISTS idx_collections_created_status ON collections(created_at, status);
CREATE INDEX IF NOT EXISTS idx_accounts_bank_status ON accounts(bank_id, status_stage);
CREATE INDEX IF NOT EXISTS idx_updates_account_date ON updates(account_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_event_logs_created ON event_logs(created_at);

-- Initial data (will be overridden by seed script)
INSERT INTO "User" (id, email, password, name, role, status) VALUES
  (uuid_generate_v4(), 'admin@example.com', '$2b$12$placeholder', 'System Administrator', 'ADMIN', 'ACTIVE')
ON CONFLICT (email) DO NOTHING;