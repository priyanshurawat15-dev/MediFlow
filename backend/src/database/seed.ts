import bcrypt from 'bcryptjs';
import { db, initDatabase } from './db.js';

export async function seedDatabase() {
  console.log('🔄 Initializing database schema...');
  initDatabase();

  // Clear existing records to ensure clean seed
  db.exec(`
    DELETE FROM payments;
    DELETE FROM bills;
    DELETE FROM medical_records;
    DELETE FROM appointments;
    DELETE FROM ambulance_assignments;
    DELETE FROM ambulances;
    DELETE FROM emergency_activity_logs;
    DELETE FROM emergency_cases;
    DELETE FROM admissions;
    DELETE FROM beds;
    DELETE FROM doctors;
    DELETE FROM patients;
    DELETE FROM users;
  `);

  console.log('🌱 Seeding users with hashed passwords...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);
  const adminHash = await bcrypt.hash('admin123', salt);
  const doctorHash = await bcrypt.hash('doctor123', salt);
  const nurseHash = await bcrypt.hash('nurse123', salt);
  const recepHash = await bcrypt.hash('recep123', salt);
  const ambHash = await bcrypt.hash('amb123', salt);

  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, email, role, department, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const uAdmin = insertUser.run('admin', adminHash, 'Dr. Rajiv Sharma', 'admin@mediflow.health', 'admin', 'Hospital Administration', '+91 98765 00001');
  const uDoc1 = insertUser.run('dr.ananya', doctorHash, 'Dr. Ananya Sen', 'ananya.sen@mediflow.health', 'doctor', 'Emergency Medicine', '+91 98765 00002');
  const uDoc2 = insertUser.run('dr.vikram', doctorHash, 'Dr. Vikram Mehta', 'vikram.mehta@mediflow.health', 'doctor', 'Cardiology', '+91 98765 00003');
  const uDoc3 = insertUser.run('dr.priya', doctorHash, 'Dr. Priya Nair', 'priya.nair@mediflow.health', 'doctor', 'Trauma Surgery', '+91 98765 00004');
  const uNurse = insertUser.run('nurse.sarah', nurseHash, 'Sarah Thomas, RN', 'sarah.thomas@mediflow.health', 'nurse', 'Emergency Triage Wing', '+91 98765 00005');
  const uRecep = insertUser.run('recep.rohit', recepHash, 'Rohit Verma', 'rohit.verma@mediflow.health', 'receptionist', 'Central Reception & Billing', '+91 98765 00006');
  const uAmb = insertUser.run('driver.arun', ambHash, 'Arun Kumar', 'arun.ems@mediflow.health', 'ambulance', 'Rapid EMS Dispatch', '+91 98765 00007');

  console.log('🌱 Seeding doctors...');
  const insertDoc = db.prepare(`
    INSERT INTO doctors (doctor_code, user_id, full_name, specialization, department, phone, email, duty_schedule, availability_status, is_emergency_duty, current_patient_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const d1 = insertDoc.run('MF-DOC-01', Number(uDoc1.lastInsertRowid), 'Dr. Ananya Sen', 'Emergency Medicine', 'Emergency Wing', '+91 98765 00002', 'ananya.sen@mediflow.health', 'Day Shift (07:00 - 15:00)', 'Available', 1, 2);
  const d2 = insertDoc.run('MF-DOC-02', Number(uDoc2.lastInsertRowid), 'Dr. Vikram Mehta', 'Cardiology', 'Cardiology & CCU', '+91 98765 00003', 'vikram.mehta@mediflow.health', 'On-Call Emergency', 'Available', 1, 1);
  const d3 = insertDoc.run('MF-DOC-03', Number(uDoc3.lastInsertRowid), 'Dr. Priya Nair', 'Trauma Surgery', 'Surgery & Trauma', '+91 98765 00004', 'priya.nair@mediflow.health', 'Day Shift (08:00 - 16:00)', 'In Emergency', 1, 3);
  const d4 = insertDoc.run('MF-DOC-04', null, 'Dr. Rajesh Kulkarni', 'Neurology', 'Neurosciences', '+91 98765 00008', 'rajesh.k@mediflow.health', 'Day Shift (09:00 - 17:00)', 'Available', 0, 1);
  const d5 = insertDoc.run('MF-DOC-05', null, 'Dr. Sunita Rao', 'Pulmonology / Critical Care', 'Intensive Care Unit', '+91 98765 00009', 'sunita.rao@mediflow.health', 'ICU Rotational Shift', 'Available', 1, 2);
  const d6 = insertDoc.run('MF-DOC-06', null, 'Dr. Amitav Ghosh', 'General Medicine', 'Internal Medicine', '+91 98765 00010', 'amitav.ghosh@mediflow.health', 'OPD Shift (10:00 - 18:00)', 'In Consultation', 0, 4);

  console.log('🌱 Seeding patients...');
  const insertPatient = db.prepare(`
    INSERT INTO patients (patient_id, full_name, age, gender, phone, email, address, blood_group, emergency_contact_name, emergency_contact_phone, medical_history, current_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const p1 = insertPatient.run('MF-P-1001', 'Kavita Sundaram', 42, 'Female', '+91 98111 22334', 'kavita.s@example.com', 'Flat 402, Green View Apts, MG Road, Bangalore', 'B+', 'Suresh Sundaram (Husband)', '+91 98111 99887', 'Hypertension for 5 years, Penicillin allergy', 'Under Emergency');
  const p2 = insertPatient.run('MF-P-1002', 'Devendra Patil', 58, 'Male', '+91 98222 33445', 'devendra.p@example.com', '74/B, 12th Main, Indiranagar, Bangalore', 'O+', 'Shalini Patil (Wife)', '+91 98222 88776', 'Type 2 Diabetes, Prior Angioplasty (2023)', 'Under Emergency');
  const p3 = insertPatient.run('MF-P-1003', 'Rohan Deshmukh', 29, 'Male', '+91 98333 44556', 'rohan.d@example.com', '12 Lake View Layout, HSR Sector 2, Bangalore', 'A+', 'Pooja Deshmukh (Sister)', '+91 98333 77665', 'Asthma since childhood, No known drug allergies', 'Admitted');
  const p4 = insertPatient.run('MF-P-1004', 'Amina Begum', 67, 'Female', '+91 98444 55667', 'amina.b@example.com', '88 Tannery Road, Frazer Town, Bangalore', 'AB+', 'Farooq Ahmed (Son)', '+91 98444 66554', 'Chronic Kidney Disease Stage 3, Hypertension', 'Admitted');
  const p5 = insertPatient.run('MF-P-1005', 'Naveen Chopra', 34, 'Male', '+91 98555 66778', 'naveen.c@example.com', 'Villa 15, Palm Meadows, Whitefield, Bangalore', 'O-', 'Ritu Chopra (Wife)', '+91 98555 55443', 'None recorded. Healthy athlete.', 'Under Emergency');
  const p6 = insertPatient.run('MF-P-1006', 'Meenakshi Iyer', 71, 'Female', '+91 98666 77889', 'meenakshi.i@example.com', '104 Malleshwaram 8th Cross, Bangalore', 'A-', 'Venkatesh Iyer (Son)', '+91 98666 44332', 'Osteoporosis, Atrial Fibrillation on Blood Thinners', 'Registered');
  const p7 = insertPatient.run('MF-P-1007', 'Gaurav Singhal', 24, 'Male', '+91 98777 88990', 'gaurav.s@example.com', 'Hostel Block C, Koramangala, Bangalore', 'B-', 'Mahesh Singhal (Father)', '+91 98777 33221', 'Dust allergy, Migraine history', 'Discharged');

  console.log('🌱 Seeding beds...');
  const insertBed = db.prepare(`
    INSERT INTO beds (bed_number, category, ward_department, floor, daily_charge, status, current_patient_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Emergency Beds
  const bEmg1 = insertBed.run('EMG-01', 'Emergency Bed', 'Emergency Triage Bay', 'Ground Floor', 1500, 'Occupied', Number(p1.lastInsertRowid));
  const bEmg2 = insertBed.run('EMG-02', 'Emergency Bed', 'Emergency Triage Bay', 'Ground Floor', 1500, 'Available', null);
  const bEmg3 = insertBed.run('EMG-03', 'Emergency Bed', 'Resuscitation Unit', 'Ground Floor', 1800, 'Available', null);
  const bEmg4 = insertBed.run('EMG-04', 'Emergency Bed', 'Trauma Bay', 'Ground Floor', 1800, 'Maintenance', null);

  // ICU Beds
  const bIcu1 = insertBed.run('ICU-101', 'ICU', 'Critical Care Unit', '1st Floor', 5000, 'Occupied', Number(p2.lastInsertRowid));
  const bIcu2 = insertBed.run('ICU-102', 'ICU', 'Critical Care Unit', '1st Floor', 5000, 'Available', null);
  const bIcu3 = insertBed.run('ICU-103', 'ICU', 'Cardiac ICU (CICU)', '1st Floor', 5500, 'Available', null);
  const bIcu4 = insertBed.run('ICU-104', 'ICU', 'Neuro ICU', '1st Floor', 5500, 'Occupied', null);

  // HDU Beds
  const bHdu1 = insertBed.run('HDU-201', 'HDU', 'High Dependency Unit', '2nd Floor', 3200, 'Occupied', Number(p4.lastInsertRowid));
  const bHdu2 = insertBed.run('HDU-202', 'HDU', 'High Dependency Unit', '2nd Floor', 3200, 'Available', null);

  // General Ward Beds
  const bGw1 = insertBed.run('GW-301', 'General Ward', 'Medical Ward A', '3rd Floor', 800, 'Occupied', Number(p3.lastInsertRowid));
  const bGw2 = insertBed.run('GW-302', 'General Ward', 'Medical Ward A', '3rd Floor', 800, 'Available', null);
  const bGw3 = insertBed.run('GW-303', 'General Ward', 'Surgical Ward B', '3rd Floor', 800, 'Available', null);
  const bGw4 = insertBed.run('GW-304', 'General Ward', 'Surgical Ward B', '3rd Floor', 800, 'Cleaning', null);

  // Private Rooms
  const bPvt1 = insertBed.run('PVT-401', 'Private Room', 'Executive Suite Wing', '4th Floor', 4000, 'Available', null);
  const bPvt2 = insertBed.run('PVT-402', 'Private Room', 'Executive Suite Wing', '4th Floor', 4000, 'Available', null);

  console.log('🌱 Seeding admissions...');
  const insertAdm = db.prepare(`
    INSERT INTO admissions (admission_number, patient_id, bed_id, attending_doctor_id, admission_type, diagnosis, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const adm1 = insertAdm.run('ADM-2026-001', Number(p2.lastInsertRowid), Number(bIcu1.lastInsertRowid), Number(d2.lastInsertRowid), 'Emergency', 'Acute Anterior Wall Myocardial Infarction', 'Admitted');
  insertAdm.run('ADM-2026-002', Number(p3.lastInsertRowid), Number(bGw1.lastInsertRowid), Number(d5.lastInsertRowid), 'General', 'Severe Exacerbation of Bronchial Asthma', 'Admitted');
  insertAdm.run('ADM-2026-003', Number(p4.lastInsertRowid), Number(bHdu1.lastInsertRowid), Number(d6.lastInsertRowid), 'General', 'Fluid Overload with Uremic Symptoms', 'Admitted');

  console.log('🌱 Seeding emergency cases with clinical priority triage...');
  const insertEmg = db.prepare(`
    INSERT INTO emergency_cases (
      case_code, patient_id, emergency_type, triage_priority, priority_weight,
      conscious_state, systolic_bp, diastolic_bp, heart_rate, respiratory_rate, spo2, temperature,
      triage_notes, triaged_by_user_id, triaged_by_name, assigned_doctor_id, assigned_bed_id,
      status, arrived_at, assigned_at, treatment_started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Case 1: CRITICAL - Cardiac (Assigned & Under Treatment)
  const emg1 = insertEmg.run(
    'EMG-2026-001',
    Number(p2.lastInsertRowid),
    'Cardiac Arrest / Acute Coronary Syndrome',
    'Critical',
    1,
    'Pain Responsive',
    85, 55, 128, 28, 89, 98.4,
    'Crushing substernal chest pain radiating to left jaw, diaphoresis, hypotensive, ST-elevation in V1-V4.',
    Number(uNurse.lastInsertRowid),
    'Sarah Thomas, RN',
    Number(d2.lastInsertRowid),
    Number(bIcu1.lastInsertRowid),
    'Under Treatment',
    new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    new Date(Date.now() - 35 * 60 * 1000).toISOString()
  );

  // Case 2: CRITICAL - Severe Polytrauma (Waiting in queue - urgent!)
  const emg2 = insertEmg.run(
    'EMG-2026-002',
    Number(p5.lastInsertRowid),
    'Severe Polytrauma',
    'Critical',
    1,
    'Voice Responsive',
    90, 60, 134, 32, 91, 97.8,
    'Two-wheeler collision with heavy truck. Open femur fracture right leg, suspected pelvic instability and internal hemorrhage.',
    Number(uNurse.lastInsertRowid),
    'Sarah Thomas, RN',
    null,
    null,
    'Waiting',
    new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    null,
    null
  );

  // Case 3: HIGH - Acute Respiratory Distress (Waiting)
  const emg3 = insertEmg.run(
    'EMG-2026-003',
    Number(p1.lastInsertRowid),
    'Acute Respiratory Distress',
    'High',
    2,
    'Alert',
    145, 92, 112, 26, 92, 99.1,
    'Severe bilateral wheezing, accessory muscle use, poor air entry in left lung base.',
    Number(uNurse.lastInsertRowid),
    'Sarah Thomas, RN',
    Number(d1.lastInsertRowid),
    Number(bEmg1.lastInsertRowid),
    'Assigned',
    new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    null
  );

  // Case 4: MEDIUM - Displaced Fracture (Waiting)
  const emg4 = insertEmg.run(
    'EMG-2026-004',
    Number(p6.lastInsertRowid),
    'Severe Fracture',
    'Medium',
    3,
    'Alert',
    130, 80, 88, 18, 98, 98.6,
    'Fall in bathroom. Marked deformity and swelling at right wrist, pulses intact distally.',
    Number(uNurse.lastInsertRowid),
    'Sarah Thomas, RN',
    null,
    null,
    'Waiting',
    new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    null,
    null
  );

  // Case 5: LOW - Laceration / Non-urgent (Waiting)
  const emg5 = insertEmg.run(
    'EMG-2026-005',
    Number(p7.lastInsertRowid),
    'Other',
    'Low',
    4,
    'Alert',
    120, 78, 76, 16, 99, 98.4,
    'Glass cut on forearm. Active bleeding controlled with compression bandage. Full range of motion.',
    Number(uNurse.lastInsertRowid),
    'Sarah Thomas, RN',
    null,
    null,
    'Waiting',
    new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    null,
    null
  );

  console.log('🌱 Seeding emergency activity audit logs...');
  const insertLog = db.prepare(`
    INSERT INTO emergency_activity_logs (emergency_case_id, action_type, performed_by_user_id, performed_by_name, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertLog.run(Number(emg1.lastInsertRowid), 'REGISTERED', Number(uNurse.lastInsertRowid), 'Sarah Thomas, RN', 'Patient arrived via EMS unit. Immediate triage initiated.', new Date(Date.now() - 45 * 60 * 1000).toISOString());
  insertLog.run(Number(emg1.lastInsertRowid), 'TRIAGED', Number(uNurse.lastInsertRowid), 'Sarah Thomas, RN', 'Assigned Priority 1: Critical (Cardiac/Hemodynamic Collapse risk).', new Date(Date.now() - 44 * 60 * 1000).toISOString());
  insertLog.run(Number(emg1.lastInsertRowid), 'DOCTOR_ASSIGNED', Number(uNurse.lastInsertRowid), 'Sarah Thomas, RN', 'Assigned Dr. Vikram Mehta (Cardiology).', new Date(Date.now() - 40 * 60 * 1000).toISOString());
  insertLog.run(Number(emg1.lastInsertRowid), 'BED_ALLOCATED', Number(uNurse.lastInsertRowid), 'Sarah Thomas, RN', 'Bed ICU-101 allocated. Immediate transfer to CCU.', new Date(Date.now() - 38 * 60 * 1000).toISOString());

  insertLog.run(Number(emg2.lastInsertRowid), 'REGISTERED', Number(uNurse.lastInsertRowid), 'Sarah Thomas, RN', 'Patient brought by bystander. Major road traffic incident.', new Date(Date.now() - 14 * 60 * 1000).toISOString());
  insertLog.run(Number(emg2.lastInsertRowid), 'TRIAGED', Number(uNurse.lastInsertRowid), 'Sarah Thomas, RN', 'Assigned Priority 1: Critical. Escalated to Trauma Bay Resuscitation Team.', new Date(Date.now() - 13 * 60 * 1000).toISOString());

  console.log('🌱 Seeding ambulances...');
  const insertAmb = db.prepare(`
    INSERT INTO ambulances (vehicle_number, ambulance_type, driver_name, driver_phone, paramedic_name, paramedic_phone, status, current_location_name, current_latitude, current_longitude, base_station)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const amb1 = insertAmb.run('KA-01-EMS-101', 'Advanced Life Support (ALS)', 'Arun Kumar', '+91 98765 00007', 'Kiran Das, EMT-P', '+91 98765 11111', 'Available', 'Hospital Bay 1', 12.9716, 77.5946, 'Main Emergency Wing');
  const amb2 = insertAmb.run('KA-01-EMS-102', 'ICU Mobile Unit', 'Santosh Gowda', '+91 98765 22222', 'Priya Roy, EMT-P', '+91 98765 33333', 'Dispatched', 'Outer Ring Road (Near Silk Board)', 12.9172, 77.6228, 'South Satellite Station');
  const amb3 = insertAmb.run('KA-01-EMS-103', 'Basic Life Support (BLS)', 'Manoj Yadav', '+91 98765 44444', 'Anil Joseph, EMT-B', '+91 98765 55555', 'On the Way', 'Indiranagar 100ft Road', 12.9784, 77.6408, 'East Hub');
  const amb4 = insertAmb.run('KA-01-EMS-104', 'Advanced Life Support (ALS)', 'Ramesh Babu', '+91 98765 66666', 'Deepa Nair, EMT-P', '+91 98765 77777', 'Returning', 'Hebbal Flyover Express', 13.0358, 77.5970, 'North Satellite Station');
  const amb5 = insertAmb.run('KA-01-EMS-105', 'Basic Life Support (BLS)', 'Govind Swamy', '+91 98765 88888', 'Sunil Kumar, EMT-B', '+91 98765 99999', 'Under Maintenance', 'Hospital Workshop Bay', 12.9716, 77.5946, 'Main Emergency Wing');

  console.log('🌱 Seeding ambulance assignments...');
  const insertAmbAssign = db.prepare(`
    INSERT INTO ambulance_assignments (
      ambulance_id, emergency_case_id, pickup_location, pickup_latitude, pickup_longitude,
      caller_name, caller_phone, assigned_by_user_id, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAmbAssign.run(
    Number(amb2.lastInsertRowid),
    null,
    'HSR Layout Sector 1, 14th Cross',
    12.9116, 77.6389,
    'Vikas Khanna', '+91 98111 55443',
    Number(uAdmin.lastInsertRowid),
    'Dispatched',
    'Elderly patient with sudden collapse and breathing difficulty.'
  );

  insertAmbAssign.run(
    Number(amb3.lastInsertRowid),
    null,
    'CMH Road Metro Station Gate 2',
    12.9781, 77.6395,
    'Station Controller', '+91 98222 66554',
    Number(uRecep.lastInsertRowid),
    'On the Way',
    'Commuter with acute chest pain and profuse sweating.'
  );

  console.log('🌱 Seeding appointments...');
  const insertApt = db.prepare(`
    INSERT INTO appointments (appointment_number, patient_id, doctor_id, department, appointment_date, time_slot, reason_for_visit, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const today = new Date().toISOString().split('T')[0];
  insertApt.run('APT-2026-001', Number(p3.lastInsertRowid), Number(d5.lastInsertRowid), 'Pulmonology / Critical Care', today, '10:30 AM', 'Routine asthma spirometry check', 'Scheduled');
  insertApt.run('APT-2026-002', Number(p4.lastInsertRowid), Number(d6.lastInsertRowid), 'General Medicine', today, '11:15 AM', 'Renal function review and BP titration', 'Confirmed');
  insertApt.run('APT-2026-003', Number(p6.lastInsertRowid), Number(d4.lastInsertRowid), 'Neurology', today, '02:00 PM', 'Migraine follow-up and EEG discussion', 'Scheduled');
  insertApt.run('APT-2026-004', Number(p7.lastInsertRowid), Number(d3.lastInsertRowid), 'Trauma Surgery', today, '04:30 PM', 'Wound stitch removal and inspection', 'Scheduled');

  console.log('🌱 Seeding medical records...');
  const insertMedRec = db.prepare(`
    INSERT INTO medical_records (patient_id, doctor_id, record_type, diagnosis, symptoms, treatment_plan, prescriptions, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMedRec.run(
    Number(p2.lastInsertRowid),
    Number(d2.lastInsertRowid),
    'Emergency Encounter',
    'Acute Coronary Syndrome (STEMI)',
    'Crushing chest pain, ST-elevation on 12-lead ECG, elevated Troponin-I',
    'Primary PCI scheduled, Dual antiplatelet therapy, Statin load, ICU hemodynamic monitoring',
    'Aspirin 325mg stat, Ticagrelor 180mg stat, Atorvastatin 80mg, IV Heparin infusion',
    'Patient stabilized in CCU Bed 101. Cath lab notified.'
  );

  insertMedRec.run(
    Number(p3.lastInsertRowid),
    Number(d5.lastInsertRowid),
    'Inpatient Round',
    'Severe Acute Asthma Attack',
    'Expiratory wheeze, tachypnea, reduced peak flow',
    'Nebulization q20m x 3, IV Corticosteroids, Supplemental O2 via nasal prongs',
    'Salbutamol + Ipratropium neb, Hydrocortisone 100mg IV q6h',
    'SpO2 improved from 88% on room air to 96% on 2L O2.'
  );

  console.log('🌱 Seeding billing and payments...');
  const insertBill = db.prepare(`
    INSERT INTO bills (
      bill_number, patient_id, admission_id, emergency_case_id,
      consultation_fee, room_bed_charges, emergency_charges, treatment_medication_charges, other_services_charges,
      total_amount, discount_amount, net_payable, paid_amount, balance_due, payment_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const bill1 = insertBill.run(
    'INV-2026-001',
    Number(p2.lastInsertRowid),
    Number(adm1.lastInsertRowid),
    Number(emg1.lastInsertRowid),
    2000, 5000, 3500, 8200, 1500,
    20200, 1200, 19000, 10000, 9000, 'Partial'
  );

  const bill2 = insertBill.run(
    'INV-2026-002',
    Number(p7.lastInsertRowid),
    null,
    Number(emg5.lastInsertRowid),
    1000, 0, 1200, 850, 450,
    3500, 0, 3500, 3500, 0, 'Paid'
  );

  const insertPayment = db.prepare(`
    INSERT INTO payments (payment_number, bill_id, amount, payment_method, transaction_reference, received_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertPayment.run('RCP-2026-001', Number(bill1.lastInsertRowid), 10000, 'UPI / Online Transfer', 'UPI-REF-99281982', Number(uRecep.lastInsertRowid));
  insertPayment.run('RCP-2026-002', Number(bill2.lastInsertRowid), 3500, 'Credit Card', 'TXN-CARD-441199', Number(uRecep.lastInsertRowid));

  console.log('✅ MediFlow Database successfully seeded with realistic clinical data!');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding error:', err);
      process.exit(1);
    });
}
