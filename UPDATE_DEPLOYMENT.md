# Voyager - Update Existing Lightsail Instance

## Recent Changes to Deploy
- ✅ **CSV Export Fix**: Query results can now be exported to CSV (was previously not working)
- ✅ **File Comparison Updates**: Updated UI text and comparison logic for matching keys

## Quick Update Steps

### Step 1: Connect to Your Lightsail Instance

```bash
ssh -i /path/to/LightsailKey.pem ubuntu@YOUR_LIGHTSAIL_IP
```

### Step 2: Navigate to Application Directory

```bash
cd /var/www/voyager
```

### Step 3: Backup Current Version (Optional but Recommended)

```bash
# Create backup of current code
tar -czf ~/voyager_backup_$(date +%Y%m%d_%H%M%S).tar.gz /var/www/voyager
```

### Step 4: Upload Updated Files

**Option A: Using SCP from your local machine**

```bash
# From your local machine (where the code is)
scp -i /path/to/LightsailKey.pem -r ./client ubuntu@YOUR_LIGHTSAIL_IP:/var/www/voyager/
scp -i /path/to/LightsailKey.pem -r ./server ubuntu@YOUR_LIGHTSAIL_IP:/var/www/voyager/
scp -i /path/to/LightsailKey.pem ./package.json ubuntu@YOUR_LIGHTSAIL_IP:/var/www/voyager/
scp -i /path/to/LightsailKey.pem ./replit.md ubuntu@YOUR_LIGHTSAIL_IP:/var/www/voyager/
```

**Option B: Using Git (if you have a repository)**

```bash
# On the Lightsail instance
cd /var/www/voyager
git pull origin main
```

**Option C: Manual file transfer via SFTP**

Use FileZilla or any SFTP client to upload the updated files.

### Step 5: Install Any New Dependencies (if package.json changed)

```bash
cd /var/www/voyager
npm install
```

### Step 6: Restart the Application

```bash
# Restart PM2 process
pm2 restart voyager

# Or restart all PM2 processes
pm2 restart all
```

### Step 7: Verify the Update

```bash
# Check PM2 status
pm2 status

# View application logs (look for any errors)
pm2 logs voyager --lines 50

# Test the application
curl http://localhost:5000

# Check from browser
# Navigate to http://YOUR_LIGHTSAIL_IP
```

### Step 8: Test CSV Export Feature

1. Login to the application
2. Navigate to Query Execution page
3. Run a test query
4. Click "Export CSV" button
5. Verify the CSV file downloads successfully

## Files That Changed

The main changes are in:
- `client/src/components/ResultsTable.tsx` - CSV export implementation
- `client/src/pages/FileComparisonPage.tsx` - UI text updates
- `replit.md` - Documentation updates

## Rollback (If Something Goes Wrong)

```bash
# Stop current version
pm2 stop voyager

# Restore from backup
cd /var/www
sudo rm -rf voyager
sudo tar -xzf ~/voyager_backup_TIMESTAMP.tar.gz -C /

# Restart
pm2 restart voyager
```

## Troubleshooting

### Application won't restart
```bash
# Check for syntax errors in logs
pm2 logs voyager --err

# Kill the process and restart
pm2 delete voyager
pm2 start ecosystem.config.cjs
```

### Changes not visible
```bash
# Clear PM2 logs
pm2 flush

# Hard restart
pm2 restart voyager --update-env

# Clear browser cache and hard refresh (Ctrl+Shift+R)
```

### Permission issues
```bash
# Fix file permissions
sudo chown -R ubuntu:ubuntu /var/www/voyager
```

## Quick Reference Commands

```bash
# View live logs
pm2 logs voyager

# Restart application
pm2 restart voyager

# Check status
pm2 status

# View monitoring dashboard
pm2 monit

# Restart Apache (if needed)
sudo systemctl restart apache2
```

## Post-Update Checklist

- [ ] Application starts without errors (`pm2 status`)
- [ ] No errors in logs (`pm2 logs voyager`)
- [ ] Can access application via browser
- [ ] Login works correctly
- [ ] Query execution works
- [ ] **CSV export downloads successfully**
- [ ] File comparison still works
- [ ] MSISDN lookup still works

## Need More Help?

If you encounter issues:
1. Check PM2 logs: `pm2 logs voyager --lines 100`
2. Check Apache logs: `sudo tail -f /var/log/apache2/voyager-error.log`
3. Verify environment variables are still correct: `cat /var/www/voyager/.env`
