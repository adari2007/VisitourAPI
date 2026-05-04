import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:GAbrWFtdJgGRmfgzeyGgtlfhcPfmStdD@tramway.proxy.rlwy.net:39404/railway',
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  try {
    const client = await pool.connect();

    const tablesResult = await client.query(
      `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name;`
    );
    
    console.log('✓ All tables in database:');
    if (tablesResult.rows.length === 0) {
      console.log('  (No tables found - database appears empty)');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_schema}.${row.table_name}`);
      });
    }

    // Check users table structure
    const usersResult = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;`
    );

    console.log('\n✓ Users table structure:');
    usersResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

verify();

