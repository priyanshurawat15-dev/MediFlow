-- MediFlow PostgreSQL Database Schema
-- Run this script in PostgreSQL to initialize the database

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'doctor', 'receptionist', 'nurse', 'ambulance')),
  department VARCHAR(100),
  phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  patient_id VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  age INTEGER NOT NULL,
  gender VARCHAR(10) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  address TEXT,
  blood_group VARCHAR(5),
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  medical_history TEXT,
  current_status VARCHAR(30) DEFAULT 'Registered',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  doctor_code VARCHAR(20) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  full_name VARCHAR(100) NOT NULL,
  specialization VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  duty_schedule VARCHAR(100) NOT NULL,
  availability_status VARCHAR(20) DEFAULT 'Available' CHECK (availability_status IN ('Available', 'In Consultation', 'In Emergency', 'Off Duty')),
  is_emergency_duty SMALLINT DEFAULT 0,
  current_patient_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS beds (
  id SERIAL PRIMARY KEY,
  bed_number VARCHAR(20) UNIQUE NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('Emergency Bed', 'ICU', 'HDU', 'General Ward', 'Private Room')),
  ward_department VARCHAR(100) NOT NULL,
  floor VARCHAR(20) NOT NULL,
  daily_charge NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
  status VARCHAR(20) DEFAULT 'Available' CHECK (status IN ('Available', 'Occupied', 'Maintenance', 'Cleaning')),
  current_patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  current_admission_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admissions (
  id SERIAL PRIMARY KEY,
  admission_number VARCHAR(30) UNIQUE NOT NULL,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  bed_id INTEGER REFERENCES beds(id),
  attending_doctor_id INTEGER REFERENCES doctors(id),
  admission_type VARCHAR(20) DEFAULT 'General',
  admission_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  discharge_date TIMESTAMP WITH TIME ZONE,
  diagnosis TEXT,
  status VARCHAR(20) DEFAULT 'Admitted' CHECK (status IN ('Admitted', 'Transferred', 'Discharged')),
  discharge_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emergency_cases (
  id SERIAL PRIMARY KEY,
  case_code VARCHAR(30) UNIQUE NOT NULL,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  emergency_type VARCHAR(100) NOT NULL,
  triage_priority VARCHAR(20) NOT NULL CHECK (triage_priority IN ('Critical', 'High', 'Medium', 'Low')),
  priority_weight INTEGER NOT NULL, -- 1=Critical, 2=High, 3=Medium, 4=Low
  conscious_state VARCHAR(50) DEFAULT 'Alert',
  systolic_bp INTEGER,
  diastolic_bp INTEGER,
  heart_rate INTEGER,
  respiratory_rate INTEGER,
  spo2 INTEGER,
  temperature NUMERIC(4, 1),
  triage_notes TEXT,
  triaged_by_user_id INTEGER REFERENCES users(id),
  triaged_by_name VARCHAR(100),
  assigned_doctor_id INTEGER REFERENCES doctors(id),
  assigned_bed_id INTEGER REFERENCES beds(id),
  status VARCHAR(20) DEFAULT 'Waiting' CHECK (status IN ('Waiting', 'Assigned', 'Under Treatment', 'Transferred', 'Resolved')),
  override_reason TEXT,
  escalated SMALLINT DEFAULT 0,
  arrived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  assigned_at TIMESTAMP WITH TIME ZONE,
  treatment_started_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emergency_activity_logs (
  id SERIAL PRIMARY KEY,
  emergency_case_id INTEGER REFERENCES emergency_cases(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  performed_by_user_id INTEGER REFERENCES users(id),
  performed_by_name VARCHAR(100) NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ambulances (
  id SERIAL PRIMARY KEY,
  vehicle_number VARCHAR(30) UNIQUE NOT NULL,
  ambulance_type VARCHAR(50) NOT NULL,
  driver_name VARCHAR(100) NOT NULL,
  driver_phone VARCHAR(20) NOT NULL,
  paramedic_name VARCHAR(100),
  paramedic_phone VARCHAR(20),
  status VARCHAR(30) DEFAULT 'Available' CHECK (status IN ('Available', 'Dispatched', 'On the Way', 'Arrived', 'Returning', 'Under Maintenance')),
  current_location_name VARCHAR(100) DEFAULT 'Hospital Base Station',
  current_latitude NUMERIC(9, 6) DEFAULT 12.9716,
  current_longitude NUMERIC(9, 6) DEFAULT 77.5946,
  base_station VARCHAR(100) DEFAULT 'Main Emergency Bay',
  current_emergency_case_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ambulance_assignments (
  id SERIAL PRIMARY KEY,
  ambulance_id INTEGER REFERENCES ambulances(id) ON DELETE CASCADE,
  emergency_case_id INTEGER REFERENCES emergency_cases(id) ON DELETE SET NULL,
  pickup_location TEXT NOT NULL,
  pickup_latitude NUMERIC(9, 6),
  pickup_longitude NUMERIC(9, 6),
  caller_name VARCHAR(100),
  caller_phone VARCHAR(20),
  assigned_by_user_id INTEGER REFERENCES users(id),
  dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  on_the_way_at TIMESTAMP WITH TIME ZONE,
  arrived_at_scene_at TIMESTAMP WITH TIME ZONE,
  patient_handover_at TIMESTAMP WITH TIME ZONE,
  returned_to_base_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(30) DEFAULT 'Dispatched' CHECK (status IN ('Dispatched', 'On the Way', 'Arrived', 'Returning', 'Completed', 'Cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  appointment_number VARCHAR(30) UNIQUE NOT NULL,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES doctors(id),
  department VARCHAR(100) NOT NULL,
  appointment_date VARCHAR(20) NOT NULL,
  time_slot VARCHAR(20) NOT NULL,
  reason_for_visit TEXT,
  status VARCHAR(20) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Confirmed', 'Completed', 'Cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medical_records (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES doctors(id),
  record_type VARCHAR(50) NOT NULL,
  diagnosis TEXT NOT NULL,
  symptoms TEXT,
  treatment_plan TEXT,
  prescriptions TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  bill_number VARCHAR(30) UNIQUE NOT NULL,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  emergency_case_id INTEGER REFERENCES emergency_cases(id) ON DELETE SET NULL,
  consultation_fee NUMERIC(10, 2) DEFAULT 0,
  room_bed_charges NUMERIC(10, 2) DEFAULT 0,
  emergency_charges NUMERIC(10, 2) DEFAULT 0,
  treatment_medication_charges NUMERIC(10, 2) DEFAULT 0,
  other_services_charges NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) DEFAULT 0,
  discount_amount NUMERIC(10, 2) DEFAULT 0,
  net_payable NUMERIC(10, 2) DEFAULT 0,
  paid_amount NUMERIC(10, 2) DEFAULT 0,
  balance_due NUMERIC(10, 2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Partial', 'Paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_number VARCHAR(30) UNIQUE NOT NULL,
  bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  transaction_reference VARCHAR(100),
  received_by_user_id INTEGER REFERENCES users(id),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emergency_queue ON emergency_cases (status, priority_weight, arrived_at);
CREATE INDEX IF NOT EXISTS idx_beds_avail ON beds (category, status);
CREATE INDEX IF NOT EXISTS idx_doctors_avail ON doctors (availability_status, is_emergency_duty);
CREATE INDEX IF NOT EXISTS idx_patients_search ON patients (patient_id, full_name, phone);

