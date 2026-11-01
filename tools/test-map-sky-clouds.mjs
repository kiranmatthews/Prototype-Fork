import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
  const {MapSkySanctuary}=await server.ssrLoadModule('/src/mapSkySanctuary.ts');
  const {CAMPAIGN_LEVELS,CAMPAIGN_ISLANDS}=await server.ssrLoadModule('/src/campaign.ts');
  const scenery={addPiece:async()=>{}};
  const cancelled=new MapSkySanctuary(scenery);cancelled.dispose();await cancelled.ready;
  assert.equal(cancelled.root.children.length,0,'Leaving during preparation must not resurrect the clouds');
  const sanctuary=new MapSkySanctuary(scenery);await sanctuary.ready;
  const clouds=[];sanctuary.root.traverse(o=>{if(o.userData.mapCloudVolume)clouds.push(o);assert.ok(!o.isSprite);});
  const textures=new Set(clouds.map(m=>m.material.uniforms.uVolume.value));
  const geometries=new Set(clouds.map(m=>m.geometry));
  assert.equal(clouds.length,1,'A unified density body avoids overlapping crown seams');
  assert.equal(textures.size,1);
  assert.equal(geometries.size,1);
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
  assert.ok(clouds[0].position.distanceTo(first)>.03,'The cloud body breathes gently through world space');
  for(const mesh of clouds){
    assert.ok(mesh.quaternion.equals(new THREE.Quaternion()),'Volumes must not billboard toward the camera');
    assert.ok(mesh.position.toArray().every(Number.isFinite));
    assert.ok(mesh.material.uniforms.uLightScale.value===.7);
  }
  // The perimeter is a connected cloud shelf underneath every hub. The hubs
  // stay above a density-shaped crown; no camera-facing opacity fade is needed.
  const centre=CAMPAIGN_ISLANDS.find(i=>i.id==='hidden-shores').centre;
  const surfaceAt=(x,z)=>{let top=-Infinity;
    for(const mesh of clouds){
      const u=mesh.material.uniforms,{data,width,height,depth}=u.uVolume.value.image;
      const px=(x-mesh.position.x)/mesh.scale.x,pz=(z-mesh.position.z)/mesh.scale.z;
      const ix=Math.round((px-u.uMin.value.x)/u.uSize.value.x*(width-1));
      const iz=Math.round((pz-u.uMin.value.z)/u.uSize.value.z*(depth-1));
      if(ix<0||ix>=width||iz<0||iz>=depth)continue;
      for(let y=0;y<height;y++)if(data[4*(ix+width*(y+height*iz))]>40)
        top=Math.max(top,mesh.position.y+(u.uMin.value.y+y/(height-1)*u.uSize.value.y)*mesh.scale.y);
    }return top;
  };
  const hubs=CAMPAIGN_LEVELS.filter(l=>l.islandId==='hidden-shores').map(l=>{
    const p=l.mapPosition,top=surfaceAt(p[0]-centre[0],p[2]-centre[2]);
    assert.ok(top>0&&top<p[1]-centre[1]-.2,`Cloud crown supports and clears ${l.progressKey}: ${top}`);
    return {key:l.progressKey,top};
  });
  for(let i=0;i<180;i++){const a=i*Math.PI*2/180;
    assert.ok(surfaceAt(Math.sin(a)*60,Math.cos(a)*60)>-10,'No open seams around the cloud perimeter');
  }
  console.log({hubs});
  const bytes=[...textures].reduce((n,t)=>n+t.image.data.byteLength,0);
  sanctuary.dispose();sanctuary.dispose();
  assert.equal(disposedTextures,textures.size,'Each shared volume retires exactly once');
  assert.equal(disposedGeometry,geometries.size);
  assert.equal(disposedMaterials,clouds.length);
  assert.equal(sanctuary.root.children.length,0);
  console.log('PASS cloud island crown, continuous perimeter, cancelled preparation and idempotent disposal',{banks:clouds.length,textures:textures.size,bytes});
}finally{await server.close();}
