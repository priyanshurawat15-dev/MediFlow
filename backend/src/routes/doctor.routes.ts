import { Router, Response } from 'express';
import db from '../database/db.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// 1. List doctors with filtering
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { specialization, availability, emergency_only, department } = req.query;

    let query = `
      SELECT d.*, u.username
      FROM doctors d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (specialization && specialization !== 'All') {
      query += ` AND d.specialization = ?`;
      params.push(specialization);
    }

    if (department && department !== 'All') {
      query += ` AND d.department = ?`;
      params.push(department);
    }

    if (availability && availability !== 'All') {
      query += ` AND d.availability_status = ?`;
      params.push(availability);
    }

    if (emergency_only === 'true' || emergency_only === '1') {
      query += ` AND d.is_emergency_duty = 1`;
    }

    query += ` ORDER BY d.is_emergency_duty DESC, d.availability_status ASC, d.id ASC`;

    const doctors = db.prepare(query).all(...params);
    res.json({ doctors });
  } catch (err: any) {
    console.error('List doctors error:', err);
    res.status(500).json({ error: 'Failed to retrieve doctors.' });
  }
});

// 2. Get single doctor profile with assigned cases and appointments
router.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ? OR doctor_code = ?').get(id, id) as any;
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    // Active emergency cases
    const activeEmergencies = db.prepare(`
      SELECT e.*, p.full_name as patient_name, p.patient_id as patient_code, b.bed_number
      FROM emergency_cases e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN beds b ON e.assigned_bed_id = b.id
      WHERE e.assigned_doctor_id = ? AND e.status IN ('Assigned', 'Under Treatment')
      ORDER BY e.priority_weight ASC
    `).all(doctor.id);

    // Admitted patients under this doctor
    const admittedPatients = db.prepare(`
      SELECT a.*, p.full_name as patient_name, p.patient_id as patient_code, b.bed_number, b.category as bed_category
      FROM admissions a
      JOIN patients p ON a.patient_id = p.id
      JOIN beds b ON a.bed_id = b.id
      WHERE a.attending_doctor_id = ? AND a.status = 'Admitted'
    `).all(doctor.id);

    // Appointments
    const appointments = db.prepare(`
      SELECT apt.*, p.full_name as patient_name, p.phone as patient_phone
      FROM appointments apt
      JOIN patients p ON apt.patient_id = p.id
      WHERE apt.doctor_id = ?
      ORDER BY apt.appointment_date ASC, apt.time_slot ASC
    `).all(doctor.id);

    res.json({
      doctor,
      activeEmergencies,
      admittedPatients,
      appointments,
    });
  } catch (err: any) {
    console.error('Get doctor details error:', err);
    res.status(500).json({ error: 'Failed to retrieve doctor details.' });
  }
});

// 3. Add new doctor
router.post('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      full_name,
      specialization,
      department,
      phone,
      email,
      duty_schedule,
      is_emergency_duty,
      user_id,
    } = req.body;

    if (!full_name || !specialization || !department || !phone || !email) {
      return res.status(400).json({ error: 'Full name, specialization, department, phone, and email are required.' });
    }

    const countDocs = (db.prepare('SELECT COUNT(*) as count FROM doctors').get() as any).count;
    const doctor_code = `MF-DOC-${String(countDocs + 1).padStart(2, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO doctors (
        doctor_code, user_id, full_name, specialization, department, phone, email,
        duty_schedule, availability_status, is_emergency_duty, current_patient_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, 0)
    `);

    const result = stmt.run(
      doctor_code,
      user_id || null,
      full_name.trim(),
      specialization.trim(),
      department.trim(),
      phone.trim(),
      email.trim(),
      duty_schedule ? duty_schedule.trim() : 'Regular Shift (09:00 - 17:00)',
      is_emergency_duty ? 1 : 0
    );

    const created = db.prepare('SELECT * FROM doctors WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({ message: 'Doctor registered successfully', doctor: created });
  } catch (err: any) {
    console.error('Create doctor error:', err);
    res.status(500).json({ error: 'Failed to register doctor.' });
  }
});

// 4. Update availability status or emergency duty
router.patch('/:id/status', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { availability_status, is_emergency_duty, duty_schedule } = req.body;

    const existing = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    db.prepare(`
      UPDATE doctors
      SET availability_status = COALESCE(?, availability_status),
          is_emergency_duty = COALESCE(?, is_emergency_duty),
          duty_schedule = COALESCE(?, duty_schedule)
      WHERE id = ?
    `).run(
      availability_status || null,
      typeof is_emergency_duty === 'boolean' ? (is_emergency_duty ? 1 : 0) : (is_emergency_duty ?? null),
      duty_schedule || null,
      id
    );

    const updated = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
    res.json({ message: 'Doctor status updated successfully', doctor: updated });
  } catch (err: any) {
    console.error('Update doctor status error:', err);
    res.status(500).json({ error: 'Failed to update doctor status.' });
  }
});

export default router;

