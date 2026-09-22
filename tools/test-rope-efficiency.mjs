import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
  const {BraidedRope,ropeLocalPoint}=await server.ssrLoadModule('/src/ropeGeometry.ts');
  let checked=0;
  for(const len of [.001,1.2,3,8,24,80,200]){
    const rope=new BraidedRope(len,.105),geometry=rope.mesh.geometry;
    const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
    const buffers=[positions.array,normals.array,geometry.index.array];
    assert.equal(rope.radialSegments,8);assert.ok(rope.segments>=24&&rope.segments<=96);
    assert.equal(geometry.index.count/3,rope.segments*rope.radialSegments*2);
    if(len>=3)assert.ok(geometry.index.count/3<=24*Math.min(420,Math.max(32,Math.ceil(len*22)))*.25);
    assert.equal(rope.mesh.material.map,null,'strand detail needs no decoded canvas or GPU texture');
    for(const [theta,bend,sway,offset] of [[0,0,0,0],[.8,1.3,-.5,0],[-.6,-.8,.4,100000]]){
      const state={len,theta,bend,sway};
      const sample=(d,out)=>ropeLocalPoint(state,d,out).addScalar(offset);
      rope.update(sample);
      for(const [i,buffer] of [positions.array,normals.array,geometry.index.array].entries())
        assert.equal(buffer,buffers[i],'deformation must reuse all buffers');
      const centre=new THREE.Vector3(),expected=new THREE.Vector3(),vertex=new THREE.Vector3(),normal=new THREE.Vector3();
      const stride=rope.radialSegments+1;
      for(let ring=0;ring<=rope.segments;ring++){
        centre.set(0,0,0);
        for(let j=0;j<rope.radialSegments;j++)centre.add(vertex.fromBufferAttribute(positions,ring*stride+j));
        centre.multiplyScalar(1/rope.radialSegments);
        sample(ring/rope.segments*len,expected);
        const tolerance=offset?0.014:2e-5;
        assert.ok(centre.distanceTo(expected)<tolerance,'visible tube must follow the physical curve');
        assert.ok(Math.abs(uv.getY(ring*stride)-ring/rope.segments*len)<2e-5,'braid pitch uses metres');
        for(let j=0;j<=rope.radialSegments;j++){
          vertex.fromBufferAttribute(positions,ring*stride+j);normal.fromBufferAttribute(normals,ring*stride+j);
          assert.ok(vertex.toArray().every(Number.isFinite));assert.ok(Math.abs(normal.length()-1)<1e-5);
          assert.ok(geometry.boundingBox.containsPoint(vertex),'conservative box includes rounded uploaded floats');
          assert.ok(geometry.boundingSphere.containsPoint(vertex),'culling sphere includes the whole tube');
        }
      }
      sample(len,expected);assert.ok(rope.endKnot.position.distanceTo(expected)<1e-12);
      checked++;
    }
    // Outward winding agrees with the analytic normals, including a simple
    // straight case where back-face lighting must not invert the strand relief.
    rope.update((d,out)=>out.set(0,-d,0));
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3();
    for(let i=0;i<geometry.index.count;i+=3){
      const ia=geometry.index.getX(i),ib=geometry.index.getX(i+1),ic=geometry.index.getX(i+2);
      a.fromBufferAttribute(positions,ia);b.fromBufferAttribute(positions,ib);c.fromBufferAttribute(positions,ic);
      n.fromBufferAttribute(normals,ia);assert.ok(b.sub(a).cross(c.sub(a)).dot(n)>0);
    }
    const knotUv=rope.endKnot.geometry.getAttribute('uv'),knotLength=knotUv.getY(48*7);
    assert.ok(Math.abs(knotLength/.16-Math.round(knotLength/.16))<1e-5,'knot strand seam wraps exactly');
    assert.equal(knotUv.getX(6),1);assert.equal(knotUv.getX(48*7),0);
    geometry.dispose();rope.mesh.material.dispose();rope.endKnot.geometry.dispose();rope.endKnot.material.dispose();
  }
  console.log(`PASS ${checked} rope curves: bounded topology/buffers, contact centreline, knot endpoints/UV seam, metre-scale braid, outward winding and conservative culling.`);
}finally{await server.close();}
