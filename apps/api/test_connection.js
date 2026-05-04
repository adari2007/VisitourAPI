import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:GAbrWFtdJgGRmfgzeyGgtlfhcPfmStdD@tramway.proxy.rlwy.net:39404/railway',
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  try {
    console.log('Testing database connection with new credentials...');
    const client = await pool.connect();
    console.log('✓ Successfully connected to database!');

    // Test a simple query
    const result = await client.query('SELECT NOW()');
    console.log('✓ Database is responding:', result.rows[0]);

    // Check current user
    const userResult = await client.query('SELECT current_user;');
    console.log('✓ Connected as:', userResult.rows[0].current_user);

    // List existing tables
    const tablesResult = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
    );
    console.log('✓ Existing tables:', tablesResult.rows.map(r => r.table_name));

    client.release();
    await pool.end();
    console.log('\n✓ Database configuration is valid and working!');
  } catch (err) {
    console.error('✗ Connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();

