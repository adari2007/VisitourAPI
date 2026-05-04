import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:GAbrWFtdJgGRmfgzeyGgtlfhcPfmStdD@tramway.proxy.rlwy.net:39404/railway',
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('Running database migrations...');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        profile_image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
      );
    `);

    // Create itineraries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS itineraries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create itinerary_entries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS itinerary_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL,
        date DATE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        time_start TIME,
        time_end TIME,
        category VARCHAR(50) DEFAULT 'activity',
        custom_details JSONB DEFAULT '{}',
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create shared_itineraries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shared_itineraries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
        shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission VARCHAR(20) DEFAULT 'view',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(itinerary_id, shared_with_user_id)
      );
    `);

    // Create indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_itineraries_user_id ON itineraries(user_id);`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_itinerary_entries_itinerary_id ON itinerary_entries(itinerary_id);`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_shared_itineraries_user_id ON shared_itineraries(shared_with_user_id);`
    );

    console.log('✓ Database migrations completed');
  } catch (error) {
    console.error('✗ Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();

