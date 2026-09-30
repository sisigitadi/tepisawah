/**
 * @tepisawah/ui — text input component.
 *
 * Forwards a ref and renders an error hint for `aria-invalid` states.
 */

import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, id, className, required, ...props },
  ref,
): ReactNode {
  const inputId = id ?? props.name;
  const describedBy = error
    ? `${inputId}--error`
    : hint
      ? `${inputId}--hint`
      : undefined;

  return (
    <div className="ui-input">
      {label ? (
        <label className="ui-input__label" htmlFor={inputId}>
          {label}
          {required ? <span className="ui-input__required" aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      <div className="ui-input__wrapper">
        {leftIcon ? <span className="ui-input__icon" aria-hidden="true">{leftIcon}</span> : null}
        <input
          ref={ref}
          id={inputId}
          className={["ui-input__field", error ? "ui-input__field--error" : "", className ?? ""]
            .filter(Boolean)
            .join(" ")}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          {...props}
        />
      </div>
      {error ? (
        <p className="ui-input__error" id={`${inputId}--error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="ui-input__hint" id={`${inputId}--hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});
