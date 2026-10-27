// Actual world-map geometry/controller coverage for the newly playable slot.
// Keep unrelated map-water and presentation baselines in their existing suite.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
const fixture=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
new Function('noop',fixture.slice(fixture.indexOf('function installHeadlessDom()'),fixture.indexOf('\nconst held'))+'\ninstallHeadlessDom();')(()=>{});
const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false}});
const warn=console.warn,error=console.error;let level;
console.warn=(...a)=>{if(!/GLB|failed/i.test(String(a[0])))warn(...a);};
console.error=(...a)=>{if(!/GLB|failed/i.test(String(a[0])))error(...a);};
try{
 const {Level,BUILTIN_LEVELS}=await server.ssrLoadModule('/src/level.ts');
 const {CampaignStore,CAMPAIGN_MAP_EDGES}=await server.ssrLoadModule('/src/campaign.ts');
 const {WorldMapController}=await server.ssrLoadModule('/src/worldMapController.ts');
 const store=new CampaignStore();store.startEphemeral();
 for(const id of ['treehouse-trail','beachfront','jungle','rumblewater-run','coastal-street-run'])store.commitClear(id,{});
 store.commitCompetitionWin('jungle-cup');store.commitClear('custard-creek',{crystal:true});
 level=new Level(new THREE.Scene(),BUILTIN_LEVELS.find(e=>e.id==='warproom'));level.root.updateMatrixWorld(true);
 const player={group:new THREE.Group(),renderPosition:new THREE.Vector3(),setWorldMapPresentationScale(scale){this.group.scale.setScalar(scale??1);},
  stepWorldMapPresentation(position){this.renderPosition.copy(position);},snapRenderInterpolation(){}};
 const entered=[],visits=[],controller=new WorldMapController(store,player,{onSelection(){},onEnterLevel:id=>entered.push(id),onOpenSection(){}});
 const neutral={moveX:0,moveY:0,mapDirectionX:0,mapDirectionY:0},directions={up:[0,1],down:[0,-1],left:[-1,0],right:[1,0]};
 const settle=()=>{let frames=0;while(controller.moving&&frames++<2400)controller.step(1/60,neutral);assert.equal(controller.moving,false);return frames;};
 const visit=key=>{
  const from=controller.selectedKey,edge=CAMPAIGN_MAP_EDGES.find(e=>e.from===from&&e.to===key);assert.ok(edge);
  // The current island-facing camera assigns live screen directions. Static
  // graph fromDirection values predate that view and are not keyboard inputs.
  let direction;
  for(const [name,vector]of Object.entries(directions)){
   controller.activate(level,from);
   if(controller.availableDirections()[name]&&controller.navigate(...vector)&&controller.destinationKey===key){direction=name;break;}
  }
  assert.ok(direction,`No current directional input reaches ${key} from ${from}`);
  assert.equal(controller.enterSelected(),false,'cannot enter while moving');
  const frames=settle();assert.equal(controller.selectedKey,key);
  const position=level.campaignMapPose(key).position,ray=new THREE.Raycaster(position.clone().add(new THREE.Vector3(0,1,0)),new THREE.Vector3(0,-1,0),0,2);
  assert.ok(ray.intersectObjects(level.groundMeshes,false).length,'map node is supported');
  assert.ok(player.renderPosition.distanceTo(position)<.01);visits.push({from,key,direction,frames,position:position.toArray()});
 };
 controller.activate(level,'custard-creek');visit('tribal-run');assert.equal(controller.enterSelected(),true);assert.equal(entered.at(-1),'tribal-run');
 assert.equal(store.levelPlayable('test'),false,'Uga Ambush unlocked before Tribal Run was cleared');
 store.commitClear('tribal-run',{crystal:true});controller.refresh();visit('waterfall-climb');assert.equal(controller.enterSelected(),false,'placeholder must not launch');
 visit('test-course');assert.equal(controller.enterSelected(),true);assert.equal(entered.at(-1),'test');
 assert.equal(controller.travelTo('tribal-run'),true);const returnFrames=settle();assert.equal(controller.selectedKey,'tribal-run');
 assert.equal(controller.enterSelected(),true);assert.equal(entered.at(-1),'tribal-run');controller.deactivate();assert.deepEqual(player.group.scale.toArray(),[1,1,1]);
 const report={pass:true,checkedAt:new Date().toISOString(),visits,returnFrames,entered};
 const out=process.env.TRIBAL_VALIDATION_OUTPUT||'docs/tribal-run/validation';await mkdir(out,{recursive:true});await writeFile(out+'/campaign-route.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{level?.dispose();await server.close();console.warn=warn;console.error=error;}
