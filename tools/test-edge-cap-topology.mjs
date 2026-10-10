import assert from 'node:assert/strict';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ server, THREE, Level }) => {
  const { normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const { surfaceBoundaryEdges, joinSurfaceBoundaryEdges } = await server.ssrLoadModule('/src/surfaceEdges.ts');
  const { nightworksGeometry } = await server.ssrLoadModule('/src/nightworksRocks.ts');
  const { buildCarlisleRockTerrain } = await server.ssrLoadModule('/src/levels/carlisle-rock-terrain.ts');
  const make = component => {
    const data = { v:1,name:'Measured rim',spawn:[0,3,0],killY:-30,components:[component,{t:'gate',p:[30,0,0]}] };
    assert.ok(normalizeCustomLevelData(data));
    return new Level(new THREE.Scene(),{id:'__measured_rim',name:data.name,data});
  };
  for(const kind of ['nightplateau','nightlongisland','nightsteppingrock','nightphaserock']){
    const geometry=nightworksGeometry(kind,[8,4,12]),mesh=new THREE.Mesh(geometry);
    const edges=surfaceBoundaryEdges(mesh),paths=joinSurfaceBoundaryEdges(edges);
    assert.ok(edges.length>8&&edges.length<80,`${kind}: used decorative creases instead of its baked cap`);
    assert.ok(edges.every(edge=>edge.every(p=>Math.abs(p.y-2)<1e-5)));
    assert.equal(paths.length,1);assert.ok(paths[0][0].distanceTo(paths[0].at(-1))<1e-5);
    geometry.dispose();mesh.material.dispose();
  }
  for(const ramp of [false,true]){
    const original=ramp?{t:'ramp',p:[0,0,0],len:24,rise:4,w:12}:
      {t:'platform',p:[0,-1,0],s:[12,2,24]};
    const component=buildCarlisleRockTerrain(original,13).surfaces[0];
    assert.ok(component.grindTopTriangles>0);assert.notEqual(component.edgeGrinding,false);
    const level=make(component);
    try{
      const mesh=level.groundMeshes.find(m=>m.userData.editorIdx===0),geometry=mesh.geometry;
      assert.equal(geometry.userData.grindIndices.length,component.grindTopTriangles*3);
      const paths=level.surfaceEdgeRails;
      const edges=surfaceBoundaryEdges(mesh),vertices=new Map();
      const key=p=>p.toArray().map(v=>Math.round(v*10000)).join(',');
      for(const [a,b]of edges)for(const [x,y]of [[a,b],[b,a]]){const k=key(x);const links=vertices.get(k)??[];links.push(key(y));vertices.set(k,links);}
      assert.ok(paths.length>0&&paths.length<=edges.length);
      assert.ok([...vertices.values()].every(links=>links.length===2),'the measured rim must be closed without dangling fragments');
      assert.ok(paths.every(r=>r.points.every(p=>p.y>-.35)),'no grind paths under the rock body');
      // The constructor installs a BVH; geometry capture must restore the top
      // prefix despite any acceleration-induced index reorder.
      const captured=level.captureSurfaceMesh(mesh,{});
      assert.ok(captured.every(c=>Number.isSafeInteger(c.grindTopTriangles)));
      const rebuilt=make(captured[0]);
      try{
        assert.equal(rebuilt.surfaceEdgeRails.length,paths.length);
        for(const r of paths)for(const point of r.points)
          assert.ok(rebuilt.surfaceEdgeRails.some(other=>other.closest(point).distance<.0001),'capture changed a measured rim');
      }finally{rebuilt.dispose();}
      const opted=make({...component,edgeGrinding:false});
      try{assert.equal(opted.surfaceEdgeRails.length,0);}finally{opted.dispose();}
      for(const invalid of [-1,.5,NaN,Infinity,'2',component.indices.length])
        assert.equal(normalizeCustomLevelData({v:1,name:'invalid',spawn:[0,0,0],killY:-30,
          components:[{...component,grindTopTriangles:invalid},{t:'gate',p:[30,0,0]}]}),null);
    }finally{level.dispose();}
  }
  // Front-side closed meshes expose tops, while explicitly double-sided
  // sheets retain their authored winding. Reflections cannot turn a top off.
  const box=new THREE.BoxGeometry(8,2,12).toNonIndexed();box.type='BufferGeometry';
  const mesh=new THREE.Mesh(box);assert.equal(surfaceBoundaryEdges(mesh).length,4);
  mesh.scale.x=-1;assert.equal(surfaceBoundaryEdges(mesh).length,4);
  box.dispose();mesh.material.dispose();
  console.log('PASS exact Nightworks caps, bounded sculpted deck tops, BVH/capture/opt-out fidelity, validation and mirrored top-face selection.');
});
