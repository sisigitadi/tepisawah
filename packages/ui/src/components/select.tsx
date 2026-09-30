/**
 * @tepisawah/ui — select component.
 *
 * Native select wrapper so mobile keyboards and assistive technology keep
 * first-class support.
 */

import { forwardRef } from "react";
import type { SelectHTMLAttributes, ReactNode } from "react";
import { ChevronDownIcon } from "../icons/chevron-down.js";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, placeholder, id, className, required, ...props },
  ref,
): ReactNode {
  const selectId = id ?? props.name;
  const describedBy = error
    ? `${selectId}--error`
    : hint
      ? `${selectId}--hint`
      : undefined;

  return (
    <div className="ui-select">
      {label ? (
        <label className="ui-select__label" htmlFor={selectId}>
          {label}
          {required ? <span className="ui-select__required" aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      <div className="ui-select__wrapper">
        <select
          ref={ref}
          id={selectId}
          className={["ui-select__field", error ? "ui-select__field--error" : "", className ?? ""]
            .filter(Boolean)
            .join(" ")}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="ui-select__icon" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </div>
      {error ? (
        <p className="ui-select__error" id={`${selectId}--error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="ui-select__hint" id={`${selectId}--hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});
