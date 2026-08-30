/** Pure source-parity math and copy for the THPS-style combo HUD plate. */

export const SOURCE_HUD_TRACKING = Object.freeze({
  largeNumber: -6.5,
  trickTitle: 2,
  trickValue: 4,
  word: 0,
});

export interface ComboHudPreview {
  readonly points: number;
  readonly multiplier: number;
  readonly labels: string;
  readonly sequence: number;
}

const wholeNonNegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

export function sourceComboPurseTarget(pendingPoints: number): number {
  return wholeNonNegative(pendingPoints);
}

export function sourceComboMultiplier(multiplier: number): number {
  return Math.max(1, wholeNonNegative(multiplier));
}

/** Final product used only when the combo banks or is lost. */
export function sourceComboBankTotal(
  pendingPoints: number,
  multiplier: number,
): number {
  return sourceComboPurseTarget(pendingPoints) * sourceComboMultiplier(multiplier);
}

/** Live/preview copy: unmultiplied purse on the left, multiplier on the right. */
export function sourceLiveComboText(
  displayedPurse: number,
  multiplier: number,
): string {
  return `${Math.round(Math.max(0, displayedPurse))}  ×${sourceComboMultiplier(multiplier)}`;
}

/** Unity's 9%-of-gap arcade ticker, including the one-point floor. */
export function advanceSourceComboTicker(current: number, target: number): number {
  const difference = target - current;
  if (difference === 0) return current;
  const magnitude = Math.abs(difference);
  const step = Math.min(magnitude, Math.max(1, Math.ceil(magnitude * 0.09)));
  return current + Math.sign(difference) * step;
}

/** Append a title while preserving the source's adjacent-repeat ` xN` fold. */
export function projectComboLabels(
  current: readonly string[],
  next: string,
): string[] {
  const projected = [...current];
  if (!next) return projected;
  const lastIndex = projected.length - 1;
  if (lastIndex >= 0) {
    const match = projected[lastIndex].match(/^(.*) x(\d+)$/);
    const identity = match ? match[1] : projected[lastIndex];
    if (identity === next) {
      projected[lastIndex] = `${next} x${match ? Number.parseInt(match[2], 10) + 1 : 2}`;
      return projected;
    }
  }
  projected.push(next);
  return projected;
}

export function sourceComboLabelLine(labels: readonly string[]): string {
  const visible = labels.slice(-6);
  return (labels.length > 6 ? "… + " : "") + visible.join(" + ");
}

/** Convert Unity's Roo/TMP tracking units to Canvas pixels at a font size. */
export function sourceTrackingPixels(
  authoredTracking: number,
  fontSize: number,
): number {
  return (authoredTracking / 200) * fontSize;
}
