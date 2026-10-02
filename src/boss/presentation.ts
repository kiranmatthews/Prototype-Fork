import * as THREE from 'three';
import { GameHudSurface } from '../gameHudSurface';
import { setPromptText } from '../inputPromptUI';
import { CHIEF_PHASES, type CrabChiefEncounter } from './crabChief';
import './presentation.css';

/** Semantic fallback plus Canvas ink at the existing pre-CRT seam. No extra
 * world renderer, animation timer, or native-resolution backdrop filters. */
export class BossPresentation {
  readonly root = document.createElement('section');
  private readonly title = document.createElement('div');
  private readonly bar = document.createElement('div');
  private readonly vitals = document.createElement('div');
  private readonly hint = document.createElement('div');
  private readonly prompts = document.createElement('div');
  private surface: GameHudSurface | null = null;
  private boss: CrabChiefEncounter | null = null;
  private key = '';
  private composited = false;
  constructor() {
    this.root.className = 'boss-hud'; this.root.hidden = true; this.root.setAttribute('aria-label', 'Crab Chief boss encounter');
    this.title.className = 'boss-title'; this.bar.className = 'boss-pearl-bar'; this.vitals.className = 'boss-vitals';
    this.hint.className = 'boss-hint'; this.hint.setAttribute('aria-live', 'polite'); this.prompts.className = 'boss-prompts';
    for (let i = 0; i < 9; i++) { const pearl = document.createElement('span'); pearl.className = 'boss-pearl'; this.bar.append(pearl); }
    this.root.append(this.title, this.bar, this.vitals, this.hint, this.prompts); document.body.append(this.root);
    setPromptText(this.prompts, '{jump} jump   {spin} strike   {grind} grind');
  }
  render(boss: CrabChiefEncounter | null, suppressed: boolean): void {
    this.boss = suppressed ? null : boss; this.root.hidden = !this.boss;
    if (!this.boss) { this.key = ''; return; }
    const labels = this.labels(this.boss);
    this.title.textContent = labels.title; this.hint.textContent = labels.hint; this.vitals.textContent = labels.vitals;
    this.root.style.setProperty('--chief-color', CHIEF_PHASES[this.boss.phase - 1].color);
    for (let i = 0; i < this.bar.children.length; i++) this.bar.children[i].classList.toggle('broken', i >= this.boss.health);
  }
  private labels(boss: CrabChiefEncounter) {
    const hearts = '♥'.repeat(boss.playerHealth) + '♡'.repeat(3 - boss.playerHealth);
    const charge = boss.phase === 1 ? 'PHASE 1 / 3' : boss.charged ? 'REEF CHARGE READY' : `REEF CHARGE ${Math.floor(boss.charge * 100)}%`;
    return { title: `TIDEBREAK · ${CHIEF_PHASES[boss.phase - 1].name}`, vitals: `${hearts}   ${charge}`, hint: boss.hint };
  }
  setComposited(value: boolean): void {
    this.composited = value; this.root.classList.toggle('boss-composited', value);
  }
  draw(renderer: THREE.WebGLRenderer, size: { width: number; height: number }, target: THREE.WebGLRenderTarget | null): void {
    if (!this.boss) return;
    this.surface ??= new GameHudSurface();
    const ratio = target === null ? renderer.getPixelRatio() : 1;
    const raster = { width: Math.round(size.width * ratio), height: Math.round(size.height * ratio) };
    const key = [raster.width, raster.height, window.innerWidth, window.innerHeight, this.boss.health,
      this.boss.playerHealth, this.boss.phase, Math.floor(this.boss.charge * 100), this.boss.hint].join(':');
    if (key !== this.key) {
      this.surface.draw(raster, { drawExtra: ctx => {
        ctx.scale(raster.width / window.innerWidth, raster.height / window.innerHeight);
        const boss = this.boss!, color = CHIEF_PHASES[boss.phase - 1].color, labels = this.labels(boss);
        const width = window.innerWidth, height = window.innerHeight;
        const compact = width < 700 || height < 480, top = compact ? 57 : 18;
        const barWidth = Math.min(width - 36, compact ? 335 : 430), cx = width / 2;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        const text = (value: string, x: number, y: number, font: number, fill = '#fff1c6') => {
          ctx.font = `bold ${font}px Roo, sans-serif`; ctx.lineWidth = 4; ctx.strokeStyle = '#293443'; ctx.strokeText(value, x, y);
          ctx.fillStyle = fill; ctx.fillText(value, x, y);
        };
        text(labels.title, cx, top + 9, compact ? 17 : 22, color);
        ctx.fillStyle = '#213c46'; ctx.beginPath(); ctx.roundRect(cx - barWidth / 2 - 8, top + 27, barWidth + 16, 23, 11); ctx.fill();
        for (let i = 0; i < 9; i++) {
          const x = cx + (i - 4) * barWidth / 9, alive = i < boss.health;
          ctx.fillStyle = alive ? color : '#43555b'; ctx.strokeStyle = alive ? '#fff0c1' : '#63757a'; ctx.lineWidth = alive ? 2 : 1;
          ctx.beginPath(); ctx.ellipse(x, top + 38, barWidth / 24, 6, -.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (alive) { ctx.fillStyle = '#fff4d1'; ctx.fillRect(x - 3, top + 34, 4, 2); }
        }
        text(labels.vitals, cx, top + 64, compact ? 14 : 16, boss.charged ? '#82f4e1' : '#ffe1ae');
        // Bottom copy reserves both touch-control zones. On short landscape
        // screens it moves above them, preserving the full arena view.
        const hintY = compact ? height - (height < 480 ? 112 : 160) : height - 83;
        ctx.fillStyle = 'rgba(24,49,57,.86)'; ctx.beginPath(); ctx.roundRect(Math.max(10, cx - 310), hintY - 18,
          Math.min(width - 20, 620), 36, 6); ctx.fill();
        const font = compact ? Math.max(11, Math.min(15, width / 30)) : 18;
        text(boss.hint, cx, hintY, font, color);
      } });
      this.key = key;
    }
    this.surface.composite(renderer, size, target);
  }
  get diagnostics() { return { visible: !!this.boss, composited: this.composited, hint: this.boss?.hint,
    surface: this.surface?.diagnostics ?? null }; }
}
