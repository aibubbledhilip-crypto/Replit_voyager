-- ============================================================
-- Liberty Organization Setup Script
-- Creates the Liberty organization, assigns all existing users
-- to it, and migrates their data (AWS config, DB connections,
-- SFTP configs, saved queries, settings) to Liberty.
-- Safe to re-run — fully idempotent.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Create Liberty organization
-- ============================================================

INSERT INTO organizations (id, name, slug, status)
VALUES ('liberty-org', 'Liberty', 'liberty', 'active')
ON CONFLICT DO NOTHING;

-- Assign the free plan subscription (or upgrade later via admin)
INSERT INTO organization_subscriptions (organization_id, plan_id, status)
SELECT 'liberty-org', id, 'active'
FROM subscription_plans WHERE slug = 'free'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. Add all active users to Liberty
--    First user (admin) becomes owner; rest become admin
-- ============================================================

-- Remove stale memberships for these users in other orgs
-- (keeps them only in Liberty going forward)
DELETE FROM organization_members
WHERE user_id IN (SELECT id FROM users WHERE deleted_at IS NULL)
  AND organization_id != 'liberty-org';

-- Add all active users to Liberty
-- admin user → owner; everyone else → admin
INSERT INTO organization_members (organization_id, user_id, role)
SELECT
  'liberty-org',
  u.id,
  CASE
    WHEN u.role = 'admin' AND u.username = 'admin' THEN 'owner'
    ELSE 'admin'
  END
FROM users u
WHERE u.deleted_at IS NULL
ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = EXCLUDED.role;

-- ============================================================
-- 3. Migrate AWS config to Liberty
--    Takes the first existing AWS config from any org
-- ============================================================

-- Copy the most complete AWS config found into Liberty
INSERT INTO organization_aws_configs
  (organization_id, aws_access_key_id, aws_secret_access_key, aws_region, s3_output_location)
SELECT
  'liberty-org',
  aws_access_key_id,
  aws_secret_access_key,
  aws_region,
  s3_output_location
FROM organization_aws_configs
WHERE organization_id != 'liberty-org'
  AND (aws_access_key_id IS NOT NULL OR s3_output_location IS NOT NULL)
ORDER BY updated_at DESC
LIMIT 1
ON CONFLICT (organization_id) DO UPDATE
  SET aws_access_key_id     = EXCLUDED.aws_access_key_id,
      aws_secret_access_key = EXCLUDED.aws_secret_access_key,
      aws_region            = EXCLUDED.aws_region,
      s3_output_location    = EXCLUDED.s3_output_location,
      updated_at            = NOW();

-- ============================================================
-- 4. Migrate AI config to Liberty
-- ============================================================

INSERT INTO organization_ai_configs
  (organization_id, ai_provider, ai_model, openai_api_key, anthropic_api_key, gemini_api_key, ollama_endpoint, custom_prompt)
SELECT
  'liberty-org',
  ai_provider, ai_model, openai_api_key, anthropic_api_key, gemini_api_key, ollama_endpoint, custom_prompt
FROM organization_ai_configs
WHERE organization_id != 'liberty-org'
ORDER BY updated_at DESC
LIMIT 1
ON CONFLICT (organization_id) DO NOTHING;

-- ============================================================
-- 5. Migrate DB connections to Liberty
-- ============================================================

UPDATE organization_database_connections
SET organization_id = 'liberty-org'
WHERE organization_id != 'liberty-org';

-- ============================================================
-- 6. Migrate SFTP configs to Liberty
-- ============================================================

UPDATE sftp_configs
SET organization_id = 'liberty-org'
WHERE organization_id IS NULL OR organization_id != 'liberty-org';

-- ============================================================
-- 7. Migrate saved queries to Liberty
-- ============================================================

UPDATE saved_queries
SET organization_id = 'liberty-org'
WHERE organization_id IS NULL OR organization_id != 'liberty-org';

-- ============================================================
-- 8. Migrate query logs to Liberty
-- ============================================================

UPDATE query_logs
SET organization_id = 'liberty-org'
WHERE organization_id IS NULL OR organization_id != 'liberty-org';

-- ============================================================
-- 9. Migrate export jobs to Liberty
-- ============================================================

UPDATE export_jobs
SET organization_id = 'liberty-org'
WHERE organization_id IS NULL OR organization_id != 'liberty-org';

-- ============================================================
-- 10. Migrate settings to Liberty
--     Move org-scoped settings; skip if Liberty already has
--     a setting with the same key
-- ============================================================

-- First migrate global (NULL org) settings → Liberty scoped
INSERT INTO settings (organization_id, key, value)
SELECT 'liberty-org', key, value
FROM settings
WHERE organization_id IS NULL
ON CONFLICT DO NOTHING;

-- Migrate settings from other orgs to Liberty
INSERT INTO settings (organization_id, key, value)
SELECT 'liberty-org', key, value
FROM settings
WHERE organization_id IS NOT NULL
  AND organization_id != 'liberty-org'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 11. Seed RBAC permissions for Liberty
-- ============================================================

DO $$
DECLARE
  role_name TEXT;
  feature_name TEXT;
  is_enabled BOOLEAN;
BEGIN
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
      VALUES ('liberty-org', role_name, feature_name, is_enabled)
      ON CONFLICT (organization_id, role, feature) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 12. Update the admin user's email if it's still a placeholder
-- ============================================================

UPDATE users
SET email = username || '@liberty.local'
WHERE email = username || '@placeholder.local'
   OR email = username;

COMMIT;

-- ============================================================
-- Summary
-- ============================================================
SELECT
  u.username,
  u.email,
  u.role   AS global_role,
  om.role  AS org_role,
  o.name   AS organization
FROM users u
JOIN organization_members om ON om.user_id = u.id
JOIN organizations o ON o.id = om.organization_id
WHERE u.deleted_at IS NULL
  AND o.id = 'liberty-org'
ORDER BY om.role;
