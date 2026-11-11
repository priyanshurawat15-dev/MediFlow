import bcrypt
from flask import Blueprint, request, jsonify, g
from ..database.db import query_one
from ..middleware.auth import generate_token, authenticate

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required.'}), 400

    user = query_one('SELECT * FROM users WHERE username = ?', (username,))
    if not user:
        return jsonify({'error': 'Invalid username or password.'}), 401

    try:
        is_valid = bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8'))
    except Exception:
        is_valid = False

    if not is_valid:
        return jsonify({'error': 'Invalid username or password.'}), 401

    auth_payload = {
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'full_name': user['full_name'],
        'email': user['email']
    }
    token = generate_token(auth_payload)

    doctor_profile = None
    if user['role'] == 'doctor':
        doctor_profile = query_one('SELECT * FROM doctors WHERE user_id = ?', (user['id'],))

    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': {
            **auth_payload,
            'department': user.get('department'),
            'phone': user.get('phone'),
            'doctorProfile': doctor_profile
        }
    })

@auth_bp.route('/me', methods=['GET'])
@authenticate
def get_me():
    user = query_one(
        'SELECT id, username, full_name, email, role, department, phone, created_at FROM users WHERE id = ?',
        (g.user['id'],)
    )
    if not user:
        return jsonify({'error': 'User not found.'}), 404

    doctor_profile = None
    if user['role'] == 'doctor':
        doctor_profile = query_one('SELECT * FROM doctors WHERE user_id = ?', (user['id'],))

    return jsonify({
        'user': {
            **user,
            'doctorProfile': doctor_profile
        }
    })

@auth_bp.route('/demo-accounts', methods=['GET'])
def get_demo_accounts():
    demo_users = [
        {'username': 'admin', 'role': 'admin', 'label': 'Hospital Admin', 'name': 'Dr. Rajiv Sharma', 'department': 'Hospital Administration'},
        {'username': 'dr.ananya', 'role': 'doctor', 'label': 'Emergency Doctor', 'name': 'Dr. Ananya Sen', 'department': 'Emergency Medicine'},
        {'username': 'nurse.sarah', 'role': 'nurse', 'label': 'Triage Nurse', 'name': 'Sarah Thomas, RN', 'department': 'Emergency Triage'},
        {'username': 'recep.rohit', 'role': 'receptionist', 'label': 'Reception & Billing', 'name': 'Rohit Verma', 'department': 'Central Reception'},
        {'username': 'driver.arun', 'role': 'ambulance', 'label': 'EMS Dispatch Driver', 'name': 'Arun Kumar', 'department': 'Rapid EMS Dispatch'},
    ]
    return jsonify({'demoUsers': demo_users})

