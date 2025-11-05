# Deployment Guide

## ⚠️ Important: Cloudflare Deployment Limitations

**Your Express.js app with file uploads CANNOT run directly on Cloudflare Workers or Cloudflare Pages.**

### Why?
- Cloudflare Workers: No filesystem access, 10ms CPU limit, no persistent storage
- Cloudflare Pages: Only supports static sites and serverless functions (no Express.js)

## ✅ Recommended Deployment Options

### Option 1: Deploy to Railway/Fly.io + Cloudflare CDN (BEST)

1. **Deploy backend to Railway or Fly.io:**
   ```bash
   # Railway: Auto-detects from railway.json
   # Fly.io: flyctl deploy
   ```

2. **Point domain to Cloudflare:**
   - Add your domain to Cloudflare
   - Point DNS to your Railway/Fly.io app
   - Enable Cloudflare proxy (orange cloud)

3. **Result:** 
   - ✅ Full Express.js functionality
   - ✅ File uploads work perfectly
   - ✅ Cloudflare CDN benefits (DDoS protection, SSL, caching)

### Option 2: Split Deployment (Advanced)

**Frontend → Cloudflare Pages**
**Backend → Railway/Fly.io**

1. **Deploy backend to Railway/Fly.io**
2. **Deploy frontend to Cloudflare Pages:**
   ```bash
   npx wrangler pages deploy ./public --project-name=image-gallery-website
   ```
3. **Update frontend API URLs** to point to your backend
4. **Configure CORS** on backend to allow Cloudflare Pages domain

**Limitation:** File uploads must go directly to backend (bypass Cloudflare Pages)

## 🚫 Current Issue

Your build is trying to run:
```bash
npx wrangler deploy
```

This fails because:
- No Worker script entry point
- Express.js apps can't run on Workers
- File uploads require filesystem access

## 🔧 Solution

### If deploying to Cloudflare Pages (frontend only):

**Build Command:**
```bash
npm ci
```

**Deploy Command:**
```bash
npx wrangler pages deploy ./public --project-name=image-gallery-website
```

**OR** remove the deploy command and use Cloudflare Pages dashboard:
- Connect GitHub repo
- Build command: `npm ci`
- Output directory: `public`
- Root directory: `/`

### If deploying full app (RECOMMENDED):

**Remove Cloudflare Workers deploy command** and use:
- Railway (auto-deploys from `railway.json`)
- Fly.io (`flyctl deploy`)
- Render (uses `render.yaml`)

Then add Cloudflare as CDN/proxy in front.

## 📝 Quick Fix

**To fix the current build error:**

1. **Remove or change the deploy command** from:
   ```bash
   npx wrangler deploy
   ```
   
   To one of:
   - `npm start` (for Railway/Fly.io/Render)
   - `npx wrangler pages deploy ./public --project-name=image-gallery-website` (for Cloudflare Pages frontend only)

2. **Or deploy to Railway/Fly.io** and use Cloudflare as CDN/proxy (no deploy command needed in Cloudflare)

## 🎯 Recommended Setup

```
┌─────────────┐
│  Cloudflare │  ← CDN/Proxy (DDoS protection, SSL, caching)
│   (DNS)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Railway/   │  ← Your Express.js app runs here
│  Fly.io     │     (with file uploads, persistent storage)
└─────────────┘
```

This gives you:
- ✅ Full Express.js functionality
- ✅ File uploads work
- ✅ Cloudflare benefits
- ✅ Best of both worlds

