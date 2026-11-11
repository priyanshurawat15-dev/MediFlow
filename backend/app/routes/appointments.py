from flask import Blueprint, request, jsonify
from datetime import datetime
from ..database.db import query_all, query_one, execute_insert, execute_write
from ..middleware.auth import authenticate

appointments_bp = Blueprint('appointments', __name__)

@appointments_bp.route('', methods=['GET'])
@authenticate
def list_appointments():
    """List appointments with filters (date, doctor_id, status)"""
    date = request.args.get('date')
    doctor_id = request.args.get('doctor_id')
    status = request.args.get('status')

    query = """
        SELECT apt.*,
            p.full_name as patient_name, p.patient_id as patient_code, p.phone as patient_phone,
            d.full_name as doctor_name, d.specialization as doctor_specialization
        FROM appointments apt
        JOIN patients p ON apt.patient_id = p.id
        JOIN doctors d ON apt.doctor_id = d.id
        WHERE 1=1
    """
    params = []

    if date:
        query += " AND apt.appointment_date = ?"
        params.append(date)

    if doctor_id and doctor_id != 'All':
        query += " AND apt.doctor_id = ?"
        params.append(doctor_id)

    if status and status != 'All':
        query += " AND apt.status = ?"
        params.append(status)

    query += " ORDER BY apt.appointment_date ASC, apt.time_slot ASC, apt.id ASC"

    appointments = query_all(query, tuple(params))
    return jsonify({'appointments': appointments})


@appointments_bp.route('', methods=['POST'])
@authenticate
def schedule_appointment():
    """Schedule new appointment"""
    data = request.get_json() or {}
    patient_id = data.get('patient_id')
    doctor_id = data.get('doctor_id')
    department = data.get('department')
    appointment_date = data.get('appointment_date')
    time_slot = data.get('time_slot')
    reason_for_visit = data.get('reason_for_visit')
    notes = data.get('notes')

    if not patient_id or not doctor_id or not department or not appointment_date or not time_slot:
        return jsonify({'error': 'Patient, doctor, department, date, and time slot are required.'}), 400

    count_row = query_one('SELECT COUNT(*) as count FROM appointments')
    count_val = count_row['count'] if count_row else 0
    appointment_number = f"APT-{datetime.now().year}-{str(count_val + 1).zfill(3)}"

    insert_sql = """
        INSERT INTO appointments (
            appointment_number, patient_id, doctor_id, department,
            appointment_date, time_slot, reason_for_visit, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?)
    """
    new_id = execute_insert(
        insert_sql,
        (
            appointment_number,
            patient_id,
            doctor_id,
            department.strip(),
            appointment_date,
            time_slot,
            reason_for_visit.strip() if reason_for_visit else None,
            notes.strip() if notes else None,
        )
    )

    created = query_one('SELECT * FROM appointments WHERE id = ?', (new_id,))
    return jsonify({
        'message': 'Appointment scheduled successfully',
        'appointment': created
    }), 201


@appointments_bp.route('/<int:id>/status', methods=['PATCH'])
@authenticate
def update_appointment_status(id):
    """Update appointment status (Scheduled, Confirmed, Completed, Cancelled)"""
    data = request.get_json() or {}
    status = data.get('status')
    notes = data.get('notes')

    valid = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled']
    if status not in valid:
        return jsonify({'error': 'Invalid appointment status.'}), 400

    execute_write(
        """
        UPDATE appointments
        SET status = ?,
            notes = COALESCE(?, notes)
        WHERE id = ?
        """,
        (status, notes if notes else None, id)
    )

    updated = query_one('SELECT * FROM appointments WHERE id = ?', (id,))
    if not updated:
        return jsonify({'error': 'Appointment not found.'}), 404

    return jsonify({
        'message': f'Appointment status updated to {status}',
        'appointment': updated
    })

