'use client';
import { Modal } from './Modal';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  loading?: boolean;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  loading,
  confirmLabel = 'Delete',
  variant = 'danger',
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="p-6 text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${isDanger ? 'bg-red-50' : 'bg-blue-50'}`}>
          <AlertTriangle className={`w-6 h-6 ${isDanger ? 'text-red-600' : 'text-blue-600'}`} />
        </div>
        <h3 className="text-lg font-semibold text-[#0f172a] mb-2">{title}</h3>
        <p className="text-[#475569] text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-[#475569] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 text-sm font-medium text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#2563eb] hover:bg-[#1d4ed8]'
            }`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
