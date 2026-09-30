/**
 * @tepisawah/ui — toast component.
 *
 * Toasts surface the outcome of an action that the user has already triggered
 * (order confirmed, payment captured, order printed). They are never the only
 * feedback channel: the underlying record is always updated first, and the toast
 * is a secondary signal that may be missed.
 *
 * Toasts must auto-dismiss; the only sticky state is an error that the user
 * must act on, and even then the underlying screen stays the source of truth.
 */

import { useEffect } from "react";
import type { ReactNode } from "react";
import { CloseIcon } from "../icons/index.js";

export type ToastTone = "info" | "success" | "warning" | "danger";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: ReactNode;
  description?: ReactNode;
  /** Milliseconds before auto-dismiss; `0` keeps it until dismissed. */
  duration?: number;
}

export interface ToastViewportProps {
  toasts: readonly Toast[];
  onDismiss: (id: string) => void;
  className?: string;
}

export function ToastViewport({
  toasts,
  onDismiss,
  className,
}: ToastViewportProps): ReactNode {
  return (
    <div
      className={["ui-toast-viewport", className ?? ""].filter(Boolean).join(" ")}
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}): ReactNode {
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    if (duration <= 0) return;
    const timeout = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timeout);
  }, [duration, toast.id, onDismiss]);

  return (
    <div
      role={toast.tone === "danger" || toast.tone === "warning" ? "alert" : "status"}
      aria-live={toast.tone === "danger" || toast.tone === "warning" ? "assertive" : "polite"}
      data-tone={toast.tone}
      className={`ui-toast ui-toast--${toast.tone}`}
    >
      <div className="ui-toast__content">
        <div className="ui-toast__title">{toast.title}</div>
        {toast.description ? (
          <div className="ui-toast__description">{toast.description}</div>
        ) : null}
      </div>
      <button
        type="button"
        className="ui-toast__close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
