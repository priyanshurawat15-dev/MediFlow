import React, { useState, useEffect } from 'react';
import { AlertCircle, UserPlus, Heart, Stethoscope, BedDouble } from 'lucide-react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Patient, Doctor, Bed, TriagePriority } from '../../types';

interface RegisterEmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EMERGENCY_TYPES = [
  'Cardiac Arrest / STEMI',
  'Severe Polytrauma',
  'Acute Respiratory Distress',
  'Acute Stroke / Neuro Deficit',
  'Severe Sepsis / Septic Shock',
  'Major Burn Injury',
  'Poisoning / Overdose',
  'Severe Open Fracture',
  'Anaphylaxis / Severe Allergy',
  'High Fever with Convulsions',
  'Other Acute Emergency',
];

const CONSCIOUS_STATES = [
  'Alert',
  'Voice Responsive',
  'Pain Responsive',
  'Unresponsive',
];

export const RegisterEmergencyModal: React.FC<RegisterEmergencyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { success, error } = useToast();

  const [isNewPatient, setIsNewPatient] = useState<boolean>(true);
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  // New patient inline fields
  const [newPatient, setNewPatient] = useState({
    full_name: '',
    age: '',
    gender: 'Male',
    phone: '',
    blood_group: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_history: '',
  });

  // Emergency clinical fields
  const [emergencyType, setEmergencyType] = useState<string>('Cardiac Arrest / STEMI');
  const [triagePriority, setTriagePriority] = useState<TriagePriority>('Critical');
  const [consciousState, setConsciousState] = useState<string>('Alert');

  // Vitals
  const [systolicBp, setSystolicBp] = useState<string>('');
  const [diastolicBp, setDiastolicBp] = useState<string>('');
  const [heartRate, setHeartRate] = useState<string>('');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('');
  const [spo2, setSpo2] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [triageNotes, setTriageNotes] = useState<string>('');

  // Resources
  const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);
  const [availableBeds, setAvailableBeds] = useState<Bed[]>([]);
  const [assignedDoctorId, setAssignedDoctorId] = useState<string>('');
  const [assignedBedId, setAssignedBedId] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Fetch available resources
      api.get<{ doctors: Doctor[]; beds: Bed[] }>('/emergency/resources')
        .then((res) => {
          setAvailableDoctors(res.doctors || []);
          setAvailableBeds(res.beds || []);
        })
        .catch(() => {});

      // Fetch patients for search
      api.get<{ patients: Patient[] }>('/patients')
        .then((res) => setPatients(res.patients || []))
        .catch(() => {});
    }
  }, [isOpen]);

  const filteredPatients = patients.filter((p) =>
    patientSearch.trim() === ''
      ? true
      : p.full_name.toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.patient_id.toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.phone.includes(patientSearch)
  ).slice(0, 5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewPatient && !selectedPatientId) {
      error('Please select an existing patient or switch to register a new emergency patient.');
      return;
    }
    if (isNewPatient && (!newPatient.full_name.trim() || !newPatient.age || !newPatient.gender)) {
      error('Patient full name, age, and gender are required for emergency registration.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/emergency/cases', {
        patient_id: isNewPatient ? null : selectedPatientId,
        new_patient: isNewPatient ? newPatient : null,
        emergency_type: emergencyType,
        triage_priority: triagePriority,
        conscious_state: consciousState,
        systolic_bp: systolicBp || null,
        diastolic_bp: diastolicBp || null,
        heart_rate: heartRate || null,
        respiratory_rate: respiratoryRate || null,
        spo2: spo2 || null,
        temperature: temperature || null,
        triage_notes: triageNotes || null,
        assigned_doctor_id: assignedDoctorId ? parseInt(assignedDoctorId, 10) : null,
        assigned_bed_id: assignedBedId ? parseInt(assignedBedId, 10) : null,
      });

      success(`Emergency case registered with priority ${triagePriority.toUpperCase()}. Placed in queue.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to register emergency case');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register Emergency Case & Clinical Triage"
      subtitle="Priority Queue Placement & Bed Allocation Workflow"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Triage Priority Selector - PROMINENT AT TOP */}
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Clinical Triage Category (Assigned by Medical Staff) *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { level: 'Critical', label: '1 - Critical', desc: 'Immediate resuscitation', color: 'border-rose-500 bg-rose-600 text-white' },
              { level: 'High', label: '2 - High', desc: 'Serious emergency (<30m)', color: 'border-amber-500 bg-amber-600 text-white' },
              { level: 'Medium', label: '3 - Medium', desc: 'Urgent care (<60m)', color: 'border-yellow-500 bg-yellow-600 text-white' },
              { level: 'Low', label: '4 - Low', desc: 'Non-urgent attention', color: 'border-emerald-500 bg-emerald-600 text-white' },
            ].map((p) => {
              const isSelected = triagePriority === p.level;
              return (
                <button
                  type="button"
                  key={p.level}
                  onClick={() => setTriagePriority(p.level as TriagePriority)}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    isSelected
                      ? `${p.color} shadow-sm font-semibold`
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold">{p.label}</p>
                  <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>
                    {p.desc}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            Triage category is evaluated by authorized medical staff. Sorting order is strictly based on clinical priority first, followed by arrival time.
          </p>
        </div>

        {/* Patient Selection Tabs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Patient Details</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsNewPatient(true)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  isNewPatient ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                New Emergency Arrival
              </button>
              <button
                type="button"
                onClick={() => setIsNewPatient(false)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  !isNewPatient ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Existing Patient Lookup
              </button>
            </div>
          </div>

          {isNewPatient ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={newPatient.full_name}
                  onChange={(e) => setNewPatient({ ...newPatient, full_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Age *</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="125"
                  placeholder="Age in years"
                  value={newPatient.age}
                  onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Gender *</label>
                <select
                  value={newPatient.gender}
                  onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98765..."
                  value={newPatient.phone}
                  onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Blood Group</label>
                <select
                  value={newPatient.blood_group}
                  onChange={(e) => setNewPatient({ ...newPatient, blood_group: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                >
                  <option value="">Unknown</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search registered patient by name, ID or phone..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {filteredPatients.map((p) => {
                  const isSelected = selectedPatientId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPatientId(p.id)}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 font-semibold text-indigo-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <span className="font-bold">{p.full_name}</span> ({p.patient_id})
                        <span className="text-slate-500 ml-2">{p.age}y / {p.gender} / {p.blood_group || 'Unknown'}</span>
                      </div>
                      <span className="text-slate-500 font-mono">{p.phone}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Emergency Type & Clinical Vitals */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Clinical Presentation & Vitals</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Emergency Category *</label>
              <select
                value={emergencyType}
                onChange={(e) => setEmergencyType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              >
                {EMERGENCY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Conscious State (AVPU)</label>
              <select
                value={consciousState}
                onChange={(e) => setConsciousState(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              >
                {CONSCIOUS_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vitals Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Systolic BP</label>
              <input
                type="number"
                placeholder="mmHg"
                value={systolicBp}
                onChange={(e) => setSystolicBp(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Diastolic BP</label>
              <input
                type="number"
                placeholder="mmHg"
                value={diastolicBp}
                onChange={(e) => setDiastolicBp(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Heart Rate</label>
              <input
                type="number"
                placeholder="bpm"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Resp Rate</label>
              <input
                type="number"
                placeholder="br/min"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">SpO2 (%)</label>
              <input
                type="number"
                placeholder="%"
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Temp (°F)</label>
              <input
                type="number"
                step="0.1"
                placeholder="°F"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Triage Staff Notes</label>
            <textarea
              rows={2}
              placeholder="Primary symptoms, trauma mechanism, emergency observations..."
              value={triageNotes}
              onChange={(e) => setTriageNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>
        </div>

        {/* Immediate Resource Assignment (Optional at Registration) */}
        <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Immediate Allocation (Optional)</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Assign Emergency Doctor</label>
              <select
                value={assignedDoctorId}
                onChange={(e) => setAssignedDoctorId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
              >
                <option value="">-- Assign Later in Queue --</option>
                {availableDoctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} ({d.specialization}) {d.is_emergency_duty ? '• On ER Duty' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Assign Bed</label>
              <select
                value={assignedBedId}
                onChange={(e) => setAssignedBedId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
              >
                <option value="">-- Assign Later in Queue --</option>
                {availableBeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bed_number} ({b.category} - {b.ward_department})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Registering...' : 'Register & Enter Priority Queue'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

