# Voyager - AWS Athena Query Platform (Multi-Tenant SaaS)

## Overview
Voyager is a secure multi-tenant SaaS platform designed for querying AWS Athena databases. It incorporates robust role-based access control, organization-scoped data isolation, Stripe subscription billing, and administrator-controlled query limits. The platform aims to provide a reliable and governed interface for data exploration and extraction within an enterprise environment.

## User Preferences
The user wants me to act as a coding agent.
- I want iterative development.
- I want to be asked before making major changes.
- When introducing database schema changes, always update `sql/fresh-database-setup.sql` with the corresponding SQL statements.

## Recent Changes (April 2026)
- **API Keys** (`/settings/api-keys`): Users can generate personal access tokens (format: `vgr_<48 hex chars>`) scoped to `execute_queries` and/or `explorer`. Keys are SHA-256 hashed in the DB (never stored raw). Shown once on creation. Backed by `api_keys` table.
- **Public API v1 endpoints**: `POST /api/v1/execute` (SQL query) and `POST /api/v1/explorer/lookup` both accept `Authorization: Bearer vgr_...` or session cookie. Scope-gated + RBAC permission-checked.
- `resolveApiKeyAuth` middleware injects userId/organizationId into session from API key, letting existing `requireAuth`/`requirePermission` work transparently.
- Sidebar: new "Settings > API Keys" link visible to all authenticated users.

## Previous Changes (March 2026)
- **Credential encryption**: `server/encryption.ts` — AES-256-GCM encryption for DB connection passwords, SFTP credentials, AWS secret keys, and AI API keys. Backward-compatible (gracefully reads unencrypted legacy values). `ENCRYPTION_KEY` env var required (set as shared env var).
- **Login switched to email**: `POST /api/auth/login` accepts `email` instead of `username`; `LoginPage.tsx` updated.
- **Schema hardening**: Unique indexes on `settings(organization_id, key)` and `organization_subscriptions(organization_id)`; `dashboard_charts.organization_id` made NOT NULL with FK enforced; `connection_id` FK added to `query_logs` and `saved_queries`; `users_email_unique` is now a partial unique index (allows same email for soft-deleted users); `users_username_unique` constraint dropped (username is display-only).
- **Performance indexes**: Added `idx_*` indexes across all FK columns (organization_members, invitations, query_logs, settings, export_jobs, sftp_configs, saved_queries, dashboard_charts, audit_logs).
- **N+1 queries fixed**: `getUsersByOrganization` and `getUserOrganizations` now use single JOIN queries.
- **`sql/fresh-database-setup.sql`**: Updated to reflect full current schema including all new constraints, indexes, and columns.
- **Depiction** (`/depiction`): New chart visualization feature — write SQL, preview results, configure X/Y axes, and save bar/line/area charts. Charts auto-execute on the dashboard grid. Backed by `dashboard_charts` table; supports any named DB connection or Athena.
- Explorer lookup field made fully configurable: label, placeholder, and validation mode (`digits_only`/`alphanumeric`/`any`) via Admin > Explorer Config
- SFTP health: if filename contains a date pattern, only that date is used for health status (mtime fallback removed for date-pattern filenames)
- File input alignment fixed in File Comparison and File Aggregate pages

## Previous Changes (February 2026)
- **AWS Configuration GUI**: AWS credentials and Athena connection settings are now configurable per-organization through Admin > Configurations > AWS instead of environment variables
- All Athena query routes now use per-org AWS config from the database via `getOrgAthenaClient()` helper
- Added connection test endpoint to verify AWS Athena connectivity
- All hardcoded database/table defaults removed - configuration is fully GUI-driven

## Previous Changes (January 2026)
- Transformed from single-tenant to multi-tenant SaaS architecture
- Added self-service signup with automatic organization creation
- Integrated Stripe for subscription billing with four tiers (Free, Starter, Professional, Enterprise)
- All tenant data is now organization-scoped with proper isolation
- Fixed React redirect logic using useEffect instead of render-time setLocation
- Security: bcrypt password hashing on registration, SFTP ownership verification
- **Super Admin Implementation**: Platform-level administrators can view all organizations/users, impersonate organizations for support, and manage super admin status
- **Security Hardening**: Mandatory organization ownership checks on all tenant-scoped routes, comprehensive audit logging for login attempts, user management, SFTP config changes, and super admin impersonation

## System Architecture

### Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: PostgreSQL
- **Authentication**: Express Session with bcrypt
- **Billing**: Stripe subscription management
- **AWS Integration**: AWS SDK v3 for Athena

### Multi-Tenancy Design
- **Organizations**: Each tenant is an organization with unique slug (name + random hex)
- **Organization Members**: Users belong to organizations with roles (owner, admin, member)
- **Data Isolation**: All tenant-scoped tables include organizationId foreign key
- **Legacy Support**: Default organization 'default-org' for migrated data
- **Subscription Tiers**: Free (10 queries/mo), Starter ($29, 100 queries/mo), Professional ($99, 1000 queries/mo), Enterprise (custom)

### UI/UX Decisions
The application uses React, TypeScript, Tailwind CSS, and Shadcn UI for a modern and responsive user interface. Key UI enhancements include a full-width query execution page for better workspace, a schema browser sidebar for table/view navigation, and interactive interfaces for features like file comparison and SFTP monitoring.

### Technical Implementations & Feature Specifications
1.  **User Authentication & Authorization**: Secure username/password authentication with bcrypt hashing and role-based access control (Admin, User).
2.  **AWS Athena Querying**: Allows execution of SQL queries against AWS Athena databases. Includes SQL autocomplete with keyword, table, and column suggestions.
3.  **Query Result Handling**: Configurable display and export limits for query results, with separate settings for rows shown in the UI and rows allowed in CSV exports. Users can save and load frequently-used queries.
4.  **MSISDN Lookup**: A feature to search phone numbers across five data sources (SF, Aria, Matrix, Trufinder, Nokia).
5.  **File Comparison**: Users can upload and compare two CSV/XLSX files. It supports flexible column mapping between files, generates downloadable reports for unique rows and matching keys, and outputs results into a single XLSX file with multiple sheets.
6.  **SFTP File Monitoring**: Monitors SFTP servers for file freshness across multiple directories. Supports password and RSA key authentication, allows multiple paths per server, and displays real-time status based on file modification dates or date patterns in filenames.
7.  **Usage Logging**: Comprehensive logging of all query executions, including user, query text, rows returned, execution time, and status.
8.  **User Management**: Admin interface for creating users, assigning roles, managing user status, and configuring query row limits.
9.  **Security**: Implements bcrypt for password hashing, HTTP-only and secure sessions, environment variable storage for AWS credentials, API-level role-based access control, input validation (e.g., for MSISDN), and temporary file cleanup. CSRF protection is used with synchronizer tokens. **Tenant isolation** enforces mandatory organization context checks on all routes - no fallbacks that could leak data between tenants. **Audit logging** tracks all security-sensitive operations including login success/failure, user management, SFTP config changes, and super admin impersonation.
10. **Super Admin**: Platform-level administration with ability to view all organizations, all users, manage super admin status, impersonate organizations for support (with visual indicator), and platform statistics dashboard. Setup script: `npx tsx server/scripts/setup-super-admin.ts <email>`.

### System Design Choices
-   The system is designed for enterprise use with a focus on security, scalability, and auditability.
-   Server-side schema caching is implemented for Athena to minimize API calls.
-   Robust error handling with retry mechanisms is in place for external API interactions.
-   The application is deployed on AWS Lightsail with PostgreSQL as the database and uses Apache as a reverse proxy.
-   Express body limits and Athena query polling timeouts are configured to handle large or long-running queries.

## External Dependencies
-   **AWS SDK v3**: For interacting with AWS Athena and S3.
-   **PostgreSQL**: Primary database for storing application data (users, query logs, settings).
-   **SFTP Servers**: External SFTP servers for the file monitoring feature.
-   **Third-party Data Sources**: Specific external services for MSISDN Lookup (SF, Aria, Matrix, Trufinder, Nokia).