# Voyager - AWS Athena Query Platform

## Overview
Voyager is a secure enterprise web application designed for querying AWS Athena databases. It incorporates robust role-based access control, comprehensive usage logging, and administrator-controlled query limits. The platform aims to provide a reliable and governed interface for data exploration and extraction within an enterprise environment.

## User Preferences
The user wants me to act as a coding agent.
- I want iterative development.
- I want to be asked before making major changes.

## System Architecture

### Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: PostgreSQL
- **Authentication**: Express Session with bcrypt
- **AWS Integration**: AWS SDK v3 for Athena

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
9.  **Security**: Implements bcrypt for password hashing, HTTP-only and secure sessions, environment variable storage for AWS credentials, API-level role-based access control, input validation (e.g., for MSISDN), and temporary file cleanup. CSRF protection is used with synchronizer tokens.

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