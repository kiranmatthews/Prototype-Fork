import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';
import {createWarehousePilot,warehouseDock,warehouseGallery,warehouseUpperJourney,warehouseHalfpipe,warehouseStreetCombo} from './warehouse-pilot.mjs';
await withSkateRuntime(async({THREE,server,scene,Level,level,player:p})=>{
 level.dispose();
 const m=await server.ssrLoadModule('/src/levels/codex-lab.ts'),data=m.WAREHOUSE_PARK_LEVEL;
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(structuredClone(data)),'source must survive strict import');
 const l=new Level(scene,{id:'warehouse',name:data.name,data});scene.updateMatrixWorld(true);
 p.competitionMode=false;p.endlessDeaths=true;const t=createWarehousePilot(p,l);
 const roof=data.components.find(c=>c.nm==='Warehouse roof / real ceiling');
 const floor=data.components.find(c=>c.nm==='Continuous concrete floor');
 assert.ok(Math.abs(roof.p[1]-roof.s[1]/2-48)<1e-6,'clear height is twice the previous 24 m');
 assert.ok(floor.s[0]*floor.s[2]>=112*164*2.4,'spacing must grow with the warehouse');
 assert.equal(data.spawn[1],8.15);assert.equal(l.captureData().skateCollectathon,true);
 assert.equal(l.alwaysSkate,false);assert.equal(l.captureData().alwaysSkate,false,'walking option survives editor capture');
 const roofMesh=l.groundMeshes.find(mesh=>data.components[mesh.userData.editorIdx]?.nm===roof.nm);
 const ray=new THREE.Raycaster();for(const x of[-65,0,65])for(const z of[-175,-80,10]){
  ray.set(new THREE.Vector3(x,35,z),new THREE.Vector3(0,1,0));
  const hit=ray.intersectObject(roofMesh)[0];assert.ok(hit&&Math.abs(hit.point.y-48)<1e-6,'real roof closes the 48 m shell');
 }
 const half=data.components.find(c=>c.nm==='Standalone halfpipe / 42 m session');
 assert.equal(half.vkind,'half');assert.equal(half.len,42);
 assert.equal(data.components.filter(c=>c.t==='wall'&&c.p[0]>-55.5&&c.p[0]<-36.5&&c.p[2]>-112&&c.p[2]<-70).length,0,'halfpipe ride envelope must stay free of columns');
 const nodeRails=data.components.filter(c=>c.t==='rail'&&c.pts?.length>=4&&c.pts.some(p=>p[2]>0));
 assert.ok(nodeRails.length>=10,'curves must be editable rail-node paths, not decorative approximations');
 assert.ok(data.components.filter(c=>c.t==='wall'&&/column|support|guide/.test(c.nm??'')).length>=30,'decks and shell need actual structural supports');
 assert.equal(l.skateCollectathon.tokens.length,5);
 assert.deepEqual(l.skateCollectathon.tokens.map(g=>g.y),[6.5,9.5,19.1,29.1,33.1]);
 const report={dimensions:{width:floor.s[0],depth:floor.s[2],height:48,startHeight:8},nodeRails:nodeRails.length};
 t.place(m.WAREHOUSE_START);report.dropIn=t.rideRibbon('Curving arrival drop-in',{speed:16});
 assert.equal(report.dropIn.index,report.dropIn.total);assert.ok(!report.dropIn.bail&&p.pos.y<.1);
 report.halfpipe=warehouseHalfpipe(t,true);console.log('halfpipe',JSON.stringify(report.halfpipe));
 assert.ok(report.halfpipe.reached&&report.halfpipe.launched&&report.halfpipe.apex>4.8&&!report.halfpipe.bail);
 assert.equal(p.groundHit.mesh?.userData.editorIdx,data.components.indexOf(half),'air must return to the standalone halfpipe');
 report.combo=warehouseStreetCombo(t,true);console.log('combo',JSON.stringify(report.combo));
 assert.ok(report.combo.reached&&report.combo.maxMult>=2&&report.combo.curvedTurn>1&&report.combo.points>0&&!report.combo.bail);
 report.dock=warehouseDock(t,true);assert.ok(report.dock.reached&&!report.dock.bail);
 report.gallery=warehouseGallery(t);assert.ok(report.gallery.grind.reached&&!report.gallery.grind.bail);
 report.upper=warehouseUpperJourney(t);console.log('upper',JSON.stringify(report.upper));
 for(const stage of report.upper.stages){assert.ok(stage.reached??stage.index===stage.total,stage.name);assert.equal(stage.bail,false,stage.name);}
 assert.equal(l.skateCollectathon.collected,5);assert.ok(p.pos.y>=32);
 // The high shelf has a real return, not a reward island that strands the rider.
 t.stop();report.roofReturn=t.rideRibbon('Upper return to gantry',{speed:12});
 assert.equal(report.roofReturn.index,report.roofReturn.total);assert.ok(!report.roofReturn.bail&&Math.abs(p.pos.y-28)<.2);
 // Exercise the actual checkpoint contact and verify its supported respawn.
 const cp=l.checkpoints.find(c=>Math.abs(c.spawnPos.y-28.1)<.1);assert.ok(cp);
 t.place([cp.spawnPos.x,cp.box.max.y+2,cp.spawnPos.z],[0,0,-1],false);
 report.checkpoint=t.run(()=>cp.active,{},180);assert.ok(report.checkpoint.reached);
 assert.ok(Math.abs(l.currentSpawn.y-28.1)<.01);
 l.reset(false);assert.equal(l.skateCollectathon.collected,5);
 t.place([m.WAREHOUSE_EXIT[0],9,m.WAREHOUSE_EXIT[2]],[0,0,-1],false);
 report.finish=t.run(()=>p.state==='finished',{},90);assert.ok(report.finish.reached);
 t.place([m.WAREHOUSE_EXIT[0],9,m.WAREHOUSE_EXIT[2]],[0,0,-1],true);
 for(let i=0;i<60;i++)t.tick();assert.notEqual(p.state,'finished');assert.equal(l.skateCollectathon.collected,0);
 const underside=l.skateCollectathon.tokens[0].box.clone();underside.min.y=1.7;underside.max.y=6.5;
 assert.equal(l.skateCollectathon.collect(underside).length,0,'the high area must be reached with the feet');
 if(process.env.WAREHOUSE_REPORT)await writeFile(process.env.WAREHOUSE_REPORT,JSON.stringify({...report,records:t.records},null,2));
 console.log('PASS 48 m enclosure, 2.4× floor, raised start, halfpipe, node-rail combo, five goals, continuous ground-to-roof route, return, checkpoint and exit');
 l.dispose();
});
