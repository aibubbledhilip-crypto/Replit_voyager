# Voyager - AWS Athena Query Platform

## Overview
Voyager is a secure enterprise web application for querying AWS Athena databases with role-based access control, usage logging, and admin-controlled query limits.

## Recent Changes
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
5. **Query Row Limits**: Admin-configurable limits for data extraction
6. **Usage Logging**: Comprehensive logging of all query executions
7. **User Management**: Admin interface to create users, assign roles, and manage status

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
4. View usage logs to monitor all query executions
5. Execute queries in Query Execution page

### Regular User Workflow
1. Login with assigned credentials
2. Use MSISDN Lookup to search for phone numbers across multiple data sources
3. Execute SQL queries against Athena database
4. View and download query results
5. View personal query history

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

## Future Enhancements
- Query history and saved queries per user
- Query templates and favorites
- Data visualization for query results
- Query scheduling for recurring extractions
- Enhanced audit logging with query performance metrics
- Email notifications for query completion
- Export query results in multiple formats (CSV, JSON, Excel)
