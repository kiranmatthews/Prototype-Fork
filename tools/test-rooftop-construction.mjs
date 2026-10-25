import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';
const out=process.env.ROOFTOP_OUTPUT||'docs/rooftop-kook/construction-seams';
const empty={v:1,name:'Timber check',spawn:[0,.1,0],killY:-20,components:[{t:'platform',p:[0,-.5,0],s:[8,1,8]},{t:'gate',p:[0,0,-3]}]};
await withSkateRuntime(async({server,THREE,Level})=>{
 const {ROOFTOP_RELAY_LEVEL}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 const {dressCarlisleTimberDeck,disposeCarlisleTimberDeck}=await server.ssrLoadModule('/src/carlisleTimber.ts');
 const components=ROOFTOP_RELAY_LEVEL.components.filter(c=>c.t==='crumble');assert.ok(components.length>0);
 const data={...empty,spawn:[...components[0].p],components:[...components,{t:'gate',p:[0,0,-3]}]},level=new Level(new THREE.Scene(),{id:'roof-timber',name:data.name,data}),report={decks:[],motion:[]};
 try{
  level.root.updateMatrixWorld(true);
  for(const [index,crumble]of level.crumbles.entries()){
   const mesh=crumble.mesh,c=components[index],owner=dressCarlisleTimberDeck(mesh,c,true),bounds=[];
   assert.ok(owner);assert.ok(level.groundMeshes.includes(mesh));assert.equal(mesh.material.visible,false);
   const inverse=mesh.matrixWorld.clone().invert();let vertices=0;
   owner.root.traverse(part=>{
    if(!part.isInstancedMesh||part.userData.woodPathMeshFamily!=='plank')return;
    assert.equal(level.groundMeshes.includes(part),false);assert.equal(part.userData.edgeGrinding,false);
    const local=inverse.clone().multiply(part.matrixWorld),instance=new THREE.Matrix4(),position=part.geometry.attributes.position;
    for(let i=0;i<part.count;i++){
     part.getMatrixAt(i,instance);const transform=local.clone().multiply(instance),box=new THREE.Box3();
     for(let j=0;j<position.count;j++){box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position,j).applyMatrix4(transform));vertices++;}
     bounds.push({min:box.min.toArray(),max:box.max.toArray()});
    }
   });
   bounds.sort((a,b)=>a.min[2]-b.min[2]);assert.equal(bounds.length,owner.layout.planks.length);
   const gaps=bounds.slice(1).map((b,i)=>b.min[2]-bounds[i].max[2]);
   assert.ok(bounds.every(b=>Math.abs(b.max[1]-c.s[1]/2)<.00001),'Native board tops must keep their original collider height');
   report.decks.push({name:c.nm,width:c.s[0],boards:bounds.length,vertices,minimumGap:Math.min(...gaps),overlaps:gaps.filter(g=>g<0).length,yaw:owner.layout.profile.plankYawJitterDegrees,scaleJitter:owner.layout.profile.plankScaleJitter});
  }
  level.crumbles.forEach((_,i)=>level.touchCrumble(i));
  for(let tick=0;tick<780;tick++){
   level.update(1/60);
   if(tick%30===0)report.motion.push(level.crumbles.map(c=>c.state));
  }
  assert.ok(report.motion.some(states=>states.includes('gone')),'Deck must still collapse and disappear');
  for(const c of level.crumbles){assert.equal(c.state,'idle');assert.ok(c.mesh.visible);assert.deepEqual(c.mesh.position.toArray(),c.base.toArray());assert.ok(level.groundMeshes.includes(c.mesh));}
  const narrow=new THREE.Mesh(new THREE.BoxGeometry(4,.45,8.2),new THREE.MeshLambertMaterial()),small=dressCarlisleTimberDeck(narrow,{t:'crumble',p:[0,0,0],s:[4,.45,8.2]},true);
  assert.equal(small.layout.profile.plankYawJitterDegrees,1.65);assert.equal(small.layout.profile.plankScaleJitter,.038);
  disposeCarlisleTimberDeck(narrow);narrow.geometry.dispose();narrow.material.dispose();
  await mkdir(out,{recursive:true});await writeFile(out+'/geometry.json',JSON.stringify(report,null,2)+'\n');
  for(const deck of report.decks){assert.equal(deck.overlaps,0,deck.name+' has overlapping board envelopes');assert.ok(deck.minimumGap>.009,'A visible seam must survive all native board extrema');}
  console.log('PASS original native planks have separated envelopes, unchanged contact heights, collapse/return timing and narrow-deck layout',JSON.stringify(report.decks));
 }finally{level.dispose();}
},{levelEntry:{id:'timber-fixture',name:empty.name,data:empty}});
