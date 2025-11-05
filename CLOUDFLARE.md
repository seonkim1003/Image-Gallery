# Cloudflare Compatibility Guide

This project is configured to work seamlessly with Cloudflare as a CDN/proxy in front of your application.

## Features

✅ **Trust Proxy Configuration** - Express is configured to trust Cloudflare proxy headers  
✅ **CORS Headers** - Properly configured for Cloudflare origin passthrough  
✅ **Real IP Detection** - Extracts real client IP from Cloudflare's `CF-Connecting-IP` header  
✅ **Security Headers** - Cloudflare-compatible security headers configured  
✅ **Large File Uploads** - Configured to handle Cloudflare's upload limits

## Deployment Options

### Option 1: Cloudflare as CDN/Proxy (Recommended)

**Best for:** Full Express.js functionality with file uploads

1. Deploy your app to a hosting service (Railway, Fly.io, Render, etc.)
2. Point your domain to Cloudflare DNS
3. Enable Cloudflare proxy (orange cloud) in Cloudflare dashboard
4. Your app will automatically work with Cloudflare!

**Configuration:**
- The app is already configured with `trust proxy` enabled
- Cloudflare headers are automatically handled
- Real client IP is extracted from `CF-Connecting-IP`

**Benefits:**
- ✅ DDoS protection
- ✅ SSL/TLS encryption
- ✅ Global CDN caching
- ✅ Full Express.js functionality
- ✅ File uploads work perfectly

### Option 2: Cloudflare Pages (Frontend Only)

**Best for:** Static frontend with separate backend API

1. Build your frontend (if using a build process)
2. Deploy `public/` folder to Cloudflare Pages
3. Configure API routes to point to your backend server
4. Update `_redirects` file with your backend URL

**Limitations:**
- File uploads must go directly to backend (not through Pages)
- Requires separate backend server for API endpoints

### Option 3: Cloudflare Workers (Advanced)

**Best for:** Serverless deployment (requires code refactoring)

**Note:** This requires significant changes:
- No filesystem access (must use Cloudflare R2 for storage)
- Limited to 10ms CPU time on free tier
- Need to rewrite upload logic to use R2

**Not recommended** for this Express.js application without major refactoring.

## Configuration Files

### `_headers`
Cloudflare Pages headers configuration (for static assets)

### `_redirects`
Cloudflare Pages redirects configuration

### `cloudflare.json`
Cloudflare configuration file (for reference)

### `functions/_middleware.js`
Cloudflare Pages Functions middleware (placeholder)

## Cloudflare Settings

### Recommended Cloudflare Settings:

1. **SSL/TLS Mode:** Full (strict) - for encrypted connections
2. **Always Use HTTPS:** Enabled
3. **Automatic HTTPS Rewrites:** Enabled
4. **Browser Integrity Check:** Enabled
5. **Security Level:** Medium (adjust based on your needs)

### Page Rules (Optional):

Create a page rule for `/api/*` to:
- **Cache Level:** Bypass (don't cache API responses)
- **Disable Apps:** Disable Cloudflare Apps on API routes

## File Upload Limits

Cloudflare has upload size limits:
- **Free Plan:** 100MB per file
- **Pro Plan:** 100MB per file
- **Business Plan:** 500MB per file

The app is configured with a 100MB limit, which matches Cloudflare's free tier.

## Troubleshooting

### Issue: Real IP not showing correctly
**Solution:** Ensure `trust proxy` is enabled (already configured in server.js)

### Issue: CORS errors
**Solution:** CORS is configured to allow all origins. Check Cloudflare settings.

### Issue: File uploads failing
**Solution:** 
- Check Cloudflare upload size limits
- Ensure API routes are not cached (use Page Rules)
- Verify backend is accessible from Cloudflare

### Issue: 502 Bad Gateway
**Solution:**
- Check your backend server is running
- Verify SSL/TLS mode is set correctly
- Check Cloudflare firewall rules

## Testing Cloudflare Integration

1. Deploy your app to a hosting service
2. Point domain to Cloudflare
3. Test real IP detection:
   ```bash
   curl -H "CF-Connecting-IP: 1.2.3.4" https://your-domain.com/api/health
   ```
4. Check response headers include `CF-Ray`

## Support

For Cloudflare-specific issues, check:
- [Cloudflare Documentation](https://developers.cloudflare.com/)
- [Cloudflare Community](https://community.cloudflare.com/)

