import React, { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, Phone, Activity, BedDouble, ChevronRight, Edit3, User } from 'lucide-react';
import { RegisterPatientModal } from './RegisterPatientModal';
import { PatientProfileModal } from './PatientProfileModal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Patient } from '../../types';

export const PatientList: React.FC = () => {
  const { error } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);
  const [profilePatientId, setProfilePatientId] = useState<number | null>(null);

  const fetchPatients = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'All') params.append('status', statusFilter);

      const res = await api.get<{ patients: Patient[] }>(`/patients?${params.toString()}`);
      setPatients(res.patients || []);
    } catch (err: any) {
      error(err.message || 'Failed to fetch patients list');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, error]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, patient ID (MF-P-XXXX), or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Registered">Registered</option>
              <option value="Admitted">Admitted</option>
              <option value="Under Emergency">Under Emergency</option>
              <option value="Discharged">Discharged</option>
            </select>
          </div>

          <button
            onClick={() => {
              setPatientToEdit(null);
              setIsRegisterOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Patient</span>
          </button>
        </div>
      </div>

      {/* Patient Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Patient Directory</h3>
            <p className="text-[11px] text-slate-500">
              Master clinical and administrative patient registry with medical records
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">{patients.length} patient(s) found</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading patient records...</div>
        ) : patients.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">No patients found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Patient ID</th>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Age / Gender</th>
                  <th className="px-4 py-3">Blood</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">History / Encounters</th>
                  <th className="px-4 py-3">Current Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-indigo-700">{p.patient_id}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-slate-900 text-xs">{p.full_name}</span>
                      {p.emergency_contact_name && (
                        <p className="text-[10px] text-slate-400 mt-0.5">Emg: {p.emergency_contact_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {p.age} yrs • {p.gender}
                    </td>
                    <td className="px-4 py-3.5">
                      {p.blood_group ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {p.blood_group}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600">{p.phone}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        {p.emergency_count !== undefined && p.emergency_count > 0 && (
                          <span className="flex items-center gap-1 font-semibold text-rose-600">
                            <Activity className="w-3 h-3" />
                            {p.emergency_count} ER
                          </span>
                        )}
                        {p.admission_count !== undefined && p.admission_count > 0 && (
                          <span className="flex items-center gap-1 font-semibold text-indigo-600">
                            <BedDouble className="w-3 h-3" />
                            {p.admission_count} Inpatient
                          </span>
                        )}
                        {(!p.emergency_count && !p.admission_count) && (
                          <span className="text-slate-400">Outpatient</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          p.current_status === 'Under Emergency'
                            ? 'bg-rose-100 text-rose-800 animate-pulse'
                            : p.current_status === 'Admitted'
                            ? 'bg-indigo-100 text-indigo-800'
                            : p.current_status === 'Discharged'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.current_status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setProfilePatientId(p.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                          View Profile
                        </button>
                        <button
                          onClick={() => {
                            setPatientToEdit(p);
                            setIsRegisterOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title="Edit patient"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <RegisterPatientModal
        isOpen={isRegisterOpen}
        onClose={() => {
          setIsRegisterOpen(false);
          setPatientToEdit(null);
        }}
        patientToEdit={patientToEdit}
        onSuccess={fetchPatients}
      />

      <PatientProfileModal
        isOpen={!!profilePatientId}
        onClose={() => setProfilePatientId(null)}
        patientId={profilePatientId}
        onEditPatient={(p) => {
          setPatientToEdit(p);
          setIsRegisterOpen(true);
        }}
      />
    </div>
  );
};

