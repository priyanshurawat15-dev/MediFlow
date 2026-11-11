import React, { useState, useEffect } from 'react';
import {
  User,
  Heart,
  Phone,
  Mail,
  MapPin,
  Shield,
  Activity,
  BedDouble,
  Calendar,
  Receipt,
  FileText,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { PriorityBadge, EmergencyStatusBadge, BedStatusBadge } from '../common/Badge';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Patient, MedicalRecord, Admission, EmergencyCase, Appointment, Bill } from '../../types';

interface PatientProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number | null;
  onEditPatient: (p: Patient) => void;
}

export const PatientProfileModal: React.FC<PatientProfileModalProps> = ({
  isOpen,
  onClose,
  patientId,
  onEditPatient,
}) => {
  const { error } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'emergency' | 'admissions' | 'appointments' | 'billing'>('overview');
  const [data, setData] = useState<{
    patient: Patient;
    medicalRecords: MedicalRecord[];
    admissions: Admission[];
    emergencyCases: EmergencyCase[];
    appointments: Appointment[];
    bills: Bill[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && patientId) {
      setIsLoading(true);
      setActiveTab('overview');
      api.get<any>(`/patients/${patientId}`)
        .then((res) => setData(res))
        .catch((err) => error(err.message || 'Failed to load patient profile'))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, patientId, error]);

  if (!isOpen) return null;

  const p = data?.patient;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={p ? `Patient Profile: ${p.full_name}` : 'Patient Profile'}
      subtitle={p ? `ID: ${p.patient_id} • Registered on ${new Date(p.created_at).toLocaleDateString()}` : undefined}
      maxWidth="4xl"
    >
      {isLoading || !p ? (
        <div className="py-16 text-center text-slate-500 text-sm">Loading complete patient medical record...</div>
      ) : (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shrink-0 uppercase shadow-sm">
                {p.full_name.substring(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{p.full_name}</h3>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold">
                    {p.patient_id}
                  </span>
                  {p.blood_group && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      {p.blood_group}
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      p.current_status === 'Under Emergency'
                        ? 'bg-rose-600 text-white animate-pulse'
                        : p.current_status === 'Admitted'
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {p.current_status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2 text-xs text-slate-600">
                  <span>{p.age} years old</span>
                  <span>•</span>
                  <span>{p.gender}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {p.phone}
                  </span>
                  {p.email && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {p.email}
                      </span>
                    </>
                  )}
                </div>
                {p.address && (
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    {p.address}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onEditPatient(p);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer self-start md:self-center"
            >
              Edit Details
            </button>
          </div>

          {/* Profile Navigation Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-medium space-x-6">
            {[
              { key: 'overview', label: 'Overview & Medical History', icon: FileText },
              { key: 'emergency', label: `Emergency Cases (${data?.emergencyCases?.length || 0})`, icon: Activity },
              { key: 'admissions', label: `Admissions (${data?.admissions?.length || 0})`, icon: BedDouble },
              { key: 'appointments', label: `Appointments (${data?.appointments?.length || 0})`, icon: Calendar },
              { key: 'billing', label: `Invoices (${data?.bills?.length || 0})`, icon: Receipt },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`pb-3 flex items-center gap-2 border-b-2 font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="min-h-[220px]">
            {/* Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Medical History */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Recorded Chronic Conditions & Allergies
                    </h4>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {p.medical_history || 'No prior chronic conditions, surgeries, or known drug allergies recorded.'}
                    </p>
                  </div>

                  {/* Emergency Contact */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Emergency Contact Person
                    </h4>
                    <div className="text-xs space-y-1.5">
                      <p className="text-slate-900 font-semibold">{p.emergency_contact_name || 'Not provided'}</p>
                      <p className="font-mono text-slate-600">{p.emergency_contact_phone || 'No phone recorded'}</p>
                    </div>
                  </div>
                </div>

                {/* Clinical Notes / Consultation Records */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                    Consultation & Encounter Notes
                  </h4>
                  {data?.medicalRecords?.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No physician clinical notes recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {data?.medicalRecords?.map((rec) => (
                        <div key={rec.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-900">{rec.record_type}</span>
                            <span className="text-slate-400 font-mono text-[11px]">
                              {new Date(rec.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="font-semibold text-indigo-900">Diagnosis: {rec.diagnosis}</p>
                          {rec.treatment_plan && <p className="text-slate-600 mt-1">Plan: {rec.treatment_plan}</p>}
                          {rec.prescriptions && <p className="text-slate-600 mt-1">Rx: {rec.prescriptions}</p>}
                          {rec.doctor_name && (
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">Attending: Dr. {rec.doctor_name}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Emergency Cases */}
            {activeTab === 'emergency' && (
              <div className="space-y-3">
                {data?.emergencyCases?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-8 text-center">No past emergency cases recorded for this patient.</p>
                ) : (
                  data?.emergencyCases?.map((c) => (
                    <div key={c.id} className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <PriorityBadge priority={c.triage_priority} />
                          <span className="font-mono font-bold text-slate-900">{c.case_code}</span>
                          <EmergencyStatusBadge status={c.status} />
                        </div>
                        <p className="font-semibold text-slate-800">{c.emergency_type}</p>
                        <p className="text-slate-500 text-[11px]">
                          Arrived: {new Date(c.arrived_at).toLocaleString()} • Attending: Dr. {c.doctor_name || 'Unassigned'}
                        </p>
                      </div>
                      <div className="text-right font-mono text-slate-600">
                        {c.bed_number ? `Bed: ${c.bed_number}` : 'No bed'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Inpatient Admissions */}
            {activeTab === 'admissions' && (
              <div className="space-y-3">
                {data?.admissions?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-8 text-center">No inpatient admissions recorded for this patient.</p>
                ) : (
                  data?.admissions?.map((adm) => (
                    <div key={adm.id} className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{adm.admission_number}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                            {adm.admission_type}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {adm.status}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800 mt-1">{adm.diagnosis || 'Clinical Inpatient Admission'}</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Admitted: {new Date(adm.admission_date).toLocaleDateString()}
                          {adm.discharge_date ? ` • Discharged: ${new Date(adm.discharge_date).toLocaleDateString()}` : ' • Currently Inpatient'}
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <span className="font-bold text-slate-900">{adm.bed_number}</span>
                        <p className="text-slate-400 text-[11px]">{adm.ward_department}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Appointments */}
            {activeTab === 'appointments' && (
              <div className="space-y-3">
                {data?.appointments?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-8 text-center">No outpatient appointments on record.</p>
                ) : (
                  data?.appointments?.map((apt) => (
                    <div key={apt.id} className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{apt.appointment_number}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {apt.status}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800 mt-1">
                          Dr. {apt.doctor_name} ({apt.department})
                        </p>
                        {apt.reason_for_visit && <p className="text-slate-500 text-[11px]">{apt.reason_for_visit}</p>}
                      </div>
                      <div className="text-right text-xs font-mono">
                        <span className="font-bold text-slate-800">{apt.appointment_date}</span>
                        <p className="text-slate-500">{apt.time_slot}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Billing */}
            {activeTab === 'billing' && (
              <div className="space-y-3">
                {data?.bills?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-8 text-center">No invoices generated for this patient.</p>
                ) : (
                  data?.bills?.map((bill) => (
                    <div key={bill.id} className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{bill.bill_number}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              bill.payment_status === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : bill.payment_status === 'Partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {bill.payment_status}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-1">
                          Date: {new Date(bill.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <span className="text-slate-500 block">Total: ₹{bill.net_payable.toLocaleString()}</span>
                        <span className="font-bold text-emerald-700 block">Paid: ₹{bill.paid_amount.toLocaleString()}</span>
                        {bill.balance_due > 0 && (
                          <span className="font-bold text-rose-700 block">Due: ₹{bill.balance_due.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

