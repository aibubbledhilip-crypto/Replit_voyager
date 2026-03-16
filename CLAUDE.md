# Voyager — Full Architectural & Functional Documentation

## Overview

Voyager is a **secure multi-tenant SaaS platform** for querying databases (primarily AWS Athena, plus PostgreSQL, MySQL, MSSQL, ClickHouse, Snowflake). It provides governed data access, SFTP file monitoring, file comparison utilities, AI-assisted analysis, chart dashboards, and subscription billing — all with strict per-organization data isolation and fine-grained role-based access control.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI |
| Backend | Express.js, Node.js, TypeScript (ESM via tsx) |
| Database | PostgreSQL (via Drizzle ORM) |
| Authentication | Express Session + bcrypt + memorystore |
| Billing | Stripe (subscriptions, customer portal) |
| AWS | AWS SDK v3 (Athena + S3) |
| Email | Resend API |
| AI | OpenAI / Anthropic Claude / Google Gemini / Ollama |
| File parsing | xlsx, csv-parse |
| SFTP | ssh2 |

---

## Project Structure

```
voyager/
├── client/
│   └── src/
│       ├── App.tsx                    # Root router + auth context + permission gates
│       ├── components/
│       │   ├── app-sidebar.tsx        # Permission-aware sidebar nav
│       │   ├── Header.tsx             # Top header with user info + org switcher
│       │   ├── LoginPage.tsx          # Login form (email OR username)
│       │   ├── QueryBuilder.tsx       # SQL editor with autocomplete
│       │   ├── ResultsTable.tsx       # Query results display + CSV export
│       │   ├── UserManagementTable.tsx
│       │   ├── CreateUserDialog.tsx
│       │   ├── ResetPasswordDialog.tsx
│       │   ├── QueryLimitControl.tsx
│       │   ├── LinedTextarea.tsx
│       │   ├── StatsCard.tsx
│       │   └── UsageLogsTable.tsx
│       └── pages/
│           ├── QueryExecutionPage.tsx # Main Athena/DB query page
│           ├── ExplorerPage.tsx       # Schema/record explorer with configurable lookup
│           ├── FileComparisonPage.tsx # Upload and diff two CSV/XLSX files
│           ├── FileAggregatePage.tsx  # Combine/aggregate multiple files
│           ├── SftpMonitorPage.tsx    # SFTP file health dashboard
│           ├── ChartDashboardPage.tsx # Depiction: saved chart grid
│           ├── AdminDashboardPage.tsx # Admin stats overview
│           ├── UserManagementPage.tsx
│           ├── UsageLogsPage.tsx
│           ├── SftpConfigPage.tsx
│           ├── ExplorerConfigPage.tsx
│           ├── AIConfigPage.tsx
│           ├── AwsConfigPage.tsx
│           ├── DatabaseConnectionsPage.tsx
│           ├── RolePermissionsPage.tsx # RBAC toggle matrix
│           ├── BillingPage.tsx
│           ├── SuperAdminPage.tsx
│           ├── SignupPage.tsx
│           ├── VerifyEmailPage.tsx
│           └── VerifyEmailSentPage.tsx
├── server/
│   ├── index.ts                # Express app bootstrap, session config
│   ├── routes.ts               # All API routes (~3100 lines)
│   ├── storage.ts              # Drizzle DB layer — all CRUD operations
│   ├── db.ts                   # Drizzle client (neon-http adapter)
│   ├── encryption.ts           # AES-256-GCM credential encryption
│   ├── email.ts                # Resend email (verification, invitations)
│   ├── athena-helper.ts        # Paginated Athena query execution + S3 export
│   ├── database-drivers.ts     # Multi-DB drivers (PG, MySQL, MSSQL, ClickHouse, Snowflake)
│   ├── ai-service.ts           # OpenAI / Anthropic / Gemini / Ollama query analysis
│   ├── file-comparison-helper.ts
│   ├── file-aggregate-helper.ts
│   ├── sftp-helper.ts
│   ├── stripeService.ts
│   ├── stripeClient.ts
│   ├── csrf.ts
│   ├── vite.ts
│   └── webhookHandlers.ts      # Stripe webhook processing
├── shared/
│   └── schema.ts               # Drizzle schema + Zod insert schemas + RBAC constants
├── sql/
│   └── fresh-database-setup.sql  # Full schema DDL for fresh installs
└── server/scripts/
    └── setup-super-admin.ts    # CLI: npx tsx server/scripts/setup-super-admin.ts <email>
```

---

## Database Schema

All tables use `varchar` UUID primary keys via `gen_random_uuid()`.

### Core Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | varchar PK | UUID |
| username | text | Display only, not unique |
| email | text | Unique per non-deleted user (partial unique index) |
| password | text | bcrypt hash |
| role | text | `'admin'` or `'user'` (global platform role) |
| status | text | `'active'` or `'inactive'` |
| isSuperAdmin | boolean | Platform super-admin flag |
| emailVerified | boolean | Email verification status |
| lastActive | timestamp | Updated on each authenticated request |
| deletedAt | timestamp | Soft delete |

#### `organizations`
| Column | Type | Notes |
|--------|------|-------|
| id | varchar PK | UUID |
| name | text | Display name |
| slug | text | Unique, URL-safe (name + random hex) |
| status | text | `'active'`, `'suspended'` |
| stripeCustomerId | text | Stripe customer reference |
| stripeSubscriptionId | text | Cache only — source of truth is `organization_subscriptions` |

#### `organization_members`
Joins users to organizations. One user can belong to multiple organizations.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar PK | |
| organizationId | varchar FK | → organizations |
| userId | varchar FK | → users |
| role | text | `'owner'`, `'admin'`, `'member'`, `'viewer'` |
| createdAt | timestamp | |

#### `organization_role_permissions`
Per-org feature toggles per role. GUI-configurable by org admins.
| Column | Type | Notes |
|--------|------|-------|
| id | varchar PK | |
| organizationId | varchar FK | → organizations |
| role | text | owner / admin / member / viewer |
| feature | text | See RBAC features below |
| enabled | boolean | |
| updatedAt | timestamp | |

Unique index: `(organizationId, role, feature)`

#### `organization_invitations`
| Column | Type | Notes |
|--------|------|-------|
| token | text | 32-byte random hex |
| email | text | Invited email |
| role | text | Org role to assign on accept |
| expiresAt | timestamp | 7 days from creation |
| acceptedAt | timestamp | Null until accepted |

#### `subscription_plans`
Seeded plans: Free (10 queries/mo), Starter ($29, 100/mo), Professional ($99, 1000/mo), Enterprise (custom).

#### `organization_subscriptions`
One per organization (unique index). Links org → plan with Stripe billing state.

#### `query_logs`
Logs every query execution: userId, organizationId, connectionId, queryText, rowsReturned, executionTimeMs, status, source.

#### `saved_queries`
Per-org saved SQL snippets with name and optional connectionId.

#### `settings`
Key-value store scoped per organization. Unique index `(organization_id, key)`.
Used for: `max_rows_display`, `max_rows_export`, `explorer_*` config, `ai_*` config.

#### `organization_database_connections`
Named DB connections per org. Supports: `postgresql`, `mysql`, `mssql`, `clickhouse`, `snowflake`, `athena`.
Password stored encrypted via AES-256-GCM.

#### `organization_aws_configs`
Per-org AWS credentials (accessKeyId, secretAccessKey encrypted, region, s3OutputLocation, athenaDatabase, athenaWorkgroup).

#### `sftp_configs`
Per-org SFTP server configs. Supports password auth and RSA private key auth. Multiple directory paths per server. Credentials encrypted.

#### `dashboard_charts`
Saved Depiction charts: SQL query, connectionId, chartType (bar/line/area), xAxis, yAxis, organizationId (NOT NULL).

#### `organization_ai_configs`
Per-org AI provider config: provider (openai/anthropic/gemini/ollama), model, apiKey (encrypted), ollamaUrl.

#### `export_jobs`
Tracks background CSV export jobs.

#### `audit_logs`
Security audit trail: action, resourceType, resourceId, userId, organizationId, ipAddress, details.

---

## Authentication & Session

### Login Flow
`POST /api/auth/login`
- Accepts `email` field which can be an **email address OR username** (tries email lookup first, falls back to username lookup)
- Validates password with bcrypt
- Creates session: `{ userId, username, role, organizationId, isSuperAdmin }`
- Returns user object including `orgRole` and `permissions[]`

### Session Store
- In-memory `memorystore` (pruned every 24h)
- 7-day cookie expiry
- `httpOnly: true`, `sameSite: 'lax'`

### Registration Flow
`POST /api/auth/register`
- Creates user + organization (slug = name + 6-char hex)
- Seeds `organization_role_permissions` with defaults for the new org
- Creates `owner` membership
- Auto-login after registration (email verification temporarily disabled)

### Middleware Stack

```typescript
requireAuth          // Checks session.userId + organizationId
requireAdmin         // session.role === 'admin' (global role)
requireOrgAdmin      // org member role is 'owner' or 'admin'
requirePermission(feature)  // checks org_role_permissions for user's role
requireSuperAdmin    // session.isSuperAdmin === true
```

Super admins bypass all feature permission checks and can impersonate any org via `POST /api/super-admin/impersonate/:orgId`.

---

## RBAC System

### Roles (per organization member)
| Role | Description |
|------|-------------|
| `owner` | Org creator. All permissions always enabled. Cannot be demoted. |
| `admin` | Can manage users, configs, and permissions. All features on by default. |
| `member` | Standard user. Most features on; msisdn_lookup off by default. |
| `viewer` | Read-only. Only sftp_monitor on by default. |

### Features (gate-able)
| Feature Key | UI Location |
|-------------|-------------|
| `execute_queries` | Nexus Gateway → Executor |
| `explorer` | Nexus Gateway → Explorer |
| `depiction` | Watch Tower → Depiction |
| `file_compare` | Tools → File Comparison |
| `file_aggregate` | Tools → File Aggregate |
| `sftp_monitor` | Tools → SFTP Monitor |
| `msisdn_lookup` | Executor (MSISDN tab) |
| `export_data` | Query results CSV export |

### Default Permission Matrix
| Feature | owner | admin | member | viewer |
|---------|-------|-------|--------|--------|
| execute_queries | ✓ | ✓ | ✓ | ✗ |
| explorer | ✓ | ✓ | ✓ | ✗ |
| depiction | ✓ | ✓ | ✓ | ✗ |
| file_compare | ✓ | ✓ | ✓ | ✗ |
| file_aggregate | ✓ | ✓ | ✓ | ✗ |
| sftp_monitor | ✓ | ✓ | ✓ | ✓ |
| msisdn_lookup | ✓ | ✓ | ✗ | ✗ |
| export_data | ✓ | ✓ | ✓ | ✗ |

Permissions are configurable per-org via Admin → Configurations → Roles (`/admin/role-permissions`).

### Permission Resolution
`GET /api/auth/me` returns `permissions: string[]` — the list of enabled features for the current user in their current org. The frontend uses this to:
1. Filter sidebar nav items
2. Gate routes with `<PermissionGate feature="...">` wrappers
3. Hide/show UI elements (export buttons, MSISDN tab, etc.)

---

## API Routes Reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Login (email or username) |
| POST | `/api/auth/logout` | Auth | Clear session |
| GET | `/api/auth/me` | Auth | Current user + orgRole + permissions |
| POST | `/api/auth/register` | Public | Sign up + create org |
| POST | `/api/auth/switch-organization` | Auth | Switch active org context |
| GET | `/api/csrf-token` | Public | Get CSRF token |

### Users (Org-scoped)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | Admin | List org users (includes orgRole) |
| POST | `/api/users` | Admin | Create user in org |
| PATCH | `/api/users/:id/role` | Admin | Update global role (admin/user) |
| PATCH | `/api/users/:id/org-role` | OrgAdmin | Update org member role (admin/member/viewer) |
| PATCH | `/api/users/:id/status` | Admin | Activate/deactivate |
| PATCH | `/api/users/:id/password` | Admin | Reset password |

### RBAC Permissions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/permissions/my-permissions` | Auth | Current user's features + orgRole |
| GET | `/api/admin/role-permissions` | OrgAdmin | Full org permission matrix |
| PUT | `/api/admin/role-permissions` | OrgAdmin | Toggle role+feature permission |

### Queries
| Method | Path | Auth | Permission | Description |
|--------|------|------|-----------|-------------|
| POST | `/api/query/execute` | Auth | execute_queries | Run SQL query |
| POST | `/api/query/msisdn-lookup` | Auth | msisdn_lookup | MSISDN lookup |
| GET | `/api/query/schema` | Auth | — | List Athena tables/views |
| GET | `/api/query/schema/:tableName/columns` | Auth | — | Table columns |
| GET | `/api/query/athena-databases` | Auth | — | List Athena databases |
| GET | `/api/saved-queries` | Auth | — | List saved queries |
| POST | `/api/saved-queries` | Auth | — | Save a query |
| DELETE | `/api/saved-queries/:id` | Auth | — | Delete saved query |

### Database Connections
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/db-connections` | Auth | List org DB connections |
| POST | `/api/db-connections` | OrgAdmin | Create connection |
| PUT | `/api/db-connections/:id` | OrgAdmin | Update connection |
| DELETE | `/api/db-connections/:id` | OrgAdmin | Delete connection |
| POST | `/api/db-connections/:id/test` | OrgAdmin | Test connection |
| POST | `/api/db-connections/:id/set-default` | OrgAdmin | Set as default |
| GET | `/api/db-connections/types` | Auth | Supported DB types |

### File Operations
| Method | Path | Auth | Permission | Description |
|--------|------|------|-----------|-------------|
| POST | `/api/compare/execute` | Auth | file_compare | Compare two files |
| GET | `/api/compare/download/:filename` | Auth | — | Download comparison result |
| POST | `/api/aggregate/execute` | Auth | file_aggregate | Aggregate multiple files |
| GET | `/api/aggregate/download/:filename` | Auth | — | Download aggregate result |

### SFTP
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sftp/configs` | OrgAdmin | List SFTP configs |
| POST | `/api/sftp/configs` | OrgAdmin | Create SFTP config |
| PUT | `/api/sftp/configs/:id` | OrgAdmin | Update SFTP config |
| DELETE | `/api/sftp/configs/:id` | OrgAdmin | Delete SFTP config |
| GET | `/api/sftp/monitor` | Auth (sftp_monitor) | Live health for all configs |
| GET | `/api/sftp/monitor/:id` | Auth (sftp_monitor) | Health for single config |
| POST | `/api/sftp/test` | OrgAdmin | Test SFTP connection |

### Depiction (Charts)
| Method | Path | Auth | Permission | Description |
|--------|------|------|-----------|-------------|
| GET | `/api/dashboard/charts` | Auth | depiction | List saved charts |
| POST | `/api/dashboard/charts` | Auth | depiction | Save chart |
| PUT | `/api/dashboard/charts/:id` | Auth | depiction | Update chart |
| DELETE | `/api/dashboard/charts/:id` | Auth | depiction | Delete chart |
| POST | `/api/dashboard/execute` | Auth | depiction | Execute chart SQL |

### Admin Configuration
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings` | OrgAdmin | Get all org settings |
| PUT | `/api/settings` | OrgAdmin | Update setting |
| GET | `/api/aws-config` | OrgAdmin | Get AWS config |
| PUT | `/api/aws-config` | OrgAdmin | Update AWS config |
| POST | `/api/aws-config/test` | OrgAdmin | Test Athena connectivity |
| POST | `/api/ai/analyze` | Auth | AI analysis of query results |

### Organizations & Billing
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/organizations` | Auth | List user's orgs |
| GET | `/api/organizations/:id` | Auth | Org details |
| GET | `/api/organizations/:id/members` | Auth | Org members |
| GET | `/api/organizations/:id/subscription` | Auth | Subscription status |
| POST | `/api/organizations/:id/invitations` | OrgAdmin | Send invite |
| POST | `/api/invitations/:token/accept` | Public | Accept invite |
| GET | `/api/logs` | Admin | Usage logs |
| GET | `/api/subscription-plans` | Auth | All plans |
| POST | `/api/stripe/checkout` | Auth | Stripe checkout session |
| POST | `/api/stripe/portal` | Auth | Stripe billing portal |

### Super Admin (Platform-level)
All routes require `isSuperAdmin === true`.
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/super-admin/stats` | Platform statistics |
| GET | `/api/super-admin/organizations` | All organizations |
| GET | `/api/super-admin/organizations/:id` | Org detail |
| DELETE | `/api/super-admin/organizations/:id` | Delete org |
| GET | `/api/super-admin/users` | All platform users |
| DELETE | `/api/super-admin/users/:id` | Delete user |
| POST | `/api/super-admin/users/:id/reset-password` | Force reset password |
| PATCH | `/api/super-admin/users/:id/super-admin` | Grant/revoke super admin |
| POST | `/api/super-admin/impersonate/:orgId` | Impersonate org |
| POST | `/api/super-admin/stop-impersonation` | End impersonation |

---

## Frontend Architecture

### Authentication Context (`App.tsx`)
```typescript
interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  orgRole?: 'owner' | 'admin' | 'member' | 'viewer' | null;
  isSuperAdmin?: boolean;
  permissions?: string[];  // list of enabled RBAC features
}
```

`useQuery({ queryKey: ['/api/auth/me'] })` drives all auth state. On 401 the user sees the login page.

### Permission Helpers
```typescript
// Check a feature permission
hasPermission(user, 'execute_queries')  // true if isSuperAdmin OR permissions includes feature

// Check admin access
isOrgAdmin(user)  // true if isSuperAdmin OR orgRole is 'owner'/'admin'
```

### Route Guards
```tsx
<PermissionGate feature="execute_queries"><QueryExecutionPage /></PermissionGate>
<AdminGate><AdminDashboardPage /></AdminGate>
```

Both redirect to `/` on failure. `PermissionGate` checks `hasPermission()`. `AdminGate` checks `isOrgAdmin()`.

### Sidebar Navigation
`AppSidebar` receives `{ permissions, orgRole, isSuperAdmin }` and filters sections:
- **Nexus Gateway**: Executor (execute_queries), Explorer (explorer)
- **Watch Tower**: Depiction (depiction)
- **Tools**: File Comparison (file_compare), File Aggregate (file_aggregate), SFTP Monitor (sftp_monitor)
- **Administration**: Shown only to owner/admin — Dashboard, Users, Configurations (Databases/AWS/Explorer/AI/SFTP/Roles), Usage Logs, Billing
- **Platform**: Shown only to super admins — Super Admin panel

---

## Key Feature Details

### Query Executor (`/`)
- SQL editor with keyword + table + column autocomplete
- Selectable connection: any named DB connection or Athena
- Configurable row limits (display and export) per org settings
- Results displayed in paginated table with column sorting
- CSV export (gated by `export_data` permission)
- MSISDN Lookup tab (gated by `msisdn_lookup` permission)
- Saved queries (load/save panel)
- AI analysis of results (uses org's AI config)

### Schema Explorer (`/explorer`)
- Configurable lookup field: label, placeholder, validation mode (`digits_only` / `alphanumeric` / `any`)
- Searches across five data sources (configurable)
- Full-text schema browsing of tables and columns

### Depiction (`/depiction`)
- Write SQL, preview results, pick X/Y axes, choose chart type (bar/line/area)
- Saved charts auto-execute and render in a responsive dashboard grid
- Supports any named DB connection or Athena

### File Comparison (`/file-comparison`)
- Upload two CSV or XLSX files
- Flexible column mapping between files
- Generates XLSX output with multiple sheets: unique to file A, unique to file B, matched rows

### File Aggregate (`/file-aggregate`)
- Upload multiple CSV/XLSX files
- Combine and aggregate data across all files
- Downloadable result

### SFTP Monitor (`/sftp-monitor`)
- Real-time health status for all configured SFTP servers
- Health determined by: file modification time OR date pattern embedded in filename
- If filename contains a date pattern, only that date is used (mtime fallback disabled for date-pattern filenames)
- Supports password auth and RSA private key auth

### Credential Encryption (`server/encryption.ts`)
- AES-256-GCM, 256-bit key
- Encrypts: DB connection passwords, SFTP passwords/keys, AWS secret keys, AI API keys
- Format: `enc:<iv_hex>:<tag_hex>:<data_hex>`
- Backward-compatible: unencrypted legacy values pass through transparently
- Requires `ENCRYPTION_KEY` env var (64 hex chars = 32 bytes)

---

## Multi-Tenancy Rules

1. **All data reads/writes must be scoped to `session.organizationId`**
2. No fallbacks that leak data across orgs
3. `getUsersByOrganization(orgId)` — always filters by org membership
4. Super admins can read across all orgs (explicitly allowed)
5. When impersonating, `session.organizationId` is overwritten with the target org

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | Express session signing key |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ENCRYPTION_KEY` | Yes | 64-char hex — AES-256-GCM key for credential encryption |
| `STRIPE_SECRET_KEY` | Stripe | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Stripe webhook signature verification |
| `RESEND_API_KEY` | Email | Resend API key for verification emails |

AWS credentials are configured per-organization via the GUI (Admin → Configurations → AWS), not via environment variables.

---

## Subscription Tiers

| Plan | Price | Queries/mo | Max Users | Display Rows | Export Rows |
|------|-------|-----------|-----------|-------------|------------|
| Free | $0 | 10 | 2 | 100 | 500 |
| Starter | $29/mo | 100 | 5 | 1,000 | 10,000 |
| Professional | $99/mo | 1,000 | 20 | 5,000 | 100,000 |
| Enterprise | Custom | Unlimited | Unlimited | Custom | Custom |

---

## Super Admin Setup

```bash
npx tsx server/scripts/setup-super-admin.ts <email>
```

Grants `isSuperAdmin = true` to the user with the given email.

---

## Development Notes

### Schema Changes
- Always update `sql/fresh-database-setup.sql` alongside any schema changes
- Use raw `psql $DATABASE_URL` for migrations — `db:push` hangs on interactive TTY
- Never change primary key column types (serial ↔ varchar breaks existing data)

### Email Verification
- Currently **disabled** in code (commented out)
- Re-enable by uncommenting blocks in: `server/routes.ts` (login, register, admin user creation) and `client/src/pages/SignupPage.tsx`
- Requires `prodapt.com` verified in Resend dashboard, `FROM_EMAIL = onboarding-voyager@prodapt.com`

### CSRF
- Token generated per session, sent via `GET /api/csrf-token`
- Verification middleware is currently **disabled** (commented out in routes.ts) for debugging
- Re-enable by uncommenting `app.use('/api', verifyCsrfToken)`

### Login
- Field accepts email address OR username
- Server tries email lookup first, then falls back to username lookup
- Existing `admin` / `admin123` credentials continue to work

### Default Admin Account
Username: `admin`, Password: `admin123` (configured in this environment)
