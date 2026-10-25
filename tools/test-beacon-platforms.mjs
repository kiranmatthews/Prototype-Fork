import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
  const {createBeaconArtwork}=await server.ssrLoadModule('/src/beaconPlatform.ts');
  for(const kind of ['arrival','finish']){
    const model=createBeaconArtwork(kind),surfaces=[],geometries=new Set(),materials=new Set();
    let triangles=0,lights=0;
    model.traverse(o=>{
      if(!o.geometry)return;
      geometries.add(o.geometry);materials.add(o.material);
      for(const v of o.geometry.getAttribute('position').array)assert.ok(Number.isFinite(v));
      if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.getAttribute('position').count)/3;
      if(o.userData.beaconSurface)surfaces.push(o);
      if(o.material.isShaderMaterial){lights++;assert.equal(o.material.depthWrite,false);}
      assert.equal(o.material.map??null,null,'beacons must not need texture downloads');
    });
    assert.ok(triangles<35000);assert.ok(lights>=4);model.updateMatrixWorld(true);
    const bound=new THREE.Box3();for(const s of surfaces)bound.expandByObject(s);
    assert.ok(bound.min.y>=-1e-6&&bound.max.y<=2.2/3+.004);
    assert.ok(bound.max.x<=4.85/3&&bound.min.x>=-4.85/3);
    for(const radius of [0,.35,.7,1.05])for(let i=0;i<36;i++){
      const a=i*Math.PI/18;
      const hits=new THREE.Raycaster(new THREE.Vector3(Math.cos(a)*radius,2,Math.sin(a)*radius),new THREE.Vector3(0,-1,0)).intersectObjects(surfaces,false);
      assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-2.2/3)<1e-6,'deck must be flat and supported in all directions');
    }
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
    console.log(`PASS ${kind}: ${triangles} triangles, 144 flat deck contacts, finite smooth geometry, ${lights} texture-free animated light layers`);
  }
}finally{await server.close();}
