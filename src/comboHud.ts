/** Pure scoring, copy, wrapping, and ticker helpers for the combo HUD plate. */

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

export interface LiveComboTickerState {
  readonly displayed: number;
  readonly target: number;
  readonly pointsPerSecond: number;
}

/** Existing cash-in animation begins only after this additional readable hold. */
export const COMBO_CASH_IN_EXTRA_HOLD_MS = 2000;
/** Timed grind/grab/manual/lip/wall awards arrive from gameplay at this cadence. */
export const COMBO_TIMED_AWARD_SECONDS = 0.25;

export function comboCashInIsHolding(nowMs: number, holdEndMs: number): boolean {
  return (
    Number.isFinite(nowMs) &&
    Number.isFinite(holdEndMs) &&
    holdEndMs > 0 &&
    nowMs < holdEndMs
  );
}

export interface ComboCashInDisplayFrame {
  readonly combo: number;
  readonly score: number;
}

/** Hold both sides, then resume the original matched purse-to-score chase. */
export function advanceComboCashInDisplay(
  displayedCombo: number,
  displayedScore: number,
  targetScore: number,
  holding: boolean,
): ComboCashInDisplayFrame {
  if (holding) return { combo: displayedCombo, score: displayedScore };
  return {
    combo: advanceSourceComboTicker(displayedCombo, 0),
    score: advanceSourceComboTicker(displayedScore, targetScore),
  };
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

/** A frame-rate-independent linear chase with no minimum-one-point burst. */
export function advanceConstantComboTicker(
  current: number,
  target: number,
  pointsPerSecond: number,
  deltaSeconds: number,
): number {
  const difference = target - current;
  if (difference === 0) return current;
  const dt = Number.isFinite(deltaSeconds)
    ? Math.max(0, Math.min(0.25, deltaSeconds))
    : 0;
  const distance = Math.max(0, pointsPerSecond) * dt;
  if (distance <= 0) return current;
  return Math.abs(difference) <= distance
    ? target
    : current + Math.sign(difference) * distance;
}

export function createLiveComboTicker(target = 0): LiveComboTickerState {
  const value = wholeNonNegative(target);
  return { displayed: value, target: value, pointsPerSecond: 0 };
}

/**
 * Fixed trick awards snap before calling this. Timed authoritative packets do
 * not: each new delta is spread evenly over the same quarter-second cadence
 * that produced it, making a sustained grind read as one constant ticker.
 */
export function advanceLiveComboTicker(
  previous: Readonly<LiveComboTickerState>,
  target: number,
  deltaSeconds: number,
): LiveComboTickerState {
  const nextTarget = wholeNonNegative(target);
  const changed = nextTarget !== previous.target;
  const pointsPerSecond = changed
    ? Math.abs(nextTarget - previous.target) / COMBO_TIMED_AWARD_SECONDS
    : previous.pointsPerSecond;
  return {
    displayed: advanceConstantComboTicker(
      previous.displayed,
      nextTarget,
      pointsPerSecond,
      deltaSeconds,
    ),
    target: nextTarget,
    pointsPerSecond,
  };
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

/** Greedy ` + `-aware wrapping shared by the pre-CRT plain-text renderer. */
export function wrapComboLabelLine(
  labelLine: string,
  maximumWidth: number,
  measure: (value: string) => number,
): string[] {
  const labels = labelLine.split(/\s+\+\s+/).filter(Boolean);
  if (labels.length === 0) return [];
  const width = Math.max(1, maximumWidth);
  const lines: string[] = [];
  let current = "";
  for (const label of labels) {
    const candidate = current ? `${current} + ${label}` : label;
    if (current && measure(candidate) > width) {
      lines.push(current);
      current = label;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Convert Unity's Roo/TMP tracking units to Canvas pixels at a font size. */
export function sourceTrackingPixels(
  authoredTracking: number,
  fontSize: number,
): number {
  return (authoredTracking / 200) * fontSize;
}
