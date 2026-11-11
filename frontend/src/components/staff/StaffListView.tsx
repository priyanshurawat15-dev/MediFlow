import React, { useState, useEffect, useCallback } from 'react';
import { UserCog, Plus, ShieldCheck, Mail, Phone, Lock } from 'lucide-react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { User, UserRole } from '../../types';

export const StaffListView: React.FC = () => {
  const { success, error } = useToast();

  const [staff, setStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [roleFilter, setRoleFilter] = useState<string>('All');

  // Add staff modal
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [newStaff, setNewStaff] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role: 'nurse' as UserRole,
    department: 'Emergency Triage',
    phone: '',
  });

  const fetchStaff = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'All') params.append('role', roleFilter);

      const res = await api.get<{ staff: User[] }>(`/staff?${params.toString()}`);
      setStaff(res.staff || []);
    } catch (err: any) {
      error(err.message || 'Failed to fetch staff members');
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, error]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/staff', newStaff);
      success(`Staff member ${newStaff.full_name} registered successfully.`);
      setIsAddOpen(false);
      setNewStaff({
        username: '',
        password: '',
        full_name: '',
        email: '',
        role: 'nurse',
        department: 'Emergency Triage',
        phone: '',
      });
      fetchStaff();
    } catch (err: any) {
      error(err.message || 'Failed to add staff member');
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
          <span className="text-slate-500 font-medium">Role Filter:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
          >
            <option value="All">All Roles</option>
            <option value="admin">Administrator</option>
            <option value="doctor">Doctor</option>
            <option value="nurse">Nurse / Emergency Triage</option>
            <option value="receptionist">Receptionist</option>
            <option value="ambulance">Ambulance Staff</option>
          </select>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Hospital Personnel & Roles</h3>
            <p className="text-[11px] text-slate-500">Role-based access control and hospital authorization</p>
          </div>
          <span className="text-xs font-mono text-slate-500">{staff.length} staff member(s)</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading staff members...</div>
        ) : staff.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">No staff members found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Staff Name</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-slate-900">{s.full_name}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-600">@{s.username}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          s.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : s.role === 'doctor'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : s.role === 'nurse'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : s.role === 'ambulance'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>{s.role}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{s.department || 'General Administration'}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-600">
                      {s.phone || s.email}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Staff Member"
        subtitle="Create hospital access credentials with specific role"
        maxWidth="md"
      >
        <form onSubmit={handleAddStaffSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username *</label>
              <input
                type="text"
                required
                placeholder="e.g. nurse.mary"
                value={newStaff.username}
                onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Temporary Password *</label>
              <input
                type="password"
                required
                placeholder="******"
                value={newStaff.password}
                onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Mary D'Souza, RN"
              value={newStaff.full_name}
              onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role *</label>
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as UserRole })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option value="admin">Administrator</option>
                <option value="doctor">Doctor</option>
                <option value="nurse">Nurse / Emergency Staff</option>
                <option value="receptionist">Receptionist</option>
                <option value="ambulance">Ambulance Staff</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
              <input
                type="text"
                value={newStaff.department}
                onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                placeholder="staff@mediflow.health"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="+91..."
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
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
              Create Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

