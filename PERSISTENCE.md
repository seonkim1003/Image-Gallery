# Data Persistence Guide

This guide explains how to ensure your images and data persist even after the server shuts down or goes offline.

## How Data Persistence Works

### Automatic Features

1. **Disk Storage**: All images are saved to the `uploads/` directory
2. **Metadata Storage**: Image metadata saved to `image-metadata.json`
3. **Automatic Backups**: Backups created every 10 uploads
4. **Backup Redundancy**: Metadata saved to both primary and backup locations
5. **Auto-Restore**: Automatically restores from backup if data is lost

### Backup System

- **Location**: `backups/` directory
- **Frequency**: Every 10th upload (automatic)
- **Manual**: Use `POST /api/backup` endpoint
- **Restore**: Use `POST /api/restore/:backupName` endpoint

## Hosting Platform Configuration

### Railway (Recommended) ✅

**Status**: Persistent storage enabled by default

Railway automatically provides persistent storage. Your data will persist:
- ✅ After server restarts
- ✅ After deployments
- ✅ After computer shuts off
- ✅ Across all server operations

**No configuration needed** - just deploy and your data persists!

### Fly.io ✅

**Status**: Requires persistent volume configuration

1. Create a volume:
```bash
flyctl volumes create data --size 1
```

2. Update `fly.toml` to mount the volume:
```toml
[mounts]
  source = "data"
  destination = "/app/uploads"
```

3. Redeploy:
```bash
flyctl deploy
```

Your data will now persist across deployments.

### Render ⚠️

**Status**: Ephemeral storage on free tier

**Free Tier**: Data is lost on redeploy
**Solution Options**:
1. Upgrade to paid plan ($7/month) - includes persistent storage
2. Use automatic backups and download them periodically
3. Use external storage (AWS S3, Cloudinary)

### Self-Hosted/VPS ✅

**Status**: Full persistence

When running on your own server or VPS:
- ✅ All data persists to disk
- ✅ Survives server restarts
- ✅ Survives computer shutdowns
- ✅ Automatic backups in `backups/` directory

## Testing Persistence

1. Upload some images
2. Check `/api/health` endpoint - should show `persistence: { writable: true }`
3. Restart the server
4. Images should still be there

## Backup & Restore

### Create Backup
```bash
curl -X POST http://localhost:3000/api/backup
```

### List Backups
```bash
curl http://localhost:3000/api/backups
```

### Restore from Backup
```bash
curl -X POST http://localhost:3000/api/restore/backup-2024-01-01T12-00-00-000Z
```

## Troubleshooting

### Data Lost After Restart?

1. Check if backups exist: `GET /api/backups`
2. Restore from most recent backup
3. Check hosting platform documentation for persistent storage

### Warning: "Storage may be ephemeral"

This means your hosting platform may not have persistent storage configured.

**Solutions**:
- Railway: No action needed (persistent by default)
- Fly.io: Create and mount a volume (see above)
- Render: Upgrade to paid plan or use external storage
- Self-hosted: No action needed (always persistent)

## Best Practices

1. **Use Railway** for easiest persistence (no configuration)
2. **Create manual backups** before major deployments
3. **Check backups regularly** using `/api/backups`
4. **Monitor storage** using `/api/health` endpoint
5. **For production**, consider external storage (S3, Cloudinary) for unlimited scale

