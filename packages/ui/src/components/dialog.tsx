/**
 * @tepisawah/ui — dialog component.
 *
 * Confirmation dialog built on `Modal`. Use this whenever an action can change
 * or destroy data so the intent is confirmed out-of-band from the trigger.
 */

import type { ReactNode } from "react";
import { Modal } from "./modal.js";
import { Button } from "./button.js";
import type { ButtonVariant } from "./button.js";

export interface DialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Variant of the confirm button; use `danger` for destructive actions. */
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

export function Dialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
  className,
}: DialogProps): ReactNode {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      className={["ui-dialog", className ?? ""].filter(Boolean).join(" ")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
