import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnvironment = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const apiRoot = path.resolve(__dirname, '../../');
  const envFiles = [
    `.env.${nodeEnv}.local`,
    '.env.local',
    `.env.${nodeEnv}`,
    '.env',
  ];

  for (const file of envFiles) {
    const fullPath = path.join(apiRoot, file);
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath });
    }
  }
};

loadEnvironment();

const parseOrigins = (origins: string) =>
  origins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const parseBoolean = (value?: string): boolean | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
};

const dbUrl = process.env.DATABASE_URL || '';
const dbHost = process.env.DATABASE_HOST || 'localhost';
const isLocalDbHost = ['localhost', '127.0.0.1'].includes(dbHost);
const isLocalDbUrl = /@(localhost|127\.0\.0\.1)(:|\/|$)/.test(dbUrl);
const dbSsl = parseBoolean(process.env.DB_SSL);
const dbSslRejectUnauthorized = parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED);

export const environment = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: dbUrl,
    host: dbHost,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'postgres',
    schema: process.env.DB_SCHEMA || 'public',
    ssl: dbSsl ?? Boolean((dbUrl && !isLocalDbUrl) || (!dbUrl && !isLocalDbHost)),
    sslRejectUnauthorized: dbSslRejectUnauthorized ?? false,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiry: process.env.JWT_EXPIRY || '7d',
  },
  cors: {
    origin: parseOrigins(process.env.CORS_ORIGIN || '*'),
  },
  ws: {
    url: process.env.WS_URL || 'http://localhost:3000',
  },
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
};
