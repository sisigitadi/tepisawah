/**
 * @tepisawah/ui — tabs component.
 *
 * Uncontrolled-by-props tabs: the active id is owned by the parent so router and
 * deep-link integrations stay simple. Keyboard support is limited to the arrow
 * keys per ARIA authoring practices for a manual-activation pattern.
 */

import { useCallback } from "react";
import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: ReactNode;
  /** Rendered only when active. */
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: ReadonlyArray<TabItem>;
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ items, activeId, onChange, className }: TabsProps): ReactNode {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const active = activeIndex === -1 ? null : items[activeIndex];

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const total = items.length;
      for (let step = 1; step <= total; step += 1) {
        const nextIndex = (index + direction * step + direction * total) % total;
        const candidate = items[nextIndex];
        if (candidate && !candidate.disabled) {
          onChange(candidate.id);
          return;
        }
      }
    },
    [items, onChange],
  );

  return (
    <div className={["ui-tabs", className ?? ""].filter(Boolean).join(" ")}>
      <div role="tablist" className="ui-tabs__list">
        {items.map((item, index) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`ui-tab-${item.id}`}
              aria-controls={`ui-tabpanel-${item.id}`}
              aria-selected={selected}
              disabled={item.disabled}
              className="ui-tabs__tab"
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={`ui-tabpanel-${active.id}`}
          aria-labelledby={`ui-tab-${active.id}`}
          className="ui-tabs__panel"
          tabIndex={0}
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
