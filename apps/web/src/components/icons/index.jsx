import { SvgIcon } from "@mui/material";

// Custom icons on the 24 px grid, 2 px strokes, rounded caps (docs/04 §6.11, §6.13).

/** Logo mark: shield + bridge arch with a saffron keystone. No emblem, flag or wheel. */
export function LogoMark({ size = 32, title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <path d="M32 4 8 12v18c0 15 10.5 25.5 24 30 13.5-4.5 24-15 24-30V12L32 4Z" fill="#003366" />
      <path
        d="M14 42h36M18 42c2-10 8-16 14-16s12 6 14 16M24 42v-7M40 42v-7"
        fill="none"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path d="M29 20h6l-1 6h-4l-1-6Z" fill="#FF6600" />
    </svg>
  );
}

/** Handpump — central to Mahodiya, used for the water-supply category (docs/04 §6.11). */
export function HandpumpIcon(props) {
  return (
    <SvgIcon {...props}>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 21h8" />
        <path d="M11 21V8h4v13" />
        <path d="M11 11H6.5a1.5 1.5 0 0 1-1.5-1.5V9" />
        <path d="M5 9v3" />
        <path d="M15 9l5-4" />
        <path d="M5 15.5c0 .8-.6 1.5-1 1.5s-1-.7-1-1.5S4 13 4 13s1 1.7 1 2.5Z" />
      </g>
    </SvgIcon>
  );
}

/** Sahayak — a diya (lamp), deliberately not a human face (docs/04 §6.8). */
export function SahayakIcon(props) {
  return (
    <SvgIcon {...props}>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 13h18c-.8 3.6-4.4 6-9 6s-8.2-2.4-9-6Z" />
        <path d="M12 3c1.6 1.8 2.4 3.3 2.4 4.6A2.4 2.4 0 0 1 12 10a2.4 2.4 0 0 1-2.4-2.4C9.6 6.3 10.4 4.8 12 3Z" />
        <path d="M9 21h6" />
      </g>
    </SvgIcon>
  );
}

/** Material Symbols "emergency" (medical asterisk) — not in @mui/icons-material v5. */
export function EmergencyIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M10 20v-4.25l-3.7 2.1-2-3.45L8 12.3 4.3 10.15l2-3.45L10 8.85V4.6h4v4.25l3.7-2.15 2 3.45L16 12.3l3.7 2.1-2 3.45-3.7-2.1V20h-4Z" />
    </SvgIcon>
  );
}
