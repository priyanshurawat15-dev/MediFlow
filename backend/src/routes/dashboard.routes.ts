import { Router, Response } from 'express';
import db from '../database/db.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authenticate, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const totalPatients = (db.prepare('SELECT COUNT(*) as count FROM patients').get() as any).count;
    const admittedPatients = (db.prepare("SELECT COUNT(*) as count FROM admissions WHERE status = 'Admitted'").get() as any).count;
    
    // Beds
    const totalBeds = (db.prepare('SELECT COUNT(*) as count FROM beds').get() as any).count;
    const availableBeds = (db.prepare("SELECT COUNT(*) as count FROM beds WHERE status = 'Available'").get() as any).count;
    const occupiedBeds = (db.prepare("SELECT COUNT(*) as count FROM beds WHERE status = 'Occupied'").get() as any).count;
    const emergencyBedsAvailable = (db.prepare("SELECT COUNT(*) as count FROM beds WHERE category IN ('Emergency Bed', 'ICU') AND status = 'Available'").get() as any).count;

    // Doctors
    const totalDoctors = (db.prepare('SELECT COUNT(*) as count FROM doctors').get() as any).count;
    const availableDoctors = (db.prepare("SELECT COUNT(*) as count FROM doctors WHERE availability_status = 'Available'").get() as any).count;
    const emergencyDutyDoctors = (db.prepare("SELECT COUNT(*) as count FROM doctors WHERE is_emergency_duty = 1").get() as any).count;

    // Emergency Cases
    const activeEmergencies = (db.prepare("SELECT COUNT(*) as count FROM emergency_cases WHERE status IN ('Waiting', 'Assigned', 'Under Treatment')").get() as any).count;
    const criticalEmergencies = (db.prepare("SELECT COUNT(*) as count FROM emergency_cases WHERE status IN ('Waiting', 'Assigned', 'Under Treatment') AND triage_priority = 'Critical'").get() as any).count;
    const highEmergencies = (db.prepare("SELECT COUNT(*) as count FROM emergency_cases WHERE status IN ('Waiting', 'Assigned', 'Under Treatment') AND triage_priority = 'High'").get() as any).count;
    const mediumEmergencies = (db.prepare("SELECT COUNT(*) as count FROM emergency_cases WHERE status IN ('Waiting', 'Assigned', 'Under Treatment') AND triage_priority = 'Medium'").get() as any).count;
    const lowEmergencies = (db.prepare("SELECT COUNT(*) as count FROM emergency_cases WHERE status IN ('Waiting', 'Assigned', 'Under Treatment') AND triage_priority = 'Low'").get() as any).count;

    // Ambulances
    const totalAmbulances = (db.prepare('SELECT COUNT(*) as count FROM ambulances').get() as any).count;
    const availableAmbulances = (db.prepare("SELECT COUNT(*) as count FROM ambulances WHERE status = 'Available'").get() as any).count;
    const dispatchedAmbulances = (db.prepare("SELECT COUNT(*) as count FROM ambulances WHERE status IN ('Dispatched', 'On the Way')").get() as any).count;

    // Appointments Today
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = (db.prepare("SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ? AND status != 'Cancelled'").get(today) as any).count;

    // Recent Patient Registrations
    const recentPatients = db.prepare(`
      SELECT id, patient_id, full_name, age, gender, phone, blood_group, current_status, created_at
      FROM patients
      ORDER BY id DESC
      LIMIT 5
    `).all();

    // Recent Emergency Activities
    const recentEmergencyActivities = db.prepare(`
      SELECT l.id, l.emergency_case_id, l.action_type, l.performed_by_name, l.details, l.created_at,
             e.case_code, e.triage_priority, p.full_name as patient_name
      FROM emergency_activity_logs l
      JOIN emergency_cases e ON l.emergency_case_id = e.id
      JOIN patients p ON e.patient_id = p.id
      ORDER BY l.id DESC
      LIMIT 6
    `).all();

    // Critical queue snippet
    const criticalWaitingCases = db.prepare(`
      SELECT e.id, e.case_code, e.triage_priority, e.emergency_type, e.status, e.arrived_at, e.conscious_state,
             p.full_name as patient_name, p.age, p.gender, p.blood_group
      FROM emergency_cases e
      JOIN patients p ON e.patient_id = p.id
      WHERE e.status = 'Waiting' AND e.triage_priority = 'Critical'
      ORDER BY e.arrived_at ASC
    `).all();

    res.json({
      metrics: {
        totalPatients,
        admittedPatients,
        totalBeds,
        availableBeds,
        occupiedBeds,
        emergencyBedsAvailable,
        totalDoctors,
        availableDoctors,
        emergencyDutyDoctors,
        activeEmergencies,
        criticalEmergencies,
        highEmergencies,
        mediumEmergencies,
        lowEmergencies,
        totalAmbulances,
        availableAmbulances,
        dispatchedAmbulances,
        todayAppointments,
      },
      recentPatients,
      recentEmergencyActivities,
      criticalWaitingCases,
    });
  } catch (err: any) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to load dashboard metrics.' });
  }
});

export default router;

