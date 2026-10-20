import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
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
  for(const other of islands)if(other!==island)assert.ok(Math.hypot(island.centre[0]-other.centre[0],island.centre[1]-other.centre[1],island.centre[2]-other.centre[2])>180,'overlapping islands');
 }
 assert.deepEqual(c.validateCampaignMapGraph(),[]);
 assert.deepEqual(new Set(c.CAMPAIGN_MAP_EDGES.map(e=>e.fromDirection)),new Set(['left','right','up','down']));
 const manifest=JSON.parse(await readFile('public/map-landmarks/manifest.json','utf8'));
 let triangles=0,pieces=0;
 for(const level of levels){
  const layout=d.MAP_SCENERY_LAYOUTS[level.progressKey];
  if(!level.placeholder)assert.ok(layout,level.name+' missing a Meshy scene');
  if(!layout)continue;
  assert.ok(layout.pieces.length>=7,level.name+' needs surrounding scenery');
  assert.ok(layout.footprint[0]>=36&&layout.footprint[1]>=32);
  assert.ok(layout.pieces.some(p=>p.p[2]>4)&&layout.pieces.some(p=>p.p[2]<-8),'pad is not inside scenery');
  for(const piece of layout.pieces){
    const asset=manifest[piece.asset];assert.ok(asset,'Missing Meshy '+piece.asset);
    assert.ok(asset.originalUVsPreserved);assert.ok(asset.triangles>100);
    assert.ok([...piece.p,piece.extent,piece.yaw,...(piece.size??[])].every(Number.isFinite));
    triangles+=asset.triangles;pieces++;
  }
  assert.ok(d.beaconDioramaPosition(level).distanceTo(new THREE.Vector3(...level.mapPosition))<1e-8,'hub is separate from its scenery');
 }
 assert.ok(new Set(Object.values(d.MAP_SCENERY_LAYOUTS).map(l=>l.footprint.join(','))).size>=12,'uniform scene footprints');
 assert.equal(islands[5].centre[1],125,'secret sanctuary is not in the sky');
 const spend=JSON.parse(await readFile('tools/map-landmarks/tasks.json','utf8'));
 assert.ok(Object.values(spend.tasks).reduce((sum,t)=>sum+(t.consumedCredits??t.estimatedCredits),0)<=500);
 // Exact prior map captures upgrade, while authored/custom maps are preserved.
 const oldCentres=[-95,150,395,640,885,1155];
 const old=c.CAMPAIGN_MAP_HUBS.map(h=>{const n=islands.findIndex(i=>i.levelKeys.includes(h.progressKey));if(n<0)return[h.mapPosition[0],h.mapPosition[2],0,h.mapPosition[1]];const i=islands[n].levelKeys.indexOf(h.progressKey);return[oldCentres[n]+(i-(islands[n].levelKeys.length-1)/2)*26,22,0,1.8+[0,.3,1.2,.6,.2,1.4,1,.4][i]];});
 const current=c.CAMPAIGN_MAP_HUBS.map(h=>[h.mapPosition[0],h.mapPosition[2],0,h.mapPosition[1]]);
 assert.deepEqual(c.migrateCampaignMapPoints(old),current);
 const custom=structuredClone(old);custom[0][0]+=.01;assert.equal(c.migrateCampaignMapPoints(custom),custom);
 console.log(JSON.stringify({islands:6,wrappingRoutes:6,themedBeacons:levels.length,meshInstances:pieces,instancedTriangles:triangles,migration:'pass',directions:'all four, reciprocal and unique'}));
} finally {await server.close()}
