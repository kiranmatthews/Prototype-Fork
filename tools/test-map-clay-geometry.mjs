import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
import {auditClosedGeometry} from './mesh-topology.mjs';
try{
 const api=await server.ssrLoadModule('/src/mapClayGeometry.ts');
 for(const kind of [...api.CLAY_PLANT_KINDS,'maparch'])for(const low of [false,true]){
  const g=kind==='maparch'?api.clayArchGeometry(low):api.createClayPlantGeometry(kind,low),a=auditClosedGeometry(g);
  assert.equal(a.degenerate,0,kind+' degenerate faces');assert.equal(a.boundaries,0,kind+' open/non-manifold edges');assert.equal(a.winding,0,kind+' inconsistent face winding');
  assert.ok(a.volumes.every(v=>v>1e-8),kind+' inverted or zero-volume shells');assert.ok(a.triangles<15000);
  assert.equal(a.duplicates,0);assert.ok(a.components.every(c=>c.euler===2),kind+' unintended tunnels');
  for(const name of ['position','normal','color'])assert.ok([...g.attributes[name].array].every(Number.isFinite));
  if(kind!=='maparch'){assert.ok(g.userData.leafCount>=3&&g.userData.leafCount<=9);assert.ok(g.hasAttribute('aClayLeaf'));}
  console.log('CLAY',kind,low?'far':'near',JSON.stringify(a));g.dispose();
 }
}finally{await server.close()}
