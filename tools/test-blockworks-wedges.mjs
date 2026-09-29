import assert from 'node:assert/strict';
import {makeInput} from './jungle-cup-harness.mjs';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {l,THREE,sourceModule:m,source}=r,ramps=m.BLOCKWORKS_SKATE_RAMPS;
 assert.equal(ramps.length,19);
 assert.ok(ramps.every(w=>w.width<=3));
 const ghosts=l.root.children.filter(o=>o.userData.outlinedSurface);
 assert.ok(ghosts.length>=20&&ghosts.every(o=>!l.groundMeshes.includes(o)));
 for(const c of l.crates.filter(c=>c.bang))l.triggerBang(c);
 assert.ok(ghosts.every(o=>l.groundMeshes.includes(o)),'activated wedges/lids must be rideable');
 l.root.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),evidence=[];
 for(const w of ramps){
  const dx=w.high[0]-w.low[0],dz=w.high[2]-w.low[2],length=Math.hypot(dx,dz),dy=w.high[1]-w.low[1];
  let obstruction=0,missing=0;
  for(let i=0;i<=24;i++)for(const side of [-.25,0,.25]){
   const t=(i+.01)/24.02,x=w.low[0]+dx*t-dz/length*w.width*side,z=w.low[2]+dz*t+dx/length*w.width*side,y=w.low[1]+dy*t;
   ray.set(new THREE.Vector3(x,50,z),down);ray.far=100;
   const hit=ray.intersectObjects(l.groundMeshes,false).find(h=>h.face.normal.y>.15);
   if(!hit||hit.point.y<y-.04)missing++;
   else obstruction=Math.max(obstruction,hit.point.y-y);
  }
  evidence.push({name:w.name,length,rise:dy,width:w.width,obstruction,missing,low:w.low,high:w.high});
 }
 console.log(JSON.stringify(evidence,null,2));
 for(const row of evidence){assert.equal(row.missing,0,row.name+' unsupported ramp');assert.ok(row.obstruction<.26,row.name+' blocked by higher geometry '+row.obstruction);}
 // Drive every authored wedge using the production controller and normal
 // acceleration. Full-world surface probes above separately catch occlusion.
 const rides=[];
 for(const w of ramps){
  const dx=w.high[0]-w.low[0],dz=w.high[2]-w.low[2],len=Math.hypot(dx,dz),fx=dx/len,fz=dz/len,yaw=-Math.atan2(fx,-fz)*180/Math.PI;
  const start=[w.low[0]-fx*8,w.low[1]+.06,w.low[2]-fz*8];
  const component=source.components.find(c=>c.nm===w.name);
  const fixture=new r.Level(new THREE.Scene(),{id:'wedge-roll',name:w.name,data:{v:1,name:w.name,spawn:start,killY:-30,components:[
   {t:'platform',p:[w.low[0]-fx*7.95,w.low[1]-.5,w.low[2]-fz*7.95],s:[8,1,16],yaw,edgeGrinding:false},
   {...component,outline:undefined},
   {t:'platform',p:[w.high[0]+fx*9.95,w.high[1]-.5,w.high[2]+fz*9.95],s:[8,1,20],yaw,edgeGrinding:false},
   {t:'gate',p:[w.high[0]+fx*19,w.high[1],w.high[2]+fz*19],yaw},
  ]}});fixture.setRunModesEnabled(false);fixture.root.updateMatrixWorld(true);
  const p=new r.Player(fixture.scene);p.enterLevel('wedge-roll');p.respawn(fixture,true,false,{position:new THREE.Vector3(...start),heading:new THREE.Vector3(fx,0,fz)});
  let climbed=false,boardFrames=0,footFrames=0;
  for(let frame=0;frame<600;frame++){
   p.step(1/60,makeInput({moveX:fx,moveY:-fz,jumpHeld:true,jumpPressed:frame===0}),fixture);fixture.update(1/60);
   assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),w.name+' failed skate ascent');
   const progress=(p.pos.x-w.low[0])*fx+(p.pos.z-w.low[2])*fz;
   if(progress>.1&&progress<len-.1){if(p.freeSkate)boardFrames++;else footFrames++;}
   if(progress>len+.5&&p.grounded&&Math.abs(p.pos.y-w.high[1])<.1){climbed=true;break;}
  }
  assert.ok(climbed&&boardFrames>0&&footFrames===0,w.name+' required foot climbing '+JSON.stringify({climbed,boardFrames,footFrames,pos:p.pos.toArray()}));
  rides.push({name:w.name,boardFrames});p.group.removeFromParent();fixture.dispose();
 }
 console.log(JSON.stringify({skateAscents:rides},null,2));
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(source));
 const captured=l.captureData();assert.equal(captured.components.filter(c=>c.outline&&c.t==='mesh').length,ghosts.length);
 const cp=l.checkpoints[0];l.activateCheckpoint(cp,0,0,0,0);l.reset(false);
 assert.ok(ghosts.every(o=>l.groundMeshes.includes(o)),'checkpoint reset lost built ramps');
 l.reset(true);assert.ok(ghosts.every(o=>!l.groundMeshes.includes(o)),'hard reset left switch ramps active');
 l.activateCheckpoint(cp,0,0,0,0);
 for(const c of l.crates.filter(c=>c.bang))l.triggerBang(c);
 l.reset(false);assert.ok(ghosts.every(o=>!l.groundMeshes.includes(o)),'checkpoint restored ramps built after the save');
 console.log('PASS all 19 wedge lines supported and unobstructed; partial widths; switch activation, capture and reset');
});
