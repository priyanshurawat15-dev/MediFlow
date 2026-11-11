import bcrypt
import datetime
import sqlite3
from .db import init_db, get_standalone_db

def hash_pw(password: str) -> str:
    salt = bcrypt.gensalt(10)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def seed_database():
    print("🔄 Initializing database schema...")
    init_db()
    conn = get_standalone_db()
    cur = conn.cursor()

    print("🧹 Clearing existing records to ensure clean seed...")
    cur.executescript('''
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
    ''')

    print("🌱 Seeding users with hashed passwords...")
    admin_hash = hash_pw('admin123')
    doctor_hash = hash_pw('doctor123')
    nurse_hash = hash_pw('nurse123')
    recep_hash = hash_pw('recep123')
    amb_hash = hash_pw('amb123')

    users_data = [
        ('admin', admin_hash, 'Dr. Rajiv Sharma', 'admin@mediflow.health', 'admin', 'Hospital Administration', '+91 98765 00001'),
        ('dr.ananya', doctor_hash, 'Dr. Ananya Sen', 'ananya.sen@mediflow.health', 'doctor', 'Emergency Medicine', '+91 98765 00002'),
        ('dr.vikram', doctor_hash, 'Dr. Vikram Mehta', 'vikram.mehta@mediflow.health', 'doctor', 'Cardiology', '+91 98765 00003'),
        ('dr.priya', doctor_hash, 'Dr. Priya Nair', 'priya.nair@mediflow.health', 'doctor', 'Trauma Surgery', '+91 98765 00004'),
        ('nurse.sarah', nurse_hash, 'Sarah Thomas, RN', 'sarah.thomas@mediflow.health', 'nurse', 'Emergency Triage Wing', '+91 98765 00005'),
        ('recep.rohit', recep_hash, 'Rohit Verma', 'rohit.verma@mediflow.health', 'receptionist', 'Central Reception & Billing', '+91 98765 00006'),
        ('driver.arun', amb_hash, 'Arun Kumar', 'arun.ems@mediflow.health', 'ambulance', 'Rapid EMS Dispatch', '+91 98765 00007'),
    ]

    user_ids = {}
    for u in users_data:
        cur.execute(
            'INSERT INTO users (username, password_hash, full_name, email, role, department, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
            u
        )
        user_ids[u[0]] = cur.lastrowid

    print("🌱 Seeding doctors...")
    doctors_data = [
        ('MF-DOC-01', user_ids['dr.ananya'], 'Dr. Ananya Sen', 'Emergency Medicine', 'Emergency Wing', '+91 98765 00002', 'ananya.sen@mediflow.health', 'Day Shift (07:00 - 15:00)', 'Available', 1, 2),
        ('MF-DOC-02', user_ids['dr.vikram'], 'Dr. Vikram Mehta', 'Cardiology', 'Cardiology & CCU', '+91 98765 00003', 'vikram.mehta@mediflow.health', 'On-Call Emergency', 'Available', 1, 1),
        ('MF-DOC-03', user_ids['dr.priya'], 'Dr. Priya Nair', 'Trauma Surgery', 'Surgery & Trauma', '+91 98765 00004', 'priya.nair@mediflow.health', 'Day Shift (08:00 - 16:00)', 'In Emergency', 1, 3),
        ('MF-DOC-04', None, 'Dr. Rajesh Kulkarni', 'Neurology', 'Neurosciences', '+91 98765 00008', 'rajesh.k@mediflow.health', 'Day Shift (09:00 - 17:00)', 'Available', 0, 1),
        ('MF-DOC-05', None, 'Dr. Sunita Rao', 'Pulmonology / Critical Care', 'Intensive Care Unit', '+91 98765 00009', 'sunita.rao@mediflow.health', 'ICU Rotational Shift', 'Available', 1, 2),
        ('MF-DOC-06', None, 'Dr. Amitav Ghosh', 'General Medicine', 'Internal Medicine', '+91 98765 00010', 'amitav.ghosh@mediflow.health', 'OPD Shift (10:00 - 18:00)', 'In Consultation', 0, 4),
    ]

    doc_ids = {}
    for d in doctors_data:
        cur.execute(
            'INSERT INTO doctors (doctor_code, user_id, full_name, specialization, department, phone, email, duty_schedule, availability_status, is_emergency_duty, current_patient_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            d
        )
        doc_ids[d[0]] = cur.lastrowid

    print("🌱 Seeding patients...")
    patients_data = [
        ('MF-P-1001', 'Kavita Sundaram', 42, 'Female', '+91 98111 22334', 'kavita.s@example.com', 'Flat 402, Green View Apts, MG Road, Bangalore', 'B+', 'Suresh Sundaram (Husband)', '+91 98111 99887', 'Hypertension for 5 years, Penicillin allergy', 'Under Emergency'),
        ('MF-P-1002', 'Devendra Patil', 58, 'Male', '+91 98222 33445', 'devendra.p@example.com', '74/B, 12th Main, Indiranagar, Bangalore', 'O+', 'Shalini Patil (Wife)', '+91 98222 88776', 'Type 2 Diabetes, Prior Angioplasty (2023)', 'Under Emergency'),
        ('MF-P-1003', 'Rohan Deshmukh', 29, 'Male', '+91 98333 44556', 'rohan.d@example.com', '12 Lake View Layout, HSR Sector 2, Bangalore', 'A+', 'Pooja Deshmukh (Sister)', '+91 98333 77665', 'Asthma since childhood, No known drug allergies', 'Admitted'),
        ('MF-P-1004', 'Amina Begum', 67, 'Female', '+91 98444 55667', 'amina.b@example.com', '88 Tannery Road, Frazer Town, Bangalore', 'AB+', 'Farooq Ahmed (Son)', '+91 98444 66554', 'Chronic Kidney Disease Stage 3, Hypertension', 'Admitted'),
        ('MF-P-1005', 'Naveen Chopra', 34, 'Male', '+91 98555 66778', 'naveen.c@example.com', 'Villa 15, Palm Meadows, Whitefield, Bangalore', 'O-', 'Ritu Chopra (Wife)', '+91 98555 55443', 'None recorded. Healthy athlete.', 'Under Emergency'),
        ('MF-P-1006', 'Meenakshi Iyer', 71, 'Female', '+91 98666 77889', 'meenakshi.i@example.com', '104 Malleshwaram 8th Cross, Bangalore', 'A-', 'Venkatesh Iyer (Son)', '+91 98666 44332', 'Osteoporosis, Atrial Fibrillation on Blood Thinners', 'Registered'),
        ('MF-P-1007', 'Gaurav Singhal', 24, 'Male', '+91 98777 88990', 'gaurav.s@example.com', 'Hostel Block C, Koramangala, Bangalore', 'B-', 'Mahesh Singhal (Father)', '+91 98777 33221', 'Dust allergy, Migraine history', 'Discharged'),
    ]

    pat_ids = {}
    for p in patients_data:
        cur.execute(
            'INSERT INTO patients (patient_id, full_name, age, gender, phone, email, address, blood_group, emergency_contact_name, emergency_contact_phone, medical_history, current_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            p
        )
        pat_ids[p[0]] = cur.lastrowid

    print("🌱 Seeding beds...")
    beds_data = [
        ('EMG-01', 'Emergency Bed', 'Emergency Triage Bay', 'Ground Floor', 1500, 'Occupied', pat_ids['MF-P-1001']),
        ('EMG-02', 'Emergency Bed', 'Emergency Triage Bay', 'Ground Floor', 1500, 'Available', None),
        ('EMG-03', 'Emergency Bed', 'Resuscitation Unit', 'Ground Floor', 1800, 'Available', None),
        ('EMG-04', 'Emergency Bed', 'Trauma Bay', 'Ground Floor', 1800, 'Maintenance', None),
        ('ICU-101', 'ICU', 'Critical Care Unit', '1st Floor', 5000, 'Occupied', pat_ids['MF-P-1002']),
        ('ICU-102', 'ICU', 'Critical Care Unit', '1st Floor', 5000, 'Available', None),
        ('ICU-103', 'ICU', 'Cardiac ICU (CICU)', '1st Floor', 5500, 'Available', None),
        ('ICU-104', 'ICU', 'Neuro ICU', '1st Floor', 5500, 'Occupied', None),
        ('HDU-201', 'HDU', 'High Dependency Unit', '2nd Floor', 3200, 'Occupied', pat_ids['MF-P-1004']),
        ('HDU-202', 'HDU', 'High Dependency Unit', '2nd Floor', 3200, 'Available', None),
        ('GW-301', 'General Ward', 'Medical Ward A', '3rd Floor', 800, 'Occupied', pat_ids['MF-P-1003']),
        ('GW-302', 'General Ward', 'Medical Ward A', '3rd Floor', 800, 'Available', None),
        ('GW-303', 'General Ward', 'Surgical Ward B', '3rd Floor', 800, 'Available', None),
        ('GW-304', 'General Ward', 'Surgical Ward B', '3rd Floor', 800, 'Cleaning', None),
        ('PVT-401', 'Private Room', 'Executive Suite Wing', '4th Floor', 4000, 'Available', None),
        ('PVT-402', 'Private Room', 'Executive Suite Wing', '4th Floor', 4000, 'Available', None),
    ]

    bed_ids = {}
    for b in beds_data:
        cur.execute(
            'INSERT INTO beds (bed_number, category, ward_department, floor, daily_charge, status, current_patient_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            b
        )
        bed_ids[b[0]] = cur.lastrowid

    print("🌱 Seeding admissions...")
    admissions_data = [
        ('ADM-2026-001', pat_ids['MF-P-1002'], bed_ids['ICU-101'], doc_ids['MF-DOC-02'], 'Emergency', 'Acute Anterior Wall Myocardial Infarction', 'Admitted'),
        ('ADM-2026-002', pat_ids['MF-P-1003'], bed_ids['GW-301'], doc_ids['MF-DOC-05'], 'General', 'Severe Exacerbation of Bronchial Asthma', 'Admitted'),
        ('ADM-2026-003', pat_ids['MF-P-1004'], bed_ids['HDU-201'], doc_ids['MF-DOC-06'], 'General', 'Fluid Overload with Uremic Symptoms', 'Admitted'),
    ]

    adm_ids = {}
    for a in admissions_data:
        cur.execute(
            'INSERT INTO admissions (admission_number, patient_id, bed_id, attending_doctor_id, admission_type, diagnosis, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            a
        )
        adm_ids[a[0]] = cur.lastrowid

    print("🌱 Seeding emergency cases...")
    now = datetime.datetime.now(datetime.timezone.utc)
    
    t_45m = (now - datetime.timedelta(minutes=45)).isoformat()
    t_40m = (now - datetime.timedelta(minutes=40)).isoformat()
    t_35m = (now - datetime.timedelta(minutes=35)).isoformat()
    t_25m = (now - datetime.timedelta(minutes=25)).isoformat()
    t_14m = (now - datetime.timedelta(minutes=14)).isoformat()
    t_5m = (now - datetime.timedelta(minutes=5)).isoformat()
    t_55m = (now - datetime.timedelta(minutes=55)).isoformat()

    emg_data = [
        ('EMG-2026-001', pat_ids['MF-P-1002'], 'Cardiac Arrest / Acute Coronary Syndrome', 'Critical', 1, 'Pain Responsive', 85, 55, 128, 28, 89, 98.4, 'Crushing substernal chest pain radiating to left jaw, diaphoresis, hypotensive, ST-elevation in V1-V4.', user_ids['nurse.sarah'], 'Sarah Thomas, RN', doc_ids['MF-DOC-02'], bed_ids['ICU-101'], 'Under Treatment', t_45m, t_40m, t_35m),
        ('EMG-2026-002', pat_ids['MF-P-1005'], 'Severe Polytrauma', 'Critical', 1, 'Voice Responsive', 90, 60, 134, 32, 91, 97.8, 'Two-wheeler collision with heavy truck. Open femur fracture right leg, suspected pelvic instability and internal hemorrhage.', user_ids['nurse.sarah'], 'Sarah Thomas, RN', None, None, 'Waiting', t_14m, None, None),
        ('EMG-2026-003', pat_ids['MF-P-1001'], 'Acute Respiratory Distress', 'High', 2, 'Alert', 145, 92, 112, 26, 92, 99.1, 'Severe bilateral wheezing, accessory muscle use, poor air entry in left lung base.', user_ids['nurse.sarah'], 'Sarah Thomas, RN', doc_ids['MF-DOC-01'], bed_ids['EMG-01'], 'Assigned', t_25m, t_5m, None),
        ('EMG-2026-004', pat_ids['MF-P-1006'], 'Severe Fracture', 'Medium', 3, 'Alert', 130, 80, 88, 18, 98, 98.6, 'Fall in bathroom. Marked deformity and swelling at right wrist, pulses intact distally.', user_ids['nurse.sarah'], 'Sarah Thomas, RN', None, None, 'Waiting', t_35m, None, None),
        ('EMG-2026-005', pat_ids['MF-P-1007'], 'Other', 'Low', 4, 'Alert', 120, 78, 76, 16, 99, 98.4, 'Glass cut on forearm. Active bleeding controlled with compression bandage. Full range of motion.', user_ids['nurse.sarah'], 'Sarah Thomas, RN', None, None, 'Waiting', t_55m, None, None),
    ]

    emg_ids = {}
    for e in emg_data:
        cur.execute(
            '''INSERT INTO emergency_cases (
                case_code, patient_id, emergency_type, triage_priority, priority_weight,
                conscious_state, systolic_bp, diastolic_bp, heart_rate, respiratory_rate, spo2, temperature,
                triage_notes, triaged_by_user_id, triaged_by_name, assigned_doctor_id, assigned_bed_id,
                status, arrived_at, assigned_at, treatment_started_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            e
        )
        emg_ids[e[0]] = cur.lastrowid

    print("🌱 Seeding emergency activity audit logs...")
    logs = [
        (emg_ids['EMG-2026-001'], 'REGISTERED', user_ids['nurse.sarah'], 'Sarah Thomas, RN', 'Patient arrived via EMS unit. Immediate triage initiated.', t_45m),
        (emg_ids['EMG-2026-001'], 'TRIAGED', user_ids['nurse.sarah'], 'Sarah Thomas, RN', 'Assigned Priority 1: Critical (Cardiac/Hemodynamic Collapse risk).', t_40m),
        (emg_ids['EMG-2026-001'], 'DOCTOR_ASSIGNED', user_ids['nurse.sarah'], 'Sarah Thomas, RN', 'Assigned Dr. Vikram Mehta (Cardiology).', t_40m),
        (emg_ids['EMG-2026-001'], 'BED_ALLOCATED', user_ids['nurse.sarah'], 'Sarah Thomas, RN', 'Bed ICU-101 allocated. Immediate transfer to CCU.', t_35m),
        (emg_ids['EMG-2026-002'], 'REGISTERED', user_ids['nurse.sarah'], 'Sarah Thomas, RN', 'Patient brought by bystander. Major road traffic incident.', t_14m),
        (emg_ids['EMG-2026-002'], 'TRIAGED', user_ids['nurse.sarah'], 'Sarah Thomas, RN', 'Assigned Priority 1: Critical. Escalated to Trauma Bay Resuscitation Team.', t_14m),
    ]

    for l in logs:
        cur.execute(
            'INSERT INTO emergency_activity_logs (emergency_case_id, action_type, performed_by_user_id, performed_by_name, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            l
        )

    print("🌱 Seeding ambulances...")
    amb_data = [
        ('KA-01-EMS-101', 'Advanced Life Support (ALS)', 'Arun Kumar', '+91 98765 00007', 'Kiran Das, EMT-P', '+91 98765 11111', 'Available', 'Hospital Bay 1', 12.9716, 77.5946, 'Main Emergency Wing'),
        ('KA-01-EMS-102', 'ICU Mobile Unit', 'Santosh Gowda', '+91 98765 22222', 'Priya Roy, EMT-P', '+91 98765 33333', 'Dispatched', 'Outer Ring Road (Near Silk Board)', 12.9172, 77.6228, 'South Satellite Station'),
        ('KA-01-EMS-103', 'Basic Life Support (BLS)', 'Manoj Yadav', '+91 98765 44444', 'Anil Joseph, EMT-B', '+91 98765 55555', 'On the Way', 'Indiranagar 100ft Road', 12.9784, 77.6408, 'East Hub'),
        ('KA-01-EMS-104', 'Advanced Life Support (ALS)', 'Ramesh Babu', '+91 98765 66666', 'Deepa Nair, EMT-P', '+91 98765 77777', 'Returning', 'Hebbal Flyover Express', 13.0358, 77.5970, 'North Satellite Station'),
        ('KA-01-EMS-105', 'Basic Life Support (BLS)', 'Govind Swamy', '+91 98765 88888', 'Sunil Kumar, EMT-B', '+91 98765 99999', 'Under Maintenance', 'Hospital Workshop Bay', 12.9716, 77.5946, 'Main Emergency Wing'),
    ]

    amb_ids = {}
    for a in amb_data:
        cur.execute(
            'INSERT INTO ambulances (vehicle_number, ambulance_type, driver_name, driver_phone, paramedic_name, paramedic_phone, status, current_location_name, current_latitude, current_longitude, base_station) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            a
        )
        amb_ids[a[0]] = cur.lastrowid

    print("🌱 Seeding ambulance assignments...")
    cur.execute(
        '''INSERT INTO ambulance_assignments (
            ambulance_id, emergency_case_id, pickup_location, pickup_latitude, pickup_longitude,
            caller_name, caller_phone, assigned_by_user_id, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (amb_ids['KA-01-EMS-102'], None, 'HSR Layout Sector 1, 14th Cross', 12.9116, 77.6389, 'Vikas Khanna', '+91 98111 55443', user_ids['admin'], 'Dispatched', 'Elderly patient with sudden collapse and breathing difficulty.')
    )

    cur.execute(
        '''INSERT INTO ambulance_assignments (
            ambulance_id, emergency_case_id, pickup_location, pickup_latitude, pickup_longitude,
            caller_name, caller_phone, assigned_by_user_id, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (amb_ids['KA-01-EMS-103'], None, 'CMH Road Metro Station Gate 2', 12.9781, 77.6395, 'Station Controller', '+91 98222 66554', user_ids['recep.rohit'], 'On the Way', 'Commuter with acute chest pain and profuse sweating.')
    )

    print("🌱 Seeding appointments...")
    today_str = datetime.date.today().isoformat()
    appointments = [
        ('APT-2026-001', pat_ids['MF-P-1003'], doc_ids['MF-DOC-05'], 'Pulmonology / Critical Care', today_str, '10:30 AM', 'Routine asthma spirometry check', 'Scheduled'),
        ('APT-2026-002', pat_ids['MF-P-1004'], doc_ids['MF-DOC-06'], 'General Medicine', today_str, '11:15 AM', 'Renal function review and BP titration', 'Confirmed'),
        ('APT-2026-003', pat_ids['MF-P-1006'], doc_ids['MF-DOC-04'], 'Neurology', today_str, '02:00 PM', 'Migraine follow-up and EEG discussion', 'Scheduled'),
        ('APT-2026-004', pat_ids['MF-P-1007'], doc_ids['MF-DOC-03'], 'Trauma Surgery', today_str, '04:30 PM', 'Wound stitch removal and inspection', 'Scheduled'),
    ]

    for apt in appointments:
        cur.execute(
            'INSERT INTO appointments (appointment_number, patient_id, doctor_id, department, appointment_date, time_slot, reason_for_visit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            apt
        )

    print("🌱 Seeding medical records...")
    records = [
        (pat_ids['MF-P-1002'], doc_ids['MF-DOC-02'], 'Emergency Encounter', 'Acute Coronary Syndrome (STEMI)', 'Crushing chest pain, ST-elevation on 12-lead ECG, elevated Troponin-I', 'Primary PCI scheduled, Dual antiplatelet therapy, Statin load, ICU hemodynamic monitoring', 'Aspirin 325mg stat, Ticagrelor 180mg stat, Atorvastatin 80mg, IV Heparin infusion', 'Patient stabilized in CCU Bed 101. Cath lab notified.'),
        (pat_ids['MF-P-1003'], doc_ids['MF-DOC-05'], 'Inpatient Round', 'Severe Acute Asthma Attack', 'Expiratory wheeze, tachypnea, reduced peak flow', 'Nebulization q20m x 3, IV Corticosteroids, Supplemental O2 via nasal prongs', 'Salbutamol + Ipratropium neb, Hydrocortisone 100mg IV q6h', 'SpO2 improved from 88% on room air to 96% on 2L O2.'),
    ]

    for r in records:
        cur.execute(
            'INSERT INTO medical_records (patient_id, doctor_id, record_type, diagnosis, symptoms, treatment_plan, prescriptions, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            r
        )

    print("🌱 Seeding billing and payments...")
    cur.execute(
        '''INSERT INTO bills (
            bill_number, patient_id, admission_id, emergency_case_id,
            consultation_fee, room_bed_charges, emergency_charges, treatment_medication_charges, other_services_charges,
            total_amount, discount_amount, net_payable, paid_amount, balance_due, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        ('INV-2026-001', pat_ids['MF-P-1002'], adm_ids['ADM-2026-001'], emg_ids['EMG-2026-001'], 2000, 5000, 3500, 8200, 1500, 20200, 1200, 19000, 10000, 9000, 'Partial')
    )
    bill1_id = cur.lastrowid

    cur.execute(
        '''INSERT INTO bills (
            bill_number, patient_id, admission_id, emergency_case_id,
            consultation_fee, room_bed_charges, emergency_charges, treatment_medication_charges, other_services_charges,
            total_amount, discount_amount, net_payable, paid_amount, balance_due, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        ('INV-2026-002', pat_ids['MF-P-1007'], None, emg_ids['EMG-2026-005'], 1000, 0, 1200, 850, 450, 3500, 0, 3500, 3500, 0, 'Paid')
    )
    bill2_id = cur.lastrowid

    cur.execute(
        'INSERT INTO payments (payment_number, bill_id, amount, payment_method, transaction_reference, received_by_user_id) VALUES (?, ?, ?, ?, ?, ?)',
        ('RCP-2026-001', bill1_id, 10000, 'UPI / Online Transfer', 'UPI-REF-99281982', user_ids['recep.rohit'])
    )
    cur.execute(
        'INSERT INTO payments (payment_number, bill_id, amount, payment_method, transaction_reference, received_by_user_id) VALUES (?, ?, ?, ?, ?, ?)',
        ('RCP-2026-002', bill2_id, 3500, 'Credit Card', 'TXN-CARD-441199', user_ids['recep.rohit'])
    )

    conn.commit()
    conn.close()
    print("✅ MediFlow Database successfully seeded with realistic clinical data!")

if __name__ == '__main__':
    seed_database()

