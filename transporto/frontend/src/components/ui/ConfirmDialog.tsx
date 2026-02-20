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
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title = 'Are you sure?', message = 'This action cannot be undone.', loading }: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="p-6 text-center">
        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
        <p className="text-slate-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-slate-300 bg-[#1a2035] hover:bg-[#243050] rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}
