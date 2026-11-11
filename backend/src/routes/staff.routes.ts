import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// 1. List staff members
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role } = req.query;

    let query = `SELECT id, username, full_name, email, role, department, phone, created_at FROM users WHERE 1=1`;
    const params: any[] = [];

    if (role && role !== 'All') {
      query += ` AND role = ?`;
      params.push(role);
    }

    query += ` ORDER BY id ASC`;

    const staff = db.prepare(query).all(...params);
    res.json({ staff });
  } catch (err: any) {
    console.error('List staff error:', err);
    res.status(500).json({ error: 'Failed to retrieve staff members.' });
  }
});

// 2. Add new staff member (Admin only)
router.post('/', authenticate, authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password, full_name, email, role, department, phone } = req.body;

    if (!username || !password || !full_name || !email || !role) {
      return res.status(400).json({ error: 'Username, password, full name, email, and role are required.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const stmt = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, email, role, department, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      username.trim().toLowerCase(),
      password_hash,
      full_name.trim(),
      email.trim().toLowerCase(),
      role,
      department ? department.trim() : null,
      phone ? phone.trim() : null
    );

    const created = db.prepare('SELECT id, username, full_name, email, role, department, phone, created_at FROM users WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({ message: 'Staff member created successfully', staff: created });
  } catch (err: any) {
    console.error('Create staff error:', err);
    res.status(500).json({ error: 'Failed to create staff member. (Username or email might already exist).' });
  }
});

// 3. Update staff member
router.put('/:id', authenticate, authorize(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { full_name, email, role, department, phone } = req.body;

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    db.prepare(`
      UPDATE users
      SET full_name = ?, email = ?, role = ?, department = ?, phone = ?
      WHERE id = ?
    `).run(full_name, email, role, department || null, phone || null, id);

    const updated = db.prepare('SELECT id, username, full_name, email, role, department, phone FROM users WHERE id = ?').get(id);
    res.json({ message: 'Staff member updated successfully', staff: updated });
  } catch (err: any) {
    console.error('Update staff error:', err);
    res.status(500).json({ error: 'Failed to update staff member.' });
  }
});

export default router;

