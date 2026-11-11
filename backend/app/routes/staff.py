from flask import Blueprint, request, jsonify, g
from ..database.db import query_all, query_one, execute_insert, execute_write
from ..middleware.auth import authenticate, authorize

staff_bp = Blueprint('staff', __name__, url_prefix='/api/staff')

@staff_bp.route('', methods=['GET'])
@authenticate
def list_staff():
    """List staff members, optionally filtered by role"""
    role = request.args.get('role')
    sql = "SELECT id, username, full_name, email, role, department, phone, created_at FROM users WHERE 1=1"
    params = []
    if role and role != 'All':
        sql += " AND role = ?"
        params.append(role)
    sql += " ORDER BY id ASC"
    staff = query_all(sql, tuple(params))
    return jsonify({'staff': staff})

@staff_bp.route('', methods=['POST'])
@authenticate
@authorize(['admin'])
def add_staff():
    """Create a new staff member (admin only)"""
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    full_name = data.get('full_name')
    email = data.get('email')
    role = data.get('role')
    department = data.get('department')
    phone = data.get('phone')
    if not all([username, password, full_name, email, role]):
        return jsonify({'error': 'Username, password, full_name, email, and role are required.'}), 400
    # bcrypt hash
    import bcrypt
    salt = bcrypt.gensalt()
    password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    stmt = """
        INSERT INTO users (username, password_hash, full_name, email, role, department, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    new_id = execute_insert(stmt, (
        username.strip().lower(),
        password_hash,
        full_name.strip(),
        email.strip().lower(),
        role,
        department.strip() if department else None,
        phone.strip() if phone else None,
    ))
    created = query_one('SELECT id, username, full_name, email, role, department, phone, created_at FROM users WHERE id = ?', (new_id,))
    return jsonify({'message': 'Staff member created successfully', 'staff': created}), 201

@staff_bp.route('/<int:id>', methods=['PUT'])
@authenticate
@authorize(['admin'])
def update_staff(id):
    """Update staff member details (admin only)"""
    data = request.get_json() or {}
    full_name = data.get('full_name')
    email = data.get('email')
    role = data.get('role')
    department = data.get('department')
    phone = data.get('phone')
    existing = query_one('SELECT * FROM users WHERE id = ?', (id,))
    if not existing:
        return jsonify({'error': 'Staff member not found.'}), 404
    sql = """
        UPDATE users
        SET full_name = ?, email = ?, role = ?, department = ?, phone = ?
        WHERE id = ?
    """
    execute_write(sql, (
        full_name.strip() if full_name else existing['full_name'],
        email.strip() if email else existing['email'],
        role if role else existing['role'],
        department.strip() if department else existing['department'],
        phone.strip() if phone else existing['phone'],
        id,
    ))
    updated = query_one('SELECT id, username, full_name, email, role, department, phone, created_at FROM users WHERE id = ?', (id,))
    return jsonify({'message': 'Staff member updated successfully', 'staff': updated})

