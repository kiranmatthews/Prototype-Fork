// Session-only test controls. No level pack or browser saves are written.
import * as THREE from 'three';
import { puffs } from '../src/puffs';
const g: any = await new Promise(resolve => { const ready = () => { const game = (window as any).__game; if (game) resolve(game); else requestAnimationFrame(ready); }; ready(); });
const startup = document.createElement('pre');
startup.style.cssText = 'position:fixed;z-index:2147483647;bottom:0;left:10px;color:white;background:#102430;padding:8px';
startup.dataset.testid = 'crate-review-loading'; document.body.append(startup);
// __game is exposed before presentation warm-up finishes. Let that covered
// startup finish with its original scene and camera before adding the fixture.
await new Promise<void>(resolve => { const ready = () => {
  if (!document.body.classList.contains('game-startup-loading') && !g.gameFlow.blocksGameplay) resolve();
  else { const loading = g.getLoadingDiagnostics(); startup.textContent = JSON.stringify({phase:loading.phase,pending:loading.pending,failed:loading.failed}); requestAnimationFrame(ready); }
}; ready(); });
startup.remove();
g.campaign.startEphemeral(); g.gameFlow.hide();
const level = g.getLevel(), player = g.player, spawn = level.spawnPos.clone();
// The empty apron behind spawn is clear of the stock walls and grind rails.
spawn.z += 45;
level.slab('Crate review apron', spawn.z + 8, spawn.z - 30, spawn.y, 32,
  new THREE.MeshStandardMaterial({ color: 0x566978, roughness: .9 }), false, spawn.x);
const normalFov = g.camera.fov;
const kinds = ['wood', 'mystery', 'multihit', 'bouncy', 'metalbounce', 'metal', 'tnt', 'nitro', 'mask', 'life', 'bang', 'nitrobang', 'empty'];
const crates: any[] = [];
kinds.forEach((kind, i) => {
  level.crate(spawn.x + (i % 5 - 2) * 4.5, spawn.y, spawn.z - 10 - Math.floor(i / 5) * 5.5, kind === 'wood' ? undefined : kind, { noAuto: true, currentLayout: true });
  crates.push(level.crates.at(-1));
});
level.checkpoint(spawn.y, spawn.z - 21, spawn.x + 4.5, true);
const checkpoint = level.checkpoints.at(-1);
level.crate(spawn.x + 9, spawn.y, spawn.z - 21, undefined, { noAuto: true, outline: true, currentLayout: true });
const outline = level.crates.at(-1);
let selected = 0, inspecting = false, angle = .5, frozen = false;
const nativeStep = player.step.bind(player);
player.step = (...args: any[]) => { if (!frozen) nativeStep(...args); };
const panel = document.createElement('details'); panel.open = true; panel.style.cssText = 'position:fixed;z-index:999999;left:12px;bottom:10px;width:530px;max-height:45vh;overflow:auto;background:#102430ed;color:#ffe5b3;padding:10px;font:11px monospace;border:1px solid #7c989f;border-radius:8px';
const summary = document.createElement('summary'); summary.textContent = 'Crate gameplay review'; const controls = document.createElement('div'), status = document.createElement('pre');
status.dataset.testid = 'crate-game-status'; panel.append(summary, controls, status); document.body.append(panel);
const select = document.createElement('select'); select.setAttribute('aria-label', 'Test crate'); select.style.cssText = 'padding:6px';
for (const [i, name] of [...kinds, 'checkpoint', 'outline'].entries()) { const option = document.createElement('option'); option.value = String(i); option.textContent = name; select.append(option); } controls.append(select);
const current = () => selected === 13 ? checkpoint : selected === 14 ? outline : crates[selected];
function button(name: string, fn: () => void) { const b = document.createElement('button'); b.textContent = name; b.style.cssText = 'padding:6px;margin:3px'; b.onclick = fn; controls.append(b); }
function place() { const c = current(); const target = c.mesh.position.clone(); target.y = c.box.min.y + .1; target.z += 4; player.respawn(level, true, true, { position: target, heading: new THREE.Vector3(0, 0, -1) }); player.speed = 0; player.freeSkate = false; }
select.onchange = () => { selected = Number(select.value); place(); };
button('Play', () => { inspecting = false; frozen = false; player.group.visible = true; g.camera.fov = normalFov; g.camera.updateProjectionMatrix(); place(); });
button('Inspect', () => { inspecting = true; frozen = true; angle = .5; });
button('Front', () => { inspecting = true; frozen = true; angle = 0; });
button('Back', () => { inspecting = true; frozen = true; angle = Math.PI; });
button('Side', () => { inspecting = true; frozen = true; angle = Math.PI / 2; });
button('Top', () => { inspecting = true; frozen = true; angle = -1; });
button('Spin hit', () => { const c = current(); if (selected === 13) player.bankCheckpoint(level, checkpoint); else if (c.nitro || c.tnt) level.detonate(c); else player.smashCrate(level, c); });
button('Stomp', () => { const c = current(); frozen = true; player.state = 'air'; player.grounded = false; player.spinTimer = 0; player.slamActive = false; player.freeSkate = false; player.speed = 0; player.prevPos.set(c.mesh.position.x, c.box.max.y + .14, c.mesh.position.z); player.pos.set(c.mesh.position.x, c.box.max.y - .06, c.mesh.position.z); player.vVel = -10; player.collide(level); });
button('Light fuse', () => { selected = 6; select.value = '6'; level.lightFuse(crates[6]); });
button('Save checkpoint', () => { selected = 13; select.value = '13'; player.bankCheckpoint(level, checkpoint); });
button('Soft restore', () => { level.reset(false); player.respawn(level, false); });
button('Hard reset', () => { level.reset(true); frozen = false; place(); });
button('Pit respawn', () => { frozen = false; inspecting = false; player.pos.y = level.killY - 5; player.state = 'air'; player.grounded = false; });
button('Time trial', () => { level.setTimeTrial(true); });
button('Standard', () => { level.setTimeTrial(false); });
button('MAX/native', () => { g.crtGuestSettings.setEnabled(false); g.renderQualitySettings.setRegularResolution(null); });
button('480p/CRT', () => { g.renderQualitySettings.setRegularResolution(480); g.crtGuestSettings.setEnabled(true); });
button('Bone Man head', () => { g.setCharacterHeadStyle('skull'); });
button('Alternate head', () => { g.setCharacterHeadStyle('alternate'); });
button('Hide panel', () => panel.open = false);
const render = g.renderer.render.bind(g.renderer);
g.renderer.render = (...args: any[]) => {
  if (args[1] === g.camera && inspecting) {
    const target = current().mesh.position.clone(); g.camera.up.set(0, 1, 0); player.group.visible = false; g.camera.fov = 36;
    if (angle === -1) g.camera.position.copy(target).add(new THREE.Vector3(0, 7, .01));
    else g.camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle) * 6.8, 2.8, Math.cos(angle) * 6.8));
    g.camera.lookAt(target); g.camera.updateProjectionMatrix();
  }
  render(...args);
};
function report() {
  panel.inert = false; panel.removeAttribute('aria-hidden'); const c = current();
  status.textContent = JSON.stringify({ kind: select.selectedOptions[0].textContent, alive: c.alive ?? !c.active, hits: c.hitsRemaining,
    marks: c.art?.labelKey, visibleFruit: c.art?.contents?.count, head: g.getCharacterHeadStyle(), collider: c.box.getSize(new THREE.Vector3()).toArray(), position: player.pos.toArray().map((n: number) => +n.toFixed(2)),
    player: player.state, cratesBroken: player.cratesBroken, deaths: player.totalDeaths, checkpoint: checkpoint.active, checkpointVisible: checkpoint.mesh.visible,
    outline: outline.pending, usedSwitch: crates[10].bangUsed, effects: level.crateEffects.diagnostics, gouraudPuffs: puffs.liveCount, fuse: crates[6].fuse,
    resolution: g.renderQualitySettings.regularResolution, crt: g.crtGuestSettings.enabled,
    canvas: [g.renderer.domElement.width, g.renderer.domElement.height], frozen,
    loading: g.getLoadingDiagnostics() }, null, 2);
  requestAnimationFrame(report);
}
place(); report();
