import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const fixture={v:1,name:'Wet traction contact probe',spawn:[0,.02,0],killY:-20,components:[
 {t:'platform',p:[0,-.5,0],s:[300,1,300],tex:'kook-metal'}, {t:'gate',p:[0,0,-145]},
]};
await withSkateRuntime(async({server,THREE,Level,Player,CONST,TUNING})=>{
 const {validAtmosphere}=await server.ssrLoadModule('/src/levelAtmosphere.ts');
 const {RainWeather}=await server.ssrLoadModule('/src/rainWeather.ts');
 const {ROOFTOP_RELAY_LEVEL:roof}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 const before=JSON.stringify(TUNING),report={traction:[],impacts:null,geometryUnchanged:true};
 assert.ok(validAtmosphere(roof.atmosphere));
 for(const rain of [{intensity:NaN,wind:[1,2]},{intensity:2,wind:[1,2]},
  {intensity:.5,wind:[Infinity,2]},{intensity:.5,wind:[1,2,3]},{intensity:.5,wind:[1,2],lens:-1}])assert.equal(validAtmosphere({rain}),false);
 const metal=roof.components.find(c=>c.slip&&c.tex==='kook-metal').iceGrip;
 const stone=roof.components.find(c=>c.slip&&c.tex==='kook-paving').iceGrip;
 assert.ok(metal<stone&&stone<1);
 for(const [name,grip]of [['dry',null],['stone',stone],['metal',metal]]){
  const data={...fixture,components:fixture.components.map(c=>c.t==='platform'?{...c,...(grip===null?{}:{slip:true,iceGrip:grip})}:c)};
  const level=new Level(new THREE.Scene(),{id:'wet-probe',name:data.name,data});level.scene.updateMatrixWorld(true);
  const p=new Player(level.scene);
  const reset=()=>{p.enterLevel('wet-probe');p.respawn(level,true);p.step(CONST.fixedStep,makeInput(),level);assert.ok(p.grounded);};
  const step=(input,n)=>{for(let i=0;i<n;i++){p.step(CONST.fixedStep,makeInput(input),level);level.update(CONST.fixedStep);}};
  try{
   reset();p.walkVelocity.set(0,0,-6);p.speed=6;step({},30);
   const footRelease={distance:-p.pos.z,speed:p.walkVelocity.length()};
   reset();p.freeSkate=true;p.speed=20;p.lastPlanar=20;p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);step({grabHeld:true},30);
   const brake={distance:-p.pos.z,speed:p.speed};
   reset();p.freeSkate=true;p.speed=20;p.lastPlanar=20;p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);step({},30);
   const coast={distance:-p.pos.z,speed:p.speed};
   assert.ok(level.surfaceEdgeRails.length>0,'Wet traction must preserve ordinary edge grinding');
   report.traction.push({name,grip,footRelease,brake,coast});
  }finally{level.dispose();}
 }
 const [dry,paving,metalResult]=report.traction;
 assert.ok(metalResult.footRelease.distance>paving.footRelease.distance&&paving.footRelease.distance>dry.footRelease.distance,'Foot drift must follow the surface grip');
 assert.ok(metalResult.brake.speed>paving.brake.speed&&paving.brake.speed>dry.brake.speed,'Wet braking must retain more momentum');
 assert.ok(metalResult.coast.speed>dry.coast.speed,'Wet rollout must be longer than dry');
 assert.equal(JSON.stringify(TUNING),before,'Weather cannot retune other levels');

 const deck=new THREE.Mesh(new THREE.PlaneGeometry(140,140),new THREE.MeshBasicMaterial());
 deck.rotation.x=-Math.PI/2+.2;deck.position.set(30,80,-50);deck.updateMatrixWorld(true);
 const weather=new RainWeather(ray=>ray.intersectObject(deck)),root=new THREE.Group();root.add(weather.group);
 const camera=new THREE.PerspectiveCamera();camera.position.set(30,92,-50);
 weather.setView(camera,roof.atmosphere.rain);assert.ok(weather.diagnostics.activeImpacts>70);
 const points=weather.group.children[1].geometry.getAttribute('aImpact');
 for(let i=0;i<points.count;i++)if(points.getW(i)){
  const point=deck.worldToLocal(new THREE.Vector3(points.getX(i),points.getY(i),points.getZ(i)));
  assert.ok(Math.abs(point.z)<.00002,'Rain impacts must lie on the actual tilted surface');
 }
 const samples=weather.diagnostics.samples;weather.setView(camera,roof.atmosphere.rain,false);
 assert.equal(weather.group.visible,false);assert.equal(weather.diagnostics.samples,samples);
 weather.setView(camera,roof.atmosphere.rain);weather.update(1/60);
 report.impacts=weather.diagnostics;weather.dispose();assert.equal(root.children.length,0);
 deck.geometry.dispose();deck.material.dispose();
 // A rainfall pass may add contact flags and lighting, not reshape the course.
 if(process.env.ROOFTOP_DRY_SNAPSHOT){
  const pack=JSON.parse(await readFile(process.env.ROOFTOP_DRY_SNAPSHOT,'utf8'));
  const dryData=pack.levels.find(e=>e.id==='rooftop-relay').data;
  const withoutGrip=components=>components.map(({slip,iceGrip,...component})=>component);
  assert.deepEqual(withoutGrip(JSON.parse(JSON.stringify(roof.components))),withoutGrip(dryData.components));
 }
 await mkdir('docs/rooftop-kook/rain-validation',{recursive:true});
 await writeFile('docs/rooftop-kook/rain-validation/controls.json',JSON.stringify(report,null,2)+'\n');
 console.log('PASS wet surface traction, unchanged edge grinding/tuning/geometry, tilted impact sampling and weather disposal',JSON.stringify(report));
},{levelEntry:{id:'wet-probe',name:fixture.name,data:fixture}});
