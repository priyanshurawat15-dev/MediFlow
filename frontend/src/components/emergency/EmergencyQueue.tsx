import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  Clock,
  Search,
  Filter,
  Plus,
  Stethoscope,
  BedDouble,
  FileText,
  RefreshCw,
  ChevronRight,
  ShieldAlert,
  CheckCircle,
  Truck,
} from 'lucide-react';
import { PriorityBadge, EmergencyStatusBadge } from '../common/Badge';
import { RegisterEmergencyModal } from './RegisterEmergencyModal';
import { AssignResourceModal } from './AssignResourceModal';
import { TriageReassessModal } from './TriageReassessModal';
import { EmergencyDetailsModal } from './EmergencyDetailsModal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { EmergencyCase, TriagePriority, EmergencyCaseStatus } from '../../types';

export const EmergencyQueue: React.FC = () => {
  const { error, success } = useToast();

  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Modals state
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [assignCase, setAssignCase] = useState<EmergencyCase | null>(null);
  const [reassessCase, setReassessCase] = useState<EmergencyCase | null>(null);
  const [detailsCaseId, setDetailsCaseId] = useState<number | null>(null);

  // Available resources at a glance
  const [resourceCounts, setResourceCounts] = useState<{ doctors: number; beds: number }>({ doctors: 0, beds: 0 });

  const fetchCases = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (selectedPriority !== 'All') params.append('priority', selectedPriority);
      if (selectedStatus !== 'All') params.append('status', selectedStatus);

      const res = await api.get<{ cases: EmergencyCase[] }>(`/emergency/cases?${params.toString()}`);
      setCases(res.cases || []);

      // Resources
      const rRes = await api.get<{ doctors: any[]; beds: any[] }>('/emergency/resources');
      setResourceCounts({
        doctors: rRes.doctors?.length || 0,
        beds: rRes.beds?.length || 0,
      });
    } catch (err: any) {
      error(err.message || 'Failed to fetch emergency queue');
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedPriority, selectedStatus, error]);

  useEffect(() => {
    fetchCases();
    // Auto-refresh queue every 15 seconds to keep waiting timers live
    const interval = setInterval(fetchCases, 15000);
    return () => clearInterval(interval);
  }, [fetchCases]);

  // Quick stats
  const criticalCount = cases.filter((c) => c.triage_priority === 'Critical' && c.status !== 'Resolved').length;
  const highCount = cases.filter((c) => c.triage_priority === 'High' && c.status !== 'Resolved').length;
  const waitingCount = cases.filter((c) => c.status === 'Waiting').length;
  const escalatedCount = cases.filter((c) => c.is_escalated).length;

  return (
    <div className="space-y-6">
      {/* Top Banner Alert if Escalated or Critical cases are waiting */}
      {escalatedCount > 0 && (
        <div className="p-4 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 flex items-center justify-between shadow-xs animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-600 text-white">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold">Escalation Alert: {escalatedCount} Case(s) Exceeded Waiting Threshold</h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Immediate doctor and bed allocation required. Critical threshold is 10 minutes.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedStatus('Waiting');
              setSelectedPriority('All');
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
          >
            View Escalated
          </button>
        </div>
      )}

      {/* Triage Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Queue Total</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900">{cases.length}</span>
            <span className="text-xs text-slate-500">cases</span>
          </div>
        </div>

        <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200">
          <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Priority 1: Critical</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-rose-900">{criticalCount}</span>
            <span className="text-xs text-rose-600 font-medium">Immediate</span>
          </div>
        </div>

        <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Priority 2: High</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-amber-900">{highCount}</span>
            <span className="text-xs text-amber-600 font-medium">&lt;30m</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Currently Waiting</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-indigo-700">{waitingCount}</span>
            <span className="text-xs text-slate-500">unassigned</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ER Doctors Avail</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-700">{resourceCounts.doctors}</span>
            <span className="text-xs text-slate-500">physicians</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ICU/ER Beds Avail</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-700">{resourceCounts.beds}</span>
            <span className="text-xs text-slate-500">beds free</span>
          </div>
        </div>
      </div>

      {/* Filter and Action Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by patient name, case code, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>

        {/* Priority & Status Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 font-medium">Priority:</span>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical (P1)</option>
              <option value="High">High (P2)</option>
              <option value="Medium">Medium (P3)</option>
              <option value="Low">Low (P4)</option>
            </select>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Waiting">Waiting</option>
              <option value="Assigned">Assigned</option>
              <option value="Under Treatment">Under Treatment</option>
              <option value="Transferred">Transferred</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          <button
            onClick={() => fetchCases()}
            title="Refresh queue"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsRegisterOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Emergency</span>
          </button>
        </div>
      </div>

      {/* Main Clinical Priority Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-600" />
              <span>Emergency Clinical Priority Queue</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Strictly prioritized: Clinical urgency rank (Critical &gt; High &gt; Medium &gt; Low), then waiting duration.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {cases.length} case{cases.length !== 1 ? 's' : ''} listed
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading emergency priority queue...</div>
        ) : cases.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Emergency Queue Clear</h4>
            <p className="text-xs text-slate-500 mt-1">No emergency cases matching the selected filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Priority / Case</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Emergency Presentation</th>
                  <th className="px-4 py-3">Vitals / State</th>
                  <th className="px-4 py-3">Waiting Time</th>
                  <th className="px-4 py-3">Doctor & Bed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.map((c) => {
                  const isCritical = c.triage_priority === 'Critical';
                  const isHigh = c.triage_priority === 'High';

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        c.is_escalated
                          ? 'bg-rose-50/40 border-l-4 border-rose-600'
                          : isCritical && c.status === 'Waiting'
                          ? 'bg-rose-50/20 border-l-4 border-rose-500'
                          : ''
                      }`}
                    >
                      {/* Priority & Case Code */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <PriorityBadge priority={c.triage_priority} pulse={isCritical && c.status === 'Waiting'} />
                          <div className="font-mono font-bold text-slate-900 text-xs">{c.case_code}</div>
                        </div>
                      </td>

                      {/* Patient Name & Demographics */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-xs">{c.patient_name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {c.age}y / {c.gender} • <span className="font-mono">{c.patient_code}</span>
                        </div>
                        {c.blood_group && (
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold mt-0.5">
                            {c.blood_group}
                          </span>
                        )}
                      </td>

                      {/* Emergency Presentation */}
                      <td className="px-4 py-3.5 max-w-[200px]">
                        <div className="font-semibold text-slate-800 text-xs truncate" title={c.emergency_type}>
                          {c.emergency_type}
                        </div>
                        {c.triage_notes && (
                          <div className="text-[11px] text-slate-500 truncate mt-0.5" title={c.triage_notes}>
                            {c.triage_notes}
                          </div>
                        )}
                        {c.linked_ambulance && (
                          <div className="flex items-center gap-1 text-[10px] text-indigo-700 font-medium mt-1">
                            <Truck className="w-3 h-3" />
                            <span>Arrived via {c.linked_ambulance}</span>
                          </div>
                        )}
                      </td>

                      {/* Vitals / State */}
                      <td className="px-4 py-3.5">
                        <div className="text-[11px] space-y-0.5">
                          <div className="text-slate-700">
                            <span className="text-slate-400">AVPU:</span>{' '}
                            <span className="font-medium">{c.conscious_state || 'Alert'}</span>
                          </div>
                          {c.systolic_bp && (
                            <div className="text-slate-700 font-mono">
                              <span className="text-slate-400">BP:</span> {c.systolic_bp}/{c.diastolic_bp}
                            </div>
                          )}
                          {c.spo2 && (
                            <div className={`font-mono ${c.spo2 < 92 ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                              <span className="text-slate-400">SpO2:</span> {c.spo2}%
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Waiting Time & Escalation Warning */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className={`font-bold ${c.is_escalated ? 'text-rose-600' : 'text-slate-800'}`}>
                            {c.waiting_minutes}m
                          </span>
                        </div>
                        {c.is_escalated && (
                          <span className="inline-block text-[10px] font-bold text-rose-700 mt-1">
                            ⚠️ Threshold Exceeded
                          </span>
                        )}
                      </td>

                      {/* Doctor & Bed */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Stethoscope className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            {c.doctor_name ? (
                              <span className="font-medium text-slate-800 truncate max-w-[130px]">
                                Dr. {c.doctor_name}
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold italic text-[11px]">Unassigned</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <BedDouble className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            {c.bed_number ? (
                              <span className="font-mono font-medium text-slate-800">
                                {c.bed_number} ({c.bed_category})
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold italic text-[11px]">No Bed</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <EmergencyStatusBadge status={c.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.status !== 'Resolved' && (
                            <>
                              <button
                                onClick={() => setAssignCase(c)}
                                title="Assign Doctor & Bed"
                                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                              >
                                {c.assigned_doctor_id && c.assigned_bed_id ? 'Reassign' : 'Assign'}
                              </button>
                              <button
                                onClick={() => setReassessCase(c)}
                                title="Reassess Triage"
                                className="px-2 py-1 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                              >
                                Triage
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setDetailsCaseId(c.id)}
                            title="View Case Sheet & Audit Log"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <RegisterEmergencyModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={fetchCases}
      />

      <AssignResourceModal
        isOpen={!!assignCase}
        onClose={() => setAssignCase(null)}
        emergencyCase={assignCase}
        onSuccess={fetchCases}
      />

      <TriageReassessModal
        isOpen={!!reassessCase}
        onClose={() => setReassessCase(null)}
        emergencyCase={reassessCase}
        onSuccess={fetchCases}
      />

      <EmergencyDetailsModal
        isOpen={!!detailsCaseId}
        onClose={() => setDetailsCaseId(null)}
        caseId={detailsCaseId}
        onStatusUpdated={fetchCases}
        onOpenAssign={(c) => {
          setDetailsCaseId(null);
          setAssignCase(c);
        }}
        onOpenReassess={(c) => {
          setDetailsCaseId(null);
          setReassessCase(c);
        }}
      />
    </div>
  );
};

