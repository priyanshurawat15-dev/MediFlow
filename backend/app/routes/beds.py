import datetime
from flask import Blueprint, request, jsonify
from ..database.db import query_all, query_one, execute_insert, execute_write
from ..middleware.auth import authenticate

beds_bp = Blueprint('beds', __name__, url_prefix='/api/beds')

@beds_bp.route('', methods=['GET'])
@authenticate
def list_beds():
    category = request.args.get('category', '').strip()
    status = request.args.get('status', '').strip()
    ward = request.args.get('ward', '').strip()

    sql = '''
      SELECT b.*,
        p.full_name as patient_name, p.patient_id as patient_code, p.age as patient_age, p.gender as patient_gender,
        (SELECT diagnosis FROM admissions WHERE bed_id = b.id AND status = 'Admitted' LIMIT 1) as admission_diagnosis,
        (SELECT case_code FROM emergency_cases WHERE assigned_bed_id = b.id AND status IN ('Waiting', 'Assigned', 'Under Treatment') LIMIT 1) as linked_emergency_case
      FROM beds b
      LEFT JOIN patients p ON b.current_patient_id = p.id
      WHERE 1=1
    '''
    params = []

    if category and category != 'All':
        sql += " AND b.category = ?"
        params.append(category)

    if status and status != 'All':
        sql += " AND b.status = ?"
        params.append(status)

    if ward and ward != 'All':
        sql += " AND b.ward_department = ?"
        params.append(ward)

    sql += " ORDER BY b.category ASC, b.bed_number ASC"
    beds = query_all(sql, params)
    return jsonify({'beds': beds})

@beds_bp.route('/summary', methods=['GET'])
@authenticate
def get_beds_summary():
    categories = ['Emergency Bed', 'ICU', 'HDU', 'General Ward', 'Private Room']
    summary = {}

    for cat in categories:
        total = (query_one('SELECT COUNT(*) as count FROM beds WHERE category = ?', (cat,)) or {}).get('count', 0)
        available = (query_one("SELECT COUNT(*) as count FROM beds WHERE category = ? AND status = 'Available'", (cat,)) or {}).get('count', 0)
        occupied = (query_one("SELECT COUNT(*) as count FROM beds WHERE category = ? AND status = 'Occupied'", (cat,)) or {}).get('count', 0)
        maintenance = (query_one("SELECT COUNT(*) as count FROM beds WHERE category = ? AND status IN ('Maintenance', 'Cleaning')", (cat,)) or {}).get('count', 0)

        summary[cat] = {
            'total': total,
            'available': available,
            'occupied': occupied,
            'maintenance': maintenance
        }

    total_all = (query_one('SELECT COUNT(*) as count FROM beds') or {}).get('count', 0)
    avail_all = (query_one("SELECT COUNT(*) as count FROM beds WHERE status = 'Available'") or {}).get('count', 0)
    occ_all = (query_one("SELECT COUNT(*) as count FROM beds WHERE status = 'Occupied'") or {}).get('count', 0)
    maint_all = (query_one("SELECT COUNT(*) as count FROM beds WHERE status IN ('Maintenance', 'Cleaning')") or {}).get('count', 0)

    overall = {
        'total': total_all,
        'available': avail_all,
        'occupied': occ_all,
        'maintenance': maint_all
    }

    return jsonify({'summary': summary, 'overall': overall})

@beds_bp.route('', methods=['POST'])
@authenticate
def add_bed():
    data = request.get_json() or {}
    bed_number = (data.get('bed_number') or '').strip().upper()
    category = data.get('category')
    ward_department = (data.get('ward_department') or '').strip()
    floor = (data.get('floor') or '').strip()
    daily_charge = data.get('daily_charge')

    if not bed_number or not category or not ward_department or not floor:
        return jsonify({'error': 'Bed number, category, ward, and floor are required.'}), 400

    sql = '''
      INSERT INTO beds (bed_number, category, ward_department, floor, daily_charge, status)
      VALUES (?, ?, ?, ?, ?, 'Available')
    '''
    try:
        row_id = execute_insert(sql, (
            bed_number,
            category,
            ward_department,
            floor,
            float(daily_charge) if daily_charge else 500.0
        ))
    except Exception:
        return jsonify({'error': 'Failed to add bed. (Make sure bed number is unique).'}), 500

    created = query_one('SELECT * FROM beds WHERE id = ?', (row_id,))
    return jsonify({'message': 'Bed added successfully', 'bed': created}), 201

@beds_bp.route('/<int:id>/allocate', methods=['POST'])
@authenticate
def allocate_bed(id):
    data = request.get_json() or {}
    patient_id = data.get('patient_id')
    doctor_id = data.get('doctor_id')
    diagnosis = data.get('diagnosis')
    admission_type = data.get('admission_type', 'General')

    if not patient_id:
        return jsonify({'error': 'Patient ID is required for bed allocation.'}), 400

    bed = query_one('SELECT * FROM beds WHERE id = ?', (id,))
    if not bed:
        return jsonify({'error': 'Bed not found.'}), 404
    if bed['status'] != 'Available':
        return jsonify({'error': f"Bed {bed['bed_number']} is not available (Status: {bed['status']})."}), 409

    count_rec = query_one('SELECT COUNT(*) as count FROM admissions')
    adm_count = (count_rec.get('count', 0) if count_rec else 0) + 1
    year = datetime.datetime.now().year
    admission_number = f"ADM-{year}-{str(adm_count).zfill(3)}"

    adm_sql = '''
      INSERT INTO admissions (admission_number, patient_id, bed_id, attending_doctor_id, admission_type, diagnosis, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Admitted')
    '''
    adm_id = execute_insert(adm_sql, (
        admission_number,
        patient_id,
        id,
        doctor_id or None,
        admission_type,
        diagnosis or None
    ))

    execute_write('''
      UPDATE beds
      SET status = 'Occupied',
          current_patient_id = ?,
          current_admission_id = ?
      WHERE id = ?
    ''', (patient_id, adm_id, id))

    execute_write("UPDATE patients SET current_status = 'Admitted' WHERE id = ?", (patient_id,))

    updated = query_one('SELECT * FROM beds WHERE id = ?', (id,))
    return jsonify({'message': f"Bed {bed['bed_number']} allocated successfully", 'bed': updated})

@beds_bp.route('/<int:id>/transfer', methods=['POST'])
@authenticate
def transfer_bed(id):
    data = request.get_json() or {}
    target_bed_id = data.get('target_bed_id')
    transfer_reason = data.get('transfer_reason')

    if not target_bed_id:
        return jsonify({'error': 'Target bed ID is required.'}), 400

    current_bed = query_one('SELECT * FROM beds WHERE id = ?', (id,))
    target_bed = query_one('SELECT * FROM beds WHERE id = ?', (target_bed_id,))

    if not current_bed or not current_bed.get('current_patient_id'):
        return jsonify({'error': 'Current bed has no assigned patient to transfer.'}), 400
    if not target_bed or target_bed['status'] != 'Available':
        return jsonify({'error': f"Target bed is not available ({target_bed.get('status') if target_bed else 'Not Found'})."}), 409

    patient_id = current_bed['current_patient_id']
    admission_id = current_bed.get('current_admission_id')

    # Update target bed
    execute_write('''
      UPDATE beds
      SET status = 'Occupied',
          current_patient_id = ?,
          current_admission_id = ?
      WHERE id = ?
    ''', (patient_id, admission_id, target_bed_id))

    # Update source bed to Cleaning
    execute_write('''
      UPDATE beds
      SET status = 'Cleaning',
          current_patient_id = null,
          current_admission_id = null
      WHERE id = ?
    ''', (id,))

    # Update admission record
    if admission_id:
        execute_write('UPDATE admissions SET bed_id = ? WHERE id = ?', (target_bed_id, admission_id))

    # Update emergency case if active on this bed
    execute_write('UPDATE emergency_cases SET assigned_bed_id = ? WHERE assigned_bed_id = ?', (target_bed_id, id))

    return jsonify({
        'message': f"Patient transferred from {current_bed['bed_number']} to {target_bed['bed_number']} successfully.",
        'target_bed': target_bed
    })

@beds_bp.route('/<int:id>/release', methods=['POST', 'PATCH'])
@authenticate
def release_bed(id):
    data = request.get_json() or {}
    status_after = data.get('status_after', 'Cleaning')

    bed = query_one('SELECT * FROM beds WHERE id = ?', (id,))
    if not bed:
        return jsonify({'error': 'Bed not found.'}), 404

    patient_id = bed.get('current_patient_id')
    admission_id = bed.get('current_admission_id')

    if admission_id:
        execute_write('''
          UPDATE admissions
          SET status = 'Discharged',
              discharge_date = datetime('now')
          WHERE id = ?
        ''', (admission_id,))

    if patient_id:
        active_emg = query_one(
            "SELECT COUNT(*) as count FROM emergency_cases WHERE patient_id = ? AND status IN ('Waiting', 'Assigned', 'Under Treatment')",
            (patient_id,)
        )
        if not active_emg or active_emg.get('count', 0) == 0:
            execute_write("UPDATE patients SET current_status = 'Discharged' WHERE id = ?", (patient_id,))

    execute_write('''
      UPDATE beds
      SET status = ?,
          current_patient_id = null,
          current_admission_id = null
      WHERE id = ?
    ''', (status_after, id))

    updated = query_one('SELECT * FROM beds WHERE id = ?', (id,))
    return jsonify({'message': f"Bed {bed['bed_number']} released successfully", 'bed': updated})

