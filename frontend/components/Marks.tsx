"use client";

/**
 * Custom inline-SVG marks for the brand system.
 * 24-grid, 1.25px stroke, rounded ends. Each mark has a tiny eccentricity
 * (an open arc, an off-center notch, a serif tail) so the set reads as a
 * hand-drawn family rather than generic UI icons.
 */

type Props = {
  size?: number;
  className?: string;
  title?: string;
};

const base = (size = 16) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
});

/** Folded-corner page with hand-ruled lines. */
export function PageMark({ size = 16, className, title }: Props) {
  return (
    <svg {...base(size)} className={className} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d="M5.5 3.5 H14 L18.5 8 V20.5 H5.5 Z" />
      <path d="M14 3.5 V8 H18.5" />
      <path d="M8 12 H16" />
      <path d="M8 15 H15" />
      <path d="M8 18 H13.5" />
    </svg>
  );
}

/** Up-arrow with a horizontal baseline — "lift to shelf". */
export function UploadMark({ size = 16, className, title }: Props) {
  return (
    <svg {...base(size)} className={className} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d="M12 16 V4.5" />
      <path d="M7 9 L12 4.5 L17 9" />
      <path d="M4 20 H20" />
    </svg>
  );
}

/** Spectacles glyph — two ovals + bridge. Reads as "look / inspect". */
export function EyeMark({ size = 16, className, title }: Props) {
  return (
    <svg {...base(size)} className={className} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <ellipse cx="7.5" cy="13" rx="3.5" ry="2.5" />
      <ellipse cx="16.5" cy="13" rx="3.5" ry="2.5" />
      <path d="M11 13 Q12 11.5 13 13" />
      <path d="M4 10.5 L5 10.5" />
      <path d="M19 10.5 L20 10.5" />
    </svg>
  );
}

/** Quill nib — "save / commit to page". */
export function QuillMark({ size = 16, className, title }: Props) {
  return (
    <svg {...base(size)} className={className} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d="M5 19 L19 5" />
      <path d="M14 5 L19 5 L19 10 L9 20 L4 20 L4 15 Z" />
      <path d="M11 11 L13 13" />
    </svg>
  );
}

/** Ribbon-tied scroll — "discard / archive". (Replaces trash can.) */
export function DiscardMark({ size = 16, className, title }: Props) {
  return (
    <svg {...base(size)} className={className} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d="M5 6 L19 6" />
      <path d="M8.5 6 V4.5 H15.5 V6" />
      <path d="M6.5 6 L7.5 20 H16.5 L17.5 6" />
      <path d="M10 10 L10 17" />
      <path d="M14 10 L14 17" />
    </svg>
  );
}

/** Serif × — close / cancel. */
export function CloseMark({ size = 16, className, title }: Props) {
  return (
    <svg {...base(size)} className={className} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d="M5.5 5.5 L18.5 18.5" />
      <path d="M18.5 5.5 L5.5 18.5" />
      <circle cx="5.5" cy="5.5" r="0.6" fill="currentColor" />
      <circle cx="18.5" cy="18.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

/** Three-quarter ring — "refresh / reload". */
export function ReloadMark({ size = 16, className, title }: Props) {
  return (
    <svg {...base(size)} className={className} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d="M19 12 A7 7 0 1 1 14 5.5" />
      <path d="M14 3 L14 6.5 L17.5 6.5" />
    </svg>
  );
}

/** Hand-drawn check inside a ring. */
export function CheckMark({ size = 16, className, title }: Props) {
  return (
    <svg {...base(size)} className={className} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.5 L11 15 L16 9" />
    </svg>
  );
}

/** Dashed ring — pending stage. */
export function PendingMark({ size = 16, className, title }: Props) {
  return (
    <svg
      {...base(size)}
      className={className}
      strokeDasharray="2 3"
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="8.5" />
    </svg>
  );
}

/** Orbiting dot — active / loading. */
export function OrbitMark({ size = 16, className, title }: Props) {
  return (
    <svg {...base(size)} className={`${className ?? ""} orbit`} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="8.5" strokeOpacity="0.3" />
      <path d="M12 3.5 A8.5 8.5 0 0 1 20.5 12" />
      <circle cx="20.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Exclamation in a ring — error. */
export function AlertMark({ size = 16, className, title }: Props) {
  return (
    <svg {...base(size)} className={className} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5 V13" />
      <circle cx="12" cy="16" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Diagonal arrow up-right — external link. */
export function OutwardMark({ size = 12, className, title }: Props) {
  return (
    <svg {...base(size)} className={className} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d="M7 17 L17 7" />
      <path d="M9 7 L17 7 L17 15" />
    </svg>
  );
}

/** Small filled diamond — used as the active-route mark in nav. */
export function DiamondMark({ size = 8, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      className={className}
      aria-hidden
    >
      <path d="M4 0.5 L7.5 4 L4 7.5 L0.5 4 Z" fill="currentColor" />
    </svg>
  );
}

/** A small custom monogram for the wordmark — paired with serif text. */
export function Monogram({ size = 28, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-hidden
    >
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" />
      {/* a tucked "J" + horizontal bar that reads as both initial and pipeline mark */}
      <path
        d="M14 12 L26 12"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M20 12 L20 24 Q20 28 16 28 Q13 28 12.5 25"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="27" cy="27" r="1.4" fill="#F4991A" />
    </svg>
  );
}
