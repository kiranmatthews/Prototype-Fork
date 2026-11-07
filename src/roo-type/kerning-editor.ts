import './kerning-editor.css';
import { ROO_ATLAS_METRICS } from './atlas-metrics';
import { layoutRooAtlas, RooAtlasPainter, rooAtlasGlyphRect } from './atlas';
import { getRooAppearance, setRooAppearance, rooAppearanceIsSaved, ROO_APPEARANCE_EVENT } from './settings';
import { exportRooPairs, isRooPair, pairsInText, parseRooPairs, roundRooSpacing, type RooPairSpacing } from './kerning';
import { analyzeRooPair, loadKerningImage } from './kerning-analysis';

const COMMON = ['AV', 'VA', 'WA', 'AW', 'TA', 'AT', 'AY', 'YA', 'LT', 'LY', 'TY', 'TO', 'YO', 'OO', 'RO', 'BO', 'ON', 'NU', 'US', 'GA', 'ME', 'OV', 'VE', 'ER', '11', '10', '00', '0/', '/2', '23', '99', '1:', ':0'];
const labelPair = (pair: string) => pair.replace(/ /g, '␣');
const amount = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value * 100).toFixed(1)}`;
const same = (a: RooPairSpacing, b: RooPairSpacing) => exportRooPairs(a) === exportRooPairs(b);

export function createKerningEditor(root: HTMLElement, painter: RooAtlasPainter): { refresh(): void } {
  root.className = 'kerning-editor';
  root.innerHTML = `
    <div class="kern-heading"><div><div class="kern-eyebrow">ROO PNG FONT / KERNING</div><h1>Make every pair feel right.</h1><p>Choose two characters. Adjust their space. See it everywhere.</p></div>
      <div class="kern-file-actions"><button id="kern-import">Import</button><button id="kern-export">Export adjustments ↗</button><input id="kern-file" type="file" accept=".json,application/json" hidden></div></div>
    <div class="kern-workspace">
      <section class="kern-browser" aria-label="Find character combinations">
        <div class="kern-section-title">01 / CHOOSE A PAIR</div>
        <label for="kern-search">Find characters<input id="kern-search" type="search" placeholder="Try A, AV or 0/" maxlength="2" autocomplete="off" spellcheck="false"></label>
        <div class="kern-filters" role="group" aria-label="Pair list"><button data-filter="text" aria-pressed="true">In text</button><button data-filter="common" aria-pressed="false">Common</button><button data-filter="edited" aria-pressed="false">Edited <span id="kern-count">0</span></button></div>
        <div id="kern-pairs" class="kern-pairs"></div><p class="kern-small">␣ means a space. A→V and V→A are separate pairs.</p>
      </section>
      <div class="kern-preview-column">
        <section class="kern-inspector" aria-label="Pair preview">
          <div class="kern-stage-toolbar"><span class="kern-section-title">02 / FIND THE SWEET SPOT</span><div><button id="kern-undo" aria-label="Undo pair spacing" title="Undo (⌘/Ctrl Z)" disabled>↶ Undo</button><button id="kern-redo" aria-label="Redo pair spacing" title="Redo (⌘/Ctrl Shift Z)" disabled>↷</button></div></div>
          <div class="kern-stage" id="kern-stage"><canvas id="kern-canvas" tabindex="0" role="slider" aria-label="Pair spacing. Drag horizontally or use left and right arrows." aria-valuemin="-30" aria-valuemax="30" aria-valuenow="0"></canvas><span class="kern-stage-label" id="kern-stage-label"></span><span class="kern-drag-hint">↔ Drag to adjust · ← → fine tune · Shift for larger steps</span></div>
          <div class="kern-preview-tools"><label>Color<select id="kern-palette"><option value="counter">Gold / vermilion</option><option value="bonus">Green / cobalt</option></select></label><label class="kern-check"><input id="kern-guides" type="checkbox" checked>Guides</label><label class="kern-check"><input id="kern-light" type="checkbox">Light backdrop</label><button id="kern-compare" aria-pressed="false">Compare original</button></div>
        </section>
        <section class="kern-context" aria-label="Preview in words"><div class="kern-section-title">03 / CHECK IT IN CONTEXT</div>
          <label for="kern-text">Your text<input id="kern-text" type="text" value="AVATAR WAY TO PLAY" maxlength="80" spellcheck="false" autocomplete="off"></label>
          <div class="kern-samples" role="group" aria-label="Sample text"><button data-sample="BONEMAN BONUS GAME OVER">Menus</button><button data-sample="AVATAR WAY TO PLAY">Tricky letters</button><button data-sample="0/23 11:00 99 100">Counters</button></div>
          <p id="kern-unsupported" class="kern-warning" hidden></p><div id="kern-word-pairs" class="kern-word-pairs" aria-label="Select a pair from your text"></div>
          <div class="kern-proof"><span>Original</span><canvas id="kern-original" aria-label="Text with original pair spacing"></canvas><span>With your edits</span><canvas id="kern-current" aria-label="Text with your pair adjustments"></canvas></div>
          <p class="kern-small">Preview at 32px cap height. Long text scrolls horizontally. Click a pair above to edit it.</p>
        </section>
      </div>
      <section class="kern-controls" aria-label="Pair spacing controls">
        <div class="kern-section-title">PAIR ADJUSTMENT</div>
        <div class="kern-glyph-selectors"><label>First character<select id="kern-first"></select></label><span>→</span><label>Next character<select id="kern-second"></select></label></div>
        <div class="kern-number"><button id="kern-minus" aria-label="Move letters closer">−</button><label><input id="kern-value" aria-label="Pair adjustment in pixels at 100px cap height" type="number" min="-30" max="30" step="0.1"><span>px at 100px cap height</span></label><button id="kern-plus" aria-label="Move letters apart">+</button></div>
        <input id="kern-range" aria-label="Pair adjustment" type="range" min="-30" max="30" step="0.1"><div class="kern-range-labels"><span>Closer</span><span>Farther apart</span></div>
        <p id="kern-effect" class="kern-effect"></p><button id="kern-reset">Reset this pair</button>
        <div class="kern-suggestion"><div class="kern-section-title">A HELPING EYE</div><p id="kern-gap">Reading the painted edges…</p><button id="kern-suggest" class="primary" disabled>Suggest spacing</button><p class="kern-small" id="kern-suggestion-note">Uses the shape of the letters to suggest a comfortable gap.</p></div>
        <div class="kern-help"><p>Edits apply to <strong>both colorways</strong>, at every size, in menus and the HUD.</p><p>The overall letter spacing stays separate. Original PNG artwork stays intact.</p></div>
        <button id="kern-reset-all">Reset all pair edits</button>
      </section>
    </div>
    <footer class="kern-footer"><span id="kern-save">Saved in this browser · live in open game tabs</span><span id="kern-message" role="status" aria-live="polite"></span></footer>`;

  const el = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#kern-${id}`)!;
  const input = (id: string) => el<HTMLInputElement>(id);
  const button = (id: string) => el<HTMLButtonElement>(id);
  const canvas = el<HTMLCanvasElement>('canvas');
  const query = new URLSearchParams(location.search);
  let selected = (query.get('pair') ?? 'AV').toUpperCase(); if (!isRooPair(selected)) selected = 'AV';
  if (query.get('palette') === 'bonus') input('palette').value = 'bonus';
  if (query.has('text')) input('text').value = query.get('text')!.slice(0, 80).toUpperCase();
  let filter = 'text', image: HTMLImageElement | null = null, imagePalette = '', loadVersion = 0;
  let undo: RooPairSpacing[] = [], redo: RooPairSpacing[] = [], lastPairs = getRooAppearance().pairSpacing, ownChange = false;
  let gesture: RooPairSpacing | null = null, drag: { x: number; value: number; cap: number } | null = null;
  let drawing: { cap: number } = { cap: 180 }, analysis: ReturnType<typeof analyzeRooPair> = null;
  let comparing = false;
  const current = () => getRooAppearance().pairSpacing[selected] ?? 0;
  const palette = () => input('palette').value as 'bonus' | 'counter';
  const message = (text: string) => { el('message').textContent = text; };
  for (const id of ['first', 'second']) {
    const select = el<HTMLSelectElement>(id);
    for (const char of Object.keys(ROO_ATLAS_METRICS.counter.glyphs)) select.add(new Option(char === ' ' ? '␣ Space' : char, char));
    select.addEventListener('change', () => selectPair(input('first').value + input('second').value));
  }
  function remember(before: RooPairSpacing) {
    if (same(before, getRooAppearance().pairSpacing)) return;
    undo.push(before); if (undo.length > 100) undo.shift(); redo = [];
  }
  function write(pairs: RooPairSpacing) {
    ownChange = true; setRooAppearance({ pairSpacing: pairs }); ownChange = false;
  }
  function change(value: number, record = true) {
    if (!Number.isFinite(value)) { refresh(); return; }
    const before = getRooAppearance().pairSpacing, next = roundRooSpacing(value);
    if (next === current()) { refresh(); return; }
    write({ ...before, [selected]: next }); if (record) remember(before); refresh();
  }
  function endGesture() { if (gesture) { remember(gesture); gesture = null; refresh(); } }
  function selectPair(pair: string) {
    endGesture(); selected = pair; comparing = false;
    const url = new URL(location.href); url.searchParams.set('pair', pair); history.replaceState(null, '', url);
    refresh();
  }
  function candidates() {
    const search = input('search').value.toUpperCase();
    const pairs = filter === 'edited' ? Object.keys(getRooAppearance().pairSpacing).sort() : filter === 'common' ? COMMON : pairsInText(input('text').value);
    if (search.length === 2 && isRooPair(search)) return [search];
    if (search && filter !== 'edited') return [...new Set([...pairs, ...Object.keys(ROO_ATLAS_METRICS.counter.glyphs).flatMap(char => [search + char, char + search])])].filter(isRooPair).filter(pair => pair.includes(search));
    return pairs.filter(pair => pair.includes(search));
  }
  function pairButton(pair: string, compact = false) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.pair = pair;
    b.setAttribute('aria-pressed', String(selected === pair)); b.setAttribute('aria-label', `Edit ${labelPair(pair)} spacing`);
    const name = document.createElement('strong'); name.textContent = labelPair(pair); b.append(name);
    if (!compact) { const value = getRooAppearance().pairSpacing[pair] ?? 0, badge = document.createElement('span'); badge.textContent = value ? amount(value) : '—'; badge.className = value ? 'kern-edited' : ''; b.append(badge); }
    b.addEventListener('click', () => selectPair(pair)); return b;
  }
  function renderPairs() {
    const list = el('pairs'), focus = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLButtonElement>('#kern-pairs button, #kern-word-pairs button')?.dataset.pair : undefined;
    const wasWord = !!document.activeElement?.closest('#kern-word-pairs');
    const scroll = list.scrollTop, pairs = candidates(); list.replaceChildren(...pairs.map(pair => pairButton(pair)));
    if (!pairs.length) { const empty = document.createElement('p'); empty.className = 'kern-empty'; empty.textContent = filter === 'edited' ? 'No edited pairs yet. Pick any two characters to begin.' : 'Type a word below, or choose Common pairs.'; list.append(empty); }
    list.scrollTop = scroll;
    const wordPairs = el('word-pairs'); wordPairs.replaceChildren(...pairsInText(input('text').value).map(pair => pairButton(pair, true)));
    if (focus) { const group = wasWord ? wordPairs : list; [...group.querySelectorAll<HTMLButtonElement>('button')].find(b => b.dataset.pair === focus)?.focus({ preventScroll: true }); }
    el('count').textContent = String(Object.keys(getRooAppearance().pairSpacing).length);
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-filter]')) b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
  }
  function setupCanvas(target: HTMLCanvasElement, width: number, height: number) {
    const ratio = Math.max(1, devicePixelRatio);
    const w = Math.ceil(width * ratio), h = Math.ceil(height * ratio);
    if (target.width !== w || target.height !== h) { target.width = w; target.height = h; }
    const ctx = target.getContext('2d')!; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
    return ctx;
  }
  function drawInspector() {
    if (root.hidden || !canvas.clientWidth) return;
    const width = canvas.clientWidth, height = canvas.clientHeight, ctx = setupCanvas(canvas, width, height);
    if (!image || imagePalette !== palette()) return;
    const metrics = ROO_ATLAS_METRICS[palette()], tracking = getRooAppearance().tracking;
    const pairs = comparing ? {} : getRooAppearance().pairSpacing;
    const layout = layoutRooAtlas(metrics, selected, tracking, pairs)!;
    const original = layoutRooAtlas(metrics, selected, tracking, {})!;
    // Anchor the first letter and reserve the full edit range: no zoom or recentering while dragging.
    const span = Math.max(1.15, original.width + .6), cap = Math.min(238, (width - 76) / span, height - 106);
    const x = (width - original.width * cap) / 2 - original.min * cap - .15 * cap, y = (height - cap) / 2;
    drawing = { cap };
    const light = input('light').checked;
    ctx.strokeStyle = light ? '#68726555' : '#acc9b732'; ctx.lineWidth = 1;
    if (input('guides').checked) {
      ctx.setLineDash([4, 5]);
      for (const line of [y, y + cap]) { ctx.beginPath(); ctx.moveTo(20, line); ctx.lineTo(width - 20, line); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.fillStyle = light ? '#4b5b4e' : '#7a9184'; ctx.font = '10px ui-monospace, monospace'; ctx.fillText('CAP', 20, y - 8); ctx.fillText('BASE', 20, y + cap + 15);
    }
    const drawGlyphs = (target: typeof layout, alpha: number) => {
      ctx.globalAlpha = alpha;
      for (const entry of target.glyphs) {
        const glyph = metrics.glyphs[entry.char], rect = rooAtlasGlyphRect(metrics, entry);
        ctx.drawImage(image!, glyph.x, glyph.y, glyph.width, glyph.height, x + rect.x * cap, y + rect.y * cap, rect.width * cap, rect.height * cap);
      }
      ctx.globalAlpha = 1;
    };
    if (input('guides').checked && current() && !comparing) drawGlyphs(original, .14);
    drawGlyphs(layout, 1);
    if (input('guides').checked) {
      for (const entry of layout.glyphs) {
        const glyph = metrics.glyphs[entry.char]; ctx.strokeStyle = light ? '#4e684855' : '#c9efa63d';
        ctx.strokeRect(x + (entry.x + glyph.inkLeft * entry.sx) * cap, y + (glyph.inkTop ?? 0) * cap,
          (glyph.inkRight - glyph.inkLeft) * entry.sx * cap, ((glyph.inkBottom ?? 1) - (glyph.inkTop ?? 0)) * cap);
      }
    }
    canvas.setAttribute('aria-valuenow', String(current() * 100));
    canvas.setAttribute('aria-valuetext', `${labelPair(selected)}, ${amount(current())} pixels at 100 pixel cap height`);
    el('stage-label').textContent = `${labelPair(selected)} / ${comparing ? 'ORIGINAL' : 'LIVE'} · ${Math.round(cap)}px cap`;
    el('stage').classList.toggle('is-light', light);
  }
  function drawContext() {
    if (root.hidden) return;
    const raw = input('text').value.toUpperCase(), metrics = ROO_ATLAS_METRICS[palette()];
    const unsupported = [...new Set([...raw].filter(char => !metrics.glyphs[char]))];
    const warning = el('unsupported'); warning.hidden = !unsupported.length;
    warning.textContent = `No PNG glyph for ${unsupported.join(' ')}. Those characters are shown as spaces in the preview.`;
    const text = [...raw].map(char => metrics.glyphs[char] ? char : ' ').join('');
    const settings = getRooAppearance(), layouts = [{}, settings.pairSpacing].map(pairs => layoutRooAtlas(metrics, text, settings.tracking, pairs)!);
    const width = Math.max(220, ...layouts.map(layout => layout.width * 32 + 24));
    for (const [i, id] of ['original', 'current'].entries()) {
      const target = el<HTMLCanvasElement>(id); target.style.width = `${Math.ceil(width)}px`;
      const ctx = setupCanvas(target, width, 58);
      painter.draw(ctx, text, 12, 29, { size: 32, palette: palette(), pairSpacing: i ? settings.pairSpacing : {}, lightPosition: 0 });
    }
  }
  function updateAnalysis() {
    analysis = image && imagePalette === palette() ? analyzeRooPair(image, ROO_ATLAS_METRICS[palette()], selected, getRooAppearance().tracking, current()) : null;
    button('suggest').disabled = !analysis || comparing;
    button('suggest').textContent = analysis ? `Try ${amount(analysis.suggestion)} px` : 'Suggest spacing';
    el('gap').textContent = analysis ? (analysis.gap < 0 ? `Painted edges overlap by about ${(-analysis.gap * 100).toFixed(1)}px.` : `Closest painted gap: about ${(analysis.gap * 100).toFixed(1)}px.`) : selected.includes(' ') ? 'Spaces have no painted edge. Adjust by eye in your words.' : 'Reading the painted edges…';
    el('gap').classList.toggle('kern-warning', !!analysis && analysis.gap < 0);
    el('suggestion-note').textContent = analysis?.limited ? 'Suggestion reaches the adjustment limit. Check the letters by eye.' : 'Measured at 100px cap height. A starting point based on the painted contours; your eye has the final say.';
  }
  async function ensureImage() {
    const chosen = palette(), version = ++loadVersion;
    try {
      const loaded = await loadKerningImage(chosen);
      if (version !== loadVersion) return;
      image = loaded; imagePalette = chosen; updateAnalysis(); drawInspector();
    } catch (error) { if (version === loadVersion) message(String(error)); }
  }
  function refresh() {
    const value = current(), count = Object.keys(getRooAppearance().pairSpacing).length;
    input('first').value = selected[0]; input('second').value = selected[1];
    input('range').value = (value * 100).toFixed(1);
    if (document.activeElement !== input('value')) input('value').value = (value * 100).toFixed(1);
    el('effect').textContent = !value ? 'Original spacing for this pair.' : `${Math.abs(value * 100).toFixed(1)}px ${value < 0 ? 'closer' : 'farther apart'} at 100px. Scales with the text.`;
    button('reset').disabled = !value; button('reset-all').disabled = !count;
    button('undo').disabled = !undo.length; button('redo').disabled = !redo.length;
    button('compare').setAttribute('aria-pressed', String(comparing)); button('compare').textContent = comparing ? 'Viewing original · return' : 'Compare original';
    for (const id of ['value', 'range', 'minus', 'plus']) input(id).disabled = comparing;
    el('save').textContent = rooAppearanceIsSaved() ? '● Saved in this browser · live in open game tabs' : 'Session only · browser storage unavailable. Export to keep your edits.';
    el('save').classList.toggle('kern-warning', !rooAppearanceIsSaved());
    renderPairs(); updateAnalysis(); drawInspector(); drawContext();
  }
  button('minus').onclick = () => change(current() - .001);
  button('plus').onclick = () => change(current() + .001);
  input('value').onfocus = () => { gesture = getRooAppearance().pairSpacing; };
  input('value').oninput = () => { if (Number.isFinite(input('value').valueAsNumber)) change(input('value').valueAsNumber / 100, false); };
  input('value').onblur = endGesture;
  input('value').onchange = () => { change(input('value').valueAsNumber / 100, false); endGesture(); };
  input('range').onpointerdown = () => { gesture = getRooAppearance().pairSpacing; };
  input('range').oninput = () => change(input('range').valueAsNumber / 100, !gesture);
  input('range').onchange = endGesture; input('range').onblur = endGesture;
  button('reset').onclick = () => change(0);
  button('reset-all').onclick = () => { const before = getRooAppearance().pairSpacing; write({}); remember(before); message('All pair edits reset. Undo brings them back.'); refresh(); };
  button('suggest').onclick = () => { if (analysis) { change(analysis.suggestion); message(`Applied the optical suggestion for ${labelPair(selected)}.`); } };
  button('undo').onclick = () => { endGesture(); const before = undo.pop(); if (before) { redo.push(getRooAppearance().pairSpacing); write(before); refresh(); message('Undid pair spacing.'); } };
  button('redo').onclick = () => { endGesture(); const next = redo.pop(); if (next) { undo.push(getRooAppearance().pairSpacing); write(next); refresh(); message('Redid pair spacing.'); } };
  button('compare').onclick = () => { comparing = !comparing; refresh(); };
  for (const id of ['guides', 'light']) input(id).onchange = drawInspector;
  input('palette').onchange = () => { refresh(); void ensureImage(); };
  input('text').oninput = () => { renderPairs(); drawContext(); };
  input('search').oninput = renderPairs;
  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-filter]')) b.onclick = () => { filter = b.dataset.filter!; renderPairs(); };
  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-sample]')) b.onclick = () => { input('text').value = b.dataset.sample!; filter = 'text'; input('search').value = ''; renderPairs(); drawContext(); };
  canvas.onpointerdown = event => {
    if (comparing || event.button !== 0) return;
    canvas.focus(); canvas.setPointerCapture(event.pointerId); gesture = getRooAppearance().pairSpacing;
    drag = { x: event.clientX, value: current(), cap: drawing.cap };
  };
  canvas.onpointermove = event => { if (drag) change(drag.value + (event.clientX - drag.x) / drag.cap, false); };
  canvas.onpointerup = canvas.onpointercancel = () => { drag = null; endGesture(); };
  canvas.onlostpointercapture = () => { drag = null; endGesture(); };
  canvas.onkeydown = event => {
    if (comparing || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); change(current() + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? .01 : .001));
  };
  root.addEventListener('keydown', event => {
    if (!event.metaKey && !event.ctrlKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.key.toLowerCase() === 'z') { event.preventDefault(); button(event.shiftKey ? 'redo' : 'undo').click(); }
  });
  button('export').onclick = () => {
    const url = URL.createObjectURL(new Blob([exportRooPairs(getRooAppearance().pairSpacing)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'roo-pair-spacing.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('Exported pair adjustments. Import merges them into another browser.');
  };
  button('import').onclick = () => input('file').click();
  input('file').onchange = async () => {
    const file = input('file').files?.[0]; if (!file) return;
    try {
      if (file.size > 200_000) throw Error('This file is too large for a pair-spacing preset.');
      const imported = parseRooPairs(await file.text()), before = getRooAppearance().pairSpacing;
      write({ ...before, ...imported }); remember(before); filter = 'edited'; input('search').value = '';
      message(`Imported ${Object.keys(imported).length} pairs. Other edits kept; Undo reverses the import.`); refresh();
    } catch (error) { message(error instanceof Error ? error.message : 'Could not read this file.'); }
    finally { input('file').value = ''; }
  };
  window.addEventListener(ROO_APPEARANCE_EVENT, () => {
    const next = getRooAppearance().pairSpacing;
    if (!ownChange && !same(lastPairs, next)) { undo = []; redo = []; gesture = null; drag = null; message('Pair spacing updated from another control or tab.'); }
    lastPairs = next; refresh();
  });
  new ResizeObserver(() => { drawInspector(); drawContext(); }).observe(el('stage'));
  refresh(); void ensureImage();
  return { refresh };
}
