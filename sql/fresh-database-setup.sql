-- ============================================================
-- VOYAGER MULTI-TENANT SAAS - FRESH DATABASE SETUP
-- Execute this script to create all tables for a new PostgreSQL database
-- Updated: March 2026
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ORGANIZATIONS (Core multi-tenant table)
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT, -- cache; source of truth is organization_subscriptions
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP -- NULL = active, non-NULL = soft-deleted
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key ON organizations(slug);

-- ============================================================
-- 2. SUBSCRIPTION PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
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

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_slug_key ON subscription_plans(slug);

-- ============================================================
-- 3. USERS
-- email is the login identifier (globally unique among active users)
-- username is display only — not globally unique
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    email_verified BOOLEAN NOT NULL DEFAULT false,
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active TIMESTAMP,
    deleted_at TIMESTAMP, -- NULL = active, non-NULL = soft-deleted (kept for audit)
    email_verification_token TEXT,
    email_verification_expires TIMESTAMP
);

-- Partial unique: allows same email for soft-deleted users
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE deleted_at IS NULL;

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

CREATE UNIQUE INDEX IF NOT EXISTS unique_org_member ON organization_members(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- ============================================================
-- 5. ORGANIZATION SUBSCRIPTIONS
-- One active subscription per organization (enforced by unique index)
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

CREATE UNIQUE INDEX IF NOT EXISTS unique_org_subscription ON organization_subscriptions(organization_id);

-- ============================================================
-- 6. ORGANIZATION INVITATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_invitations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    token TEXT NOT NULL,
    invited_by VARCHAR NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_token_key ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_org ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON organization_invitations(email);

-- ============================================================
-- 7. ORGANIZATION AWS CONFIGURATIONS (Legacy Athena config UI)
-- New Athena connections should use organization_database_connections (type='athena')
-- aws_secret_access_key stored encrypted at rest
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_aws_configs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    aws_access_key_id TEXT,
    aws_secret_access_key TEXT, -- encrypted at rest
    aws_region TEXT NOT NULL DEFAULT 'us-east-1',
    s3_output_location TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_aws_configs_organization_id_key ON organization_aws_configs(organization_id);

-- ============================================================
-- 8. ORGANIZATION DATABASE CONNECTIONS (Multi-database support)
-- Sensitive fields (password, aws_secret_access_key, credentials_json) encrypted at rest
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_database_connections (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'postgresql' | 'mysql' | 'mssql' | 'athena' | 'bigquery' | 'snowflake' | 'clickhouse'
    host TEXT,
    port INTEGER,
    database TEXT,
    username TEXT,
    password TEXT,              -- encrypted at rest
    ssl BOOLEAN NOT NULL DEFAULT false,
    aws_access_key_id TEXT,
    aws_secret_access_key TEXT, -- encrypted at rest
    aws_region TEXT,
    s3_output_location TEXT,
    project_id TEXT,
    credentials_json TEXT,      -- encrypted at rest (BigQuery service account JSON)
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

CREATE INDEX IF NOT EXISTS idx_db_connections_org ON organization_database_connections(organization_id);

-- ============================================================
-- 9. ORGANIZATION AI CONFIGURATIONS
-- API keys are encrypted at rest
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_ai_configs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ai_provider TEXT NOT NULL DEFAULT 'openai',
    ai_model TEXT NOT NULL DEFAULT 'gpt-4o',
    openai_api_key TEXT,    -- encrypted at rest
    anthropic_api_key TEXT, -- encrypted at rest
    gemini_api_key TEXT,    -- encrypted at rest
    ollama_endpoint TEXT,
    custom_prompt TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_ai_configs_organization_id_key ON organization_ai_configs(organization_id);

-- ============================================================
-- 10. QUERY LOGS
-- connection_id tracks which DB connection was used
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
    connection_id VARCHAR REFERENCES organization_database_connections(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_logs_org ON query_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_user ON query_logs(user_id);

-- ============================================================
-- 11. SETTINGS (Organization-scoped; key unique per org)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_org_setting_key ON settings(organization_id, key);
CREATE INDEX IF NOT EXISTS idx_settings_org ON settings(organization_id);

-- ============================================================
-- 12. EXPORT JOBS
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

CREATE INDEX IF NOT EXISTS idx_export_jobs_org ON export_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_user ON export_jobs(user_id);

-- ============================================================
-- 13. SFTP CONFIGS
-- password, private_key, passphrase are encrypted at rest
-- ============================================================
CREATE TABLE IF NOT EXISTS sftp_configs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username TEXT NOT NULL,
    password TEXT,      -- encrypted at rest
    private_key TEXT,  -- encrypted at rest
    passphrase TEXT,   -- encrypted at rest
    auth_type TEXT NOT NULL DEFAULT 'password',
    remote_paths TEXT[] NOT NULL DEFAULT ARRAY['/']::text[],
    file_patterns JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sftp_configs_org ON sftp_configs(organization_id);

-- ============================================================
-- 14. SAVED QUERIES
-- connection_id tracks which DB connection the query belongs to
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_queries (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    connection_id VARCHAR REFERENCES organization_database_connections(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_queries_org ON saved_queries(organization_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_user ON saved_queries(user_id);

-- ============================================================
-- 15. DASHBOARD CHARTS (Depiction feature)
-- organization_id is required (NOT NULL) for tenant isolation
-- connection_id FK set null on connection delete
-- ============================================================
CREATE TABLE IF NOT EXISTS dashboard_charts (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sql_query TEXT NOT NULL,
    chart_type TEXT NOT NULL DEFAULT 'bar',
    x_axis_column TEXT NOT NULL,
    y_axis_columns TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
    connection_id VARCHAR REFERENCES organization_database_connections(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_charts_org ON dashboard_charts(organization_id);

-- ============================================================
-- 16. AUDIT LOGS (SaaS compliance)
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- ============================================================
-- 17. SESSION TABLE (for express-session with connect-pg-simple)
-- ============================================================
CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- ============================================================
-- DEFAULT SUBSCRIPTION PLANS
-- ============================================================
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_users, max_queries_per_month, max_rows_display, max_rows_export, features, sort_order) VALUES
('Free',         'free',         'Basic access for individuals',              0,    0,      1,   10,      100,    500,    ARRAY['query', 'explorer']::text[], 0),
('Starter',      'starter',      'For small teams getting started',           2900, 29000,  5,   100,     1000,   5000,   ARRAY['query', 'explorer', 'export', 'saved_queries']::text[], 1),
('Professional', 'professional', 'For growing teams with advanced needs',     9900, 99000,  25,  1000,    10000,  50000,  ARRAY['query', 'explorer', 'export', 'saved_queries', 'sftp_monitor', 'file_compare']::text[], 2),
('Enterprise',   'enterprise',   'Custom solutions for large organizations',  0,    0,      999, 999999,  100000, 500000, ARRAY['query', 'explorer', 'export', 'saved_queries', 'sftp_monitor', 'file_compare', 'msisdn_lookup', 'custom_aws', 'custom_ai']::text[], 3)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- DEFAULT ORGANIZATION (for legacy/demo data)
-- ============================================================
INSERT INTO organizations (id, name, slug, status) VALUES
('default-org-id', 'Default Organization', 'default-org', 'active')
ON CONFLICT DO NOTHING;

-- Assign default org to free plan
INSERT INTO organization_subscriptions (organization_id, plan_id, status)
SELECT 'default-org-id', id, 'active'
FROM subscription_plans WHERE slug = 'free'
ON CONFLICT DO NOTHING;

-- ============================================================
-- DEFAULT SETTINGS (global / platform-wide defaults)
-- ============================================================
INSERT INTO settings (organization_id, key, value) VALUES
(NULL, 'maxRowsDisplay', '1000'),
(NULL, 'maxRowsExport', '10000'),
(NULL, 'defaultDatabase', 'default'),
(NULL, 'defaultCatalog', 'AwsDataCatalog')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DONE!
-- After running this script:
-- 1. Create your first admin user through the signup flow
-- 2. Grant super admin: npx tsx server/scripts/setup-super-admin.ts <email>
-- 3. Set ENCRYPTION_KEY env var for credential encryption (32 random hex bytes)
-- ============================================================
