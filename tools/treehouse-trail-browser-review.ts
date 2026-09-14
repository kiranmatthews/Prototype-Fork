// Local authoring review: real Player input and current source level. No save writes.
import * as THREE from 'three';
import { treehouseReviewRoute, treehouseStairRoute } from './treehouse-trail-review-route';
const game: any = await new Promise(resolve => {
  const ready = () => (window as any).__game ? resolve((window as any).__game) : requestAnimationFrame(ready);
  ready();
});
const player = game.player;
game.campaign.startEphemeral();
let route: THREE.Vector3[] = [], waypoint = 0, ticks = 0, walking = false, waypointRadius = 1.5;
let heldIntent: {x:number;y:number;remaining:number;start:THREE.Vector3;label:string}|null = null;
let mode = 'Ready', minimumY = Infinity, startingDeaths = 0, frozen = false;
const panel = document.createElement('details');
panel.open = true;
panel.dataset.testid = 'treehouse-review';
panel.style.cssText = 'position:fixed;top:4px;left:4px;z-index:999999;max-width:380px;padding:7px;background:#09231eed;color:#fff;font:12px monospace';
panel.innerHTML = '<summary>Treehouse Trail · authoring review</summary>';
const controls = document.createElement('div'), status = document.createElement('pre');
status.dataset.testid = 'treehouse-review-status';
status.style.whiteSpace = 'pre-wrap';
panel.append(controls, status); document.body.append(panel);
const add = (label: string, action: () => void) => {
  const button = document.createElement('button'); button.textContent = label;
  button.style.cssText = 'padding:6px;margin:2px'; button.onclick = action; controls.append(button);
};
const level = () => game.getLevel();
const neutral = () => {
  for (const key of ['moveX','moveY']) game.input[key] = 0;
  for (const key of ['jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed']) game.input[key] = false;
};
const stop = (label = 'Manual play') => { walking = false; heldIntent = null; neutral(); mode = label; };
const place = (position: THREE.Vector3, heading = new THREE.Vector3(0, 0, -1)) => {
  stop(); frozen = false; game.gameFlow.hide(); player.respawn(level(), true, true, { position, heading });
};
const buildRoute = () => { route = treehouseReviewRoute(level().captureData()).slice(1); };
const hold = (x:number,y:number,seconds:number,label:string) => {
  ticks=0;startingDeaths=player.totalDeaths;minimumY=player.pos.y;
  heldIntent={x,y,remaining:Math.round(seconds*60),start:player.pos.clone(),label};mode=label;
};
add('Start', () => { place(level().spawnPos.clone()); mode = 'Start'; });
add('Opening shot', () => { place(level().spawnPos.clone()); frozen=true;mode='Opening shot'; });
add('Hold Right 3s', () => { place(level().spawnPos.clone());hold(1,0,3,'Held Right'); });
add('Forward after turn', () => {
  const data=level().captureData(),point=treehouseReviewRoute(data).find((p,i)=>i>0&&p.z<data.spawn[2]-25);
  if(!point){mode='No forward corridor';return;}
  place(point);hold(0,1,2,'Fresh Forward');
});
add('Walk whole trail', () => {
  place(level().spawnPos.clone()); buildRoute(); ticks = 0; waypoint = 0;
  minimumY = player.pos.y; startingDeaths = player.totalDeaths; walking = true; waypointRadius = 1.5; mode = 'Walking';
});
add('Manual', () => stop());
add('Freeze pose', () => { stop('Frozen pose'); frozen = true; });
add('Live play', () => { frozen = false; game.gameFlow.hide(); stop(); });
add('Level Select', () => {
  stop('Level Select'); game.gameFlow.showPause({ levelName: 'Treehouse Trail', inWarpRoom: false });
  game.gameFlow.openLevelSelect(); game.gameFlow.updateLevelSelectChoice('treehouse-trail', true);
});
add('Map Stats', () => {
  stop('Map Stats'); game.gameFlow.hide(); game.switchLevel('warproom');
  game.gameFlow.showMapSection('level-select'); game.gameFlow.updateLevelSelectChoice('treehouse-trail', true);
});
add('Treehouse Trail', () => {
  stop(); game.gameFlow.hide(); game.switchLevel('treehouse-trail'); frozen = false;
});
add('Checkpoint →', () => { stop(); game.gameFlow.hide(); player.warpCheckpoint(level(), 1); mode = 'Checkpoint warp'; });
add('Rail approach', () => {
  const rail = level().grindRails[0]; if (!rail) { mode = 'No rail'; return; }
  const point = rail.pointAt(0), tangent = rail.tangentAt(0);
  place(point.clone().addScaledVector(tangent, -3).add(new THREE.Vector3(0, -.7, 0)), tangent);
  mode = 'Rail approach · jump + grind';
});
add('Rope approach', () => {
  const rope = level().ropeSwings[0]; if (!rope) { mode = 'No rope'; return; }
  const point = level().ropePointAt(rope, rope.len - .2, new THREE.Vector3());
  place(new THREE.Vector3(point.x, point.y - .9, point.z + 2.5)); mode = 'Rope approach · jump forward';
});
add('Halfpipe entrance', () => {
  const half=level().captureData().components.find((c:any)=>c.t==='vertramp'&&c.vkind==='half');
  if(!half){mode='No halfpipe';return;}
  place(new THREE.Vector3(half.p[0],half.p[1]+.1,half.p[2]+(half.len??30)/2+2));mode='Halfpipe entrance';
});
add('Treehouse stairs', () => {
  place(treehouseStairRoute(level().captureData())[1].add(new THREE.Vector3(0,.1,0)));mode='Treehouse stairs';
});
add('Walk treehouse', () => {
  const stairs=treehouseStairRoute(level().captureData());
  place(stairs[0].clone().add(new THREE.Vector3(0,.1,0)));route=stairs.slice(1);
  ticks=0;waypoint=0;minimumY=player.pos.y;startingDeaths=player.totalDeaths;
  walking=true;waypointRadius=.35;mode='Walking to treehouse';
});
add('Finish approach', () => {
  const gate = level().captureData().components.find((c: any) => c.t === 'gate');
  place(new THREE.Vector3(gate.p[0], gate.p[1] + .1, gate.p[2] + 5)); mode = 'Finish approach';
});
add('Hide controls', () => panel.open = false);
const actualStep = player.step.bind(player);
player.step = (dt: number, input: any, current: any) => {
  if (frozen) return;
  if(heldIntent){
    ticks++;input.moveX=heldIntent.x;input.moveY=heldIntent.y;
    input.jumpHeld=input.jumpPressed=input.jumpReleased=input.grindHeld=input.grindPressed=input.spinHeld=input.spinPressed=false;
  }
  if (walking) {
    ticks++;
    let target = route[waypoint];
    if (target && Math.hypot(target.x - player.pos.x, target.z - player.pos.z) < waypointRadius) target = route[++waypoint];
    if (!target || player.state === 'finished') stop(player.state === 'finished' ? 'PASS: finished' : 'PASS: route ended');
    else if (['dead','gameover'].includes(player.state) || player.totalDeaths > startingDeaths) stop('FAIL: death');
    else if (ticks > 60 * 240) stop('FAIL: route timed out');
    else {
      const dx = target.x - player.pos.x, dz = target.z - player.pos.z, length = Math.hypot(dx, dz);
      const heading=current.cameraDirAt(player.pos.x,player.pos.y,player.pos.z)??{x:0,z:-1};
      const forward=new THREE.Vector3(heading.x,0,heading.z).normalize(),right=new THREE.Vector3(-forward.z,0,forward.x);
      // Each input describes an intentional new world direction as the camera follows.
      player.viewInput.reset();
      input.moveX = (dx * right.x + dz * right.z) / length;
      input.moveY = (dx * forward.x + dz * forward.z) / length;
      input.jumpHeld = input.jumpPressed = input.jumpReleased = false;
      input.grindHeld = input.grindPressed = false;
      input.spinPressed = ticks % 45 === 1; input.spinHeld = false;
    }
  }
  const result = actualStep(dt, input, current);
  minimumY = Math.min(minimumY, player.pos.y);
  if(heldIntent){
    if(['dead','gameover'].includes(player.state)||player.totalDeaths>startingDeaths)stop('FAIL: held input died');
    else if(--heldIntent.remaining<=0){
      const delta=player.pos.clone().sub(heldIntent.start),right=heldIntent.x!==0;
      const passed=right?delta.x>8&&Math.abs(delta.z)<.2:delta.z < -5&&Math.abs(delta.x)<2;
      stop(`${passed?'PASS':'FAIL'}: ${heldIntent.label} delta ${delta.toArray().map(v=>v.toFixed(2)).join('/')}`);
    }
  }
  if (walking && player.state === 'finished') stop('PASS: finished');
  return result;
};
function report() {
  panel.inert = false; panel.removeAttribute('aria-hidden');
  status.textContent = JSON.stringify({ mode, level: game.getCurrentLevel().id, state: player.state,
    position: player.pos.toArray().map((v: number) => +v.toFixed(2)), grounded: player.grounded,
    minY: Number.isFinite(minimumY) ? +minimumY.toFixed(2) : null, deaths: player.totalDeaths,
    waypoint: `${waypoint}/${route.length}`, seconds: +(ticks / 60).toFixed(1),
    activeCheckpoint: level().activeCheckpoint?.spawnPos.toArray() ?? null,
    rails: level().grindRails.length, ropes: level().ropeSwings.length,
    cameraPosition:game.camera.position.toArray().map((v:number)=>+v.toFixed(2)),
    cameraDirection:game.camera.getWorldDirection(new THREE.Vector3()).toArray().map((v:number)=>+v.toFixed(3)),
    cameraFov:+game.camera.fov.toFixed(2),inputDirection:player.camDir.toArray().map((v:number)=>+v.toFixed(3)),
    authoredOpening:level().cameraViews.find((view:any)=>view.cameraPosition)??null }, null, 2);
  requestAnimationFrame(report);
}
report();
