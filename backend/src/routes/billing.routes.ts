import { Router, Response } from 'express';
import db from '../database/db.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// 1. List bills
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, search } = req.query;

    let query = `
      SELECT b.*,
        p.full_name as patient_name, p.patient_id as patient_code, p.phone as patient_phone,
        e.case_code as emergency_case_code,
        a.admission_number
      FROM bills b
      JOIN patients p ON b.patient_id = p.id
      LEFT JOIN emergency_cases e ON b.emergency_case_id = e.id
      LEFT JOIN admissions a ON b.admission_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'All') {
      query += ` AND b.payment_status = ?`;
      params.push(status);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      query += ` AND (b.bill_number LIKE ? OR p.full_name LIKE ? OR p.patient_id LIKE ?)`;
      params.push(term, term, term);
    }

    query += ` ORDER BY b.id DESC`;

    const bills = db.prepare(query).all(...params);
    res.json({ bills });
  } catch (err: any) {
    console.error('List bills error:', err);
    res.status(500).json({ error: 'Failed to retrieve bills.' });
  }
});

// 2. Get single bill details with payment receipts
router.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const bill = db.prepare(`
      SELECT b.*,
        p.full_name as patient_name, p.patient_id as patient_code, p.age, p.gender, p.phone, p.address,
        e.case_code, e.emergency_type, e.triage_priority,
        a.admission_number, a.diagnosis as admission_diagnosis, a.admission_date, a.discharge_date
      FROM bills b
      JOIN patients p ON b.patient_id = p.id
      LEFT JOIN emergency_cases e ON b.emergency_case_id = e.id
      LEFT JOIN admissions a ON b.admission_id = a.id
      WHERE b.id = ? OR b.bill_number = ?
    `).get(id, id) as any;

    if (!bill) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const payments = db.prepare(`
      SELECT pay.*, u.full_name as received_by_name
      FROM payments pay
      LEFT JOIN users u ON pay.received_by_user_id = u.id
      WHERE pay.bill_id = ?
      ORDER BY pay.id DESC
    `).all(bill.id);

    res.json({ bill, payments });
  } catch (err: any) {
    console.error('Get bill details error:', err);
    res.status(500).json({ error: 'Failed to load invoice details.' });
  }
});

// 3. Create new bill
router.post('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patient_id,
      admission_id,
      emergency_case_id,
      consultation_fee,
      room_bed_charges,
      emergency_charges,
      treatment_medication_charges,
      other_services_charges,
      discount_amount,
    } = req.body;

    if (!patient_id) {
      return res.status(400).json({ error: 'Patient ID is required.' });
    }

    const consult = parseFloat(consultation_fee || '0');
    const bed = parseFloat(room_bed_charges || '0');
    const emg = parseFloat(emergency_charges || '0');
    const treat = parseFloat(treatment_medication_charges || '0');
    const other = parseFloat(other_services_charges || '0');
    const discount = parseFloat(discount_amount || '0');

    const total = consult + bed + emg + treat + other;
    const net = Math.max(0, total - discount);
    const balance = net;

    const countBills = (db.prepare('SELECT COUNT(*) as count FROM bills').get() as any).count;
    const bill_number = `INV-${new Date().getFullYear()}-${String(countBills + 1).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO bills (
        bill_number, patient_id, admission_id, emergency_case_id,
        consultation_fee, room_bed_charges, emergency_charges, treatment_medication_charges, other_services_charges,
        total_amount, discount_amount, net_payable, paid_amount, balance_due, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'Pending')
    `);

    const result = stmt.run(
      bill_number,
      patient_id,
      admission_id || null,
      emergency_case_id || null,
      consult,
      bed,
      emg,
      treat,
      other,
      total,
      discount,
      net,
      balance
    );

    const created = db.prepare('SELECT * FROM bills WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({ message: 'Invoice generated successfully', bill: created });
  } catch (err: any) {
    console.error('Create bill error:', err);
    res.status(500).json({ error: 'Failed to generate invoice.' });
  }
});

// 4. Record payment against bill
router.post('/:id/payments', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, payment_method, transaction_reference } = req.body;

    const payAmount = parseFloat(amount);
    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required.' });
    }
    if (!payment_method) {
      return res.status(400).json({ error: 'Payment method is required.' });
    }

    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id) as any;
    if (!bill) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const newPaid = bill.paid_amount + payAmount;
    const newBalance = Math.max(0, bill.net_payable - newPaid);
    const newStatus = newBalance <= 0 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Pending';

    // Record receipt
    const countPayments = (db.prepare('SELECT COUNT(*) as count FROM payments').get() as any).count;
    const payment_number = `RCP-${new Date().getFullYear()}-${String(countPayments + 1).padStart(3, '0')}`;

    db.prepare(`
      INSERT INTO payments (
        payment_number, bill_id, amount, payment_method, transaction_reference, received_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      payment_number,
      id,
      payAmount,
      payment_method,
      transaction_reference || null,
      req.user?.id || null
    );

    // Update bill
    db.prepare(`
      UPDATE bills
      SET paid_amount = ?,
          balance_due = ?,
          payment_status = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(newPaid, newBalance, newStatus, id);

    const updatedBill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
    res.status(201).json({
      message: `Payment of ₹${payAmount} recorded successfully.`,
      bill: updatedBill,
      payment_receipt: payment_number,
    });
  } catch (err: any) {
    console.error('Record payment error:', err);
    res.status(500).json({ error: 'Failed to record payment.' });
  }
});

export default router;

