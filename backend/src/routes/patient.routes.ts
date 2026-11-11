import { Router, Response } from 'express';
import db from '../database/db.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// List patients with search
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status } = req.query;
    let query = `
      SELECT p.*,
        (SELECT COUNT(*) FROM emergency_cases WHERE patient_id = p.id) as emergency_count,
        (SELECT COUNT(*) FROM admissions WHERE patient_id = p.id) as admission_count
      FROM patients p
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      query += ` AND (p.full_name LIKE ? OR p.patient_id LIKE ? OR p.phone LIKE ?)`;
      params.push(term, term, term);
    }

    if (status && typeof status === 'string' && status !== 'All') {
      query += ` AND p.current_status = ?`;
      params.push(status);
    }

    query += ` ORDER BY p.id DESC`;

    const patients = db.prepare(query).all(...params);
    res.json({ patients });
  } catch (err: any) {
    console.error('List patients error:', err);
    res.status(500).json({ error: 'Failed to retrieve patients.' });
  }
});

// Get single patient complete profile
router.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const patient = db.prepare('SELECT * FROM patients WHERE id = ? OR patient_id = ?').get(id, id) as any;
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    // Medical records
    const medicalRecords = db.prepare(`
      SELECT m.*, d.full_name as doctor_name, d.specialization
      FROM medical_records m
      LEFT JOIN doctors d ON m.doctor_id = d.id
      WHERE m.patient_id = ?
      ORDER BY m.id DESC
    `).all(patient.id);

    // Admissions
    const admissions = db.prepare(`
      SELECT a.*, b.bed_number, b.category as bed_category, b.ward_department, d.full_name as doctor_name
      FROM admissions a
      LEFT JOIN beds b ON a.bed_id = b.id
      LEFT JOIN doctors d ON a.attending_doctor_id = d.id
      WHERE a.patient_id = ?
      ORDER BY a.id DESC
    `).all(patient.id);

    // Emergency cases
    const emergencyCases = db.prepare(`
      SELECT e.*, d.full_name as doctor_name, b.bed_number
      FROM emergency_cases e
      LEFT JOIN doctors d ON e.assigned_doctor_id = d.id
      LEFT JOIN beds b ON e.assigned_bed_id = b.id
      WHERE e.patient_id = ?
      ORDER BY e.id DESC
    `).all(patient.id);

    // Appointments
    const appointments = db.prepare(`
      SELECT apt.*, d.full_name as doctor_name, d.specialization
      FROM appointments apt
      LEFT JOIN doctors d ON apt.doctor_id = d.id
      WHERE apt.patient_id = ?
      ORDER BY apt.appointment_date DESC, apt.id DESC
    `).all(patient.id);

    // Bills
    const bills = db.prepare(`
      SELECT b.*
      FROM bills b
      WHERE b.patient_id = ?
      ORDER BY b.id DESC
    `).all(patient.id);

    res.json({
      patient,
      medicalRecords,
      admissions,
      emergencyCases,
      appointments,
      bills,
    });
  } catch (err: any) {
    console.error('Get patient profile error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient profile.' });
  }
});

// Register new patient
router.post('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      full_name,
      age,
      gender,
      phone,
      email,
      address,
      blood_group,
      emergency_contact_name,
      emergency_contact_phone,
      medical_history,
    } = req.body;

    if (!full_name || !age || !gender || !phone) {
      return res.status(400).json({ error: 'Full name, age, gender, and phone number are required.' });
    }

    // Auto-generate patient ID: MF-P-XXXX
    const maxPatient = db.prepare('SELECT MAX(id) as maxId FROM patients').get() as any;
    const nextNum = (maxPatient?.maxId || 0) + 1001;
    const patient_id = `MF-P-${nextNum}`;

    const stmt = db.prepare(`
      INSERT INTO patients (
        patient_id, full_name, age, gender, phone, email, address,
        blood_group, emergency_contact_name, emergency_contact_phone, medical_history, current_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registered')
    `);

    const result = stmt.run(
      patient_id,
      full_name.trim(),
      parseInt(age, 10),
      gender,
      phone.trim(),
      email ? email.trim() : null,
      address ? address.trim() : null,
      blood_group || null,
      emergency_contact_name || null,
      emergency_contact_phone || null,
      medical_history || null
    );

    const created = db.prepare('SELECT * FROM patients WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({ message: 'Patient registered successfully', patient: created });
  } catch (err: any) {
    console.error('Create patient error:', err);
    res.status(500).json({ error: 'Failed to register patient.' });
  }
});

// Update patient details
router.put('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      age,
      gender,
      phone,
      email,
      address,
      blood_group,
      emergency_contact_name,
      emergency_contact_phone,
      medical_history,
      current_status,
    } = req.body;

    const existing = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const stmt = db.prepare(`
      UPDATE patients
      SET full_name = ?, age = ?, gender = ?, phone = ?, email = ?, address = ?,
          blood_group = ?, emergency_contact_name = ?, emergency_contact_phone = ?,
          medical_history = ?, current_status = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      full_name,
      parseInt(age, 10),
      gender,
      phone,
      email || null,
      address || null,
      blood_group || null,
      emergency_contact_name || null,
      emergency_contact_phone || null,
      medical_history || null,
      current_status || 'Registered',
      id
    );

    const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    res.json({ message: 'Patient updated successfully', patient: updated });
  } catch (err: any) {
    console.error('Update patient error:', err);
    res.status(500).json({ error: 'Failed to update patient.' });
  }
});

export default router;

