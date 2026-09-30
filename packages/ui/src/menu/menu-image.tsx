/**
 * @tepisawah/ui — menu illustration component.
 *
 * One flat-style illustration per canonical menu item, drawn with the brand
 * palette so every app (web, order, POS, kitchen, waiter) shows identical
 * artwork. Rendered as inline SVG so there are no broken image paths.
 */
import type { ReactNode, SVGProps } from "react";
import { getMenuItem } from "./menu-data.js";

export interface MenuImageProps extends SVGProps<SVGSVGElement> {
  id: string;
}

function Scene({
  hue,
  children,
}: {
  hue: string;
  children: ReactNode;
}): ReactNode {
  const stops = hue
    .replace("linear-gradient(140deg,", "")
    .replace(")", "")
    .split(",");
  const from = stops[0] ?? "#2E6B34";
  const to = stops[1] ?? "#183A1D";
  return (
    <>
      <rect width="480" height="360" fill="url(#mg-grad)" />
      <circle cx="240" cy="200" r="134" fill="#FEFAE0" opacity="0.14" />
      {children}
      <defs>
        <linearGradient id="mg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from.trim()} />
          <stop offset="1" stopColor={to.trim()} />
        </linearGradient>
      </defs>
    </>
  );
}

function plate(): ReactNode {
  return (
    <g>
      <ellipse cx="240" cy="228" rx="132" ry="98" fill="#FEFAE0" />
      <ellipse cx="240" cy="220" rx="114" ry="84" fill="#F8F4DB" />
      <ellipse cx="240" cy="220" rx="78" ry="56" fill="#FFFDF4" />
    </g>
  );
}

function steam(): ReactNode {
  return (
    <g
      stroke="#FEFAE0"
      strokeWidth="7"
      strokeLinecap="round"
      opacity="0.55"
      fill="none"
    >
      <path d="M192 128c0-18 16-18 16-36" />
      <path d="M240 116c0-18 16-18 16-36" />
      <path d="M288 128c0-18 16-18 16-36" />
    </g>
  );
}

const ARTWORK: Record<string, (hue: string) => ReactNode> = {
  "chicken-roaster": (hue) => (
    <Scene hue={hue}>
      {plate()}
      <g>
        <ellipse cx="240" cy="204" rx="64" ry="46" fill="#C98A45" />
        <ellipse cx="240" cy="196" rx="56" ry="38" fill="#E0A75A" />
        <path
          d="M186 176c-16 10-18 34-4 46 12-10 14-32 4-46z"
          fill="#A96B2E"
        />
        <path
          d="M294 176c16 10 18 34 4 46-12-10-14-32-4-46z"
          fill="#A96B2E"
        />
        <ellipse cx="212" cy="188" rx="10" ry="7" fill="#F3C644" opacity="0.8" />
        <ellipse cx="268" cy="192" rx="9" ry="6" fill="#F3C644" opacity="0.8" />
      </g>
      {steam()}
    </Scene>
  ),
  "gurame-bakar": (hue) => (
    <Scene hue={hue}>
      {plate()}
      <path
        d="M150 210c30-42 90-54 132-30 26 15 34 34 22 44-24 20-92 22-128 8-22-8-32-14-26-22z"
        fill="#8A4A1E"
      />
      <path
        d="M158 204c28-32 82-42 118-22 20 11 26 26 16 34-22 16-84 18-116 6-16-6-24-12-18-18z"
        fill="#D98F3E"
      />
      <path d="M300 178c22-14 40-8 46 8-18 12-38 10-46-8z" fill="#8A4A1E" />
      <circle cx="268" cy="196" r="5" fill="#FEFAE0" />
      <path
        d="M196 196c14-8 30-8 42 0"
        stroke="#F3C644"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      {steam()}
    </Scene>
  ),
  "nasi-liwet": (hue) => (
    <Scene hue={hue}>
      <g>
        <path d="M128 224c0-52 50-88 112-88s112 36 112 88z" fill="#3D1F10" />
        <ellipse cx="240" cy="224" rx="112" ry="30" fill="#5B3A22" />
        <ellipse cx="240" cy="216" rx="92" ry="22" fill="#F8F4DB" />
        <ellipse cx="240" cy="212" rx="70" ry="15" fill="#F3C644" opacity="0.55" />
        <circle cx="204" cy="204" r="8" fill="#B4531F" />
        <circle cx="276" cy="206" r="8" fill="#2E6B34" />
        <circle cx="240" cy="196" r="7" fill="#8C5A2B" />
      </g>
      {steam()}
    </Scene>
  ),
  "ayam-goreng-lengkuas": (hue) => (
    <Scene hue={hue}>
      {plate()}
      <g>
        <path
          d="M168 210c-8-26 14-48 44-44 24 4 34 26 24 44z"
          fill="#D9A05B"
        />
        <path
          d="M246 214c-6-24 14-44 42-40 22 4 30 24 22 40z"
          fill="#E3B26E"
        />
        <path d="M204 224c-4-20 10-34 30-32 16 2 24 16 18 32z" fill="#C98A45" />
        <g fill="#FEFAE0" opacity="0.85">
          <rect x="180" y="182" width="12" height="6" rx="3" transform="rotate(-18 180 182)" />
          <rect x="262" y="188" width="12" height="6" rx="3" transform="rotate(14 262 188)" />
          <rect x="222" y="200" width="12" height="6" rx="3" transform="rotate(-8 222 200)" />
        </g>
      </g>
    </Scene>
  ),
  "sayur-asem": (hue) => (
    <Scene hue={hue}>
      <g>
        <path d="M132 218c0-46 48-80 108-80s108 34 108 80z" fill="#183A1D" />
        <ellipse cx="240" cy="218" rx="108" ry="28" fill="#2E6B34" />
        <ellipse cx="240" cy="210" rx="88" ry="20" fill="#5C9A4B" />
        <g fill="#9CCB7A">
          <circle cx="206" cy="202" r="9" />
          <circle cx="240" cy="196" r="10" />
          <circle cx="274" cy="204" r="9" />
          <circle cx="224" cy="212" r="7" />
          <circle cx="258" cy="212" r="7" />
        </g>
        <g fill="#F3C644" opacity="0.85">
          <circle cx="218" cy="198" r="4" />
          <circle cx="252" cy="200" r="4" />
        </g>
      </g>
      {steam()}
    </Scene>
  ),
  "karedok-leunca": (hue) => (
    <Scene hue={hue}>
      {plate()}
      <g>
        <path d="M172 214c-6-30 26-50 68-46 34 4 50 26 40 46z" fill="#6BAE4E" />
        <path d="M180 216c-4-22 22-36 56-32 26 3 38 18 30 32z" fill="#9CCB7A" />
        <g fill="#3D1F10" opacity="0.75">
          <circle cx="206" cy="200" r="6" />
          <circle cx="240" cy="192" r="6" />
          <circle cx="272" cy="202" r="6" />
          <circle cx="226" cy="210" r="5" />
          <circle cx="258" cy="210" r="5" />
        </g>
        <path
          d="M196 186c14-10 30-12 44-4"
          stroke="#F3C644"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </Scene>
  ),
  "es-kelapa": (hue) => (
    <Scene hue={hue}>
      <g>
        <path d="M176 132h128l-14 128c-2 20-100 20-100 0z" fill="#1B6E8C" />
        <path d="M180 168h120l-8 84c-2 18-96 18-96 0z" fill="#5DADE2" />
        <rect x="196" y="150" width="26" height="26" rx="4" fill="#FEFAE0" opacity="0.9" transform="rotate(12 209 163)" />
        <rect x="252" y="158" width="24" height="24" rx="4" fill="#FEFAE0" opacity="0.8" transform="rotate(-10 264 170)" />
        <rect x="226" y="190" width="26" height="26" rx="4" fill="#FEFAE0" opacity="0.85" transform="rotate(8 239 203)" />
        <rect x="288" y="108" width="10" height="120" rx="5" fill="#DDA15E" transform="rotate(14 293 168)" />
        <ellipse cx="240" cy="132" rx="64" ry="12" fill="#A8E6CF" opacity="0.9" />
      </g>
    </Scene>
  ),
  "kopi-senja": (hue) => (
    <Scene hue={hue}>
      <g>
        <path d="M180 128h120v24h-16l-10 96c-2 18-84 18-84 0l-10-96h-16z" fill="#FEFAE0" />
        <path d="M188 152h104l-8 88c-2 14-70 14-70 0z" fill="#6F3F24" />
        <path d="M188 178h104l-4 44c-2 12-62 12-62 0z" fill="#F3C644" opacity="0.85" />
        <path d="M188 196h104l-2 26c-2 10-58 10-58 0z" fill="#8B5E3C" />
        <rect x="300" y="108" width="10" height="120" rx="5" fill="#3D1F10" transform="rotate(14 305 168)" />
        <path
          d="M204 120c0-14 14-14 14-28"
          stroke="#FEFAE0"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M252 112c0-14 14-14 14-28"
          stroke="#FEFAE0"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>
    </Scene>
  ),
};

export function MenuImage({ id, ...rest }: MenuImageProps): ReactNode {
  const item = getMenuItem(id);
  const draw = ARTWORK[id];
  if (!item || !draw) return null;
  return (
    <svg
      viewBox="0 0 480 360"
      role="img"
      aria-label={`Ilustrasi ${item.name}`}
      preserveAspectRatio="xMidYMid slice"
      {...rest}
    >
      {draw(item.hue)}
    </svg>
  );
}
