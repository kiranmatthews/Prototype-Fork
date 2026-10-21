import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output='/private/tmp/ripcord-river-evidence';await mkdir(output,{recursive:true});
const report={};
await withBlockworksRuntime(async r=>{
 const m=r.sourceModule,old=(await r.server.ssrLoadModule('/src/levels/rumblewater-run.ts')).RUMBLEWATER_RUN_LEVEL;
 const {normalizeCustomLevelData,BUILTIN_LEVELS,isOriginalRipcordRiver}=await r.server.ssrLoadModule('/src/level.ts');
 const {resolveBonusLevel}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 const saved={id:'rumblewater-run',name:old.name,data:normalizeCustomLevelData(old)};
 assert.equal(isOriginalRipcordRiver(saved),true);
 const edited=structuredClone(saved);edited.data.components[0].p[0]+=.1;assert.equal(isOriginalRipcordRiver(edited),false);
 assert.equal(isOriginalRipcordRiver({...saved,name:'My river'}),false);
 assert.ok(Math.abs(m.RIPCORD_LENGTH/m.ROLLING_BONES_LENGTH-.7)<1e-6);
 assert.deepEqual(m.ROLLING_BONES_LEVEL.components,old.components,'Rolling Bones keeps every original component');
 assert.deepEqual(m.ROLLING_BONES_LEVEL.boulderChase,old.boulderChase,'Rolling Bones retains original boulder speeds and paths');
 assert.equal(m.ROLLING_BONES_LEVEL.sky,'night');
 assert.ok(m.ROLLING_BONES_LEVEL.atmosphere.sunIntensity<old.atmosphere.sunIntensity);
 assert.equal(m.RIPCORD_RIVER_LEVEL.boulderChase.speed,old.boulderChase.speed*.85);
 assert.deepEqual(m.RIPCORD_RIVER_LEVEL.boulderChase.paces,old.boulderChase.paces.slice(0,5).map(n=>n*.85));
 assert.equal(r.l.checkpoints.length,4);assert.equal(r.l.boulder.course.actors.length,5);
 assert.equal(r.l.boulder.cradles.filter(Boolean).length,5,'all retained stones have physical cradles');
 for(const id of ['rumblewater-run','rolling-bones']){
  const data=BUILTIN_LEVELS.find(l=>l.id===id).data;
  assert.ok(normalizeCustomLevelData(data),id+' passes editor/import validation');
  assert.equal(data.components.filter(c=>c.t==='gate').length,1);
  assert.equal(data.components.filter(c=>c.t==='crystal').length,1);
 }
 assert.deepEqual(resolveBonusLevel('rolling-bones'),resolveBonusLevel('rumblewater-run'));
 const copy=normalizeCustomLevelData(r.l.captureData());assert.ok(copy,'easy course survives editor capture');
 assert.deepEqual(copy.boulderChase,m.RIPCORD_RIVER_LEVEL.boulderChase);
 // Check real support across the new bank/pipe configurations and ordinary gaps.
 const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
 for(const [s,u]of [[0,10.8],[110,m.terraceLane(110)+7.2],[190,m.terraceLane(190)],[430,14],[520,-10.5],[610,10.5],[850,m.sluiceLane(850)+10.8],[1200,11],[1400,m.canopyLane(1400)+8.5],[1740,10.8],[m.RIPCORD_END,14]]){
  const p=m.ripcordPoint(s,undefined,u);ray.set(new r.THREE.Vector3(...p).add(new r.THREE.Vector3(0,1,0)),down);ray.far=2;
  assert.ok(r.l.raycastGround(ray).some(h=>h.face&&h.face.normal.y>.15),'supported widened route '+s+'/'+u);
 }
 for(const gap of m.RIPCORD_GAPS){
  assert.ok(gap.b-gap.a>=8&&gap.b-gap.a<=12.0001,'normal 8–12 m jumps, no extreme crossings');
  const p=m.ripcordPoint((gap.a+gap.b)/2,undefined,gap.u);ray.set(new r.THREE.Vector3(...p).add(new r.THREE.Vector3(0,.25,0)),down);ray.far=.5;
  assert.equal(r.l.raycastGround(ray).length,0,gap.name+' remains physically open');
 }
 for(const pipe of m.RIPCORD_PIPES){
  const edge=pipe.rise*Math.sin(pipe.arc*Math.PI/180);
  assert.ok(Math.abs((pipe.w+edge+pipe.deck)/(pipe.baseHalf+edge+1.1)-1.3)<1e-6,pipe.name+' is 30% wider including lips');
 }
 assert.deepEqual(m.RIPCORD_SECTIONS.map(s=>s.name),['Broken terraces','Twin spillways','Sluice switchbacks','Canopy causeway','Thunder bowls']);
 assert.ok(Math.abs(m.ripcordPoint(900)[0]-(await r.server.ssrLoadModule('/src/levels/rumblewater-run.ts')).rumblePoint(900)[0])>20,'independent river centreline');
 // The optional diagonal grind always has a real receiving floor below it.
 for(let s=1204;s<=1284;s+=3){const q=m.ripcordPoint(s,undefined,m.canopyRailLane(s));ray.set(new r.THREE.Vector3(...q).add(new r.THREE.Vector3(0,.2,0)),down);ray.far=.5;assert.ok(r.l.raycastGround(ray).length,'supported optional rail '+s);}
 assert.ok(m.RIPCORD_GAPS.find(g=>g.name==='Canopy west-island leap').a-1284>=50,'rail exit leaves room to land and charge the next jump');
 report.geometry={originalMetres:m.ROLLING_BONES_LENGTH,easyMetres:m.RIPCORD_LENGTH,end:m.RIPCORD_END,sections:m.RIPCORD_SECTIONS,checkpoints:4,boulders:5,gaps:m.RIPCORD_GAPS};
 const {createRumblewaterLivePilot}=await r.server.ssrLoadModule('/tools/rumblewater-live-pilot.mjs');
 const pilot=createRumblewaterLivePilot({player:r.p,getLevel:()=>r.l},process.argv[2]??'inner-low',true);
 const bails=[],bail=r.p.bail;r.p.bail=function(...args){bails.push({args,at:this.pos.toArray(),frame:r.frame});return bail.apply(this,args);};
 let input;try{while((input=pilot.next())!==null){r.tick(input);if(['dead','gameover'].includes(r.p.state))throw Error('Pilot died');}}catch(e){await writeFile(output+'/failure.json',JSON.stringify({error:String(e),last:r.snapshot(),trace:r.trace.slice(-100),bails},null,2));throw Error(String(e)+' '+JSON.stringify({last:r.snapshot(),bails}));}
 assert.equal(r.p.state,'finished');assert.equal(r.p.totalDeaths,0);assert.ok(r.p.hasCrystal);
 assert.equal(r.l.checkpoints.filter(c=>c.active).length,4);
 report.run={seconds:r.frame*r.dt,frames:r.frame,crystal:r.p.hasCrystal,deaths:r.p.totalDeaths,checkpoints:4,final:r.snapshot()};
 console.log(JSON.stringify(report));
 await writeFile(output+'/native-'+(process.argv[2]??'inner-low')+'.json',JSON.stringify(report,null,2));
},{modulePath:'/src/levels/ripcord-river.ts',levelId:'rumblewater-run',source:m=>m.RIPCORD_RIVER_LEVEL,maxFrames:22000,allowCheckpointTrips:true});
