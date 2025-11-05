// Cloudflare Pages Functions middleware
// This file enables Cloudflare Pages Functions support
// Note: This is a placeholder for Cloudflare Pages Functions
// For full serverless deployment, consider using Cloudflare Workers with R2 storage

export function onRequest(context) {
    // This middleware runs on every request
    // For Express.js apps, you typically deploy to a traditional hosting service
    // and use Cloudflare as a CDN/proxy in front
    
    return context.next();
}

