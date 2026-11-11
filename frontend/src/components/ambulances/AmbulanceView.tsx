import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Phone, Navigation, MapPin, CheckCircle2, AlertCircle, Plus, RefreshCw, Radio } from 'lucide-react';
import { AmbulanceStatusBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Ambulance, AmbulanceStatus, EmergencyCase } from '../../types';

export const AmbulanceView: React.FC = () => {
  const { success, error } = useToast();

  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [emergencyCases, setEmergencyCases] = useState<EmergencyCase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Dispatch modal
  const [isDispatchOpen, setIsDispatchOpen] = useState<boolean>(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string>('');
  const [emergencyCaseId, setEmergencyCaseId] = useState<string>('');
  const [pickupLocation, setPickupLocation] = useState<string>('');
  const [callerName, setCallerName] = useState<string>('');
  const [callerPhone, setCallerPhone] = useState<string>('');
  const [dispatchNotes, setDispatchNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New ambulance form
  const [newAmb, setNewAmb] = useState({
    vehicle_number: '',
    ambulance_type: 'Advanced Life Support (ALS)',
    driver_name: '',
    driver_phone: '',
    paramedic_name: '',
    paramedic_phone: '',
    base_station: 'Main Emergency Bay',
  });

  const fetchAmbulances = useCallback(async () => {
    try {
      const res = await api.get<{ ambulances: Ambulance[] }>('/ambulances');
      setAmbulances(res.ambulances || []);

      const emgRes = await api.get<{ cases: EmergencyCase[] }>('/emergency/cases?status=Waiting');
      setEmergencyCases(emgRes.cases || []);
    } catch (err: any) {
      error(err.message || 'Failed to fetch ambulances');
    } finally {
      setIsLoading(false);
    }
  }, [error]);

  useEffect(() => {
    fetchAmbulances();
  }, [fetchAmbulances]);

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmbulanceId || !pickupLocation.trim()) {
      error('Ambulance and pickup location are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/ambulances/dispatch', {
        ambulance_id: parseInt(selectedAmbulanceId, 10),
        emergency_case_id: emergencyCaseId ? parseInt(emergencyCaseId, 10) : null,
        pickup_location: pickupLocation.trim(),
        caller_name: callerName.trim() || null,
        caller_phone: callerPhone.trim() || null,
        notes: dispatchNotes.trim() || null,
      });

      success('Ambulance dispatched successfully.');
      setIsDispatchOpen(false);
      fetchAmbulances();
    } catch (err: any) {
      error(err.message || 'Failed to dispatch ambulance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdvanceStatus = async (ambulance: Ambulance, nextStatus: AmbulanceStatus) => {
    try {
      await api.patch(`/ambulances/${ambulance.id}/status`, { status: nextStatus });
      success(`Ambulance ${ambulance.vehicle_number} transitioned to ${nextStatus}.`);
      fetchAmbulances();
    } catch (err: any) {
      error(err.message || 'Failed to update ambulance status');
    }
  };

  const handleRegisterAmbulance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/ambulances', newAmb);
      success(`Ambulance ${newAmb.vehicle_number} added to rapid response fleet.`);
      setIsRegisterOpen(false);
      setNewAmb({
        vehicle_number: '',
        ambulance_type: 'Advanced Life Support (ALS)',
        driver_name: '',
        driver_phone: '',
        paramedic_name: '',
        paramedic_phone: '',
        base_station: 'Main Emergency Bay',
      });
      fetchAmbulances();
    } catch (err: any) {
      error(err.message || 'Failed to add ambulance');
    }
  };

  const availableAmbulances = ambulances.filter((a) => a.status === 'Available');
  const activeMissions = ambulances.filter((a) => ['Dispatched', 'On the Way', 'Arrived', 'Returning'].includes(a.status));

  return (
    <div className="space-y-6">
      {/* Top Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total EMS Fleet</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{ambulances.length}</span>
            <span className="text-xs text-slate-500">units</span>
          </div>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Available at Bay</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-900">{availableAmbulances.length}</span>
            <span className="text-xs text-emerald-700 font-medium">ready for dispatch</span>
          </div>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200">
          <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">Active Missions</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-900">{activeMissions.length}</span>
            <span className="text-xs text-rose-700 font-medium">dispatched / en route</span>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fleet Base Station</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-sm font-bold text-slate-800">Hospital Bay 1</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Rapid Response Unit</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-600" />
            <span>Emergency Ambulance Dispatch & Tracking</span>
          </h3>
          <p className="text-[11px] text-slate-500">
            Real-time ambulance availability, mission tracking, and simulated telemetry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
          >
            Add Ambulance
          </button>
          <button
            onClick={() => {
              setSelectedAmbulanceId(availableAmbulances[0] ? String(availableAmbulances[0].id) : '');
              setIsDispatchOpen(true);
            }}
            disabled={availableAmbulances.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Dispatch Ambulance</span>
          </button>
        </div>
      </div>

      {/* Simulated Map & Active Missions Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Simulation Panel */}
        <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                <span>Simulated EMS Geo-Tracker</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
                Simulation Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Metro area telemetry visualization (Base: Hospital Emergency Bay).
            </p>

            {/* Simulated Vector Map Graphics */}
            <div className="w-full h-52 bg-slate-900 rounded-lg relative overflow-hidden border border-slate-800 p-3 select-none">
              {/* Grid Lines */}
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]"></div>

              {/* Hospital Base Pin */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] ring-4 ring-indigo-500/30">
                  H
                </div>
                <span className="text-[9px] font-bold text-slate-200 mt-0.5 bg-slate-950/80 px-1 rounded">
                  MediFlow Base
                </span>
              </div>

              {/* Active Vehicles Markers */}
              {ambulances.map((amb, idx) => {
                const isDispatched = amb.status !== 'Available' && amb.status !== 'Under Maintenance';
                // Deterministic simulated screen positions based on index
                const positions = [
                  { top: '25%', left: '70%' },
                  { top: '75%', left: '30%' },
                  { top: '30%', left: '25%' },
                  { top: '65%', left: '75%' },
                  { top: '80%', left: '60%' },
                ];
                const pos = positions[idx % positions.length];

                return (
                  <div key={amb.id} style={pos} className="absolute flex flex-col items-center">
                    {isDispatched && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                    )}
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold shadow-md ${
                        isDispatched ? 'bg-rose-600' : 'bg-emerald-600'
                      }`}
                      title={`${amb.vehicle_number} (${amb.status})`}
                    >
                      🚑
                    </div>
                    <span className="text-[8px] font-mono font-semibold text-slate-300 mt-0.5 bg-slate-950/90 px-1 rounded truncate max-w-[80px]">
                      {amb.vehicle_number}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Base Idle
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> En Route Mission
            </span>
            <span className="text-slate-400">Bangalore Zone</span>
          </div>
        </div>

        {/* Fleet Grid & Status Workflow Progression */}
        <div className="lg:col-span-2 space-y-3">
          {ambulances.map((amb) => {
            const isAvailable = amb.status === 'Available';
            const isDispatched = amb.status === 'Dispatched';
            const isOnTheWay = amb.status === 'On the Way';
            const isArrived = amb.status === 'Arrived';
            const isReturning = amb.status === 'Returning';

            return (
              <div
                key={amb.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900">{amb.vehicle_number}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {amb.ambulance_type}
                      </span>
                      <AmbulanceStatusBadge status={amb.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>Driver: <strong className="text-slate-700">{amb.driver_name}</strong> ({amb.driver_phone})</span>
                      {amb.paramedic_name && <span>Paramedic: {amb.paramedic_name}</span>}
                    </div>
                  </div>

                  {/* Active Mission Details */}
                  {!isAvailable && amb.status !== 'Under Maintenance' && (
                    <div className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Destination</span>
                      <span className="font-semibold text-slate-800">{amb.current_location_name}</span>
                      {amb.active_caller && (
                        <p className="text-[11px] text-slate-500 mt-0.5">Caller: {amb.active_caller} ({amb.active_phone})</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Workflow Status Progression Stepper */}
                {!isAvailable && amb.status !== 'Under Maintenance' && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 font-medium">Mission Workflow:</span>
                      {isDispatched && (
                        <button
                          onClick={() => handleAdvanceStatus(amb, 'On the Way')}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                        >
                          Mark 'On the Way' ➔
                        </button>
                      )}
                      {isOnTheWay && (
                        <button
                          onClick={() => handleAdvanceStatus(amb, 'Arrived')}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                        >
                          Mark 'Arrived at Scene' ➔
                        </button>
                      )}
                      {isArrived && (
                        <button
                          onClick={() => handleAdvanceStatus(amb, 'Returning')}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
                        >
                          Patient Picked Up (Returning to Hospital) ➔
                        </button>
                      )}
                      {isReturning && (
                        <button
                          onClick={() => handleAdvanceStatus(amb, 'Available')}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                        >
                          Complete Handover (Mark Available) ✓
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleAdvanceStatus(amb, 'Available')}
                      className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer"
                    >
                      Reset Mission
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dispatch Ambulance Modal */}
      <Modal
        isOpen={isDispatchOpen}
        onClose={() => setIsDispatchOpen(false)}
        title="Dispatch Emergency Ambulance"
        subtitle="Rapid EMS Mission Assignment & Coordinate Routing"
        maxWidth="md"
      >
        <form onSubmit={handleDispatchSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Available Ambulance *
            </label>
            <select
              required
              value={selectedAmbulanceId}
              onChange={(e) => setSelectedAmbulanceId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="">-- Choose Available Unit --</option>
              {availableAmbulances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.vehicle_number} — {a.ambulance_type} (Driver: {a.driver_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Link with Emergency Waiting Case (Optional)
            </label>
            <select
              value={emergencyCaseId}
              onChange={(e) => setEmergencyCaseId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="">-- Standalone EMS Pickup / Routine --</option>
              {emergencyCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_code} — {c.patient_name} ({c.triage_priority}: {c.emergency_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Pickup Location / Incident Address *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Indiranagar 100ft Road, Metro Station Gate 2"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Caller Name</label>
              <input
                type="text"
                placeholder="Name of caller"
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Caller Phone</label>
              <input
                type="text"
                placeholder="+91..."
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mission Notes / Triage Instructions</label>
            <textarea
              rows={2}
              placeholder="Suspected cardiac symptoms, stretcher required, oxygen support..."
              value={dispatchNotes}
              onChange={(e) => setDispatchNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsDispatchOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Dispatching...' : 'Confirm Dispatch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Ambulance Modal */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Add Emergency Ambulance"
        subtitle="Register new vehicle in hospital fleet"
        maxWidth="md"
      >
        <form onSubmit={handleRegisterAmbulance} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle License Number *</label>
            <input
              type="text"
              required
              placeholder="e.g. KA-01-EMS-108"
              value={newAmb.vehicle_number}
              onChange={(e) => setNewAmb({ ...newAmb, vehicle_number: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Ambulance Type *</label>
            <select
              value={newAmb.ambulance_type}
              onChange={(e) => setNewAmb({ ...newAmb, ambulance_type: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="Advanced Life Support (ALS)">Advanced Life Support (ALS)</option>
              <option value="Basic Life Support (BLS)">Basic Life Support (BLS)</option>
              <option value="ICU Mobile Unit">ICU Mobile Unit</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Driver Name *</label>
              <input
                type="text"
                required
                value={newAmb.driver_name}
                onChange={(e) => setNewAmb({ ...newAmb, driver_name: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Driver Contact *</label>
              <input
                type="text"
                required
                value={newAmb.driver_phone}
                onChange={(e) => setNewAmb({ ...newAmb, driver_phone: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Paramedic / EMT Name</label>
              <input
                type="text"
                value={newAmb.paramedic_name}
                onChange={(e) => setNewAmb({ ...newAmb, paramedic_name: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Paramedic Contact</label>
              <input
                type="text"
                value={newAmb.paramedic_phone}
                onChange={(e) => setNewAmb({ ...newAmb, paramedic_phone: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Base Station</label>
            <input
              type="text"
              value={newAmb.base_station}
              onChange={(e) => setNewAmb({ ...newAmb, base_station: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsRegisterOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
            >
              Register Unit
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

