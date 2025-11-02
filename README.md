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

## Deploy for Free (So Others Can See Images)

You can deploy this for free on several platforms. Here are the easiest options:

### Option 1: Render (Recommended - Easiest)

1. Create a free account at [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository (or deploy manually)
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Click "Create Web Service"
6. Your app will be live! Share the URL with anyone.

**Note**: On Render's free tier, the server sleeps after inactivity, but wakes up when accessed.

### Option 2: Railway

1. Create a free account at [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect Node.js and deploy
5. Your app will be live instantly!

### Option 3: Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in your project directory
3. Follow the prompts to deploy

### Option 4: Replit

1. Go to [replit.com](https://replit.com)
2. Create a new Node.js repl
3. Upload your files
4. Click "Run"
5. Share the public URL

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

## Notes

- Images are stored on the server's file system
- On free hosting platforms, files may be cleared if the server is inactive
- For production use, consider using cloud storage (AWS S3, Cloudinary, etc.)

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
