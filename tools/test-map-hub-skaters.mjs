import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
  const {WorldMapHubSkaters}=await server.ssrLoadModule('/src/worldMapHubSkaters.ts');
  const {CAMPAIGN_LEVELS:levels,CAMPAIGN_ISLANDS:islands}=await server.ssrLoadModule('/src/campaign.ts');
  const scene=new THREE.Scene(),group=new THREE.Group(),body=new THREE.Group(),rider=new THREE.Group();
  group.scale.setScalar(4.6); group.rotation.y=Math.PI; body.position.y=.2; body.rotation.y=.4;
  scene.add(group);group.add(body);body.add(rider);
  const bone=new THREE.Bone(),geometry=new THREE.BoxGeometry(.5,1,.5),material=new THREE.MeshBasicMaterial();
  const count=geometry.attributes.position.count;
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));
  const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='full character surface';
  rider.add(bone,mesh);mesh.bind(new THREE.Skeleton([bone]));mesh.layers.mask=0;
  const metadata={owner:rider};rider.userData=metadata;
  const poses=new Map(levels.map(level=>[level.progressKey,{position:new THREE.Vector3(...level.mapPosition)}]));
  group.position.copy(poses.get('treehouse-trail').position);
  const residents=new WorldMapHubSkaters({group,riderRef:rider},{campaignMapPose:key=>poses.get(key)});
  assert.equal(rider.userData,metadata,'Cloning changed original authoring ownership');
  residents.sync('treehouse-trail',false,false,()=>true);
  assert.equal(residents.diagnostics.length,6);
  const root=scene.getObjectByName('world-map-hub-skaters');
  let owned=0;
  root.traverse(object=>{if(object.isSkinnedMesh){
    owned++;assert.equal(object.geometry,geometry);assert.equal(object.material,material);
    assert.notEqual(object.skeleton,mesh.skeleton);assert.notEqual(object.skeleton.bones[0],bone);
    assert.equal(object.layers.mask,1);
  }});
  assert.equal(owned,6);
  bone.position.y=.15;body.rotation.y=.7;
  residents.sync('treehouse-trail',true,true,()=>true);scene.updateMatrixWorld(true);
  const entry=root.getObjectByName('map island skater island-1').getObjectByName('full character surface');
  const p=new THREE.Vector3(),q=new THREE.Vector3();
  for(const skin of [mesh,entry]){skin.updateMatrixWorld(true);skin.skeleton.update();}
  mesh.getVertexPosition(0,p).applyMatrix4(mesh.matrixWorld);
  entry.getVertexPosition(0,q).applyMatrix4(entry.matrixWorld);
  assert.ok(p.distanceTo(q)<1e-6,'Live rider and resident differ at the handoff');
  assert.ok(residents.diagnostics.every(rider=>rider.visible),'Pan left an empty endpoint');
  for(const level of levels)for(const [moving,crossing] of [[false,false],[true,false],[true,true]]){
    residents.sync(level.progressKey,moving,crossing,()=>true);
    for(const island of islands){
      const count=residents.diagnostics.filter(r=>r.visible&&r.island===island.id).length+(!crossing&&level.islandId===island.id?1:0);
      assert.equal(count,1,`${level.progressKey}: duplicate or missing skater on ${island.id}`);
    }
  }
  residents.sync('treehouse-trail',false,false,key=>key==='treehouse-trail');
  assert.equal(residents.diagnostics.filter(rider=>rider.visible).length,0,'Locked skaters were exposed');
  let geometryDisposals=0,materialDisposals=0;
  geometry.addEventListener('dispose',()=>geometryDisposals++);material.addEventListener('dispose',()=>materialDisposals++);
  residents.dispose();residents.dispose();
  assert.equal(geometryDisposals,0);assert.equal(materialDisposals,0);
  assert.equal(scene.getObjectByName('world-map-hub-skaters'),undefined);
  assert.equal(rider.userData,metadata);geometry.dispose();material.dispose();mesh.skeleton.dispose();
  console.log('PASS one skater per island at every hub/phase, complete shared surfaces, exact-position handoff, locks and safe teardown');
} finally {await server.close();}
