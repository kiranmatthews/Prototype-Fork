import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv.find(arg => /^https?:/.test(arg)) || 'http://127.0.0.1:5173/';
const full = process.argv.includes('--full');
const selected = process.argv.find(arg => arg.startsWith('--level='))?.slice(8);
const ids = selected ? [selected] : ['jungle-terraces', 'jungle-skyline'];
const output = process.env.JUNGLE_BROWSER_OUTPUT || `${tmpdir()}/jungle-sequels-browser`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(new URL(`?playtest&level=${id}${full ? '' : '&lite'}`, base).href);
    await page.waitForFunction(id => window.__game?.getCurrentLevel().id === id &&
      !window.__game.gameFlow.blocksGameplay, id, { timeout: 90000 });
    await page.screenshot({ path: `${output}/${id}-spawn-${full ? 'full' : 'lite'}.png` });
    await page.evaluate(async id => {
      const { JUNGLE_SEQUEL_ROUTES } = await import('/src/levels/jungle-sequels.ts');
      const route = JUNGLE_SEQUEL_ROUTES.find(route => route.id === id);
      const g = window.__game, p = g.player, l = g.getLevel();
      const report = window.jungleReview = { id, stage: 'source spawn', frame: 0, done: false,
        failure: null, pipeCrossings: [], checkpoints: [], trace: [] };
      const check = (ok, label) => { if (!ok) throw Error(label); };
      const snapshot = () => ({ frame: report.frame, position: p.pos.toArray(), state: p.state,
        grounded: p.grounded, freeSkate: p.freeSkate, speed: p.speed, verticalSpeed: p.vVel,
        ground: p.groundHit?.name, bailing: p.isBailing, deaths: p.totalDeaths, lives: p.lives });
      const tick = function* (sample = {}) { yield sample; };
      const frames = function* (count, sample = {}) { for (let i = 0; i < count; i++) yield* tick(sample); };
      const until = function* (predicate, sample, limit, label, allowDeath = false) {
        report.stage = label;
        for (let i = 0; i < limit && !predicate(); i++) {
          yield* tick(typeof sample === 'function' ? sample() : sample);
          if (!allowDeath) check(!p.isBailing && !['dead', 'gameover'].includes(p.state), `${label}: ${JSON.stringify(snapshot())}`);
        }
        check(predicate(), `${label} timed out: ${JSON.stringify(snapshot())}`);
      };
      const vec = (x, y, z) => p.pos.clone().set(x, y, z);
      const pilot = function* () {
        yield* frames(30);
        check(p.grounded && !p.isBailing && p.pos.distanceTo(l.spawnPos) < .35, 'source spawn is unsupported');
        report.spawn = snapshot();
        const startX = p.pos.x;
        yield* frames(50, { moveX: 1, jumpHeld: true });
        check(p.pos.x > startX + 1.5 && Math.abs(p.pos.z - 1.25) < .25, 'screen-right must skate right without depth drift');
        report.sourceSkate = snapshot();
        for (const pipe of route.pipes) {
          report.stage = pipe.name + ' approach';
          let approachX = pipe.a - 12;
          if (route.gaps.some(gap => approachX > gap.a && approachX < gap.b)) approachX = pipe.a + .5;
          let approachY = pipe.lipY;
          if (approachX < pipe.a) for (let i = 1; i < route.profile.length; i++) {
            const [ax, ay] = route.profile[i - 1], [bx, by] = route.profile[i];
            if (approachX >= ax && approachX <= bx) approachY = ay + (by - ay) * (approachX - ax) / (bx - ax);
          }
          p.respawn(l, true, false, { position: vec(approachX, approachY + .12, 1.25), heading: vec(1, 0, 0) });
          yield* frames(40);
          const begin = report.frame;
          let braking = false;
          yield* until(() => p.pos.x > pipe.b + 5 && p.grounded,
            () => {
              if (p.speed > 16) braking = true; else if (p.speed < 13) braking = false;
              return { moveX: p.grounded ? 1 : 0, jumpHeld: true, grabHeld: braking && p.grounded };
            }, 1200, pipe.name + ' input-only crossing');
          const run = report.trace.filter(row => row.frame >= begin), trough = Math.min(...run.map(row => row.position[1]));
          check(trough < pipe.baseY + .2, pipe.name + ' skipped its trough');
          check(run.some(row => row.grounded && row.freeSkate && row.speed > 10), pipe.name + ' was not skated');
          report.pipeCrossings.push({ name: pipe.name, frames: report.frame - begin, trough, exit: snapshot() });
        }
        p.respawn(l, true, false);
        yield* frames(25);
        for (const [index, cp] of l.checkpoints.entries()) {
          report.stage = 'checkpoint ' + (index + 1);
          check(p.warpCheckpoint(l, 1), 'checkpoint warp unavailable');
          yield* frames(50);
          check(cp.active && p.grounded && !p.isBailing && p.pos.distanceTo(cp.spawnPos) < .4, 'checkpoint is unsupported');
          report.checkpoints.push(snapshot());
        }
        const savedSpawn = l.currentSpawn.clone(), deaths = p.totalDeaths, pit = l.pitBoxes[0];
        const failurePoint = pit ? pit.getCenter(vec(0, 0, 0)).setY(pit.max.y - .15)
          : vec(savedSpawn.x, l.killY - 1, savedSpawn.z);
        p.respawn(l, false, true, { position: failurePoint });
        yield* until(() => p.state === 'dead' || p.totalDeaths > deaths, {}, 180, 'real pit death', true);
        report.pitDeath = snapshot();
        yield* until(() => p.state === 'ride' && p.grounded, {}, 480, 'checkpoint recovery after pit', true);
        check(p.pos.distanceTo(savedSpawn) < .4, 'pit death did not restore the latest checkpoint');
        report.pitRespawn = snapshot();
        const gate = route.data.components.find(component => component.t === 'gate');
        p.respawn(l, false, true, { position: vec(gate.p[0] - 5, gate.p[1] + .1, 1.25), heading: vec(1, 0, 0) });
        yield* frames(30);
        yield* until(() => p.state === 'finished', { moveX: 1, spinHeld: true }, 220, 'actual finish gate');
        report.finish = snapshot();
        return { pipeCrossings: report.pipeCrossings.length, checkpoints: report.checkpoints.length, state: p.state };
      };
      const generator = pilot();
      let next = generator.next(), previous = {}, advanced = false;
      const realStep = p.step.bind(p), realCommit = p.commitRenderStep.bind(p);
      p.step = (dt, input, level) => {
        if (report.done) return;
        const sample = next.value ?? {};
        input.moveX = sample.moveX ?? 0; input.moveY = sample.moveY ?? 0;
        for (const held of ['jumpHeld', 'grindHeld', 'spinHeld', 'grabHeld', 'transferHeld']) {
          input[held] = sample[held] ?? false;
          input[held.replace('Held', 'Pressed')] = input[held] && !previous[held];
        }
        input.jumpReleased = sample.jumpReleased ?? (!input.jumpHeld && !!previous.jumpHeld);
        input.restartPressed = false;
        previous = { ...sample }; realStep(dt, input, level); advanced = true;
      };
      p.commitRenderStep = (...args) => {
        realCommit(...args); if (!advanced || report.done) return; advanced = false;
        report.frame++; report.trace.push(snapshot());
        try { next = generator.next(); if (next.done) { report.done = true; report.result = next.value; } }
        catch (error) { report.done = true; report.failure = String(error); report.failedAt = snapshot(); }
      };
    }, id);
    const captured = new Set();
    let lastStage = '';
    for (let poll = 0; poll < 1800; poll++) {
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => ({ done: window.jungleReview.done, stage: window.jungleReview.stage,
        frame: window.jungleReview.frame, position: window.__game.player.pos.toArray() }));
      if (state.stage !== lastStage) { lastStage = state.stage; console.log(JSON.stringify({ id, ...state })); }
      if (!captured.has(state.stage) && /crossing|checkpoint/.test(state.stage)) {
        captured.add(state.stage);
        await page.screenshot({ path: `${output}/${id}-${state.stage.replaceAll(' ', '-')}-${full ? 'full' : 'lite'}.png` });
      }
      if (state.done) break;
    }
    const report = await page.evaluate(() => window.jungleReview);
    await writeFile(`${output}/${id}-${full ? 'full' : 'lite'}.json`, JSON.stringify({ ...report, errors }, null, 2));
    await page.screenshot({ path: `${output}/${id}-finish-${full ? 'full' : 'lite'}.png` });
    console.log(JSON.stringify({ id, done: report.done, failure: report.failure, failedAt: report.failedAt, result: report.result, errors }));
    assert.equal(report.done, true, `${id}: browser probe timed out`);
    assert.equal(report.failure, null, `${id}: browser runtime probe failed`);
    assert.equal(report.result.state, 'finished');
    assert.deepEqual(errors, [], `${id}: browser console errors`);
    await page.close();
  }
} finally { await browser.close(); }
console.log('PASS Chrome local fixtures: source skating, every input-only pipe crossing, checkpoint/pit recovery and finish; this is not a continuous campaign journey.');
