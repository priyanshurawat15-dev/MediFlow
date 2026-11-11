import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';
import { generateToken, authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const authPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      email: user.email,
    };

    const token = generateToken(authPayload);

    // If user is a doctor, get their doctor ID
    let doctorProfile = null;
    if (user.role === 'doctor') {
      doctorProfile = db.prepare('SELECT * FROM doctors WHERE user_id = ?').get(user.id);
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        ...authPayload,
        department: user.department,
        phone: user.phone,
        doctorProfile,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
});

// Current user profile
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = db.prepare('SELECT id, username, full_name, email, role, department, phone, created_at FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  let doctorProfile = null;
  if (user.role === 'doctor') {
    doctorProfile = db.prepare('SELECT * FROM doctors WHERE user_id = ?').get(user.id);
  }

  res.json({
    user: {
      ...user,
      doctorProfile,
    },
  });
});

// Demo accounts for quick testing and reviewer switching
router.get('/demo-accounts', (_req: Request, res: Response) => {
  const demoUsers = [
    { username: 'admin', role: 'admin', label: 'Hospital Admin', name: 'Dr. Rajiv Sharma', department: 'Hospital Administration' },
    { username: 'dr.ananya', role: 'doctor', label: 'Emergency Doctor', name: 'Dr. Ananya Sen', department: 'Emergency Medicine' },
    { username: 'nurse.sarah', role: 'nurse', label: 'Triage Nurse', name: 'Sarah Thomas, RN', department: 'Emergency Triage' },
    { username: 'recep.rohit', role: 'receptionist', label: 'Reception & Billing', name: 'Rohit Verma', department: 'Central Reception' },
    { username: 'driver.arun', role: 'ambulance', label: 'EMS Dispatch Driver', name: 'Arun Kumar', department: 'Rapid EMS Dispatch' },
  ];
  res.json({ demoUsers });
});

export default router;

