import { Router, Response } from 'express';
import db from '../database/db.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// 1. List appointments with filters
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, doctor_id, status } = req.query;

    let query = `
      SELECT apt.*,
        p.full_name as patient_name, p.patient_id as patient_code, p.phone as patient_phone,
        d.full_name as doctor_name, d.specialization as doctor_specialization
      FROM appointments apt
      JOIN patients p ON apt.patient_id = p.id
      JOIN doctors d ON apt.doctor_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (date && typeof date === 'string') {
      query += ` AND apt.appointment_date = ?`;
      params.push(date);
    }

    if (doctor_id && doctor_id !== 'All') {
      query += ` AND apt.doctor_id = ?`;
      params.push(doctor_id);
    }

    if (status && status !== 'All') {
      query += ` AND apt.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY apt.appointment_date ASC, apt.time_slot ASC, apt.id ASC`;

    const appointments = db.prepare(query).all(...params);
    res.json({ appointments });
  } catch (err: any) {
    console.error('List appointments error:', err);
    res.status(500).json({ error: 'Failed to retrieve appointments.' });
  }
});

// 2. Schedule new appointment
router.post('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patient_id, doctor_id, department, appointment_date, time_slot, reason_for_visit, notes } = req.body;

    if (!patient_id || !doctor_id || !department || !appointment_date || !time_slot) {
      return res.status(400).json({ error: 'Patient, doctor, department, date, and time slot are required.' });
    }

    // Generate appointment number
    const countApt = (db.prepare('SELECT COUNT(*) as count FROM appointments').get() as any).count;
    const appointment_number = `APT-${new Date().getFullYear()}-${String(countApt + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO appointments (
        appointment_number, patient_id, doctor_id, department,
        appointment_date, time_slot, reason_for_visit, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?)
    `);

    const result = stmt.run(
      appointment_number,
      patient_id,
      doctor_id,
      department.trim(),
      appointment_date,
      time_slot,
      reason_for_visit ? reason_for_visit.trim() : null,
      notes ? notes.trim() : null
    );

    const created = db.prepare('SELECT * FROM appointments WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({ message: 'Appointment scheduled successfully', appointment: created });
  } catch (err: any) {
    console.error('Schedule appointment error:', err);
    res.status(500).json({ error: 'Failed to schedule appointment.' });
  }
});

// 3. Update appointment status (Confirmed, Completed, Cancelled)
router.patch('/:id/status', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const valid = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid appointment status.' });
    }

    db.prepare(`
      UPDATE appointments
      SET status = ?,
          notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(status, notes || null, id);

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    res.json({ message: `Appointment status updated to ${status}`, appointment: updated });
  } catch (err: any) {
    console.error('Update appointment status error:', err);
    res.status(500).json({ error: 'Failed to update appointment status.' });
  }
});

export default router;

