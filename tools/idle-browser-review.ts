// Local-only review of actual input/routing. Overrides stay in memory.
import * as THREE from 'three';
const game: any = await new Promise(resolve => {
  const poll = () => { const g = (window as any).__game; if (g) resolve(g); else requestAnimationFrame(poll); };
  poll();
});
const p = game.player, runtime = game.characterAnimationRuntime;
const eye = new THREE.Vector3(), target = new THREE.Vector3();
const render = game.renderer.render.bind(game.renderer);
game.renderer.render = (...args: any[]) => {
  if (args[1] === game.camera) {
    p.bodyGroup.updateWorldMatrix(true, true);
    p.bodyGroup.localToWorld(eye.set(1.6, 1.4, 4.5));
    p.bodyGroup.localToWorld(target.set(0, 1, 0));
    game.camera.position.copy(eye); game.camera.up.set(0, 1, 0); game.camera.lookAt(target);
    game.camera.updateMatrixWorld(true);
  }
  return render(...args);
};
let amount = 0, cycle = false, frame = 0;
const step = p.step.bind(p);
p.step = (dt: number, _input: unknown, level: unknown) => {
  if (cycle) amount = Math.floor(frame++ / 120) % 4 === 0 ? 1 : Math.floor(frame / 120) % 4 === 2 ? .18 : 0;
  const x = p.pos.x, z = p.pos.z;
  step(dt, { moveX: 0, moveY: amount }, level);
  // Keep the review over one supported spot while real walkVelocity and
  // animationIntent continue through acceleration/deceleration normally.
  p.pos.x = x; p.pos.z = z;
};
const panel = document.createElement('div');
panel.style.cssText = 'position:fixed;top:10px;left:10px;z-index:999999;background:#18232eee;color:white;padding:12px;font:14px monospace';
const buttons = document.createElement('div'), status = document.createElement('pre');
status.dataset.testid = 'idle-transition-status'; panel.append(buttons, status); document.body.append(panel);
for (const [label, value] of [['Run', 1], ['Walk', .18], ['Idle', 0]] as const) {
  const button = document.createElement('button'); button.textContent = label;
  button.onclick = () => { cycle = false; amount = value; }; buttons.append(button);
}
const repeat = document.createElement('button'); repeat.textContent = 'Cycle Run / Idle / Walk / Idle';
repeat.onclick = () => { cycle = !cycle; frame = 0; }; buttons.append(repeat);
const report = () => {
  panel.inert = false; panel.removeAttribute('aria-hidden');
  const d = runtime.diagnostics;
  status.textContent = JSON.stringify({ input: amount, active: d.activeClipId,
    speed: d.authoredPlaybackSpeed, phaseTime: d.timelineTime?.toFixed(3),
    blend: d.transitionBlendWeight?.toFixed(3), velocity: p.animationPlanarSpeed.toFixed(3) }, null, 2);
  requestAnimationFrame(report);
};
report();
export {};
