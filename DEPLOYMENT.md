# Voyager - AWS Lightsail Deployment Guide

## Prerequisites
- AWS Account with Lightsail access
- Domain name (optional, but recommended)
- AWS Athena credentials (Access Key ID and Secret Access Key)

## Step 1: Create Lightsail Instance

1. Go to AWS Lightsail Console
2. Click "Create instance"
3. Select:
   - **Platform**: Linux/Unix
   - **Blueprint**: OS Only → Ubuntu 22.04 LTS
   - **Instance Plan**: At least 2GB RAM (recommended: 4GB for production)
4. Name your instance (e.g., `voyager-app`)
5. Click "Create instance"

## Step 2: Configure Networking

1. In your Lightsail instance, go to "Networking" tab
2. Add the following firewall rules:
   - **HTTP**: TCP, Port 80
   - **HTTPS**: TCP, Port 443 (if using SSL)
   - **Custom**: TCP, Port 5000 (for Node.js - optional, only for testing)
3. Attach a static IP to your instance

## Step 3: Connect to Instance

```bash
# Download the SSH key from Lightsail and connect
ssh -i /path/to/LightsailKey.pem ubuntu@YOUR_STATIC_IP
```

## Step 4: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v20.x
npm --version

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Apache (reverse proxy)
sudo apt install -y apache2

# Install PM2 globally
sudo npm install -g pm2

# Install build essentials
sudo apt install -y build-essential
```

## Step 5: Setup PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell, create database and user:
CREATE DATABASE voyager;
CREATE USER voyager_user WITH ENCRYPTED PASSWORD 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE voyager TO voyager_user;
\q
```

## Step 6: Upload Application Code

```bash
# Create app directory
sudo mkdir -p /var/www/voyager
sudo chown ubuntu:ubuntu /var/www/voyager

# From your local machine, upload code:
scp -i /path/to/LightsailKey.pem -r ./* ubuntu@YOUR_STATIC_IP:/var/www/voyager/

# Or clone from Git repository if you have one:
cd /var/www/voyager
git clone YOUR_REPO_URL .
```

## Step 7: Configure Environment Variables

```bash
cd /var/www/voyager

# Create .env file
nano .env
```

Add the following content:

```env
# Node Environment
NODE_ENV=production

# Database Configuration
DATABASE_URL=postgresql://voyager_user:YOUR_SECURE_PASSWORD@localhost:5432/voyager
PGUSER=voyager_user
PGPASSWORD=YOUR_SECURE_PASSWORD
PGDATABASE=voyager
PGHOST=localhost
PGPORT=5432

# Session Secret (generate a strong random string)
SESSION_SECRET=your_very_long_random_secret_key_here

# AWS Athena Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_OUTPUT_LOCATION=s3://dvsum-staging-prod
```

**Security Note**: Generate a strong SESSION_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Step 8: Install Dependencies and Build

```bash
cd /var/www/voyager

# Install dependencies
npm install

# Build the application (if needed)
# The app uses Vite which builds on startup, but you can pre-build if needed
```

## Step 9: Setup Database Schema

```bash
# Run database migrations/schema setup
npm run db:push

# Seed initial admin user
npx tsx server/scripts/seed.ts
```

Default admin credentials:
- Username: `admin`
- Password: `admin123`
- **⚠️ IMPORTANT**: Change this password immediately after first login!

## Step 10: Configure PM2

Create PM2 ecosystem file:

```bash
cd /var/www/voyager
nano ecosystem.config.cjs
```

Add the following content:

```javascript
module.exports = {
  apps: [{
    name: 'voyager',
    script: 'npm',
    args: 'run dev',
    cwd: '/var/www/voyager',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_file: '/var/www/voyager/.env',
    error_file: '/var/www/voyager/logs/error.log',
    out_file: '/var/www/voyager/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};
```

Start the application:

```bash
# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the command output to complete startup configuration

# Check status
pm2 status
pm2 logs voyager
```

## Step 11: Configure Apache Reverse Proxy

```bash
# Enable required Apache modules
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod headers
sudo a2enmod rewrite

# Create Apache configuration
sudo nano /etc/apache2/sites-available/voyager.conf
```

Add the following configuration:

```apache
<VirtualHost *:80>
    ServerName YOUR_DOMAIN_OR_IP
    ServerAdmin admin@yourdomain.com

    # Reverse proxy configuration
    ProxyPreserveHost On
    ProxyPass / http://localhost:5000/
    ProxyPassReverse / http://localhost:5000/

    # WebSocket support (if needed)
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://localhost:5000/$1" [P,L]

    # Timeout settings for long-running queries
    ProxyTimeout 600
    Timeout 600

    # Logs
    ErrorLog ${APACHE_LOG_DIR}/voyager-error.log
    CustomLog ${APACHE_LOG_DIR}/voyager-access.log combined
</VirtualHost>
```

Enable the site and restart Apache:

```bash
# Disable default site
sudo a2dissite 000-default.conf

# Enable Voyager site
sudo a2ensite voyager.conf

# Test configuration
sudo apache2ctl configtest

# Restart Apache
sudo systemctl restart apache2
```

## Step 12: Setup SSL (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-apache

# Get SSL certificate (replace with your domain)
sudo certbot --apache -d yourdomain.com -d www.yourdomain.com

# Certbot will automatically configure Apache for HTTPS
# Auto-renewal is configured automatically
```

## Step 13: Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check application logs
pm2 logs voyager --lines 50

# Check Apache status
sudo systemctl status apache2

# Test the application
curl http://localhost:5000
curl http://YOUR_STATIC_IP
```

## Step 14: Create Temporary Files Cleanup Cron Job

```bash
# Edit crontab
crontab -e

# Add this line to clean up old comparison files daily at 2 AM
0 2 * * * find /var/www/voyager/uploads -type f -mtime +1 -delete 2>/dev/null
0 2 * * * find /var/www/voyager/comparison-results -type f -mtime +1 -delete 2>/dev/null
```

## Maintenance Commands

```bash
# View application logs
pm2 logs voyager

# Restart application
pm2 restart voyager

# Stop application
pm2 stop voyager

# View PM2 monitoring dashboard
pm2 monit

# Update application (after code changes)
cd /var/www/voyager
git pull  # or upload new files
npm install  # if dependencies changed
pm2 restart voyager

# Restart Apache
sudo systemctl restart apache2

# View Apache logs
sudo tail -f /var/apache2/voyager-error.log
```

## Troubleshooting

### Application won't start
```bash
# Check PM2 logs
pm2 logs voyager --err

# Check if port 5000 is in use
sudo lsof -i :5000

# Restart PM2
pm2 restart voyager
```

### Database connection errors
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
psql -U voyager_user -d voyager -h localhost

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Apache issues
```bash
# Check Apache error logs
sudo tail -f /var/log/apache2/voyager-error.log

# Check Apache configuration
sudo apache2ctl configtest

# Restart Apache
sudo systemctl restart apache2
```

### Long queries timing out
The Apache configuration includes a 600-second (10-minute) timeout for long-running Athena queries. If you need longer:

```bash
sudo nano /etc/apache2/sites-available/voyager.conf
# Increase ProxyTimeout and Timeout values
sudo systemctl restart apache2
```

## Security Recommendations

1. **Change default admin password** immediately after first login
2. **Use SSL/HTTPS** in production (use Certbot)
3. **Firewall**: Only open necessary ports (80, 443, 22)
4. **Regular updates**: Keep system and dependencies updated
5. **Backup database** regularly:
   ```bash
   pg_dump -U voyager_user voyager > backup_$(date +%Y%m%d).sql
   ```
6. **Monitor logs** for suspicious activity
7. **Strong passwords** for database and session secret
8. **IP restrictions** (optional): Restrict access to specific IP ranges if needed

## Updating the Application

```bash
# Navigate to app directory
cd /var/www/voyager

# Pull latest changes (if using Git)
git pull

# Or upload new files via SCP
# scp -i key.pem -r ./* ubuntu@IP:/var/www/voyager/

# Install any new dependencies
npm install

# Push database schema changes (if any)
npm run db:push

# Restart application
pm2 restart voyager

# Check logs
pm2 logs voyager --lines 50
```

## Performance Optimization

1. **Enable Apache compression**:
   ```bash
   sudo a2enmod deflate
   sudo systemctl restart apache2
   ```

2. **Configure PM2 clustering** (for multiple CPU cores):
   ```javascript
   // In ecosystem.config.cjs
   instances: 'max',  // Use all CPU cores
   exec_mode: 'cluster'
   ```

3. **Database connection pooling** is already configured in the application

4. **Monitor resources**:
   ```bash
   pm2 monit
   htop
   ```

## Backup and Recovery

### Database Backup
```bash
# Create backup
pg_dump -U voyager_user voyager > /home/ubuntu/backups/voyager_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -U voyager_user voyager < /home/ubuntu/backups/voyager_TIMESTAMP.sql
```

### Application Backup
```bash
# Backup entire application
tar -czf voyager_backup_$(date +%Y%m%d).tar.gz /var/www/voyager
```

## Support

For issues or questions:
- Check application logs: `pm2 logs voyager`
- Check Apache logs: `sudo tail -f /var/log/apache2/voyager-error.log`
- Check database logs: `sudo tail -f /var/log/postgresql/postgresql-*.log`
