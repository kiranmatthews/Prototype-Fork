/** One handcrafted three-run competition; all tuning is local to this event. */
export const JUNGLE_CUP_ID = 'jungle-cup';
export const COMPETITION_TUNING = {
  runSeconds: 60,
  perfectRunTarget: 12000,
  scoreExponent: 0.55,
  bailLinear: 3,
  bailQuadratic: 0.75,
  hugeScoreMultiple: 4,
  hugeScoreBailRelief: 0.8,
  idleGraceSeconds: 12,
  idlePenaltyRate: 0.125,
  idlePenaltyMax: 60,
  judgeLow: -1.2,
  judgeHigh: 1.2,
  biasedJudgeHigh: 0.5,
  biasPenalty: 3,
  revealBeat: 0.65,
  finishBeat: 0.6,
  rival: { skill: 96.1, variance: 0.65, tracking: 0.2, reference: 95, min: 94.1, max: 98.5 },
};
export const JUDGES = [
  { id: 'flow', name: 'Moss', title: 'Flow judge', portrait: 'moss', color: '#71a891' },
  { id: 'style', name: 'Sol', title: 'Style judge', portrait: 'sol', color: '#e8b55b' },
  { id: 'hostile', name: 'Voss', title: 'Head judge', portrait: 'voss', color: '#bc5d48' },
] as const;
export const COMPETITORS = [
  { id: 'roxy', name: 'Roxy', portrait: 'roxy', skill: 91, variance: 3 },
  { id: 'nova', name: 'Nova', portrait: 'nova', skill: 85, variance: 4 },
  { id: 'mondo', name: 'Mondo', portrait: 'mondo', skill: 82, variance: 4 },
  { id: 'pip', name: 'Pip', portrait: 'pip', skill: 72, variance: 5 },
] as const;
export type CompetitionPhase = 'intro' | 'countdown' | 'running' | 'finishing' | 'judges' | 'standings' | 'final';
export interface JudgedRun { gameplayScore: number; bails: number; judges: [number, number, number]; score: number; inactivityPenalty: number; longestIdleSeconds: number; }
export const COMPETITION_HEATS = [
  { sky: 'day', fogColor: '#b8d2ca', sunOffset: [-36,62,28], lighting: {} },
  { sky: 'sunset', fogColor: '#b98d85', sunOffset: [-64,25,18], lighting: {
    sunColor: '#ffb16b', ambientSky: '#d8bad1', ambientGround: '#956047', fillColor: '#ffc295', fillIntensity: .32,
  } },
  { sky: 'night', fogColor: '#253654', sunOffset: [-24,48,-35], lighting: {
    ambientSky: '#8ca6d0', ambientGround: '#526079', ambientIntensity: 1.05,
    sunColor: '#bfd0ff', sunIntensity: .7, fillColor: '#8ca8df', fillIntensity: .38, shadowStrength: .65,
  } },
] as const;
export interface Standing { id: string; name: string; portrait: string; runs: number[]; total: number; discarded: number | null; rank: number; }
export const roundMark = (n: number): number => Math.round((n + Number.EPSILON) * 10) / 10;
const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));
const between = (rng: () => number, min: number, max: number): number => min + clamp(rng(), 0, 1) * (max - min);
export function judgeRun(gameplayScore: number, bails: number, rng = Math.random,
  inactivityPenalty = 0, longestIdleSeconds = 0): JudgedRun {
  const t = COMPETITION_TUNING;
  const score = Number.isFinite(gameplayScore) ? Math.max(0, gameplayScore) : 0;
  const count = Number.isFinite(bails) ? Math.max(0, Math.floor(bails)) : 0;
  const p = Math.min(1, Math.pow(score / Math.max(1, t.perfectRunTarget), t.scoreExponent));
  // Only the first two bails earn score-based forgiveness. More falls keep
  // their full escalating cost, even after an enormous banked combo.
  const relief = clamp((score / t.perfectRunTarget - 1) / (t.hugeScoreMultiple - 1), 0, 1) * t.hugeScoreBailRelief;
  const forgivenCount = Math.min(2, count);
  const bailPenalty = t.bailLinear * count + t.bailQuadratic * count * count -
    relief * (t.bailLinear * forgivenCount + t.bailQuadratic * forgivenCount * forgivenCount);
  const idlePenalty = Number.isFinite(inactivityPenalty) ? clamp(inactivityPenalty, 0, t.idlePenaltyMax) : 0;
  const base = 55 + 44.9 * p - bailPenalty - idlePenalty;
  const judges = [
    roundMark(clamp(base + between(rng, t.judgeLow, t.judgeHigh), 0, 99.9)),
    roundMark(clamp(base + between(rng, t.judgeLow, t.judgeHigh), 0, 99.9)),
    roundMark(clamp(base - t.biasPenalty + between(rng, t.judgeLow, t.biasedJudgeHigh), 0, 99.9)),
  ] as [number, number, number];
  // Keep the official marks at the displayed precision, so the best-two total
  // always adds up from the visible scorecard. Every judge contributes.
  return { gameplayScore: score, bails: count, judges, score: roundMark(judges.reduce((a,b) => a+b, 0) / 3),
    inactivityPenalty: roundMark(idlePenalty), longestIdleSeconds: Math.max(0, longestIdleSeconds) };
}
export function bestTwo(runs: readonly number[]): { total: number; discarded: number | null } {
  const discarded = runs.length === 3 ? runs.indexOf(Math.min(...runs)) : null;
  return { total: roundMark(runs.reduce((sum, score, i) => sum + (i === discarded ? 0 : score), 0)), discarded };
}
export function rivalRun(playerScore: number, rng = Math.random): number {
  const t = COMPETITION_TUNING.rival;
  // A narrow elite band above ordinary skaters guarantees the story placement
  // without ever rewriting an already revealed run or falsifying the total.
  const minimum = clamp(t.min, 94.1, 99.9);
  const maximum = clamp(t.max, minimum, 99.9);
  const variance = clamp(t.variance, 0, (maximum - minimum) / 2);
  const target = clamp(t.skill + (playerScore - t.reference) * t.tracking,
    minimum + variance, maximum - variance);
  return roundMark(clamp(target + between(rng, -variance, variance), minimum, maximum));
}
export class JungleCupEvent {
  phase: CompetitionPhase = 'intro';
  remaining = 60;
  presentationTime = 0;
  countdown = 3;
  bails = 0;
  liveScore = 0;
  overtime = false;
  finalComboActive = false;
  idleSeconds = 0;
  longestIdleSeconds = 0;
  inactivityPenalty = 0;
  private finishHold = 0;
  runs: JudgedRun[] = [];
  cupAwarded = false;
  resultCommitted = false;
  readonly field = [
    { id: 'player', name: 'Bone Man', portrait: 'bone', runs: [] as number[] },
    { id: 'rival', name: 'Rival', portrait: 'rival', runs: [] as number[] },
    ...COMPETITORS.map(c => ({ id: c.id as string, name: c.name as string, portrait: c.portrait as string, runs: [] as number[] })),
  ];
  constructor(private readonly rng: () => number = Math.random,
    private readonly onFinalSecond: (second: number) => void = () => {}) {}
  get runNumber(): number { return Math.min(3, this.runs.length + (['running','finishing','countdown','intro'].includes(this.phase) ? 1 : 0)); }
  get simulating(): boolean { return this.phase === 'running' || this.phase === 'finishing'; }
  get heatLook() { return COMPETITION_HEATS[Math.max(0, this.runNumber - 1)]; }
  get revealedJudges(): number { return Math.min(3, Math.floor(this.presentationTime / COMPETITION_TUNING.revealBeat)); }
  get standings(): Standing[] {
    return this.field.map(s => ({ ...s, ...bestTwo(s.runs), rank: 0 }))
      .sort((a,b) => b.total - a.total || (a.id === 'rival' ? -1 : b.id === 'rival' ? 1 : a.id.localeCompare(b.id)))
      .map((s,i) => ({ ...s, rank: i + 1 }));
  }
  get rank(): number { return this.standings.find(s => s.id === 'player')!.rank; }
  get won(): boolean { return this.runs.length === 3 && this.rank === 1; }
  startRun(): boolean {
    if (this.runs.length >= 3 || !['intro','standings'].includes(this.phase)) return false;
    this.phase = 'countdown'; this.countdown = 3; this.remaining = COMPETITION_TUNING.runSeconds;
    this.liveScore = 0; this.bails = 0;
    this.idleSeconds = this.longestIdleSeconds = this.inactivityPenalty = 0;
    this.overtime = this.finalComboActive = false; this.finishHold = 0; return true;
  }
  bail(): void { if (this.phase === 'running') this.bails++; }
  /** Only regulation gameplay counts: menus, countdown, overtime and the final
   * score presentation cannot accumulate an inactivity deduction. */
  trackActivity(dt: number, performingTrick: boolean): void {
    if (this.phase !== 'running' || this.remaining <= 0) return;
    if (performingTrick) { this.idleSeconds = 0; return; }
    const t = COMPETITION_TUNING;
    const before = Math.max(0, this.idleSeconds - t.idleGraceSeconds);
    this.idleSeconds += Math.min(this.remaining, Math.max(0, dt));
    this.longestIdleSeconds = Math.max(this.longestIdleSeconds, this.idleSeconds);
    const after = Math.max(0, this.idleSeconds - t.idleGraceSeconds);
    this.inactivityPenalty = Math.min(t.idlePenaltyMax,
      this.inactivityPenalty + t.idlePenaltyRate * (after * after - before * before));
  }
  stepPresentation(dt: number): void {
    if (this.phase === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown === 0) this.phase = 'running';
    } else if (this.phase === 'judges') this.presentationTime += dt;
  }
  /** True begins the controlled dismount, not the judging screen. */
  stepRun(dt: number, bankedScore: number, comboActive = false, readyToStop = true): boolean {
    if (this.phase !== 'running') return false;
    this.liveScore = Math.max(0, bankedScore);
    const previous = this.remaining;
    this.remaining = Math.max(0, this.remaining - dt);
    const whole = Math.round(this.remaining);
    if (Math.abs(this.remaining - whole) < 1e-7) this.remaining = whole;
    for (const second of [3, 2, 1])
      if (previous > second && this.remaining <= second) this.onFinalSecond(second);
    if (this.remaining > 1e-7) return false;
    this.remaining = 0;
    this.finalComboActive = comboActive;
    if (comboActive || !readyToStop) {
      this.overtime = true;
      return false;
    }
    this.overtime = false;
    this.phase = 'finishing'; this.finishHold = 0;
    return true;
  }
  /** Dismount, then hold a beat and wait for the actual HUD cash-in to finish. */
  stepFinish(dt: number, dismounted: boolean, scoreSettled: boolean): boolean {
    if (this.phase !== 'finishing') return false;
    if (!dismounted) { this.finishHold = 0; return false; }
    this.finishHold += Math.max(0, dt);
    if (this.finishHold + 1e-7 < COMPETITION_TUNING.finishBeat || !scoreSettled) return false;
    const run = judgeRun(this.liveScore, this.bails, this.rng, this.inactivityPenalty, this.longestIdleSeconds);
    this.runs.push(run);
    this.field[0].runs.push(run.score);
    this.field[1].runs.push(rivalRun(run.score, this.rng));
    COMPETITORS.forEach((c, i) => this.field[i + 2].runs.push(roundMark(clamp(c.skill + between(this.rng, -c.variance, c.variance), 0, 94))));
    this.phase = 'judges'; this.presentationTime = 0;
    return true;
  }
  showStandings(): boolean {
    if (this.phase !== 'judges' || this.revealedJudges < 3) return false;
    this.phase = this.runs.length === 3 ? 'final' : 'standings';
    return true;
  }
}
