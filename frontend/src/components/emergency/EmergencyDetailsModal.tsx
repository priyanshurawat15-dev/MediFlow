import React, { useState, useEffect } from 'react';
import {
  Activity,
  Clock,
  Heart,
  Stethoscope,
  BedDouble,
  FileText,
  CheckCircle2,
  AlertTriangle,
  History,
  Shield,
  Phone,
  User,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { PriorityBadge, EmergencyStatusBadge } from '../common/Badge';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { EmergencyCase, EmergencyActivityLog } from '../../types';

interface EmergencyDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: number | null;
  onStatusUpdated: () => void;
  onOpenAssign: (c: EmergencyCase) => void;
  onOpenReassess: (c: EmergencyCase) => void;
}

export const EmergencyDetailsModal: React.FC<EmergencyDetailsModalProps> = ({
  isOpen,
  onClose,
  caseId,
  onStatusUpdated,
  onOpenAssign,
  onOpenReassess,
}) => {
  const { success, error } = useToast();
  const [data, setData] = useState<{ case: EmergencyCase; logs: EmergencyActivityLog[] } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [showResolveForm, setShowResolveForm] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && caseId) {
      setIsLoading(true);
      setShowResolveForm(false);
      setResolutionNotes('');
      api.get<{ case: EmergencyCase; logs: EmergencyActivityLog[] }>(`/emergency/cases/${caseId}`)
        .then((res) => setData(res))
        .catch((err) => error(err.message || 'Failed to load case details'))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, caseId]);

  if (!isOpen) return null;

  const emgCase = data?.case;
  const logs = data?.logs || [];

  const handleUpdateStatus = async (newStatus: string) => {
    if (!emgCase) return;
    setIsUpdatingStatus(true);
    try {
      await api.patch(`/emergency/cases/${emgCase.id}/status`, {
        status: newStatus,
        notes: resolutionNotes || undefined,
      });
      success(`Emergency case marked as '${newStatus}'`);
      onStatusUpdated();
      // Reload modal data
      const refreshed = await api.get<{ case: EmergencyCase; logs: EmergencyActivityLog[] }>(`/emergency/cases/${emgCase.id}`);
      setData(refreshed);
      setShowResolveForm(false);
    } catch (err: any) {
      error(err.message || 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={emgCase ? `Case Sheet: ${emgCase.case_code}` : 'Emergency Case Sheet'}
      subtitle={emgCase ? `Arrived at: ${new Date(emgCase.arrived_at).toLocaleString()}` : undefined}
      maxWidth="4xl"
    >
      {isLoading || !emgCase ? (
        <div className="py-12 text-center text-slate-500 text-sm">Loading emergency clinical file...</div>
      ) : (
        <div className="space-y-6">
          {/* Top Banner with Triage Priority and Status */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <PriorityBadge priority={emgCase.triage_priority} />
              <EmergencyStatusBadge status={emgCase.status} />
              {emgCase.is_escalated && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-600 text-white animate-pulse">
                  ESCALATED: Over Waiting Threshold
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {emgCase.status !== 'Resolved' && (
                <>
                  <button
                    onClick={() => onOpenReassess(emgCase)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                  >
                    Reassess Triage
                  </button>
                  <button
                    onClick={() => onOpenAssign(emgCase)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                  >
                    {emgCase.assigned_doctor_id ? 'Change Resources' : 'Assign Doctor & Bed'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Patient Profile & Clinical Presentation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Patient Info */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                <User className="w-4 h-4 text-indigo-600" />
                <span>Patient Demographics</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Full Name</span>
                  <span className="font-bold text-slate-900">{emgCase.patient_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Patient ID</span>
                  <span className="font-mono font-semibold text-slate-900">{emgCase.patient_code}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Age / Gender / Blood</span>
                  <span className="font-semibold text-slate-800">
                    {emgCase.age} yrs / {emgCase.gender} / {emgCase.blood_group || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Phone</span>
                  <span className="font-mono text-slate-800">{emgCase.patient_phone || 'N/A'}</span>
                </div>
                <div className="py-1">
                  <span className="text-slate-500 block mb-0.5">Known Medical History:</span>
                  <span className="text-slate-700 italic">
                    {(emgCase as any).medical_history || 'No prior chronic conditions recorded'}
                  </span>
                </div>
              </div>
            </div>

            {/* Emergency Condition & Assigned Resources */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                <Activity className="w-4 h-4 text-rose-600" />
                <span>Emergency Presentation</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Emergency Type</span>
                  <span className="font-bold text-rose-700">{emgCase.emergency_type}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Conscious Level</span>
                  <span className="font-semibold text-slate-900">{emgCase.conscious_state}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Assigned Doctor</span>
                  <span className="font-semibold text-slate-900">
                    {emgCase.doctor_name ? `Dr. ${emgCase.doctor_name} (${emgCase.doctor_specialization})` : 'Unassigned'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Assigned Bed</span>
                  <span className="font-semibold text-slate-900">
                    {emgCase.bed_number ? `${emgCase.bed_number} (${emgCase.bed_category} - ${emgCase.bed_ward})` : 'Unassigned'}
                  </span>
                </div>
                <div className="py-1">
                  <span className="text-slate-500 block mb-0.5">Triage Staff Note:</span>
                  <span className="text-slate-700">
                    {emgCase.triage_notes || 'No specific notes recorded at initial triage.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Vitals Snapshot */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Vitals at Triage</p>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Blood Pressure</span>
                <span className="text-sm font-bold text-slate-800">
                  {emgCase.systolic_bp && emgCase.diastolic_bp ? `${emgCase.systolic_bp}/${emgCase.diastolic_bp}` : 'N/A'}
                </span>
                <span className="text-[9px] text-slate-400 block">mmHg</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Heart Rate</span>
                <span className="text-sm font-bold text-slate-800">{emgCase.heart_rate || 'N/A'}</span>
                <span className="text-[9px] text-slate-400 block">bpm</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Resp Rate</span>
                <span className="text-sm font-bold text-slate-800">{emgCase.respiratory_rate || 'N/A'}</span>
                <span className="text-[9px] text-slate-400 block">br/min</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Oxygen (SpO2)</span>
                <span className={`text-sm font-bold ${emgCase.spo2 && emgCase.spo2 < 92 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {emgCase.spo2 ? `${emgCase.spo2}%` : 'N/A'}
                </span>
                <span className="text-[9px] text-slate-400 block">saturation</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Temp</span>
                <span className="text-sm font-bold text-slate-800">{emgCase.temperature ? `${emgCase.temperature}°F` : 'N/A'}</span>
                <span className="text-[9px] text-slate-400 block">Fahrenheit</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Waiting Time</span>
                <span className="text-sm font-bold text-slate-800">{emgCase.waiting_minutes}m</span>
                <span className="text-[9px] text-slate-400 block">elapsed</span>
              </div>
            </div>
          </div>

          {/* Workflow Status Controls */}
          {emgCase.status !== 'Resolved' && (
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40">
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider block mb-2">
                Emergency Case Workflow Transition
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {emgCase.status === 'Waiting' && (
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => onOpenAssign(emgCase)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                  >
                    Assign Resources & Advance to Assigned
                  </button>
                )}
                {emgCase.status === 'Assigned' && (
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdateStatus('Under Treatment')}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                  >
                    Start Treatment (Move to Under Treatment)
                  </button>
                )}
                {emgCase.status === 'Under Treatment' && (
                  <>
                    <button
                      disabled={isUpdatingStatus}
                      onClick={() => handleUpdateStatus('Transferred')}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
                    >
                      Transfer to Inpatient Ward
                    </button>
                    <button
                      disabled={isUpdatingStatus}
                      onClick={() => setShowResolveForm(!showResolveForm)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    >
                      Resolve Case (Discharge)
                    </button>
                  </>
                )}
              </div>

              {showResolveForm && (
                <div className="mt-3 pt-3 border-t border-indigo-100 space-y-2">
                  <label className="block text-xs font-medium text-slate-700">Resolution / Discharge Notes</label>
                  <textarea
                    rows={2}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Document clinical resolution, condition upon stabilization, instructions..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowResolveForm(false)}
                      className="px-3 py-1 text-xs rounded bg-slate-200 text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus('Resolved')}
                      className="px-3 py-1 text-xs rounded bg-emerald-600 text-white font-semibold"
                    >
                      Confirm Resolution & Release Bed
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Audit Timeline */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
              <History className="w-4 h-4 text-indigo-600" />
              <span>Emergency Activity & Clinical Audit Trail</span>
            </div>
            <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="relative">
                  <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-indigo-600"></div>
                  <div className="text-xs">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-slate-900">{log.action_type.replace('_', ' ')}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5">{log.details}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">By: {log.performed_by_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

