import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL("../src/render-quality/frameLimiter.ts", import.meta.url),
  "utf8",
);
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", output)(module, module.exports);
const { PresentationFrameLimiter: Limiter } = module.exports;

function timeline(hz, seconds, jitter = 0) {
  return Array.from({ length: Math.floor(hz * seconds) }, (_, frame) =>
    // Quantized browser timestamps with bounded, non-repeating phase jitter.
    Math.round((1000 + frame * 1000 / hz + Math.sin(frame * 2.17) * jitter) * 10) / 10,
  );
}

function present(stamps, limiter = new Limiter()) {
  const accepted = stamps.filter((stamp) => limiter.allow(stamp, true));
  return { limiter, accepted };
}

// Long samples expose phase loss that a one-second FPS count cannot detect.
// Every physical refresh is usable at/below 60 Hz, even when a timestamp is
// slightly earlier than the previous callback's nominal deadline.
for (const hz of [59.94, 60]) {
  for (const jitter of [0, 0.5, 1, 2]) {
    const stamps = timeline(hz, 60, jitter);
    const { accepted } = present(stamps);
    assert.equal(accepted.length, stamps.length,
      `${hz} Hz with ±${jitter} ms jitter must not drop a physical refresh`);
  }
}

// 90/144 Hz cannot divide evenly into 60. The cadence must use the adjacent
// physical refresh intervals while preserving the requested presentation rate.
// Near-multiple sources ensure the tolerance cannot silently uncap rendering.
for (const hz of [60.2, 90, 120, 120.5, 144, 165, 240]) {
  for (const jitter of [0, 0.5, 1]) {
    const stamps = timeline(hz, 60, jitter);
    const { accepted, limiter } = present(stamps);
    const expected = (stamps.at(-1) - stamps[0]) * 60 / 1000 + 1;
    assert.ok(Math.abs(accepted.length - expected) <= 2,
      `${hz} Hz ±${jitter} ms produced ${accepted.length} presentations, expected ${expected}`);
    assert.equal(limiter.stats.acceptedFrames + limiter.stats.skippedFrames, stamps.length);
    if ([90, 120, 144, 165, 240].includes(hz)) {
      const longestGap = Math.max(...accepted.slice(1).map((stamp, i) => stamp - accepted[i]));
      assert.ok(longestGap <= Math.ceil(hz / 60) * 1000 / hz + 2 * jitter + 0.2,
        `${hz} Hz cadence has an avoidable ${longestGap.toFixed(2)} ms hitch`);
    }
  }
}

// A hitch or suspended tab cannot create stored presentation work. The first
// resumed frame is immediate and the next frame waits for the normal cadence.
for (const hz of [90, 120, 144, 240]) {
  for (const stall of [50, 200, 30_000]) {
    const { limiter } = present(timeline(hz, 2, 0.5));
    const resume = limiter.stats.lastTimestampMs + stall;
    assert.equal(limiter.allow(resume, true), true);
    assert.equal(limiter.stats.budgetMs, 0);
    assert.equal(limiter.allow(resume + 1000 / hz, true), false,
      `${hz} Hz must not render a catch-up burst after a ${stall} ms stall`);
    const resumed = Array.from({ length: hz * 2 }, (_, frame) => resume + (frame + 2) * 1000 / hz);
    const { accepted } = present(resumed, limiter);
    assert.ok(accepted.length >= 119 && accepted.length <= 121,
      `${hz} Hz failed to return to 60 FPS after a ${stall} ms stall`);
  }
}

const zero = new Limiter();
assert.equal(zero.allow(0, true), true);
assert.equal(zero.allow(1000 / 120, true), false,
  "zero is a valid first timestamp, not an uninitialized sentinel");
zero.reset();
assert.deepEqual(zero.stats, {
  acceptedFrames: 0, skippedFrames: 0, targetFps: 60, lastTimestampMs: 0, budgetMs: 0,
});
assert.equal(zero.allow(30_000, true), true);
assert.equal(zero.allow(30_000 + 1000 / 120, true), false);

const uncapped = new Limiter();
for (const stamp of timeline(144, 2, 1)) assert.equal(uncapped.allow(stamp, false), true);
const switchAt = uncapped.stats.lastTimestampMs;
assert.equal(uncapped.allow(switchAt + 1000 / 144, true), false);
assert.equal(uncapped.allow(switchAt + 3000 / 144, true), true);

console.log("Validated 60 FPS presentation across display jitter, noninteger refresh rates, stalls, resets, and uncapped transitions.");
