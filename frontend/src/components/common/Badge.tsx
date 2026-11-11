import React from 'react';
import { TriagePriority, EmergencyCaseStatus, BedStatus, AmbulanceStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'success' | 'warning' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  pulse = false,
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs font-semibold' : 'px-2.5 py-1 text-xs font-semibold';

  const variantClasses = {
    critical: 'bg-rose-100 text-rose-800 border-rose-300 border',
    high: 'bg-amber-100 text-amber-800 border-amber-300 border',
    medium: 'bg-yellow-50 text-yellow-800 border-yellow-200 border',
    low: 'bg-emerald-50 text-emerald-800 border-emerald-200 border',
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200 border',
    warning: 'bg-amber-100 text-amber-800 border-amber-200 border',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200 border',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200 border',
    default: 'bg-slate-100 text-slate-800 border-slate-200 border',
  }[variant];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full tracking-wide ${sizeClasses} ${variantClasses}`}>
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
        </span>
      )}
      {children}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: TriagePriority; pulse?: boolean }> = ({ priority, pulse }) => {
  switch (priority) {
    case 'Critical':
      return (
        <Badge variant="critical" pulse={pulse ?? true}>
          Priority 1: Critical
        </Badge>
      );
    case 'High':
      return <Badge variant="high">Priority 2: High</Badge>;
    case 'Medium':
      return <Badge variant="medium">Priority 3: Medium</Badge>;
    case 'Low':
      return <Badge variant="low">Priority 4: Low</Badge>;
    default:
      return <Badge variant="neutral">{priority}</Badge>;
  }
};

export const EmergencyStatusBadge: React.FC<{ status: EmergencyCaseStatus }> = ({ status }) => {
  switch (status) {
    case 'Waiting':
      return <Badge variant="critical">Waiting</Badge>;
    case 'Assigned':
      return <Badge variant="warning">Assigned</Badge>;
    case 'Under Treatment':
      return <Badge variant="info">Under Treatment</Badge>;
    case 'Transferred':
      return <Badge variant="neutral">Transferred</Badge>;
    case 'Resolved':
      return <Badge variant="success">Resolved</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};

export const BedStatusBadge: React.FC<{ status: BedStatus }> = ({ status }) => {
  switch (status) {
    case 'Available':
      return <Badge variant="success">Available</Badge>;
    case 'Occupied':
      return <Badge variant="critical">Occupied</Badge>;
    case 'Cleaning':
      return <Badge variant="warning">Cleaning</Badge>;
    case 'Maintenance':
      return <Badge variant="neutral">Maintenance</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};

export const AmbulanceStatusBadge: React.FC<{ status: AmbulanceStatus }> = ({ status }) => {
  switch (status) {
    case 'Available':
      return <Badge variant="success">Available</Badge>;
    case 'Dispatched':
      return <Badge variant="critical">Dispatched</Badge>;
    case 'On the Way':
      return <Badge variant="high">On the Way</Badge>;
    case 'Arrived':
      return <Badge variant="info">Arrived at Scene</Badge>;
    case 'Returning':
      return <Badge variant="medium">Returning</Badge>;
    case 'Under Maintenance':
      return <Badge variant="neutral">Maintenance</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};

