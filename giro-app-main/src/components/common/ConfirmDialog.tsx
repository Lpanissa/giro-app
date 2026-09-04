import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#18181b] p-6 shadow-2xl animate-scale-in text-slate-100">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
          <AlertTriangle size={22} />
        </div>
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{message}</p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/60 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700/80"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white shadow-md shadow-rose-900/20 transition hover:bg-rose-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}