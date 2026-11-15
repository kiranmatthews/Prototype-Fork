// Sprite-stack bake: the game's own rider, posed by Animation Studio clips, captured from six sides and cut into slices.
//
//   node tools/sprite-stack/bake.mjs capture     pose the rider in the running game and store the six-sided captures
//   node tools/sprite-stack/bake.mjs build       captures -> stills for an image model, slice sheets and the manifest
//   node tools/sprite-stack/bake.mjs             capture if nothing is stored yet, then build
//   node tools/sprite-stack/bake.mjs reference   loops of the real rider, for the lab's side-by-side with the stack
//
//   build --recolour <dir> --style ink           rebuild the slices with colours from restyled stills in <dir>
//   build --colour-views 0,1,2,3 --style four-sides   colour from the four side stills only (no view from above)
//   capture --clips player.run,player.idle       capture only these clips
//
// `capture` and `reference` need the dev server (`npx vite --port 5190`, or --server <url>) and Playwright
// (PLAYWRIGHT_MODULE, and PLAYWRIGHT_CHROMIUM for a browser binary outside Playwright's own). `build` needs neither.
//
// Stored under tools/sprite-stack/.work/ (not committed): captures/ holds colour and depth for every frame; sheets/
// holds the stills an image model would restyle, one PNG per clip (one row per frame, five columns: front, left, back,
// right, top) and one strip per frame in sheets/<style>/strips/. A restyled set keeps either layout at any uniform
// scale and goes back in with --recolour. Slice sheets and the manifest go to .work/lab-data/ (--out): the lab page that
// read them from public/sprite-stack-lab/ was removed after the verdict (docs/SPRITE_STACK_LAB.md says how to restore it).
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng, decodePng, fromB64 } from './png.mjs';
import { GRID, boxOf, reduceView, reconstruct, buildPalette, key15, paletteMapper, sliceSheet, debugViews, VIEW_NAMES } from './volume.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const argv = process.argv.slice(2), command = ['capture', 'build', 'reference'].includes(argv[0]) ? argv[0] : 'all';
const option = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const OUT = path.resolve(ROOT, option('--out') ?? 'tools/sprite-stack/.work/lab-data'), STYLE = option('--style') ?? 'captured';
const WORK = path.resolve(ROOT, option('--work') ?? 'tools/sprite-stack/.work'), CAPTURES = path.join(WORK, 'captures');
const RECOLOUR = option('--recolour') ? path.resolve(option('--recolour')) : null, DEBUG = option('--debug') ? path.resolve(option('--debug')) : null;
const SERVER = option('--server') ?? 'http://127.0.0.1:5190', ONLY = option('--clips')?.split(',');
/** Views allowed to supply colour (0 front, 1 left, 2 back, 3 right, 4 top). */
const COLOUR_VIEWS = option('--colour-views')?.split(',').map(Number) ?? [0, 1, 2, 3, 4], SUBSET = COLOUR_VIEWS.length < 5;
const log = (...a) => console.log('BAKE', ...a);
const exists = (file) => access(file).then(() => true, () => false);

/** The clips baked for the lab: a core set on foot and on the board. `frames` is the sample count. */
const CLIPS = [
  { id: 'player.idle', label: 'Idle', group: 'On foot', frames: 10 },
  { id: 'player.walk', label: 'Walk', group: 'On foot', frames: 10 },
  { id: 'player.run', label: 'Run', group: 'On foot', frames: 10 },
  { id: 'player.jump', label: 'Jump', group: 'On foot', frames: 8 },
  { id: 'player.fall', label: 'Fall', group: 'On foot', frames: 5 },
  { id: 'player.land', label: 'Land', group: 'On foot', frames: 8 },
  { id: 'player.run-stop', label: 'Run stop', group: 'On foot', frames: 10 },
  { id: 'player.crouch', label: 'Crouch', group: 'On foot', frames: 6 },
  { id: 'player.crawl', label: 'Crawl', group: 'On foot', frames: 10 },
  { id: 'player.slide', label: 'Slide', group: 'On foot', frames: 10 },
  { id: 'player.hang', label: 'Ledge hang', group: 'On foot', frames: 5 },
  { id: 'player.slam', label: 'Body slam', group: 'On foot', frames: 12 },
  { id: 'player.skate-study.basic-rolling', label: 'Rolling', group: 'Board', frames: 10 },
  { id: 'player.skate-study.basic-ollie', label: 'Ollie', group: 'Board', frames: 14 },
  { id: 'player.skate-study.flip-kick', label: 'Kickflip', group: 'Board', frames: 14 },
  { id: 'player.skate-study.grab-indy', label: 'Indy grab', group: 'Board', frames: 12 },
  { id: 'player.skate-study.grind-normal', label: '50-50 grind', group: 'Board', frames: 8 },
  { id: 'player.skate-study.special-the-900', label: 'Tornado twist', group: 'Board', frames: 14 },
];

const slug = (id) => id.replace(/^player\./, '').replace(/[^a-z0-9]+/gi, '-');
const box = boxOf(), SHEET_VIEWS = [0, 1, 2, 3, 4];
const cellW = GRID.nx * GRID.ss, cellH = GRID.ny * GRID.ss, stripW = cellW * SHEET_VIEWS.length; // side views fill a cell; the top view sits at its foot

// ───────────────────────────── capture ─────────────────────────────
/** One clip's captures on disk: a length-prefixed JSON header, then colour and depth bytes for every view of every frame. */
const storeClip = async (id, frames) => {
  const head = Buffer.from(JSON.stringify({ frames: frames.map(f => ({ time: f.time, centre: f.centre, R: f.R, views: f.views.map(v => ({ w: v.w, h: v.h, near: v.near, far: v.far })) })) }));
  const size = Buffer.alloc(4); size.writeUInt32LE(head.length);
  await writeFile(path.join(CAPTURES, `${slug(id)}.cap.gz`), gzipSync(Buffer.concat([size, head, ...frames.flatMap(f => f.views.flatMap(v => [v.col, v.dep]))]), { level: 4 }));
};
const loadClip = async (id) => {
  const raw = gunzipSync(await readFile(path.join(CAPTURES, `${slug(id)}.cap.gz`))), n = raw.readUInt32LE(0), head = JSON.parse(raw.toString('utf8', 4, 4 + n));
  let at = 4 + n; const take = (bytes) => { const part = new Uint8Array(raw.buffer, raw.byteOffset + at, bytes); at += bytes; return part; };
  return head.frames.map(f => ({ ...f, views: f.views.map(v => ({ ...v, col: take(v.w * v.h * 4), dep: take(v.w * v.h * 4) })) }));
};

/** Open the game with the Animation Studio ready and the capture script loaded; `work` gets the page and the studio's clips. */
const withStudio = async (work) => {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    page.on('pageerror', e => log('pageerror', e.message.slice(0, 200)));
    // The dev server asks every open page to reload when any source file changes; this page must survive the capture.
    await page.route('**/@vite/client', async route => { const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replaceAll('location.reload()', 'void 0') }); });
    await page.goto(`${SERVER}/?playtest&level=codex-lab&lite`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game?.getCurrentLevel?.() && !window.__game.gameFlow?.blocksGameplay, null, { timeout: 480000 });
    await page.waitForTimeout(2500);
    await page.addScriptTag({ content: await readFile(path.join(HERE, 'page-capture.js'), 'utf8') });
    await work(page, await page.evaluate(() => window.__stackCapture.setup({})));
    await page.evaluate(() => window.__stackCapture.restore());
  } finally { await browser.close(); }
};

const capture = () => withStudio(async (page, info) => {
  const started = Date.now();
  const studioSeconds = +info.clips.reduce((a, c) => a + (c.end - c.start), 0).toFixed(1);
  log('studio clips', info.clips.length, 'seconds', studioSeconds);
  await mkdir(CAPTURES, { recursive: true });
  let index = { grid: GRID, clips: [] }; try { index = JSON.parse(await readFile(path.join(CAPTURES, 'index.json'), 'utf8')); } catch { /* first capture */ }
  Object.assign(index, { grid: GRID, studioClips: info.clips.length, studioSeconds });
  for (const spec of CLIPS.filter(c => !ONLY || ONLY.includes(c.id))) {
    const clip = info.clips.find(c => c.id === spec.id);
    if (!clip) { log('missing clip', spec.id); continue; }
    const span = clip.end - clip.start, loop = clip.loop === 'loop', n = spec.frames, frames = [];
    for (let f = 0; f < n; f++) {
      const time = clip.start + span * (loop ? f / n : f / (n - 1));
      // Anchor the capture box on the pose (snapped to whole voxels), so travelling and jumping clips stay inside it.
      const b = await page.evaluate(([id, t]) => window.__stackCapture.measure(id, [t]), [spec.id, time]);
      const centre = [0, 1, 2].map(k => Math.round((b.min[k] + b.max[k]) / 2 / GRID.voxel) * GRID.voxel);
      centre[1] = Math.max(centre[1], Math.round((b.min[1] + box.e[1] - .1) / GRID.voxel) * GRID.voxel); // never lose the feet
      const cap = await page.evaluate(([id, t, bx, px]) => window.__stackCapture.frame(id, t, bx, px), [spec.id, time, { c: centre, e: box.e }, box.px]);
      frames.push({ time, centre, R: cap.R, views: cap.views.map(v => ({ ...v, col: fromB64(v.col), dep: fromB64(v.dep) })) });
    }
    await storeClip(spec.id, frames);
    index.clips = [...index.clips.filter(c => c.id !== spec.id), { id: spec.id, frames: n, loop, span, speed: clip.speed ?? 1, studioName: clip.name }];
    await writeFile(path.join(CAPTURES, 'index.json'), JSON.stringify(index));
    log('captured', spec.id.padEnd(40), 'frames', String(n).padStart(2), 'elapsed s', ((Date.now() - started) / 1000).toFixed(0));
  }
});

// ───────────────────────────── reference ─────────────────────────────
/**
 * Loops of the rider as the game draws him, for the lab's side-by-side: the chase camera's angle (the lab draws the
 * stack from the same camera), enough poses to play smoothly, on the lab's background colour.
 */
const REFERENCE = { tile: [240, 320], cols: 8, background: '#15122a', clips: [
  { id: 'player.run', fps: 60, dist: 6.5, elev: 37, yaw: 52, height: 1.5, fov: 30 },
  { id: 'player.walk', fps: 30, dist: 6.5, elev: 37, yaw: 52, height: 1.5, fov: 30 },
  { id: 'player.skate-study.basic-ollie', fps: 20, dist: 7.5, elev: 37, yaw: 52, height: 1.9, fov: 35 },
] };
const reference = () => withStudio(async (page, info) => {
  const manifestPath = path.join(OUT, 'manifest.json'), manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await mkdir(path.join(OUT, 'reference'), { recursive: true });
  manifest.reference = { tile: REFERENCE.tile, cols: REFERENCE.cols, clips: { ...manifest.reference?.clips } }; // a partial run keeps the other loops
  for (const { id, fps, ...camera } of REFERENCE.clips.filter(c => !ONLY || ONLY.includes(c.id))) {
    const clip = info.clips.find(c => c.id === id);
    if (!clip) { log('missing clip', id); continue; }
    const span = clip.end - clip.start, loop = clip.loop === 'loop', n = Math.max(8, Math.round(span / (clip.speed ?? 1) * fps));
    const times = Array.from({ length: n }, (_, i) => clip.start + span * (loop ? i / n : i / (n - 1)));
    const url = await page.evaluate(([clipId, list, o]) => window.__stackCapture.reference(clipId, list, o), [id, times, { ...camera, w: REFERENCE.tile[0], h: REFERENCE.tile[1], cols: REFERENCE.cols, background: REFERENCE.background }]);
    const bytes = Buffer.from(url.split(',')[1], 'base64'), file = `reference/${slug(id)}.webp`;
    await writeFile(path.join(OUT, file), bytes);
    manifest.reference.clips[id] = { file, frames: n, ...camera };
    log('reference', id.padEnd(40), 'poses', String(n).padStart(3), 'KB', (bytes.length / 1024).toFixed(0));
  }
  await writeFile(manifestPath, JSON.stringify(manifest));
});

// ───────────────────────────── build ─────────────────────────────
/** A restyled picture for one frame: its own strip (`<slug>-f00.png`, optionally under strips/) or a row of the clip's sheet. */
const restyledCache = new Map();
const restyled = async (id, frame) => {
  const strip = `${slug(id)}-f${String(frame).padStart(2, '0')}.png`;
  for (const [file, row] of [[path.join(RECOLOUR, 'strips', strip), 0], [path.join(RECOLOUR, strip), 0], [path.join(RECOLOUR, `${slug(id)}.png`), frame]]) {
    if (!(await exists(file))) continue;
    if (!restyledCache.has(file)) { restyledCache.clear(); restyledCache.set(file, decodePng(await readFile(file))); }
    return { image: restyledCache.get(file), row };
  }
  return null;
};

const build = async () => {
  const started = Date.now(), index = JSON.parse(await readFile(path.join(CAPTURES, 'index.json'), 'utf8'));
  if (index.grid.nx !== GRID.nx || index.grid.voxel !== GRID.voxel) throw new Error('stored captures use another grid: run `capture` again');
  const sheets = path.join(WORK, 'sheets', STYLE), writeSheets = !RECOLOUR && !SUBSET;
  await mkdir(path.join(OUT, STYLE), { recursive: true });
  if (writeSheets) await mkdir(path.join(sheets, 'strips'), { recursive: true });
  if (DEBUG) await mkdir(DEBUG, { recursive: true });
  const histogram = new Map(), baked = [];
  let missing = 0;
  for (const spec of CLIPS.filter(c => !ONLY || ONLY.includes(c.id))) {
    const stored = index.clips.find(c => c.id === spec.id);
    if (!stored) { log('not captured', spec.id); continue; }
    const frames = await loadClip(spec.id), n = frames.length, volumes = [], offsets = [];
    const sheetPixels = writeSheets ? new Uint8Array(stripW * cellH * n * 4) : null;
    for (const [f, frame] of frames.entries()) {
      if (sheetPixels) for (const [col, v] of SHEET_VIEWS.entries()) { // stills: rows top-down, frame by frame
        const view = frame.views[v], y0 = f * cellH + (cellH - view.h);
        for (let y = 0; y < view.h; y++) sheetPixels.set(view.col.subarray((view.h - 1 - y) * view.w * 4, (view.h - y) * view.w * 4), ((y0 + y) * stripW + col * cellW) * 4);
      }
      if (RECOLOUR) { // swap in the restyled colours where the capture is covered; the shape (alpha, depth) stays the capture's own
        const hit = await restyled(spec.id, f);
        if (!hit) missing++;
        else {
          const { image, row } = hit, scale = image.width / stripW;
          for (const [col, v] of SHEET_VIEWS.entries()) {
            const view = frame.views[v], y0 = row * cellH + (cellH - view.h), styled = new Uint8Array(view.col);
            for (let y = 0; y < view.h; y++) for (let x = 0; x < view.w; x++) {
              const o = (y * view.w + x) * 4; if (view.col[o + 3] < 128) continue;
              const sx = Math.min(image.width - 1, Math.floor((col * cellW + x + .5) * scale)), sy = Math.min(image.height - 1, Math.floor((y0 + (view.h - 1 - y) + .5) * scale)), q = (sy * image.width + sx) * 4;
              if (image.pixels[q + 3] < 96) continue; // the restyle left this pixel empty: keep the captured colour
              styled[o] = image.pixels[q]; styled[o + 1] = image.pixels[q + 1]; styled[o + 2] = image.pixels[q + 2];
            }
            view.col = styled;
          }
        }
      }
      const vol = reconstruct(frame.views.map(v => reduceView(v)), frame.R, { colourViews: COLOUR_VIEWS, borrow: !SUBSET });
      for (let o = 0; o < vol.solid.length; o++) if (vol.solid[o]) { const key = key15(vol.rgb[o * 3], vol.rgb[o * 3 + 1], vol.rgb[o * 3 + 2]); histogram.set(key, (histogram.get(key) ?? 0) + 1); }
      volumes.push(vol); offsets.push(frame.centre.map(v => Math.round(v / GRID.voxel)));
      if (DEBUG && f === 0) { const d = debugViews(vol.solid, vol.rgb); await writeFile(path.join(DEBUG, `${slug(spec.id)}-${STYLE}.png`), encodePng(d.pixels, d.width, d.height)); }
    }
    if (sheetPixels) {
      await writeFile(path.join(sheets, `${slug(spec.id)}.png`), encodePng(sheetPixels, stripW, cellH * n));
      for (let f = 0; f < n; f++) await writeFile(path.join(sheets, 'strips', `${slug(spec.id)}-f${String(f).padStart(2, '0')}.png`), encodePng(sheetPixels.subarray(f * cellH * stripW * 4, (f + 1) * cellH * stripW * 4), stripW, cellH));
    }
    baked.push({ spec, stored, volumes, offsets });
    log(spec.id.padEnd(40), 'frames', String(n).padStart(2), 'mean solid voxels', Math.round(volumes.reduce((a, v) => a + v.filled, 0) / n));
  }
  if (missing) log('frames with no restyled picture (captured colour kept):', missing);

  // One palette for the whole style, then one grey slice sheet per clip (grey value = palette index, 0 = empty).
  const palette = buildPalette(histogram, 255), mapper = paletteMapper(palette), clips = [];
  let bytes = 0;
  for (const { spec, stored, volumes, offsets } of baked) {
    const indexed = volumes.map(v => { const out = new Uint8Array(v.solid.length); for (let o = 0; o < out.length; o++) if (v.solid[o]) out[o] = mapper(v.rgb[o * 3], v.rgb[o * 3 + 1], v.rgb[o * 3 + 2]); return out; });
    const sheet = sliceSheet(indexed), png = encodePng(sheet.pixels, sheet.width, sheet.height, 1);
    await writeFile(path.join(OUT, STYLE, `${slug(spec.id)}.png`), png); bytes += png.length;
    clips.push({ id: spec.id, slug: slug(spec.id), label: spec.label, group: spec.group, studioName: stored.studioName, frames: volumes.length, loop: stored.loop, seconds: +(stored.span / stored.speed).toFixed(3), offsets });
  }
  // Merge into the manifest: geometry and clip list are shared by every style; each style adds its palette.
  const manifestPath = path.join(OUT, 'manifest.json');
  let manifest = null; try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { /* first build */ }
  const fresh = { version: 1, grid: [GRID.nx, GRID.ny, GRID.nz], voxel: GRID.voxel, sheet: { cell: [cellW, cellH], views: SHEET_VIEWS.map(v => VIEW_NAMES[v]) }, source: { studioClips: index.studioClips, studioSeconds: index.studioSeconds }, clips, styles: {} };
  if (!manifest || writeSheets) manifest = { ...fresh, styles: manifest?.styles ?? {}, ...(manifest?.reference ? { reference: manifest.reference } : {}) };
  manifest.styles[STYLE] = { palette: palette.map(c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')), bytes };
  await writeFile(manifestPath, JSON.stringify(manifest));
  log('style', STYLE, 'clips', clips.length, 'frames', clips.reduce((a, c) => a + c.frames, 0), 'palette', palette.length, 'slice sheets KB', (bytes / 1024).toFixed(0), 'total s', ((Date.now() - started) / 1000).toFixed(0));
};

if (command === 'capture' || (command === 'all' && !(await exists(path.join(CAPTURES, 'index.json'))))) await capture();
if (command === 'reference') await reference();
else if (command !== 'capture') await build();
