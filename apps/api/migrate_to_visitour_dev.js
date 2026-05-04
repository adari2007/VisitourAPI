import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:GAbrWFtdJgGRmfgzeyGgtlfhcPfmStdD@tramway.proxy.rlwy.net:39404/railway',
  ssl: { rejectUnauthorized: false }
});

async function migrateToVisitourDev() {
  const client = await pool.connect();

  try {
    console.log('Starting migration to visitour_dev schema...\n');

    // Step 1: Create visitour_dev schema
    console.log('Step 1: Creating visitour_dev schema...');
    await client.query('CREATE SCHEMA IF NOT EXISTS visitour_dev;');
    console.log('✓ visitour_dev schema created\n');

    // Step 2: Create tables in visitour_dev
    console.log('Step 2: Creating tables in visitour_dev...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS visitour_dev.users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS visitour_dev.itineraries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        owner_email TEXT NOT NULL,
        description TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        is_public BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS visitour_dev.itinerary_entries (
        id TEXT PRIMARY KEY,
        itinerary_id TEXT NOT NULL,
        day_number INTEGER,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        location TEXT,
        time_start TEXT,
        time_end TEXT,
        category TEXT NOT NULL,
        custom_details JSONB NOT NULL DEFAULT '{}'::jsonb,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT fk_entries_itinerary
          FOREIGN KEY(itinerary_id)
          REFERENCES visitour_dev.itineraries(id)
          ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS visitour_dev.itinerary_shares (
        id TEXT PRIMARY KEY,
        itinerary_id TEXT NOT NULL,
        email TEXT NOT NULL,
        access TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        share_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT fk_shares_itinerary
          FOREIGN KEY(itinerary_id)
          REFERENCES visitour_dev.itineraries(id)
          ON DELETE CASCADE
      );
    `);
    console.log('✓ Tables created\n');

    // Step 3: Copy data from public schema
    console.log('Step 3: Copying data from public schema...');

    // Count existing data
    const userCount = await client.query('SELECT COUNT(*) FROM public.users;');
    const itineraryCount = await client.query('SELECT COUNT(*) FROM public.itineraries;');
    const entriesCount = await client.query('SELECT COUNT(*) FROM public.itinerary_entries;');
    const sharesCount = await client.query('SELECT COUNT(*) FROM public.shared_itineraries;');

    console.log(`  Found ${userCount.rows[0].count} users`);
    console.log(`  Found ${itineraryCount.rows[0].count} itineraries`);
    console.log(`  Found ${entriesCount.rows[0].count} entries`);
    console.log(`  Found ${sharesCount.rows[0].count} shares\n`);

    // Copy users
    if (userCount.rows[0].count > 0) {
      await client.query(`
        INSERT INTO visitour_dev.users 
        SELECT * FROM public.users;
      `);
      console.log('  ✓ Users copied');
    }

    // Copy itineraries
    if (itineraryCount.rows[0].count > 0) {
      await client.query(`
        INSERT INTO visitour_dev.itineraries 
        SELECT * FROM public.itineraries;
      `);
      console.log('  ✓ Itineraries copied');
    }

    // Copy entries
    if (entriesCount.rows[0].count > 0) {
      await client.query(`
        INSERT INTO visitour_dev.itinerary_entries 
        SELECT * FROM public.itinerary_entries;
      `);
      console.log('  ✓ Entries copied');
    }

    // Copy shares
    if (sharesCount.rows[0].count > 0) {
      await client.query(`
        INSERT INTO visitour_dev.itinerary_shares 
        SELECT * FROM public.shared_itineraries;
      `);
      console.log('  ✓ Shares copied');
    }

    console.log('\nStep 4: Verifying migration...');
    const newUserCount = await client.query('SELECT COUNT(*) FROM visitour_dev.users;');
    const newItineraryCount = await client.query('SELECT COUNT(*) FROM visitour_dev.itineraries;');
    const newEntriesCount = await client.query('SELECT COUNT(*) FROM visitour_dev.itinerary_entries;');
    const newSharesCount = await client.query('SELECT COUNT(*) FROM visitour_dev.itinerary_shares;');

    console.log(`  ✓ visitour_dev.users: ${newUserCount.rows[0].count} records`);
    console.log(`  ✓ visitour_dev.itineraries: ${newItineraryCount.rows[0].count} records`);
    console.log(`  ✓ visitour_dev.itinerary_entries: ${newEntriesCount.rows[0].count} records`);
    console.log(`  ✓ visitour_dev.itinerary_shares: ${newSharesCount.rows[0].count} records`);

    console.log('\n✓ Migration to visitour_dev schema completed successfully!');

  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateToVisitourDev();

