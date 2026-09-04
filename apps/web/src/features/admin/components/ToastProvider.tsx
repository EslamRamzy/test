'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import BootstrapToast from 'react-bootstrap/Toast';
import BootstrapToastContainer from 'react-bootstrap/ToastContainer';

/**
 * docs/architecture/07 §6: "Always explain failure" / "toast with the
 * entity name after" a destructive action — the admin's one feedback
 * channel for anything that isn't a form's own inline error. A context +
 * `useToast()` hook, not a prop threaded through every component, because
 * a toast can originate anywhere (a mutation's `onError`, a keyboard
 * shortcut, a background refresh failing) — requiring every caller to be a
 * descendant of the one place that renders `<ToastContainer>` would be a
 * worse API than "call `useToast()` from any Client Component under
 * `<ToastProvider>`."
 */
export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. `null` disables autohide — used for errors worth reading twice. */
  autohideMs?: number | null;
}

interface ToastEntry extends Required<Omit<ToastOptions, 'autohideMs'>> {
  id: number;
  autohideMs: number | null;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_AUTOHIDE_MS = 4000;

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    nextId += 1;
    const entry: ToastEntry = {
      id: nextId,
      message: options.message,
      variant: options.variant ?? 'info',
      autohideMs: options.autohideMs === undefined ? DEFAULT_AUTOHIDE_MS : options.autohideMs,
    };
    setToasts((current) => [...current, entry]);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <BootstrapToastContainer
        position="bottom-end"
        className="admin-toast-container"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <BootstrapToast
            key={toast.id}
            bg={toast.variant}
            onClose={() => dismiss(toast.id)}
            show
            autohide={toast.autohideMs !== null}
            {...(toast.autohideMs !== null ? { delay: toast.autohideMs } : {})}
          >
            <BootstrapToast.Body
              className={
                toast.variant === 'danger' || toast.variant === 'success' ? 'text-white' : undefined
              }
            >
              {toast.message}
            </BootstrapToast.Body>
          </BootstrapToast>
        ))}
      </BootstrapToastContainer>
    </ToastContext.Provider>
  );
}

/** Throws outside `<ToastProvider>` rather than silently no-op — a toast nobody can ever see is a bug, not a degraded feature. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast() must be called under <ToastProvider>');
  }
  return context;
}
