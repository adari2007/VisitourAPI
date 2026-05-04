import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { authMiddleware } from '../middleware/index.js';
import { CreateItinerarySchema, UpdateItinerarySchema, UpdateItineraryPublicSchema } from '../utils/validators.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(authMiddleware);

// Get all public itineraries (accessible to authenticated users)
router.get('/public/all', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, start_date, end_date, is_public, user_id, created_at, updated_at
       FROM itineraries
       WHERE is_public = true
       ORDER BY created_at DESC`,
    );

    console.log('Public itineraries query result:', result.rows.length, 'rows found');
    console.log('Raw data:', result.rows);

    // Get user email for each itinerary
    const itinerariesWithOwner = await Promise.all(
      result.rows.map(async (row) => {
        let ownerEmail = '';
        try {
          const userResult = await pool.query(
            'SELECT email FROM users WHERE id = $1',
            [row.user_id]
          );
          ownerEmail = userResult.rows[0]?.email || '';
        } catch (err) {
          console.error('Failed to fetch owner email:', err);
        }

        return {
          id: row.id,
          title: row.title,
          description: row.description,
          startDate: row.start_date,
          endDate: row.end_date,
          isPublic: row.is_public,
          ownerEmail,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      })
    );

    res.json({
      itineraries: itinerariesWithOwner,
    });
    console.log('Returning public itineraries:', itinerariesWithOwner.length);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch public itineraries' });
  }
});

// Get all itineraries for the current user
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, start_date, end_date, is_public, created_at, updated_at
       FROM itineraries
       WHERE user_id = $1
       ORDER BY start_date DESC`,
      [req.userId]
    );

    res.json({
      itineraries: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        startDate: row.start_date,
        endDate: row.end_date,
        isPublic: row.is_public,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch itineraries' });
  }
});

// Create a new itinerary
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = CreateItinerarySchema.parse(req.body);
    const id = uuidv4();

    const result = await pool.query(
      `INSERT INTO itineraries (id, user_id, title, description, start_date, end_date, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, description, start_date, end_date, is_public, created_at, updated_at`,
      [id, req.userId, data.title, data.description || null, data.startDate, data.endDate, data.isPublic]
    );

    const row = result.rows[0];
    res.status(201).json({
      message: 'Itinerary created',
      itinerary: {
        id: row.id,
        title: row.title,
        description: row.description,
        startDate: row.start_date,
        endDate: row.end_date,
        isPublic: row.is_public,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create itinerary' });
  }
});

// Get a specific itinerary
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, start_date, end_date, is_public, user_id, created_at, updated_at
       FROM itineraries
       WHERE id = $1 AND (user_id = $2 OR is_public = true)`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const row = result.rows[0];
    res.json({
      itinerary: {
        id: row.id,
        title: row.title,
        description: row.description,
        startDate: row.start_date,
        endDate: row.end_date,
        isPublic: row.is_public,
        ownerId: row.user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch itinerary' });
  }
});

// Update an itinerary
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // Check if only isPublic is being updated
    const isOnlyPublicUpdate = Object.keys(req.body).length === 1 && req.body.isPublic !== undefined;

    console.log('PUT /itineraries/:id called');
    console.log('Itinerary ID:', req.params.id);
    console.log('Request body:', req.body);
    console.log('Is only public update:', isOnlyPublicUpdate);

    let data;
    if (isOnlyPublicUpdate) {
      data = UpdateItineraryPublicSchema.parse(req.body);
    } else {
      data = UpdateItinerarySchema.parse(req.body);
    }

    // Check ownership
    const check = await pool.query('SELECT id FROM itineraries WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    console.log('Building update query...');

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      values.push(data.title);
      paramIndex++;
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(data.description);
      paramIndex++;
    }
    if (data.startDate !== undefined) {
      updates.push(`start_date = $${paramIndex}`);
      values.push(data.startDate);
      paramIndex++;
    }
    if (data.endDate !== undefined) {
      updates.push(`end_date = $${paramIndex}`);
      values.push(data.endDate);
      paramIndex++;
    }
    if (data.isPublic !== undefined) {
      console.log('Setting is_public to:', data.isPublic);
      updates.push(`is_public = $${paramIndex}`);
      values.push(data.isPublic);
      paramIndex++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.params.id);

    const query = `UPDATE itineraries SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    console.log('Final query:', query);
    console.log('Query values:', values);

    const result = await pool.query(query, values);
    console.log('Update result rows:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('Updated itinerary is_public:', result.rows[0].is_public);
    }

    const row = result.rows[0];

    res.json({
      message: 'Itinerary updated',
      itinerary: {
        id: row.id,
        title: row.title,
        description: row.description,
        startDate: row.start_date,
        endDate: row.end_date,
        isPublic: row.is_public,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update itinerary' });
  }
});

// Delete an itinerary
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'DELETE FROM itineraries WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    res.json({ message: 'Itinerary deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete itinerary' });
  }
});

export default router;

