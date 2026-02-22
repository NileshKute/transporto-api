import { AlertTriangle, AlertCircle, Info, CheckCircle, LucideIcon } from 'lucide-react';

type AlertType = 'warning' | 'danger' | 'info' | 'success';

const typeMap: Record<AlertType, { border: string; bg: string; icon: LucideIcon; iconClass: string }> = {
  warning: { border: 'border-l-amber-500', bg: 'bg-amber-50', icon: AlertTriangle, iconClass: 'text-amber-600' },
  danger:  { border: 'border-l-red-500',  bg: 'bg-red-50',  icon: AlertCircle,  iconClass: 'text-red-600' },
  info:    { border: 'border-l-blue-500', bg: 'bg-blue-50',    icon: Info,        iconClass: 'text-blue-600' },
  success: { border: 'border-l-emerald-500', bg: 'bg-emerald-50', icon: CheckCircle, iconClass: 'text-emerald-600' },
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
    <div className={`w-full rounded-xl border border-[#e2e8f0] border-l-4 ${config.border} ${config.bg} p-4 flex items-center justify-between gap-4 flex-wrap`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconClass}`} />
        <div>
          <p className="font-semibold text-[#0f172a]">{title}</p>
          {message && <p className="text-sm text-[#475569] mt-0.5">{message}</p>}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm font-semibold text-[#2563eb] hover:text-[#1d4ed8] whitespace-nowrap"
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}
