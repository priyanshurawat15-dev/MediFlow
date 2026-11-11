# MediFlow – Smart Hospital & Emergency Management System

MediFlow is a practical, full-stack Hospital Management System developed for a college mini-project. It combines day-to-day hospital operations with a dedicated **Emergency Priority & Response Management System**.

---

## 🌟 Central Feature: Emergency Priority Management

The core strength of MediFlow is its emergency response engine:

1. **Medical Staff Clinical Triage**: When a patient arrives in an emergency, authorized clinical staff record vital signs (BP, Pulse, Respiration, SpO2, Temp) and consciousness level (AVPU), then assign one of 4 triage categories:
   - **Priority 1: Critical** (Immediate attention required)
   - **Priority 2: High** (Serious emergency, urgent stabilization within 30 min)
   - **Priority 3: Medium** (Urgent medical attention within 60 min)
   - **Priority 4: Low** (Non-urgent)
2. **Clinical Queue Prioritization**: The emergency queue is sorted **strictly by triage priority first**, followed by waiting time within the same priority rank. A newly registered Critical case immediately leaps to the top of the queue above routine or earlier patients.
3. **Escalation Alerts**: Live tracking triggers warning alerts if waiting duration exceeds configured clinical thresholds (e.g., Critical &gt; 10 min, High &gt; 30 min, Medium &gt; 60 min).
4. **Concurrency-Protected Resource Allocation**: Staff can immediately assign available emergency physicians and allocate ICU or Emergency beds. Conflicting simultaneous bookings are prevented.
5. **Triage Reassessment & Override Auditing**: Staff can reassess priority or override assignments; all modifications require a recorded clinical reason and are stored in `emergency_activity_logs`.
6. **Automatic Bed Lifecycle**: When a case is resolved, the bed is automatically transitioned into a *Cleaning / Sanitization* turnaround state before becoming available again.

---

## 🏥 Complete Module Overview

| Module | Features & Capabilities |
| :--- | :--- |
| **A. Central Dashboard** | Real-time counts of patients, admissions, bed availability, active emergency cases (Critical/High), doctor status, available ambulances, today's appointments, and live activity streams. |
| **B. Patient Management** | Patient registration with auto-generated IDs (`MF-P-XXXX`), searchable records, personal demographics, blood group, emergency contact, past medical history, and dedicated profile view with tabs for encounters, admissions, appointments, and billing. |
| **C. Emergency Priority** | Clinical triage, priority queues, vitals capture, live waiting duration counter, escalation badges, doctor and bed assignment, reassessment, and audit timelines. |
| **D. Ambulance Fleet** | Fleet overview (ALS, BLS, Mobile ICU), driver details, dispatch workflow with pickup routing, multi-step status progression (`Dispatched` ➔ `On the Way` ➔ `Arrived` ➔ `Returning` ➔ `Available`), and simulated city telemetry map. |
| **E. Doctor Management** | Physician directory, specialty filters, shift schedules, availability status toggles (`Available`, `In Consultation`, `In Emergency`, `Off Duty`), active patient loads, and Emergency On-Call Duty roster. |
| **F. Bed Management** | Interactive visual grid of 5 categories (`Emergency Bed`, `ICU`, `HDU`, `General Ward`, `Private Room`). Occupancy status, direct bed allocation, ward-to-ward transfers, and discharge release. |
| **G. Appointment Management** | OPD appointment booking with doctor selection, date picker, time slots, and status workflow (`Scheduled`, `Confirmed`, `Completed`, `Cancelled`). Strictly segregated from the Emergency queue. |
| **H. Staff Management & RBAC** | Role-based access control for Administrators, Doctors, Triage Nurses, Receptionists, and Ambulance Staff. |
| **I. Billing & Invoicing** | Itemized bills (consultations, bed stay, emergency resuscitation, medicines, labs, discounts), payment receipts (UPI, Card, Cash, Insurance), and printable official invoice modal with `window.print()` support. |
| **J. Reports & Analytics** | Clean Recharts visualizations: Emergency cases by priority, Average emergency response time in minutes, Bed occupancy percentages by ward, and Top emergency presentations. |

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Recharts, Vite
- **Backend**: Node.js, Express.js 5, TypeScript, tsx, JWT Authentication, bcryptjs
- **Database**:
  - **Default**: Built-in SQLite (`node:sqlite` via Node.js standard library) with WAL mode, foreign keys, and indexes for zero-configuration startup.
  - **PostgreSQL**: PostgreSQL DDL schema included in `backend/src/database/schema-postgres.sql` for Postgres deployments.

---

## 🚀 Quick Start & Installation

### Prerequisites
- Node.js (v20+ recommended)
- npm

### 1. Clone & Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
npm --prefix frontend install
```

### 2. Seed Database with Realistic Clinical Data
```bash
npm run seed
```
This populates realistic demo records: 7 staff users across all roles, 7 detailed patients, 16 beds across all categories, 6 doctors with emergency schedules, 5 ambulances, emergency cases with triage vitals, and billing records.

### 3. Run Development Server
```bash
npm run dev
```
- Backend API running on: `http://localhost:5000`
- Frontend React running on: `http://localhost:3000`

### 4. Or Run Single-Port Production Build
```bash
npm run build
npm start
```
The backend serves both the API and the React frontend on `http://localhost:5000`.

---

## 🔑 Demo Accounts (Role-Based Testing)

MediFlow features a **1-Click Demo Account Switcher** right in the header of the app and on the login page:

| Role | Username | Password | Personnel Details |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Dr. Rajiv Sharma (Medical Director & Hospital Admin) |
| **Doctor** | `dr.ananya` | `doctor123` | Dr. Ananya Sen (Emergency Medicine Head) |
| **Triage Nurse** | `nurse.sarah` | `nurse123` | Sarah Thomas, RN (Senior Emergency Triage Nurse) |
| **Receptionist** | `recep.rohit` | `recep123` | Rohit Verma (Central Reception & Inpatient Billing) |
| **Ambulance Staff** | `driver.arun` | `amb123` | Arun Kumar (Rapid EMS Dispatch Driver) |

---

## 🧪 Automated Integration Tests

To run the end-to-end verification test suite covering all 18 clinical requirements:
```bash
npx tsx backend/src/test/integration.test.ts
```
Outputs:
```text
========================================
Test Results: 18 Passed, 0 Failed
========================================
```

---

## 📁 Project Structure

```text
Hospital_Manage/
├── backend/
│   ├── src/
│   │   ├── database/
│   │   │   ├── db.ts               # SQLite DatabaseSync connection & schema
│   │   │   ├── seed.ts             # Realistic clinical database seeder
│   │   │   └── schema-postgres.sql # PostgreSQL production DDL script
│   │   ├── middleware/
│   │   │   └── auth.ts             # JWT authentication & RBAC middleware
│   │   ├── routes/
│   │   │   ├── auth.routes.ts      # Login, current user, demo users
│   │   │   ├── dashboard.routes.ts # High-level operational metrics & counters
│   │   │   ├── patient.routes.ts   # CRUD patients, profile records
│   │   │   ├── emergency.routes.ts # Clinical priority triage, queue & assignments
│   │   │   ├── ambulance.routes.ts # EMS fleet, mission dispatch & simulated map
│   │   │   ├── doctor.routes.ts    # Doctor directory & emergency duty toggles
│   │   │   ├── bed.routes.ts       # Visual bed availability, transfer & discharge
│   │   │   ├── appointment.routes.ts # Outpatient consultation scheduling
│   │   │   ├── staff.routes.ts     # Personnel directory & RBAC accounts
│   │   │   ├── billing.routes.ts   # Invoices, payments, and receipts
│   │   │   └── report.routes.ts    # Recharts analytics endpoints
│   │   ├── test/
│   │   │   └── integration.test.ts # Comprehensive 18-step test suite
│   │   └── server.ts               # Express 5 server & SPA fallback
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/LoginView.tsx
│   │   │   ├── common/             # Sidebar, Header, Modal, Badges, StatCard
│   │   │   ├── emergency/          # EmergencyQueue, TriageModal, AssignResourceModal, DetailsModal
│   │   │   ├── patients/           # PatientList, ProfileModal, RegisterPatientModal
│   │   │   ├── beds/               # BedManagementView
│   │   │   ├── ambulances/         # AmbulanceView
│   │   │   ├── doctors/            # DoctorListView
│   │   │   ├── appointments/       # AppointmentListView
│   │   │   ├── billing/            # BillingView
│   │   │   ├── staff/              # StaffListView
│   │   │   ├── reports/            # ReportsView (Recharts)
│   │   │   └── dashboard/          # HospitalDashboard
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ToastContext.tsx
│   │   ├── services/api.ts
│   │   ├── types/index.ts
│   │   ├── App.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
├── package.json
└── README.md
```

---

## 📜 License
Developed for academic mini-project submission. Designed with professional hospital management UI/UX standards.

