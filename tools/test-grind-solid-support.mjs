import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const results=[];
await withSkateRuntime(async({THREE,Level,Player,CONST,server})=>{
 const {solidContact}=await server.ssrLoadModule('/src/worldSolids.ts');
 for(const yaw of [0,45,90,180])for(const dir of [-1,1])for(const wall of [false,true]){
  const angle=yaw*Math.PI/180,hx=Math.sin(angle)*dir,hz=Math.cos(angle)*dir;
  const components=[{t:'platform',p:[0,-3,0],s:[80,1,80]},
   {t:'rail',nm:'Current rock ridge',dkind:'nightrockridge',p:[0,2,0],len:40,yaw,axis:'x',amp:1,speed:.4,phase:0},
   {t:'gate',p:[35,-2.5,35]},
   {t:'camnode',p:[-hx*30,2,-hz*30]},{t:'camnode',p:[hx*30,2,hz*30]}];
  const scene=new THREE.Scene(),l=new Level(scene,{id:'grind-solid-support',name:'Grind solid support',data:{v:1,name:'Grind solid support',spawn:[0,0,0],killY:-30,components}});
  const rail=l.rails.find(r=>r.object.userData.editorIdx===1),p=new Player(scene);
  assert.ok(rail);
  const along=dir>0?7:rail.totalLength-7,heading=rail.tangentAt(along).multiplyScalar(dir),position=rail.pointAt(along).add(new THREE.Vector3(0,-1.6,0));
  p.respawn(l,true,false,{position,heading});p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.speed=12;p.vVel=4;
  p.rawInput=makeInput();p.camDir.copy(heading);
  let obstacle;
  if(wall){
   obstacle=new THREE.Mesh(new THREE.BoxGeometry(8,7,.18),new THREE.MeshBasicMaterial());
   obstacle.name='Independent wall';obstacle.position.copy(rail.pointAt(along+dir*7));obstacle.position.y+=2;
   obstacle.rotation.y=Math.atan2(heading.x,heading.z);scene.add(obstacle);
   l.worldSolids.add(obstacle,{owner:{t:'wall'},name:'Independent wall'});
  }
  const tick=()=>{p.step(CONST.fixedStep,makeInput({grindHeld:true}),l);l.update(CONST.fixedStep);p.commitRenderStep(l);};
  let caught=false,frames=0;
  for(;frames<85;frames++){
   tick();caught||=p.state==='grind';
   if(p.isBailing)break;
  }
  assert.ok(caught,`${yaw}/${dir}: ordinary held Triangle must catch the rail`);
  if(wall){assert.ok(p.isBailing,'an unrelated wall remains solid during a grind');assert.equal(p.worldImpactDiagnostics.last.name,'Independent wall');}
  else{
   assert.equal(p.isBailing,false,`${yaw}/${dir}: own rail body interrupted the catch`);
   assert.equal(p.state,'grind',JSON.stringify({yaw,dir,frames,position:p.pos.toArray(),grindT:p.grindT,grindDir:p.grindDir,grindVel:p.grindVel,length:rail.totalLength,balance:p.balance,speed:p.speed}));assert.equal(p.grindRail,rail);
   const support=[...l.worldSolids.surfaces].find(s=>s.mesh.userData.editorIdx===1&&s.owner?.t==='rail');assert.ok(support);
   assert.equal(p.isCurrentGrindSupport(support),true);
   p.state='air';assert.equal(p.isCurrentGrindSupport(support),false,'release restores the rail body');
   const probe=p.pos.clone().copy(support.bounds.getCenter(new THREE.Vector3()));
   const cast=l.worldSolids.cast(probe.clone().addScaledVector(heading,-24),probe,{low:.3,high:1,radius:.3},solidContact());
   assert.ok(cast,'the same rail remains physical for airborne/unattached actors');
  }
  results.push({yaw,dir,wall,frames,caught,bail:p.isBailing,position:p.pos.toArray()});
  l.dispose();if(obstacle){obstacle.geometry.dispose();obstacle.material.dispose();}
 }
});
await writeFile(process.env.GRIND_SOLID_OUTPUT||'/private/tmp/grind-solid-support.json',JSON.stringify(results,null,2));
console.log(`PASS ${results.length} moving-rock rail approaches: accepted catch support, both directions/yaws, independent walls and restored airborne collision.`);
