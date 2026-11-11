import datetime
from flask import Blueprint, jsonify
from ..database.db import query_one, query_all
from ..middleware.auth import authenticate

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')

@dashboard_bp.route('/stats', methods=['GET'])
@authenticate
def get_stats():
    total_patients = (query_one('SELECT COUNT(*) as count FROM patients') or {}).get('count', 0)
    admitted_patients = (query_one("SELECT COUNT(*) as count FROM admissions WHERE status = 'Admitted'") or {}).get('count', 0)

    # Beds
    total_beds = (query_one('SELECT COUNT(*) as count FROM beds') or {}).get('count', 0)
    available_beds = (query_one("SELECT COUNT(*) as count FROM beds WHERE status = 'Available'") or {}).get('count', 0)
    occupied_beds = (query_one("SELECT COUNT(*) as count FROM beds WHERE status = 'Occupied'") or {}).get('count', 0)
    emergency_beds_available = (query_one("SELECT COUNT(*) as count FROM beds WHERE category IN ('Emergency Bed', 'ICU') AND status = 'Available'") or {}).get('count', 0)

    # Doctors
    total_doctors = (query_one('SELECT COUNT(*) as count FROM doctors') or {}).get('count', 0)
    available_doctors = (query_one("SELECT COUNT(*) as count FROM doctors WHERE availability_status = 'Available'") or {}).get('count', 0)
    emergency_duty_doctors = (query_one("SELECT COUNT(*) as count FROM doctors WHERE is_emergency_duty = 1") or {}).get('count', 0)

    # Emergency cases
    active_emergencies = (query_one("SELECT COUNT(*) as count FROM emergency_cases WHERE status IN ('Waiting', 'Assigned', 'Under Treatment')") or {}).get('count', 0)
    critical_emergencies = (query_one("SELECT COUNT(*) as count FROM emergency_cases WHERE status IN ('Waiting', 'Assigned', 'Under Treatment') AND triage_priority = 'Critical'") or {}).get('count', 0)
    high_emergencies = (query_one("SELECT COUNT(*) as count FROM emergency_cases WHERE status IN ('Waiting', 'Assigned', 'Under Treatment') AND triage_priority = 'High'") or {}).get('count', 0)
    medium_emergencies = (query_one("SELECT COUNT(*) as count FROM emergency_cases WHERE status IN ('Waiting', 'Assigned', 'Under Treatment') AND triage_priority = 'Medium'") or {}).get('count', 0)
    low_emergencies = (query_one("SELECT COUNT(*) as count FROM emergency_cases WHERE status IN ('Waiting', 'Assigned', 'Under Treatment') AND triage_priority = 'Low'") or {}).get('count', 0)

    # Ambulances
    total_ambulances = (query_one('SELECT COUNT(*) as count FROM ambulances') or {}).get('count', 0)
    available_ambulances = (query_one("SELECT COUNT(*) as count FROM ambulances WHERE status = 'Available'") or {}).get('count', 0)
    dispatched_ambulances = (query_one("SELECT COUNT(*) as count FROM ambulances WHERE status IN ('Dispatched', 'On the Way')") or {}).get('count', 0)

    # Today's appointments
    today_str = datetime.date.today().isoformat()
    today_appointments = (query_one("SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ? AND status != 'Cancelled'", (today_str,)) or {}).get('count', 0)

    # Recent patients
    recent_patients = query_all('''
      SELECT id, patient_id, full_name, age, gender, phone, blood_group, current_status, created_at
      FROM patients
      ORDER BY id DESC
      LIMIT 5
    ''')

    # Recent emergency activity logs
    recent_activities = query_all('''
      SELECT l.id, l.emergency_case_id, l.action_type, l.performed_by_name, l.details, l.created_at,
             e.case_code, e.triage_priority, p.full_name as patient_name
      FROM emergency_activity_logs l
      JOIN emergency_cases e ON l.emergency_case_id = e.id
      JOIN patients p ON e.patient_id = p.id
      ORDER BY l.id DESC
      LIMIT 6
    ''')

    # Critical waiting cases snippet
    critical_waiting = query_all('''
      SELECT e.id, e.case_code, e.triage_priority, e.emergency_type, e.status, e.arrived_at, e.conscious_state,
             p.full_name as patient_name, p.age, p.gender, p.blood_group
      FROM emergency_cases e
      JOIN patients p ON e.patient_id = p.id
      WHERE e.status = 'Waiting' AND e.triage_priority = 'Critical'
      ORDER BY e.arrived_at ASC
    ''')

    return jsonify({
        'metrics': {
            'totalPatients': total_patients,
            'admittedPatients': admitted_patients,
            'totalBeds': total_beds,
            'availableBeds': available_beds,
            'occupiedBeds': occupied_beds,
            'emergencyBedsAvailable': emergency_beds_available,
            'totalDoctors': total_doctors,
            'availableDoctors': available_doctors,
            'emergencyDutyDoctors': emergency_duty_doctors,
            'activeEmergencies': active_emergencies,
            'criticalEmergencies': critical_emergencies,
            'highEmergencies': high_emergencies,
            'mediumEmergencies': medium_emergencies,
            'lowEmergencies': low_emergencies,
            'totalAmbulances': total_ambulances,
            'availableAmbulances': available_ambulances,
            'dispatchedAmbulances': dispatched_ambulances,
            'todayAppointments': today_appointments,
        },
        'recentPatients': recent_patients,
        'recentEmergencyActivities': recent_activities,
        'criticalWaitingCases': critical_waiting
    })

