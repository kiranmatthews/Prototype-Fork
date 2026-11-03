import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const empty={v:1,name:'Wall grind harness',spawn:[0,.1,0],killY:-10,components:[
 {t:'platform',p:[0,-.5,0],s:[20,1,40]},{t:'gate',p:[0,0,-18]}]};
const report={sections:[],supportProbes:0,openingProbes:0};
await withSkateRuntime(async({server,THREE,Level,Player})=>{
 const {COASTAL_STREET_RUN_LEVEL:source}=await server.ssrLoadModule('/src/levels/coastal-street-run.ts');
 const {BAHIA_OPENINGS:openings}=await server.ssrLoadModule('/src/levels/beach-bahia-shore.ts');
 const data={...source,ocean:undefined,components:source.components.filter(c=>c.t!=='decor'&&c.solid!==false)};
 const scene=new THREE.Scene(),l=new Level(scene,{id:'beach-wall-grind',name:source.name,data});
 const p=new Player(scene);p.rawInput=makeInput();
 scene.updateMatrixWorld(true);
 let death;const die=p.die.bind(p);p.die=(...args)=>{death={cause:args[0],balance:p.balance,nearWalls:l.walls.filter(w=>w.max.y>p.pos.y+.15&&p.playerBox.intersectsBox(w)).map(w=>[w.min.toArray(),w.max.toArray()])};return die(...args);};
 const rails=l.rails.filter(r=>r.object.userData.sourceName?.startsWith('Bahia wall cap grind '));
 const cores=source.components.filter(c=>c.nm?.startsWith('Bahia sandstone seawall '));
 const finishBoundary=source.components.find(c=>c.nm==='Finish overlook containment');
 const finishLimit=-finishBoundary.p[2]-finishBoundary.s[2]/2-1.5;
 assert.ok(cores.every(c=>rails.some(r=>r.points[0].z>=c.p[2]-.001&&r.points.at(-1).z<=c.p[2]+c.pts.at(-1)[1]+.001)),
  'every solid wall section gets a coping, with grade changes joined');
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const ground=(x,z)=>{ray.set(new THREE.Vector3(x,30,z),down);return ray.intersectObjects(l.groundMeshes,false)[0]?.point.y;};
 const tick=input=>{l.update(1/60);p.step(1/60,input,l);input.consumeEdges();};
 try{
  for(const z of openings){
   for(const d of [-2,0,2]){
    assert.ok(rails.every(r=>r.closest(new THREE.Vector3(7.2,ground(7.2,-z-d),-z-d)).distance>1),'no grind across an entrance');
    report.openingProbes++;
   }
  }
  for(const [i,r]of rails.entries()){
   assert.equal(r.coping,true,'flush stone cap, not an invisible bar obstacle');
   assert.equal(r.object.children.length,0,'no additional rendered rail');
   const a=-r.points[0].z,b=-r.points.at(-1).z;
   assert.ok(cores.some(c=>Math.abs(a+c.p[2])<1e-6)&&cores.some(c=>Math.abs(b+c.p[2]+c.pts.at(-1)[1])<1e-6),'rail stops at real masonry ends');
   for(let t=0;t<=r.totalLength;t+=.4){
    const q=r.pointAt(t),support=ground(q.x,q.z);
    assert.ok(support!==undefined&&q.y-support>=-.001&&q.y-support<.3,`cap support follows the grind ${i}/${t}: ${q.y-support} point ${q.toArray()} supports ${ray.intersectObjects(l.groundMeshes,false).slice(0,3).map(h=>h.object.name+":"+h.point.y)}`);
    report.supportProbes++;
   }
   if(r.totalLength<5)continue;
   // The scenery starts behind the existing sealed rear boundary at d=-25.
   const start=r.pointAt(Math.max(1,-20-a));
   p.respawn(l,true,false,{position:start.clone().add(new THREE.Vector3(-.6,.14,0)),heading:new THREE.Vector3(0,0,-1)});
   // Incoming jump fixture: the final section can be reached across the last
   // opening before the existing grounded kite-release hands play to walking.
   p.grounded=false;p.state='air';p.vVel=-.5;
   p.lives=20;p.kiteMotion.reset(17);
   tick(makeInput({grindHeld:true,grindPressed:true}));
   assert.equal(p.state,'grind',`native E catch on section ${i}`);
   assert.equal(p.grindRail,r,`catch the visible wall's coping ${i}`);
   let frames=1,piers=0,lastY=p.pos.y;
   while(p.state==='grind'&&-p.pos.z<finishLimit&&frames++<2400){
    tick(makeInput({grindHeld:true,moveX:-p.balance*2}));
    if(-p.pos.z<b-.1)assert.equal(p.state,'grind',`uninterrupted grind over piers/slopes ${i} at ${p.pos.toArray()}: ${JSON.stringify(death)}`);
    assert.equal(p.lives,20,'pier contact cannot kill a grinding rider');
    if(p.pos.y>lastY+.01)piers++;lastY=p.pos.y;
   }
   assert.ok(-p.pos.z>=Math.min(b-.1,finishLimit),'whole playable section including its piers traversed');
   if(b<finishLimit)assert.equal(p.state,'air','real openings release the grind');
   else assert.equal(p.state,'grind','final cap is usable up to the existing sealed overlook');
   report.sections.push({index:i,start:a,end:b,playableEnd:Math.min(b,finishLimit),metres:r.totalLength,frames,raisedSteps:piers,exit:p.state});
  }
  // A real jump out of the native grind must release cleanly above the cap.
  const r=rails[0],q=r.pointAt(32);
  p.respawn(l,true,false,{position:q.clone().add(new THREE.Vector3(0,.14,0)),heading:new THREE.Vector3(0,0,-1)});
  p.kiteMotion.reset(17);tick(makeInput({grindPressed:true,grindHeld:true}));
  for(let i=0;i<18;i++)tick(makeInput({grindHeld:true,jumpHeld:true,jumpPressed:i===0,moveX:-p.balance*2}));
  tick(makeInput({jumpReleased:true}));
  assert.equal(p.state,'air','jump releases the grind');
  assert.ok(p.vVel>0,'normal upward jump from wall cap');
  report.jumpExit={state:p.state,upwardSpeed:p.vVel};
  report.rails=rails.length;report.pass=true;
 }finally{l.dispose();}
},{levelEntry:{id:'empty',name:empty.name,data:empty}});
await writeFile('docs/beach-bahia/polish/wall-grind-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
