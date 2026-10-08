import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5236/';
const out = process.env.ROLL_REVIEW_OUTPUT || '/private/tmp/board-roll-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [];
try {
  for (const lite of [true, false]) for (const [key, x, y, stop] of [['ArrowUp',0,1,false],['ArrowRight',1,0,false],['ArrowDown',0,-1,true]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => { navigator.getGamepads = () => []; });
    const url = new URL(base); url.search = `?playtest&level=codex-lab${lite ? '&lite' : ''}`;
    await page.goto(url.href);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 180000 });
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork/);
    await page.evaluate(async ({headStyle,x,y}) => {
      const g = window.__game, p = g.player, l = g.getLevel();
      if (headStyle === 'alternate') p.setCharacterHeadStyle('alternate');
      await p.preparePresentationAssets();
      const T = g.scene.position.constructor;
      // An isolated clear deck above the lab's obstacles. All motion after
      // the fixture placement comes from native keyboard/controller input.
      l.cameraViews.length=0;
      l.buildCustom({ v: 1, name: 'Roll review deck', spawn: [0, 30.02, 80], killY: -80,
        components: [{ t: 'platform', p: [0, 29.5, 0], s: [180, 1, 400], edgeGrinding: false }, {t:'camnode',p:[0,30,0],s:[500,100,500],cameraView:true,yaw:0,radius:0}] });
      const position = new T(0, 30.02, 80), heading = new T(x, 0, -y);
      p.respawn(l, true, true, { position, heading });
      p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
      p.freeSkate=true;p.speed=p.lastPlanar=18;p.grounded=true;p.state='ride';p.groundHit=p.queryGround(l);p.camDir.set(0,0,-1);
      const q = window.__rollReview = { budget: 0, samples: [], angle: 1.05, stopOnContact: false };
      const step = p.step.bind(p), consume = g.input.consumeEdges.bind(g.input);
      g.input.consumeEdges = () => {};
      p.step = (dt, input, level) => {
        if (q.budget <= 0) return;
        step(dt, input, level); consume(); q.budget--;
        q.samples.push({ position: p.pos.toArray(), speed: p.speed, carry: p.walkVelocity.length(),
          grounded: p.grounded, bail: p.isBailing, state: p.state, roll: p.rollLandingT,
          phase: p.rollLandingT / p.rollLandingDuration, clip: p.animationClipHint, board: p.freeSkate,
          floorGap: p.interactionMeasure.sampledPlaneDistance(p.riderG, new T(0, 1, 0), new T(p.pos.x, 30, p.pos.z)),
          supportCorrection: p.bailSupportOffset, head: p.headM.getWorldPosition(new T()).toArray() });
        if (q.stopOnContact && p.grounded) q.budget = 0;
      };
      const render = g.renderer.render.bind(g.renderer);
      g.renderer.render = (...args) => {
        if (args[1] === g.camera) {
          g.camera.position.copy(p.pos).add(new T(Math.sin(q.angle) * 6.3, 2.4, Math.cos(q.angle) * 6.3));
          g.camera.fov = 40; g.camera.lookAt(p.pos.clone().add(new T(0, 1.0, -.1))); g.camera.updateProjectionMatrix();
        }
        return render(...args);
      };
    }, {headStyle:process.env.ROLL_REVIEW_HEAD || 'skull',x,y});
    const advance = async (frames, stopOnContact = false) => {
      await page.evaluate(({frames, stopOnContact}) => Object.assign(window.__rollReview, { budget: frames, stopOnContact }), {frames, stopOnContact});
      await page.waitForFunction(() => window.__rollReview.budget === 0);
      return page.evaluate(() => window.__rollReview.samples.at(-1));
    };
    await advance(4);
    await page.keyboard.down(key); await page.keyboard.down('Space'); await advance(24);
    await page.keyboard.up('Space'); const launch = await advance(4);
    await page.keyboard.down('Space'); await advance(3);
    const wanted = await page.evaluate(({x,y}) => {
      const g=window.__game,p=g.player,f=p.courseInputDirection(g.getLevel())??p.camDir;
      return [f.x*y-f.z*x,f.z*y+f.x*x];
    }, {x,y});
    await page.keyboard.up('Space');
    const eject = await advance(1); assert.equal(eject.board, false); assert.equal(eject.state, 'air');
    const contact = await advance(200, true);
    assert.equal(contact.clip, 'player.roll-land'); assert.equal(contact.bail, false);
    const dx=contact.position[0]-eject.position[0],dz=contact.position[2]-eject.position[2];
    assert.ok((dx*wanted[0]+dz*wanted[1])/Math.hypot(dx,dz)>.98, `${key}: airborne direction changed ${JSON.stringify({wanted,launch,eject,contact})}`);
    if(stop)await page.keyboard.up(key);
    const frames = [];
    for (let i = 0; i < 13; i++) {
      const row = i === 0 ? contact : await advance(4);
      assert.ok(row.floorGap >= -.015, `visible roll penetrated support: ${row.floorGap}`);
      const prefix = `${lite ? 'lite' : 'full'}-${key}-${String(i).padStart(2, '0')}`;
      if (!lite && (stop || i===0 || i===6 || i===12)) for (const [angle, name] of [[Math.PI / 2, 'side'], [2.5, 'front'], [.7, 'rear']]) {
        await page.evaluate(angle => { window.__rollReview.angle = angle; }, angle);
        await page.waitForTimeout(75);
        await page.screenshot({ path: `${out}/${prefix}-${name}.png` });
      }
      frames.push(row);
    }
    const run = await advance(30);
    assert.equal(run.board, false); assert.equal(run.bail, false); assert.equal(run.clip, stop ? 'player.idle' : 'player.run');
    const runSpeed=await page.evaluate(()=>window.__game.TUNING.walkSpeed);
    assert.ok(contact.carry>runSpeed+1,'fixture did not reach skate speed');
    assert.ok(Math.abs(run.carry-(stop?0:runSpeed))<1e-5, 'dismount did not return to requested foot speed');
    if(stop)assert.ok(frames.filter((_,i)=>i>=4).every(f=>f.carry<.01),'neutral roll kept auto-running');
    await page.keyboard.up(key); await advance(36);
    results.push({ lite, key, stop, wanted, stamp, launch, eject, contact, frames, run });
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally { await writeFile(`${out}/results.json`, JSON.stringify({base,results,errors}, null, 2)); await browser.close(); }
console.log(`PASS native forward/right/back dismount direction, normal run speed and neutral roll/idle, lite + full, clean consoles. ${out}`);
