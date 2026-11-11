import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = path.resolve(process.cwd(), 'mediflow.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode for reliability
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'receptionist', 'nurse', 'ambulance')),
      department TEXT,
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      blood_group TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      medical_history TEXT,
      current_status TEXT DEFAULT 'Registered',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_code TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      full_name TEXT NOT NULL,
      specialization TEXT NOT NULL,
      department TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      duty_schedule TEXT NOT NULL,
      availability_status TEXT DEFAULT 'Available' CHECK (availability_status IN ('Available', 'In Consultation', 'In Emergency', 'Off Duty')),
      is_emergency_duty INTEGER DEFAULT 0,
      current_patient_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS beds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bed_number TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('Emergency Bed', 'ICU', 'HDU', 'General Ward', 'Private Room')),
      ward_department TEXT NOT NULL,
      floor TEXT NOT NULL,
      daily_charge REAL NOT NULL DEFAULT 500,
      status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Occupied', 'Maintenance', 'Cleaning')),
      current_patient_id INTEGER,
      current_admission_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (current_patient_id) REFERENCES patients(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS admissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admission_number TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      bed_id INTEGER NOT NULL,
      attending_doctor_id INTEGER,
      admission_type TEXT DEFAULT 'General',
      admission_date TEXT DEFAULT (datetime('now')),
      discharge_date TEXT,
      diagnosis TEXT,
      status TEXT DEFAULT 'Admitted' CHECK (status IN ('Admitted', 'Transferred', 'Discharged')),
      discharge_summary TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (bed_id) REFERENCES beds(id),
      FOREIGN KEY (attending_doctor_id) REFERENCES doctors(id)
    );

    CREATE TABLE IF NOT EXISTS emergency_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_code TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      emergency_type TEXT NOT NULL,
      triage_priority TEXT NOT NULL CHECK (triage_priority IN ('Critical', 'High', 'Medium', 'Low')),
      priority_weight INTEGER NOT NULL, -- 1=Critical, 2=High, 3=Medium, 4=Low
      conscious_state TEXT DEFAULT 'Alert',
      systolic_bp INTEGER,
      diastolic_bp INTEGER,
      heart_rate INTEGER,
      respiratory_rate INTEGER,
      spo2 INTEGER,
      temperature REAL,
      triage_notes TEXT,
      triaged_by_user_id INTEGER,
      triaged_by_name TEXT,
      assigned_doctor_id INTEGER,
      assigned_bed_id INTEGER,
      status TEXT DEFAULT 'Waiting' CHECK (status IN ('Waiting', 'Assigned', 'Under Treatment', 'Transferred', 'Resolved')),
      override_reason TEXT,
      escalated INTEGER DEFAULT 0,
      arrived_at TEXT DEFAULT (datetime('now')),
      assigned_at TEXT,
      treatment_started_at TEXT,
      resolved_at TEXT,
      resolution_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (triaged_by_user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_doctor_id) REFERENCES doctors(id),
      FOREIGN KEY (assigned_bed_id) REFERENCES beds(id)
    );

    CREATE TABLE IF NOT EXISTS emergency_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emergency_case_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      performed_by_user_id INTEGER,
      performed_by_name TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (emergency_case_id) REFERENCES emergency_cases(id) ON DELETE CASCADE,
      FOREIGN KEY (performed_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ambulances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_number TEXT UNIQUE NOT NULL,
      ambulance_type TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      driver_phone TEXT NOT NULL,
      paramedic_name TEXT,
      paramedic_phone TEXT,
      status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Dispatched', 'On the Way', 'Arrived', 'Returning', 'Under Maintenance')),
      current_location_name TEXT DEFAULT 'Hospital Base Station',
      current_latitude REAL DEFAULT 12.9716,
      current_longitude REAL DEFAULT 77.5946,
      base_station TEXT DEFAULT 'Main Emergency Bay',
      current_emergency_case_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ambulance_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ambulance_id INTEGER NOT NULL,
      emergency_case_id INTEGER,
      pickup_location TEXT NOT NULL,
      pickup_latitude REAL,
      pickup_longitude REAL,
      caller_name TEXT,
      caller_phone TEXT,
      assigned_by_user_id INTEGER,
      dispatched_at TEXT DEFAULT (datetime('now')),
      on_the_way_at TEXT,
      arrived_at_scene_at TEXT,
      patient_handover_at TEXT,
      returned_to_base_at TEXT,
      status TEXT DEFAULT 'Dispatched' CHECK (status IN ('Dispatched', 'On the Way', 'Arrived', 'Returning', 'Completed', 'Cancelled')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (ambulance_id) REFERENCES ambulances(id) ON DELETE CASCADE,
      FOREIGN KEY (emergency_case_id) REFERENCES emergency_cases(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_number TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      department TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      reason_for_visit TEXT,
      status TEXT DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Confirmed', 'Completed', 'Cancelled')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    CREATE TABLE IF NOT EXISTS medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER,
      record_type TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      symptoms TEXT,
      treatment_plan TEXT,
      prescriptions TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      admission_id INTEGER,
      emergency_case_id INTEGER,
      consultation_fee REAL DEFAULT 0,
      room_bed_charges REAL DEFAULT 0,
      emergency_charges REAL DEFAULT 0,
      treatment_medication_charges REAL DEFAULT 0,
      other_services_charges REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      net_payable REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Partial', 'Paid')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE SET NULL,
      FOREIGN KEY (emergency_case_id) REFERENCES emergency_cases(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_number TEXT UNIQUE NOT NULL,
      bill_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      transaction_reference TEXT,
      received_by_user_id INTEGER,
      payment_date TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (received_by_user_id) REFERENCES users(id)
    );

    -- Indices for quick querying and queue prioritization
    CREATE INDEX IF NOT EXISTS idx_emergency_queue ON emergency_cases (status, priority_weight, arrived_at);
    CREATE INDEX IF NOT EXISTS idx_beds_availability ON beds (category, status);
    CREATE INDEX IF NOT EXISTS idx_doctors_avail ON doctors (availability_status, is_emergency_duty);
    CREATE INDEX IF NOT EXISTS idx_patients_search ON patients (patient_id, full_name, phone);
  `);
}

export default db;

