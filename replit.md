# Voyager - AWS Athena Query Platform

## Overview
Voyager is a secure enterprise web application for querying AWS Athena databases with role-based access control, usage logging, and admin-controlled query limits.

## Recent Changes
- **2025-12-07**:
  - **Session and Cookie Configuration Fix for Apache Reverse Proxy**:
    - Fixed slow login issue on Lightsail by optimizing database connection pool
    - Updated session configuration: `resave: true`, `saveUninitialized: true`, `secure: false`
    - Added `proxy: true` to session config for reverse proxy compatibility
    - **Note**: CSRF protection temporarily disabled due to cookie forwarding issues with Apache
    - Future improvement: Configure Apache to properly forward cookies for CSRF re-enablement
- **2025-11-08**: 
  - **Enhanced File Comparison Feature with Flexible Column Mapping and Separate Reports**:
    - Upload and compare two CSV/XLSX files to identify unique rows and matching key rows
    - **NEW: Flexible column mapping** - Map columns with different names between files (e.g., "customer_id" in File 1 → "id" in File 2)
    - **NEW: Separate downloadable reports** - Each comparison category gets its own CSV file:
      - Summary report (comparison statistics and metadata)
      - Only in File 1 (rows unique to first file)
      - Only in File 2 (rows unique to second file)
      - Matching Keys (rows with matching keys showing complete side-by-side data from both files with File1_ and File2_ column prefixes)
    - Interactive mapping interface with add/remove rows and dual dropdowns for each mapping
    - Client-side XLSX parsing for instant column extraction
    - Enhanced file upload button styling with primary color for better visibility
    - Proper CSRF token handling for secure file uploads
    - Comparison logic respects column mappings for row matching
    - Automatically compares unmapped columns that have identical names in both files
    - Download buttons conditionally shown only for categories with data
    - End-to-end tested with CSV files using different column names
  - Successfully deployed to AWS Lightsail with self-hosted PostgreSQL
  - Fixed database driver compatibility (Neon serverless → node-postgres for local PostgreSQL)
  - Configured Apache reverse proxy with 10-minute timeout for long-running queries
  - Fixed PM2 ecosystem configuration to properly load environment variables
  - Verified large/complex queries execute successfully (110+ seconds)
  - **Important:** Corporate proxies (e.g., McAfee Web Gateway) may timeout before long queries complete - access from personal network recommended
- **2025-11-07**: 
  - Added MSISDN Lookup feature for multi-source phone number queries
  - Increased Express body limit to 10MB to handle large/complex SQL queries
  - Added 5-minute timeout to Athena query polling to prevent browser connection timeouts
  - Fixed AWS Athena MaxResults bug (capped at 1000 instead of configured limit)
- **2025-01-07**: Initial implementation with full authentication, AWS Athena integration, and admin dashboard
  - Database schema created with users, query logs, and settings tables
  - Implemented username/password authentication with bcrypt
  - Integrated AWS SDK for Athena query execution
  - Added usage logging for all query executions
  - Created admin dashboard with user management and statistics

## Project Architecture

### Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: PostgreSQL (Neon)
- **Authentication**: Express Session with bcrypt password hashing
- **AWS Integration**: AWS SDK v3 for Athena

### Key Features
1. **User Authentication**: Username/password authentication with secure session management
2. **Role-Based Access Control**: Admin and regular user roles with different permissions
3. **AWS Athena Integration**: Execute SQL queries against AWS Athena database
4. **MSISDN Lookup**: Multi-source phone number search across 5 data sources (SF, Aria, Matrix, Trufinder, Nokia)
5. **File Comparison**: Upload and compare two CSV/XLSX files to identify unique rows and matching key rows with downloadable reports
6. **SFTP File Monitoring**: Monitor SFTP servers for file freshness across multiple directories
   - Admin can configure SFTP servers (host, username, password/RSA key)
   - **Multiple paths per server**: Each server can monitor multiple directories
   - **Supports two authentication types**:
     - Password authentication
     - RSA key authentication (upload .pem file directly from local machine)
   - **Credential preservation**: Existing credentials are retained when editing configs without re-entering them
   - Real-time monitoring with green/red status indicators
   - **Files marked green if either**:
     - Filename contains today's date (formats: YYYYMMDD, YYYY-MM-DD, YYYY_MM_DD)
     - File was last modified today
   - Files marked red if neither condition is met
   - Per-path status display with collapsible file listings
   - Auto-refresh option for continuous monitoring
7. **Query Row Limits**: Admin-configurable limits for data extraction
8. **Usage Logging**: Comprehensive logging of all query executions
9. **User Management**: Admin interface to create users, assign roles, and manage status

## Setup Instructions

### Environment Variables
The following environment variables are required:

```env
# Database (automatically configured by Replit)
DATABASE_URL=<your_postgres_url>

# Session Secret (automatically configured)
SESSION_SECRET=<your_secret>

# AWS Athena Configuration (you need to set these)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your_aws_access_key>
AWS_SECRET_ACCESS_KEY=<your_aws_secret_key>
AWS_S3_OUTPUT_LOCATION=s3://dvsum-staging-prod
```

### Initial Setup
1. The database schema is automatically created when you run the application
2. Run the seed script to create the initial admin user:
   ```bash
   tsx server/scripts/seed.ts
   ```
3. Default admin credentials:
   - Username: `admin`
   - Password: `admin123`
   - **IMPORTANT**: Change the admin password after first login

### AWS Configuration
1. Obtain AWS credentials with Athena query permissions
2. Add the credentials to your Replit Secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
3. Verify the S3 output location matches your setup

## User Workflows

### Admin Workflow
1. Login with admin credentials
2. Navigate to Admin Dashboard to:
   - View system statistics (total queries, active users, avg query time, data extracted)
   - Create new users with "Create User" button
   - Manage user roles and status
   - Configure query row limits
3. Use MSISDN Lookup to search phone numbers across all data sources
4. Use File Comparison to compare two data files and identify differences
5. View usage logs to monitor all query executions
6. Execute queries in Query Execution page

### Regular User Workflow
1. Login with assigned credentials
2. Use MSISDN Lookup to search for phone numbers across multiple data sources
3. Use File Comparison to reconcile and compare data files
4. Execute SQL queries against Athena database
5. View and download query results
6. View personal query history

### File Comparison Workflow
1. Navigate to File Comparison page
2. Upload two files (CSV or XLSX format):
   - File 1: Base file for comparison
   - File 2: Target file to compare against
3. **Map key columns** for row matching:
   - Click "Add Column Mapping" to create a new mapping row
   - Select a column from File 1 (e.g., "customer_id")
   - Select the corresponding column from File 2 (e.g., "id")
   - **Columns can have different names** - the mapping tells the system which columns to match
   - Add multiple mappings to create composite keys
   - Remove mappings using the X button
4. Click "Compare Files" to start the comparison
5. Review the comparison results:
   - **Only in File 1**: Rows that exist only in the first file (based on mapped key columns)
   - **Only in File 2**: Rows that exist only in the second file (based on mapped key columns)
   - **Matching Keys**: Rows where the key columns match in both files (showing complete side-by-side data from both files)
6. **Download separate reports** for each category:
   - **Summary Report**: Comparison statistics, column mappings, and metadata
   - **Only in File 1**: CSV containing only rows found in the first file
   - **Only in File 2**: CSV containing only rows found in the second file
   - **Matching Keys**: CSV showing complete data from both files with File1_ and File2_ column prefixes
   - Download buttons only appear for categories with data
   - Each button shows the number of rows in that category

**Note on Column Comparison**:
- **Mapped columns**: Compared using their respective names as defined in the mappings
- **Unmapped columns**: Only compared if they have **identical names** in both files
- Example: If File 1 has "name" and File 2 has "customer_name", these will NOT be compared unless you create a mapping "name→customer_name"

## Database Schema

### Users Table
- `id`: UUID primary key
- `username`: Unique username
- `password`: Bcrypt hashed password
- `role`: 'admin' or 'user'
- `status`: 'active' or 'inactive'
- `createdAt`: Timestamp
- `lastActive`: Last login timestamp

### Query Logs Table
- `id`: UUID primary key
- `userId`: Foreign key to users
- `username`: Username for quick reference
- `query`: Full SQL query text
- `rowsReturned`: Number of rows returned
- `executionTime`: Query execution time in ms
- `status`: 'success' or 'error'
- `createdAt`: Timestamp

### Settings Table
- `id`: UUID primary key
- `key`: Setting key (unique)
- `value`: Setting value
- `updatedAt`: Last update timestamp

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout current session
- `GET /api/auth/me` - Get current user info

### User Management (Admin Only)
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PATCH /api/users/:id/role` - Update user role
- `PATCH /api/users/:id/status` - Update user status

### Query Execution
- `POST /api/query/execute` - Execute Athena query
- `POST /api/query/msisdn-lookup` - Execute multi-source MSISDN lookup

### File Comparison
- `POST /api/compare/execute` - Upload and compare two files (multipart/form-data)
  - Accepts: `file1`, `file2` (files), `columnMappings` (JSON array of {file1Column, file2Column})
  - Returns: comparison summary and downloadable CSV filename
- `GET /api/compare/download/:filename` - Download comparison result CSV

### Usage Logs
- `GET /api/logs` - Get query logs (admin: all logs, user: own logs)

### Settings (Admin Only)
- `GET /api/settings/:key` - Get setting by key
- `PUT /api/settings` - Update or create setting

## Security Considerations
1. Passwords are hashed using bcrypt with 10 salt rounds
2. Sessions are HTTP-only and secure in production
3. AWS credentials are stored in environment variables
4. Role-based access control enforced at API level
5. Query row limits prevent excessive data extraction
6. MSISDN input validation prevents SQL injection (digits-only with whitespace trimming)
7. CSRF protection with synchronizer tokens on all state-changing requests
8. File upload restrictions: Only CSV and XLSX files allowed, 50MB size limit
9. File path traversal protection: All file operations use sanitized basenames
10. Automatic cleanup of temporary files: Uploaded files and comparison results older than 24 hours are auto-deleted

## Future Enhancements
- Query history and saved queries per user
- Query templates and favorites
- Data visualization for query results
- Query scheduling for recurring extractions
- Enhanced audit logging with query performance metrics
- Email notifications for query completion
- Export query results in multiple formats (CSV, JSON, Excel, Parquet)
- Advanced file comparison: 
  - Support for custom comparison rules
  - Ignore specific columns option
  - Fuzzy matching for approximate comparisons
  - Case-insensitive comparison option
  - Trim whitespace option
- Bulk file comparison: Compare multiple file pairs in a batch operation
- File comparison templates: Save and reuse column mapping configurations
