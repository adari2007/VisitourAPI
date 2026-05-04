import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { RegisterSchema, LoginSchema } from '../utils/validators.js';
import { hashPassword, comparePasswords } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = RegisterSchema.parse(req.body);

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [data.email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(data.password);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, first_name, last_name, created_at`,
      [data.email, passwordHash, data.firstName || null, data.lastName || null]
    );

    const user = result.rows[0];
    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      token,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = LoginSchema.parse(req.body);

    const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [
      data.email,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const passwordMatch = await comparePasswords(data.password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
      },
      token,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Login failed' });
  }
});

export default router;

