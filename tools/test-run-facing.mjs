import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const {
    RUN_REVERSAL_DURATION,
    RUN_REVERSAL_YAW_RATE,
    stepFacingYaw,
    wrapFacingAngle,
  } = await server.ssrLoadModule("/src/runFacing.ts");

  assert.equal(RUN_REVERSAL_DURATION, 0.1);
  assert.equal(RUN_REVERSAL_YAW_RATE, Math.PI / 0.1);
  const first = stepFacingYaw(
    0,
    Math.PI,
    RUN_REVERSAL_YAW_RATE / 60,
    1,
  );
  assert.ok(first > 0 && first < Math.PI, "180 reversal still snaps");
  assert.ok(
    Math.abs(first - Math.PI / 6) < 1e-9,
    "turn rate is not fixed-step",
  );
  assert.ok(
    stepFacingYaw(0, Math.PI, 0.5, -1) < 0 &&
      stepFacingYaw(0, Math.PI, 0.5, 1) > 0,
    "exact-PI direction is not deterministic",
  );

  const durations = [];
  for (const fps of [30, 60, 120]) {
    let yaw = 0;
    let previous = yaw;
    let previousError = Math.PI;
    let frames = 0;
    while (Math.abs(wrapFacingAngle(Math.PI - yaw)) > 1e-7 && frames < 60) {
      yaw = stepFacingYaw(
        yaw,
        Math.PI,
        RUN_REVERSAL_YAW_RATE / fps,
        1,
      );
      const frameDelta = wrapFacingAngle(yaw - previous);
      const error = Math.abs(wrapFacingAngle(Math.PI - yaw));
      assert.ok(frameDelta >= -1e-9, `${fps}Hz turn reversed direction`);
      assert.ok(
        frameDelta <= RUN_REVERSAL_YAW_RATE / fps + 1e-9,
        `${fps}Hz turn exceeded its angular step`,
      );
      assert.ok(error <= previousError + 1e-9, `${fps}Hz turn overshot`);
      previous = yaw;
      previousError = error;
      frames++;
    }
    assert.equal(frames, fps * RUN_REVERSAL_DURATION);
    const duration = frames / fps;
    assert.ok(Math.abs(duration - 0.1) < 1e-9, `${fps}Hz turn took ${duration}s`);
    durations.push(duration);
  }
  assert.ok(
    Math.max(...durations) - Math.min(...durations) <= 1 / 30,
    "turn duration varies materially with presentation rate",
  );

  const partial = stepFacingYaw(0.2, 0.8, 0.1);
  assert.ok(Math.abs(partial - 0.3) < 1e-9);
  assert.equal(stepFacingYaw(0.2, 0.8, 0), 0.2);
  const deg = Math.PI / 180;
  const seamForward = stepFacingYaw(170 * deg, -170 * deg, 5 * deg);
  const seamBack = stepFacingYaw(-170 * deg, 170 * deg, 5 * deg);
  assert.ok(wrapFacingAngle(seamForward - 170 * deg) > 0);
  assert.ok(wrapFacingAngle(seamBack + 170 * deg) < 0);
  assert.ok(
    Math.abs(wrapFacingAngle(-170 * deg - seamForward)) < 20 * deg,
  );
  assert.ok(Math.abs(wrapFacingAngle(170 * deg - seamBack)) < 20 * deg);

  const player = await readFile(`${root}src/player.ts`, "utf8");
  assert.match(player, /if \(runReversal\)[\s\S]{0,1200}stepFacingYaw\(/);
  assert.match(player, /RUN_REVERSAL_YAW_RATE \* dt/);
  for (const guard of [
    "this.state === 'ride'",
    "this.grounded",
    "!this.freeSkate",
    "this.slideTimer <= 0",
    "!this.crawling",
    "!this.isBailing",
  ])
    assert.ok(player.includes(guard), `run reversal missing guard ${guard}`);
  assert.match(
    player,
    /else \{\s*this\.visualYaw \+=[\s\S]{0,120}Math\.min\(1, 14 \* dt\)/,
    "ordinary facing smoothing changed with the run reversal",
  );

  console.log(
    "Validated a deterministic ~0.1s on-foot 180 pivot with no one-frame snap or non-turn facing changes.",
  );
} finally {
  await server.close();
}
