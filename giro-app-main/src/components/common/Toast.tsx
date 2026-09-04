import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = ++toastId;
      // Substitui o array anterior para manter apenas 1 toast ativo por vez na tela
      setToasts([{ id, type, message }]);
      setTimeout(() => remove(id), 3500);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-slate-200 animate-slide-up"
          >
            {toast.type === 'success' && (
              <CheckCircle size={18} className="mt-0.5 flex-shrink-0 text-emerald-500" />
            )}
            {toast.type === 'error' && (
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-red-500" />
            )}
            {toast.type === 'info' && (
              <Info size={18} className="mt-0.5 flex-shrink-0 text-blue-500" />
            )}
            <p className="flex-1 text-sm leading-snug text-slate-700">{toast.message}</p>
            <button
              onClick={() => remove(toast.id)}
              className="flex-shrink-0 rounded-full p-0.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
              aria-label="Fechar"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}
