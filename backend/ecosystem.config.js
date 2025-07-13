// PM2 Configuration for Production
module.exports = {
    apps: [{
      name: 'oct-domain-backend',
      script: 'server.js',
      instances: 'max', // Gunakan semua CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Monitoring
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'database'],
      
      // Advanced features
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true
    }]
  };