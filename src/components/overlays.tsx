import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X } from 'lucide-react';

/* ---------- Side drawer ---------- */

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea, summary, [tabindex]:not([tabindex="-1"])';

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      const panel = panelRef.current;
      if (e.key !== 'Tab' || !panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      // Keep focus inside the dialog, including when it sits on the panel itself.
      if (!panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      returnFocus.current?.focus();
    };
  }, [open, onClose]);

  return createPortal(
    <div className={`drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="drawer__scrim" onClick={onClose} />
      <div ref={panelRef} className="drawer__panel" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} inert={!open}>
        <div className="drawer__head">
          <h2 className="drawer__title pixel">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div className="drawer__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Toast ---------- */

export interface ToastMessage {
  message: string;
  tone?: 'neutral' | 'error';
  action?: { label: string; onClick: () => void };
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  /** Reports hover/focus so the parent can pause the auto-dismiss timer. */
  onHold: (held: boolean) => void;
}

export function Toast({ toast, onDismiss, onHold }: ToastProps) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div
          className={`toast toast--${toast.tone ?? 'neutral'}`}
          key={toast.message}
          onMouseEnter={() => onHold(true)}
          onMouseLeave={() => onHold(false)}
          onFocus={() => onHold(true)}
          onBlur={() => onHold(false)}
        >
          <span className="toast__dot" aria-hidden="true" />
          <span className="toast__text">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                toast.action?.onClick();
                onDismiss();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Drop overlay ---------- */

export function DropOverlay({ visible }: { visible: boolean }) {
  return (
    <div className={`drop ${visible ? 'is-visible' : ''}`} aria-hidden="true">
      <div className="drop__frame">
        <Upload size={28} strokeWidth={1.5} />
        <p className="drop__title pixel">Déposez votre relevé</p>
        <p className="drop__hint">Excel ou CSV · lu dans ce navigateur, il n’est envoyé nulle part</p>
      </div>
    </div>
  );
}
