module.exports = {
  apps: [
    {
      name: 'jungsan',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: 'D:\\JUNGSAN\\jungsan-app',
      interpreter: 'C:\\Program Files\\nodejs\\node.exe',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
}
