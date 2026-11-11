import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Patient } from '../../types';

interface RegisterPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientToEdit?: Patient | null;
  onSuccess: () => void;
}

export const RegisterPatientModal: React.FC<RegisterPatientModalProps> = ({
  isOpen,
  onClose,
  patientToEdit,
  onSuccess,
}) => {
  const { success, error } = useToast();

  const [fullName, setFullName] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('Male');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [bloodGroup, setBloodGroup] = useState<string>('');
  const [emergencyContactName, setEmergencyContactName] = useState<string>('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>('');
  const [medicalHistory, setMedicalHistory] = useState<string>('');
  const [currentStatus, setCurrentStatus] = useState<string>('Registered');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (patientToEdit) {
      setFullName(patientToEdit.full_name);
      setAge(String(patientToEdit.age));
      setGender(patientToEdit.gender);
      setPhone(patientToEdit.phone);
      setEmail(patientToEdit.email || '');
      setAddress(patientToEdit.address || '');
      setBloodGroup(patientToEdit.blood_group || '');
      setEmergencyContactName(patientToEdit.emergency_contact_name || '');
      setEmergencyContactPhone(patientToEdit.emergency_contact_phone || '');
      setMedicalHistory(patientToEdit.medical_history || '');
      setCurrentStatus(patientToEdit.current_status || 'Registered');
    } else {
      setFullName('');
      setAge('');
      setGender('Male');
      setPhone('');
      setEmail('');
      setAddress('');
      setBloodGroup('');
      setEmergencyContactName('');
      setEmergencyContactPhone('');
      setMedicalHistory('');
      setCurrentStatus('Registered');
    }
  }, [patientToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !age || !gender || !phone.trim()) {
      error('Full name, age, gender, and phone number are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        age: parseInt(age, 10),
        gender,
        phone: phone.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        blood_group: bloodGroup || null,
        emergency_contact_name: emergencyContactName.trim() || null,
        emergency_contact_phone: emergencyContactPhone.trim() || null,
        medical_history: medicalHistory.trim() || null,
        current_status: currentStatus,
      };

      if (patientToEdit) {
        await api.put(`/patients/${patientToEdit.id}`, payload);
        success(`Patient details for ${fullName} updated successfully.`);
      } else {
        const res = await api.post<{ patient: Patient }>('/patients', payload);
        success(`Patient ${fullName} registered with ID ${res.patient.patient_id}`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to save patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={patientToEdit ? `Edit Patient: ${patientToEdit.patient_id}` : 'Register New Patient'}
      subtitle="Complete clinical and contact demographic profile"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Core Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ramesh Patil"
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
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Years"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Gender *</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Blood Group</label>
            <select
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
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
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number *</label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="patient@example.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Residential Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="City, Area, Street..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Emergency Contact</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name & Relation</label>
              <input
                type="text"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="e.g. Shalini Patil (Wife)"
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Emergency Phone</label>
              <input
                type="text"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder="+91..."
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Medical History */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Past Medical History & Known Allergies</label>
          <textarea
            rows={2}
            value={medicalHistory}
            onChange={(e) => setMedicalHistory(e.target.value)}
            placeholder="Chronic conditions (Diabetes, Hypertension), prior surgeries, drug allergies (Penicillin)..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>

        {patientToEdit && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Current Hospital Status</label>
            <select
              value={currentStatus}
              onChange={(e) => setCurrentStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="Registered">Registered (Outpatient)</option>
              <option value="Admitted">Admitted (Inpatient)</option>
              <option value="Under Emergency">Under Emergency</option>
              <option value="Discharged">Discharged</option>
            </select>
          </div>
        )}

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
            {isSubmitting ? 'Saving...' : patientToEdit ? 'Save Changes' : 'Register Patient'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

