from flask import Blueprint, request, jsonify
from ..database.db import query_all, query_one, execute_insert, execute_write
from ..middleware.auth import authenticate

doctors_bp = Blueprint('doctors', __name__, url_prefix='/api/doctors')

@doctors_bp.route('', methods=['GET'])
@authenticate
def list_doctors():
    specialization = request.args.get('specialization', '').strip()
    department = request.args.get('department', '').strip()
    availability = request.args.get('availability', '').strip()
    emergency_only = request.args.get('emergency_only', '').strip().lower()

    sql = '''
      SELECT d.*, u.username
      FROM doctors d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE 1=1
    '''
    params = []

    if specialization and specialization != 'All':
        sql += " AND d.specialization = ?"
        params.append(specialization)

    if department and department != 'All':
        sql += " AND d.department = ?"
        params.append(department)

    if availability and availability != 'All':
        sql += " AND d.availability_status = ?"
        params.append(availability)

    if emergency_only in ('true', '1'):
        sql += " AND d.is_emergency_duty = 1"

    sql += " ORDER BY d.is_emergency_duty DESC, d.availability_status ASC, d.id ASC"
    doctors = query_all(sql, params)
    return jsonify({'doctors': doctors})

@doctors_bp.route('/<id>', methods=['GET'])
@authenticate
def get_doctor(id):
    doctor = query_one('SELECT * FROM doctors WHERE id = ? OR doctor_code = ?', (id, id))
    if not doctor:
        return jsonify({'error': 'Doctor not found.'}), 404

    doc_id = doctor['id']
    active_emergencies = query_all('''
      SELECT e.*, p.full_name as patient_name, p.patient_id as patient_code, b.bed_number
      FROM emergency_cases e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN beds b ON e.assigned_bed_id = b.id
      WHERE e.assigned_doctor_id = ? AND e.status IN ('Assigned', 'Under Treatment')
      ORDER BY e.priority_weight ASC
    ''', (doc_id,))

    admitted_patients = query_all('''
      SELECT a.*, p.full_name as patient_name, p.patient_id as patient_code, b.bed_number, b.category as bed_category
      FROM admissions a
      JOIN patients p ON a.patient_id = p.id
      JOIN beds b ON a.bed_id = b.id
      WHERE a.attending_doctor_id = ? AND a.status = 'Admitted'
    ''', (doc_id,))

    appointments = query_all('''
      SELECT apt.*, p.full_name as patient_name, p.phone as patient_phone
      FROM appointments apt
      JOIN patients p ON apt.patient_id = p.id
      WHERE apt.doctor_id = ?
      ORDER BY apt.appointment_date ASC, apt.time_slot ASC
    ''', (doc_id,))

    return jsonify({
        'doctor': doctor,
        'activeEmergencies': active_emergencies,
        'admittedPatients': admitted_patients,
        'appointments': appointments
    })

@doctors_bp.route('', methods=['POST'])
@authenticate
def add_doctor():
    data = request.get_json() or {}
    full_name = (data.get('full_name') or '').strip()
    specialization = (data.get('specialization') or '').strip()
    department = (data.get('department') or '').strip()
    phone = (data.get('phone') or '').strip()
    email = (data.get('email') or '').strip()

    if not full_name or not specialization or not department or not phone or not email:
        return jsonify({'error': 'Full name, specialization, department, phone, and email are required.'}), 400

    count_rec = query_one('SELECT COUNT(*) as count FROM doctors')
    doc_count = (count_rec.get('count', 0) if count_rec else 0) + 1
    doctor_code = f"MF-DOC-{str(doc_count).zfill(2)}"

    sql = '''
      INSERT INTO doctors (
        doctor_code, user_id, full_name, specialization, department, phone, email,
        duty_schedule, availability_status, is_emergency_duty, current_patient_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, 0)
    '''
    is_er = 1 if data.get('is_emergency_duty') in (True, 1, '1', 'true') else 0
    row_id = execute_insert(sql, (
        doctor_code,
        data.get('user_id') or None,
        full_name,
        specialization,
        department,
        phone,
        email,
        (data.get('duty_schedule') or 'Regular Shift (09:00 - 17:00)').strip(),
        is_er
    ))

    created = query_one('SELECT * FROM doctors WHERE id = ?', (row_id,))
    return jsonify({'message': 'Doctor registered successfully', 'doctor': created}), 201

@doctors_bp.route('/<int:id>/status', methods=['PATCH'])
@authenticate
def update_doctor_status(id):
    existing = query_one('SELECT * FROM doctors WHERE id = ?', (id,))
    if not existing:
        return jsonify({'error': 'Doctor not found.'}), 404

    data = request.get_json() or {}
    availability_status = data.get('availability_status')
    is_emergency_duty = data.get('is_emergency_duty')
    duty_schedule = data.get('duty_schedule')

    if is_emergency_duty is not None:
        is_emergency_duty = 1 if is_emergency_duty in (True, 1, '1', 'true') else 0

    sql = '''
      UPDATE doctors
      SET availability_status = COALESCE(?, availability_status),
          is_emergency_duty = COALESCE(?, is_emergency_duty),
          duty_schedule = COALESCE(?, duty_schedule)
      WHERE id = ?
    '''
    execute_write(sql, (availability_status, is_emergency_duty, duty_schedule, id))

    updated = query_one('SELECT * FROM doctors WHERE id = ?', (id,))
    return jsonify({'message': 'Doctor status updated successfully', 'doctor': updated})

