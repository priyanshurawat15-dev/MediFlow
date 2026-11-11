import React, { useState, useEffect } from 'react';
import { RefreshCw, Activity, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { EmergencyCase, TriagePriority } from '../../types';

interface TriageReassessModalProps {
  isOpen: boolean;
  onClose: () => void;
  emergencyCase: EmergencyCase | null;
  onSuccess: () => void;
}

export const TriageReassessModal: React.FC<TriageReassessModalProps> = ({
  isOpen,
  onClose,
  emergencyCase,
  onSuccess,
}) => {
  const { success, error } = useToast();

  const [triagePriority, setTriagePriority] = useState<TriagePriority>('Critical');
  const [triageNotes, setTriageNotes] = useState<string>('');
  const [systolicBp, setSystolicBp] = useState<string>('');
  const [diastolicBp, setDiastolicBp] = useState<string>('');
  const [heartRate, setHeartRate] = useState<string>('');
  const [spo2, setSpo2] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && emergencyCase) {
      setTriagePriority(emergencyCase.triage_priority);
      setTriageNotes('');
      setSystolicBp(emergencyCase.systolic_bp ? String(emergencyCase.systolic_bp) : '');
      setDiastolicBp(emergencyCase.diastolic_bp ? String(emergencyCase.diastolic_bp) : '');
      setHeartRate(emergencyCase.heart_rate ? String(emergencyCase.heart_rate) : '');
      setSpo2(emergencyCase.spo2 ? String(emergencyCase.spo2) : '');
    }
  }, [isOpen, emergencyCase]);

  if (!emergencyCase) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triageNotes.trim()) {
      error('Clinical rationale is required for triage reassessment.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/emergency/cases/${emergencyCase.id}/reassess-triage`, {
        triage_priority: triagePriority,
        triage_notes: triageNotes.trim(),
        vitals: {
          systolic_bp: systolicBp ? parseInt(systolicBp, 10) : null,
          diastolic_bp: diastolicBp ? parseInt(diastolicBp, 10) : null,
          heart_rate: heartRate ? parseInt(heartRate, 10) : null,
          spo2: spo2 ? parseInt(spo2, 10) : null,
        },
      });

      success(`Priority reassessed to ${triagePriority.toUpperCase()}. Queue order refreshed.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to reassess triage priority');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Medical Staff Triage Reassessment"
      subtitle={`Case ${emergencyCase.case_code} • Current: ${emergencyCase.triage_priority}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Priority Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Updated Priority Category *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { level: 'Critical', label: '1 - Critical', color: 'border-rose-500 bg-rose-600 text-white' },
              { level: 'High', label: '2 - High', color: 'border-amber-500 bg-amber-600 text-white' },
              { level: 'Medium', label: '3 - Medium', color: 'border-yellow-500 bg-yellow-600 text-white' },
              { level: 'Low', label: '4 - Low', color: 'border-emerald-500 bg-emerald-600 text-white' },
            ].map((p) => {
              const isSelected = triagePriority === p.level;
              return (
                <button
                  type="button"
                  key={p.level}
                  onClick={() => setTriagePriority(p.level as TriagePriority)}
                  className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-colors cursor-pointer ${
                    isSelected ? p.color : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Updated Vitals */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Reassessed Vitals (Optional)
          </label>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Sys BP</label>
              <input
                type="number"
                value={systolicBp}
                onChange={(e) => setSystolicBp(e.target.value)}
                placeholder="mmHg"
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Dia BP</label>
              <input
                type="number"
                value={diastolicBp}
                onChange={(e) => setDiastolicBp(e.target.value)}
                placeholder="mmHg"
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Pulse</label>
              <input
                type="number"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                placeholder="bpm"
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">SpO2</label>
              <input
                type="number"
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                placeholder="%"
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
          </div>
        </div>

        {/* Clinical Rationale Note */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Clinical Rationale for Reassessment *
          </label>
          <textarea
            required
            rows={3}
            placeholder="Document reasons for priority change (e.g. respiratory deterioration, response to nebulization, hemodynamics improved)..."
            value={triageNotes}
            onChange={(e) => setTriageNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Updating...' : 'Confirm Reassessment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

