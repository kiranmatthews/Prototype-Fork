/** One handcrafted three-run competition; all tuning is local to this event. */
export const JUNGLE_CUP_ID = 'jungle-cup';
export const COMPETITION_TUNING = {
  runSeconds: 60,
  perfectRunTarget: 12000,
  scoreExponent: 0.55,
  bailLinear: 3,
  bailQuadratic: 0.75,
  judgeLow: -1.2,
  judgeHigh: 1.2,
  biasedJudgeHigh: 0.5,
  biasPenalty: 3,
  revealBeat: 0.65,
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
export type CompetitionPhase = 'intro' | 'countdown' | 'running' | 'judges' | 'standings' | 'final';
export interface JudgedRun { gameplayScore: number; bails: number; judges: [number, number, number]; score: number; }
export interface Standing { id: string; name: string; portrait: string; runs: number[]; total: number; discarded: number | null; rank: number; }
export const roundMark = (n: number): number => Math.round((n + Number.EPSILON) * 10) / 10;
const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));
const between = (rng: () => number, min: number, max: number): number => min + clamp(rng(), 0, 1) * (max - min);
export function judgeRun(gameplayScore: number, bails: number, rng = Math.random): JudgedRun {
  const t = COMPETITION_TUNING;
  const score = Number.isFinite(gameplayScore) ? Math.max(0, gameplayScore) : 0;
  const count = Number.isFinite(bails) ? Math.max(0, Math.floor(bails)) : 0;
  const p = Math.min(1, Math.pow(score / Math.max(1, t.perfectRunTarget), t.scoreExponent));
  const base = 55 + 44.9 * p - t.bailLinear * count - t.bailQuadratic * count * count;
  const judges = [
    roundMark(clamp(base + between(rng, t.judgeLow, t.judgeHigh), 0, 99.9)),
    roundMark(clamp(base + between(rng, t.judgeLow, t.judgeHigh), 0, 99.9)),
    roundMark(clamp(base - t.biasPenalty + between(rng, t.judgeLow, t.biasedJudgeHigh), 0, 99.9)),
  ] as [number, number, number];
  // Keep the official marks at the displayed precision, so the best-two total
  // always adds up from the visible scorecard. Every judge contributes.
  return { gameplayScore: score, bails: count, judges, score: roundMark(judges.reduce((a,b) => a+b, 0) / 3) };
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
  runs: JudgedRun[] = [];
  cupAwarded = false;
  resultCommitted = false;
  readonly field = [
    { id: 'player', name: 'Bone Man', portrait: 'bone', runs: [] as number[] },
    { id: 'rival', name: 'Rival', portrait: 'rival', runs: [] as number[] },
    ...COMPETITORS.map(c => ({ id: c.id as string, name: c.name as string, portrait: c.portrait as string, runs: [] as number[] })),
  ];
  constructor(private readonly rng: () => number = Math.random) {}
  get runNumber(): number { return Math.min(3, this.runs.length + (this.phase === 'running' || this.phase === 'countdown' || this.phase === 'intro' ? 1 : 0)); }
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
    this.liveScore = 0; this.bails = 0; return true;
  }
  bail(): void { if (this.phase === 'running') this.bails++; }
  stepPresentation(dt: number): void {
    if (this.phase === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown === 0) this.phase = 'running';
    } else if (this.phase === 'judges') this.presentationTime += dt;
  }
  stepRun(dt: number, bankedScore: number): boolean {
    if (this.phase !== 'running') return false;
    this.liveScore = Math.max(0, bankedScore);
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining > 1e-7) return false;
    this.remaining = 0;
    const run = judgeRun(this.liveScore, this.bails, this.rng);
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
