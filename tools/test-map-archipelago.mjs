import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
 const c=await server.ssrLoadModule('/src/campaign.ts'),d=await server.ssrLoadModule('/src/mapDioramas.ts');
 const islands=c.CAMPAIGN_ISLANDS,levels=c.CAMPAIGN_LEVELS;
 assert.equal(new Set(islands.map(i=>i.centre[2])).size,6,'islands collapsed to a horizontal strip');
 assert.ok(islands.some((i,n)=>n>0&&i.centre[0]<islands[n-1].centre[0]),'islands still progress only rightwards');
 for(const island of islands){
  const points=island.levelKeys.map(c.campaignLevelByKey).map(l=>l.mapPosition);
  const dx=points.slice(1).map((p,i)=>p[0]-points[i][0]),dz=points.slice(1).map((p,i)=>p[2]-points[i][2]);
  assert.ok(dx.some(x=>x>10)&&dx.some(x=>x< -10),island.name+' never wraps back in X');
  assert.ok(dz.some(z=>z>10)&&dz.some(z=>z< -10),island.name+' never wraps back in Z');
  for(const other of islands)if(other!==island)assert.ok(Math.hypot(island.centre[0]-other.centre[0],island.centre[2]-other.centre[2])>180,'overlapping islands');
 }
 assert.deepEqual(c.validateCampaignMapGraph(),[]);
 assert.deepEqual(new Set(c.CAMPAIGN_MAP_EDGES.map(e=>e.fromDirection)),new Set(['left','right','up','down']));
 let triangles=0;
 for(const level of levels){
  assert.ok(d.MAP_BEACON_THEMES[level.progressKey],level.name+' has no landmark');
  const group=d.createBeaconDiorama(level,level.mapPosition[1]);
  assert.equal(group.children.length,1,'landmark draw calls should be batched');
  const mesh=group.children[0],geometry=mesh.geometry;
  for(const name of ['position','normal','color'])assert.ok([...geometry.getAttribute(name).array].every(Number.isFinite),level.name+' invalid geometry');
  geometry.computeBoundingBox();
  const size=geometry.boundingBox.getSize(new THREE.Vector3());assert.ok(size.x<18&&size.z<15&&size.y<13,level.name+' lost miniature proportions');
  const at=d.beaconDioramaPosition(level);assert.ok(Math.hypot(at.x-level.mapPosition[0],at.z-level.mapPosition[2])>=13.9,'landmark covers its beacon');
  triangles+=geometry.attributes.position.count/3;geometry.dispose();mesh.material.dispose();
 }
 assert.ok(triangles<150000,'map scenery exceeded its lightweight budget');
 // Exact prior map captures upgrade, while authored/custom maps are preserved.
 const oldCentres=[-95,150,395,640,885,1155];
 const old=c.CAMPAIGN_MAP_HUBS.map(h=>{const n=islands.findIndex(i=>i.levelKeys.includes(h.progressKey));if(n<0)return[h.mapPosition[0],h.mapPosition[2],0,h.mapPosition[1]];const i=islands[n].levelKeys.indexOf(h.progressKey);return[oldCentres[n]+(i-(islands[n].levelKeys.length-1)/2)*26,22,0,1.8+[0,.3,1.2,.6,.2,1.4,1,.4][i]];});
 const current=c.CAMPAIGN_MAP_HUBS.map(h=>[h.mapPosition[0],h.mapPosition[2],0,h.mapPosition[1]]);
 assert.deepEqual(c.migrateCampaignMapPoints(old),current);
 const custom=structuredClone(old);custom[0][0]+=.01;assert.equal(c.migrateCampaignMapPoints(custom),custom);
 console.log(JSON.stringify({islands:6,wrappingRoutes:6,themedBeacons:levels.length,landmarkTriangles:triangles,migration:'pass',directions:'all four, reciprocal and unique'}));
} finally {await server.close()}
