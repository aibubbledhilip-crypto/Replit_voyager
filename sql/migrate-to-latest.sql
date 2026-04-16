-- ============================================================
-- Voyager — Production Migration Script
-- Run this on your Lightsail PostgreSQL database to bring it
-- up to date with the latest application version.
--
-- SAFE TO RE-RUN: all statements use IF NOT EXISTS / ON CONFLICT
-- ============================================================

BEGIN;

-- ============================================================
-- 1. RBAC — organization_role_permissions
-- Introduced: March 2026
-- Per-org, per-role feature permission toggles (GUI-configurable)
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

-- Seed default permissions for every existing organization.
-- If an org already has custom permissions, this will not overwrite them (ON CONFLICT DO NOTHING).
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
        -- Default permission matrix
        is_enabled := CASE
          WHEN role_name = 'owner'  THEN TRUE
          WHEN role_name = 'admin'  THEN TRUE
          WHEN role_name = 'member' AND feature_name = 'msisdn_lookup' THEN FALSE
          WHEN role_name = 'member' THEN TRUE
          WHEN role_name = 'viewer' AND feature_name = 'sftp_monitor'  THEN TRUE
          WHEN role_name = 'viewer' THEN FALSE
          ELSE TRUE
        END;

        INSERT INTO organization_role_permissions
          (organization_id, role, feature, enabled)
        VALUES
          (org_record.id, role_name, feature_name, is_enabled)
        ON CONFLICT (organization_id, role, feature) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 2. SCHEMA HARDENING — indexes, constraints, partial unique
-- Introduced: March 2026
-- ============================================================

-- Unique index on settings (org + key) — replace old unique constraint if present
DROP INDEX IF EXISTS settings_organization_id_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS settings_org_key_unique
  ON settings (organization_id, key)
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS settings_global_key_unique
  ON settings (key)
  WHERE organization_id IS NULL;

-- Unique index on organization_subscriptions(organization_id)
CREATE UNIQUE INDEX IF NOT EXISTS org_subscriptions_org_unique
  ON organization_subscriptions (organization_id);

-- Performance indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_org_members_org     ON organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user    ON organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_org     ON organization_invitations (organization_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_org      ON query_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_user     ON query_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_settings_org        ON settings (organization_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_org     ON export_jobs (organization_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_user    ON export_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_sftp_configs_org    ON sftp_configs (organization_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_org   ON saved_queries (organization_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_user  ON saved_queries (user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_charts_org ON dashboard_charts (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org      ON audit_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user     ON audit_logs (user_id);

-- Partial unique index on users email (allows same email for soft-deleted users)
DROP INDEX IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (email)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 3. API KEYS
-- Introduced: April 2026
-- Personal access tokens for programmatic Executor/Explorer access
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
-- 4. DASHBOARD CHARTS — organization_id NOT NULL (if nullable)
-- Introduced: March 2026
-- ============================================================

-- Make organization_id NOT NULL if it is currently nullable
-- (This is safe if all existing rows already have a value)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dashboard_charts'
      AND column_name = 'organization_id'
      AND is_nullable = 'YES'
  ) THEN
    -- First set any NULL rows to the default org (safety net)
    UPDATE dashboard_charts SET organization_id = 'default-org-id' WHERE organization_id IS NULL;
    ALTER TABLE dashboard_charts ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- DONE
-- ============================================================
SELECT 'Migration complete — all tables and indexes are up to date.' AS status;
