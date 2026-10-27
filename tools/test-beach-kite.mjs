import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const out='docs/beach-street/kite';
await mkdir(out,{recursive:true});
const empty={v:1,name:'Kite isolation fixture',spawn:[0,.12,0],killY:-10,components:[{t:'platform',p:[0,-.5,0],s:[20,1,40]},{t:'gate',p:[0,0,-18]}]};
const report={trace:[],jumps:[],checkpoints:[],failures:[],started:new Date().toISOString()};
try{
 await withSkateRuntime(async({server,THREE,Level,Player,level:ordinary,player:ordinaryPlayer})=>{
  const {COASTAL_STREET_RUN_LEVEL:source}=await server.ssrLoadModule('/src/levels/coastal-street-run.ts');
  const {BEACH_KITE_BEATS:beats,BEACH_KITE_JUMPS:jumps,beachKiteLine:line}=await server.ssrLoadModule('/src/levels/beach-street-gameplay.ts');
  const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
  assert.equal(normalizeCustomLevelData(source)?.kiteTow,true,'Explicit mode survives editor normalization');
  assert.equal(normalizeCustomLevelData({...source,kiteTow:'yes'}),null,'Mode flag rejects invalid data');
  for(let i=0;i<180;i++)ordinaryPlayer.step(1/60,makeInput(),ordinary);
  assert.equal(ordinary.kiteTow,false);assert.ok(Math.abs(ordinaryPlayer.pos.z)<.01,'Ordinary levels do not auto move');
  const scene=new THREE.Scene();
  const data={...source,ocean:undefined,unitySand:undefined,components:source.components.filter(c=>c.t!=='decor'&&c.solid!==false)};
  const l=new Level(scene,{id:'kite-test',name:source.name,data});
  const p=new Player(scene);p.rawInput=makeInput();p.respawn(l,true);p.lives=99;
  scene.updateMatrixWorld(true);
  const tick=(input=makeInput())=>{l.update(1/60);p.step(1/60,input,l);input.consumeEdges();};
  const snap=()=>({p:p.pos.toArray(),state:p.state,grounded:p.grounded,lives:p.lives,speed:p.speed,vy:p.vVel,checkpoint:l.currentSpawn.toArray()});
  try{
   const used=new Set();let hold=0,lastCp='',airStart=null;
   for(let i=0;i<14000&&p.state!=='finished';i++){
    const z=-p.pos.z;
    const next=jumps.find(j=>!used.has(j.name)&&z>=j.at);
    let pressed=false;
    if(next){used.add(next.name);hold=.7;pressed=true;report.jumps.push({name:next.name,takeoff:snap()});}
    const input=makeInput({moveX:Math.max(-1,Math.min(1,(line(z+2)-p.pos.x)*2)),moveY:-1,
      jumpPressed:pressed,jumpHeld:hold>0});
    hold=Math.max(0,hold-1/60);tick(input);
    if(!p.grounded&&airStart===null)airStart={i,y:p.pos.y,peak:p.pos.y};
    if(airStart){airStart.peak=Math.max(airStart.peak,p.pos.y);if(p.grounded){report.jumps.at(-1)?.takeoff&&(report.jumps.at(-1).flight={seconds:(i-airStart.i)/60,rise:airStart.peak-airStart.y});airStart=null;}}
    const cp=l.currentSpawn.toArray().join(',');if(cp!==lastCp){report.checkpoints.push(snap());lastCp=cp;}
    if(i%90===0)report.trace.push(snap());
    if(p.state==='dead'||p.state==='gameover'){
      report.collision={...snap(),walls:l.walls.filter(w=>w.distanceToPoint(p.pos)<3).map(w=>[w.min.toArray(),w.max.toArray()]),enemies:l.enemies.filter(e=>e.group.position.distanceTo(p.pos)<8).map(e=>({kind:e.kind,p:e.group.position.toArray()}))};
      throw Error('Connected kite journey crashed: '+JSON.stringify(report.collision));
    }
   }
   assert.equal(p.state,'finished','Whole course completes without teleport, invulnerability or forward input');
   assert.equal(used.size,jumps.length);assert.ok(report.checkpoints.length>=10);
   report.finish={...snap(),crates:p.cratesBroken,totalCrates:l.totalCrates,crystal:p.hasCrystal,gem:p.gemEarned};report.gripErrors=p.kiteVisual?.gripErrors;
   assert.equal(p.cratesBroken,l.totalCrates,'The suggested line collects every crate/checkpoint');
   assert.equal(p.hasCrystal,true,'The crystal stays reachable on the home stretch');
   assert.equal(p.gemEarned,true,'The all-boxes gem retains normal progression');
   const resetAt=(x,z)=>{
    const c=source.components.find(c=>c.grp===1&&(c.s?.[0]===12||c.w===12)&&Math.abs(c.p[2]+z)<=(c.s?.[2]??c.len)/2);
    const y=c.t==='platform'?c.p[1]+c.s[1]/2:c.p[1]+c.rise*(.5+(c.yaw===180?-1:1)*(z+c.p[2])/c.len);
    p.respawn(l,true,false,{position:new THREE.Vector3(x,y+.12,-z),heading:new THREE.Vector3(0,0,-1)});p.lives=10;
   };
   for(const [name,x,z] of [['planter',0,52],['missed hurdle',0,165],['missed canal',0,405]]){
    resetAt(x,z);for(let i=0;i<480&&p.state!=='dead';i++)tick();
    assert.equal(p.state,'dead',name+' is fatal');assert.equal(p.lives,9);report.failures.push({name,...snap()});
   }
   resetAt(0,350);for(let i=0;i<240&&!l.activeCheckpoint;i++)tick();
   assert.ok(l.activeCheckpoint,'Checkpoint is collected by normal kite contact');
   const spawn=l.currentSpawn.clone();p.bail(false,p.speed,'wall');assert.equal(p.state,'dead');
   for(let i=0;i<360&&p.state==='dead';i++)tick();
   assert.ok(p.pos.distanceTo(spawn)<1,'Fatal bail returns to the earned checkpoint');
   assert.equal(p.lives,9);report.respawn=snap();
   p.respawn(ordinary,true);for(let i=0;i<180;i++)p.step(1/60,makeInput(),ordinary);
   assert.ok(Math.abs(p.pos.z)<.01,'Switching away retires forced movement');assert.equal(p.kiteVisual.root.visible,false);
   assert.equal(source.components.filter(c=>c.nm?.includes('continuous submerged shore')).length,5);
   assert.ok(!source.components.some(c=>c.dkind?.endsWith('matte')));
   report.counts={beats:beats.length,jumps:jumps.length,enemies:l.enemies.length,checkpoints:l.checkpoints.length,components:source.components.length};
  }finally{l.dispose();}
 },{levelEntry:{id:'empty',name:empty.name,data:empty}});
 report.pass=true;
}catch(e){report.pass=false;report.error=e.stack;throw e;}
finally{report.finished=new Date().toISOString();await writeFile(`${out}/native.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,counts:report.counts,finish:report.finish,error:report.error}));}
