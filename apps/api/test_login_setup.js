import pg from 'pg';
import { loadEnvironment } from './src/config/env-loader.js';

const { Pool } = pg;

loadEnvironment();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL. Set it in apps/api/.env before running this script.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
});

async function testLoginSetup() {
  try {
    console.log('\n=== Database & Login System Check ===\n');

    const client = await pool.connect();

    // Check if users table exists and is empty
    const result = await client.query('SELECT COUNT(*) as count FROM users;');
    const userCount = parseInt(result.rows[0].count);

    console.log(`✓ Users table verified (${userCount} users currently)`);

    // Check table structure
    const structureResult = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'users' ORDER BY ordinal_position;`
    );

    console.log('✓ Users table structure:');
    structureResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}`);
    });

    console.log('\n=== API Integration Next Steps ===\n');
    console.log('1. Start API server: npm run dev');
    console.log('2. Register via API: POST /api/auth/register');
    console.log('3. Login via API: POST /api/auth/login');
    console.log('4. Use returned token for protected endpoints');
    console.log('\nDatabase is ready for API authentication flows.\n');

    client.release();
    await pool.end();
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
}

testLoginSetup();

