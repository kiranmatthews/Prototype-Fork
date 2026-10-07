import { layoutRooAtlas, RooAtlasPainter } from './roo-type/atlas';
import { ROO_ATLAS_METRICS } from './roo-type/atlas-metrics';
import { getRooAppearance } from './roo-type/settings';

/** Sequential letter arrivals, a long readable hold, then a short turn away. */
export const BONUS_TITLE_LOOP_MS = 6000;
const motionMedia = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const still = { y: 0, angle: 0, scaleX: 1, scaleY: 1, alpha: 1 };
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export function bonusTitleWordScale(_elapsedMs: number, _reducedMotion = false): number { return 1; }
export function bonusTitlePose(elapsedMs: number, index: number, reducedMotion = false) {
  if (reducedMotion || !Number.isFinite(elapsedMs)) return still;
  const time=Math.max(0,elapsedMs)%BONUS_TITLE_LOOP_MS;
  const enter=clamp((time-index*170)/420);
  const leave=clamp((time-5200-index*55)/240);
  const spring=1-Math.pow(1-enter,3)+Math.sin(enter*Math.PI)*.18;
  return { y:-Math.sin(enter*Math.PI)*.14-leave*.08,
    angle:(1-enter)*-.12+leave*.1,
    scaleX:Math.max(.001,spring*(1-leave)),
    scaleY:(.7+.3*spring)*(1-leave*.25),
    alpha:clamp(enter*5)*(1-leave) };
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
      for (const layer of this.layers) { layer[index]?.setAttribute('transform', transform); layer[index]?.setAttribute('opacity',String(pose.alpha)); }
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
    ctx.globalAlpha *= pose.alpha;
    ctx.rotate(pose.angle);
    ctx.scale(pose.scaleX, pose.scaleY);
    ctx.translate((entry.x - centre.x) * cap, (entry.y - centre.y) * cap);
    // Rasterize at a stable size above the largest pose. Animated upscales
    // would otherwise create a fresh entry in the shared atlas cache per frame.
    const rasterScale = Math.max(entry.sx, entry.sy) * 1.25;
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
