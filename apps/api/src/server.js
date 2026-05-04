import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { Pool } from 'pg';
import { loadEnvironment } from './config/env-loader.js';

loadEnvironment();

const app = express();
const httpServer = http.createServer(app);

const corsOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const io = new Server(httpServer, {
  cors: { origin: corsOrigins.length > 0 ? corsOrigins : '*' },
});

app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : '*',
  })
);
app.use(express.json());

const dbUrl = process.env.DATABASE_URL;
const dbHost = process.env.DATABASE_HOST;
const dbPort = Number(process.env.DATABASE_PORT || 5432);
const dbUser = process.env.DATABASE_USER;
const dbPassword = process.env.DATABASE_PASSWORD;
const dbName = process.env.DATABASE_NAME;

const parseBoolEnv = (value) => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
};

const hasDiscreteDbConfig = Boolean(dbHost && dbUser && dbPassword && dbName);
if (!dbUrl && !hasDiscreteDbConfig) {
  throw new Error(
    'Database configuration is required. Set DATABASE_URL or DATABASE_HOST/DATABASE_PORT/DATABASE_USER/DATABASE_PASSWORD/DATABASE_NAME in apps/api/.env'
  );
}

const DB_SCHEMA = process.env.DB_SCHEMA || 'visitour_dev';
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(DB_SCHEMA)) {
  throw new Error(`Invalid DB_SCHEMA: ${DB_SCHEMA}`);
}
const SCHEMA_IDENT = `"${DB_SCHEMA}"`;
const T = {
  users: `${SCHEMA_IDENT}.users`,
  itineraries: `${SCHEMA_IDENT}.itineraries`,
  entries: `${SCHEMA_IDENT}.entries`,
  shares: `${SCHEMA_IDENT}.itinerary_shares`,
};

const dbSsl = parseBoolEnv(process.env.DB_SSL);
const dbSslRejectUnauthorized = parseBoolEnv(process.env.DB_SSL_REJECT_UNAUTHORIZED);
const isLocalDbHost = dbHost ? ['localhost', '127.0.0.1'].includes(dbHost) : false;
const isLocalDbUrl = dbUrl ? /@(localhost|127\.0\.0\.1)(:|\/|$)/.test(dbUrl) : false;
const sslEnabled = dbSsl ?? Boolean((dbUrl && !isLocalDbUrl) || (!dbUrl && dbHost && !isLocalDbHost));
const sslConfig = sslEnabled
  ? { rejectUnauthorized: dbSslRejectUnauthorized ?? false }
  : undefined;

const pool = new Pool(
  dbUrl
    ? {
        connectionString: dbUrl,
        ssl: sslConfig,
      }
    : {
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        ssl: sslConfig,
      }
);

const makeId = (prefix = '') => `${prefix}${Math.random().toString(36).slice(2, 11)}`;
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const verifyDatabaseObjects = async () => {
  const required = [T.users, T.itineraries, T.entries, T.shares];
  for (const fqTable of required) {
    const { rows } = await pool.query('SELECT to_regclass($1) AS regclass', [fqTable]);
    if (!rows[0]?.regclass) {
      throw new Error(
        `Missing required table ${fqTable}. Run database migrations/setup first. Runtime DDL is disabled.`
      );
    }
  }
};

const getUserById = async (id) => {
  if (!id) return null;
  const { rows } = await pool.query(
    `SELECT id, email, first_name AS "firstName", last_name AS "lastName" FROM ${T.users} WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

const getRequestUser = async (req) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token.startsWith('token_')) return null;
  const userId = token.slice('token_'.length);
  return getUserById(userId);
};

const getShareForUser = async (itineraryId, user) => {
  if (!user) return null;
  const { rows } = await pool.query(
    `SELECT * FROM ${T.shares} WHERE itinerary_id = $1 AND lower(email) = $2 LIMIT 1`,
    [itineraryId, normalizeEmail(user.email)]
  );
  return rows[0] || null;
};

const canViewItinerary = async (itinerary, user) => {
  if (!itinerary || !user) return false;
  if (itinerary.ownerId === user.id) return true;
  if (itinerary.isPublic) return true;
  return Boolean(await getShareForUser(itinerary.id, user));
};

const canEditItinerary = async (itinerary, user) => {
  if (!itinerary || !user) return false;
  if (itinerary.ownerId === user.id) return true;
  const share = await getShareForUser(itinerary.id, user);
  return share?.access === 'edit';
};

const mapItinerary = (row) => ({
  id: row.id,
  title: row.title,
  ownerId: row.owner_id,
  ownerEmail: row.owner_email,
  description: row.description,
  startDate: row.start_date,
  endDate: row.end_date,
  isPublic: row.is_public,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapEntry = (row) => ({
  id: row.id,
  itineraryId: row.itinerary_id,
  dayNumber: row.day_number,
  date: row.date,
  title: row.title,
  description: row.description,
  location: row.location,
  timeStart: row.time_start,
  timeEnd: row.time_end,
  category: row.category,
  customDetails: row.custom_details || {},
  orderIndex: row.order_index,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
  const { email, password, firstName, lastName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const normalized = normalizeEmail(email);
  const existing = await pool.query(`SELECT id FROM ${T.users} WHERE email = $1 LIMIT 1`, [normalized]);
  if (existing.rowCount > 0) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const id = makeId('usr_');
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO ${T.users} (id, email, password, first_name, last_name, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, normalized, password, firstName || null, lastName || null, now, now]
  );
  res.status(201).json({
    message: 'User registered',
    user: { id, email: normalized, firstName, lastName },
    token: `token_${id}`,
  });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
  const { email, password } = req.body;
  const normalized = normalizeEmail(email);
  const { rows } = await pool.query(
    `SELECT id, email, password, first_name, last_name FROM ${T.users} WHERE email = $1 LIMIT 1`,
    [normalized]
  );
  const user = rows[0];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({
    message: 'Login successful',
    user: { id: user.id, email: user.email },
    token: `token_${user.id}`,
  });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Itineraries endpoints
app.get('/api/itineraries', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { rows } = await pool.query(
    `SELECT DISTINCT i.*
     FROM ${T.itineraries} i
     LEFT JOIN ${T.shares} s
       ON s.itinerary_id = i.id
      AND lower(s.email) = $1
     WHERE i.owner_id = $2
        OR i.is_public = true
        OR s.id IS NOT NULL
     ORDER BY i.created_at DESC`,
    [normalizeEmail(user.email), user.id]
  );
  const visible = rows.map(mapItinerary);
  res.json({ itineraries: visible });
});

// Get all public itineraries (accessible to authenticated users)
app.get('/api/itineraries/public/all', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${T.itineraries}
       WHERE is_public = true
       ORDER BY created_at DESC`
    );

    const itineraries = rows.map(mapItinerary);
    res.json({ itineraries });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to fetch public itineraries' });
  }
});

app.post('/api/itineraries', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { title, description, startDate, endDate, isPublic } = req.body;
  if (!title || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const id = makeId('itr_');
  const now = new Date().toISOString();
  const itinerary = {
    id,
    title,
    ownerId: user.id,
    ownerEmail: user.email,
    description,
    startDate,
    endDate,
    isPublic: isPublic || false,
    createdAt: now,
    updatedAt: now,
  };

  await pool.query(
    `INSERT INTO ${T.itineraries} (id, title, owner_id, owner_email, description, start_date, end_date, is_public, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      itinerary.id,
      itinerary.title,
      itinerary.ownerId,
      itinerary.ownerEmail,
      itinerary.description || null,
      itinerary.startDate,
      itinerary.endDate,
      itinerary.isPublic,
      itinerary.createdAt,
      itinerary.updatedAt,
    ]
  );
  res.status(201).json({ message: 'Itinerary created', itinerary });
});

app.get('/api/itineraries/:id', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { rows } = await pool.query(`SELECT * FROM ${T.itineraries} WHERE id = $1 LIMIT 1`, [req.params.id]);
  const itinerary = rows[0] ? mapItinerary(rows[0]) : null;
  if (!itinerary) {
    return res.status(404).json({ error: 'Itinerary not found' });
  }
  if (!(await canViewItinerary(itinerary, user))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json({ itinerary });
});

app.put('/api/itineraries/:id', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const existingRes = await pool.query(`SELECT * FROM ${T.itineraries} WHERE id = $1 LIMIT 1`, [req.params.id]);
  const itinerary = existingRes.rows[0] ? mapItinerary(existingRes.rows[0]) : null;
  if (!itinerary) {
    return res.status(404).json({ error: 'Itinerary not found' });
  }
  if (!(await canEditItinerary(itinerary, user))) {
    return res.status(403).json({ error: 'Edit access required' });
  }

  const updates = { ...itinerary, ...req.body, updatedAt: new Date().toISOString() };
  await pool.query(
    `UPDATE ${T.itineraries}
        SET title = $1,
            description = $2,
            start_date = $3,
            end_date = $4,
            is_public = $5,
            updated_at = $6
      WHERE id = $7`,
    [
      updates.title,
      updates.description || null,
      updates.startDate,
      updates.endDate,
      Boolean(updates.isPublic),
      updates.updatedAt,
      updates.id,
    ]
  );
  res.json({ message: 'Itinerary updated', itinerary: updates });
});

app.delete('/api/itineraries/:id', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const existingRes = await pool.query(`SELECT * FROM ${T.itineraries} WHERE id = $1 LIMIT 1`, [req.params.id]);
  const itinerary = existingRes.rows[0] ? mapItinerary(existingRes.rows[0]) : null;
  if (!itinerary) {
    return res.status(404).json({ error: 'Itinerary not found' });
  }
  if (itinerary.ownerId !== user.id) {
    return res.status(403).json({ error: 'Only owner can delete itinerary' });
  }

  await pool.query(`DELETE FROM ${T.itineraries} WHERE id = $1`, [req.params.id]);
  res.json({ message: 'Itinerary deleted' });
});

// Share management endpoints
app.get('/api/itineraries/:id/shares', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const itineraryRes = await pool.query(`SELECT * FROM ${T.itineraries} WHERE id = $1 LIMIT 1`, [req.params.id]);
  const itinerary = itineraryRes.rows[0] ? mapItinerary(itineraryRes.rows[0]) : null;
  if (!itinerary) {
    return res.status(404).json({ error: 'Itinerary not found' });
  }
  if (!(await canViewItinerary(itinerary, user))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const sharesRes = await pool.query(`SELECT * FROM ${T.shares} WHERE itinerary_id = $1 ORDER BY created_at DESC`, [req.params.id]);
  const shares = sharesRes.rows;
  res.json({ shares });
});

app.post('/api/itineraries/:id/shares', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const itineraryId = req.params.id;
  const { email, access } = req.body;

  const itineraryRes = await pool.query(`SELECT * FROM ${T.itineraries} WHERE id = $1 LIMIT 1`, [itineraryId]);
  const itinerary = itineraryRes.rows[0] ? mapItinerary(itineraryRes.rows[0]) : null;
  if (!itinerary) {
    return res.status(404).json({ error: 'Itinerary not found' });
  }
  if (!(await canEditItinerary(itinerary, user))) {
    return res.status(403).json({ error: 'Edit access required' });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const permission = access === 'edit' ? 'edit' : 'view';
  const shareId = makeId('share_');
  const token = makeId('token_');
  const now = new Date().toISOString();
  const share = {
    id: shareId,
    itineraryId,
    email,
    access: permission,
    token,
    shareUrl: `${req.protocol}://${req.get('host')}/api/shares/${token}`,
    createdAt: now,
    updatedAt: now,
  };

  const existingShare = await pool.query(
    `SELECT * FROM ${T.shares} WHERE itinerary_id = $1 AND lower(email) = $2 LIMIT 1`,
    [itineraryId, normalizeEmail(email)]
  );

  if (existingShare.rowCount > 0) {
    const updatedShare = {
      ...existingShare.rows[0],
      access: permission,
      updated_at: now,
    };
    await pool.query(
      `UPDATE ${T.shares} SET access = $1, updated_at = $2 WHERE id = $3`,
      [permission, now, existingShare.rows[0].id]
    );
    return res.json({ message: 'Share updated', share: updatedShare });
  }

  await pool.query(
    `INSERT INTO ${T.shares} (id, itinerary_id, email, access, token, share_url, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [share.id, share.itineraryId, normalizeEmail(share.email), share.access, share.token, share.shareUrl, share.createdAt, share.updatedAt]
  );
  return res.status(201).json({ message: 'Share created', share });
});

app.patch('/api/itineraries/:id/shares/:shareId', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const itineraryId = req.params.id;
  const { shareId } = req.params;
  const { access } = req.body;

  const itineraryRes = await pool.query(`SELECT * FROM ${T.itineraries} WHERE id = $1 LIMIT 1`, [itineraryId]);
  const itinerary = itineraryRes.rows[0] ? mapItinerary(itineraryRes.rows[0]) : null;
  if (!itinerary) {
    return res.status(404).json({ error: 'Itinerary not found' });
  }
  if (!(await canEditItinerary(itinerary, user))) {
    return res.status(403).json({ error: 'Edit access required' });
  }

  const shareRes = await pool.query(
    `SELECT * FROM ${T.shares} WHERE itinerary_id = $1 AND id = $2 LIMIT 1`,
    [itineraryId, shareId]
  );
  if (shareRes.rowCount === 0) {
    return res.status(404).json({ error: 'Share not found' });
  }

  const nextAccess = access === 'edit' ? 'edit' : 'view';
  const updatedAt = new Date().toISOString();
  await pool.query(
    `UPDATE ${T.shares} SET access = $1, updated_at = $2 WHERE id = $3`,
    [nextAccess, updatedAt, shareId]
  );

  const updated = { ...shareRes.rows[0], access: nextAccess, updated_at: updatedAt };
  res.json({ message: 'Share permission updated', share: updated });
});

app.delete('/api/itineraries/:id/shares/:shareId', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const itineraryId = req.params.id;
  const { shareId } = req.params;

  const itineraryRes = await pool.query(`SELECT * FROM ${T.itineraries} WHERE id = $1 LIMIT 1`, [itineraryId]);
  const itinerary = itineraryRes.rows[0] ? mapItinerary(itineraryRes.rows[0]) : null;
  if (!itinerary) {
    return res.status(404).json({ error: 'Itinerary not found' });
  }
  if (!(await canEditItinerary(itinerary, user))) {
    return res.status(403).json({ error: 'Edit access required' });
  }

  const result = await pool.query(
    `DELETE FROM ${T.shares} WHERE itinerary_id = $1 AND id = $2`,
    [itineraryId, shareId]
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Share not found' });
  }
  res.json({ message: 'Share removed' });
});

app.get('/api/shares/:token', async (req, res) => {
  const { token } = req.params;
  const shareRes = await pool.query(
    `SELECT * FROM ${T.shares} WHERE token = $1 LIMIT 1`,
    [token]
  );
  const share = shareRes.rows[0];
  if (!share) {
    return res.status(404).json({ error: 'Invalid share token' });
  }

  const itineraryRes = await pool.query(`SELECT * FROM ${T.itineraries} WHERE id = $1 LIMIT 1`, [share.itinerary_id]);
  const itinerary = itineraryRes.rows[0] ? mapItinerary(itineraryRes.rows[0]) : null;
  if (!itinerary) {
    return res.status(404).json({ error: 'Itinerary not found' });
  }

  return res.json({ itinerary, access: share.access, share });
});

// Entries endpoints
app.get('/api/entries/itinerary/:itineraryId', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const itineraryRes = await pool.query(`SELECT * FROM ${T.itineraries} WHERE id = $1 LIMIT 1`, [req.params.itineraryId]);
  const itinerary = itineraryRes.rows[0] ? mapItinerary(itineraryRes.rows[0]) : null;
  if (!itinerary) {
    return res.status(404).json({ error: 'Itinerary not found' });
  }
  if (!(await canViewItinerary(itinerary, user))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const entriesRes = await pool.query(
    `SELECT * FROM ${T.entries} WHERE itinerary_id = $1 ORDER BY date ASC, COALESCE(time_start, '') ASC`,
    [req.params.itineraryId]
  );
  const itineraryEntries = entriesRes.rows.map(mapEntry);
  res.json({ entries: itineraryEntries });
});

app.post('/api/entries/itinerary/:itineraryId', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const itineraryRes = await pool.query(`SELECT * FROM ${T.itineraries} WHERE id = $1 LIMIT 1`, [req.params.itineraryId]);
  const itinerary = itineraryRes.rows[0] ? mapItinerary(itineraryRes.rows[0]) : null;
  if (!itinerary) {
    return res.status(404).json({ error: 'Itinerary not found' });
  }
  if (!(await canEditItinerary(itinerary, user))) {
    return res.status(403).json({ error: 'Edit access required' });
  }

  const {
    dayNumber,
    date,
    title,
    description,
    location,
    timeStart,
    timeEnd,
    category,
    customDetails,
  } = req.body;

  if (!req.params.itineraryId || !title || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = makeId('ent_');
  const now = new Date().toISOString();
  const entry = {
    id,
    itineraryId: req.params.itineraryId,
    dayNumber,
    date,
    title,
    description,
    location,
    timeStart,
    timeEnd,
    category: category || 'activity',
    customDetails: customDetails || {},
    orderIndex: 0,
    createdAt: now,
    updatedAt: now,
  };

  await pool.query(
    `INSERT INTO ${T.entries} (id, itinerary_id, day_number, date, title, description, location, time_start, time_end, category, custom_details, order_index, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      entry.id,
      entry.itineraryId,
      entry.dayNumber ?? null,
      entry.date,
      entry.title,
      entry.description || null,
      entry.location || null,
      entry.timeStart || null,
      entry.timeEnd || null,
      entry.category,
      JSON.stringify(entry.customDetails || {}),
      entry.orderIndex ?? 0,
      entry.createdAt,
      entry.updatedAt,
    ]
  );
  res.status(201).json({ message: 'Entry created', entry });
});

app.put('/api/entries/:id', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const entryRes = await pool.query(`SELECT * FROM ${T.entries} WHERE id = $1 LIMIT 1`, [req.params.id]);
  const entry = entryRes.rows[0] ? mapEntry(entryRes.rows[0]) : null;
  if (!entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  const itineraryRes = await pool.query(`SELECT * FROM ${T.itineraries} WHERE id = $1 LIMIT 1`, [entry.itineraryId]);
  const itinerary = itineraryRes.rows[0] ? mapItinerary(itineraryRes.rows[0]) : null;
  if (!itinerary) {
    return res.status(404).json({ error: 'Itinerary not found' });
  }
  if (!(await canEditItinerary(itinerary, user))) {
    return res.status(403).json({ error: 'Edit access required' });
  }

  const updated = { ...entry, ...req.body, updatedAt: new Date().toISOString() };

  await pool.query(
    `UPDATE ${T.entries}
        SET day_number = $1,
            date = $2,
            title = $3,
            description = $4,
            location = $5,
            time_start = $6,
            time_end = $7,
            category = $8,
            custom_details = $9,
            order_index = $10,
            updated_at = $11
      WHERE id = $12`,
    [
      updated.dayNumber ?? null,
      updated.date,
      updated.title,
      updated.description || null,
      updated.location || null,
      updated.timeStart || null,
      updated.timeEnd || null,
      updated.category,
      JSON.stringify(updated.customDetails || {}),
      updated.orderIndex ?? 0,
      updated.updatedAt,
      updated.id,
    ]
  );
  res.json({ message: 'Entry updated', entry: updated });
});

app.delete('/api/entries/:id', async (req, res) => {
  const user = await getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const entryRes = await pool.query(`SELECT * FROM ${T.entries} WHERE id = $1 LIMIT 1`, [req.params.id]);
  const entry = entryRes.rows[0] ? mapEntry(entryRes.rows[0]) : null;
  if (!entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  const itineraryRes = await pool.query(`SELECT * FROM ${T.itineraries} WHERE id = $1 LIMIT 1`, [entry.itineraryId]);
  const itinerary = itineraryRes.rows[0] ? mapItinerary(itineraryRes.rows[0]) : null;
  if (!itinerary) {
    return res.status(404).json({ error: 'Itinerary not found' });
  }
  if (!(await canEditItinerary(itinerary, user))) {
    return res.status(403).json({ error: 'Edit access required' });
  }

  await pool.query(`DELETE FROM ${T.entries} WHERE id = $1`, [req.params.id]);
  res.json({ message: 'Entry deleted' });
});

// Socket.io events
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join-itinerary', (itineraryId) => {
    socket.join(`itinerary:${itineraryId}`);
  });

  socket.on('entry-created', (data) => {
    io.to(`itinerary:${data.itineraryId}`).emit('entry-created', data);
  });

  socket.on('entry-updated', (data) => {
    io.to(`itinerary:${data.itineraryId}`).emit('entry-updated', data);
  });

  socket.on('entry-deleted', (data) => {
    io.to(`itinerary:${data.itineraryId}`).emit('entry-deleted', data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = Number(process.env.PORT || 3000);

verifyDatabaseObjects()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ WebSocket available at ws://localhost:${PORT}`);
      console.log(`✓ API ready: http://localhost:${PORT}/api/health`);
      console.log('✓ Using PostgreSQL persistence');
      console.log(`✓ Using schema: ${DB_SCHEMA}`);
    });
  })
  .catch((error) => {
    console.error('Failed to verify database objects:', error);
    process.exit(1);
  });

