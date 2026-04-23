-- ============================================================
-- Liberty Organization Setup — Lightsail Production
-- Tailored to the actual DB state:
--   - 16 users, all with @placeholder.local emails
--   - Only default-org-id exists, zero memberships
--   - No AWS configs or DB connections yet
--   - 5 SFTP configs with NULL organization_id
--   - Saved queries with NULL organization_id
-- Safe to re-run — fully idempotent.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Fix the malformed email for the username that is an
--    email address (Venkatesh.Banginwar@dvsum.com)
-- ============================================================

UPDATE users
SET email = username
WHERE username LIKE '%@%'
  AND email = username || '@placeholder.local';

-- ============================================================
-- 2. Create Liberty organization
-- ============================================================

INSERT INTO organizations (id, name, slug, status)
VALUES ('liberty-org', 'Liberty', 'liberty', 'active')
ON CONFLICT DO NOTHING;

-- Assign the free plan subscription
INSERT INTO organization_subscriptions (organization_id, plan_id, status)
SELECT 'liberty-org', id, 'active'
FROM subscription_plans WHERE slug = 'free'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Add ALL active users to Liberty
--    admin (username='admin') → owner
--    users with global role='admin'  → admin
--    everyone else                   → member
-- ============================================================

INSERT INTO organization_members (organization_id, user_id, role)
SELECT
  'liberty-org',
  u.id,
  CASE
    WHEN u.username = 'admin' THEN 'owner'
    WHEN u.role = 'admin'     THEN 'admin'
    ELSE                           'member'
  END
FROM users u
WHERE u.deleted_at IS NULL
ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = EXCLUDED.role;

-- ============================================================
-- 4. Migrate SFTP configs to Liberty
-- ============================================================

UPDATE sftp_configs
SET organization_id = 'liberty-org'
WHERE organization_id IS NULL OR organization_id = 'default-org-id';

-- ============================================================
-- 5. Migrate saved queries to Liberty
-- ============================================================

UPDATE saved_queries
SET organization_id = 'liberty-org'
WHERE organization_id IS NULL OR organization_id = 'default-org-id';

-- ============================================================
-- 6. Migrate query logs to Liberty
-- ============================================================

UPDATE query_logs
SET organization_id = 'liberty-org'
WHERE organization_id IS NULL OR organization_id = 'default-org-id';

-- ============================================================
-- 7. Migrate dashboard charts to Liberty
-- ============================================================

UPDATE dashboard_charts
SET organization_id = 'liberty-org'
WHERE organization_id IS NULL OR organization_id != 'liberty-org';

-- ============================================================
-- 8. Migrate export jobs to Liberty
-- ============================================================

UPDATE export_jobs
SET organization_id = 'liberty-org'
WHERE organization_id IS NULL OR organization_id = 'default-org-id';

-- ============================================================
-- 8. Migrate settings to Liberty
--    (copy global/default-org settings into Liberty scope)
-- ============================================================

INSERT INTO settings (organization_id, key, value)
SELECT 'liberty-org', key, value
FROM settings
WHERE organization_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO settings (organization_id, key, value)
SELECT 'liberty-org', key, value
FROM settings
WHERE organization_id = 'default-org-id'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. Seed RBAC permissions for Liberty
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

COMMIT;

-- ============================================================
-- Final summary — shows all users now in Liberty
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
ORDER BY om.role, u.username;
