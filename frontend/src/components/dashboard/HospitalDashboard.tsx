import React, { useState, useEffect } from 'react';
import {
  Users,
  BedDouble,
  Stethoscope,
  Activity,
  Truck,
  Calendar,
  AlertCircle,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  Phone,
  ShieldAlert,
} from 'lucide-react';
import { StatCard } from '../common/StatCard';
import { PriorityBadge, EmergencyStatusBadge } from '../common/Badge';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { NavItemKey } from '../common/Sidebar';

interface HospitalDashboardProps {
  onNavigate: (tab: NavItemKey) => void;
  onOpenRegisterEmergency: () => void;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({
  onNavigate,
  onOpenRegisterEmergency,
}) => {
  const { error } = useToast();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDashboardData = async () => {
    try {
      const res = await api.get<any>('/dashboard/stats');
      setData(res);
    } catch (err: any) {
      error(err.message || 'Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(fetchDashboardData, 20000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading || !data) {
    return <div className="py-20 text-center text-slate-500 text-sm">Loading hospital operational metrics...</div>;
  }

  const { metrics, recentPatients, recentEmergencyActivities, criticalWaitingCases } = data;

  return (
    <div className="space-y-6">
      {/* Prominent Critical Emergency Alert Banner */}
      {criticalWaitingCases && criticalWaitingCases.length > 0 ? (
        <div className="p-4 rounded-xl border border-rose-300 bg-rose-50 text-rose-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-600 text-white shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-rose-900">
                  CRITICAL EMERGENCY ALERT: {criticalWaitingCases.length} Patient(s) in Immediate Triage
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                  PRIORITY 1
                </span>
              </div>
              <p className="text-xs text-rose-700 mt-1">
                Patients requiring immediate physician intervention and resuscitation bed allocation are waiting in queue.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {criticalWaitingCases.map((c: any) => (
                  <span
                    key={c.id}
                    className="px-2.5 py-1 rounded-md bg-white border border-rose-200 text-rose-900 font-semibold flex items-center gap-1.5"
                  >
                    <span>{c.patient_name} ({c.patient_id})</span>
                    <span className="font-normal text-rose-600">• {c.emergency_type}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('emergency')}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shrink-0 shadow-xs transition-colors cursor-pointer self-start md:self-center"
          >
            Open Emergency Queue ➔
          </button>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 text-emerald-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Emergency Department Status:</strong> No unassigned Critical Priority cases waiting at this moment.
            </span>
          </div>
          <button
            onClick={onOpenRegisterEmergency}
            className="text-xs text-emerald-800 font-semibold hover:underline cursor-pointer"
          >
            + Register Emergency Case
          </button>
        </div>
      )}

      {/* Main Operational Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Emergency Cases */}
        <StatCard
          title="Active Emergency Cases"
          value={metrics.activeEmergencies}
          subtitle={`${metrics.criticalEmergencies} Critical • ${metrics.highEmergencies} High`}
          icon={Activity}
          iconColor="text-rose-600"
          iconBg="bg-rose-50"
          badge={
            metrics.criticalEmergencies > 0
              ? { text: `${metrics.criticalEmergencies} Critical`, variant: 'critical' }
              : undefined
          }
          onClick={() => onNavigate('emergency')}
        />

        {/* Hospital Bed Availability */}
        <StatCard
          title="Available Hospital Beds"
          value={metrics.availableBeds}
          subtitle={`${metrics.occupiedBeds} occupied / ${metrics.totalBeds} total`}
          icon={BedDouble}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          badge={{ text: `${metrics.emergencyBedsAvailable} ICU/ER Free`, variant: 'success' }}
          onClick={() => onNavigate('beds')}
        />

        {/* Available Doctors */}
        <StatCard
          title="Doctors on Duty"
          value={metrics.availableDoctors}
          subtitle={`${metrics.emergencyDutyDoctors} on ER on-call duty`}
          icon={Stethoscope}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          onClick={() => onNavigate('doctors')}
        />

        {/* Ambulances */}
        <StatCard
          title="Ambulances Available"
          value={metrics.availableAmbulances}
          subtitle={`${metrics.dispatchedAmbulances} active en route`}
          icon={Truck}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          onClick={() => onNavigate('ambulances')}
        />
      </div>

      {/* Secondary Operational Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('patients')}
          className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered Patients</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900">{metrics.totalPatients}</span>
            <span className="text-xs text-slate-400">total records</span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('beds')}
          className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Currently Admitted</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900">{metrics.admittedPatients}</span>
            <span className="text-xs text-slate-400">inpatient admissions</span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('appointments')}
          className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Appointments</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900">{metrics.todayAppointments}</span>
            <span className="text-xs text-slate-400">OPD consultations</span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('emergency')}
          className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">P3 & P4 Non-Critical</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-700">
              {metrics.mediumEmergencies + metrics.lowEmergencies}
            </span>
            <span className="text-xs text-slate-400">medium / low urgency</span>
          </div>
        </div>
      </div>

      {/* Two Columns: Recent Registrations & Live Emergency Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Patient Registrations */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Recent Patient Registrations</span>
              </h3>
              <p className="text-[11px] text-slate-500">Latest patients admitted or registered in the hospital</p>
            </div>
            <button
              onClick={() => onNavigate('patients')}
              className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentPatients.map((p: any) => (
              <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{p.full_name}</span>
                    <span className="font-mono text-[10px] text-slate-500">{p.patient_id}</span>
                    {p.blood_group && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700">
                        {p.blood_group}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {p.age}y / {p.gender} • <span className="font-mono">{p.phone}</span>
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    p.current_status === 'Under Emergency'
                      ? 'bg-rose-100 text-rose-800'
                      : p.current_status === 'Admitted'
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {p.current_status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Emergency Activity Stream */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-600" />
                <span>Live Emergency Activity Stream</span>
              </h3>
              <p className="text-[11px] text-slate-500">Real-time triage, doctor assignment, and bed allocations</p>
            </div>
            <button
              onClick={() => onNavigate('emergency')}
              className="text-xs text-rose-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Emergency Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentEmergencyActivities.map((act: any) => (
              <div key={act.id} className="p-3.5 flex items-start gap-3 hover:bg-slate-50/60 transition-colors text-xs">
                <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold text-slate-900">{act.action_type.replace('_', ' ')}</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5 truncate">{act.details}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Case: <strong className="text-slate-600">{act.case_code}</strong> ({act.patient_name}) • By: {act.performed_by_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

