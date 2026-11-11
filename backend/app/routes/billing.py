from flask import Blueprint, request, jsonify, g
from ..database.db import query_all, query_one, execute_insert, execute_write
from ..middleware.auth import authenticate

billing_bp = Blueprint('billing', __name__, url_prefix='/api/billing')

@billing_bp.route('', methods=['GET'])
@authenticate
def list_bills():
    """List bills with optional status and search filters"""
    status = request.args.get('status')
    search = request.args.get('search')
    sql = '''
        SELECT b.*,
            p.full_name as patient_name, p.patient_id as patient_code, p.phone as patient_phone,
            e.case_code as emergency_case_code,
            a.admission_number
        FROM bills b
        JOIN patients p ON b.patient_id = p.id
        LEFT JOIN emergency_cases e ON b.emergency_case_id = e.id
        LEFT JOIN admissions a ON b.admission_id = a.id
        WHERE 1=1
    '''
    params = []
    if status and status != 'All':
        sql += " AND b.payment_status = ?"
        params.append(status)
    if search and isinstance(search, str) and search.strip() != '':
        term = f"%{search.strip()}%"
        sql += " AND (b.bill_number LIKE ? OR p.full_name LIKE ? OR p.patient_id LIKE ?)"
        params.extend([term, term, term])
    sql += " ORDER BY b.id DESC"
    bills = query_all(sql, tuple(params))
    return jsonify({'bills': bills})

@billing_bp.route('/<int:id>', methods=['GET'])
@authenticate
def get_bill(id):
    """Retrieve a single bill with payments and detailed info"""
    bill = query_one('''
        SELECT b.*,
            p.full_name as patient_name, p.patient_id as patient_code, p.age, p.gender, p.phone, p.address,
            e.case_code, e.emergency_type, e.triage_priority,
            a.admission_number, a.diagnosis as admission_diagnosis, a.admission_date, a.discharge_date
        FROM bills b
        JOIN patients p ON b.patient_id = p.id
        LEFT JOIN emergency_cases e ON b.emergency_case_id = e.id
        LEFT JOIN admissions a ON b.admission_id = a.id
        WHERE b.id = ? OR b.bill_number = ?
    ''', (id, id))
    if not bill:
        return jsonify({'error': 'Invoice not found.'}), 404
    payments = query_all('''
        SELECT pay.*, u.full_name as received_by_name
        FROM payments pay
        LEFT JOIN users u ON pay.received_by_user_id = u.id
        WHERE pay.bill_id = ?
        ORDER BY pay.id DESC
    ''', (bill['id'],))
    return jsonify({'bill': bill, 'payments': payments})

@billing_bp.route('', methods=['POST'])
@authenticate
def create_bill():
    data = request.get_json() or {}
    patient_id = data.get('patient_id')
    admission_id = data.get('admission_id')
    emergency_case_id = data.get('emergency_case_id')
    consultation_fee = data.get('consultation_fee')
    room_bed_charges = data.get('room_bed_charges')
    emergency_charges = data.get('emergency_charges')
    treatment_medication_charges = data.get('treatment_medication_charges')
    other_services_charges = data.get('other_services_charges')
    discount_amount = data.get('discount_amount')
    if not patient_id:
        return jsonify({'error': 'Patient ID is required.'}), 400
    # parse amounts safely
    def to_float(v):
        try:
            return float(v)
        except Exception:
            return 0.0
    consult = to_float(consultation_fee)
    bed = to_float(room_bed_charges)
    emg = to_float(emergency_charges)
    treat = to_float(treatment_medication_charges)
    other = to_float(other_services_charges)
    discount = to_float(discount_amount)
    total = consult + bed + emg + treat + other
    net = max(0, total - discount)
    balance = net
    count = query_one('SELECT COUNT(*) as count FROM bills')
    bill_number = f"INV-{datetime.datetime.now().year}-{str((count['count'] if count else 0) + 1).zfill(3)}"
    stmt = '''
        INSERT INTO bills (
            bill_number, patient_id, admission_id, emergency_case_id,
            consultation_fee, room_bed_charges, emergency_charges, treatment_medication_charges, other_services_charges,
            total_amount, discount_amount, net_payable, paid_amount, balance_due, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'Pending')
    '''
    new_id = execute_insert(stmt, (
        bill_number,
        patient_id,
        admission_id or None,
        emergency_case_id or None,
        consult,
        bed,
        emg,
        treat,
        other,
        total,
        discount,
        net,
        balance,
    ))
    created = query_one('SELECT * FROM bills WHERE id = ?', (new_id,))
    return jsonify({'message': 'Invoice generated successfully', 'bill': created}), 201

@billing_bp.route('/<int:id>/payments', methods=['POST'])
@authenticate
def add_payment(id):
    data = request.get_json() or {}
    amount = data.get('amount')
    payment_method = data.get('payment_method')
    transaction_reference = data.get('transaction_reference')
    if not amount or float(amount) <= 0:
        return jsonify({'error': 'Valid payment amount is required.'}), 400
    if not payment_method:
        return jsonify({'error': 'Payment method is required.'}), 400
    bill = query_one('SELECT * FROM bills WHERE id = ?', (id,))
    if not bill:
        return jsonify({'error': 'Invoice not found.'}), 404
    pay_amount = float(amount)
    new_paid = bill['paid_amount'] + pay_amount
    new_balance = max(0, bill['net_payable'] - new_paid)
    new_status = 'Paid' if new_balance <= 0 else ('Partial' if new_paid > 0 else 'Pending')
    # create payment record
    count = query_one('SELECT COUNT(*) as count FROM payments')
    payment_number = f"RCP-{datetime.datetime.now().year}-{str((count['count'] if count else 0) + 1).zfill(3)}"
    execute_insert('''
        INSERT INTO payments (
            payment_number, bill_id, amount, payment_method, transaction_reference, received_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        payment_number,
        id,
        pay_amount,
        payment_method,
        transaction_reference or None,
        g.user.get('id') if hasattr(g, 'user') else None,
    ))
    # update bill
    execute_write('''
        UPDATE bills
        SET paid_amount = ?, balance_due = ?, payment_status = ?, updated_at = datetime('now')
        WHERE id = ?
    ''', (new_paid, new_balance, new_status, id))
    updated_bill = query_one('SELECT * FROM bills WHERE id = ?', (id,))
    return jsonify({
        'message': f"Payment of ₹{pay_amount} recorded successfully.",
        'bill': updated_bill,
        'payment_receipt': payment_number,
    }), 201

