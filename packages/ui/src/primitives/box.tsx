/**
 * @tepisawah/ui — Box primitive.
 *
 * The lowest-level layout element. Every styled component in the library is
 * eventually composed from a Box so that spacing, radius and elevation tokens
 * stay consistent.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import {
  type RadiusToken,
  type ShadowToken,
  type SpacingToken,
  radii,
  shadows,
  spacingValue,
} from "../tokens/index.js";

export interface BoxProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  padding?: SpacingToken | number;
  paddingX?: SpacingToken | number;
  paddingY?: SpacingToken | number;
  radius?: RadiusToken;
  shadow?: ShadowToken;
  overflow?: CSSProperties["overflow"];
}

export function Box({
  children,
  padding,
  paddingX,
  paddingY,
  radius,
  shadow,
  overflow,
  style,
  ...rest
}: BoxProps): ReactNode {
  const computed: CSSProperties = {
    boxSizing: "border-box",
    paddingTop: paddingY !== undefined ? spacingValue(paddingY) : padding !== undefined ? spacingValue(padding) : undefined,
    paddingBottom: paddingY !== undefined ? spacingValue(paddingY) : padding !== undefined ? spacingValue(padding) : undefined,
    paddingLeft: paddingX !== undefined ? spacingValue(paddingX) : padding !== undefined ? spacingValue(padding) : undefined,
    paddingRight: paddingX !== undefined ? spacingValue(paddingX) : padding !== undefined ? spacingValue(padding) : undefined,
    borderRadius: radius ? radii[radius] : undefined,
    boxShadow: shadow ? shadows[shadow] : undefined,
    overflow,
    ...style,
  };

  return (
    <div style={computed} {...rest}>
      {children}
    </div>
  );
}
