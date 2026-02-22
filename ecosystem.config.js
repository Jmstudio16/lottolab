module.exports = {
  apps: [
    {
      name: 'lottolab-backend',
      script: 'uvicorn',
      args: 'server:app --host 0.0.0.0 --port 8001 --workers 4',
      cwd: '/var/www/lottolab/backend',
      interpreter: '/var/www/lottolab/backend/venv/bin/python',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: '/var/log/lottolab/backend-error.log',
      out_file: '/var/log/lottolab/backend-out.log',
      log_file: '/var/log/lottolab/backend.log',
      time: true
    },
    {
      name: 'lottolab-frontend',
      script: 'serve',
      args: '-s build -l 3000',
      cwd: '/var/www/lottolab/frontend',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/var/log/lottolab/frontend-error.log',
      out_file: '/var/log/lottolab/frontend-out.log',
      log_file: '/var/log/lottolab/frontend.log',
      time: true
    }
  ]
};
