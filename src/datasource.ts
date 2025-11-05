import { DataSource } from 'typeorm';

// 本番環境ではビルド済みのJavaScriptファイル、開発環境ではTypeScriptファイルを使用
const isProduction = process.env.NODE_ENV === 'production';

const entities = process.env.DB_TYPEORM_ENTITIES || 
  (isProduction ? 'dist/**/*.entity.js' : 'src/**/*.entity.ts');

const migrations = process.env.DB_TYPEORM_MIGRATIONS || 
  (isProduction ? 'dist/migrations/**/*.js' : 'src/migrations/**/*.ts');

const subscribers = process.env.DB_TYPEORM_SUBSCRIBERS || 
  (isProduction ? 'dist/subscribers/**/*.js' : 'src/subscribers/**/*.ts');

export default new DataSource({
  migrationsTableName: 'migrations',
  type: 'sqlite',
  database: './data/zoom-clone.sqlite',
  synchronize: false,
  migrationsRun: true,
  logging: ['query', 'error', 'log'],
  entities: [entities],
  migrations: [migrations],
  subscribers: [subscribers],
});
