// Bake the two hand-drawn alphabet sheets into one HUD font atlas.
//
//   node tools/bake-hudfont.mjs art/hudfont-sheet1.png art/hudfont-sheet2.png
//     -> public/hudfont.png       the packed atlas
//     -> src/hudfont-data.ts      per-glyph rects
//
// Three things make this harder than a normal sprite cut:
//
//  1. The letters INTERLOCK. Their wobbly outlines overlap, so a plain ink
//     projection merges most of a row into one blob — sheet 2's N..Z is a
//     single 1253px run. So it goes in two stages: split each row at the
//     columns that ARE empty, then, inside a blob holding more than one
//     glyph, walk the ink-per-column profile for VALLEYS — the narrow waists
//     where two outlines just touch — and cut at the deepest one near each
//     expected boundary. PLAN below gives the glyph count per blob, read off
//     the sheets, so the right NUMBER of cuts is a given rather than
//     something to infer. Cutting only inside a blob matters: the dash in the
//     punctuation row is wide and evenly inked, and a whole-row valley search
//     splits it down the middle.
//
//  2. The sheets carry DUPLICATES and gaps: sheet 1 repeats F, G, I, L and R,
//     and neither sheet has a Y. PICK below names the one cell to keep for
//     each character; the Y is grafted from this face's own V and I (see
//     drawY) so its weight and its navy/white/red banding match the rest.
//
//  3. Each row was drawn at its own size. Every glyph is normalised against
//     its OWN ROW's cap box — the MEDIAN top and bottom of that row, so that
//     Q's tail and the odd outline overshoot don't shrink their neighbours —
//     which puts a 4, an M and a full stop on one baseline.
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const [S1, S2] = process.argv.slice(2);
if (!S1 || !S2) {
  console.error('usage: node tools/bake-hudfont.mjs <sheet1.png> <sheet2.png>');
  process.exit(1);
}

// Glyphs per ink blob, per row, top to bottom, as drawn on the sheets.
// Each inner array must have one entry per zero-gap blob in that row; the
// entries say how many glyphs that blob holds.
const PLAN = {
  sheet1: [
    [1, 2, 1, 1, 2, 1], // A BC D E FG F
    [1, 1, 1, 1, 1, 1, 1, 1], // G H I I J K L L
    [1, 3, 1, 1, 1], // M NOP Q R R
    [2, 1, 1, 2, 1], // ST U V WX Z
  ],
  sheet2: [
    [9, 1, 1], // ABCDEFGHI L M
    [11], // N O P Q R S U W X I Z
    [9], // 1-9
    [9], // 1-8, 0
    [4, 1, 1, 3], // !?/, ' - ...
  ],
};

// character -> [sheet, row, index]. Sheet 1 carries the whole alphabet bar Y
// and is the heavier draw, so all the letters come from it; sheet 2 supplies
// the digits and the punctuation.
const PICK = {};
'ABCDEFG'.split('').forEach((c, i) => (PICK[c] = ['sheet1', 0, i]));
{
  const r1 = { H: 1, I: 2, J: 4, K: 5, L: 6 }; // row 1 is G H I I J K L L
  for (const [c, i] of Object.entries(r1)) PICK[c] = ['sheet1', 1, i];
}
'MNOPQR'.split('').forEach((c, i) => (PICK[c] = ['sheet1', 2, i]));
'STUVWXZ'.split('').forEach((c, i) => (PICK[c] = ['sheet1', 3, i]));
'123456789'.split('').forEach((c, i) => (PICK[c] = ['sheet2', 2, i]));
PICK['0'] = ['sheet2', 3, 8];
PICK['!'] = ['sheet2', 4, 0];
PICK['?'] = ['sheet2', 4, 1];
PICK['/'] = ['sheet2', 4, 2];
PICK[','] = ['sheet2', 4, 3];
PICK["'"] = ['sheet2', 4, 4];
PICK['-'] = ['sheet2', 4, 5];
PICK['.'] = ['sheet2', 4, 6];

const CAP = 80; // cap height in the atlas, in px
const PAD = 3;
const MAXW = 1024;
const TH = 150; // alpha above this counts as ink

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await b.newPage({ viewport: { width: 400, height: 400 } });
await page.goto('data:text/html,<body>');
const dataURL = (f) =>
  'data:image/png;base64,' + readFileSync(f).toString('base64');

const out = await page.evaluate(
  async ([srcs, PLAN, PICK, CAP, PAD, MAXW, TH]) => {
    const load = (s) =>
      new Promise((r) => {
        const i = new Image();
        i.onload = () => r(i);
        i.src = s;
      });
    const imgs = {};
    for (const [k, v] of Object.entries(srcs)) imgs[k] = await load(v);

    // ---- cut every sheet into rows of glyph rects -------------------------
    const cells = {};
    for (const [name, im] of Object.entries(imgs)) {
      const c = document.createElement('canvas');
      c.width = im.width;
      c.height = im.height;
      const cx = c.getContext('2d');
      cx.drawImage(im, 0, 0);
      const P = cx.getImageData(0, 0, c.width, c.height).data;
      const A = (x, y) => P[(y * c.width + x) * 4 + 3];

      const rowInk = [];
      for (let y = 0; y < c.height; y++) {
        let n = 0;
        for (let x = 0; x < c.width; x++) if (A(x, y) > TH) n++;
        rowInk.push(n);
      }
      const bands = [];
      for (let y = 0; y < c.height; y++) {
        if (rowInk[y] < 3) continue;
        let e = y;
        while (e + 1 < c.height && rowInk[e + 1] >= 3) e++;
        if (e - y > 25) bands.push([y, e]);
        y = e;
      }

      cells[name] = [];
      bands.forEach(([y0, y1], bi) => {
        const plan = PLAN[name][bi];
        if (!plan) return;
        const ink = new Array(c.width).fill(0);
        for (let x = 0; x < c.width; x++)
          for (let y = y0; y <= y1; y++) if (A(x, y) > TH) ink[x]++;

        // stage 1: the columns that are genuinely empty
        const blobs = [];
        for (let x = 0, s = -1; x <= c.width; x++) {
          if (x < c.width && ink[x] > 0) {
            if (s < 0) s = x;
          } else if (s >= 0) {
            if (x - s > 4) blobs.push([s, x - 1]);
            s = -1;
          }
        }
        if (blobs.length !== plan.length)
          throw new Error(
            `${name} row ${bi}: ${blobs.length} ink blobs, plan has ${plan.length}`,
          );

        // stage 2: valleys inside a blob that holds more than one glyph
        const row = [];
        blobs.forEach(([x0, x1], n) => {
          const want = plan[n];
          const edges = [x0 - 1];
          const slot = (x1 - x0 + 1) / want;
          for (let i = 1; i < want; i++) {
            const t = Math.round(x0 + slot * i);
            const w = Math.round(slot * 0.42);
            let best = t,
              bestPen = Infinity;
            for (
              let x = Math.max(x0 + 2, t - w);
              x <= Math.min(x1 - 2, t + w);
              x++
            ) {
              const pen = ink[x] + Math.abs(x - t) * 0.02; // deepest, then nearest
              if (pen < bestPen) {
                bestPen = pen;
                best = x;
              }
            }
            edges.push(best);
          }
          edges.push(x1 + 1);
          for (let i = 0; i < want; i++) {
            const a = edges[i] + 1,
              z = edges[i + 1];
            let tx = z,
              txe = a,
              ty = y1,
              tye = y0;
            for (let y = y0; y <= y1; y++)
              for (let x = a; x <= z; x++)
                if (A(x, y) > TH) {
                  if (x < tx) tx = x;
                  if (x > txe) txe = x;
                  if (y < ty) ty = y;
                  if (y > tye) tye = y;
                }
            if (txe < tx) throw new Error(`${name} row ${bi}: empty cell`);
            row.push({ x: tx, y: ty, w: txe - tx + 1, h: tye - ty + 1 });
          }
        });
        cells[name].push(row);
      });
    }

    // ---- cap box per row: MEDIAN top and bottom --------------------------
    const med = (a) => {
      const s = [...a].sort((p, q) => p - q);
      return s[s.length >> 1];
    };
    const capBox = {};
    for (const [sh, rows] of Object.entries(cells))
      rows.forEach((row, ri) => {
        const top = med(row.map((g) => g.y));
        const bot = med(row.map((g) => g.y + g.h));
        capBox[`${sh}/${ri}`] = { top, h: bot - top };
      });
    // The punctuation row has no cap letters — the dots would drag the median
    // to the baseline. Measure it off "!" and "?", which do span the cap box.
    {
      const row = cells.sheet2[4];
      const tall = [row[0], row[1]];
      capBox['sheet2/4'] = {
        top: Math.min(...tall.map((g) => g.y)),
        h: Math.max(...tall.map((g) => g.y + g.h)) - Math.min(...tall.map((g) => g.y)),
      };
    }

    // ---- lay the atlas out ------------------------------------------------
    const items = [];
    for (const [ch, [sh, ri, gi]] of Object.entries(PICK)) {
      const g = cells[sh][ri][gi];
      if (!g) throw new Error(`no cell for '${ch}' at ${sh}/${ri}/${gi}`);
      const cb = capBox[`${sh}/${ri}`];
      const k = CAP / cb.h;
      items.push({
        ch,
        draw: { sh, ...g },
        w: Math.max(1, Math.round(g.w * k)),
        h: Math.max(1, Math.round(g.h * k)),
        top: Math.round((g.y - cb.top) * k),
      });
    }

    // Y: this face has none. Graft one from its own V and I — the whole V,
    // squashed into the top of the cap box (never cropped, so no cut edge),
    // over a stem taken from the I's lower half. The V is drawn last so its
    // vertex outline closes over the stem's top.
    const vSrc = cells.sheet1[3][3]; // V
    const iSrc = cells.sheet1[1][2]; // I
    const kV = CAP / capBox['sheet1/3'].h;
    const yW = Math.round(vSrc.w * kV);
    items.push({
      ch: 'Y',
      w: yW,
      h: CAP,
      top: 0,
      graft: {
        v: { sh: 'sheet1', ...vSrc },
        i: { sh: 'sheet1', ...iSrc },
        vFrac: 0.6, // the V fills the top 60% of the cap box
        iFrom: 0.4, // stem is the I below 40% of its own height
        stemW: 0.34, // ...at 34% of the V's width
        lap: 0.1, // stem starts 10% of cap above the V's vertex
      },
    });

    // ':' — two of this face's own dots, stacked in the cap box.
    const dot = cells.sheet2[4][6];
    const kD = CAP / capBox['sheet2/4'].h;
    items.push({
      ch: ':',
      w: Math.round(dot.w * kD),
      h: CAP,
      top: 0,
      colon: { sh: 'sheet2', ...dot, k: kD },
    });

    // '+' — the trick plate joins tricks with it ("GRIND + KICKFLIP"), and the
    // sheets have no plus. Crossed copies of this face's own dash.
    const dash = cells.sheet2[4][5];
    items.push({
      ch: '+',
      w: Math.round(CAP * 0.6),
      h: CAP,
      top: 0,
      plus: { sh: 'sheet2', ...dash, mid: 0.56 },
    });

    items.sort((a, b) => b.h - a.h || a.ch.localeCompare(b.ch));
    let x = PAD,
      y = PAD,
      shelf = 0,
      atlasH = 0;
    for (const it of items) {
      if (x + it.w + PAD > MAXW) {
        x = PAD;
        y += shelf + PAD;
        shelf = 0;
      }
      it.ax = x;
      it.ay = y;
      x += it.w + PAD;
      if (it.h > shelf) shelf = it.h;
      atlasH = Math.max(atlasH, y + it.h + PAD);
    }

    const c = document.createElement('canvas');
    c.width = MAXW;
    c.height = atlasH;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    for (const it of items) {
      if (it.draw) {
        const s = it.draw;
        cx.drawImage(imgs[s.sh], s.x, s.y, s.w, s.h, it.ax, it.ay, it.w, it.h);
      } else if (it.graft) {
        const G = it.graft;
        const vH = Math.round(CAP * G.vFrac);
        const sw = Math.round(it.w * G.stemW);
        const sTop = vH - Math.round(CAP * G.lap);
        const iy = Math.round(G.i.h * G.iFrom);
        cx.drawImage(
          imgs[G.i.sh], G.i.x, G.i.y + iy, G.i.w, G.i.h - iy,
          it.ax + Math.round((it.w - sw) / 2), it.ay + sTop, sw, CAP - sTop,
        );
        cx.drawImage(
          imgs[G.v.sh], G.v.x, G.v.y, G.v.w, G.v.h,
          it.ax, it.ay, it.w, vH,
        );
      } else if (it.colon) {
        const D = it.colon;
        const dh = Math.round(D.h * D.k);
        for (const ty of [Math.round(CAP * 0.3) - dh, CAP - dh])
          cx.drawImage(imgs[D.sh], D.x, D.y, D.w, D.h, it.ax, it.ay + ty, it.w, dh);
      } else if (it.plus) {
        const D = it.plus;
        const len = it.w;
        const thick = Math.round((D.h / D.w) * len);
        const cxp = it.ax + it.w / 2,
          cyp = it.ay + CAP * D.mid;
        for (const rot of [0, Math.PI / 2]) {
          cx.save();
          cx.translate(cxp, cyp);
          cx.rotate(rot);
          cx.drawImage(imgs[D.sh], D.x, D.y, D.w, D.h, -len / 2, -thick / 2, len, thick);
          cx.restore();
        }
      }
    }

    // The sheets are scans: thousands of near-identical shades where there are
    // really only three inks. Snapping each pixel to the nearest one — keeping
    // its alpha, so the outer edge stays anti-aliased — both crisps the
    // letterforms and takes the atlas from 520KB to 109KB, because PNG now has
    // three colours to run-length rather than a cloud of them. The outline is
    // weighted slightly so it wins the blend zones rather than being nibbled
    // from both sides at once; a hard alpha cutout was tried here first and
    // visibly thinned it, hence the 16 alpha steps instead.
    const INKS = [
      [253, 253, 249, 1.0], // paper white, the inline
      [18, 50, 88, 0.9], // navy, the outline
      [216, 36, 29, 1.0], // red, the fill
    ];
    const img = cx.getImageData(0, 0, c.width, c.height);
    const D = img.data;
    for (let i = 0; i < D.length; i += 4) {
      if (D[i + 3] === 0) continue;
      let best = 0,
        bd = Infinity;
      for (let k = 0; k < INKS.length; k++) {
        const dr = D[i] - INKS[k][0],
          dg = D[i + 1] - INKS[k][1],
          db = D[i + 2] - INKS[k][2];
        const d = (dr * dr + dg * dg + db * db) * INKS[k][3];
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      D[i] = INKS[best][0];
      D[i + 1] = INKS[best][1];
      D[i + 2] = INKS[best][2];
      D[i + 3] = D[i + 3] & 0xf0; // 16 alpha steps: the outer edge stays
    } //  anti-aliased, the noise in it does not
    cx.putImageData(img, 0, 0);

    return {
      png: c.toDataURL('image/png'),
      w: c.width,
      h: c.height,
      glyphs: items
        .map((i) => ({ c: i.ch, x: i.ax, y: i.ay, w: i.w, h: i.h, t: i.top }))
        .sort((a, b) => a.c.localeCompare(b.c)),
    };
  },
  [{ sheet1: dataURL(S1), sheet2: dataURL(S2) }, PLAN, PICK, CAP, PAD, MAXW, TH],
);
await b.close();

writeFileSync('public/hudfont.png', Buffer.from(out.png.split(',')[1], 'base64'));

const rows = out.glyphs
  .map((g) => {
    const key = /^[A-Za-z_$][\w$]*$/.test(g.c) ? g.c : JSON.stringify(g.c);
    return `  ${key}: [${g.x}, ${g.y}, ${g.w}, ${g.h}, ${g.t}],`;
  })
  .join('\n');
writeFileSync(
  'src/hudfont-data.ts',
  `// GENERATED by tools/bake-hudfont.mjs — do not edit by hand.
//
// Rects into public/hudfont.png for the hand-drawn HUD display face.
// Every glyph is normalised to a ${CAP}px cap height.

/** [x, y, w, h, topOffsetBelowCapLine], all in atlas pixels. */
export type HudGlyph = readonly [number, number, number, number, number];

export const HUD_ATLAS = { w: ${out.w}, h: ${out.h}, cap: ${CAP} } as const;

export const HUD_GLYPHS: Readonly<Record<string, HudGlyph>> = {
${rows}
};
`,
);

console.log(`atlas ${out.w}x${out.h}, ${out.glyphs.length} glyphs, cap ${CAP}px`);
console.log('chars: ' + out.glyphs.map((g) => g.c).join(''));
