import { readFile, writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
await withSkateRuntime(async ({ server, player, level, step }) => {
  const { Replayer } = await server.ssrLoadModule('/src/replay.ts');
  const replay = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const replayer = new Replayer();
  const input = makeInput();
  replayer.begin(replay);
  const frames = [], events = [];
  let last, bails = 0, deaths = 0, maxStep = 0;
  player.onWipeout = () => bails++;
  while (replayer.active) {
    const f = replayer.frame;
    if (!replayer.feed(input, player.camDir)) break;
    step(input);
    const s = { f, p: player.pos.toArray().map(v => +v.toFixed(3)),
      state: player.state, grounded: player.grounded, speed: +player.speed.toFixed(3),
      vy: +player.vVel.toFixed(3), vert: player.vertAir, pipe: player.pipeHang,
      normal: player.rideNormal.toArray().map(v => +v.toFixed(3)),
      heading: player.axisF.toArray(), surface: player.surfaceName, bail: player.isBailing };
    if (last) {
      const distance = Math.hypot(...s.p.map((v, i) => v - last.p[i]));
      maxStep = Math.max(maxStep, distance);
      if (s.state === 'dead' && last.state !== 'dead') deaths++;
      if (s.vert !== last.vert || s.bail !== last.bail || distance > 1.5) events.push({ ...s, distance: +distance.toFixed(3) });
    }
    frames.push(s); last = s;
  }
  replayer.end();
  const summary = { frames: frames.length, bails, deaths, maxStep, events };
  console.log(JSON.stringify(summary, null, 2));
  if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify({ summary, frames }));
});
