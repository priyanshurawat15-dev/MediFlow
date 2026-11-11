import React, { useState, useEffect, useCallback } from 'react';
import { Stethoscope, Phone, Mail, Clock, UserCheck, Plus, Search, ShieldCheck } from 'lucide-react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Doctor } from '../../types';

export const DoctorListView: React.FC = () => {
  const { success, error } = useToast();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [specializationFilter, setSpecializationFilter] = useState<string>('All');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('All');

  // Add doctor modal
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [newDoc, setNewDoc] = useState({
    full_name: '',
    specialization: 'Emergency Medicine',
    department: 'Emergency Wing',
    phone: '',
    email: '',
    duty_schedule: 'Day Shift (08:00 - 16:00)',
    is_emergency_duty: true,
  });

  const fetchDoctors = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (specializationFilter !== 'All') params.append('specialization', specializationFilter);
      if (availabilityFilter !== 'All') params.append('availability', availabilityFilter);

      const res = await api.get<{ doctors: Doctor[] }>(`/doctors?${params.toString()}`);
      setDoctors(res.doctors || []);
    } catch (err: any) {
      error(err.message || 'Failed to fetch doctors');
    } finally {
      setIsLoading(false);
    }
  }, [specializationFilter, availabilityFilter, error]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const handleUpdateStatus = async (doctor: Doctor, newStatus: string) => {
    try {
      await api.patch(`/doctors/${doctor.id}/status`, { availability_status: newStatus });
      success(`Dr. ${doctor.full_name} availability updated to ${newStatus}.`);
      fetchDoctors();
    } catch (err: any) {
      error(err.message || 'Failed to update status');
    }
  };

  const handleToggleEmergencyDuty = async (doctor: Doctor) => {
    try {
      const nextDuty = doctor.is_emergency_duty ? 0 : 1;
      await api.patch(`/doctors/${doctor.id}/status`, { is_emergency_duty: nextDuty });
      success(`Emergency duty status updated for Dr. ${doctor.full_name}`);
      fetchDoctors();
    } catch (err: any) {
      error(err.message || 'Failed to update duty');
    }
  };

  const handleAddDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/doctors', newDoc);
      success(`Dr. ${newDoc.full_name} added to medical roster.`);
      setIsAddOpen(false);
      setNewDoc({
        full_name: '',
        specialization: 'Emergency Medicine',
        department: 'Emergency Wing',
        phone: '',
        email: '',
        duty_schedule: 'Day Shift (08:00 - 16:00)',
        is_emergency_duty: true,
      });
      fetchDoctors();
    } catch (err: any) {
      error(err.message || 'Failed to add doctor');
    }
  };

  const filteredDoctors = doctors.filter((d) =>
    search.trim() === ''
      ? true
      : d.full_name.toLowerCase().includes(search.toLowerCase()) ||
        d.doctor_code.toLowerCase().includes(search.toLowerCase()) ||
        d.specialization.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search doctors by name, code, specialty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
          >
            <option value="All">All Statuses</option>
            <option value="Available">Available</option>
            <option value="In Consultation">In Consultation</option>
            <option value="In Emergency">In Emergency</option>
            <option value="Off Duty">Off Duty</option>
          </select>

          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Doctor</span>
          </button>
        </div>
      </div>

      {/* Doctors Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-500 text-sm">Loading doctors roster...</div>
      ) : filteredDoctors.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-sm bg-white rounded-xl border border-slate-200">
          No doctors match the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDoctors.map((doc) => {
            const isAvailable = doc.availability_status === 'Available';
            const isERDuty = Boolean(doc.is_emergency_duty);

            return (
              <div
                key={doc.id}
                className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  {/* Doctor Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {doc.full_name.replace('Dr. ', '').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{doc.full_name}</h4>
                        <p className="text-xs font-semibold text-indigo-600">{doc.specialization}</p>
                      </div>
                    </div>

                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                      {doc.doctor_code}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        isAvailable
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : doc.availability_status === 'In Emergency'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : doc.availability_status === 'In Consultation'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {doc.availability_status}
                    </span>

                    <button
                      onClick={() => handleToggleEmergencyDuty(doc)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                        isERDuty
                          ? 'bg-rose-50 text-rose-700 border border-rose-300 font-bold'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                      title="Click to toggle emergency duty roster"
                    >
                      {isERDuty ? '⚡ On Emergency Duty' : 'Regular Duty'}
                    </button>
                  </div>

                  {/* Details */}
                  <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Department:</span>
                      <span className="font-medium text-slate-800">{doc.department}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Shift Schedule:</span>
                      <span className="font-medium text-slate-800">{doc.duty_schedule}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Active Patients:</span>
                      <span className="font-bold text-indigo-700">{doc.current_patient_count} active</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Phone:</span>
                      <span className="text-slate-700">{doc.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Change Availability Status */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Set Status:</span>
                  <select
                    value={doc.availability_status}
                    onChange={(e) => handleUpdateStatus(doc, e.target.value)}
                    className="px-2 py-1 text-xs rounded border border-slate-200 bg-slate-50 text-slate-700 font-medium"
                  >
                    <option value="Available">Available</option>
                    <option value="In Consultation">In Consultation</option>
                    <option value="In Emergency">In Emergency</option>
                    <option value="Off Duty">Off Duty</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Doctor Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Doctor to Hospital Medical Roster"
        subtitle="Physician credentials, specialty, and duty schedule"
        maxWidth="md"
      >
        <form onSubmit={handleAddDoctorSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Doctor Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Ananya Sen"
              value={newDoc.full_name}
              onChange={(e) => setNewDoc({ ...newDoc, full_name: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Specialization *</label>
              <select
                value={newDoc.specialization}
                onChange={(e) => setNewDoc({ ...newDoc, specialization: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option value="Emergency Medicine">Emergency Medicine</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Trauma Surgery">Trauma Surgery</option>
                <option value="Neurology">Neurology</option>
                <option value="Pulmonology / Critical Care">Pulmonology / Critical Care</option>
                <option value="General Medicine">General Medicine</option>
                <option value="Orthopedics">Orthopedics</option>
                <option value="Pediatrics">Pediatrics</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Department *</label>
              <input
                type="text"
                required
                value={newDoc.department}
                onChange={(e) => setNewDoc({ ...newDoc, department: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number *</label>
              <input
                type="text"
                required
                placeholder="+91..."
                value={newDoc.phone}
                onChange={(e) => setNewDoc({ ...newDoc, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                placeholder="doctor@mediflow.health"
                value={newDoc.email}
                onChange={(e) => setNewDoc({ ...newDoc, email: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Duty Schedule</label>
            <input
              type="text"
              value={newDoc.duty_schedule}
              onChange={(e) => setNewDoc({ ...newDoc, duty_schedule: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newDoc.is_emergency_duty}
                onChange={(e) => setNewDoc({ ...newDoc, is_emergency_duty: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300"
              />
              <span className="text-xs font-semibold text-slate-800">Assign to Emergency On-Call Duty</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
            >
              Save Doctor
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

