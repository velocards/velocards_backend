require('dotenv').config();

module.exports = {
  apps: [{
    name: 'digistreets-backend',
    script: './dist/src/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,
    kill_timeout: 5000
  }]
};
