/**
 * @tepisawah/ui — Stack primitive.
 *
 * Lays children out along a single axis with a tokenised gap. Prefer Stack over
 * ad-hoc flex margins so vertical rhythm stays on the spacing scale.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { type SpacingToken, spacingValue } from "../tokens/index.js";

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  direction?: "column" | "row";
  gap?: SpacingToken | number;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  wrap?: boolean;
}

export function Stack({
  children,
  direction = "column",
  gap = 4,
  align,
  justify,
  wrap = false,
  style,
  ...rest
}: StackProps): ReactNode {
  const computed: CSSProperties = {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: direction,
    gap: spacingValue(gap),
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? "wrap" : "nowrap",
    ...style,
  };

  return (
    <div style={computed} {...rest}>
      {children}
    </div>
  );
}
