import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:GAbrWFtdJgGRmfgzeyGgtlfhcPfmStdD@tramway.proxy.rlwy.net:39404/railway',
  ssl: { rejectUnauthorized: false }
});
async function checkUser() {
  try {
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      ['tarun.javadev@gmail.com']
    );
    console.log('User search result:', result.rows);
    const allUsers = await pool.query('SELECT id, email FROM users ORDER BY created_at DESC LIMIT 10');
    console.log('Last 10 users:', allUsers.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
checkUser();
