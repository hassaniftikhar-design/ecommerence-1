'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  toast: (options: { type?: ToastType; title?: string; message: string }) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ type = 'info', title, message }: { type?: ToastType; title?: string; message: string }) => {
      const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      const newToast: ToastMessage = { id, type, title, message };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, 2000);
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (message: string, title?: string) => toast({ type: 'success', title, message }),
    [toast]
  );

  const showError = useCallback(
    (message: string, title?: string) => toast({ type: 'error', title, message }),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, showSuccess, showError }}>
      {children}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2 max-w-sm w-full px-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border text-sm font-medium transition-all duration-300 animate-in slide-in-from-right',
              t.type === 'success' && 'bg-[#22C55E] text-white border-emerald-500',
              t.type === 'error' && 'bg-red-600 text-white border-red-500',
              t.type === 'info' && 'bg-[#007BFF] text-white border-blue-500'
            )}
          >
            {t.type === 'success' && <CheckCircle2 className="h-5 w-5 text-white shrink-0 mt-0.5" />}
            {t.type === 'error' && <XCircle className="h-5 w-5 text-white shrink-0 mt-0.5" />}
            {t.type === 'info' && <AlertCircle className="h-5 w-5 text-white shrink-0 mt-0.5" />}

            <div className="flex-1">
              {t.title && <div className="font-bold mb-0.5">{t.title}</div>}
              <div className="text-xs sm:text-sm">{t.message}</div>
            </div>

            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-white/80 hover:text-white transition p-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
