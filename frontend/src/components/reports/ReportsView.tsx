import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Activity, Clock, BedDouble, Truck, Users, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const ReportsView: React.FC = () => {
  const { error } = useToast();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    api.get<any>('/reports/analytics')
      .then((res) => setData(res))
      .catch((err) => error(err.message || 'Failed to load analytics'))
      .finally(() => setIsLoading(false));
  }, [error]);

  if (isLoading || !data) {
    return <div className="py-20 text-center text-slate-500 text-sm">Loading hospital performance reports...</div>;
  }

  const { summary, priorityData, statusData, bedOccupancyData, ambulanceData, emergencyTypes } = data;

  const PRIORITY_COLORS: Record<string, string> = {
    Critical: '#ef4444',
    High: '#f59e0b',
    Medium: '#eab308',
    Low: '#10b981',
  };

  const PIE_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#64748b'];

  return (
    <div className="space-y-6">
      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Avg Emergency Response</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{summary.avgResponseTimeMinutes}</span>
            <span className="text-xs text-slate-500 font-medium">minutes</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">From triage arrival to doctor assigned</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <BedDouble className="w-4 h-4 text-indigo-600" />
            <span>Bed Occupancy Rate</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{summary.overallBedOccupancyRate}%</span>
            <span className="text-xs text-slate-500 font-medium">
              ({summary.occupiedBeds}/{summary.totalBeds})
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Hospital-wide inpatient load</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <Activity className="w-4 h-4 text-rose-600" />
            <span>Total Emergency Cases</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-rose-900">{summary.totalEmergencies}</span>
            <span className="text-xs text-slate-500 font-medium">admissions</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Recorded triage encounters</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Total Patients</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{summary.totalPatients}</span>
            <span className="text-xs text-slate-500 font-medium">registered</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Electronic health records</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Emergency Priority Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-600" />
            <span>Emergency Cases by Clinical Priority</span>
          </h3>
          <p className="text-[11px] text-slate-500 mb-4">Urgency distribution of arriving emergency admissions</p>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {priorityData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name] || '#4f46e5'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bed Occupancy by Category */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-indigo-600" />
            <span>Bed Occupancy Rate by Category (%)</span>
          </h3>
          <p className="text-[11px] text-slate-500 mb-4">Utilization percentage across wards and critical units</p>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bedOccupancyData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" axisLine={false} tickLine={false} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Occupancy Rate']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="occupancyRate" fill="#4f46e5" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Emergency Case Statuses */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Emergency Workflow Statuses</h3>
          <p className="text-[11px] text-slate-500 mb-4">Current state of emergency encounters</p>

          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {statusData.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Common Emergency Types */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Top Emergency Clinical Presentations</h3>
          <p className="text-[11px] text-slate-500 mb-4">Most frequent diagnoses in emergency triage</p>

          <div className="space-y-3 pt-2">
            {emergencyTypes.map((t: any) => (
              <div key={t.name} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 truncate max-w-[280px]">{t.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${Math.min(100, t.count * 25)}%` }}
                    ></div>
                  </div>
                  <span className="font-mono font-bold text-slate-700 w-6 text-right">{t.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

