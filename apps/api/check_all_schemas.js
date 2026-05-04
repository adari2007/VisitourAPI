import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:GAbrWFtdJgGRmfgzeyGgtlfhcPfmStdD@tramway.proxy.rlwy.net:39404/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkSchemas() {
  try {
    // List all schemas
    const schemas = await pool.query(`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1')
      ORDER BY schema_name;
    `);
    console.log('Available schemas:');
    schemas.rows.forEach(row => console.log(`  - ${row.schema_name}`));

    // Check tables in visitour_dev
    const visitourTables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'visitour_dev'
      ORDER BY table_name;
    `);
    console.log('\nTables in visitour_dev schema:');
    if (visitourTables.rows.length === 0) {
      console.log('  (no tables found)');
    } else {
      visitourTables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    }

    // Check tables in public
    const publicTables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('\nTables in public schema:');
    if (publicTables.rows.length === 0) {
      console.log('  (no tables found)');
    } else {
      publicTables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkSchemas();

