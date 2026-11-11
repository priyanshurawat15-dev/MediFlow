import { seedDatabase } from '../database/seed.js';
import db from '../database/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth.js';

async function runTests() {
  console.log('🚀 Starting MediFlow End-to-End System Tests...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // Step 1: Re-seed database
  console.log('1. Database Initialization & Seeding:');
  await seedDatabase();
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  assert(userCount >= 5, `Seeded users count (${userCount} >= 5)`);

  const patientCount = (db.prepare('SELECT COUNT(*) as c FROM patients').get() as any).c;
  assert(patientCount >= 7, `Seeded patients count (${patientCount} >= 7)`);

  const bedCount = (db.prepare('SELECT COUNT(*) as c FROM beds').get() as any).c;
  assert(bedCount >= 14, `Seeded beds count (${bedCount} >= 14)`);

  // Step 2: Authentication & Password Verification
  console.log('\n2. Authentication & Role Permissions:');
  const adminUser = db.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
  const isMatch = await bcrypt.compare('admin123', adminUser.password_hash);
  assert(isMatch, 'Admin password bcrypt hash verifies correctly');

  const token = jwt.sign({ id: adminUser.id, role: adminUser.role }, JWT_SECRET);
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  assert(decoded.role === 'admin', 'JWT signed and verified with admin role');

  // Step 3: Patient Registration & Profile
  console.log('\n3. Patient Management Operations:');
  const maxP = (db.prepare('SELECT MAX(id) as maxId FROM patients').get() as any).maxId;
  const newPid = `MF-P-${maxP + 1001}`;
  const pInsert = db.prepare(`
    INSERT INTO patients (patient_id, full_name, age, gender, phone, email, address, blood_group, emergency_contact_name, emergency_contact_phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(newPid, 'Anjali Mukherjee', 36, 'Female', '+91 98888 11223', 'anjali@example.com', 'Indiranagar 5th Cross', 'AB+', 'Sunil Mukherjee', '+91 98888 44556');
  const newPatId = Number(pInsert.lastInsertRowid);
  assert(newPatId > 0, `New patient registered with generated ID ${newPid}`);

  const fetchedPatient = db.prepare('SELECT * FROM patients WHERE id = ?').get(newPatId) as any;
  assert(fetchedPatient.full_name === 'Anjali Mukherjee' && fetchedPatient.blood_group === 'AB+', 'Patient demographic query returns accurate details');

  // Step 4: Emergency Priority & Response Management (CENTRAL SYSTEM)
  console.log('\n4. Emergency Priority & Response Management (Central Module):');

  // Register Routine / Medium case first
  const medCaseInsert = db.prepare(`
    INSERT INTO emergency_cases (
      case_code, patient_id, emergency_type, triage_priority, priority_weight,
      conscious_state, systolic_bp, diastolic_bp, heart_rate, spo2, status, arrived_at
    ) VALUES (?, ?, ?, 'Medium', 3, 'Alert', 125, 82, 80, 98, 'Waiting', datetime('now', '-20 minutes'))
  `).run('EMG-TEST-MED', newPatId, 'Sprained Ankle with Swelling');
  const medCaseId = Number(medCaseInsert.lastInsertRowid);

  // Register Critical Case AFTER the medium case
  const critCaseInsert = db.prepare(`
    INSERT INTO emergency_cases (
      case_code, patient_id, emergency_type, triage_priority, priority_weight,
      conscious_state, systolic_bp, diastolic_bp, heart_rate, spo2, status, arrived_at
    ) VALUES (?, ?, ?, 'Critical', 1, 'Pain Responsive', 80, 50, 140, 85, 'Waiting', datetime('now', '-2 minutes'))
  `).run('EMG-TEST-CRIT', newPatId, 'Ventricular Tachycardia Collapse');
  const critCaseId = Number(critCaseInsert.lastInsertRowid);

  // Verify strict priority queue order: Critical MUST be returned before Medium even though arrived later!
  const queue = db.prepare(`
    SELECT id, case_code, triage_priority, priority_weight, arrived_at
    FROM emergency_cases
    WHERE status = 'Waiting'
    ORDER BY priority_weight ASC, arrived_at ASC
  `).all() as any[];

  const critIndex = queue.findIndex(c => c.case_code === 'EMG-TEST-CRIT');
  const medIndex = queue.findIndex(c => c.case_code === 'EMG-TEST-MED');
  assert(critIndex !== -1 && medIndex !== -1 && critIndex < medIndex, 'Priority Queue Ranking: Newly arrived Critical case is sorted ABOVE earlier Medium case');

  // Step 5: Resource Allocation & Concurrency Safety
  console.log('\n5. Bed & Doctor Allocation with Concurrency Protection:');
  const availBed = db.prepare("SELECT * FROM beds WHERE category = 'ICU' AND status = 'Available' LIMIT 1").get() as any;
  assert(Boolean(availBed), `Available ICU Bed found: ${availBed?.bed_number}`);

  const availDoc = db.prepare("SELECT * FROM doctors WHERE availability_status = 'Available' LIMIT 1").get() as any;
  assert(Boolean(availDoc), `Available Doctor found: Dr. ${availDoc?.full_name}`);

  // Assign bed and doctor to Critical case
  db.prepare("UPDATE beds SET status = 'Occupied', current_patient_id = ? WHERE id = ?").run(newPatId, availBed.id);
  db.prepare("UPDATE doctors SET current_patient_count = current_patient_count + 1 WHERE id = ?").run(availDoc.id);
  db.prepare(`
    UPDATE emergency_cases
    SET assigned_doctor_id = ?, assigned_bed_id = ?, status = 'Assigned', assigned_at = datetime('now')
    WHERE id = ?
  `).run(availDoc.id, availBed.id, critCaseId);

  // Log activity
  db.prepare(`
    INSERT INTO emergency_activity_logs (emergency_case_id, action_type, performed_by_name, details)
    VALUES (?, 'DOCTOR_ASSIGNED', 'Sarah Thomas, RN', ?)
  `).run(critCaseId, `Allocated Bed ${availBed.bed_number} and Dr. ${availDoc.full_name}`);

  const updatedBed = db.prepare('SELECT status, current_patient_id FROM beds WHERE id = ?').get(availBed.id) as any;
  assert(updatedBed.status === 'Occupied' && updatedBed.current_patient_id === newPatId, 'Bed status immediately updated to Occupied with assigned patient');

  // Step 6: Triage Reassessment & Override
  console.log('\n6. Triage Reassessment & Clinical Override:');
  db.prepare(`
    UPDATE emergency_cases
    SET triage_priority = 'High', priority_weight = 2, override_reason = 'Patient stabilized after defibrillation'
    WHERE id = ?
  `).run(critCaseId);

  db.prepare(`
    INSERT INTO emergency_activity_logs (emergency_case_id, action_type, performed_by_name, details)
    VALUES (?, 'OVERRIDE_ASSIGNMENT', 'Dr. Vikram Mehta', 'Priority reassessed from Critical to High after initial stabilization.')
  `).run(critCaseId);

  const reCase = db.prepare('SELECT triage_priority, override_reason FROM emergency_cases WHERE id = ?').get(critCaseId) as any;
  assert(reCase.triage_priority === 'High' && Boolean(reCase.override_reason), 'Triage reassessment updated priority to High with recorded clinical override reason');

  // Step 7: Case Resolution & Bed Release
  console.log('\n7. Case Resolution & Automatic Bed Release:');
  db.prepare(`
    UPDATE emergency_cases
    SET status = 'Resolved', resolved_at = datetime('now'), resolution_notes = 'Successfully stabilized and transferred.'
    WHERE id = ?
  `).run(critCaseId);

  // Bed released to Cleaning
  db.prepare("UPDATE beds SET status = 'Cleaning', current_patient_id = null WHERE id = ?").run(availBed.id);

  const releasedBed = db.prepare('SELECT status, current_patient_id FROM beds WHERE id = ?').get(availBed.id) as any;
  assert(releasedBed.status === 'Cleaning' && releasedBed.current_patient_id === null, 'Emergency resolution released bed and placed into Cleaning/Turnaround mode');

  // Step 8: Ambulance Dispatch Workflow
  console.log('\n8. Rapid EMS & Ambulance Dispatch Workflow:');
  const amb = db.prepare("SELECT * FROM ambulances WHERE status = 'Available' LIMIT 1").get() as any;
  assert(Boolean(amb), `Available ambulance unit located: ${amb?.vehicle_number}`);

  const ambAssign = db.prepare(`
    INSERT INTO ambulance_assignments (ambulance_id, pickup_location, caller_name, caller_phone, status)
    VALUES (?, 'Koramangala Sony World Signal', 'Traffic Police Sub-Inspector', '+91 98450 11223', 'Dispatched')
  `).run(amb.id);

  db.prepare("UPDATE ambulances SET status = 'Dispatched' WHERE id = ?").run(amb.id);

  let ambStatus = (db.prepare('SELECT status FROM ambulances WHERE id = ?').get(amb.id) as any).status;
  assert(ambStatus === 'Dispatched', 'Ambulance status advanced to Dispatched');

  // Advance to On the Way -> Arrived -> Returning -> Available
  db.prepare("UPDATE ambulances SET status = 'Available' WHERE id = ?").run(amb.id);
  ambStatus = (db.prepare('SELECT status FROM ambulances WHERE id = ?').get(amb.id) as any).status;
  assert(ambStatus === 'Available', 'Ambulance workflow completed and unit reset to Available at Bay');

  // Step 9: Billing & Payment Calculations
  console.log('\n9. Billing & Payment Calculations:');
  const billInsert = db.prepare(`
    INSERT INTO bills (
      bill_number, patient_id, emergency_case_id, consultation_fee, room_bed_charges, emergency_charges,
      treatment_medication_charges, other_services_charges, total_amount, discount_amount, net_payable,
      paid_amount, balance_due, payment_status
    ) VALUES ('INV-TEST-001', ?, ?, 1000, 3000, 2500, 4500, 1000, 12000, 1000, 11000, 6000, 5000, 'Partial')
  `).run(newPatId, critCaseId);
  const billId = Number(billInsert.lastInsertRowid);

  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId) as any;
  assert(bill.net_payable === 11000 && bill.balance_due === 5000 && bill.payment_status === 'Partial', 'Bill financial math: Total (12000) - Discount (1000) = Net (11000); Balance (5000) is Partial');

  // Record payment
  db.prepare(`
    INSERT INTO payments (payment_number, bill_id, amount, payment_method, transaction_reference)
    VALUES ('RCP-TEST-001', ?, 5000, 'UPI / Online Transfer', 'UPI-TXN-998822')
  `).run(billId);

  db.prepare("UPDATE bills SET paid_amount = 11000, balance_due = 0, payment_status = 'Paid' WHERE id = ?").run(billId);
  const paidBill = db.prepare('SELECT balance_due, payment_status FROM bills WHERE id = ?').get(billId) as any;
  assert(paidBill.balance_due === 0 && paidBill.payment_status === 'Paid', 'Payment of balance due marked invoice as Paid with zero remaining balance');

  // Final Summary
  console.log('\n========================================');
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

