import random
from flask import Blueprint, request, jsonify, g
from ..database.db import query_all, query_one, execute_insert, execute_write
from ..middleware.auth import authenticate

ambulances_bp = Blueprint('ambulances', __name__, url_prefix='/api/ambulances')

SIMULATED_COORDINATES = {
    'Hospital Main Emergency Bay': {'lat': 12.9716, 'lng': 77.5946},
    'Indiranagar 100ft Road': {'lat': 12.9784, 'lng': 77.6408},
    'Koramangala 5th Block': {'lat': 12.9352, 'lng': 77.6245},
    'Outer Ring Road (Silk Board Junction)': {'lat': 12.9172, 'lng': 77.6228},
    'MG Road Metro Station': {'lat': 12.9756, 'lng': 77.6066},
    'Whitefield ITPL Main Road': {'lat': 12.9863, 'lng': 77.7314},
    'Hebbal Flyover Expressway': {'lat': 13.0358, 'lng': 77.5970},
    'Jayanagar 4th Block': {'lat': 12.9299, 'lng': 77.5824},
    'HSR Layout Sector 2': {'lat': 12.9121, 'lng': 77.6446},
}

@ambulances_bp.route('', methods=['GET'])
@authenticate
def list_ambulances():
    sql = '''
      SELECT a.*,
        (SELECT aa.pickup_location FROM ambulance_assignments aa WHERE aa.ambulance_id = a.id AND aa.status IN ('Dispatched', 'On the Way', 'Arrived', 'Returning') ORDER BY aa.id DESC LIMIT 1) as active_destination,
        (SELECT aa.caller_name FROM ambulance_assignments aa WHERE aa.ambulance_id = a.id AND aa.status IN ('Dispatched', 'On the Way', 'Arrived', 'Returning') ORDER BY aa.id DESC LIMIT 1) as active_caller,
        (SELECT aa.caller_phone FROM ambulance_assignments aa WHERE aa.ambulance_id = a.id AND aa.status IN ('Dispatched', 'On the Way', 'Arrived', 'Returning') ORDER BY aa.id DESC LIMIT 1) as active_phone,
        (SELECT aa.id FROM ambulance_assignments aa WHERE aa.ambulance_id = a.id AND aa.status IN ('Dispatched', 'On the Way', 'Arrived', 'Returning') ORDER BY aa.id DESC LIMIT 1) as active_assignment_id
      FROM ambulances a
      ORDER BY a.id ASC
    '''
    ambulances = query_all(sql)
    return jsonify({'ambulances': ambulances})

@ambulances_bp.route('', methods=['POST'])
@authenticate
def register_ambulance():
    data = request.get_json() or {}
    vehicle_number = (data.get('vehicle_number') or '').strip().upper()
    ambulance_type = data.get('ambulance_type')
    driver_name = (data.get('driver_name') or '').strip()
    driver_phone = (data.get('driver_phone') or '').strip()

    if not vehicle_number or not ambulance_type or not driver_name or not driver_phone:
        return jsonify({'error': 'Vehicle number, ambulance type, driver name, and driver phone are required.'}), 400

    sql = '''
      INSERT INTO ambulances (
        vehicle_number, ambulance_type, driver_name, driver_phone,
        paramedic_name, paramedic_phone, status, base_station, current_location_name, current_latitude, current_longitude
      ) VALUES (?, ?, ?, ?, ?, ?, 'Available', ?, 'Hospital Main Emergency Bay', 12.9716, 77.5946)
    '''
    row_id = execute_insert(sql, (
        vehicle_number,
        ambulance_type,
        driver_name,
        driver_phone,
        (data.get('paramedic_name') or '').strip() or None,
        (data.get('paramedic_phone') or '').strip() or None,
        (data.get('base_station') or 'Main Emergency Wing').strip()
    ))

    created = query_one('SELECT * FROM ambulances WHERE id = ?', (row_id,))
    return jsonify({'message': 'Ambulance registered successfully', 'ambulance': created}), 201

@ambulances_bp.route('/dispatch', methods=['POST'])
@authenticate
def dispatch_ambulance():
    data = request.get_json() or {}
    ambulance_id = data.get('ambulance_id')
    pickup_location = (data.get('pickup_location') or '').strip()
    emergency_case_id = data.get('emergency_case_id')
    caller_name = data.get('caller_name')
    caller_phone = data.get('caller_phone')
    notes = data.get('notes')

    if not ambulance_id or not pickup_location:
        return jsonify({'error': 'Ambulance ID and pickup location are required.'}), 400

    amb = query_one('SELECT * FROM ambulances WHERE id = ?', (ambulance_id,))
    if not amb:
        return jsonify({'error': 'Ambulance not found.'}), 404
    if amb['status'] != 'Available':
        return jsonify({'error': f"Ambulance {amb['vehicle_number']} is currently {amb['status']}."}), 409

    coords = SIMULATED_COORDINATES.get(pickup_location) or {
        'lat': 12.9716 + (random.random() - 0.5) * 0.08,
        'lng': 77.5946 + (random.random() - 0.5) * 0.08,
    }

    assign_sql = '''
      INSERT INTO ambulance_assignments (
        ambulance_id, emergency_case_id, pickup_location, pickup_latitude, pickup_longitude,
        caller_name, caller_phone, assigned_by_user_id, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Dispatched', ?)
    '''
    assign_id = execute_insert(assign_sql, (
        ambulance_id,
        emergency_case_id or None,
        pickup_location,
        coords['lat'],
        coords['lng'],
        caller_name or None,
        caller_phone or None,
        g.user.get('id') if hasattr(g, 'user') else None,
        notes or None
    ))

    execute_write('''
      UPDATE ambulances
      SET status = 'Dispatched',
          current_emergency_case_id = ?,
          current_location_name = ?
      WHERE id = ?
    ''', (emergency_case_id or None, f"En route to {pickup_location}", ambulance_id))

    if emergency_case_id:
        execute_insert('''
          INSERT INTO emergency_activity_logs (
            emergency_case_id, action_type, performed_by_user_id, performed_by_name, details
          ) VALUES (?, 'AMBULANCE_LINKED', ?, ?, ?)
        ''', (
            emergency_case_id,
            g.user.get('id') if hasattr(g, 'user') else None,
            g.user.get('full_name') if hasattr(g, 'user') else 'EMS Dispatch',
            f"Ambulance {amb['vehicle_number']} dispatched for patient pickup at {pickup_location}. Driver: {amb['driver_name']}."
        ))

    return jsonify({
        'message': f"Ambulance {amb['vehicle_number']} dispatched successfully",
        'assignment_id': assign_id
    }), 201

@ambulances_bp.route('/<int:id>/status', methods=['PATCH'])
@authenticate
def update_ambulance_status(id):
    data = request.get_json() or {}
    status = data.get('status')
    simulated_location_name = data.get('simulated_location_name')

    valid_statuses = ['Available', 'Dispatched', 'On the Way', 'Arrived', 'Returning', 'Under Maintenance']
    if status not in valid_statuses:
        return jsonify({'error': 'Invalid ambulance status.'}), 400

    amb = query_one('SELECT * FROM ambulances WHERE id = ?', (id,))
    if not amb:
        return jsonify({'error': 'Ambulance not found.'}), 404

    active_assign = query_one('''
      SELECT * FROM ambulance_assignments
      WHERE ambulance_id = ? AND status IN ('Dispatched', 'On the Way', 'Arrived', 'Returning')
      ORDER BY id DESC LIMIT 1
    ''', (id,))

    new_location = simulated_location_name or amb.get('current_location_name')
    lat = amb.get('current_latitude', 12.9716)
    lng = amb.get('current_longitude', 77.5946)

    if status == 'Available':
        new_location = 'Hospital Main Emergency Bay'
        lat = 12.9716
        lng = 77.5946

    if active_assign:
        if status == 'On the Way':
            execute_write("UPDATE ambulance_assignments SET status = 'On the Way', on_the_way_at = datetime('now') WHERE id = ?", (active_assign['id'],))
        elif status == 'Arrived':
            execute_write("UPDATE ambulance_assignments SET status = 'Arrived', arrived_at_scene_at = datetime('now') WHERE id = ?", (active_assign['id'],))
        elif status == 'Returning':
            execute_write("UPDATE ambulance_assignments SET status = 'Returning', patient_handover_at = datetime('now') WHERE id = ?", (active_assign['id'],))
        elif status == 'Available':
            execute_write("UPDATE ambulance_assignments SET status = 'Completed', returned_to_base_at = datetime('now') WHERE id = ?", (active_assign['id'],))

    sql = '''
      UPDATE ambulances
      SET status = ?,
          current_location_name = ?,
          current_latitude = ?,
          current_longitude = ?,
          current_emergency_case_id = CASE WHEN ? = 'Available' THEN null ELSE current_emergency_case_id END
      WHERE id = ?
    '''
    execute_write(sql, (status, new_location, lat, lng, status, id))

    updated = query_one('SELECT * FROM ambulances WHERE id = ?', (id,))
    return jsonify({'message': f"Ambulance status updated to {status}", 'ambulance': updated})

@ambulances_bp.route('/<int:id>/history', methods=['GET'])
@authenticate
def get_ambulance_history(id):
    assignments = query_all('''
      SELECT aa.*, e.case_code, p.full_name as patient_name
      FROM ambulance_assignments aa
      LEFT JOIN emergency_cases e ON aa.emergency_case_id = e.id
      LEFT JOIN patients p ON e.patient_id = p.id
      WHERE aa.ambulance_id = ?
      ORDER BY aa.id DESC
    ''', (id,))
    return jsonify({'assignments': assignments})

