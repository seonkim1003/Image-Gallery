// PM2 Configuration for 24/7 reliable operation
// Install PM2: npm install -g pm2
// Start: npm run pm2:start
// Stop: npm run pm2:stop
// Restart: npm run pm2:restart

module.exports = {
  apps: [{
    name: 'image-gallery',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000
  }]
};

