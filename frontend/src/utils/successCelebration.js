export const SUCCESS_CELEBRATION_DURATION_MS = 3500;

export function celebrationInitial(name) {
  const letter = String(name || "")
    .trim()
    .replace(/^[^A-Za-z0-9]+/, "")
    .charAt(0);
  return letter ? letter.toUpperCase() : "?";
}

export function resolveCreatedName(record, fallback = "") {
  const value =
    record?.full_name ||
    record?.display_name ||
    record?.company_name ||
    record?.name ||
    fallback;
  return String(value || "").trim();
}

export function buildSuccessCelebrationCopy(entityType, name, message) {
  const displayName = String(name || "").trim() || "there";
  if (message) {
    return {
      title: `Welcome aboard, ${displayName}!`,
      message,
    };
  }
  if (entityType === "vendor") {
    return {
      title: `Welcome aboard, ${displayName}!`,
      message: `${displayName} has been successfully added as a vendor.`,
    };
  }
  if (entityType === "customer") {
    return {
      title: `Welcome aboard, ${displayName}!`,
      message: `${displayName} has been successfully added as a customer.`,
    };
  }
  return {
    title: `Welcome aboard, ${displayName}!`,
    message: "Your new user account has been successfully created.",
  };
}

export const CONFETTI_PIECES = [
  { left: 4, delay: 0, duration: 2.6, color: "#f43f5e", rotate: 18, size: 8 },
  { left: 9, delay: 0.12, duration: 3.1, color: "#f59e0b", rotate: -22, size: 7 },
  { left: 14, delay: 0.28, duration: 2.8, color: "#22c55e", rotate: 40, size: 9 },
  { left: 19, delay: 0.08, duration: 3.4, color: "#3b82f6", rotate: -12, size: 6 },
  { left: 24, delay: 0.4, duration: 2.7, color: "#a855f7", rotate: 28, size: 8 },
  { left: 29, delay: 0.18, duration: 3.2, color: "#06b6d4", rotate: -36, size: 7 },
  { left: 34, delay: 0.5, duration: 2.5, color: "#ef4444", rotate: 14, size: 10 },
  { left: 39, delay: 0.22, duration: 3.0, color: "#84cc16", rotate: -8, size: 6 },
  { left: 44, delay: 0.05, duration: 2.9, color: "#f97316", rotate: 32, size: 8 },
  { left: 49, delay: 0.33, duration: 3.3, color: "#6366f1", rotate: -18, size: 7 },
  { left: 54, delay: 0.16, duration: 2.6, color: "#ec4899", rotate: 24, size: 9 },
  { left: 59, delay: 0.44, duration: 3.1, color: "#14b8a6", rotate: -28, size: 6 },
  { left: 64, delay: 0.09, duration: 2.8, color: "#eab308", rotate: 16, size: 8 },
  { left: 69, delay: 0.27, duration: 3.4, color: "#0ea5e9", rotate: -40, size: 7 },
  { left: 74, delay: 0.38, duration: 2.7, color: "#8b5cf6", rotate: 10, size: 9 },
  { left: 79, delay: 0.14, duration: 3.0, color: "#f43f5e", rotate: -14, size: 6 },
  { left: 84, delay: 0.48, duration: 2.9, color: "#22c55e", rotate: 36, size: 8 },
  { left: 89, delay: 0.21, duration: 3.2, color: "#f59e0b", rotate: -24, size: 7 },
  { left: 94, delay: 0.35, duration: 2.5, color: "#3b82f6", rotate: 20, size: 10 },
  { left: 7, delay: 0.55, duration: 3.15, color: "#d946ef", rotate: -30, size: 7 },
  { left: 22, delay: 0.62, duration: 2.85, color: "#10b981", rotate: 12, size: 8 },
  { left: 47, delay: 0.58, duration: 3.05, color: "#fb7185", rotate: -6, size: 6 },
  { left: 71, delay: 0.66, duration: 2.75, color: "#38bdf8", rotate: 42, size: 9 },
  { left: 96, delay: 0.52, duration: 3.25, color: "#fbbf24", rotate: -16, size: 7 },
];
