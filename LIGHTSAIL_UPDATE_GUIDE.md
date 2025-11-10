# Voyager - Lightsail Deployment Update Guide
## Addressing All Previous Challenges

Based on your previous deployment experience, this guide addresses all the challenges you faced:
- ✅ Database driver compatibility (Neon → node-postgres)
- ✅ Apache timeout configuration (10-minute timeout)
- ✅ PM2 environment variable loading
- ✅ Large/complex query support (110+ seconds)
- ✅ File upload and comparison functionality

---

## 🚨 CRITICAL: Database Driver Fix

**Issue**: The current code uses `@neondatabase/serverless` which doesn't work with self-hosted PostgreSQL on Lightsail.

**Solution**: You need to modify the database connection for production.

### Step 1: Update server/db.ts for Lightsail

**IMPORTANT**: Before deploying to Lightsail, the database connection needs to use standard PostgreSQL driver instead of Neon.

#### Current code (server/db.ts):
```typescript
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
```

#### For Lightsail deployment, this should be:
```typescript
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
```

**Two options to handle this:**

**Option A: Environment-based conditional** (Recommended)
```typescript
// server/db.ts
import * as schema from "@shared/schema";

let pool: any;
let db: any;

if (process.env.NODE_ENV === 'production') {
  // Use node-postgres for Lightsail/production
  const { Pool } = require('pg');
  const { drizzle } = require('drizzle-orm/node-postgres');
  
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }
  
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
} else {
  // Use Neon for Replit development
  const { Pool, neonConfig } = require('@neondatabase/serverless');
  const { drizzle } = require('drizzle-orm/neon-serverless');
  const ws = require('ws');
  
  neonConfig.webSocketConstructor = ws;
  
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }
  
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
}

export { pool, db };
```

**Option B: Create separate db file for production**
Keep the current `server/db.ts` for Replit, and create `server/db.production.ts` for Lightsail.

---

## 📦 Pre-Deployment Checklist

Before pushing to GitHub or deploying:

1. **Ensure database driver is correct** (see above)
2. **Verify ecosystem.config.cjs exists** (create if needed)
3. **Check all environment variables are documented**
4. **Test locally first** (if possible)

---

## 🚀 Deployment Steps to Existing Lightsail Instance

### Step 1: Connect to Lightsail

```bash
ssh -i /path/to/LightsailKey.pem ubuntu@YOUR_LIGHTSAIL_IP
```

### Step 2: Backup Current Application

```bash
# Create backup
cd ~
tar -czf voyager_backup_$(date +%Y%m%d_%H%M%S).tar.gz /var/www/voyager

# Verify backup
ls -lh voyager_backup_*.tar.gz
```

### Step 3: Update Code

**Method 1: Using Git (Recommended)**
```bash
cd /var/www/voyager

# Stash any local changes (if needed)
git stash

# Pull latest changes
git pull origin main

# If you made database driver changes, verify them
cat server/db.ts | head -20
```

**Method 2: Manual Upload**
```bash
# From your local machine
scp -i /path/to/LightsailKey.pem -r ./client ubuntu@YOUR_LIGHTSAIL_IP:/var/www/voyager/
scp -i /path/to/LightsailKey.pem -r ./server ubuntu@YOUR_LIGHTSAIL_IP:/var/www/voyager/
scp -i /path/to/LightsailKey.pem ./package.json ubuntu@YOUR_LIGHTSAIL_IP:/var/www/voyager/
```

### Step 4: Install/Update Dependencies

```bash
cd /var/www/voyager

# If database driver changed, you may need to install pg package
npm install pg --save

# Update all dependencies
npm install

# Verify critical packages
npm list | grep -E "pg|express|drizzle"
```

### Step 5: Verify Environment Variables

```bash
cd /var/www/voyager

# Check .env file exists and has all required variables
cat .env

# Required variables:
# - NODE_ENV=production
# - DATABASE_URL=postgresql://...
# - SESSION_SECRET=...
# - AWS_REGION=us-east-1
# - AWS_ACCESS_KEY_ID=...
# - AWS_SECRET_ACCESS_KEY=...
# - AWS_S3_OUTPUT_LOCATION=s3://dvsum-staging-prod
```

### Step 6: Create/Update PM2 Ecosystem File

```bash
cd /var/www/voyager
nano ecosystem.config.cjs
```

**Critical PM2 Configuration** (paste this):

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
    // CRITICAL: This ensures .env file is loaded
    env_file: '/var/www/voyager/.env',
    error_file: '/var/www/voyager/logs/error.log',
    out_file: '/var/www/voyager/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    // Increase max_old_space_size for large queries
    node_args: '--max-old-space-size=2048'
  }]
};
```

### Step 7: Update Apache Configuration

```bash
sudo nano /etc/apache2/sites-available/voyager.conf
```

**Critical Apache Configuration** (ensure these lines exist):

```apache
<VirtualHost *:80>
    ServerName YOUR_DOMAIN_OR_IP
    
    # Reverse proxy
    ProxyPreserveHost On
    ProxyPass / http://localhost:5000/
    ProxyPassReverse / http://localhost:5000/

    # WebSocket support
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://localhost:5000/$1" [P,L]

    # CRITICAL: 10-minute timeout for long Athena queries
    ProxyTimeout 600
    Timeout 600
    
    # Increase buffer size for large responses
    ProxyIOBufferSize 65536

    ErrorLog ${APACHE_LOG_DIR}/voyager-error.log
    CustomLog ${APACHE_LOG_DIR}/voyager-access.log combined
</VirtualHost>
```

Test Apache configuration:
```bash
sudo apache2ctl configtest
# Should show "Syntax OK"
```

### Step 8: Create Required Directories

```bash
cd /var/www/voyager

# Create directories for file uploads and comparisons
mkdir -p uploads
mkdir -p comparison-results
mkdir -p logs

# Set permissions
chmod 755 uploads comparison-results logs
```

### Step 9: Restart Services

```bash
# Restart PM2 application
pm2 restart voyager

# Or if this is first time setup
pm2 start ecosystem.config.cjs
pm2 save

# Restart Apache
sudo systemctl restart apache2

# Enable PM2 on startup (if not already done)
pm2 startup
# Follow the command output
```

### Step 10: Verify Deployment

```bash
# Check PM2 status
pm2 status

# View logs in real-time
pm2 logs voyager --lines 50

# Check for errors
pm2 logs voyager --err --lines 20

# Verify Apache is running
sudo systemctl status apache2

# Test local connection
curl http://localhost:5000

# Test external connection
curl http://YOUR_LIGHTSAIL_IP
```

---

## 🧪 Testing Checklist

Access your application at `http://YOUR_LIGHTSAIL_IP` and test:

- [ ] Login page loads
- [ ] Can login with admin credentials
- [ ] Dashboard shows statistics
- [ ] Query execution page works
- [ ] **CSV export downloads successfully** (NEW FIX)
- [ ] MSISDN lookup works
- [ ] File comparison works
- [ ] File upload accepts CSV and XLSX
- [ ] Can execute large queries (test with 50k+ rows)
- [ ] Query doesn't timeout after 2 minutes

---

## 🐛 Troubleshooting Previous Issues

### Issue 1: Database Connection Errors

**Symptoms**: `error: The endpoint has been disabled. Enable it using Neon API and retry.`

**Fix**: Ensure you're using `pg` package, not `@neondatabase/serverless`

```bash
# On Lightsail instance
cd /var/www/voyager

# Check what's imported in db.ts
head -10 server/db.ts

# Should see:
# import { Pool } from 'pg';
# NOT:
# import { Pool } from '@neondatabase/serverless';
```

### Issue 2: PM2 Environment Variables Not Loading

**Symptoms**: Application can't connect to database or AWS

**Fix**: Ensure `env_file` is set in ecosystem.config.cjs

```bash
# Verify environment variables are loaded
pm2 restart voyager --update-env

# Check PM2 environment
pm2 show voyager | grep -A 20 "Environment"

# Or check logs for environment variable errors
pm2 logs voyager --err | grep -i "env\|variable\|database_url"
```

### Issue 3: Apache Timeout on Long Queries

**Symptoms**: Queries work in development but timeout in production after 2 minutes

**Fix**: Ensure Apache has proper timeout settings

```bash
# Check Apache config
sudo cat /etc/apache2/sites-available/voyager.conf | grep -i timeout

# Should show:
# ProxyTimeout 600
# Timeout 600

# If missing, add them and restart Apache
sudo systemctl restart apache2
```

### Issue 4: CSV Export Not Working

**Symptoms**: Export button doesn't download file

**Fix**: This is fixed in the latest code update. Verify by checking:

```bash
cd /var/www/voyager
grep -A 20 "handleExport" client/src/components/ResultsTable.tsx

# Should see CSV generation code, not just console.log
```

### Issue 5: File Upload Fails

**Symptoms**: File comparison upload gives error

**Fix**: Ensure upload directories exist and have proper permissions

```bash
cd /var/www/voyager
ls -la | grep -E "uploads|comparison"

# Should show:
# drwxr-xr-x  2 ubuntu ubuntu  4096 ... uploads
# drwxr-xr-x  2 ubuntu ubuntu  4096 ... comparison-results

# If missing:
mkdir -p uploads comparison-results
chmod 755 uploads comparison-results
```

---

## 📊 Monitoring Commands

### Real-time Monitoring

```bash
# Watch PM2 logs live
pm2 logs voyager --lines 100

# Monitor system resources
pm2 monit

# Watch Apache access logs
sudo tail -f /var/log/apache2/voyager-access.log

# Watch Apache error logs
sudo tail -f /var/log/apache2/voyager-error.log
```

### Performance Checks

```bash
# Check memory usage
free -h

# Check disk space
df -h

# Check running processes
ps aux | grep node

# Check port 5000
sudo lsof -i :5000
```

---

## 🔄 Quick Rollback Procedure

If something goes wrong:

```bash
# Stop current version
pm2 stop voyager

# Restore from backup
cd /var/www
sudo rm -rf voyager
sudo tar -xzf ~/voyager_backup_TIMESTAMP.tar.gz -C /

# Fix permissions
sudo chown -R ubuntu:ubuntu /var/www/voyager

# Restart
pm2 start ecosystem.config.cjs
pm2 logs voyager
```

---

## 📝 Post-Deployment Tasks

1. **Test all features** (see Testing Checklist above)
2. **Monitor logs** for first 24 hours: `pm2 logs voyager`
3. **Setup automated backups**:
   ```bash
   # Add to crontab
   crontab -e
   
   # Daily database backup at 2 AM
   0 2 * * * pg_dump -U voyager_user voyager > ~/backups/voyager_$(date +\%Y\%m\%d).sql
   
   # Clean old comparison files
   0 2 * * * find /var/www/voyager/uploads -type f -mtime +1 -delete
   0 2 * * * find /var/www/voyager/comparison-results -type f -mtime +1 -delete
   ```
4. **Update DNS** (if using domain name)
5. **Setup SSL/HTTPS** with Let's Encrypt (if not already done):
   ```bash
   sudo certbot --apache -d yourdomain.com
   ```

---

## 🆘 Emergency Contacts / Support

If you encounter issues:

1. **Check logs first**: `pm2 logs voyager --lines 200`
2. **Check Apache logs**: `sudo tail -100 /var/log/apache2/voyager-error.log`
3. **Verify database**: `psql -U voyager_user -d voyager -c "SELECT COUNT(*) FROM users;"`
4. **Test AWS credentials**: Check if Athena queries work
5. **Corporate proxy issue**: Access from personal network if queries timeout

---

## 📋 Quick Reference

```bash
# Essential commands
pm2 status              # Check app status
pm2 logs voyager        # View logs
pm2 restart voyager     # Restart app
pm2 monit              # Monitor resources

sudo systemctl status apache2        # Check Apache
sudo systemctl restart apache2       # Restart Apache
sudo apache2ctl configtest          # Test config

# Debugging
pm2 logs voyager --err              # Error logs only
pm2 flush                           # Clear logs
curl http://localhost:5000          # Test local
curl http://YOUR_IP                 # Test external
```

---

## ✅ Success Indicators

Your deployment is successful when:
- ✅ `pm2 status` shows app as "online"
- ✅ No errors in `pm2 logs voyager`
- ✅ Can access application via browser
- ✅ Login works
- ✅ Queries execute successfully
- ✅ Large queries don't timeout (tested with 50k+ rows)
- ✅ CSV export downloads
- ✅ File comparison uploads and downloads work
- ✅ All features functional

---

## 🎯 What Changed in This Update

- ✅ **CSV Export**: Now fully functional (was broken before)
- ✅ **File Comparison UI**: Updated text and messaging
- ✅ **Documentation**: Updated replit.md and deployment guides
- 🔧 **Database driver**: Verify it's using `pg` not `@neondatabase/serverless`

Good luck with your deployment! 🚀
