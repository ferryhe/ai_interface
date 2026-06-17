import type { CSSProperties } from "react";

export const colors = {
  bg: "var(--agent-bg, #0b0f14)",
  surface: "var(--agent-surface, #101720)",
  surfaceAlt: "var(--agent-surface-alt, #151d28)",
  surfaceRaised: "var(--agent-surface-raised, #1b2430)",
  border: "var(--agent-border, #263241)",
  borderStrong: "var(--agent-border-strong, #344456)",
  text: "var(--agent-text, #eef4fb)",
  muted: "var(--agent-muted, #8d9bad)",
  faint: "var(--agent-faint, #5d6a7a)",
  orange: "var(--agent-orange, #f97316)",
  blue: "var(--agent-blue, #4f9cff)",
  green: "var(--agent-green, #35d07f)",
  yellow: "var(--agent-yellow, #f2c94c)",
  red: "var(--agent-red, #ff6b6b)",
  violet: "var(--agent-violet, #a78bfa)",
  cyan: "var(--agent-cyan, #33c6d8)",
};

export const fontFamily =
  "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const monoFamily =
  "'Fira Code', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace";

export const focusRing = `0 0 0 2px color-mix(in srgb, ${colors.blue} 28%, transparent)`;

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

export function workbenchStatusColor(status: string): string {
  if (status === "ready" || status === "succeeded") return colors.green;
  if (
    status === "running" ||
    status === "approval_required" ||
    status === "waiting_for_user" ||
    status === "waiting_for_data"
  ) {
    return colors.yellow;
  }
  if (
    status === "failed" ||
    status === "blocked" ||
    status === "cancelled" ||
    status === "missing_skills"
  ) {
    return colors.red;
  }
  return colors.blue;
}
