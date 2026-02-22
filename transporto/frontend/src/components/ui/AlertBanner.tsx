import { AlertTriangle, AlertCircle, Info, CheckCircle, LucideIcon } from 'lucide-react';

type AlertType = 'warning' | 'danger' | 'info' | 'success';

const typeMap: Record<AlertType, { border: string; bg: string; icon: LucideIcon; iconClass: string }> = {
  warning: { border: 'border-l-amber-500', bg: 'bg-[var(--warning-bg)]', icon: AlertTriangle, iconClass: 'text-[var(--warning)]' },
  danger:  { border: 'border-l-red-500',  bg: 'bg-[var(--danger-bg)]',  icon: AlertCircle,  iconClass: 'text-[var(--danger)]' },
  info:    { border: 'border-l-blue-500', bg: 'bg-[var(--info-bg)]',    icon: Info,        iconClass: 'text-[var(--info)]' },
  success: { border: 'border-l-emerald-500', bg: 'bg-[var(--success-bg)]', icon: CheckCircle, iconClass: 'text-[var(--success)]' },
};

interface AlertBannerProps {
  type: AlertType;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

export function AlertBanner({ type, title, message, action }: AlertBannerProps) {
  const config = typeMap[type];
  const Icon = config.icon;
  return (
    <div className={`w-full rounded-xl border border-[var(--border-light)] border-l-4 ${config.border} ${config.bg} p-4 flex items-center justify-between gap-4 flex-wrap`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconClass}`} />
        <div>
          <p className="font-semibold text-[var(--text-primary)]">{title}</p>
          {message && <p className="text-sm text-[var(--text-secondary)] mt-0.5">{message}</p>}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm font-semibold text-[var(--primary-600)] hover:text-[var(--primary-700)] whitespace-nowrap"
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}
