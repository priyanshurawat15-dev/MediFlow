import datetime
from flask import Blueprint, request, jsonify, g
from ..database.db import query_all, query_one, execute_insert, execute_write
from ..middleware.auth import authenticate

emergency_bp = Blueprint('emergency', __name__, url_prefix='/api/emergency')

PRIORITY_MAP = {
    'Critical': 1,
    'High': 2,
    'Medium': 3,
    'Low': 4
}

ESCALATION_THRESHOLDS = {
    'Critical': 10,
    'High': 30,
    'Medium': 60,
    'Low': 120
}

def log_emergency_activity(case_id: int, action_type: str, user: dict, details: str):
    sql = '''
      INSERT INTO emergency_activity_logs (
        emergency_case_id, action_type, performed_by_user_id, performed_by_name, details
      ) VALUES (?, ?, ?, ?, ?)
    '''
    execute_insert(sql, (
        case_id,
        action_type,
        user.get('id') if user else None,
        user.get('full_name') if user else 'Medical Staff',
        details
    ))

def parse_iso_datetime(dt_str):
    if not dt_str:
        return None
    try:
        # SQLite datetime format is usually 'YYYY-MM-DD HH:MM:SS' or ISO 'YYYY-MM-DDTHH:MM:SS...'
        dt_str = dt_str.replace('Z', '+00:00')
        if 'T' in dt_str:
            return datetime.datetime.fromisoformat(dt_str)
        return datetime.datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S').replace(tzinfo=datetime.timezone.utc)
    except Exception:
        return None

@emergency_bp.route('/cases', methods=['GET'])
@authenticate
def get_cases():
    status = request.args.get('status', '').strip()
    priority = request.args.get('priority', '').strip()
    search = request.args.get('search', '').strip()

    sql = '''
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
    '''
    params = []

    if status and status != 'All':
        sql += " AND e.status = ?"
        params.append(status)

    if priority and priority != 'All':
        sql += " AND e.triage_priority = ?"
        params.append(priority)

    if search:
        term = f"%{search}%"
        sql += " AND (p.full_name LIKE ? OR e.case_code LIKE ? OR p.patient_id LIKE ?)"
        params.extend([term, term, term])

    # Strict Clinical Priority Queue Sorting:
    # 1. Waiting cases first, then Assigned, Under Treatment, Transferred, Resolved
    # 2. Priority weight (1=Critical, 2=High, 3=Medium, 4=Low)
    # 3. Arrived at (earliest arrived first within same priority)
    sql += '''
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
    '''

    raw_cases = query_all(sql, params)
    now = datetime.datetime.now(datetime.timezone.utc)

    result_cases = []
    for c in raw_cases:
        arrived_dt = parse_iso_datetime(c.get('arrived_at'))
        if arrived_dt:
            waiting_mins = max(0, int((now - arrived_dt).total_seconds() / 60))
        else:
            waiting_mins = 0

        threshold = ESCALATION_THRESHOLDS.get(c.get('triage_priority'), 60)
        is_escalated = (c.get('status') == 'Waiting' and waiting_mins > threshold) or (c.get('escalated') == 1)

        treatment_dt = parse_iso_datetime(c.get('treatment_started_at'))
        if treatment_dt:
            elapsed_treatment_mins = max(0, int((now - treatment_dt).total_seconds() / 60))
        else:
            elapsed_treatment_mins = 0

        case_obj = {
            **c,
            'waiting_minutes': waiting_mins,
            'is_escalated': is_escalated,
            'escalation_threshold_minutes': threshold,
            'elapsed_treatment_minutes': elapsed_treatment_mins
        }
        result_cases.append(case_obj)

    return jsonify({'cases': result_cases})

@emergency_bp.route('/cases/<id>', methods=['GET'])
@authenticate
def get_case_details(id):
    sql = '''
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
    '''
    item = query_one(sql, (id, id))
    if not item:
        return jsonify({'error': 'Emergency case not found.'}), 404

    now = datetime.datetime.now(datetime.timezone.utc)
    arrived_dt = parse_iso_datetime(item.get('arrived_at'))
    waiting_mins = max(0, int((now - arrived_dt).total_seconds() / 60)) if arrived_dt else 0
    threshold = ESCALATION_THRESHOLDS.get(item.get('triage_priority'), 60)
    is_escalated = (item.get('status') == 'Waiting' and waiting_mins > threshold) or (item.get('escalated') == 1)

    treatment_dt = parse_iso_datetime(item.get('treatment_started_at'))
    elapsed_treatment_mins = max(0, int((now - treatment_dt).total_seconds() / 60)) if treatment_dt else 0

    item['waiting_minutes'] = waiting_mins
    item['is_escalated'] = is_escalated
    item['escalation_threshold_minutes'] = threshold
    item['elapsed_treatment_minutes'] = elapsed_treatment_mins

    logs = query_all('''
      SELECT * FROM emergency_activity_logs
      WHERE emergency_case_id = ?
      ORDER BY id ASC
    ''', (item['id'],))

    return jsonify({'case': item, 'logs': logs})

@emergency_bp.route('/cases', methods=['POST'])
@authenticate
def register_case():
    data = request.get_json() or {}
    patient_id = data.get('patient_id')
    new_patient = data.get('new_patient')
    emergency_type = data.get('emergency_type')
    triage_priority = data.get('triage_priority')

    if not emergency_type or not triage_priority:
        return jsonify({'error': 'Emergency type and triage priority are required.'}), 400

    target_patient_id = patient_id

    # Inline patient registration if requested
    if not target_patient_id and new_patient:
        max_rec = query_one('SELECT MAX(id) as maxId FROM patients')
        next_num = ((max_rec.get('maxId') or 0) if max_rec else 0) + 1001
        gen_patient_id = f"MF-P-{next_num}"

        pat_sql = '''
          INSERT INTO patients (
            patient_id, full_name, age, gender, phone, blood_group,
            emergency_contact_name, emergency_contact_phone, medical_history, current_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Under Emergency')
        '''
        target_patient_id = execute_insert(pat_sql, (
            gen_patient_id,
            (new_patient.get('full_name') or 'Unknown Patient').strip(),
            int(new_patient.get('age') or 0),
            new_patient.get('gender') or 'Unknown',
            (new_patient.get('phone') or 'N/A').strip(),
            new_patient.get('blood_group') or None,
            new_patient.get('emergency_contact_name') or None,
            new_patient.get('emergency_contact_phone') or None,
            new_patient.get('medical_history') or None
        ))
    elif target_patient_id:
        execute_write("UPDATE patients SET current_status = 'Under Emergency' WHERE id = ?", (target_patient_id,))

    if not target_patient_id:
        return jsonify({'error': 'A valid patient must be selected or registered.'}), 400

    year = datetime.datetime.now().year
    count_today = (query_one('SELECT COUNT(*) as count FROM emergency_cases') or {}).get('count', 0)
    case_code = f"EMG-{year}-{str(count_today + 1).zfill(3)}"

    priority_weight = PRIORITY_MAP.get(triage_priority, 4)
    assigned_doctor_id = data.get('assigned_doctor_id')
    assigned_bed_id = data.get('assigned_bed_id')
    initial_status = 'Assigned' if (assigned_doctor_id and assigned_bed_id) else 'Waiting'
    assigned_at = datetime.datetime.now(datetime.timezone.utc).isoformat() if initial_status == 'Assigned' else None

    sql = '''
      INSERT INTO emergency_cases (
        case_code, patient_id, emergency_type, triage_priority, priority_weight,
        conscious_state, systolic_bp, diastolic_bp, heart_rate, respiratory_rate, spo2, temperature,
        triage_notes, triaged_by_user_id, triaged_by_name, assigned_doctor_id, assigned_bed_id,
        status, arrived_at, assigned_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    '''
    row_id = execute_insert(sql, (
        case_code,
        target_patient_id,
        emergency_type,
        triage_priority,
        priority_weight,
        data.get('conscious_state') or 'Alert',
        int(data['systolic_bp']) if data.get('systolic_bp') else None,
        int(data['diastolic_bp']) if data.get('diastolic_bp') else None,
        int(data['heart_rate']) if data.get('heart_rate') else None,
        int(data['respiratory_rate']) if data.get('respiratory_rate') else None,
        int(data['spo2']) if data.get('spo2') else None,
        float(data['temperature']) if data.get('temperature') else None,
        data.get('triage_notes') or None,
        g.user.get('id') if hasattr(g, 'user') else None,
        g.user.get('full_name') if hasattr(g, 'user') else 'Medical Staff',
        assigned_doctor_id or None,
        assigned_bed_id or None,
        initial_status,
        assigned_at
    ))

    # Concurrency updates if resources assigned
    if assigned_bed_id:
        execute_write("UPDATE beds SET status = 'Occupied', current_patient_id = ? WHERE id = ?", (target_patient_id, assigned_bed_id))
    if assigned_doctor_id:
        execute_write('UPDATE doctors SET current_patient_count = current_patient_count + 1 WHERE id = ?', (assigned_doctor_id,))

    # Audit Logs
    current_user = getattr(g, 'user', None)
    log_emergency_activity(
        row_id,
        'REGISTERED',
        current_user,
        f"Emergency case {case_code} registered. Clinical presentation: {emergency_type}."
    )
    log_emergency_activity(
        row_id,
        'TRIAGED',
        current_user,
        f"Triage category assigned: Priority {priority_weight} ({triage_priority}). Conscious state: {data.get('conscious_state', 'Alert')}."
    )

    if assigned_doctor_id or assigned_bed_id:
        log_emergency_activity(
            row_id,
            'DOCTOR_ASSIGNED',
            current_user,
            f"Directly assigned to doctor ID {assigned_doctor_id or 'N/A'} and bed ID {assigned_bed_id or 'N/A'}."
        )

    created = query_one('SELECT * FROM emergency_cases WHERE id = ?', (row_id,))
    return jsonify({'message': 'Emergency case registered successfully', 'case': created}), 201

@emergency_bp.route('/cases/<int:id>/assign', methods=['POST'])
@authenticate
def assign_case_resources(id):
    emg_case = query_one('SELECT * FROM emergency_cases WHERE id = ?', (id,))
    if not emg_case:
        return jsonify({'error': 'Emergency case not found.'}), 404

    data = request.get_json() or {}
    doctor_id = data.get('doctor_id')
    bed_id = data.get('bed_id')
    override_reason = data.get('override_reason')

    # Concurrency protection for Bed Allocation
    if bed_id:
        bed = query_one('SELECT * FROM beds WHERE id = ?', (bed_id,))
        if not bed:
            return jsonify({'error': 'Selected bed does not exist.'}), 404
        if bed['status'] != 'Available' and bed['id'] != emg_case.get('assigned_bed_id'):
            return jsonify({
                'error': f"Bed {bed['bed_number']} was just occupied by another patient ({bed['status']}). Please select another bed."
            }), 409

        # Release previous bed if patient was assigned one
        if emg_case.get('assigned_bed_id') and emg_case['assigned_bed_id'] != bed_id:
            execute_write("UPDATE beds SET status = 'Available', current_patient_id = null WHERE id = ?", (emg_case['assigned_bed_id'],))

        # Allocate new bed
        execute_write("UPDATE beds SET status = 'Occupied', current_patient_id = ? WHERE id = ?", (emg_case['patient_id'], bed_id))

    # Doctor assignment
    if doctor_id and doctor_id != emg_case.get('assigned_doctor_id'):
        execute_write('UPDATE doctors SET current_patient_count = current_patient_count + 1 WHERE id = ?', (doctor_id,))

    new_status = 'Assigned' if emg_case['status'] == 'Waiting' else emg_case['status']

    sql = '''
      UPDATE emergency_cases
      SET assigned_doctor_id = COALESCE(?, assigned_doctor_id),
          assigned_bed_id = COALESCE(?, assigned_bed_id),
          status = ?,
          assigned_at = COALESCE(assigned_at, datetime('now')),
          override_reason = CASE WHEN ? IS NOT NULL THEN ? ELSE override_reason END,
          updated_at = datetime('now')
      WHERE id = ?
    '''
    execute_write(sql, (
        doctor_id or None,
        bed_id or None,
        new_status,
        override_reason or None,
        override_reason or None,
        id
    ))

    # Audit logging
    details = 'Assigned clinical resources: '
    if doctor_id:
        doc = query_one('SELECT full_name, specialization FROM doctors WHERE id = ?', (doctor_id,))
        if doc:
            details += f"Dr. {doc['full_name']} ({doc['specialization']}). "
    if bed_id:
        b_info = query_one('SELECT bed_number, category FROM beds WHERE id = ?', (bed_id,))
        if b_info:
            details += f"Bed: {b_info['bed_number']} ({b_info['category']}). "
    if override_reason:
        details += f"Assignment override note: {override_reason}"
        log_emergency_activity(id, 'OVERRIDE_ASSIGNMENT', getattr(g, 'user', None), details)
    else:
        log_emergency_activity(id, 'DOCTOR_ASSIGNED', getattr(g, 'user', None), details)

    updated = query_one('SELECT * FROM emergency_cases WHERE id = ?', (id,))
    return jsonify({'message': 'Emergency case assigned successfully', 'case': updated})

@emergency_bp.route('/cases/<int:id>/status', methods=['PATCH'])
@authenticate
def update_case_status(id):
    data = request.get_json() or {}
    status = data.get('status')
    notes = data.get('notes')
    discharge_destination = data.get('discharge_destination')

    valid_statuses = ['Waiting', 'Assigned', 'Under Treatment', 'Transferred', 'Resolved']
    if status not in valid_statuses:
        return jsonify({'error': 'Invalid status value.'}), 400

    emg_case = query_one('SELECT * FROM emergency_cases WHERE id = ?', (id,))
    if not emg_case:
        return jsonify({'error': 'Emergency case not found.'}), 404

    treatment_started_at = emg_case.get('treatment_started_at')
    resolved_at = emg_case.get('resolved_at')

    if status == 'Under Treatment' and not treatment_started_at:
        treatment_started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if status in ('Resolved', 'Transferred'):
        resolved_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    sql = '''
      UPDATE emergency_cases
      SET status = ?,
          treatment_started_at = ?,
          resolved_at = ?,
          resolution_notes = COALESCE(?, resolution_notes),
          updated_at = datetime('now')
      WHERE id = ?
    '''
    execute_write(sql, (status, treatment_started_at, resolved_at, notes or None, id))

    # Automatic Bed Lifecycle: Release bed to 'Cleaning' when resolved or transferred
    if status in ('Resolved', 'Transferred') and emg_case.get('assigned_bed_id'):
        execute_write("UPDATE beds SET status = 'Cleaning', current_patient_id = null WHERE id = ?", (emg_case['assigned_bed_id'],))

    # Patient status update
    if status == 'Resolved':
        execute_write("UPDATE patients SET current_status = 'Discharged' WHERE id = ?", (emg_case['patient_id'],))
    elif status == 'Transferred':
        execute_write("UPDATE patients SET current_status = 'Admitted' WHERE id = ?", (emg_case['patient_id'],))

    action_type = 'CASE_RESOLVED' if status == 'Resolved' else 'STATUS_CHANGE'
    log_detail = f"Status changed from '{emg_case['status']}' to '{status}'."
    if notes:
        log_detail += f" Clinical notes: {notes}."
    if discharge_destination:
        log_detail += f" Destination: {discharge_destination}"

    log_emergency_activity(id, action_type, getattr(g, 'user', None), log_detail)

    updated = query_one('SELECT * FROM emergency_cases WHERE id = ?', (id,))
    return jsonify({'message': f"Emergency case status updated to {status}", 'case': updated})

@emergency_bp.route('/cases/<int:id>/reassess-triage', methods=['POST'])
@authenticate
def reassess_triage(id):
    data = request.get_json() or {}
    triage_priority = data.get('triage_priority')
    triage_notes = data.get('triage_notes')
    vitals = data.get('vitals') or {}

    if not triage_priority or triage_priority not in PRIORITY_MAP:
        return jsonify({'error': 'Valid triage priority is required.'}), 400

    emg_case = query_one('SELECT * FROM emergency_cases WHERE id = ?', (id,))
    if not emg_case:
        return jsonify({'error': 'Emergency case not found.'}), 404

    old_priority = emg_case['triage_priority']
    new_weight = PRIORITY_MAP[triage_priority]

    sql = '''
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
    '''
    execute_write(sql, (
        triage_priority,
        new_weight,
        triage_notes or None,
        vitals.get('systolic_bp'),
        vitals.get('diastolic_bp'),
        vitals.get('heart_rate'),
        vitals.get('spo2'),
        id
    ))

    log_emergency_activity(
        id,
        'PRIORITY_UPDATED',
        getattr(g, 'user', None),
        f"Triage reassessment by medical staff: Priority updated from '{old_priority}' to '{triage_priority}' (Weight {new_weight}). Clinical reason: {triage_notes or 'Routine vitals reassessment'}."
    )

    updated = query_one('SELECT * FROM emergency_cases WHERE id = ?', (id,))
    return jsonify({'message': 'Triage priority reassessed successfully', 'case': updated})

@emergency_bp.route('/resources', methods=['GET'])
@authenticate
def get_resources():
    doctors = query_all('''
      SELECT id, doctor_code, full_name, specialization, department, phone, availability_status, is_emergency_duty, current_patient_count
      FROM doctors
      WHERE availability_status = 'Available' OR is_emergency_duty = 1
      ORDER BY is_emergency_duty DESC, current_patient_count ASC
    ''')

    beds = query_all('''
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
    ''')

    return jsonify({'doctors': doctors, 'beds': beds})

