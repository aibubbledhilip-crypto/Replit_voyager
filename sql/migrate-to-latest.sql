-- ============================================================
-- Voyager — Comprehensive Production Migration Script
-- Safe to run against any version of the database.
-- Every statement uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- / ON CONFLICT DO NOTHING — fully idempotent.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CORE MULTI-TENANT TABLES
--    (created during January 2026 transformation)
--    Safe to re-run — uses IF NOT EXISTS throughout
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

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
  features TEXT[] NOT NULL DEFAULT ARRAY['query','explorer','export'],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id VARCHAR NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_org_subscription ON organization_subscriptions (organization_id);

CREATE TABLE IF NOT EXISTS organization_members (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_org_member ON organization_members (organization_id, user_id);

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
-- 2. USERS TABLE — column additions
--    These columns were added incrementally; older DBs may
--    be missing some of them.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP;

-- Make email NOT NULL for rows that have it set, provide a placeholder for old rows
-- Only updates rows where email is still NULL (legacy rows without email)
UPDATE users SET email = username || '@placeholder.local' WHERE email IS NULL OR email = '';

-- Now enforce NOT NULL if column is still nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE users ALTER COLUMN email SET NOT NULL;
  END IF;
END $$;

-- Partial unique index on email (allows same email for soft-deleted users)
DROP INDEX IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email) WHERE deleted_at IS NULL;

-- ============================================================
-- 3. QUERY LOGS — column additions
-- ============================================================

ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS connection_id VARCHAR;

-- Add FK for connection_id only if the target table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_database_connections')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'query_logs' AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'connection_id'
  ) THEN
    ALTER TABLE query_logs ADD CONSTRAINT query_logs_connection_id_fkey
      FOREIGN KEY (connection_id) REFERENCES organization_database_connections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 4. EXPORT JOBS — column additions
-- ============================================================

ALTER TABLE export_jobs ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================================
-- 5. SFTP CONFIGS — column additions
-- ============================================================

ALTER TABLE sftp_configs ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE sftp_configs ADD COLUMN IF NOT EXISTS file_patterns JSONB DEFAULT '{}';

-- ============================================================
-- 6. SAVED QUERIES — column additions
-- ============================================================

ALTER TABLE saved_queries ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE saved_queries ADD COLUMN IF NOT EXISTS connection_id VARCHAR;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_database_connections')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'saved_queries' AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'connection_id'
  ) THEN
    ALTER TABLE saved_queries ADD CONSTRAINT saved_queries_connection_id_fkey
      FOREIGN KEY (connection_id) REFERENCES organization_database_connections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 7. AWS CONFIG TABLE (February 2026)
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
-- 8. AI CONFIG TABLE
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
-- 9. DATABASE CONNECTIONS TABLE
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
  ssl BOOLEAN NOT NULL DEFAULT FALSE,
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
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_connections_org ON organization_database_connections (organization_id);

-- ============================================================
-- 10. AUDIT LOGS TABLE
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_org  ON audit_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id);

-- ============================================================
-- 11. DASHBOARD CHARTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS dashboard_charts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sql_query TEXT NOT NULL,
  chart_type TEXT NOT NULL DEFAULT 'bar',
  x_axis_column TEXT NOT NULL,
  y_axis_columns TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  connection_id VARCHAR REFERENCES organization_database_connections(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_charts_org ON dashboard_charts (organization_id);

-- Make organization_id NOT NULL if any rows have NULL (migration safety)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dashboard_charts' AND column_name = 'organization_id' AND is_nullable = 'YES'
  ) THEN
    UPDATE dashboard_charts SET organization_id = 'default-org-id' WHERE organization_id IS NULL;
    ALTER TABLE dashboard_charts ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

-- ============================================================
-- 12. SETTINGS — column additions + unique index hardening (March 2026)
-- ============================================================

-- Add organization_id to settings if it doesn't exist yet
ALTER TABLE settings ADD COLUMN IF NOT EXISTS organization_id VARCHAR;

-- Add FK constraint only if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'settings' AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'organization_id'
  ) THEN
    ALTER TABLE settings ADD CONSTRAINT settings_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop old non-partial unique index if it exists (conflicts with the partial ones below)
DROP INDEX IF EXISTS settings_organization_id_key_key;

-- Partial unique indexes: one for org-scoped keys, one for global keys
CREATE UNIQUE INDEX IF NOT EXISTS settings_org_key_unique
  ON settings (organization_id, key)
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS settings_global_key_unique
  ON settings (key)
  WHERE organization_id IS NULL;

-- ============================================================
-- 13. PERFORMANCE INDEXES (March 2026)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_org_members_org   ON organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user  ON organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_org   ON organization_invitations (organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON organization_invitations (email);
CREATE INDEX IF NOT EXISTS idx_query_logs_org    ON query_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_user   ON query_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_settings_org      ON settings (organization_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_org   ON export_jobs (organization_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_user  ON export_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_sftp_configs_org  ON sftp_configs (organization_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_org  ON saved_queries (organization_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_user ON saved_queries (user_id);

-- ============================================================
-- 14. RBAC — organization_role_permissions (March 2026)
-- ============================================================

CREATE TABLE IF NOT EXISTS organization_role_permissions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  feature TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_org_role_feature
  ON organization_role_permissions (organization_id, role, feature);

CREATE INDEX IF NOT EXISTS idx_role_permissions_org
  ON organization_role_permissions (organization_id);

-- Seed default permissions for all existing organizations
DO $$
DECLARE
  org_record RECORD;
  role_name TEXT;
  feature_name TEXT;
  is_enabled BOOLEAN;
BEGIN
  FOR org_record IN SELECT id FROM organizations WHERE deleted_at IS NULL LOOP
    FOREACH role_name IN ARRAY ARRAY['owner','admin','member','viewer'] LOOP
      FOREACH feature_name IN ARRAY ARRAY[
        'execute_queries','explorer','depiction','file_compare',
        'file_aggregate','sftp_monitor','msisdn_lookup','export_data'
      ] LOOP
        is_enabled := CASE
          WHEN role_name = 'owner'  THEN TRUE
          WHEN role_name = 'admin'  THEN TRUE
          WHEN role_name = 'member' AND feature_name = 'msisdn_lookup' THEN FALSE
          WHEN role_name = 'member' THEN TRUE
          WHEN role_name = 'viewer' AND feature_name = 'sftp_monitor'  THEN TRUE
          WHEN role_name = 'viewer' THEN FALSE
          ELSE TRUE
        END;

        INSERT INTO organization_role_permissions (organization_id, role, feature, enabled)
        VALUES (org_record.id, role_name, feature_name, is_enabled)
        ON CONFLICT (organization_id, role, feature) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 15. API KEYS (April 2026)
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  key_prefix VARCHAR(12) NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org  ON api_keys (organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys (key_hash);

-- ============================================================
-- 16. DEFAULT DATA — subscription plans + default org
--     (only inserted if not already present)
-- ============================================================

INSERT INTO subscription_plans (name, slug, description, price_monthly, max_users, max_queries_per_month, max_rows_display, max_rows_export, is_active, sort_order)
VALUES
  ('Free',         'free',         'For individuals getting started',          0,    5,    10,    1000,  10000, TRUE, 1),
  ('Starter',      'starter',      'For small teams',                          2900, 10,   100,   1000,  10000, TRUE, 2),
  ('Professional', 'professional', 'For growing organisations',                9900, 50,   1000,  1000,  50000, TRUE, 3),
  ('Enterprise',   'enterprise',   'Custom limits for large organisations',    0,    999,  99999, 10000, 100000,TRUE, 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO organizations (id, name, slug, status)
VALUES ('default-org-id', 'Default Organization', 'default-org', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO organization_subscriptions (organization_id, plan_id, status)
SELECT 'default-org-id', id, 'active'
FROM subscription_plans WHERE slug = 'free'
ON CONFLICT DO NOTHING;

INSERT INTO settings (organization_id, key, value) VALUES
(NULL, 'maxRowsDisplay', '1000'),
(NULL, 'maxRowsExport',  '10000'),
(NULL, 'defaultDatabase','default'),
(NULL, 'defaultCatalog', 'AwsDataCatalog')
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================
-- DONE
-- ============================================================
SELECT 'Migration complete — database is fully up to date.' AS status;
