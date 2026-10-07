import { layoutRooAtlas, RooAtlasPainter } from './roo-type/atlas';
import { ROO_ATLAS_METRICS } from './roo-type/atlas-metrics';
import { getRooAppearance } from './roo-type/settings';

/** A readable hold, then one squash/turn/rebound travelling across the word. */
export const BONUS_TITLE_LOOP_MS = 3400;
const motionMedia = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const still = { y: 0, angle: 0, scaleX: 1, scaleY: 1 };

export function bonusTitleWordScale(elapsedMs: number, reducedMotion = false): number {
  if (reducedMotion || !Number.isFinite(elapsedMs)) return 1;
  const phase = ((Math.max(0, elapsedMs) % BONUS_TITLE_LOOP_MS) - 650) / 1500;
  return phase <= 0 || phase >= 1 ? 1 : 1 - 0.22 * Math.sin(Math.PI * phase) ** 2;
}

export function bonusTitlePose(elapsedMs: number, index: number, reducedMotion = false) {
  if (reducedMotion || !Number.isFinite(elapsedMs)) return still;
  const phase = ((Math.max(0, elapsedMs) % BONUS_TITLE_LOOP_MS) - 650 - index * 120) / 980;
  if (phase <= 0 || phase >= 1) return still;
  // Squash into the take-off and landing, stretching only while airborne.
  // A positive X scale keeps each letter readable throughout its little turn.
  const lift = Math.sin(Math.PI * phase) ** 2;
  const settle = Math.sin(2 * Math.PI * phase) ** 2;
  return {
    y: -0.105 * lift,
    angle: Math.sin(2 * Math.PI * phase) * 0.13,
    scaleX: 1 - 0.27 * lift + 0.065 * settle,
    scaleY: 1 + 0.12 * lift - 0.085 * settle,
  };
}

function titleLayout() {
  return layoutRooAtlas(ROO_ATLAS_METRICS.bonus, 'BONUS', getRooAppearance().tracking)!;
}

function glyphCentre(entry: ReturnType<typeof titleLayout>['glyphs'][number]) {
  const glyph = ROO_ATLAS_METRICS.bonus.glyphs[entry.char];
  return {
    x: entry.x + (glyph.inkLeft + glyph.inkRight) * entry.sx / 2,
    y: entry.y + ((glyph.inkTop ?? 0) + (glyph.inkBottom ?? 1)) * entry.sy / 2,
  };
}

/** Animate the existing three atlas light layers; keep semantic text untouched. */
export class BonusTitleAnimation {
  private layers: SVGSVGElement[][] = [];

  constructor(private readonly host: HTMLElement) {
    host.addEventListener('roo-layout', () => {
      this.layers = Array.from(host.querySelectorAll<SVGGElement>('.roo-text-svg > g > g'))
        .map(layer => Array.from(layer.querySelectorAll<SVGSVGElement>(':scope > svg')));
    });
  }

  restart(nowMs: number): void {
    this.host.dataset.bonusStartedAt = String(nowMs);
    this.update(nowMs);
  }

  update(nowMs: number): void {
    if (!this.layers.some(layer => layer.length) || this.host.closest('[data-precrt-composited]')) return;
    const elapsed = nowMs - Number(this.host.dataset.bonusStartedAt ?? nowMs);
    const layout = titleLayout();
    const reduced = motionMedia?.matches ?? false;
    const wordCentre = layout.min + layout.width / 2;
    const wordScale = bonusTitleWordScale(elapsed, reduced);
    for (const [index, entry] of layout.glyphs.entries()) {
      const centre = glyphCentre(entry);
      const pose = bonusTitlePose(elapsed, index, reduced);
      const transform = `translate(${wordCentre} 0) scale(${wordScale} 1) translate(${-wordCentre} 0) translate(${centre.x} ${centre.y + pose.y}) rotate(${pose.angle * 180 / Math.PI}) scale(${pose.scaleX} ${pose.scaleY}) translate(${-centre.x} ${-centre.y})`;
      for (const layer of this.layers) layer[index]?.setAttribute('transform', transform);
    }
  }
}

/** Same optical glyph placement and poses as the direct SVG, below the CRT. */
export function paintBonusTitle(
  ctx: CanvasRenderingContext2D,
  painter: RooAtlasPainter,
  rect: { x: number; y: number; width: number; height: number },
  size: number,
  alpha: number,
  elapsedMs: number,
): boolean {
  if (!painter.ready) return false;
  const layout = titleLayout();
  const cap = Math.min(size, rect.height / 1.285, rect.width / (layout.width + 0.06));
  const left = rect.x + rect.width / 2 - (layout.min + layout.width / 2) * cap;
  const top = rect.y + rect.height / 2 - cap / 2;
  const reduced = motionMedia?.matches ?? false;
  ctx.save();
  ctx.translate(rect.x + rect.width / 2, 0);
  ctx.scale(bonusTitleWordScale(elapsedMs, reduced), 1);
  ctx.translate(-rect.x - rect.width / 2, 0);
  for (const [index, entry] of layout.glyphs.entries()) {
    const glyph = ROO_ATLAS_METRICS.bonus.glyphs[entry.char];
    const centre = glyphCentre(entry);
    const pose = bonusTitlePose(elapsedMs, index, reduced);
    ctx.save();
    ctx.translate(left + centre.x * cap, top + (centre.y + pose.y) * cap);
    ctx.rotate(pose.angle);
    ctx.scale(pose.scaleX, pose.scaleY);
    ctx.translate((entry.x - centre.x) * cap, (entry.y - centre.y) * cap);
    // Rasterize at a stable size above the largest pose. Animated upscales
    // would otherwise create a fresh entry in the shared atlas cache per frame.
    const rasterScale = Math.max(entry.sx, entry.sy) * 1.12;
    ctx.scale(entry.sx / rasterScale, entry.sy / rasterScale);
    // A single-glyph atlas draw anchors its inkLeft at x. Undo that anchor
    // so this letter keeps the authored BONUS optical layout and cap band.
    painter.draw(ctx, entry.char, glyph.inkLeft * cap * rasterScale, cap * rasterScale / 2, {
      size: cap * rasterScale, palette: 'bonus', alpha,
    });
    ctx.restore();
  }
  ctx.restore();
  return true;
}
