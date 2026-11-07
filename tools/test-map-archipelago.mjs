import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
 const c=await server.ssrLoadModule('/src/campaign.ts'),d=await server.ssrLoadModule('/src/mapDioramas.ts');
 const islands=c.CAMPAIGN_ISLANDS,levels=c.CAMPAIGN_LEVELS;
 assert.equal(new Set(islands.map(i=>i.centre[2])).size,6,'islands collapsed to a horizontal strip');
 assert.ok(islands.some((i,n)=>n>0&&i.centre[0]<islands[n-1].centre[0]),'islands still progress only rightwards');
 for(const island of islands){
  const points=island.levelKeys.map(c.campaignLevelByKey).map(l=>l.mapPosition);
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],angle=Math.atan2(a[0]-island.centre[0],a[2]-island.centre[2]);
   assert.ok((b[0]-a[0])*Math.cos(angle)-(b[2]-a[2])*Math.sin(angle)>0,island.name+' progresses right-to-left');
  }
  const dx=points.slice(1).map((p,i)=>p[0]-points[i][0]),dz=points.slice(1).map((p,i)=>p[2]-points[i][2]);
  assert.ok(dx.some(x=>x>10)&&dx.some(x=>x< -10),island.name+' never wraps back in X');
  assert.ok(dz.some(z=>z>10)&&dz.some(z=>z< -10),island.name+' never wraps back in Z');
  for(const other of islands)if(other!==island)assert.ok(Math.hypot(island.centre[0]-other.centre[0],island.centre[1]-other.centre[1],island.centre[2]-other.centre[2])>180,'overlapping islands');
 }
 assert.deepEqual(c.validateCampaignMapGraph(),[]);
 assert.deepEqual(new Set(c.CAMPAIGN_MAP_EDGES.map(e=>e.fromDirection)),new Set(['right']));
 const manifest=JSON.parse(await readFile('public/map-landmarks/manifest.json','utf8'));
 const rocks=JSON.parse(await readFile('public/desert-canyon/manifest.json','utf8'));
 const plants=JSON.parse(await readFile('public/desert-canyon/plants/manifest.json','utf8'));
 const native=new Map([
  ...rocks.models.map(asset=>['../desert-canyon/'+asset.name,asset]),
  ...plants.assets.map(asset=>['../desert-canyon/plants/'+asset.id,asset]),
 ]);
 const checkedNative=new Set();
 let triangles=0,pieces=0;
 for(const level of levels){
  const layout=d.MAP_SCENERY_LAYOUTS[level.progressKey];
  if(!level.placeholder)assert.ok(layout,level.name+' missing a Meshy scene');
  if(!layout)continue;
  assert.ok(layout.pieces.length>=7,level.name+' needs surrounding scenery');
  assert.ok(layout.footprint[0]>=36&&layout.footprint[1]>=32);
  assert.ok(layout.pieces.some(p=>p.p[2]>4)&&layout.pieces.some(p=>p.p[2]<-8),'pad is not inside scenery');
  for(const piece of layout.pieces){
    const asset=manifest[piece.asset]??native.get(piece.asset);assert.ok(asset,'Missing source asset '+piece.asset);
    if(native.has(piece.asset)){
     if(!checkedNative.has(piece.asset)){
      const bytes=await readFile('public/map-landmarks/'+piece.asset+'.glb');
      assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,'native scenery changed');
      assert.ok(asset.triangles<=30000);checkedNative.add(piece.asset);
     }
    }else assert.ok(asset.originalUVsPreserved);
    assert.ok(asset.triangles>100);
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
 const oldMotu=['treehouse-trail','beachside-run','jungle','rumblewater-run','coastal','jungle-cup'];
 const oldQuagmire=['warehouse','jungle-minefield','nightworks-after-hours','nightworks','quagmire-race','quagmire-boss'];
 const old=c.CAMPAIGN_MAP_HUBS.filter(h=>h.progressKey!=='bryce-canyon').map(h=>{const n=islands.findIndex(i=>i.levelKeys.includes(h.progressKey));if(n<0)return[h.mapPosition[0],h.mapPosition[2],0,h.mapPosition[1]];const keys=n===0?oldMotu:n===4?oldQuagmire:islands[n].levelKeys;const i=keys.indexOf(h.progressKey);return[oldCentres[n]+(i-(keys.length-1)/2)*26,22,0,1.8+[0,.3,1.2,.6,.2,1.4,1,.4][i]];});
 const current=c.CAMPAIGN_MAP_HUBS.map(h=>[h.mapPosition[0],h.mapPosition[2],0,h.mapPosition[1]]);
 assert.deepEqual(c.migrateCampaignMapPoints(old),current);
 const previous=JSON.parse(await readFile(new URL('./fixtures/map-archipelago-before-horizontal.json',import.meta.url),'utf8'));
 assert.deepEqual(c.migrateCampaignMapPoints(previous),current,'Published map captures must adopt the corrected winding');
 const ground=structuredClone(previous);c.CAMPAIGN_MAP_HUBS.forEach((hub,i)=>{
  if(islands[5].levelKeys.includes(hub.progressKey)){ground[i][0]+=290;ground[i][1]+=195;ground[i][3]=Math.round((ground[i][3]-125)*10)/10;}
 });
 assert.deepEqual(c.migrateCampaignMapPoints(ground),current,'The older ground-level secret island must also migrate');
 const edited=structuredClone(previous);edited[0][0]+=.01;assert.equal(c.migrateCampaignMapPoints(edited),edited,'Edited map positions must survive');
 const custom=structuredClone(old);custom[0][0]+=.01;assert.equal(c.migrateCampaignMapPoints(custom),custom);
 console.log(JSON.stringify({islands:6,wrappingRoutes:6,themedBeacons:levels.length,meshInstances:pieces,instancedTriangles:triangles,migration:'pass',directions:'main route right/left, reciprocal and unique'}));
} finally {await server.close()}
