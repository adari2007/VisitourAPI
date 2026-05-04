import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:GAbrWFtdJgGRmfgzeyGgtlfhcPfmStdD@tramway.proxy.rlwy.net:39404/railway',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const counts = await pool.query(
      "SELECT (SELECT COUNT(*) FROM public.users)::int AS public_users, (SELECT COUNT(*) FROM visitour_dev.users)::int AS visitour_users"
    );
    console.log('counts:', counts.rows[0]);

    const publicRows = await pool.query(
      'SELECT id, email, created_at FROM public.users ORDER BY created_at DESC LIMIT 5'
    );
    const visitourRows = await pool.query(
      'SELECT id, email, created_at FROM visitour_dev.users ORDER BY created_at DESC LIMIT 5'
    );

    console.log('public latest:', publicRows.rows);
    console.log('visitour_dev latest:', visitourRows.rows);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('error:', err.message);
  process.exit(1);
});

