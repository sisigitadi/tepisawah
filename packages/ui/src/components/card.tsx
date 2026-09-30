/**
 * @tepisawah/ui — card component.
 *
 * Container surface with optional header/footer slots and an elevation token.
 */

import type { ReactNode } from "react";

export type CardElevation = "flat" | "low" | "high";

export interface CardProps {
  elevation?: CardElevation;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const elevationClasses: Record<CardElevation, string> = {
  flat: "ui-card--flat",
  low: "ui-card--low",
  high: "ui-card--high",
};

export function Card({
  elevation = "low",
  title,
  description,
  actions,
  children,
  footer,
  className,
}: CardProps): ReactNode {
  return (
    <section className={["ui-card", elevationClasses[elevation], className ?? ""].filter(Boolean).join(" ")}>
      {title ?? actions ? (
        <header className="ui-card__header">
          <div className="ui-card__heading">
            {title ? <h3 className="ui-card__title">{title}</h3> : null}
            {description ? <p className="ui-card__description">{description}</p> : null}
          </div>
          {actions ? <div className="ui-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children ? <div className="ui-card__body">{children}</div> : null}
      {footer ? <footer className="ui-card__footer">{footer}</footer> : null}
    </section>
  );
}
