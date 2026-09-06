export const SECONDARY_TEXT_KEY = "solProtoSecondaryText.v1";
export const SECONDARY_TEXT_DEFAULTS = {
  size: 41, weight: -0.5, stroke: 0.5, shadowX: -1.5, shadowY: 1.5,
  gradientAngle: 90, gradientMid: 81,
  top: "#ffffff", upper: "#b6cbd2", middle: "#7e98ae",
  dark: "#667985", lower: "#bcc8d0", bottom: "#e0e6ea",
};
export type SecondaryTextSettings = typeof SECONDARY_TEXT_DEFAULTS;
export const SECONDARY_TEXT_RANGES = {
  size: [16, 56, 1], weight: [-0.8, 2, 0.1], stroke: [0, 4, 0.1],
  shadowX: [-14, 14, 0.5], shadowY: [-14, 14, 0.5],
  gradientAngle: [0, 360, 1], gradientMid: [10, 90, 1],
} as const;
export function sanitizeSecondaryText(value: unknown): SecondaryTextSettings {
  const result = { ...SECONDARY_TEXT_DEFAULTS };
  if (!value || typeof value !== "object") return result;
  const source = value as Record<string, unknown>;
  for (const key of Object.keys(SECONDARY_TEXT_RANGES) as (keyof typeof SECONDARY_TEXT_RANGES)[]) {
    const number = source[key];
    const [min, max] = SECONDARY_TEXT_RANGES[key];
    if (typeof number === "number" && Number.isFinite(number)) result[key] = Math.min(max, Math.max(min, number));
  }
  for (const key of ["top", "upper", "middle", "dark", "lower", "bottom"] as const)
    if (typeof source[key] === "string" && /^#[0-9a-f]{6}$/i.test(source[key])) result[key] = source[key];
  return result;
}
function read(): SecondaryTextSettings {
  try { return sanitizeSecondaryText(JSON.parse(localStorage.getItem(SECONDARY_TEXT_KEY) ?? "null")); }
  catch { return { ...SECONDARY_TEXT_DEFAULTS }; }
}
let current = read();
const listeners = new Set<() => void>();
export const secondaryTextSettings = {
  get value(): Readonly<SecondaryTextSettings> { return current; },
  update(patch: Partial<SecondaryTextSettings>): void {
    current = sanitizeSecondaryText({ ...current, ...patch });
    try { localStorage.setItem(SECONDARY_TEXT_KEY, JSON.stringify(current)); } catch { /* private/full storage: live controls still work */ }
    listeners.forEach(listener => listener());
  },
  reset(): void { this.update(SECONDARY_TEXT_DEFAULTS); },
  subscribe(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); },
};
