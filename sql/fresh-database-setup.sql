-- ============================================================
-- VOYAGER MULTI-TENANT SAAS - FRESH DATABASE SETUP
-- Execute this script to create all tables for a new PostgreSQL database
-- ============================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ORGANIZATIONS (Core multi-tenant table)
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. SUBSCRIPTION PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER,
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    max_users INTEGER NOT NULL DEFAULT 5,
    max_queries_per_month INTEGER NOT NULL DEFAULT 1000,
    max_rows_display INTEGER NOT NULL DEFAULT 1000,
    max_rows_export INTEGER NOT NULL DEFAULT 10000,
    features TEXT[] NOT NULL DEFAULT ARRAY['query', 'explorer', 'export']::text[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    email_verified BOOLEAN NOT NULL DEFAULT false,
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active TIMESTAMP
);

-- ============================================================
-- 4. ORGANIZATION MEMBERS (Links users to organizations)
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_members (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_org_member 
    ON organization_members(organization_id, user_id);

-- ============================================================
-- 5. ORGANIZATION SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id VARCHAR NOT NULL REFERENCES subscription_plans(id),
    status TEXT NOT NULL DEFAULT 'active',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. ORGANIZATION INVITATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_invitations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    token TEXT NOT NULL UNIQUE,
    invited_by VARCHAR NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. ORGANIZATION AWS CONFIGURATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_aws_configs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    aws_access_key_id TEXT,
    aws_secret_access_key TEXT,
    aws_region TEXT NOT NULL DEFAULT 'us-east-1',
    s3_output_location TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. ORGANIZATION AI CONFIGURATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_ai_configs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    ai_provider TEXT NOT NULL DEFAULT 'openai',
    ai_model TEXT NOT NULL DEFAULT 'gpt-4o',
    openai_api_key TEXT,
    anthropic_api_key TEXT,
    gemini_api_key TEXT,
    ollama_endpoint TEXT,
    custom_prompt TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. QUERY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS query_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    username TEXT NOT NULL,
    query TEXT NOT NULL,
    rows_returned INTEGER NOT NULL,
    execution_time INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. EXPORT JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS export_jobs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    username TEXT NOT NULL,
    query_type TEXT NOT NULL,
    query TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0,
    total_rows INTEGER,
    row_limit INTEGER NOT NULL,
    file_path TEXT,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- ============================================================
-- 12. SFTP CONFIGS
-- ============================================================
CREATE TABLE IF NOT EXISTS sftp_configs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username TEXT NOT NULL,
    password TEXT,
    private_key TEXT,
    passphrase TEXT,
    auth_type TEXT NOT NULL DEFAULT 'password',
    remote_paths TEXT[] NOT NULL DEFAULT ARRAY['/']::text[],
    file_patterns JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. SAVED QUERIES
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_queries (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
    user_id VARCHAR REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 15. SESSION TABLE (for express-session with connect-pg-simple)
-- ============================================================
CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- ============================================================
-- INSERT DEFAULT SUBSCRIPTION PLANS
-- ============================================================
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_users, max_queries_per_month, max_rows_display, max_rows_export, features, sort_order) VALUES
('Free', 'free', 'Basic access for individuals', 0, 0, 1, 10, 100, 500, ARRAY['query', 'explorer']::text[], 0),
('Starter', 'starter', 'For small teams getting started', 2900, 29000, 5, 100, 1000, 5000, ARRAY['query', 'explorer', 'export', 'saved_queries']::text[], 1),
('Professional', 'professional', 'For growing teams with advanced needs', 9900, 99000, 25, 1000, 10000, 50000, ARRAY['query', 'explorer', 'export', 'saved_queries', 'sftp_monitor', 'file_compare']::text[], 2),
('Enterprise', 'enterprise', 'Custom solutions for large organizations', 0, 0, 999, 999999, 100000, 500000, ARRAY['query', 'explorer', 'export', 'saved_queries', 'sftp_monitor', 'file_compare', 'msisdn_lookup', 'custom_aws', 'custom_ai']::text[], 3)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- INSERT DEFAULT ORGANIZATION (for legacy/demo data)
-- ============================================================
INSERT INTO organizations (id, name, slug, status) VALUES
('default-org-id', 'Default Organization', 'default-org', 'active')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- ASSIGN DEFAULT ORGANIZATION TO FREE PLAN
-- ============================================================
INSERT INTO organization_subscriptions (organization_id, plan_id, status)
SELECT 'default-org-id', id, 'active'
FROM subscription_plans WHERE slug = 'free'
ON CONFLICT DO NOTHING;

-- ============================================================
-- INSERT DEFAULT SETTINGS
-- ============================================================
INSERT INTO settings (organization_id, key, value) VALUES
(NULL, 'maxRowsDisplay', '1000'),
(NULL, 'maxRowsExport', '10000'),
(NULL, 'defaultDatabase', 'default'),
(NULL, 'defaultCatalog', 'AwsDataCatalog')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 15b. ORGANIZATION DATABASE CONNECTIONS (Multi-database support)
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_database_connections (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    host TEXT,
    port INTEGER,
    database TEXT,
    username TEXT,
    password TEXT,
    ssl BOOLEAN NOT NULL DEFAULT false,
    aws_access_key_id TEXT,
    aws_secret_access_key TEXT,
    aws_region TEXT,
    s3_output_location TEXT,
    project_id TEXT,
    credentials_json TEXT,
    dataset TEXT,
    account TEXT,
    warehouse TEXT,
    schema TEXT,
    role TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HELPFUL INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_query_logs_org ON query_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_user ON query_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_created ON query_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_queries_org ON saved_queries(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_org ON export_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_sftp_configs_org ON sftp_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_db_connections_org ON organization_database_connections(organization_id);

-- ============================================================
-- DONE!
-- ============================================================
-- After running this script:
-- 1. Create your first admin user through the signup flow
-- 2. Grant super admin: npx tsx server/scripts/setup-super-admin.ts <email>
-- ============================================================
