import React, { useState, useEffect, useCallback } from 'react';
import { BedDouble, CheckCircle2, AlertTriangle, ArrowRightLeft, LogOut, Plus, Search, Filter } from 'lucide-react';
import { BedStatusBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Bed, BedCategory, Patient, Doctor } from '../../types';

export const BedManagementView: React.FC = () => {
  const { success, error } = useToast();

  const [beds, setBeds] = useState<Bed[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modals state
  const [isAddBedOpen, setIsAddBedOpen] = useState<boolean>(false);
  const [allocateBed, setAllocateBed] = useState<Bed | null>(null);
  const [transferBed, setTransferBed] = useState<Bed | null>(null);
  const [releaseBed, setReleaseBed] = useState<Bed | null>(null);

  // Form states
  const [newBed, setNewBed] = useState({
    bed_number: '',
    category: 'Emergency Bed',
    ward_department: 'Emergency Wing',
    floor: 'Ground Floor',
    daily_charge: '1500',
  });

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [admissionDiagnosis, setAdmissionDiagnosis] = useState<string>('');
  const [targetBedId, setTargetBedId] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('');

  const fetchBeds = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'All') params.append('category', selectedCategory);
      if (statusFilter !== 'All') params.append('status', statusFilter);

      const res = await api.get<{ beds: Bed[] }>(`/beds?${params.toString()}`);
      setBeds(res.beds || []);

      const sumRes = await api.get<any>('/beds/summary');
      setSummary(sumRes);
    } catch (err: any) {
      error(err.message || 'Failed to fetch beds');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, statusFilter, error]);

  useEffect(() => {
    fetchBeds();
  }, [fetchBeds]);

  // Load patients and doctors when opening allocation
  const handleOpenAllocate = (bed: Bed) => {
    setAllocateBed(bed);
    setSelectedPatientId('');
    setSelectedDoctorId('');
    setAdmissionDiagnosis('');
    api.get<{ patients: Patient[] }>('/patients').then((r) => setPatients(r.patients || []));
    api.get<{ doctors: Doctor[] }>('/doctors').then((r) => setDoctors(r.doctors || []));
  };

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocateBed || !selectedPatientId) {
      error('Please select a patient to admit.');
      return;
    }
    try {
      await api.post(`/beds/${allocateBed.id}/allocate`, {
        patient_id: parseInt(selectedPatientId, 10),
        doctor_id: selectedDoctorId ? parseInt(selectedDoctorId, 10) : null,
        diagnosis: admissionDiagnosis || 'General Inpatient Admission',
      });
      success(`Bed ${allocateBed.bed_number} allocated successfully.`);
      setAllocateBed(null);
      fetchBeds();
    } catch (err: any) {
      error(err.message || 'Failed to allocate bed');
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferBed || !targetBedId) {
      error('Please select the destination bed.');
      return;
    }
    try {
      await api.post(`/beds/${transferBed.id}/transfer`, {
        target_bed_id: parseInt(targetBedId, 10),
        transfer_reason: transferReason || 'Clinical ward transfer',
      });
      success(`Patient transferred from ${transferBed.bed_number} successfully.`);
      setTransferBed(null);
      fetchBeds();
    } catch (err: any) {
      error(err.message || 'Failed to transfer patient');
    }
  };

  const handleReleaseConfirm = async () => {
    if (!releaseBed) return;
    try {
      await api.post(`/beds/${releaseBed.id}/release`, { status_after: 'Cleaning' });
      success(`Bed ${releaseBed.bed_number} discharged and marked for sanitization.`);
      setReleaseBed(null);
      fetchBeds();
    } catch (err: any) {
      error(err.message || 'Failed to discharge bed');
    }
  };

  const handleAddBedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/beds', newBed);
      success(`Bed ${newBed.bed_number} added to hospital inventory.`);
      setIsAddBedOpen(false);
      setNewBed({
        bed_number: '',
        category: 'Emergency Bed',
        ward_department: 'Emergency Wing',
        floor: 'Ground Floor',
        daily_charge: '1500',
      });
      fetchBeds();
    } catch (err: any) {
      error(err.message || 'Failed to add bed');
    }
  };

  const categories: BedCategory[] = ['Emergency Bed', 'ICU', 'HDU', 'General Ward', 'Private Room'];
  const availableBedsForTransfer = beds.filter((b) => b.status === 'Available');

  return (
    <div className="space-y-6">
      {/* Bed Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Hospital Capacity</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{summary.overall?.total || 0}</span>
              <span className="text-xs text-slate-500">total beds</span>
            </div>
          </div>
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Available Beds</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-900">{summary.overall?.available || 0}</span>
              <span className="text-xs text-emerald-700 font-medium">ready for admission</span>
            </div>
          </div>
          <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200">
            <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">Occupied Beds</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-900">{summary.overall?.occupied || 0}</span>
              <span className="text-xs text-rose-700 font-medium">currently admitted</span>
            </div>
          </div>
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Sanitization / Cleaning</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-900">{summary.overall?.maintenance || 0}</span>
              <span className="text-xs text-amber-700 font-medium">in turnaround</span>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs & Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Beds ({summary?.overall?.total || 0})
          </button>
          {categories.map((cat) => {
            const count = summary?.summary?.[cat]?.total || 0;
            const avail = summary?.summary?.[cat]?.available || 0;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat} ({avail}/{count} free)
              </button>
            );
          })}
        </div>

        {/* Filter and Add Bed */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
          >
            <option value="All">All Statuses</option>
            <option value="Available">Available Only</option>
            <option value="Occupied">Occupied Only</option>
            <option value="Cleaning">Cleaning / Turnaround</option>
          </select>

          <button
            onClick={() => setIsAddBedOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Bed</span>
          </button>
        </div>
      </div>

      {/* Bed Visual Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-500 text-sm">Loading hospital beds...</div>
      ) : beds.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-sm bg-white rounded-xl border border-slate-200">
          No beds found for the selected category.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {beds.map((b) => {
            const isAvail = b.status === 'Available';
            const isOcc = b.status === 'Occupied';
            const isCleaning = b.status === 'Cleaning' || b.status === 'Maintenance';

            return (
              <div
                key={b.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isAvail
                    ? 'bg-white border-emerald-300 hover:shadow-md'
                    : isOcc
                    ? 'bg-rose-50/20 border-rose-200 hover:shadow-md'
                    : 'bg-amber-50/20 border-amber-200'
                }`}
              >
                <div>
                  {/* Bed Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <BedDouble
                          className={`w-4 h-4 ${
                            isAvail ? 'text-emerald-600' : isOcc ? 'text-rose-600' : 'text-amber-600'
                          }`}
                        />
                        <span className="font-mono font-bold text-sm text-slate-900">{b.bed_number}</span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500">{b.category}</span>
                    </div>
                    <BedStatusBadge status={b.status} />
                  </div>

                  {/* Ward and Floor Details */}
                  <p className="text-[11px] text-slate-500 mb-3">
                    {b.ward_department} • {b.floor}
                  </p>

                  {/* Patient Info if Occupied */}
                  {isOcc && (
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs mb-3 space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-900">
                        <span className="truncate">{b.patient_name}</span>
                        <span className="font-mono text-[10px] text-slate-500">{b.patient_code}</span>
                      </div>
                      {b.admission_diagnosis && (
                        <p className="text-[11px] text-slate-600 truncate">{b.admission_diagnosis}</p>
                      )}
                      {b.linked_emergency_case && (
                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          Case {b.linked_emergency_case}
                        </span>
                      )}
                    </div>
                  )}

                  {isAvail && (
                    <div className="p-2 rounded bg-emerald-50 text-[11px] text-emerald-800 font-medium mb-3">
                      Ready for Immediate Allocation
                    </div>
                  )}

                  {isCleaning && (
                    <div className="p-2 rounded bg-amber-50 text-[11px] text-amber-800 font-medium mb-3">
                      Cleaning & Sanitization in Progress
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono text-[11px]">₹{b.daily_charge}/day</span>

                  <div className="flex items-center gap-1.5">
                    {isAvail && (
                      <button
                        onClick={() => handleOpenAllocate(b)}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                      >
                        Allocate
                      </button>
                    )}

                    {isOcc && (
                      <>
                        <button
                          onClick={() => {
                            setTransferBed(b);
                            setTargetBedId('');
                            setTransferReason('');
                          }}
                          title="Transfer patient to another bed"
                          className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-slate-500" />
                          <span>Transfer</span>
                        </button>
                        <button
                          onClick={() => setReleaseBed(b)}
                          title="Discharge and free bed"
                          className="px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-semibold cursor-pointer"
                        >
                          Discharge
                        </button>
                      </>
                    )}

                    {isCleaning && (
                      <button
                        onClick={async () => {
                          await api.patch(`/beds/${b.id}/release`, { status_after: 'Available' });
                          success(`Bed ${b.bed_number} marked clean and available.`);
                          fetchBeds();
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-900 text-white font-semibold cursor-pointer text-[11px]"
                      >
                        Mark Ready
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Allocate Bed Modal */}
      <Modal
        isOpen={!!allocateBed}
        onClose={() => setAllocateBed(null)}
        title={allocateBed ? `Allocate Bed: ${allocateBed.bed_number}` : 'Allocate Bed'}
        subtitle={allocateBed ? `${allocateBed.category} • ${allocateBed.ward_department}` : undefined}
        maxWidth="md"
      >
        <form onSubmit={handleAllocateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Patient to Admit *
            </label>
            <select
              required
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="">-- Choose Patient --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.patient_id}) - {p.gender}, {p.age}y
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Attending Physician
            </label>
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="">-- Select Doctor --</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.full_name} ({d.specialization})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Admission Diagnosis & Reason
            </label>
            <input
              type="text"
              placeholder="e.g. Post-operative observation, acute exacerbation..."
              value={admissionDiagnosis}
              onChange={(e) => setAdmissionDiagnosis(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setAllocateBed(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
            >
              Confirm Admission
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Bed Modal */}
      <Modal
        isOpen={!!transferBed}
        onClose={() => setTransferBed(null)}
        title={transferBed ? `Transfer Patient from Bed ${transferBed.bed_number}` : 'Transfer Patient'}
        subtitle={transferBed ? `Current Patient: ${transferBed.patient_name}` : undefined}
        maxWidth="md"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Destination Bed *
            </label>
            <select
              required
              value={targetBedId}
              onChange={(e) => setTargetBedId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="">-- Choose Available Bed --</option>
              {availableBedsForTransfer.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bed_number} — {b.category} ({b.ward_department}, {b.floor})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Transfer Reason
            </label>
            <input
              type="text"
              placeholder="e.g. ICU step-down to General Ward, Emergency to HDU..."
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setTransferBed(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
            >
              Transfer Patient
            </button>
          </div>
        </form>
      </Modal>

      {/* Discharge Confirmation */}
      <ConfirmDialog
        isOpen={!!releaseBed}
        onClose={() => setReleaseBed(null)}
        onConfirm={handleReleaseConfirm}
        title="Discharge Patient & Free Bed"
        message={
          releaseBed
            ? `Are you sure you want to discharge ${releaseBed.patient_name} from bed ${releaseBed.bed_number}? The bed will be released and marked for cleaning.`
            : ''
        }
        confirmLabel="Confirm Discharge"
        isDestructive
      />

      {/* Add Bed Modal */}
      <Modal
        isOpen={isAddBedOpen}
        onClose={() => setIsAddBedOpen(false)}
        title="Add Hospital Bed"
        subtitle="Register new bed in hospital inventory"
        maxWidth="md"
      >
        <form onSubmit={handleAddBedSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Bed Number / Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. ICU-105, EMG-07, GW-309"
              value={newBed.bed_number}
              onChange={(e) => setNewBed({ ...newBed, bed_number: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Bed Category *</label>
            <select
              value={newBed.category}
              onChange={(e) => setNewBed({ ...newBed, category: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="Emergency Bed">Emergency Bed</option>
              <option value="ICU">ICU (Intensive Care Unit)</option>
              <option value="HDU">HDU (High Dependency Unit)</option>
              <option value="General Ward">General Ward</option>
              <option value="Private Room">Private Room</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ward / Department *</label>
              <input
                type="text"
                required
                value={newBed.ward_department}
                onChange={(e) => setNewBed({ ...newBed, ward_department: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Floor *</label>
              <input
                type="text"
                required
                value={newBed.floor}
                onChange={(e) => setNewBed({ ...newBed, floor: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Daily Charge (₹)</label>
            <input
              type="number"
              value={newBed.daily_charge}
              onChange={(e) => setNewBed({ ...newBed, daily_charge: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddBedOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
            >
              Save Bed
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

