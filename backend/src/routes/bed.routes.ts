import { Router, Response } from 'express';
import db from '../database/db.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// 1. List all beds with occupancy details
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, status, ward } = req.query;

    let query = `
      SELECT b.*,
        p.full_name as patient_name, p.patient_id as patient_code, p.age as patient_age, p.gender as patient_gender,
        (SELECT diagnosis FROM admissions WHERE bed_id = b.id AND status = 'Admitted' LIMIT 1) as admission_diagnosis,
        (SELECT case_code FROM emergency_cases WHERE assigned_bed_id = b.id AND status IN ('Waiting', 'Assigned', 'Under Treatment') LIMIT 1) as linked_emergency_case
      FROM beds b
      LEFT JOIN patients p ON b.current_patient_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (category && category !== 'All') {
      query += ` AND b.category = ?`;
      params.push(category);
    }

    if (status && status !== 'All') {
      query += ` AND b.status = ?`;
      params.push(status);
    }

    if (ward && ward !== 'All') {
      query += ` AND b.ward_department = ?`;
      params.push(ward);
    }

    query += ` ORDER BY b.category ASC, b.bed_number ASC`;

    const beds = db.prepare(query).all(...params);
    res.json({ beds });
  } catch (err: any) {
    console.error('List beds error:', err);
    res.status(500).json({ error: 'Failed to retrieve beds.' });
  }
});

// 2. Summary counts by category
router.get('/summary', authenticate, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = ['Emergency Bed', 'ICU', 'HDU', 'General Ward', 'Private Room'];
    const summary: Record<string, { total: number; available: number; occupied: number; maintenance: number }> = {};

    categories.forEach((cat) => {
      const total = (db.prepare('SELECT COUNT(*) as count FROM beds WHERE category = ?').get(cat) as any).count;
      const available = (db.prepare("SELECT COUNT(*) as count FROM beds WHERE category = ? AND status = 'Available'").get(cat) as any).count;
      const occupied = (db.prepare("SELECT COUNT(*) as count FROM beds WHERE category = ? AND status = 'Occupied'").get(cat) as any).count;
      const maintenance = (db.prepare("SELECT COUNT(*) as count FROM beds WHERE category = ? AND status IN ('Maintenance', 'Cleaning')").get(cat) as any).count;

      summary[cat] = { total, available, occupied, maintenance };
    });

    const overall = {
      total: (db.prepare('SELECT COUNT(*) as count FROM beds').get() as any).count,
      available: (db.prepare("SELECT COUNT(*) as count FROM beds WHERE status = 'Available'").get() as any).count,
      occupied: (db.prepare("SELECT COUNT(*) as count FROM beds WHERE status = 'Occupied'").get() as any).count,
      maintenance: (db.prepare("SELECT COUNT(*) as count FROM beds WHERE status IN ('Maintenance', 'Cleaning')").get() as any).count,
    };

    res.json({ summary, overall });
  } catch (err: any) {
    console.error('Beds summary error:', err);
    res.status(500).json({ error: 'Failed to retrieve bed summary.' });
  }
});

// 3. Add new bed
router.post('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bed_number, category, ward_department, floor, daily_charge } = req.body;
    if (!bed_number || !category || !ward_department || !floor) {
      return res.status(400).json({ error: 'Bed number, category, ward, and floor are required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO beds (bed_number, category, ward_department, floor, daily_charge, status)
      VALUES (?, ?, ?, ?, ?, 'Available')
    `);

    const result = stmt.run(
      bed_number.toUpperCase().trim(),
      category,
      ward_department.trim(),
      floor.trim(),
      daily_charge ? parseFloat(daily_charge) : 500
    );

    const created = db.prepare('SELECT * FROM beds WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({ message: 'Bed added successfully', bed: created });
  } catch (err: any) {
    console.error('Add bed error:', err);
    res.status(500).json({ error: 'Failed to add bed. (Make sure bed number is unique).' });
  }
});

// 4. Allocate bed to patient (General admission)
router.post('/:id/allocate', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { patient_id, doctor_id, diagnosis, admission_type } = req.body;

    if (!patient_id) {
      return res.status(400).json({ error: 'Patient ID is required for bed allocation.' });
    }

    const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(id) as any;
    if (!bed) {
      return res.status(404).json({ error: 'Bed not found.' });
    }
    if (bed.status !== 'Available') {
      return res.status(409).json({ error: `Bed ${bed.bed_number} is not available (Status: ${bed.status}).` });
    }

    // Auto-generate admission number
    const countAdm = (db.prepare('SELECT COUNT(*) as count FROM admissions').get() as any).count;
    const admissionNumber = `ADM-${new Date().getFullYear()}-${String(countAdm + 1).padStart(3, '0')}`;

    const admRes = db.prepare(`
      INSERT INTO admissions (admission_number, patient_id, bed_id, attending_doctor_id, admission_type, diagnosis, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Admitted')
    `).run(
      admissionNumber,
      patient_id,
      id,
      doctor_id || null,
      admission_type || 'General',
      diagnosis || null
    );

    // Update bed
    db.prepare(`
      UPDATE beds
      SET status = 'Occupied',
          current_patient_id = ?,
          current_admission_id = ?
      WHERE id = ?
    `).run(patient_id, Number(admRes.lastInsertRowid), id);

    // Update patient status
    db.prepare("UPDATE patients SET current_status = 'Admitted' WHERE id = ?").run(patient_id);

    const updatedBed = db.prepare('SELECT * FROM beds WHERE id = ?').get(id);
    res.json({ message: `Bed ${bed.bed_number} allocated successfully`, bed: updatedBed });
  } catch (err: any) {
    console.error('Allocate bed error:', err);
    res.status(500).json({ error: 'Failed to allocate bed.' });
  }
});

// 5. Transfer patient from one bed to another
router.post('/:id/transfer', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // current bed id
    const { target_bed_id, transfer_reason } = req.body;

    if (!target_bed_id) {
      return res.status(400).json({ error: 'Target bed ID is required.' });
    }

    const currentBed = db.prepare('SELECT * FROM beds WHERE id = ?').get(id) as any;
    const targetBed = db.prepare('SELECT * FROM beds WHERE id = ?').get(target_bed_id) as any;

    if (!currentBed || !currentBed.current_patient_id) {
      return res.status(400).json({ error: 'Current bed has no assigned patient to transfer.' });
    }
    if (!targetBed || targetBed.status !== 'Available') {
      return res.status(409).json({ error: `Target bed is not available (${targetBed?.status}).` });
    }

    const patientId = currentBed.current_patient_id;
    const admissionId = currentBed.current_admission_id;

    // Update target bed
    db.prepare(`
      UPDATE beds
      SET status = 'Occupied',
          current_patient_id = ?,
          current_admission_id = ?
      WHERE id = ?
    `).run(patientId, admissionId, target_bed_id);

    // Update current bed to Cleaning
    db.prepare(`
      UPDATE beds
      SET status = 'Cleaning',
          current_patient_id = null,
          current_admission_id = null
      WHERE id = ?
    `).run(id);

    // Update admission record if exists
    if (admissionId) {
      db.prepare('UPDATE admissions SET bed_id = ? WHERE id = ?').run(target_bed_id, admissionId);
    }

    // Update emergency case if active on this bed
    db.prepare('UPDATE emergency_cases SET assigned_bed_id = ? WHERE assigned_bed_id = ?').run(target_bed_id, id);

    res.json({
      message: `Patient transferred from ${currentBed.bed_number} to ${targetBed.bed_number} successfully.`,
      target_bed: targetBed,
    });
  } catch (err: any) {
    console.error('Transfer bed error:', err);
    res.status(500).json({ error: 'Failed to transfer patient.' });
  }
});

// 6. Release bed (Discharge)
router.post('/:id/release', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status_after } = req.body; // 'Available' or 'Cleaning'

    const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(id) as any;
    if (!bed) {
      return res.status(404).json({ error: 'Bed not found.' });
    }

    const patientId = bed.current_patient_id;
    const admissionId = bed.current_admission_id;

    // Mark admission as discharged
    if (admissionId) {
      db.prepare(`
        UPDATE admissions
        SET status = 'Discharged',
            discharge_date = datetime('now')
        WHERE id = ?
      `).run(admissionId);
    }

    // Update patient status if they are not in active emergency
    if (patientId) {
      const activeEmg = db.prepare("SELECT COUNT(*) as count FROM emergency_cases WHERE patient_id = ? AND status IN ('Waiting', 'Assigned', 'Under Treatment')").get(patientId) as any;
      if (activeEmg.count === 0) {
        db.prepare("UPDATE patients SET current_status = 'Discharged' WHERE id = ?").run(patientId);
      }
    }

    // Release bed
    db.prepare(`
      UPDATE beds
      SET status = ?,
          current_patient_id = null,
          current_admission_id = null
      WHERE id = ?
    `).run(status_after || 'Cleaning', id);

    const updated = db.prepare('SELECT * FROM beds WHERE id = ?').get(id);
    res.json({ message: `Bed ${bed.bed_number} released successfully`, bed: updated });
  } catch (err: any) {
    console.error('Release bed error:', err);
    res.status(500).json({ error: 'Failed to release bed.' });
  }
});

export default router;

