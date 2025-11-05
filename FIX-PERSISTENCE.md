# Fix: Images Disappearing After Server Restart

If your images disappear every time the server goes back online, follow these steps:

## Quick Fix

### Option 1: Use Railway (Recommended) ✅

Railway provides persistent storage by default. Just deploy and your data will persist:

1. Deploy to Railway
2. Data persists automatically - no configuration needed!

### Option 2: Configure Persistent Storage

Set the `PERSISTENT_DATA_DIR` environment variable to point to a persistent directory:

**On Railway:**
- Already persistent - no action needed

**On Fly.io:**
1. Create volume: `flyctl volumes create data --size 1`
2. Set environment variable: `PERSISTENT_DATA_DIR=/data`
3. Mount volume in `fly.toml`:
```toml
[mounts]
  source = "data"
  destination = "/data"
```
4. Redeploy: `flyctl deploy`

**On Render:**
1. Upgrade to paid plan ($7/month) for persistent storage
2. Set environment variable: `PERSISTENT_DATA_DIR=/data`

**Self-Hosted:**
```bash
PERSISTENT_DATA_DIR=/var/www/data npm start
```

## Automatic Recovery

The server now includes automatic recovery:

1. **On Startup**: Checks if uploads directory is empty
2. **Auto-Restore**: If empty and backups exist, automatically restores from most recent backup
3. **Metadata Fallback**: If primary metadata is missing, loads from backup location
4. **Frequent Backups**: Backups created every 5 uploads (instead of 10)

## Verify It's Working

1. Upload some images
2. Restart the server
3. Check server logs - should show:
   - `✓ Storage persistence verified`
   - Number of files restored (if any)
4. Images should still be visible

## If Images Still Disappear

1. **Check logs** for persistence warnings
2. **Verify backups exist**: `GET /api/backups`
3. **Manually restore**: `POST /api/restore/:backupName`
4. **Check environment variable**: Ensure `PERSISTENT_DATA_DIR` is set correctly
5. **Verify platform**: Some platforms (Render free tier) don't support persistence

## Platform-Specific Solutions

### Railway
✅ **Persistent by default** - Just deploy, data persists automatically

### Fly.io
1. Create persistent volume
2. Mount it to `/data`
3. Set `PERSISTENT_DATA_DIR=/data`

### Render Free Tier
⚠️ **Ephemeral storage** - Data lost on redeploy
- Upgrade to paid plan, OR
- Use external storage (S3, Cloudinary)

### Self-Hosted/VPS
✅ **Full persistence** - Data persists automatically to disk

## Testing

1. Upload an image
2. Check it's visible
3. Restart server: `pm2 restart image-gallery` or restart hosting service
4. Image should still be there

If it disappears, check server logs for restore messages.



