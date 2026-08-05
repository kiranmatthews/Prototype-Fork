// Shared bones of the dev studios (smoke, swirl): the panel widgets, the
// curved slider + exact number box, and the css. One place, so a fix to the
// slider fixes every studio.
export function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}
export function sec(text: string): HTMLElement {
  const s = el('div', 'pst-sec');
  s.textContent = text;
  return s;
}
export function note(text: string): HTMLElement {
  const s = el('div', 'pst-note');
  s.textContent = text;
  return s;
}
export function btn(text: string, onClick: (b: HTMLElement) => void): HTMLElement {
  const b = el('button', 'pst-btn');
  b.textContent = text;
  b.onclick = () => onClick(b);
  return b;
}

/**
 * Curved slider mapping. t in [0,1] -> value in [lo,hi], with |x|^curve
 * spent near zero — and when the range straddles zero the curve is applied
 * on EACH side of it, so fine control sits around 0 rather than around lo.
 */
export function toV(t: number, lo: number, hi: number, curve: number): number {
  t = Math.min(1, Math.max(0, t));
  if (lo < 0 && hi > 0) {
    const t0 = -lo / (hi - lo); // the tick where the value crosses zero
    return t >= t0
      ? hi * Math.pow((t - t0) / (1 - t0), curve)
      : lo * Math.pow((t0 - t) / t0, curve);
  }
  return lo + (hi - lo) * Math.pow(t, curve);
}
export function toT(v: number, lo: number, hi: number, curve: number): number {
  if (lo < 0 && hi > 0) {
    const t0 = -lo / (hi - lo);
    const t =
      v >= 0
        ? t0 + (1 - t0) * Math.pow(Math.min(1, v / hi), 1 / curve)
        : t0 - t0 * Math.pow(Math.min(1, v / lo), 1 / curve);
    return Math.min(1, Math.max(0, t));
  }
  return Math.min(1, Math.max(0, Math.pow((v - lo) / (hi - lo), 1 / curve)));
}
/** Round a curved-track value to a sane precision for its magnitude. */
export function snap(v: number): number {
  const a = Math.abs(v);
  return +v.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
}

/**
 * One labelled control row: a curved slider (most travel near zero, linear
 * for whole-number fields) plus an exact number box that accepts anything,
 * including values past the slider's ends.
 */
export function sliderRow(
  label: string,
  value: number,
  lo: number,
  hi: number,
  step: number,
  onInput: (v: number) => void,
): HTMLElement {
  const row = el('div', 'pst-row');
  const l = el('label', 'pst-label');
  l.textContent = label;
  const curve = step >= 1 ? 1 : 3;
  const inp = document.createElement('input');
  inp.type = 'range';
  inp.min = '0';
  inp.max = '1000';
  inp.step = '1';
  inp.value = String(toT(value, lo, hi, curve) * 1000);
  const box = document.createElement('input');
  box.type = 'number';
  box.className = 'pst-num';
  box.step = 'any';
  box.value = String(value);
  inp.addEventListener('input', () => {
    let v = snap(toV(parseInt(inp.value, 10) / 1000, lo, hi, curve));
    if (step >= 1) v = Math.round(v);
    box.value = String(v);
    onInput(v);
  });
  box.addEventListener('input', () => {
    const v = parseFloat(box.value);
    if (!Number.isFinite(v)) return;
    inp.value = String(toT(v, lo, hi, curve) * 1000);
    onInput(v);
  });
  row.append(l, inp, box);
  return row;
}

let cssIn = false;
export function injectStudioCss(): void {
  if (cssIn) return;
  cssIn = true;
  const s = document.createElement('style');
  s.textContent = `
    .pst {
      position: fixed; top: 0; right: 0; bottom: 0; width: 320px; z-index: 41;
      overflow-y: auto; padding: 0 14px 22px; box-sizing: border-box;
      background: linear-gradient(180deg, rgba(18,21,30,0.97), rgba(11,13,19,0.97));
      border-left: 1px solid #333a4a; color: #cfe3d8;
      font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace;
    }
    .pst-head {
      position: sticky; top: 0; padding: 12px 0 10px; margin-bottom: 4px;
      background: inherit; letter-spacing: 3px; color: #ff7ae0; font-weight: bold;
      border-bottom: 1px solid #333a4a; z-index: 2;
    }
    .pst-x { position: absolute; right: 0; top: 8px; background: none; border: none;
      color: #8fa0b8; font-size: 15px; cursor: pointer; }
    .pst-sec { margin: 14px 0 6px; letter-spacing: 2px; font-size: 10px; color: #7f8fa8;
      border-bottom: 1px solid #262d3a; padding-bottom: 4px; }
    .pst-note { color: #7f8fa8; font-size: 11px; margin: 8px 0; }
    .pst-hint { color: #63708a; font-size: 10px; margin: -2px 0 6px 96px; }
    .pst-ctl { margin-bottom: 2px; }
    .pst-row { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
    .pst-label { flex: 0 0 88px; color: #9fb0c8; }
    .pst-row input[type=range] { flex: 1; min-width: 0; accent-color: #ff7ae0; }
    .pst-num {
      /* min-width 0 matters: a number input's intrinsic minimum is ~150px and
         a flex item refuses to shrink below it, which squeezed the slider to
         a pill and let this box eat the row. */
      flex: 0 0 58px; min-width: 0; background: #131722; color: #cfe3d8;
      text-align: right; border: 1px solid #333a4a; padding: 2px 3px; font: inherit;
    }
    .pst-num::-webkit-outer-spin-button, .pst-num::-webkit-inner-spin-button {
      -webkit-appearance: none; margin: 0;
    }
    .pst-btn.pst-on { background: #3a2440; border-color: #ff7ae0; color: #ffd6f4; }
    .pst-col { flex: 1; height: 22px; background: none; border: 1px solid #333a4a; }
    .pst-chk { accent-color: #ff7ae0; }
    .pst-sel, .pst-text {
      flex: 1; min-width: 0; background: #131722; color: #cfe3d8;
      border: 1px solid #333a4a; padding: 3px; font: inherit;
    }
    .pst-btns { display: flex; flex-wrap: wrap; gap: 5px; margin: 8px 0; }
    .pst-btn {
      background: #1c2331; color: #cfe3d8; border: 1px solid #3a4457;
      padding: 4px 8px; cursor: pointer; font: inherit;
    }
    .pst-btn:hover { background: #263047; }
    .pst-stat { color: #ffd24a; font-size: 11px; margin: 4px 0 2px; }
    .pst-out {
      width: 100%; height: 190px; box-sizing: border-box; background: #0d1017;
      color: #9fe8c0; border: 1px solid #333a4a; font: 11px/1.4 ui-monospace, monospace;
      padding: 6px; resize: vertical;
    }
  `;
  document.head.appendChild(s);
}
