import "./secondary-text.css";
import { secondaryTextSettings } from "./secondaryTextSettings";

let nextLabelId = 0;
const SVG_NS = "http://www.w3.org/2000/svg";

/** Silver face over a solid, gap-free black extrusion, not a drop shadow. */
export function silverSecondaryLabel(label: string): HTMLElement {
  const host = document.createElement("strong");
  host.className = "secondary-silver";
  host.textContent = label;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  const id = `secondary-silver-${nextLabelId++}`;
  const glyph = (x: number, y: number, fill: string, stroke: number, strokeColor = "#050608") => {
    const text = document.createElementNS(SVG_NS, "text");
    text.textContent = label;
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y));
    text.setAttribute("dominant-baseline", "text-before-edge");
    text.setAttribute("fill", fill);
    text.setAttribute("stroke", strokeColor);
    text.setAttribute("stroke-width", String(stroke));
    text.setAttribute("stroke-linejoin", "round");
    text.setAttribute("paint-order", "stroke fill");
    svg.appendChild(text);
    return text;
  };
  const render = () => {
    const s = secondaryTextSettings.value;
    document.documentElement.style.setProperty("--secondary-size-scale", String(s.size / 32));
    const angle = s.gradientAngle * Math.PI / 180;
    const x = Math.cos(angle) * 0.5, y = Math.sin(angle) * 0.5;
    const mid = s.gradientMid / 100;
    svg.innerHTML = `<defs><linearGradient id="${id}" x1="${.5-x}" y1="${.5-y}" x2="${.5+x}" y2="${.5+y}">
      <stop offset="0" stop-color="${s.top}"/>
      <stop offset="${mid * .5}" stop-color="${s.upper}"/>
      <stop offset="${mid - .06}" stop-color="${s.middle}"/>
      <stop offset="${mid}" stop-color="${s.dark}"/>
      <stop offset="${mid + (1-mid)*.5}" stop-color="${s.lower}"/>
      <stop offset="1" stop-color="${s.bottom}"/>
    </linearGradient></defs>`;
    // Sweep the whole offset with <= 0.5px steps, even for negative offsets.
    const steps = Math.max(1, Math.ceil(Math.hypot(s.shadowX, s.shadowY) * 2));
    const expansion = Math.max(0, s.weight) * 2;
    for (let step = steps; step >= 0; step--)
      glyph(s.shadowX * step / steps, s.shadowY * step / steps, "#050608", s.stroke * 2 + expansion);
    // This static Bold font has no weight axis. Change visible face thickness
    // geometrically, rather than offering a CSS font-weight slider that does nothing.
    const fill = `url(#${id})`;
    const face = glyph(0, 0, fill, Math.abs(s.weight) * 2, s.weight < 0 ? "#050608" : fill);
    if (s.weight < 0) face.setAttribute("paint-order", "fill stroke");
  };
  render();
  // Map labels are built once for the lifetime of the world-map UI.
  secondaryTextSettings.subscribe(render);
  host.appendChild(svg);
  return host;
}

/** Synchronous Canvas twin for the pre-CRT pass; never rasterizes DOM/SVG. */
export function paintSilverSecondaryText(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, fontSize: number): void {
  const s = secondaryTextSettings.value;
  ctx.save();
  ctx.font = `700 ${fontSize}px "Staging Secondary", Impact, sans-serif`;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round";
  const metrics = ctx.measureText(label);
  const baseline = y + (metrics.fontBoundingBoxAscent || fontSize * .85);
  const top = baseline - metrics.actualBoundingBoxAscent;
  const left = x - metrics.actualBoundingBoxLeft;
  const width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  const angle = s.gradientAngle * Math.PI / 180;
  const gx = Math.cos(angle) * .5, gy = Math.sin(angle) * .5, mid = s.gradientMid / 100;
  const gradient = ctx.createLinearGradient(left + width * (.5-gx), top + height * (.5-gy), left + width * (.5+gx), top + height * (.5+gy));
  for (const [at, color] of [[0,s.top],[mid*.5,s.upper],[mid-.06,s.middle],[mid,s.dark],[mid+(1-mid)*.5,s.lower],[1,s.bottom]] as const)
    gradient.addColorStop(at, color);
  const steps = Math.max(1, Math.ceil(Math.hypot(s.shadowX, s.shadowY) * 2));
  ctx.fillStyle = ctx.strokeStyle = "#050608";
  const outline = s.stroke * 2 + Math.max(0, s.weight) * 2;
  for (let step = steps; step >= 0; step--) {
    const sx = x + s.shadowX * step / steps, sy = baseline + s.shadowY * step / steps;
    if (outline > 0) { ctx.lineWidth = outline; ctx.strokeText(label, sx, sy); }
    ctx.fillText(label, sx, sy);
  }
  ctx.fillStyle = gradient;
  if (s.weight > 0) { ctx.strokeStyle = gradient; ctx.lineWidth = s.weight * 2; ctx.strokeText(label, x, baseline); }
  ctx.fillText(label, x, baseline);
  if (s.weight < 0) { ctx.strokeStyle = "#050608"; ctx.lineWidth = -s.weight * 2; ctx.strokeText(label, x, baseline); }
  ctx.restore();
}
