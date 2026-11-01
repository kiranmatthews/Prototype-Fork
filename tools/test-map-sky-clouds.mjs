import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
  const {MapSkySanctuary}=await server.ssrLoadModule('/src/mapSkySanctuary.ts');
  const scenery={addPiece:async()=>{}};
  const cancelled=new MapSkySanctuary(scenery);cancelled.dispose();await cancelled.ready;
  assert.equal(cancelled.root.children.length,0,'Leaving during preparation must not resurrect the clouds');
  const sanctuary=new MapSkySanctuary(scenery);await sanctuary.ready;
  const clouds=[];sanctuary.root.traverse(o=>{if(o.userData.mapCloudVolume)clouds.push(o);assert.ok(!o.isSprite);});
  const textures=new Set(clouds.map(m=>m.material.uniforms.uVolume.value));
  const geometries=new Set(clouds.map(m=>m.geometry));
  assert.ok(clouds.length>textures.size&&textures.size===3,'Banks must share density storage');
  assert.equal(geometries.size,3);
  assert.ok(clouds.every(m=>m.userData.visualOnly&&m.userData.cloudRoadVisual));
  let disposedTextures=0,disposedGeometry=0,disposedMaterials=0;
  for(const texture of textures){
    assert.ok(texture.isData3DTexture);texture.addEventListener('dispose',()=>disposedTextures++);
    const {data,width,height,depth}=texture.image;
    for(let z=0;z<depth;z++)for(let y=0;y<height;y++)for(let x=0;x<width;x++)
      if(x===0||x===width-1||y===0||y===height-1||z===0||z===depth-1)
        assert.equal(data[4*(x+width*(y+height*z))],0,'Visible cloud curls must not be clipped by the volume box');
  }
  for(const geometry of geometries)geometry.addEventListener('dispose',()=>disposedGeometry++);
  for(const mesh of clouds)mesh.material.addEventListener('dispose',()=>disposedMaterials++);
  const first=clouds[0].position.clone();
  for(let i=0;i<600;i++)sanctuary.update(1/60,new THREE.Vector3(20,129,65));
  assert.ok(clouds[0].position.distanceTo(first)>1,'Cloud bodies drift through world space');
  for(const mesh of clouds){
    assert.ok(mesh.quaternion.equals(new THREE.Quaternion()),'Volumes must not billboard toward the camera');
    assert.ok(mesh.position.toArray().every(Number.isFinite));
    assert.ok(mesh.material.uniforms.uOpacity.value>=.6&&mesh.material.uniforms.uOpacity.value<=.9);
  }
  const bytes=[...textures].reduce((n,t)=>n+t.image.data.byteLength,0);
  sanctuary.dispose();sanctuary.dispose();
  assert.equal(disposedTextures,textures.size,'Each shared volume retires exactly once');
  assert.equal(disposedGeometry,geometries.size);
  assert.equal(disposedMaterials,clouds.length);
  assert.equal(sanctuary.root.children.length,0);
  console.log('PASS map cloud sharing, world-space drift, cancelled preparation and idempotent disposal',{banks:clouds.length,textures:textures.size,bytes});
}finally{await server.close();}
