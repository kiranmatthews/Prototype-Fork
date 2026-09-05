import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { RooBlinkClock, rooBlinkAmount, ROO_BLINK_TIMING: bounds } = await server.ssrLoadModule('/src/character/rooBlinkTiming.ts');
  const { paintRooLids, prepareRooLidPaint, ROO_BLINK_TEXTURE_SIZE: size } = await server.ssrLoadModule('/src/character/rooBlinkPaint.ts');
  const random = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2**32; };
  const clock = new RooBlinkClock(random(47));
  const intervals = new Set(), durations = new Set();
  let previousStarted = 0, sawClosed = false, sawPartial = false;
  for (let frame = 0; frame < 60 * 600; frame++) {
    const amount = clock.step(1 / 60);
    assert.ok(amount >= 0 && amount <= 1 && Number.isFinite(amount));
    sawClosed ||= amount === 1; sawPartial ||= amount > 0 && amount < 1;
    if (clock.started !== previousStarted) {
      assert.ok(clock.duration >= bounds.durationMin && clock.duration <= bounds.durationMax);
      assert.ok(clock.interval >= bounds.intervalMin && clock.interval <= bounds.intervalMax);
      intervals.add(clock.interval); durations.add(clock.duration); previousStarted = clock.started;
    }
  }
  assert.ok(clock.completed > 80 && sawClosed && sawPartial);
  assert.ok(intervals.size > 50 && durations.size > 50, 'each cycle must resample both interval and duration');
  for (const duration of [0.2,0.3,0.4]) {
    assert.equal(rooBlinkAmount(0,duration),0);
    assert.equal(rooBlinkAmount(duration*.4,duration),1);
    assert.equal(rooBlinkAmount(duration,duration),0);
  }
  // Identical cosmetic random stream remains frame-rate independent.
  const c30 = new RooBlinkClock(random(6)), c60 = new RooBlinkClock(random(6));
  for (let frame=0; frame<3000; frame++) {
    c30.step(1/30); c60.step(1/60); c60.step(1/60);
    assert.ok(Math.abs(c30.amount-c60.amount)<1e-8);
    assert.equal(c30.started,c60.started);
  }
  const frozen = JSON.stringify(c30.diagnostics);
  for (const dt of [0,-1,NaN,Infinity]) c30.step(dt);
  assert.equal(JSON.stringify(c30.diagnostics),frozen,'invalid or paused deltas must not advance');
  c30.step(1/60,false);
  const hidden = JSON.stringify(c30.diagnostics);
  for(let i=0;i<500;i++)c30.step(1/60,false);
  assert.equal(c30.amount,0);assert.equal(JSON.stringify(c30.diagnostics),hidden,'hidden head must not advance or resample');
  c30.step(120);assert.equal(c30.amount,0);assert.ok(c30.diagnostics.nextBlinkIn>=2,'tab resume must restart open without catch-up');
  assert.notDeepEqual(new RooBlinkClock(random(1)).diagnostics,new RooBlinkClock(random(2)).diagnostics);

  const coords = new Uint8ClampedArray(size*size*4);
  // Controlled texels at multiple heights on the centre of the right lid.
  for(let j=0;j<20;j++) {
    coords[j*4]=Math.round((.089-.02)/.16*255);
    coords[j*4+1]=Math.round((.25+j*.004-.23)/.12*255);
    coords[j*4+3]=255;
  }
  const samples = prepareRooLidPaint(coords), pixels=new Uint8ClampedArray(coords.length);
  paintRooLids(1,pixels,samples);assert.ok(pixels.some(x=>x!==0),'closed pose must contain actual painted pixels');
  const closed=pixels.slice();paintRooLids(.5,pixels,samples);
  assert.notDeepEqual(pixels,closed,'partial closure must differ from closed');
  paintRooLids(0,pixels,samples);assert.ok(pixels.every(x=>x===0),'open pose restores complete transparency');
  assert.throws(()=>prepareRooLidPaint(new Uint8ClampedArray(4)),/256/);

  const root=new URL('../',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('public/characters/roo-texture-blink/manifest.json',root),'utf8'));
  const original=await readFile(new URL('public/characters/meshy-boolieroo-head/base-color.webp',root));
  assert.equal(createHash('sha256').update(original).digest('hex'),manifest.originalBaseSha256);
  assert.ok(manifest.reconciledSeamMeanChannelDifferenceAfter < manifest.reconciledSeamMeanChannelDifferenceBefore);
  assert.equal(manifest.triangles,15634);assert.equal(manifest.topologyChanged,false);assert.equal(manifest.uvsChanged,false);
  const player=await readFile(new URL('src/player.ts',root),'utf8');
  assert.match(player,/createMeshyBoolieRooHead\(\{ blink: true \}\)/);
  assert.match(player,/blink\?\.update\(dt,[\s\S]{0,120}characterHeadStyleValue === 'alternate' && this\.group\.visible/);
  console.log('PASS Roo painted blink: 10-minute randomized timing, 30/60 Hz parity, pause/hide/resume, exact reopen, unchanged source and player wiring');
} finally { await server.close(); }
