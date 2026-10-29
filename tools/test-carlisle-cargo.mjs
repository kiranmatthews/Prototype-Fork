import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {cargoPilot,cargoObservation} from './carlisle-cargo-pilot.mjs';
const b=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const data=api.CARLISLE_TIDAL_RELAY_LEVEL,out='docs/carlisle-relay/cargo',report={bridges:[],piles:[]};
await mkdir(out,{recursive:true});
try{await withSkateRuntime(async({THREE,level,player:p,CONST})=>{
 p.competitionMode=false;p.endlessDeaths=true;
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const crates=data.components.filter(c=>c.t==='crate');
 assert.equal(crates.filter(c=>!c.nm).length,0,'old anonymous checkpoint pairs remain');
 for(const bridge of api.CARLISLE_RELAY_CARGO){
  for(const s of [bridge.from+1,(bridge.from+bridge.to)/2,bridge.to-1])for(const u of [-4,0,4]){
   const at=api.carlislePoint(s,bridge.y,u);ray.set(new THREE.Vector3(at[0],at[1]+.5,at[2]),down);ray.far=4;
   assert.equal(ray.intersectObjects(level.groundMeshes,false).filter(h=>h.face?.normal.y>.2).length,0,`${bridge.name}: floor remains under cargo gap`);
  }
  const wood=data.components.filter(c=>c.nm?.startsWith(bridge.name+' · grind parcel'));
  assert.equal(wood.length,bridge.count);
  for(const metal of [false,true]){
   const x=metal?bridge.metalX:bridge.woodX;
   p.respawn(level,true,false,{position:new THREE.Vector3(x,bridge.baseY+.12,bridge.firstZ+3.2),heading:new THREE.Vector3(0,0,-1)});
   p.totalDeaths=0;const pilot=cargoPilot(bridge,{metal}),samples=[];let done=false,grindFrames=0,crateCatch=false,frame=0;
   const initialBroken=level.crates.filter(c=>!c.alive).length;
   for(;frame<900;frame++){
    const state=cargoObservation(p,level),control=pilot(state);
    if(control.done){done=true;break;}
    if(state.crateRail)crateCatch=true;
    if(state.state==='grind')grindFrames++;
    if(frame%20===0)samples.push({...state,frame});
    const input=makeInput(control.input);p.rawInput=input;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
    if(p.isBailing||['dead','gameover'].includes(p.state)||p.totalDeaths)break;
   }
   const row={name:bridge.name,metal,done,grindFrames,crateCatch,seconds:frame/60,broken:level.crates.filter(c=>!c.alive).length-initialBroken,
    end:cargoObservation(p,level),samples};report.bridges.push(row);console.log(JSON.stringify({...row,samples:undefined}));
  }
 }
 // Native construction must retain all tiers and derive rails from the piles.
 p.respawn(level,true);
 for(const name of ['Shore starter parcel','Scissor hub stair','Winch transfer bundle','Counterweight cargo steps','Rigging launch parcels','Home harbour cargo fan']){
  const authored=crates.filter(c=>c.nm?.startsWith(name+' ·'));
  const live=authored.map(c=>level.crates.find(q=>Math.hypot(q.mesh.position.x-c.p[0],q.mesh.position.z-c.p[2])<.01&&Math.abs(q.box.min.y-c.p[1])<.03));
  assert.ok(live.every(Boolean),`${name}: a tier was buried or misplaced`);
  const rails=level.crateRails.filter(r=>level.crateRunFor(r)?.some(c=>live.includes(c)));
  assert.ok(rails.length>0,`${name}: no native crate grind`);
  report.piles.push({name,count:authored.length,rails:rails.length});
 }
 // Spin into the near tread of a stack through normal input, then let the
 // surviving upper crates settle. This checks that piles remain gameplay.
 const parcel=crates.find(c=>c.nm==='Shore starter parcel · 2.2.1');
 p.respawn(level,true,false,{position:new THREE.Vector3(parcel.p[0],parcel.p[1]+.12,parcel.p[2]+2.8),heading:new THREE.Vector3(0,0,-1)});
 p.totalDeaths=0;const before=level.crates.filter(c=>!c.alive).length;
 for(let f=0;f<100;f++){
  const input=makeInput({moveY:f<32?1:0,spinHeld:f%30<15,spinPressed:f%30===0});
  p.rawInput=input;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
 }
 report.spinStack={broken:level.crates.filter(c=>!c.alive).length-before,end:cargoObservation(p,level)};
 assert.ok(report.spinStack.broken>=3&&!p.isBailing&&!p.totalDeaths,'starter stack cannot be collected with a normal spin');
 assert.ok(report.bridges.every(r=>r.done&&r.crateCatch&&r.grindFrames>12&&!r.end.bail&&!r.end.deaths),'crate bridge traversal failed');
 assert.ok(report.bridges.filter(r=>!r.metal).every(r=>r.broken>=4),'wood grind did not break its cargo');
},{levelEntry:{id:'carlisle-coast',name:data.name,data}});}finally{await writeFile(`${out}/native.json`,JSON.stringify(report,null,2)+'\n');}
