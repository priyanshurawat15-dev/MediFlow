import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  badge?: {
    text: string;
    variant: 'critical' | 'warning' | 'success' | 'neutral' | 'info';
  };
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-indigo-600',
  iconBg = 'bg-indigo-50',
  badge,
  onClick,
  className = '',
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-sm' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
            {badge && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                  badge.variant === 'critical'
                    ? 'bg-rose-100 text-rose-800'
                    : badge.variant === 'warning'
                    ? 'bg-amber-100 text-amber-800'
                    : badge.variant === 'success'
                    ? 'bg-emerald-100 text-emerald-800'
                    : badge.variant === 'info'
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {badge.text}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${iconBg} ${iconColor} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

