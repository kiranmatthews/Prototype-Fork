import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const fixture={v:1,name:'Bonus landing assist',spawn:[0,.1,5],killY:-12,components:[
 {t:'platform',p:[0,-.5,0],s:[24,1,32]},
 {t:'bonusplatform',p:[0,0,0],to:[0,.1,4]},
 {t:'gate',p:[0,0,-12]},
]};
await withBlockworksRuntime(async r=>{
 const {bonusLandingCatch}=await r.server.ssrLoadModule('/src/bonusPlatform.ts');
 const {bonusAlignmentPose,BONUS_LANDING_HOLD}=await r.server.ssrLoadModule('/src/bonusDeparture.ts');
 const {l,p,THREE}=r,top=l.bonusPlatformDiagnostics.topY;
 const state=(patch={})=>({enabled:true,grounded:false,jump:false,rising:false,...patch});
 const at=(radius,height,angle=0)=>new THREE.Vector3(Math.cos(angle)*radius,top+height,Math.sin(angle)*radius);
 const arm=(radius,angle=0)=>l.consumeBonusLanding(at(radius,.6,angle),state({jump:true,rising:true}));
 let checks=0;
 for(let direction=0;direction<16;direction++){
  const angle=direction*Math.PI/8;
  for(const radius of [0,.8,1.45,1.59]){
   l.cancelBonusEntry();arm(radius,angle);
   assert.equal(l.consumeBonusLanding(at(radius,0,angle),state({grounded:true})),true,'supported edge landing rejected');
   assert.equal(l.consumeBonusLanding(at(radius,0,angle),state({grounded:true})),false,'landing consumed twice');checks++;
  }
  for(const radius of [1.6,1.9,2.18])for(const height of [.2,0,-.3]){
   l.cancelBonusEntry();arm(radius,angle);
   assert.equal(l.consumeBonusLanding(at(radius,height,angle),state()),true,`rim catch rejected: ${radius}/${height}`);checks++;
  }
  l.cancelBonusEntry();arm(2.3,angle);
  assert.equal(l.consumeBonusLanding(at(2.3,0,angle),state()),false,'assist reached beyond its bounded collar');
  assert.equal(l.consumeBonusLanding(at(2.3,-1.05,angle),state({grounded:true})),false);
  assert.equal(l.consumeBonusLanding(at(0,0),state({grounded:true})),false,'old miss armed a later walk-on');
 }
 // A clean centered jump is allowed to touch down before the transition.
 l.cancelBonusEntry();arm(0);
 assert.equal(l.consumeBonusLanding(at(0,.2),state()),false);
 assert.equal(l.consumeBonusLanding(at(0,0),state({grounded:true})),true);
 for(const radius of [0,1.5,1.95]){
  l.cancelBonusEntry();
  assert.equal(l.consumeBonusLanding(at(radius,0),state({grounded:true})),false,'walking starts a bonus');
  assert.equal(l.consumeBonusLanding(at(radius,.1),state()),false,'uncommanded fall starts a bonus');
  arm(radius);
  assert.equal(l.consumeBonusLanding(at(radius,2),state()),false,'high fly-over starts a bonus');
 }
 l.cancelBonusEntry();arm(1.9);
 assert.equal(l.consumeBonusLanding(at(1.9,-1.05),state({grounded:true})),false,'base-level jump was pulled onto the deck');
 for(const mode of ['locked','trial','disabled','cancelled']){
  l.cancelBonusEntry();arm(1.9);
  if(mode==='locked')l.setBonusPlatformLocked(true);
  if(mode==='trial')l.setTimeTrial(true);
  if(mode==='cancelled')l.cancelBonusEntry();
  assert.equal(l.consumeBonusLanding(at(1.9,0),state({enabled:mode!=='disabled'})),false,mode);
  l.setTimeTrial(false);l.setBonusPlatformLocked(false);
 }
 assert.equal(bonusLandingCatch({x:2.1,z:0,height:.4},{x:2.1,z:0,height:-.45}),true,'fast descent skipped the deck-height collar');
 assert.equal(bonusLandingCatch({x:0,z:0,height:.1},{x:5,z:0,height:0}),false,'a landing elsewhere swept back through the pad');
 assert.equal(bonusLandingCatch({x:-2.4,z:0,height:3},{x:2.4,z:0,height:2.8}),false);
 assert.equal(bonusLandingCatch({x:1.9,z:0,height:.4},{x:1.9,z:0,height:-2}),false,'large fall caught after passing the base');
 // Actual production Player jumps: centered landings, outer-edge landings and
 // a descending graze that would otherwise hit the cylindrical side.
 const jumps=[];
 l.clockPickup=null; // Keep this isolated landing fixture out of unrelated clock pickups.
 for(const [radius,board] of [[0,false],[1.45,false],[2.1,false],[2.1,true]]){
  p.ttActive=false;l.setTimeTrial(false);p.respawn(l,true);p.pos.set(radius,radius>1.52?.02:top+.02,0);p.settle(l);p.freeSkate=board;l.cancelBonusEntry();
  if(board){p.speed=.6;p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);}
  let entered=false;
  for(let frame=0;frame<150&&!entered;frame++){
   r.tick({jumpHeld:frame<18,jumpReleased:frame===18});
   entered=l.consumeBonusLanding(p.pos,state({grounded:p.grounded,jump:frame===18,rising:p.vVel>.2}));
  }
  assert.ok(entered,`real Player missed entry at radius ${radius}`);
  assert.equal(p.boardRolling,board,'actual landing changed foot/board mode');
  jumps.push({radius,board,position:p.pos.toArray(),grounded:p.grounded});
 }
 // Reuse ordinary jump/ollie pose machinery without changing the suspended run.
 for(const board of [false,true]){
  p.respawn(l,true);p.pos.set(1.9,top-.2,0);p.settle(l);p.freeSkate=board;
  p.runTime=17;p.uberTimer=8;p.vVel=-2;p.grounded=false;p.state='air';p.speed=5;p.walkVelocity.set(2,0,1);
  const keys=['state','grounded','vVel','airborneT','launchVy','airFromSkate','boardOllieAir','doubleJumpAir','slideJumpAir','flipTimer','speed','runTime','uberTimer','teetering','coyoteTimer','lastPlanar','spinTimer','flipT'];
  const before=Object.fromEntries(keys.map(k=>[k,p[k]])),position=p.pos.clone();let peak=0;
  for(let frame=0;frame<=39;frame++){
   const motion=bonusAlignmentPose(frame/60,1.9,.2);
   p.prepareBonusAlignmentPresentation(l,1/60,motion);peak=Math.max(peak,motion.offsetY);
   assert.deepEqual(Object.fromEntries(keys.map(k=>[k,p[k]])),before,'assist changed simulation state');
   assert.deepEqual(p.pos.toArray(),position.toArray());assert.deepEqual(p.walkVelocity.toArray(),[2,0,1]);
   assert.deepEqual(p.group.scale.toArray(),[1,1,1],'hop scaled the whole character');
   p.group.traverse(o=>assert.ok([...o.position,...o.quaternion,...o.scale].every(Number.isFinite)));
  }
  assert.ok(peak>.4);
 }
 const settled=bonusAlignmentPose(BONUS_LANDING_HOLD,1.9,.2);
 assert.equal(settled.progress,1);assert.ok(Math.abs(settled.offsetY)<1e-8);assert.equal(settled.airborne,false);
 assert.equal(bonusAlignmentPose(.25,1.9,.2,true).offsetY,0);
 assert.equal(bonusAlignmentPose(.25,0,0).needed,false);
 console.log('PASS',checks,'radial landing/catch cases; intentional-jump/height/lock guards, actual Player landings, unchanged physics and reused foot/board hop presentation',JSON.stringify(jumps));
},{modulePath:'/src/level.ts',levelId:'bonus-landing-fixture',source:()=>fixture});
