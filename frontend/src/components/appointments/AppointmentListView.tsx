import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Plus, Search, CheckCircle, XCircle, User, Stethoscope } from 'lucide-react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Appointment, Patient, Doctor } from '../../types';

export const AppointmentListView: React.FC = () => {
  const { success, error } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [dateFilter, setDateFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Schedule modal
  const [isScheduleOpen, setIsScheduleOpen] = useState<boolean>(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [department, setDepartment] = useState<string>('General Medicine');
  const [appointmentDate, setAppointmentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState<string>('10:00 AM');
  const [reasonForVisit, setReasonForVisit] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchAppointments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.append('date', dateFilter);
      if (statusFilter !== 'All') params.append('status', statusFilter);

      const res = await api.get<{ appointments: Appointment[] }>(`/appointments?${params.toString()}`);
      setAppointments(res.appointments || []);

      // Patients and Doctors for booking
      const pRes = await api.get<{ patients: Patient[] }>('/patients');
      setPatients(pRes.patients || []);

      const dRes = await api.get<{ doctors: Doctor[] }>('/doctors');
      setDoctors(dRes.doctors || []);
    } catch (err: any) {
      error(err.message || 'Failed to fetch appointments');
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter, statusFilter, error]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      success(`Appointment status updated to ${status}.`);
      fetchAppointments();
    } catch (err: any) {
      error(err.message || 'Failed to update appointment');
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedDoctorId || !appointmentDate || !timeSlot) {
      error('Patient, doctor, date, and time slot are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/appointments', {
        patient_id: parseInt(selectedPatientId, 10),
        doctor_id: parseInt(selectedDoctorId, 10),
        department,
        appointment_date: appointmentDate,
        time_slot: timeSlot,
        reason_for_visit: reasonForVisit || null,
      });

      success('Outpatient appointment scheduled successfully.');
      setIsScheduleOpen(false);
      setSelectedPatientId('');
      setSelectedDoctorId('');
      setReasonForVisit('');
      fetchAppointments();
    } catch (err: any) {
      error(err.message || 'Failed to schedule appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notice on Emergency queue segregation */}
      <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 text-indigo-900 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Clinical Safety Guarantee:</strong> Outpatient appointments run on a scheduled queue and never preempt or delay the Emergency Priority queue.
          </span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Date:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-indigo-600 hover:underline cursor-pointer"
            >
              Clear Date
            </button>
          )}
        </div>

        <button
          onClick={() => setIsScheduleOpen(true)}
          className="flex items-center gap-1 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Appointment</span>
        </button>
      </div>

      {/* Appointments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Outpatient Consultations Roster</h3>
            <p className="text-[11px] text-slate-500">Track and manage scheduled patient appointments</p>
          </div>
          <span className="text-xs font-mono text-slate-500">{appointments.length} appointment(s)</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">No appointments found matching filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Appt #</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Doctor & Specialty</th>
                  <th className="px-4 py-3">Date & Slot</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-indigo-700">{apt.appointment_number}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-slate-900 text-xs">{apt.patient_name}</span>
                      <p className="font-mono text-[10px] text-slate-500 mt-0.5">{apt.patient_code}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-slate-800">Dr. {apt.doctor_name}</span>
                      <p className="text-[11px] text-indigo-600 mt-0.5">{apt.doctor_specialization}</p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs">
                      <span className="font-bold text-slate-800">{apt.appointment_date}</span>
                      <p className="text-slate-500 text-[11px]">{apt.time_slot}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-[200px] truncate">
                      {apt.reason_for_visit || 'Routine Consultation'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          apt.status === 'Confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : apt.status === 'Scheduled'
                            ? 'bg-indigo-100 text-indigo-800'
                            : apt.status === 'Completed'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {apt.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {apt.status === 'Scheduled' && (
                          <button
                            onClick={() => handleStatusUpdate(apt.id, 'Confirmed')}
                            className="px-2 py-1 text-[11px] font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                          >
                            Confirm
                          </button>
                        )}
                        {(apt.status === 'Scheduled' || apt.status === 'Confirmed') && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(apt.id, 'Completed')}
                              className="px-2 py-1 text-[11px] font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(apt.id, 'Cancelled')}
                              className="px-2 py-1 text-[11px] font-semibold rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      <Modal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        title="Schedule Outpatient Appointment"
        subtitle="Book physician slot for routine consultations"
        maxWidth="md"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Patient *
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
                  {p.full_name} ({p.patient_id}) - {p.phone}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Doctor *
            </label>
            <select
              required
              value={selectedDoctorId}
              onChange={(e) => {
                setSelectedDoctorId(e.target.value);
                const doc = doctors.find((d) => String(d.id) === e.target.value);
                if (doc) setDepartment(doc.department);
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="">-- Choose Doctor --</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.full_name} ({d.specialization} - {d.department})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Appointment Date *</label>
              <input
                type="date"
                required
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Time Slot *</label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
              >
                <option value="09:00 AM">09:00 AM</option>
                <option value="09:30 AM">09:30 AM</option>
                <option value="10:00 AM">10:00 AM</option>
                <option value="10:30 AM">10:30 AM</option>
                <option value="11:00 AM">11:00 AM</option>
                <option value="11:30 AM">11:30 AM</option>
                <option value="02:00 PM">02:00 PM</option>
                <option value="02:30 PM">02:30 PM</option>
                <option value="03:00 PM">03:00 PM</option>
                <option value="03:30 PM">03:30 PM</option>
                <option value="04:00 PM">04:00 PM</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Reason for Visit</label>
            <input
              type="text"
              placeholder="e.g. Follow-up on blood pressure titration, chest pain review..."
              value={reasonForVisit}
              onChange={(e) => setReasonForVisit(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsScheduleOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
            >
              {isSubmitting ? 'Booking...' : 'Confirm Appointment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

