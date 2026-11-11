import React, { useState } from 'react';
import { HeartPulse, Lock, User, ShieldCheck, ArrowRight, Stethoscope, Truck, Receipt } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const LoginView: React.FC = () => {
  const { login, quickLogin, demoUsers } = useAuth();
  const { error, success } = useToast();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      error('Please enter your username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
      success('Logged in successfully to MediFlow.');
    } catch (err: any) {
      error(err.message || 'Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemo = async (demoUsername: string, label: string) => {
    setIsSubmitting(true);
    try {
      await quickLogin(demoUsername);
      success(`Signed in as ${label}`);
    } catch (err: any) {
      error(err.message || 'Quick login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleIcons: Record<string, any> = {
    admin: ShieldCheck,
    doctor: Stethoscope,
    nurse: HeartPulse,
    receptionist: Receipt,
    ambulance: Truck,
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white mx-auto shadow-md shadow-indigo-600/30">
          <HeartPulse className="w-7 h-7" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">MediFlow</h2>
        <p className="text-xs text-slate-400 mt-1">
          Smart Hospital & Emergency Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="admin / dr.ananya / nurse.sarah"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 mt-2"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In to Hospital Portal'}
            </button>
          </form>

          {/* Quick Demo Accounts Selection */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">
              Quick 1-Click Demo Login
            </p>
            <div className="space-y-2">
              {demoUsers.map((d) => {
                const Icon = roleIcons[d.role] || ShieldCheck;
                return (
                  <button
                    key={d.username}
                    type="button"
                    onClick={() => handleQuickDemo(d.username, d.label)}
                    disabled={isSubmitting}
                    className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 flex items-center justify-between text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-slate-100 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-700">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{d.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {d.label} • <span className="font-mono">@{d.username}</span>
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

