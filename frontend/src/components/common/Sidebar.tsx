import React from 'react';
import {
  LayoutDashboard,
  Users,
  Activity,
  Truck,
  Stethoscope,
  Calendar,
  BedDouble,
  UserCog,
  Receipt,
  BarChart3,
  HeartPulse,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavItemKey =
  | 'overview'
  | 'patients'
  | 'emergency'
  | 'ambulances'
  | 'doctors'
  | 'appointments'
  | 'beds'
  | 'staff'
  | 'billing'
  | 'reports';

interface SidebarProps {
  currentTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  activeEmergenciesCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeEmergenciesCount = 0,
}) => {
  const { user, logout } = useAuth();

  const navItems: { key: NavItemKey; label: string; icon: React.ElementType; badge?: number; roles?: string[] }[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'emergency', label: 'Emergency Priority', icon: Activity, badge: activeEmergenciesCount },
    { key: 'patients', label: 'Patients', icon: Users },
    { key: 'beds', label: 'Bed Management', icon: BedDouble },
    { key: 'ambulances', label: 'Ambulances', icon: Truck },
    { key: 'doctors', label: 'Doctors', icon: Stethoscope },
    { key: 'appointments', label: 'Appointments', icon: Calendar },
    { key: 'billing', label: 'Billing & Invoices', icon: Receipt },
    { key: 'staff', label: 'Staff Roster', icon: UserCog, roles: ['admin'] },
    { key: 'reports', label: 'Reports & Analytics', icon: BarChart3, roles: ['admin', 'doctor'] },
  ];

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.role);
  });

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800 bg-slate-950/40">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
          <HeartPulse className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base text-white tracking-tight">MediFlow</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              PRO
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Smart Hospital & Emergency</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
          Operations
        </div>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.key;
          const isEmergency = item.key === 'emergency';

          return (
            <button
              key={item.key}
              onClick={() => onSelectTab(item.key)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-white'
                      : isEmergency && activeEmergenciesCount > 0
                      ? 'text-rose-400 animate-pulse'
                      : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    isActive
                      ? 'bg-white text-indigo-700'
                      : 'bg-rose-500 text-white animate-pulse'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Current User Role Info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/30">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/40 border border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white uppercase">
            {user?.full_name?.substring(0, 2) || 'MF'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'Hospital Staff'}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] text-slate-400 capitalize">{user?.role}</span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

