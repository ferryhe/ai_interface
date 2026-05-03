import type { CSSProperties } from "react";

export const colors = {
  bg: "#0b0f14",
  surface: "#101720",
  surfaceAlt: "#151d28",
  surfaceRaised: "#1b2430",
  border: "#263241",
  borderStrong: "#344456",
  text: "#eef4fb",
  muted: "#8d9bad",
  faint: "#5d6a7a",
  orange: "#f97316",
  blue: "#4f9cff",
  green: "#35d07f",
  yellow: "#f2c94c",
  red: "#ff6b6b",
  violet: "#a78bfa",
  cyan: "#33c6d8",
};

export const fontFamily =
  "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const monoFamily =
  "'Fira Code', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace";

export const focusRing = `0 0 0 2px ${colors.blue}44`;

export const panel: CSSProperties = {
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
};

export const toolbarButton: CSSProperties = {
  height: 32,
  borderRadius: 6,
  border: `1px solid ${colors.border}`,
  background: colors.surfaceAlt,
  color: colors.text,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  padding: "0 10px",
  fontFamily,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export function statusColor(state: "good" | "warn" | "neutral"): string {
  if (state === "good") return colors.green;
  if (state === "warn") return colors.yellow;
  return colors.blue;
}
