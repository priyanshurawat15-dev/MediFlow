export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'nurse' | 'ambulance';

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  department?: string;
  phone?: string;
  doctorProfile?: Doctor | null;
}

export type TriagePriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type EmergencyCaseStatus = 'Waiting' | 'Assigned' | 'Under Treatment' | 'Transferred' | 'Resolved';

export interface EmergencyCase {
  id: number;
  case_code: string;
  patient_id: number;
  emergency_type: string;
  triage_priority: TriagePriority;
  priority_weight: number;
  conscious_state: string;
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  spo2?: number;
  temperature?: number;
  triage_notes?: string;
  triaged_by_user_id?: number;
  triaged_by_name?: string;
  assigned_doctor_id?: number;
  assigned_bed_id?: number;
  status: EmergencyCaseStatus;
  override_reason?: string;
  escalated?: number;
  arrived_at: string;
  assigned_at?: string;
  treatment_started_at?: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;

  // Joined fields
  patient_name: string;
  patient_code: string;
  age: number;
  gender: string;
  blood_group?: string;
  patient_phone: string;
  doctor_name?: string;
  doctor_specialization?: string;
  bed_number?: string;
  bed_category?: string;
  bed_ward?: string;
  linked_ambulance?: string;

  // Computed fields
  waiting_minutes: number;
  is_escalated: boolean;
  escalation_threshold_minutes: number;
  elapsed_treatment_minutes: number;
}

export interface EmergencyActivityLog {
  id: number;
  emergency_case_id: number;
  action_type: string;
  performed_by_user_id?: number;
  performed_by_name: string;
  details: string;
  created_at: string;
}

export interface Patient {
  id: number;
  patient_id: string;
  full_name: string;
  age: number;
  gender: string;
  phone: string;
  email?: string;
  address?: string;
  blood_group?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  medical_history?: string;
  current_status: 'Registered' | 'Admitted' | 'Under Emergency' | 'Discharged';
  created_at: string;
  updated_at: string;
  emergency_count?: number;
  admission_count?: number;
}

export type BedCategory = 'Emergency Bed' | 'ICU' | 'HDU' | 'General Ward' | 'Private Room';
export type BedStatus = 'Available' | 'Occupied' | 'Maintenance' | 'Cleaning';

export interface Bed {
  id: number;
  bed_number: string;
  category: BedCategory;
  ward_department: string;
  floor: string;
  daily_charge: number;
  status: BedStatus;
  current_patient_id?: number;
  current_admission_id?: number;
  patient_name?: string;
  patient_code?: string;
  patient_age?: number;
  patient_gender?: string;
  admission_diagnosis?: string;
  linked_emergency_case?: string;
}

export interface Doctor {
  id: number;
  doctor_code: string;
  user_id?: number;
  full_name: string;
  specialization: string;
  department: string;
  phone: string;
  email: string;
  duty_schedule: string;
  availability_status: 'Available' | 'In Consultation' | 'In Emergency' | 'Off Duty';
  is_emergency_duty: number;
  current_patient_count: number;
}

export type AmbulanceStatus = 'Available' | 'Dispatched' | 'On the Way' | 'Arrived' | 'Returning' | 'Under Maintenance';

export interface Ambulance {
  id: number;
  vehicle_number: string;
  ambulance_type: string;
  driver_name: string;
  driver_phone: string;
  paramedic_name?: string;
  paramedic_phone?: string;
  status: AmbulanceStatus;
  current_location_name: string;
  current_latitude: number;
  current_longitude: number;
  base_station: string;
  current_emergency_case_id?: number;
  active_destination?: string;
  active_caller?: string;
  active_phone?: string;
  active_assignment_id?: number;
}

export interface Appointment {
  id: number;
  appointment_number: string;
  patient_id: number;
  doctor_id: number;
  department: string;
  appointment_date: string;
  time_slot: string;
  reason_for_visit?: string;
  status: 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled';
  notes?: string;
  created_at: string;
  patient_name: string;
  patient_code: string;
  patient_phone: string;
  doctor_name: string;
  doctor_specialization: string;
}

export interface Bill {
  id: number;
  bill_number: string;
  patient_id: number;
  admission_id?: number;
  emergency_case_id?: number;
  consultation_fee: number;
  room_bed_charges: number;
  emergency_charges: number;
  treatment_medication_charges: number;
  other_services_charges: number;
  total_amount: number;
  discount_amount: number;
  net_payable: number;
  paid_amount: number;
  balance_due: number;
  payment_status: 'Pending' | 'Partial' | 'Paid';
  created_at: string;
  patient_name: string;
  patient_code: string;
  patient_phone: string;
  emergency_case_code?: string;
  admission_number?: string;
}

export interface Payment {
  id: number;
  payment_number: string;
  bill_id: number;
  amount: number;
  payment_method: string;
  transaction_reference?: string;
  received_by_name?: string;
  payment_date: string;
}

export interface MedicalRecord {
  id: number;
  patient_id: number;
  doctor_id?: number;
  record_type: string;
  diagnosis: string;
  symptoms?: string;
  treatment_plan?: string;
  prescriptions?: string;
  notes?: string;
  created_at: string;
  doctor_name?: string;
  specialization?: string;
}

export interface Admission {
  id: number;
  admission_number: string;
  patient_id: number;
  bed_id: number;
  attending_doctor_id?: number;
  admission_type: string;
  admission_date: string;
  discharge_date?: string;
  diagnosis?: string;
  status: 'Admitted' | 'Transferred' | 'Discharged';
  discharge_summary?: string;
  bed_number?: string;
  bed_category?: string;
  ward_department?: string;
  doctor_name?: string;
}

