// The HUD display face: a raster type cut from two hand-drawn alphabet sheets.
//
// Every glyph is a rect in public/hudfont.png (see tools/bake-hudfont.mjs), so
// a string is drawn as a row of <i> elements, each showing one window onto the
// atlas. That keeps the three-colour drawing — navy outline, white inline, red
// fill — which a font-file conversion would flatten to a single colour.
//
// Sizes are all in `em`. The atlas is normalised to an 80px cap height, so an
// element that wants 40px caps just needs `font-size` set such that CAP_EM ems
// come out at 40px — which means the existing responsive `clamp()` rules in the
// HUD's CSS keep driving the size with no JS layout reads at all.
import { HUD_ATLAS, HUD_GLYPHS } from "./hudfont-data";

/** Cap height as a fraction of the element's font-size. Chosen so the raster
 *  face lands at about the same optical size as the Impact it replaces. */
const CAP_EM = 0.78;
/** Gap between glyphs, in cap heights. */
const TRACK = 0.07;
/** Width of a space, in cap heights. */
const SPACE = 0.32;

const URL = `${import.meta.env.BASE_URL}hudfont.png`;

// Characters that reach the HUD in a form the sheets don't draw. A value may
// be more than one glyph, so the whole string is rewritten before it is cut up.
const ALIAS: Readonly<Record<string, string>> = {
  "×": "X", // multiplication sign — this face's X is the same mark
  "…": "...", // the trick plate elides a long combo with one
  "&": "+", // "Flats & Pipes" is the only one, and + is drawn on the sheets
  "–": "-",
  "—": "-",
  "‘": "'",
  "’": "'",
  "`": "'",
};
const ALIAS_RE = new RegExp(`[${Object.keys(ALIAS).join("")}]`, "g");

let installed = false;

/** Injects the one stylesheet the raster glyphs need. Idempotent. */
export function installHudFont(): void {
  if (installed) return;
  installed = true;
  const em = (px: number) => `${((px / HUD_ATLAS.cap) * CAP_EM).toFixed(4)}em`;
  const style = document.createElement("style");
  style.textContent = `
    /* Wrapping matters on a phone: a long message title ("REPLAY LEVEL
       MISSING") is wider than a 390px screen, and a clipped raster row has no
       ellipsis to fall back on the way text does. The row wraps, but each WORD
       is its own nowrap flex item, so a break can only land on a space. */
    .rf {
      display: inline-flex; align-items: flex-start; line-height: 1;
      flex-wrap: wrap; justify-content: center; max-width: 100%;
    }
    .rf > span { display: flex; flex: none; align-items: flex-start; }
    .rf i {
      display: block; flex: none;
      background-image: url("${URL}");
      background-repeat: no-repeat;
      background-size: ${em(HUD_ATLAS.w)} ${em(HUD_ATLAS.h)};
      margin-right: ${(TRACK * CAP_EM).toFixed(4)}em;
    }
    .rf > span:last-child > i:last-child { margin-right: 0; }
    .rf > i.rf-sp { width: ${(SPACE * CAP_EM).toFixed(4)}em; background: none; }
    /* Anything the sheets don't draw still has to appear, so it falls back to
       a weight-matched typeface rather than vanishing. */
    .rf b {
      display: block; flex: none; font-weight: 900; font-style: italic;
      font-family: Impact, 'Arial Black', sans-serif;
      color: #f0e4d2; line-height: ${CAP_EM};
      margin-right: ${(TRACK * CAP_EM).toFixed(4)}em;
    }
  `;
  document.head.appendChild(style);
}

type Row = { box: HTMLElement; toks: { t: string; el: HTMLElement }[] };
const built = new WeakMap<HTMLElement, Row>();

/**
 * Draws `text` into `el` using the raster face. Cheap enough to call every
 * frame — the score and the trial clock both go through here — because the row
 * is diffed a WORD at a time and only the words that actually changed are
 * rebuilt. A ticking score is one word, so that is one span's worth of nodes.
 *
 * The glyphs go in a wrapper INSIDE `el` rather than turning `el` itself into
 * the flex row: `el` keeps whatever display the HUD's own CSS gave it, so
 * stacked readouts stay stacked and `text-align` still positions the line.
 */
export function setRasterText(el: HTMLElement, text: string): void {
  installHudFont();
  let row = built.get(el);
  if (!row) {
    const box = document.createElement("span");
    box.className = "rf";
    el.textContent = "";
    el.appendChild(box);
    row = { box, toks: [] };
    built.set(el, row);
  }
  const { box, toks } = row;
  const src = text.toUpperCase().replace(ALIAS_RE, (c) => ALIAS[c]);
  // words and single spaces, in order — one flex item each, so the row can
  // only break between them
  const want = src.match(/[^ \u00a0]+|[ \u00a0]/g) ?? [];

  want.forEach((t, i) => {
    const cur = toks[i];
    if (cur && cur.t === t) return;
    const made = t === " " || t === "\u00a0" ? makeSpace() : makeWord(t);
    if (cur) box.replaceChild(made, cur.el);
    else box.appendChild(made);
    toks[i] = { t, el: made };
  });
  for (let i = toks.length - 1; i >= want.length; i--) {
    box.removeChild(toks[i].el);
    toks.pop();
  }
}

function makeSpace(): HTMLElement {
  const sp = document.createElement("i");
  sp.className = "rf-sp";
  return sp;
}

function makeWord(word: string): HTMLElement {
  const span = document.createElement("span");
  for (const ch of word) span.appendChild(makeGlyph(ch));
  return span;
}

function makeGlyph(ch: string): HTMLElement {
  const g = HUD_GLYPHS[ch];
  if (!g) {
    const fb = document.createElement("b");
    fb.textContent = ch;
    return fb;
  }
  const [x, y, w, h, t] = g;
  const em = (px: number) => `${((px / HUD_ATLAS.cap) * CAP_EM).toFixed(4)}em`;
  const i = document.createElement("i");
  i.style.width = em(w);
  i.style.height = em(h);
  i.style.marginTop = em(t);
  i.style.backgroundPosition = `${em(-x)} ${em(-y)}`;
  return i;
}
