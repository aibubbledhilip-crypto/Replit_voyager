---
name: Lightsail Deploy Process
description: Full deployment steps for the Voyager app on AWS Lightsail — Apache serves frontend from server/public/, not dist/public/
---

## The critical step that's easy to miss

Apache on Lightsail serves static frontend files from **`server/public/`** directly — it does NOT proxy through Express for HTML/JS/CSS. Only `/api/*` calls go to Express on port 5000.

This means `npm run build` alone is NOT enough. You must also copy the built files:

```bash
cp -r dist/public/* server/public/
```

## Full correct deploy command

```bash
git pull origin main && NODE_OPTIONS="--max-old-space-size=1024" npm run build && cp -r dist/public/* server/public/ && pm2 restart 0
```

Or use the `deploy.sh` script at project root.

**Why:** Vite outputs to `dist/public/`. Express's `serveStatic` also reads from `dist/public/` (via `import.meta.dirname`). But Apache's VirtualHost has a `DocumentRoot` (or `Alias`) pointing at `server/public/`, serving static assets directly. Without the `cp` step, Apache keeps serving the old HTML/JS/CSS while Express has the new API code — the app appears unchanged to users.

**Why `--max-old-space-size=1024`:** The Lightsail instance has limited RAM; the default Node.js heap is too small for a Vite+TypeScript build and causes OOM crashes.

## DB connection (Lightsail)
`postgresql://postgres:Secure123@localhost:5432/voyagerdb`
