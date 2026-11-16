module.exports = {
  apps: [
    {
      name: "funoon-fiesta",
      script: "npm",
      args: "start -- -p 11413",
      cwd: "/home/funoonfiesta.noorululama.org/Funoon-Fiesta",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 11413
      }
    },
    {
      name: "funoon-deploy-webhook",
      script: "scripts/webhook-service.js",
      cwd: "/home/funoonfiesta.noorululama.org/Funoon-Fiesta",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "250M",
      env: {
        NODE_ENV: "production",
        DEPLOY_WEBHOOK_PORT: 11414
      }
    }
  ]
};
