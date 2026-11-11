import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  UserCheck,
  ChevronDown,
  Shield,
  PlusCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onOpenRegisterEmergency?: () => void;
  criticalCasesCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onOpenRegisterEmergency,
  criticalCasesCount = 0,
}) => {
  const { user, demoUsers, quickLogin } = useAuth();
  const { success } = useToast();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [showRoleMenu, setShowRoleMenu] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSwitchRole = async (username: string, roleLabel: string) => {
    setShowRoleMenu(false);
    try {
      await quickLogin(username);
      success(`Switched role to: ${roleLabel}`);
    } catch (err: any) {
      console.error('Role switch error:', err);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Critical Emergency Alert Pill */}
        {criticalCasesCount > 0 && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold animate-pulse">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>{criticalCasesCount} Critical Case{criticalCasesCount > 1 ? 's' : ''} in Emergency</span>
          </div>
        )}

        {/* Live System Time */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{currentTime}</span>
        </div>

        {/* Quick Register Emergency Button */}
        {onOpenRegisterEmergency && (
          <button
            onClick={onOpenRegisterEmergency}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Emergency Case</span>
          </button>
        )}

        {/* Demo Role Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            title="Switch demo role for testing"
          >
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Role:</span>
            <span className="font-semibold text-slate-900 capitalize">{user?.role || 'Guest'}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in">
              <div className="px-3 py-1.5 border-b border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Test Role Switcher
                </p>
                <p className="text-[11px] text-slate-500">Switch permissions to test different modules</p>
              </div>
              <div className="py-1">
                {demoUsers.map((d) => {
                  const isCurrent = user?.username === d.username;
                  return (
                    <button
                      key={d.username}
                      onClick={() => handleSwitchRole(d.username, d.label)}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                        isCurrent ? 'bg-indigo-50/70 font-semibold text-indigo-900' : 'text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-[10px] text-slate-400">{d.label} • {d.department}</p>
                      </div>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-600 text-white font-bold">
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

