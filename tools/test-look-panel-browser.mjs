// Real Chrome input/DOM regression and paired CPU benchmark. The optional
// baseline revision is read from Git, served as modules, and never checked out.
// node tools/test-look-panel-browser.mjs <vite-url> [baseline-git-ref]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5290';
const baseline = process.argv[3];
const output = process.env.LOOK_PANEL_OUTPUT || '/private/tmp/look-panel-performance';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { baseline: baseline ?? null, runs: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/__look-panel-test', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>LOOK panel regression</title><body style="background:#202024">',
  }));
  if (baseline) {
    for (const name of ['panel', 'settings']) {
      const source = execFileSync('git', ['show', `${baseline}:src/visual-treatment/${name}.ts`], { encoding: 'utf8' });
      const javascript = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
      }).outputText.replace(/from "\.\/settings"/g, 'from "/__look-baseline-settings.js"');
      await page.route(`**/__look-baseline-${name}.js`, route => route.fulfill({ contentType: 'text/javascript', body: javascript }));
    }
  }
  await page.goto(`${base}/__look-panel-test`);
  report.behavior = await page.evaluate(async () => {
    const { VisualTreatmentPanel } = await import('/src/visual-treatment/panel.ts');
    const { VisualTreatmentSettings, VISUAL_TREATMENT_PRESETS } = await import('/src/visual-treatment/settings.ts');
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const writes = [];
    const settings = new VisualTreatmentSettings({ getItem: () => null, setItem: (_, value) => writes.push(JSON.parse(value)) });
    const panel = new VisualTreatmentPanel(settings), root = panel.element.shadowRoot;
    check(!root.querySelector('section'), 'Closed panel should be a lazy launcher');
    panel.setOpen(true);
    const control = label => root.querySelector(`[aria-label="${label}"]`);
    const input = (label, value, event = 'input') => {
      const element = control(label); check(element, `Missing ${label}`);
      element.value = String(value); element.dispatchEvent(new Event(event, { bubbles: true }));
      return element;
    };
    const ranges = [...root.querySelectorAll('input[type=range]')];
    check(ranges.length === 40, 'Retain every numeric control');
    const beforeDrag = writes.length;
    for (let i = 1; i <= 100; i++) input('Exposure EV', i / 100);
    check(writes.length === beforeDrag, 'Input burst should not synchronously persist 100 times');
    await frame();
    check(writes.length === beforeDrag && settings.value.grading.exposureEV === 1, 'One frame previews the latest input without synchronous storage');
    await new Promise(resolve => setTimeout(resolve, 220));
    check(writes.length === beforeDrag + 1, 'Idle preview saves exactly once');
    check(control('Exposure EV numeric value').value === '1', 'Paired numeric readout follows the slider');

    input('Filter R', 0.5); input('Filter G', 0.6);
    settings.patch({ vignette: { smoothness: 0.7 } });
    await frame();
    check(settings.value.grading.colorFilter.join() === '0.5,0.6,1', 'Batched channels must merge');
    check(settings.value.vignette.smoothness === 0.7, 'Pending input must retain unrelated external edits');
    input('Color filter', '#102030'); input('Filter R', 0.8); input('Color filter', '#aabbcc');
    await frame();
    check(settings.value.grading.colorFilter[0] === 170 / 255, 'Last picker edit must beat earlier channel edits');
    input('Color filter', '#102030'); input('Filter R', 0.8); await frame();
    check(settings.value.grading.colorFilter[0] === 0.8 && settings.value.grading.colorFilter[1] === 32 / 255, 'Last channel edit must preserve picker siblings');

    const numeric = control('Exposure EV numeric value'); numeric.focus();
    input('Exposure EV numeric value', -99, 'change');
    check(settings.value.grading.exposureEV === -5 && numeric.value === '-5', 'Focused number clamps visibly on commit');
    input('Exposure EV numeric value', '', 'change');
    check(settings.value.grading.exposureEV === -5 && numeric.value === '-5', 'Empty numeric input must not become zero');
    numeric.value = '';
    settings.patch({ bloom: { scatter: 0.31 } }); await frame();
    check(numeric.value === '', 'Unrelated refresh must preserve focused typing');
    settings.patch({ grading: { exposureEV: 0.25 } }); await frame();
    numeric.blur(); check(numeric.value === '0.25', 'Blur catches up to external edits');

    input('Exposure EV', 1.25); input('Exposure EV', 1.5, 'change');
    check(settings.value.grading.exposureEV === 1.5 && writes.at(-1).settings.grading.exposureEV === 1.5, 'Release saves synchronously');
    input('Exposure EV', 2); panel.setOpen(false);
    check(settings.value.grading.exposureEV === 2, 'Close flushes pending input');
    const stale = control('Exposure EV numeric value').value;
    settings.patch({ grading: { exposureEV: -1.25 } }); await frame();
    check(control('Exposure EV numeric value').value === stale, 'Closed panel does no UI refresh');
    panel.setOpen(true);
    check(control('Exposure EV numeric value').value === '-1.25', 'Reopen displays latest settings');
    root.querySelectorAll('details')[1].open = true;
    const sections = root.querySelector('.sections'); sections.scrollTop = 300;
    const scroll = sections.scrollTop; panel.setOpen(false); panel.setOpen(true);
    check(root.querySelectorAll('details')[1].open && sections.scrollTop === scroll, 'Reopen retains scroll and expanded sections');
    input('Exposure EV', 3);
    [...root.querySelectorAll('button')].find(button => button.textContent === 'Bonus Unity').click();
    check(JSON.stringify(settings.value) === JSON.stringify(VISUAL_TREATMENT_PRESETS.bonus), 'Preset wins over pending drag');
    for (const label of ['Enable visual treatment', 'High quality bloom filtering', 'Rounded vignette']) {
      const checkbox = control(label); checkbox.click(); await frame();
      check(checkbox.checked === (label === 'Enable visual treatment' ? settings.value.enabled : label === 'Rounded vignette' ? settings.value.vignette.rounded : settings.value.bloom.highQuality), `${label} remains live`);
    }
    input('Tone mapper', 'aces', 'change'); input('Bloom starting resolution', '4', 'change');
    check(settings.value.grading.toneMapper === 'aces' && settings.value.bloom.downscale === 4, 'Select controls remain live');
    input('Exposure EV', 0.75); window.dispatchEvent(new Event('pagehide'));
    check(writes.at(-1).settings.grading.exposureEV === 0.75, 'Page hide flushes final value');
    input('Exposure EV', 0.5); panel.dispose(); panel.dispose();
    check(settings.value.grading.exposureEV === 0.5 && !panel.element.isConnected, 'Dispose flushes and removes panel');
    const disposedWrites = writes.length; await frame();
    check(writes.length === disposedWrites, 'Dispose cancels queued callbacks');
    const snapshot = new VisualTreatmentPanel(settings); snapshot.setOpen(true);
    return { numericControls: ranges.length, persistedWrites: writes.length, batchedChannels: true, finalValue: settings.value.grading.exposureEV };
  });
  await page.screenshot({ path: `${output}/panel-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${output}/panel-mobile.png` });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => document.querySelector('visual-treatment-panel')?.remove());

  // Alternate implementations between rounds to limit thermal/order effects.
  for (let round = 0; round < (baseline ? 5 : 1); round++) {
    for (const kind of baseline ? (round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) : ['candidate']) {
      const result = await page.evaluate(async ({ kind, round }) => {
        const legacy = kind === 'baseline';
        const { VisualTreatmentPanel } = await import(legacy ? '/__look-baseline-panel.js' : '/src/visual-treatment/panel.ts');
        const { VisualTreatmentSettings, VISUAL_TREATMENT_PRESETS } = await import(legacy ? '/__look-baseline-settings.js' : '/src/visual-treatment/settings.ts');
        const nativeFrame = window.requestAnimationFrame.bind(window);
        const frame = () => new Promise(resolve => nativeFrame(resolve));
        let tracking = false, cpuMs = 0, domWrites = 0, storageWrites = 0, notifications = 0;
        const originals = [];
        for (const [prototype, property] of [[HTMLInputElement.prototype, 'value'], [HTMLInputElement.prototype, 'checked'], [HTMLSelectElement.prototype, 'value'], [Node.prototype, 'textContent']]) {
          const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
          originals.push([prototype, property, descriptor]);
          Object.defineProperty(prototype, property, { ...descriptor, set(value) {
            if (tracking) domWrites++;
            descriptor.set.call(this, value);
          } });
        }
        window.requestAnimationFrame = callback => nativeFrame(time => {
          const start = performance.now(); callback(time);
          if (tracking) cpuMs += performance.now() - start;
        });
        const settings = new VisualTreatmentSettings({ getItem: () => null, setItem: (key, value) => {
          if (tracking) storageWrites++;
          localStorage.setItem(key, value);
        } });
        settings.subscribe(() => { if (tracking) notifications++; });
        let panel;
        try {
          const constructors = [];
          for (let i = 0; i < 30; i++) {
            const start = performance.now(); const temp = new VisualTreatmentPanel(settings);
            constructors.push(performance.now() - start); temp.dispose();
          }
          panel = new VisualTreatmentPanel(settings); panel.setOpen(true); await frame();
          const root = panel.element.shadowRoot;
          const presetHashes = [];
          for (const preset of Object.values(VISUAL_TREATMENT_PRESETS)) {
            settings.applyPreset(preset); await frame();
            const snapshot = JSON.stringify([...root.querySelectorAll('input,select')].map(input => ({
              label: input.getAttribute('aria-label'), value: input.value, checked: input.checked,
            })));
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshot));
            presetHashes.push([...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join(''));
          }
          const slider = root.querySelector('[aria-label="Exposure EV"]');
          const event = new Event('input', { bubbles: true });
          const rows = [];
          for (const perFrame of [1, 4]) {
            cpuMs = domWrites = storageWrites = notifications = 0;
            for (let f = 0; f < 80; f++) {
              for (let n = 0; n < perFrame; n++) {
                tracking = false; slider.value = String(((f * perFrame + n) % 180 - 90) / 100);
                tracking = true;
                const start = performance.now(); slider.dispatchEvent(event); cpuMs += performance.now() - start;
              }
              await frame(); tracking = false;
            }
            tracking = true;
            const start = performance.now();
            slider.dispatchEvent(new Event('change', { bubbles: true }));
            cpuMs += performance.now() - start;
            await frame(); tracking = false;
            rows.push({ perFrame, frames: 80, events: perFrame * 80, cpuMs, domWrites, storageWrites, notifications });
          }
          panel.setOpen(false); await frame(); cpuMs = domWrites = storageWrites = notifications = 0;
          tracking = true;
          for (let i = 0; i < 200; i++) {
            const start = performance.now(); settings.patch({ grading: { exposureEV: i % 2 ? 0.1 : 0.2 } }); cpuMs += performance.now() - start;
          }
          await frame(); tracking = false;
          return { kind, round, constructors, presetHashes, rows, closed: { cpuMs, domWrites, storageWrites } };
        } finally {
          tracking = false; panel?.dispose(); window.requestAnimationFrame = nativeFrame;
          for (const [prototype, property, descriptor] of originals) Object.defineProperty(prototype, property, descriptor);
        }
      }, { kind, round });
      report.runs.push(result);
    }
  }
  assert.deepEqual(errors, []);
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  report.summary = {};
  for (const kind of baseline ? ['baseline', 'candidate'] : ['candidate']) {
    const runs = report.runs.filter(run => run.kind === kind);
    report.summary[kind] = {
      constructorMs: median(runs.map(run => run.constructors.reduce((sum, value) => sum + value, 0) / run.constructors.length)),
      edits: [1, 4].map(perFrame => {
        const rows = runs.map(run => run.rows.find(row => row.perFrame === perFrame));
        return { perFrame, cpuMs: median(rows.map(row => row.cpuMs)), domWrites: median(rows.map(row => row.domWrites)), storageWrites: median(rows.map(row => row.storageWrites)) };
      }),
      closedDomWrites: median(runs.map(run => run.closed.domWrites)),
    };
  }
  if (baseline) {
    for (const run of report.runs) assert.deepEqual(run.presetHashes, report.runs[0].presetHashes, 'Every preset must populate exactly the same controls');
    report.summary.speedups = report.summary.candidate.edits.map((row, index) => ({
      perFrame: row.perFrame,
      cpu: report.summary.baseline.edits[index].cpuMs / row.cpuMs,
      dom: report.summary.baseline.edits[index].domWrites / row.domWrites,
    }));
    for (const gain of report.summary.speedups) assert.ok(gain.dom >= 10, 'At least 10x fewer control DOM writes');
    assert.equal(report.summary.candidate.closedDomWrites, 0, 'No hidden panel writes');
  }
  report.errors = errors;
  console.log(JSON.stringify({ behavior: report.behavior, summary: report.summary, errors }, null, 2));
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
