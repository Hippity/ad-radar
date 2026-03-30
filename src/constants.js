export const C = {
  bg: "#0d0d0f",
  surface: "#16161a",
  surfaceHover: "#1e1e24",
  border: "#2a2a32",
  borderLight: "#3a3a44",
  text: "#e8e8f0",
  muted: "#6b6b7e",
  faint: "#2e2e38",
  google: "#4285f4",
  googleBg: "#1a2744",
  googleText: "#7db3ff",
  meta: "#0866ff",
  metaBg: "#0e1e3a",
  metaText: "#8bb6ff",
  active: "#00d4a0",
  activeBg: "#0a2620",
  activeText: "#00d4a0",
  inactiveBg: "#1a1a21",
  inactiveText: "#6b6b7e",
  accent: "#7c5cfc",
  accentGlow: "rgba(124,92,252,0.15)",
  warn: "#f5a623",
  danger: "#ff4d4d",
  cardGlow: "rgba(0,0,0,0.25)",
};

export const DEFAULT_COMPETITORS = [
  { id: 1, name: "Turkish Airlines", website: "", searchTerm: "" },
  { id: 2, name: "Oman Air", website: "", searchTerm: "" },
];

export const DEFAULT_START_DATE = "2026-03-23";
export const DEFAULT_END_DATE = "2026-03-29";

export const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.text,
  fontSize: 13,
  outline: "none",
};

export const btnStyle = (variant) => {
  if (variant === "primary") {
    return {
      padding: "10px 20px",
      background: C.accent,
      border: "none",
      borderRadius: 8,
      color: "#fff",
      fontWeight: 600,
      fontSize: 14,
      cursor: "pointer",
    };
  }

  if (variant === "scan") {
    return {
      padding: "9px 20px",
      background: C.accent,
      border: "none",
      borderRadius: 8,
      color: "#fff",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 6,
    };
  }

  return {
    padding: "8px 14px",
    background: "transparent",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.muted,
    fontSize: 13,
    cursor: "pointer",
  };
};
