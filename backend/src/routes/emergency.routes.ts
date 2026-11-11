import { Router, Response } from 'express';
import db from '../database/db.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const PRIORITY_MAP: Record<string, number> = {
  Critical: 1,
  High: 2,
  Medium: 3,
  Low: 4,
};

// Thresholds for waiting time escalation (in minutes)
const ESCALATION_THRESHOLDS: Record<string, number> = {
  Critical: 10,
  High: 30,
  Medium: 60,
  Low: 120,
};

// Helper to log emergency activities
function logEmergencyActivity(
  emergencyCaseId: number,
  actionType: string,
  user: any,
  details: string
) {
  const stmt = db.prepare(`
    INSERT INTO emergency_activity_logs (
      emergency_case_id, action_type, performed_by_user_id, performed_by_name, details
    ) VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(
    emergencyCaseId,
    actionType,
    user?.id || null,
    user?.full_name || 'Medical Staff',
    details
  );
}

// 1. Get Emergency Queue (Sorted by Clinical Priority First, then Arrival Time)
router.get('/cases', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, priority, search } = req.query;

    let query = `
      SELECT e.*,
        p.full_name as patient_name, p.patient_id as patient_code, p.age, p.gender, p.blood_group, p.phone as patient_phone,
        d.full_name as doctor_name, d.specialization as doctor_specialization,
        b.bed_number, b.category as bed_category, b.ward_department as bed_ward,
        (SELECT vehicle_number FROM ambulances WHERE current_emergency_case_id = e.id LIMIT 1) as linked_ambulance
      FROM emergency_cases e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN doctors d ON e.assigned_doctor_id = d.id
      LEFT JOIN beds b ON e.assigned_bed_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'All') {
      query += ` AND e.status = ?`;
      params.push(status);
    }

    if (priority && priority !== 'All') {
      query += ` AND e.triage_priority = ?`;
      params.push(priority);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      query += ` AND (p.full_name LIKE ? OR e.case_code LIKE ? OR p.patient_id LIKE ?)`;
      params.push(term, term, term);
    }

    // Strict priority sorting:
    // 1. Waiting cases first, then Assigned, then Under Treatment, then Transferred/Resolved
    // 2. Priority weight (1=Critical, 2=High, 3=Medium, 4=Low)
    // 3. Waiting time within the same priority (earliest arrived first)
    query += `
      ORDER BY 
        CASE 
          WHEN e.status = 'Waiting' THEN 1
          WHEN e.status = 'Assigned' THEN 2
          WHEN e.status = 'Under Treatment' THEN 3
          WHEN e.status = 'Transferred' THEN 4
          ELSE 5
        END ASC,
        e.priority_weight ASC,
        e.arrived_at ASC
    `;

    const rawCases = db.prepare(query).all(...params) as any[];

    const now = Date.now();
    const cases = rawCases.map((c) => {
      const arrivedTime = new Date(c.arrived_at).getTime();
      const waitingMinutes = Math.max(0, Math.floor((now - arrivedTime) / (1000 * 60)));

      // Check if case is escalated based on threshold while still waiting
      const threshold = ESCALATION_THRESHOLDS[c.triage_priority] || 60;
      const isEscalated = c.status === 'Waiting' && waitingMinutes > threshold;

      let elapsedTreatmentMinutes = 0;
      if (c.treatment_started_at) {
        elapsedTreatmentMinutes = Math.max(
          0,
          Math.floor((now - new Date(c.treatment_started_at).getTime()) / (1000 * 60))
        );
      }

      return {
        ...c,
        waiting_minutes: waitingMinutes,
        is_escalated: isEscalated || c.escalated === 1,
        escalation_threshold_minutes: threshold,
        elapsed_treatment_minutes: elapsedTreatmentMinutes,
      };
    });

    res.json({ cases });
  } catch (err: any) {
    console.error('List emergency cases error:', err);
    res.status(500).json({ error: 'Failed to retrieve emergency queue.' });
  }
});

// 2. Get Single Emergency Case with Full Activity History
router.get('/cases/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT e.*,
        p.full_name as patient_name, p.patient_id as patient_code, p.age, p.gender, p.blood_group,
        p.phone as patient_phone, p.emergency_contact_name, p.emergency_contact_phone, p.medical_history,
        d.full_name as doctor_name, d.specialization as doctor_specialization, d.phone as doctor_phone,
        b.bed_number, b.category as bed_category, b.ward_department as bed_ward, b.floor as bed_floor
      FROM emergency_cases e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN doctors d ON e.assigned_doctor_id = d.id
      LEFT JOIN beds b ON e.assigned_bed_id = b.id
      WHERE e.id = ? OR e.case_code = ?
    `;

    const item = db.prepare(query).get(id, id) as any;
    if (!item) {
      return res.status(404).json({ error: 'Emergency case not found.' });
    }

    const logs = db.prepare(`
      SELECT * FROM emergency_activity_logs
      WHERE emergency_case_id = ?
      ORDER BY id ASC
    `).all(item.id);

    res.json({ case: item, logs });
  } catch (err: any) {
    console.error('Get emergency case details error:', err);
    res.status(500).json({ error: 'Failed to load emergency case details.' });
  }
});

// 3. Register Emergency Case (with Inline Patient Registration if needed)
router.post('/cases', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patient_id, // Existing patient ID, or null if creating inline
      // Inline patient fields if registering new
      new_patient,
      emergency_type,
      triage_priority,
      conscious_state,
      systolic_bp,
      diastolic_bp,
      heart_rate,
      respiratory_rate,
      spo2,
      temperature,
      triage_notes,
      assigned_doctor_id,
      assigned_bed_id,
    } = req.body;

    if (!emergency_type || !triage_priority) {
      return res.status(400).json({ error: 'Emergency type and triage priority are required.' });
    }

    let targetPatientId = patient_id;

    // Handle inline patient registration if requested
    if (!targetPatientId && new_patient) {
      const maxPatient = db.prepare('SELECT MAX(id) as maxId FROM patients').get() as any;
      const nextNum = (maxPatient?.maxId || 0) + 1001;
      const genPatientId = `MF-P-${nextNum}`;

      const createPatStmt = db.prepare(`
        INSERT INTO patients (
          patient_id, full_name, age, gender, phone, blood_group,
          emergency_contact_name, emergency_contact_phone, medical_history, current_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Under Emergency')
      `);

      const pRes = createPatStmt.run(
        genPatientId,
        new_patient.full_name?.trim() || 'Unknown Patient',
        parseInt(new_patient.age || '0', 10),
        new_patient.gender || 'Unknown',
        new_patient.phone?.trim() || 'N/A',
        new_patient.blood_group || null,
        new_patient.emergency_contact_name || null,
        new_patient.emergency_contact_phone || null,
        new_patient.medical_history || null
      );
      targetPatientId = Number(pRes.lastInsertRowid);
    } else if (targetPatientId) {
      // Mark patient current status as 'Under Emergency'
      db.prepare("UPDATE patients SET current_status = 'Under Emergency' WHERE id = ?").run(targetPatientId);
    }

    if (!targetPatientId) {
      return res.status(400).json({ error: 'A valid patient must be selected or registered.' });
    }

    // Auto-generate Case Code: EMG-YYYY-XXX
    const year = new Date().getFullYear();
    const countToday = (db.prepare('SELECT COUNT(*) as count FROM emergency_cases').get() as any).count;
    const case_code = `EMG-${year}-${String(countToday + 1).padStart(3, '0')}`;

    const priorityWeight = PRIORITY_MAP[triage_priority] || 4;
    const initialStatus = assigned_doctor_id && assigned_bed_id ? 'Assigned' : 'Waiting';

    const insertCaseStmt = db.prepare(`
      INSERT INTO emergency_cases (
        case_code, patient_id, emergency_type, triage_priority, priority_weight,
        conscious_state, systolic_bp, diastolic_bp, heart_rate, respiratory_rate, spo2, temperature,
        triage_notes, triaged_by_user_id, triaged_by_name, assigned_doctor_id, assigned_bed_id,
        status, arrived_at, assigned_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `);

    const assignedAt = initialStatus === 'Assigned' ? new Date().toISOString() : null;

    const result = insertCaseStmt.run(
      case_code,
      targetPatientId,
      emergency_type,
      triage_priority,
      priorityWeight,
      conscious_state || 'Alert',
      systolic_bp ? parseInt(systolic_bp, 10) : null,
      diastolic_bp ? parseInt(diastolic_bp, 10) : null,
      heart_rate ? parseInt(heart_rate, 10) : null,
      respiratory_rate ? parseInt(respiratory_rate, 10) : null,
      spo2 ? parseInt(spo2, 10) : null,
      temperature ? parseFloat(temperature) : null,
      triage_notes || null,
      req.user?.id || null,
      req.user?.full_name || 'Medical Staff',
      assigned_doctor_id || null,
      assigned_bed_id || null,
      initialStatus,
      assignedAt
    );

    const emergencyCaseId = Number(result.lastInsertRowid);

    // If bed was assigned, mark bed occupied
    if (assigned_bed_id) {
      db.prepare("UPDATE beds SET status = 'Occupied', current_patient_id = ? WHERE id = ?").run(targetPatientId, assigned_bed_id);
    }
    // If doctor assigned, bump doctor active count
    if (assigned_doctor_id) {
      db.prepare('UPDATE doctors SET current_patient_count = current_patient_count + 1 WHERE id = ?').run(assigned_doctor_id);
    }

    // Audit logs
    logEmergencyActivity(
      emergencyCaseId,
      'REGISTERED',
      req.user,
      `Emergency case ${case_code} registered. Clinical presentation: ${emergency_type}.`
    );

    logEmergencyActivity(
      emergencyCaseId,
      'TRIAGED',
      req.user,
      `Triage category assigned: Priority ${priorityWeight} (${triage_priority}). Conscious state: ${conscious_state || 'Alert'}. Staff notes: ${triage_notes || 'None'}.`
    );

    if (assigned_doctor_id || assigned_bed_id) {
      logEmergencyActivity(
        emergencyCaseId,
        'DOCTOR_ASSIGNED',
        req.user,
        `Directly assigned to doctor ID ${assigned_doctor_id || 'N/A'} and bed ID ${assigned_bed_id || 'N/A'}.`
      );
    }

    const created = db.prepare('SELECT * FROM emergency_cases WHERE id = ?').get(emergencyCaseId);
    res.status(201).json({ message: 'Emergency case registered successfully', case: created });
  } catch (err: any) {
    console.error('Register emergency case error:', err);
    res.status(500).json({ error: 'Failed to register emergency case.' });
  }
});

// 4. Assign Doctor & Bed to Emergency Case (with concurrency lock protection)
router.post('/cases/:id/assign', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { doctor_id, bed_id, override_reason } = req.body;

    const emgCase = db.prepare('SELECT * FROM emergency_cases WHERE id = ?').get(id) as any;
    if (!emgCase) {
      return res.status(404).json({ error: 'Emergency case not found.' });
    }

    // Concurrency protection for Bed allocation
    if (bed_id) {
      const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(bed_id) as any;
      if (!bed) {
        return res.status(404).json({ error: 'Selected bed does not exist.' });
      }
      if (bed.status !== 'Available' && bed.id !== emgCase.assigned_bed_id) {
        return res.status(409).json({
          error: `Bed ${bed.bed_number} was just occupied by another patient (${bed.status}). Please select another bed.`,
        });
      }

      // If patient had a previous bed assigned, release it
      if (emgCase.assigned_bed_id && emgCase.assigned_bed_id !== bed_id) {
        db.prepare("UPDATE beds SET status = 'Available', current_patient_id = null WHERE id = ?").run(emgCase.assigned_bed_id);
      }

      // Allocate new bed
      db.prepare("UPDATE beds SET status = 'Occupied', current_patient_id = ? WHERE id = ?").run(emgCase.patient_id, bed_id);
    }

    // Doctor assignment
    if (doctor_id && doctor_id !== emgCase.assigned_doctor_id) {
      db.prepare('UPDATE doctors SET current_patient_count = current_patient_count + 1 WHERE id = ?').run(doctor_id);
    }

    const newStatus = emgCase.status === 'Waiting' ? 'Assigned' : emgCase.status;

    db.prepare(`
      UPDATE emergency_cases
      SET assigned_doctor_id = COALESCE(?, assigned_doctor_id),
          assigned_bed_id = COALESCE(?, assigned_bed_id),
          status = ?,
          assigned_at = COALESCE(assigned_at, datetime('now')),
          override_reason = CASE WHEN ? IS NOT NULL THEN ? ELSE override_reason END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(doctor_id || null, bed_id || null, newStatus, override_reason || null, override_reason || null, id);

    // Audit logs
    let details = 'Assigned clinical resources: ';
    if (doctor_id) {
      const doc = db.prepare('SELECT full_name, specialization FROM doctors WHERE id = ?').get(doctor_id) as any;
      details += `Dr. ${doc?.full_name} (${doc?.specialization}). `;
    }
    if (bed_id) {
      const bed = db.prepare('SELECT bed_number, category FROM beds WHERE id = ?').get(bed_id) as any;
      details += `Bed: ${bed?.bed_number} (${bed?.category}). `;
    }
    if (override_reason) {
      details += `Assignment override note: ${override_reason}`;
      logEmergencyActivity(Number(id), 'OVERRIDE_ASSIGNMENT', req.user, details);
    } else {
      logEmergencyActivity(Number(id), 'DOCTOR_ASSIGNED', req.user, details);
    }

    const updated = db.prepare('SELECT * FROM emergency_cases WHERE id = ?').get(id);
    res.json({ message: 'Emergency case assigned successfully', case: updated });
  } catch (err: any) {
    console.error('Assign emergency resources error:', err);
    res.status(500).json({ error: 'Failed to assign emergency resources.' });
  }
});

// 5. Update Emergency Case Status (Waiting -> Assigned -> Under Treatment -> Transferred -> Resolved)
router.patch('/cases/:id/status', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, discharge_destination } = req.body;

    const validStatuses = ['Waiting', 'Assigned', 'Under Treatment', 'Transferred', 'Resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    const emgCase = db.prepare('SELECT * FROM emergency_cases WHERE id = ?').get(id) as any;
    if (!emgCase) {
      return res.status(404).json({ error: 'Emergency case not found.' });
    }

    let treatmentStartedAt = emgCase.treatment_started_at;
    let resolvedAt = emgCase.resolved_at;

    if (status === 'Under Treatment' && !treatmentStartedAt) {
      treatmentStartedAt = new Date().toISOString();
    }
    if (status === 'Resolved' || status === 'Transferred') {
      resolvedAt = new Date().toISOString();
    }

    db.prepare(`
      UPDATE emergency_cases
      SET status = ?,
          treatment_started_at = ?,
          resolved_at = ?,
          resolution_notes = COALESCE(?, resolution_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(status, treatmentStartedAt, resolvedAt, notes || null, id);

    // If case is resolved or transferred, release the bed (mark as Cleaning or Available)
    if ((status === 'Resolved' || status === 'Transferred') && emgCase.assigned_bed_id) {
      db.prepare("UPDATE beds SET status = 'Cleaning', current_patient_id = null WHERE id = ?").run(emgCase.assigned_bed_id);
    }

    // Update patient status accordingly
    if (status === 'Resolved') {
      db.prepare("UPDATE patients SET current_status = 'Discharged' WHERE id = ?").run(emgCase.patient_id);
    } else if (status === 'Transferred') {
      db.prepare("UPDATE patients SET current_status = 'Admitted' WHERE id = ?").run(emgCase.patient_id);
    }

    logEmergencyActivity(
      Number(id),
      status === 'Resolved' ? 'CASE_RESOLVED' : 'STATUS_CHANGE',
      req.user,
      `Status changed from '${emgCase.status}' to '${status}'. ${notes ? `Clinical notes: ${notes}.` : ''} ${discharge_destination ? `Destination: ${discharge_destination}` : ''}`
    );

    const updated = db.prepare('SELECT * FROM emergency_cases WHERE id = ?').get(id);
    res.json({ message: `Emergency case status updated to ${status}`, case: updated });
  } catch (err: any) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update emergency case status.' });
  }
});

// 6. Medical Staff Reassessment / Priority Update
router.post('/cases/:id/reassess-triage', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { triage_priority, triage_notes, vitals } = req.body;

    if (!triage_priority || !PRIORITY_MAP[triage_priority]) {
      return res.status(400).json({ error: 'Valid triage priority is required.' });
    }

    const emgCase = db.prepare('SELECT * FROM emergency_cases WHERE id = ?').get(id) as any;
    if (!emgCase) {
      return res.status(404).json({ error: 'Emergency case not found.' });
    }

    const oldPriority = emgCase.triage_priority;
    const newWeight = PRIORITY_MAP[triage_priority];

    db.prepare(`
      UPDATE emergency_cases
      SET triage_priority = ?,
          priority_weight = ?,
          triage_notes = COALESCE(?, triage_notes),
          systolic_bp = COALESCE(?, systolic_bp),
          diastolic_bp = COALESCE(?, diastolic_bp),
          heart_rate = COALESCE(?, heart_rate),
          spo2 = COALESCE(?, spo2),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      triage_priority,
      newWeight,
      triage_notes || null,
      vitals?.systolic_bp || null,
      vitals?.diastolic_bp || null,
      vitals?.heart_rate || null,
      vitals?.spo2 || null,
      id
    );

    logEmergencyActivity(
      Number(id),
      'PRIORITY_UPDATED',
      req.user,
      `Triage reassessment by medical staff: Priority updated from '${oldPriority}' to '${triage_priority}' (Weight ${newWeight}). Clinical reason: ${triage_notes || 'Routine vitals reassessment'}.`
    );

    const updated = db.prepare('SELECT * FROM emergency_cases WHERE id = ?').get(id);
    res.json({ message: 'Triage priority reassessed successfully', case: updated });
  } catch (err: any) {
    console.error('Reassess triage error:', err);
    res.status(500).json({ error: 'Failed to reassess triage priority.' });
  }
});

// 7. Get Available Emergency Resources (Available Doctors + ICU/Emergency Beds)
router.get('/resources', authenticate, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const doctors = db.prepare(`
      SELECT id, doctor_code, full_name, specialization, department, phone, availability_status, is_emergency_duty, current_patient_count
      FROM doctors
      WHERE availability_status = 'Available' OR is_emergency_duty = 1
      ORDER BY is_emergency_duty DESC, current_patient_count ASC
    `).all();

    const beds = db.prepare(`
      SELECT id, bed_number, category, ward_department, floor, daily_charge, status
      FROM beds
      WHERE status = 'Available'
      ORDER BY 
        CASE 
          WHEN category = 'Emergency Bed' THEN 1
          WHEN category = 'ICU' THEN 2
          WHEN category = 'HDU' THEN 3
          ELSE 4
        END ASC
    `).all();

    res.json({ doctors, beds });
  } catch (err: any) {
    console.error('Get emergency resources error:', err);
    res.status(500).json({ error: 'Failed to retrieve available resources.' });
  }
});

export default router;

