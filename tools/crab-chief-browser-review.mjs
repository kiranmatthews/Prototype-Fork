import { runChiefJourney } from './crab-chief-pilot.mjs';
import { chiefInput } from './crab-chief-harness-browser.mjs';

// Local authoring page only; excluded from the shipping Vite entry points.
const panel = document.createElement('div');
panel.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:999;background:#17343e;color:#ffe1ad;padding:6px 9px;font:12px monospace;max-width:380px;border:1px solid #5dc6b8';
const start = document.createElement('button'); start.textContent = 'Run input-only boss fight'; start.disabled = true;
const resume = document.createElement('button'); resume.textContent = 'Resume visual hold'; resume.hidden = true;
const photo = document.createElement('button'); photo.textContent = 'Save fight screenshot'; photo.hidden = true;
const preview = document.createElement('button'); preview.textContent = 'Save level preview'; preview.disabled = true;
preview.onclick = () => { previewWanted = true; };
const hold = new URLSearchParams(location.search).get('hold');
let holding = false, heldOnce = false, photoWanted = false, previewWanted = false, photoQueued = false;
resume.onclick = () => { holding = false; resume.hidden = photo.hidden = true; };
photo.onclick = () => { photoWanted = true; };
const report = document.createElement('output'); report.style.display = 'block'; report.textContent = 'Loading production player…';
const evidence = document.createElement('script'); evidence.type = 'application/json'; evidence.id = 'chief-review-evidence'; document.body.append(evidence);
panel.append(start, resume, photo, preview, report); document.body.append(panel);
let g;
function ready() {
  g = window.__game;
  if (!g?.getLevel()?.boss || g.gameFlow.blocksGameplay) { requestAnimationFrame(ready); return; }
  start.disabled = preview.disabled = false; report.textContent = 'Ready · actual Player + chief · no state or health edits';
}
requestAnimationFrame(ready);
start.onclick = () => {
  start.disabled = true;
  const p = g.player, l = g.getLevel(), boss = l.boss;
  const review = window.chiefReview = { done: false, failed: null, frame: 0, stage: 'arrival', trace: [], framing: [], states: new Set(), result: null };
  const context = { p, l, stage: 'arrival' }, generator = runChiefJourney(context);
  let next = generator.next(), last = {}, advanced = false;
  const step = p.step.bind(p), commit = p.commitRenderStep.bind(p);
  p.step = (dt, input, level) => {
    if (review.done) return;
    if (!heldOnce && hold === `${boss.phase}:${boss.state}` && boss.stateTime > .8) {
      heldOnce = holding = true; resume.hidden = photo.hidden = false;
      report.textContent = `VISUAL HOLD · phase ${boss.phase} · ${boss.state} · frame ${review.frame}`;
    }
    if (holding) return; // art inspection only; never a completion result
    try { const sample = chiefInput(next.value ?? {}, last); last = { ...sample };
      Object.assign(input, sample); step(dt, input, level); advanced = true; }
    catch (error) { review.failed = String(error); review.done = true; }
  };
  p.commitRenderStep = (...args) => {
    commit(...args); if (!advanced || review.done) return; advanced = false; review.frame++;
    review.stage = context.stage; review.states.add(`${boss.phase}:${boss.state}`);
    review.trace.push({ frame: review.frame, position: p.pos.toArray(), state: p.state, deaths: p.totalDeaths,
      bailing: p.isBailing, boss: boss.state, phase: boss.phase, health: boss.health, playerHealth: boss.playerHealth, charge: boss.charge });
    try { next = generator.next(); if (next.done) { review.done = true; review.result = next.value; } }
    catch (error) { review.failed = String(error); review.done = true; }
    report.textContent = review.failed ? `FAIL ${review.failed}` : review.done ? `PASS · ${review.frame} frames · 9 strikes · real gate finish · ${p.totalDeaths} deaths` :
      `${review.stage} · frame ${review.frame} · chief ${boss.health}/9 · hearts ${boss.playerHealth}/3`;
    if (review.done) { review.boss = boss.diagnostics; review.states = [...review.states]; report.dataset.outcome = review.failed ? 'failed' : 'passed'; evidence.textContent = JSON.stringify(review); }
  };
  let lastFrame = -15;
  const render = g.renderer.render.bind(g.renderer), vertex = p.pos.clone(), instance = g.camera.matrixWorld.clone(), world = instance.clone();
  const bounds = root => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, behind = 0, count = 0;
    root.updateWorldMatrix(true, true);
    const visit = node => {
      if (!node.visible) return;
      if (node.isMesh && !node.userData.characterRenderProxy) {
        const attr = node.geometry.getAttribute('position'); if (node.isSkinnedMesh) node.skeleton.update();
        if (attr) for (let item = 0; item < (node.isInstancedMesh ? node.count : 1); item++) {
          world.copy(node.matrixWorld); if (node.isInstancedMesh) { node.getMatrixAt(item, instance); world.multiply(instance); }
          for (let i = 0; i < attr.count; i++) { node.getVertexPosition(i, vertex).applyMatrix4(world).project(g.camera);
            minX = Math.min(minX, vertex.x); maxX = Math.max(maxX, vertex.x); minY = Math.min(minY, vertex.y); maxY = Math.max(maxY, vertex.y);
            if (vertex.z > 1) behind++; count++; }
        }
      }
      for (const child of node.children) visit(child);
    }; visit(root); return { minX, maxX, minY, maxY, behind, count };
  };
  g.renderer.render = (scene, camera) => {
    const result = render(scene, camera);
    if ((photoWanted || previewWanted) && !photoQueued && g.renderer.getRenderTarget() === null) {
      photoQueued = true;
      queueMicrotask(() => {
        // Run after all frame passes, before the browser swaps the buffer.
        if (photoWanted) {
          const link = document.createElement('a'); link.download = `tidebreak-phase-${boss.phase}.png`;
          link.href = g.renderer.domElement.toDataURL('image/png'); link.click();
        }
        if (previewWanted) {
          // Crop the completed production frame so the Level Select image uses
          // the real depth/water/CRT passes and excludes the top/bottom HUD.
          const source=g.renderer.domElement, height=source.height*.66, width=height*16/9;
          const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
          canvas.getContext('2d').drawImage(source,(source.width-width)/2,source.height*.15,width,height,0,0,960,540);
          const link=document.createElement('a');link.download='crab-chief-meshy-preview.jpg';
          link.href=canvas.toDataURL('image/jpeg',.92);link.click();
        }
        photoWanted = previewWanted = photoQueued = false;
      });
    }
    if (scene === g.scene && camera === g.camera && !review.done && review.frame - lastFrame >= 15) {
      lastFrame = review.frame; review.framing.push({ frame: review.frame, phase: boss.phase, state: boss.state,
        rider: p.riderRef ? bounds(p.riderRef) : null, chief: bounds(boss.model.root), presentation: g.bossUI.diagnostics });
    }
    return result;
  };
};
