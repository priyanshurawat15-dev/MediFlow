from flask import Blueprint, request, jsonify
from ..database.db import query_all, query_one, execute_insert, execute_write
from ..middleware.auth import authenticate

patients_bp = Blueprint('patients', __name__, url_prefix='/api/patients')

@patients_bp.route('', methods=['GET'])
@authenticate
def list_patients():
    search = request.args.get('search', '').strip()
    status = request.args.get('status', '').strip()

    sql = '''
      SELECT p.*,
        (SELECT COUNT(*) FROM emergency_cases WHERE patient_id = p.id) as emergency_count,
        (SELECT COUNT(*) FROM admissions WHERE patient_id = p.id) as admission_count
      FROM patients p
      WHERE 1=1
    '''
    params = []

    if search:
        term = f"%{search}%"
        sql += " AND (p.full_name LIKE ? OR p.patient_id LIKE ? OR p.phone LIKE ?)"
        params.extend([term, term, term])

    if status and status != 'All':
        sql += " AND p.current_status = ?"
        params.append(status)

    sql += " ORDER BY p.id DESC"
    patients = query_all(sql, params)
    return jsonify({'patients': patients})

@patients_bp.route('/<id>', methods=['GET'])
@authenticate
def get_patient(id):
    patient = query_one('SELECT * FROM patients WHERE id = ? OR patient_id = ?', (id, id))
    if not patient:
        return jsonify({'error': 'Patient not found.'}), 404

    pat_id = patient['id']
    medical_records = query_all('''
      SELECT m.*, d.full_name as doctor_name, d.specialization
      FROM medical_records m
      LEFT JOIN doctors d ON m.doctor_id = d.id
      WHERE m.patient_id = ?
      ORDER BY m.id DESC
    ''', (pat_id,))

    admissions = query_all('''
      SELECT a.*, b.bed_number, b.category as bed_category, b.ward_department, d.full_name as doctor_name
      FROM admissions a
      LEFT JOIN beds b ON a.bed_id = b.id
      LEFT JOIN doctors d ON a.attending_doctor_id = d.id
      WHERE a.patient_id = ?
      ORDER BY a.id DESC
    ''', (pat_id,))

    emergency_cases = query_all('''
      SELECT e.*, d.full_name as doctor_name, b.bed_number
      FROM emergency_cases e
      LEFT JOIN doctors d ON e.assigned_doctor_id = d.id
      LEFT JOIN beds b ON e.assigned_bed_id = b.id
      WHERE e.patient_id = ?
      ORDER BY e.id DESC
    ''', (pat_id,))

    appointments = query_all('''
      SELECT apt.*, d.full_name as doctor_name, d.specialization
      FROM appointments apt
      LEFT JOIN doctors d ON apt.doctor_id = d.id
      WHERE apt.patient_id = ?
      ORDER BY apt.appointment_date DESC, apt.id DESC
    ''', (pat_id,))

    bills = query_all('''
      SELECT b.*
      FROM bills b
      WHERE b.patient_id = ?
      ORDER BY b.id DESC
    ''', (pat_id,))

    return jsonify({
        'patient': patient,
        'medicalRecords': medical_records,
        'admissions': admissions,
        'emergencyCases': emergency_cases,
        'appointments': appointments,
        'bills': bills
    })

@patients_bp.route('', methods=['POST'])
@authenticate
def create_patient():
    data = request.get_json() or {}
    full_name = (data.get('full_name') or '').strip()
    age = data.get('age')
    gender = data.get('gender')
    phone = (data.get('phone') or '').strip()

    if not full_name or age is None or not gender or not phone:
        return jsonify({'error': 'Full name, age, gender, and phone number are required.'}), 400

    max_rec = query_one('SELECT MAX(id) as maxId FROM patients')
    next_num = ((max_rec.get('maxId') or 0) if max_rec else 0) + 1001
    patient_id = f"MF-P-{next_num}"

    sql = '''
      INSERT INTO patients (
        patient_id, full_name, age, gender, phone, email, address,
        blood_group, emergency_contact_name, emergency_contact_phone, medical_history, current_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registered')
    '''
    row_id = execute_insert(sql, (
        patient_id,
        full_name,
        int(age),
        gender,
        phone,
        data.get('email') or None,
        data.get('address') or None,
        data.get('blood_group') or None,
        data.get('emergency_contact_name') or None,
        data.get('emergency_contact_phone') or None,
        data.get('medical_history') or None
    ))

    created = query_one('SELECT * FROM patients WHERE id = ?', (row_id,))
    return jsonify({'message': 'Patient registered successfully', 'patient': created}), 201

@patients_bp.route('/<int:id>', methods=['PUT'])
@authenticate
def update_patient(id):
    existing = query_one('SELECT * FROM patients WHERE id = ?', (id,))
    if not existing:
        return jsonify({'error': 'Patient not found.'}), 404

    data = request.get_json() or {}
    sql = '''
      UPDATE patients
      SET full_name = ?, age = ?, gender = ?, phone = ?, email = ?, address = ?,
          blood_group = ?, emergency_contact_name = ?, emergency_contact_phone = ?,
          medical_history = ?, current_status = ?, updated_at = datetime('now')
      WHERE id = ?
    '''
    execute_write(sql, (
        data.get('full_name', existing['full_name']),
        int(data.get('age', existing['age'])),
        data.get('gender', existing['gender']),
        data.get('phone', existing['phone']),
        data.get('email', existing['email']),
        data.get('address', existing['address']),
        data.get('blood_group', existing['blood_group']),
        data.get('emergency_contact_name', existing['emergency_contact_name']),
        data.get('emergency_contact_phone', existing['emergency_contact_phone']),
        data.get('medical_history', existing['medical_history']),
        data.get('current_status', existing['current_status']),
        id
    ))

    updated = query_one('SELECT * FROM patients WHERE id = ?', (id,))
    return jsonify({'message': 'Patient updated successfully', 'patient': updated})

