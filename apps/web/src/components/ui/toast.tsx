'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastAPI {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastAPI | null>(null);

// ---------------------------------------------------------------------------
// Internal toast card
// ---------------------------------------------------------------------------

const STYLES: Record<ToastType, { bar: string; icon: string; bg: string; text: string }> = {
  success: {
    bar:  'bg-emerald-500',
    icon: 'text-emerald-500',
    bg:   'bg-white border-emerald-200',
    text: 'text-slate-800',
  },
  error: {
    bar:  'bg-red-500',
    icon: 'text-red-500',
    bg:   'bg-white border-red-200',
    text: 'text-slate-800',
  },
  warning: {
    bar:  'bg-amber-500',
    icon: 'text-amber-500',
    bg:   'bg-white border-amber-200',
    text: 'text-slate-800',
  },
  info: {
    bar:  'bg-blue-500',
    icon: 'text-blue-500',
    bg:   'bg-white border-blue-200',
    text: 'text-slate-800',
  },
};

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
};

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const s = STYLES[toast.type];
  const Icon = ICONS[toast.type];

  return (
    <div
      className={`relative flex items-start gap-3 w-full rounded-xl border shadow-lg px-4 py-3 ${s.bg} animate-in slide-in-from-right-5 duration-200`}
    >
      {/* colored left bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${s.bar}`} />

      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${s.icon}`} />

      <p className={`flex-1 text-sm leading-snug ${s.text}`}>{toast.message}</p>

      <button
        onClick={onClose}
        className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const DURATION = 4500; // ms

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (type: ToastType, message: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => remove(id), DURATION);
    },
    [remove],
  );

  const api: ToastAPI = {
    success: (msg) => add('success', msg),
    error:   (msg) => add('error', msg),
    warning: (msg) => add('warning', msg),
    info:    (msg) => add('info', msg),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toast container — bottom-right, above everything */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} onClose={() => remove(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
