/**
 * @tepisawah/ui — modal component.
 *
 * Full-page-blocking overlay. `Dialog` is the narrow confirmation variant;
 * this one is for arbitrary content such as forms and detail panels.
 *
 * Focus is moved to the panel on open and returned on close. The document
 * scroll lock is applied while mounted.
 */

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { CloseIcon } from "../icons/index.js";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Renders without the built-in close button. */
  hideCloseButton?: boolean;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  hideCloseButton = false,
  className,
}: ModalProps): ReactNode {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    const documentElement = document.documentElement;
    const previousOverflow = documentElement.style.overflow;
    documentElement.style.overflow = "hidden";

    return () => {
      documentElement.style.overflow = previousOverflow;
      previousActive?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={["ui-modal", className ?? ""].filter(Boolean).join(" ")}
      role="presentation"
    >
      <div className="ui-modal__backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        aria-describedby={description ? "ui-modal-description" : undefined}
        tabIndex={-1}
        className="ui-modal__panel"
      >
        {title ?? (!hideCloseButton && true) ? (
          <header className="ui-modal__header">
            <div className="ui-modal__heading">
              {title ? <h2 className="ui-modal__title">{title}</h2> : null}
              {description ? (
                <p id="ui-modal-description" className="ui-modal__description">
                  {description}
                </p>
              ) : null}
            </div>
            {hideCloseButton ? null : (
              <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Close">
                <CloseIcon />
              </button>
            )}
          </header>
        ) : null}
        {children ? <div className="ui-modal__body">{children}</div> : null}
        {footer ? <footer className="ui-modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
