import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runStormPorch} from './rooftop-porch-pilot.mjs';

await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData,findLevel}=await r.server.ssrLoadModule('/src/level.ts');
 const {resolveBonusLevel,bonusCrateCount}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 const {validAtmosphere}=await r.server.ssrLoadModule('/src/levelAtmosphere.ts');
 const {RainWeather}=await r.server.ssrLoadModule('/src/rainWeather.ts');
 r.report={actions:[],evidence:[]};
 assert.ok(normalizeCustomLevelData(r.source),'porch is editable and within geometry budgets');
 assert.equal(resolveBonusLevel('rooftop-relay'),r.source);assert.equal(findLevel('bonus-rooftop-relay').data,r.source);
 assert.equal(bonusCrateCount('rooftop-relay'),23);assert.equal(r.l.totalCrates,23);
 assert.ok(validAtmosphere(r.source.atmosphere));
 for(const shelter of [null,{}, {min:[0,0,0],max:[0,1,1]}, {min:[0,0,0],max:[1,Infinity,1]}, {min:[0,0],max:[1,1,1]}, {min:[0,0,0],max:[1,1,1],extra:true}])
  assert.equal(validAtmosphere({rain:{intensity:1,wind:[1,1],shelter}}),false);
 const ray=new r.THREE.Raycaster(new r.THREE.Vector3(),new r.THREE.Vector3(0,-1,0),0,4);
 for(const x of [29,71,73.5,78,82.5,85]){
  ray.ray.origin.set(x,1.3,0);assert.equal(r.l.raycastGround(ray).length,0,'open unrepaired floor '+x);
 }
 for(const [x,z] of [[0,4.4],[50,4.4],[100,4.4],[-24,0],[132,0]]){
  ray.ray.origin.set(x,.5,z);const hit=r.l.raycastGround(ray)[0];
  assert.ok(hit&&hit.point.y>-1.6&&hit.point.y<-1.1,'garden meets the foundation and oak roots '+[x,z]);
 }
 for(const mesh of r.l.groundMeshes)assert.notEqual(mesh.userData.slippy,true,'sheltered surfaces must not inherit parent traction');
 // The same fixed rain sample field reaches the exposed plane but never
 // leaves an active splash within the sheltered volume. No camera dependence.
 const plane=new r.THREE.Mesh(new r.THREE.PlaneGeometry(180,180),new r.THREE.MeshBasicMaterial());
 plane.rotation.x=-Math.PI/2;plane.updateMatrixWorld(true);
 const rain=new RainWeather(ray=>ray.intersectObject(plane)),camera=new r.THREE.PerspectiveCamera();camera.position.set(48,8,12);
 const profile=r.source.atmosphere.rain;rain.setView(camera,profile);
 const impacts=rain.group.children[1].geometry.getAttribute('aImpact');let wet=0;
 for(let i=0;i<impacts.count;i++)if(impacts.getW(i)){
  wet++;assert.ok(impacts.getZ(i)>profile.shelter.max[2]||impacts.getZ(i)<profile.shelter.min[2],'covered porch received a rain impact');
 }
 assert.ok(wet>30,'exposed garden still receives rain');
 rain.dispose();plane.geometry.dispose();plane.material.dispose();
 const pilot=runStormPorch(r);
 try{
  let step;while(!(step=pilot.next()).done)r.tick(step.value);r.report.result=step.value;
  assert.equal(r.p.state,'finished');assert.equal(r.p.cratesBroken,23);assert.equal(r.p.totalDeaths,0);assert.equal(r.p.gemEarned,true);
  assert.ok(r.trace.every(row=>!row.ground?.slippy));
  console.log('PASS Storm Parlour native input-only journey, all boxes, dry traction, real gaps and shelter',JSON.stringify(r.report.result));
 }catch(error){console.log(JSON.stringify({error:error.message,report:r.report,last:r.snapshot()}));throw error;}
 finally{await writeFile('/private/tmp/rooftop-porch/physics.json',JSON.stringify({report:r.report,trace:r.trace}));}
},{modulePath:'/src/levels/rooftop-porch-bonus.ts',levelId:'bonus-rooftop-relay',source:m=>m.ROOFTOP_PORCH_BONUS,controlFrame:()=>({x:0,z:-1}),maxFrames:12000});
