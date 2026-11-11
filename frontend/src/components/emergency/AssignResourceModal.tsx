import React, { useState, useEffect } from 'react';
import { Stethoscope, BedDouble, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { EmergencyCase, Doctor, Bed } from '../../types';

interface AssignResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  emergencyCase: EmergencyCase | null;
  onSuccess: () => void;
}

export const AssignResourceModal: React.FC<AssignResourceModalProps> = ({
  isOpen,
  onClose,
  emergencyCase,
  onSuccess,
}) => {
  const { success, error } = useToast();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedBedId, setSelectedBedId] = useState<string>('');

  const [isOverride, setIsOverride] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && emergencyCase) {
      setSelectedDoctorId(emergencyCase.assigned_doctor_id ? String(emergencyCase.assigned_doctor_id) : '');
      setSelectedBedId(emergencyCase.assigned_bed_id ? String(emergencyCase.assigned_bed_id) : '');
      setIsOverride(false);
      setOverrideReason('');

      // Fetch fresh available resources
      api.get<{ doctors: Doctor[]; beds: Bed[] }>('/emergency/resources')
        .then((res) => {
          setDoctors(res.doctors || []);
          setBeds(res.beds || []);
        })
        .catch(() => {});
    }
  }, [isOpen, emergencyCase]);

  if (!emergencyCase) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId && !selectedBedId) {
      error('Please select at least a doctor or a bed to assign.');
      return;
    }
    if (isOverride && !overrideReason.trim()) {
      error('A recorded override reason is mandatory when overriding resource allocation.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/emergency/cases/${emergencyCase.id}/assign`, {
        doctor_id: selectedDoctorId ? parseInt(selectedDoctorId, 10) : null,
        bed_id: selectedBedId ? parseInt(selectedBedId, 10) : null,
        override_reason: isOverride ? overrideReason.trim() : null,
      });

      success(`Clinical resources assigned to case ${emergencyCase.case_code}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to assign resources');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Resources: ${emergencyCase.case_code}`}
      subtitle={`Patient: ${emergencyCase.patient_name} (${emergencyCase.patient_code}) • ${emergencyCase.emergency_type}`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Case Priority Summary */}
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500">Triage Priority:</span>{' '}
            <span className="font-bold text-rose-700">{emergencyCase.triage_priority}</span>
          </div>
          <div>
            <span className="text-slate-500">Waiting Time:</span>{' '}
            <span className="font-bold text-slate-800">{emergencyCase.waiting_minutes} mins</span>
          </div>
          <div>
            <span className="text-slate-500">Status:</span>{' '}
            <span className="font-semibold text-slate-800">{emergencyCase.status}</span>
          </div>
        </div>

        {/* Doctor Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
            <span>Assign Attending Emergency Doctor</span>
          </label>
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
          >
            <option value="">-- Select Available Doctor --</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                Dr. {d.full_name} ({d.specialization}) {d.is_emergency_duty ? '• On ER Duty' : ''} (Patients: {d.current_patient_count})
              </option>
            ))}
          </select>
        </div>

        {/* Bed Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <BedDouble className="w-3.5 h-3.5 text-indigo-600" />
            <span>Allocate Emergency / ICU Bed</span>
          </label>
          <select
            value={selectedBedId}
            onChange={(e) => setSelectedBedId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
          >
            <option value="">-- Select Available Bed --</option>
            {beds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bed_number} — {b.category} ({b.ward_department}, {b.floor})
              </option>
            ))}
          </select>
        </div>

        {/* Override Assignment Toggle */}
        <div className="pt-2 border-t border-slate-200">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isOverride}
              onChange={(e) => setIsOverride(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
            />
            <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              Special Clinical Override (Requires Recorded Clinical Reason)
            </span>
          </label>

          {isOverride && (
            <div className="mt-2.5">
              <textarea
                required
                rows={2}
                placeholder="Specify clinical justification for assignment override..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-amber-300 bg-amber-50/50 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
              />
              <p className="text-[11px] text-amber-700 mt-1">
                This note will be permanently logged in the emergency activity timeline for auditing.
              </p>
            </div>
          )}
        </div>

        {/* Modal Actions */}
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
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Assigning...' : 'Confirm Assignment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

