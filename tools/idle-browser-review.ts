// Local-only review of actual input/routing. Overrides stay in memory.
import * as THREE from 'three';
import { Level } from '../src/level';
const game: any = await new Promise(resolve => {
  const poll = () => { const g = (window as any).__game; if (g) resolve(g); else requestAnimationFrame(poll); };
  poll();
});
const p = game.player, runtime = game.characterAnimationRuntime;
const fixture = new Level(game.scene,{id:'run-inertia-review',name:'Run inertia',data:{v:1,name:'Run inertia',
  spawn:[1000,.02,0],killY:-30,components:[{t:'platform',p:[1000,-.5,0],s:[120,1,120]},
    {t:'gate',p:[1000,0,-55]}]}});
p.respawn(fixture,true);
const eye = new THREE.Vector3(), target = new THREE.Vector3();
const render = game.renderer.render.bind(game.renderer);
game.renderer.render = (...args: any[]) => {
  if (args[1] === game.camera) {
    p.bodyGroup.updateWorldMatrix(true, true);
    eye.copy(p.pos).add(new THREE.Vector3(4,2.2,5));
    target.copy(p.pos).add(new THREE.Vector3(0,1,0));
    game.camera.position.copy(eye); game.camera.up.set(0, 1, 0); game.camera.lookAt(target);
    game.camera.updateMatrixWorld(true);
  }
  return render(...args);
};
let amount = 0, cycle = false, frame = 0, frozen = false, low = false;
const step = p.step.bind(p);
p.step = (dt: number, _input: unknown, level: unknown) => {
  if(frozen)return;
  if (cycle) amount = Math.floor(frame++ / 120) % 4 === 0 ? 1 : Math.floor(frame / 120) % 4 === 2 ? .18 : 0;
  step(dt, { moveX: 0, moveY: amount, grabHeld:low }, fixture);
  fixture.update(dt);
  if(Math.abs(p.pos.z)>45)p.respawn(fixture,true);
};
const panel = document.createElement('div');
panel.style.cssText = 'position:fixed;top:10px;left:10px;z-index:999999;background:#18232eee;color:white;padding:12px;font:14px monospace';
const buttons = document.createElement('div'), status = document.createElement('pre');
status.dataset.testid = 'idle-transition-status'; panel.append(buttons, status); document.body.append(panel);
for (const [label, value] of [['Run', 1], ['Reverse', -1], ['Walk', .18], ['Idle', 0]] as const) {
  const button = document.createElement('button'); button.textContent = label;
  button.onclick = () => { cycle = false; amount = value; frozen=false; low=false; }; buttons.append(button);
}
for(const [label,value] of [['Crouch',0],['Crawl',.35]] as const){
  const button=document.createElement('button');button.textContent=label;
  button.onclick=()=>{cycle=false;amount=value;low=true;frozen=false;p.respawn(fixture,true);runtime.restart();};buttons.append(button);
}
const repeat = document.createElement('button'); repeat.textContent = 'Cycle Run / Idle / Walk / Idle';
repeat.onclick = () => { cycle = !cycle; frame = 0; }; buttons.append(repeat);
const freeze=document.createElement('button');freeze.textContent='Freeze';freeze.onclick=()=>frozen=!frozen;buttons.append(freeze);
const report = () => {
  panel.inert = false; panel.removeAttribute('aria-hidden');
  const d = runtime.diagnostics;
  status.textContent = JSON.stringify({ input: amount, active: d.activeClipId,
    speed: d.authoredPlaybackSpeed, phaseTime: d.timelineTime?.toFixed(3),
    yaw: p.visualYaw.toFixed(3), physicalZ:p.walkVelocity.z.toFixed(3),
    blend: d.transitionBlendWeight?.toFixed(3), velocity: p.animationPlanarSpeed.toFixed(3),
    elasticity:runtime.lastSampledPose?.scalars }, null, 2);
  requestAnimationFrame(report);
};
report();
export {};
