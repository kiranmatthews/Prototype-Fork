import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const empty={v:1,name:'Road join harness',spawn:[0,.1,0],killY:-20,components:[
 {t:'platform',p:[0,-.5,0],s:[20,1,300]},{t:'gate',p:[0,0,-118]}]};
const report={joins:[],fixtures:[]};
await withSkateRuntime(async({server,THREE,Level,Player})=>{
 const {COASTAL_STREET_RUN_LEVEL:source}=await server.ssrLoadModule('/src/levels/coastal-street-run.ts');
 // Isolate the authored road/shore geometry from intentional hurdle and
 // planter encounters. Keep solid:false rail targets: omitting them masked
 // this regression. The first join is also driven in the complete browser level.
 const data={...source,ocean:undefined,unitySand:undefined,components:source.components.filter(c=>
  (c.grp===1||c.grp===105||c.t==='gate')&&c.t!=='decor'&&(c.solid!==false||c.t==='rail'))};
 const scene=new THREE.Scene(),l=new Level(scene,{id:'beach-road-joins',name:source.name,data}),p=new Player(scene);
 p.rawInput=makeInput();p.endlessDeaths=true;scene.updateMatrixWorld(true);
 const tick=fields=>{const input=makeInput(fields);l.update(1/60);p.step(1/60,input,l);input.consumeEdges();};
 const launch=(x,y,z)=>{p.respawn(l,true,false,{position:new THREE.Vector3(x,y+.04,-z),heading:new THREE.Vector3(0,0,-1)});
  p.kiteMotion.reset(17);p.kiteMotion.started=true;p.kiteMotion.speed=20;};
 const center=()=>({moveX:THREE.MathUtils.clamp((-p.pos.x*5-p.kiteMotion.wind*4.2)/9,-1,1)});
 const roads=source.components.filter(c=>c.grp===1&&c.p[0]===0&&(c.t==='platform'||c.t==='ramp'))
  .map(c=>{const len=c.t==='platform'?c.s[2]:c.len;return {c,start:-c.p[2]-len/2,end:-c.p[2]+len/2};})
  .sort((a,b)=>a.start-b.start);
 const height=(r,z)=>r.c.t==='platform'?r.c.p[1]+r.c.s[1]/2:
  r.c.p[1]+r.c.rise*(r.c.yaw===180?1-(z-r.start)/(r.end-r.start):(z-r.start)/(r.end-r.start));
 try{
  assert.equal(l.rails.filter(r=>r.object.userData.sourceName?.startsWith('Bahia retained road edges: ')).length,23);
  for(let i=1;i<roads.length;i++){
   const a=roads[i-1],b=roads[i];if(b.start-a.end>.1)continue;
   const at=(a.end+b.start)/2;
   launch(0,height(a,at-3),at-3);const deaths=p.totalDeaths;
   let frames=0;for(;frames<60&&-p.pos.z<at+3&&p.totalDeaths===deaths;frames++)tick(center());
   const sample={at,from:a.c.nm,to:b.c.nm,frames,position:p.pos.toArray(),state:p.state,deaths:p.totalDeaths-deaths};
   report.joins.push(sample);
   assert.equal(sample.deaths,0,JSON.stringify(sample));
   assert.equal(p.state,'ride',JSON.stringify(sample));assert.ok(-p.pos.z>=at+3,JSON.stringify(sample));
  }
  // The town-side edge still accepts the normal grind control. Its adjoining
  // shoulder can win the closest-target tie with the retained road edge.
  launch(-5.8,12.12,24);p.grounded=false;p.state='air';p.vVel=-.5;
  tick({grindPressed:true,grindHeld:true});
  assert.equal(p.state,'grind');assert.ok(p.grindRail.object.userData.sourceName?.startsWith('Bahia retained road edges: ')||l.surfaceEdgeRails.includes(p.grindRail));
  report.retainedGrind=p.grindRail.object.userData.sourceName??'native shoulder edge';
  // The beach wall's top still catches; its hidden ground rim stays disabled.
  const cap=l.rails.find(r=>r.object.userData.sourceName==='Bahia wall cap grind 1'),q=cap.pointAt(40);
  launch(q.x-.2,q.y+.1,-q.z);p.grounded=false;p.state='air';p.vVel=-.5;
  tick({grindPressed:true,grindHeld:true});assert.equal(p.state,'grind');assert.equal(p.grindRail,cap);
  report.wallTopGrind=true;
 }finally{l.dispose();}
 // Only flush kite coping is exempt. Raised coping and ordinary street rails
 // remain real obstacles, and a fatal kite hit must stay dead until respawn.
 for(const [name,kite,coping,y,expected] of [
  ['kite flush coping',true,true,.05,'ride'],['kite raised coping',true,true,.8,'dead'],
  ['kite physical rail',true,false,.05,'dead'],['ordinary rail',false,false,.5,'air']]){
  const scene=new THREE.Scene(),data={...empty,kiteTow:kite,components:[...empty.components,
   {t:'rail',p:[0,y,-4],len:10,yaw:90,coping,invisible:coping}]};
  const level=new Level(scene,{id:'road-join-isolation',name,data}),rider=new Player(scene);
  rider.rawInput=makeInput();rider.endlessDeaths=true;rider.respawn(level,true);scene.updateMatrixWorld(true);
  rider.freeSkate=true;rider.speed=20;
  if(kite){rider.kiteMotion.reset(17);rider.kiteMotion.started=true;rider.kiteMotion.speed=20;}
  let frames=0;
  try{
   for(;frames<24&&rider.state!=='dead'&&!rider.isBailing;frames++){
    const input=makeInput({moveX:kite?THREE.MathUtils.clamp((-rider.pos.x*5-rider.kiteMotion.wind*4.2)/9,-1,1):0});
    level.update(1/60);rider.step(1/60,input,level);
   }
   assert.equal(rider.state,expected,`${name}: ${JSON.stringify({position:rider.pos.toArray(),speed:rider.speed,frames,kite:rider.kiteDiagnostics,rails:level.rails.map(r=>r.points.map(p=>p.toArray()))})}`);if(!kite)assert.equal(rider.isBailing,true,name);
   report.fixtures.push({name,state:rider.state,deaths:rider.totalDeaths,frames});
   if(expected==='dead'){
    assert.equal(rider.breakApartDiagnostics.style,'kite-collapse');
    for(let i=0;i<360&&rider.state==='dead';i++){level.update(1/60);rider.step(1/60,makeInput(),level);}
    assert.equal(rider.state,'ride',name+' respawns');assert.equal(rider.kiteMotion.started,false);
   }
  }finally{level.dispose();}
 }
},{levelEntry:{id:'join-empty',name:empty.name,data:empty}});
report.pass=true;await mkdir('docs/beach-invisible-trip',{recursive:true});
await writeFile('docs/beach-invisible-trip/checks.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS Beach road joins, retained grinds, raised rail collision, fatal-state ownership and ordinary rail isolation',report.joins.length);
