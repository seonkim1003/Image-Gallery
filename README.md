# Image Gallery Website

A simple, beautiful image gallery website where anyone with the link can view and add images. Images are stored on the server, so they're visible to everyone who visits.

## Features

- ➕ Click the "+" button to add images
- 🖼️ Responsive grid layout
- 🗑️ Delete images with the × button
- 📤 Drag and drop image upload
- 🌐 Shared gallery - images visible to everyone with the link
- 💾 Images stored on server (persist across sessions)

## Setup & Run Locally

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

The server will run on `http://localhost:3000`

### 3. Open in Browser

Navigate to `http://localhost:3000` in your web browser.

## 🚀 Deploy for 24/7 Operation

Your website is configured to run 24/7 with all features. Choose a hosting option below:

### Option 1: Fly.io (Recommended for 24/7 - FREE) ⭐

**Best for 24/7 operation on free tier!**

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Sign up at [fly.io](https://fly.io) (free account)
3. Run: `flyctl launch` (in your project directory)
4. Follow prompts - it will auto-detect your app
5. Deploy: `flyctl deploy`
6. Your app runs 24/7 for free!

**Features:**
- ✅ Stays online 24/7 (free tier)
- ✅ Persistent storage for images
- ✅ Auto-scaling
- ✅ Health checks configured

**Note:** Free tier includes 3 shared-cpu-1x VMs (256MB RAM each)

### Option 2: Railway (24/7 - Free Tier Available)

**Great free tier with $5 monthly credit**

1. Sign up at [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway auto-detects Node.js and deploys
5. Your app runs continuously!

**Features:**
- ✅ $5 free monthly credit (usually enough for 24/7)
- ✅ Persistent storage included
- ✅ Auto-deploy from Git
- ✅ Configuration file included (`railway.json`)

### Option 3: Render (Free Tier Sleeps)

1. Sign up at [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Click "Create Web Service"

**Note:** Free tier sleeps after 15 min inactivity. Upgrade to paid ($7/month) for 24/7 operation.

### Option 4: Self-Host with PM2 (Your Own Server)

**For running on your own VPS/server 24/7:**

1. Install PM2 globally: `npm install -g pm2`
2. Start the app: `npm run pm2:start`
3. App will auto-restart if it crashes
4. View logs: `pm2 logs image-gallery`
5. Monitor: `pm2 monit`

**PM2 Commands:**
```bash
npm run pm2:start    # Start the app
npm run pm2:stop     # Stop the app
npm run pm2:restart  # Restart the app
pm2 logs             # View logs
pm2 status           # Check status
```

**Features:**
- ✅ 24/7 operation
- ✅ Auto-restart on crash
- ✅ Memory limits configured
- ✅ Log rotation
- ✅ Process management

## Important Files

- `server.js` - Express backend server
- `public/index.html` - Frontend website
- `package.json` - Dependencies
- `uploads/` - Directory where images are stored (created automatically)

## Environment Variables

The server uses `PORT` environment variable (defaults to 3000):

```bash
PORT=8080 npm start
```

## File Size Limits

- Maximum image size: 10MB per file
- Supported formats: JPEG, JPG, PNG, GIF, WEBP

## How It Works

1. **Upload**: When you upload an image, it's saved to the `uploads/` folder on the server
2. **Display**: The server serves all images from the `uploads/` folder
3. **Sharing**: Since images are on the server, anyone with the website URL can see them
4. **Delete**: Clicking × removes the image from the server

## 📦 Files for 24/7 Deployment

The project includes configuration files for easy deployment:

- `fly.toml` - Fly.io configuration (24/7 on free tier)
- `railway.json` - Railway configuration
- `render.yaml` - Render.com configuration
- `Procfile` - Heroku/Render start command
- `ecosystem.config.js` - PM2 configuration for self-hosting

## 📝 Notes

- **Images persist to disk** - All uploads are saved to the `uploads/` directory
- **Metadata persists** - Image categories and info saved to `image-metadata.json`
- **Survives restarts** - Images remain even after server restarts
- **24/7 ready** - Configured for continuous operation on all major platforms
- **Health monitoring** - `/api/health` endpoint for platform monitoring

## ⚠️ Important: Image Persistence

- Images are stored on the server's file system
- On **ephemeral filesystems** (some container platforms), files may be lost on redeploy
- **For production**, consider:
  - Using platforms with persistent volumes (Railway, Fly.io paid tiers)
  - Cloud storage (AWS S3, Cloudinary) for images
  - Regular backups of the `uploads/` folder

## Troubleshooting

**Images not loading?**
- Make sure the server is running
- Check that the `uploads/` directory exists
- Verify file permissions

**Can't upload?**
- Check file size (max 10MB)
- Ensure file is an image format (jpg, png, gif, webp)
- Check server console for errors

## License

MIT
