/**
 * @tepisawah/ui — Text primitive.
 *
 * Applies a named text style from the typography tokens. Use `Text` for any
 * inline or block of copy instead of hand-rolling font properties.
 */

import type { HTMLAttributes, ReactNode } from "react";

import { type TextStyleToken, textStyles } from "../tokens/index.js";

export interface TextProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  variant?: TextStyleToken;
  /** Render as a block element instead of inline. */
  block?: boolean;
  /** Number of lines before ellipsis, when supported. */
  clamp?: number;
}

export function Text({
  children,
  variant = "body",
  block = false,
  clamp,
  style,
  ...rest
}: TextProps): ReactNode {
  const computed: React.CSSProperties = {
    margin: 0,
    display: block ? "block" : clamp ? "-webkit-box" : "inline",
    ...textStyles[variant],
    ...(clamp
      ? {
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: clamp,
          overflow: "hidden",
        }
      : null),
    ...style,
  };

  return (
    <span style={computed} {...rest}>
      {children}
    </span>
  );
}
