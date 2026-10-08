import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

let checks=0;
for(const [id,station] of [['jungle-terraces',281.0347032876543],['jungle-skyline',375]]){
 await withBlockworksRuntime(async r=>{
  const {JUNGLE_SEQUEL_ROUTES}=await r.server.ssrLoadModule('/src/levels/jungle-sequels.ts');
  const {WorldSolids,solidContact}=await r.server.ssrLoadModule('/src/worldSolids.ts');
  const route=JUNGLE_SEQUEL_ROUTES.find(route=>route.id===id),up=new r.THREE.Vector3(0,1,0);
  const query={low:.5,high:r.p.worldStandingHeight-.5,radius:.5,axis:up,supportNormal:up,
   ignoreGround:true,groundStep:.8,soleClearance:.08,ignore:surface=>!surface.name.startsWith('Planted earth bank')};
  const feet=(s,side)=>new r.THREE.Vector3(...route.toWorld(s,route.groundAt(s)+.035,side));
  r.l.prepareWorldSolids();
  // Follow the authored curve in short sweeps, including both sides of the
  // eight-metre road. A chord across a tight corner would test a shortcut.
  for(const side of [-2.5,-1.25,0,1.25,2.5])for(let i=0;i<12;i++){
   const s=station-3+i*.5,contact=solidContact();
   assert.equal(r.l.worldSolids.cast(feet(s,side),feet(s+.5,side),query,contact),false,
    `${id} bank blocks the road at ${s}, side ${side}: ${contact.surface?.name}`);
   checks++;
  }
  if(id==='jungle-terraces'){
   // Actual obstructing triangle from the old station-304/306 bank. Its
   // outer edge hung through the station-281 road at rider torso height.
   const geometry=new r.THREE.BufferGeometry();
   geometry.setAttribute('position',new r.THREE.Float32BufferAttribute([
    117.66517119746732,23.421422055305662,-65.59147921362855,
    115.9765591144312,23.898267129653362,-67.26612057786059,
    119.82922063739352,25.448267129653363,-70.45312531420562,
   ],3));
   const mesh=new r.THREE.Mesh(geometry),old=new WorldSolids();
   old.add(mesh,{name:'Planted earth bank · recorded obstruction'});
   assert.ok(old.cast(feet(station-3,1.25),feet(station+3,1.25),query,solidContact()),
    'the recorded old bank must reproduce the actual blocked road');
   old.dispose();geometry.dispose();mesh.material.dispose();checks++;
  }
 },{modulePath:'/src/level.ts',levelId:id,source:m=>m.findLevel(id).data});
}
console.log(`PASS ${checks} native bank-clearance sweeps, including the failing recorded triangle.`);
