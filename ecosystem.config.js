module.exports = {
  apps: [
    {
      name: "zoom-clone-api",
      script: "./dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
      // ログ設定
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // 自動再起動設定
      watch: false,
      max_memory_restart: "1G",
      // クラッシュ時の自動再起動
      autorestart: true,
      // 起動時の待機時間（秒）
      min_uptime: "10s",
      max_restarts: 10,
    },
  ],
};
