#!/bin/bash
set -e

echo ">>> Pulling latest code..."
git pull origin main

echo ">>> Building..."
NODE_OPTIONS="--max-old-space-size=1024" npm run build

echo ">>> Copying frontend to Apache public directory..."
cp -r dist/public/* server/public/

echo ">>> Restarting app..."
pm2 restart 0

echo ">>> Done. Deployment complete."
