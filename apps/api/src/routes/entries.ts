import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { authMiddleware } from '../middleware/index.js';
import { CreateEntrySchema, UpdateEntrySchema } from '../utils/validators.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(authMiddleware);

// Get all entries for an itinerary
router.get('/itinerary/:itineraryId', async (req: Request, res: Response) => {
  try {
    // Verify ownership or public access
    const verify = await pool.query(
      'SELECT id, is_public FROM itineraries WHERE id = $1 AND (user_id = $2 OR is_public = true)',
      [req.params.itineraryId, req.userId]
    );

    if (verify.rows.length === 0) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const result = await pool.query(
      `SELECT id, day_number, date, title, description, location, time_start, time_end, category, custom_details, order_index, created_at, updated_at
       FROM itinerary_entries
       WHERE itinerary_id = $1
       ORDER BY date ASC, order_index ASC`,
      [req.params.itineraryId]
    );

    res.json({
      entries: result.rows.map((row) => ({
        id: row.id,
        dayNumber: row.day_number,
        date: row.date,
        title: row.title,
        description: row.description,
        location: row.location,
        timeStart: row.time_start,
        timeEnd: row.time_end,
        category: row.category,
        customDetails: row.custom_details,
        orderIndex: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch entries' });
  }
});

// Create a new entry
router.post('/itinerary/:itineraryId', async (req: Request, res: Response) => {
  try {
    const data = CreateEntrySchema.parse(req.body);

    // Verify ownership
    const verify = await pool.query(
      'SELECT id FROM itineraries WHERE id = $1 AND user_id = $2',
      [req.params.itineraryId, req.userId]
    );

    if (verify.rows.length === 0) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO itinerary_entries (id, itinerary_id, day_number, date, title, description, location, time_start, time_end, category, custom_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, day_number, date, title, description, location, time_start, time_end, category, custom_details, order_index, created_at, updated_at`,
      [
        id,
        req.params.itineraryId,
        data.dayNumber,
        data.date,
        data.title,
        data.description || null,
        data.location || null,
        data.timeStart || null,
        data.timeEnd || null,
        data.category,
        JSON.stringify(data.customDetails),
      ]
    );

    const row = result.rows[0];
    res.status(201).json({
      message: 'Entry created',
      entry: {
        id: row.id,
        dayNumber: row.day_number,
        date: row.date,
        title: row.title,
        description: row.description,
        location: row.location,
        timeStart: row.time_start,
        timeEnd: row.time_end,
        category: row.category,
        customDetails: row.custom_details,
        orderIndex: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create entry' });
  }
});

// Update an entry
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = UpdateEntrySchema.parse(req.body);

    // Verify ownership (through itinerary)
    const verify = await pool.query(
      `SELECT ie.id FROM itinerary_entries ie
       JOIN itineraries i ON ie.itinerary_id = i.id
       WHERE ie.id = $1 AND i.user_id = $2`,
      [req.params.id, req.userId]
    );

    if (verify.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (data.dayNumber !== undefined) {
      updates.push(`day_number = $${paramIndex}`);
      values.push(data.dayNumber);
      paramIndex++;
    }
    if (data.date !== undefined) {
      updates.push(`date = $${paramIndex}`);
      values.push(data.date);
      paramIndex++;
    }
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
    if (data.location !== undefined) {
      updates.push(`location = $${paramIndex}`);
      values.push(data.location);
      paramIndex++;
    }
    if (data.timeStart !== undefined) {
      updates.push(`time_start = $${paramIndex}`);
      values.push(data.timeStart);
      paramIndex++;
    }
    if (data.timeEnd !== undefined) {
      updates.push(`time_end = $${paramIndex}`);
      values.push(data.timeEnd);
      paramIndex++;
    }
    if (data.category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      values.push(data.category);
      paramIndex++;
    }
    if (data.customDetails !== undefined) {
      updates.push(`custom_details = $${paramIndex}`);
      values.push(JSON.stringify(data.customDetails));
      paramIndex++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.params.id);

    const query = `UPDATE itinerary_entries SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);
    const row = result.rows[0];

    res.json({
      message: 'Entry updated',
      entry: {
        id: row.id,
        dayNumber: row.day_number,
        date: row.date,
        title: row.title,
        description: row.description,
        location: row.location,
        timeStart: row.time_start,
        timeEnd: row.time_end,
        category: row.category,
        customDetails: row.custom_details,
        orderIndex: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update entry' });
  }
});

// Delete an entry
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Verify ownership
    const verify = await pool.query(
      `SELECT ie.id FROM itinerary_entries ie
       JOIN itineraries i ON ie.itinerary_id = i.id
       WHERE ie.id = $1 AND i.user_id = $2`,
      [req.params.id, req.userId]
    );

    if (verify.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    await pool.query('DELETE FROM itinerary_entries WHERE id = $1', [req.params.id]);

    res.json({ message: 'Entry deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete entry' });
  }
});

export default router;

