import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LoginView } from './components/auth/LoginView';
import { Sidebar, NavItemKey } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { HospitalDashboard } from './components/dashboard/HospitalDashboard';
import { EmergencyQueue } from './components/emergency/EmergencyQueue';
import { RegisterEmergencyModal } from './components/emergency/RegisterEmergencyModal';
import { PatientList } from './components/patients/PatientList';
import { BedManagementView } from './components/beds/BedManagementView';
import { AmbulanceView } from './components/ambulances/AmbulanceView';
import { DoctorListView } from './components/doctors/DoctorListView';
import { AppointmentListView } from './components/appointments/AppointmentListView';
import { BillingView } from './components/billing/BillingView';
import { StaffListView } from './components/staff/StaffListView';
import { ReportsView } from './components/reports/ReportsView';
import { api } from './services/api';

const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavItemKey>('overview');
  const [activeEmergenciesCount, setActiveEmergenciesCount] = useState<number>(0);
  const [criticalCasesCount, setCriticalCasesCount] = useState<number>(0);
  const [isRegisterEmergencyOpen, setIsRegisterEmergencyOpen] = useState<boolean>(false);

  // Poll emergency count for notification badge in sidebar & header
  const refreshEmergencyCounters = async () => {
    try {
      const res = await api.get<{ cases: any[] }>('/emergency/cases');
      const active = res.cases?.filter((c) => c.status !== 'Resolved') || [];
      const critical = active.filter((c) => c.triage_priority === 'Critical' && c.status === 'Waiting');
      setActiveEmergenciesCount(active.length);
      setCriticalCasesCount(critical.length);
    } catch (err) {
      // silently ignore counter polling error
    }
  };

  useEffect(() => {
    if (user) {
      refreshEmergencyCounters();
      const interval = setInterval(refreshEmergencyCounters, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-semibold tracking-wide">Starting MediFlow Clinical System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const titles: Record<NavItemKey, { title: string; subtitle: string }> = {
    overview: {
      title: 'Central Hospital Dashboard',
      subtitle: 'Hospital Administration & Real-Time Operational Overview',
    },
    emergency: {
      title: 'Emergency Priority & Response Management System',
      subtitle: 'Clinical Priority Queue, Vitals Triage, and Instant Bed/Doctor Allocation',
    },
    patients: {
      title: 'Patient Management System',
      subtitle: 'Electronic Health Records, Medical History & Admissions History',
    },
    beds: {
      title: 'Visual Bed Availability & Allocation Management',
      subtitle: 'Emergency, ICU, HDU, General Ward & Private Room Real-Time Grid',
    },
    ambulances: {
      title: 'Rapid EMS & Ambulance Dispatch Management',
      subtitle: 'Vehicle Availability, Mission Routing & Simulated Location Telemetry',
    },
    doctors: {
      title: 'Physician & Medical Staff Directory',
      subtitle: 'Doctor Specialties, Availability Status, and Emergency Duty Roster',
    },
    appointments: {
      title: 'Outpatient Appointments Roster',
      subtitle: 'Doctor Consultation Scheduling (Segregated from Emergency Queue)',
    },
    billing: {
      title: 'Hospital Billing & Invoicing Accounts',
      subtitle: 'Patient Charges, Receipts, and Printable Medical Invoices',
    },
    staff: {
      title: 'Hospital Personnel Roster & RBAC',
      subtitle: 'Role-Based Access Control & User Account Permissions',
    },
    reports: {
      title: 'Hospital Operational Analytics & Reports',
      subtitle: 'Emergency Response Metrics, Bed Occupancy & Fleet Utilization',
    },
  };

  const currentHeaderInfo = titles[currentTab] || {
    title: 'MediFlow Hospital Management',
    subtitle: 'Operational Clinical Platform',
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        activeEmergenciesCount={activeEmergenciesCount}
      />

      {/* Main App Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={currentHeaderInfo.title}
          subtitle={currentHeaderInfo.subtitle}
          criticalCasesCount={criticalCasesCount}
          onOpenRegisterEmergency={() => setIsRegisterEmergencyOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'overview' && (
              <HospitalDashboard
                onNavigate={setCurrentTab}
                onOpenRegisterEmergency={() => setIsRegisterEmergencyOpen(true)}
              />
            )}
            {currentTab === 'emergency' && <EmergencyQueue />}
            {currentTab === 'patients' && <PatientList />}
            {currentTab === 'beds' && <BedManagementView />}
            {currentTab === 'ambulances' && <AmbulanceView />}
            {currentTab === 'doctors' && <DoctorListView />}
            {currentTab === 'appointments' && <AppointmentListView />}
            {currentTab === 'billing' && <BillingView />}
            {currentTab === 'staff' && <StaffListView />}
            {currentTab === 'reports' && <ReportsView />}
          </div>
        </main>
      </div>

      {/* Global Register Emergency Modal */}
      <RegisterEmergencyModal
        isOpen={isRegisterEmergencyOpen}
        onClose={() => setIsRegisterEmergencyOpen(false)}
        onSuccess={() => {
          refreshEmergencyCounters();
          setCurrentTab('emergency');
        }}
      />
    </div>
  );
};

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
