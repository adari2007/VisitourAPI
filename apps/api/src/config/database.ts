import pg from 'pg';
import { environment } from './environment.js';

const { Pool } = pg;

const ssl = environment.database.ssl
  ? { rejectUnauthorized: environment.database.sslRejectUnauthorized }
  : undefined;

const poolConfig = environment.database.url
  ? {
      connectionString: environment.database.url,
      ssl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host: environment.database.host,
      port: environment.database.port,
      user: environment.database.user,
      password: environment.database.password,
      database: environment.database.database,
      ssl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function initializeDatabase() {
  try {
    const client = await pool.connect();
    console.log('✓ Connected to PostgreSQL');
    client.release();
  } catch (error) {
    console.error('✗ Failed to connect to database:', error);
    throw error;
  }
}

export async function closeDatabase() {
  await pool.end();
  console.log('✓ Database connection closed');
}
