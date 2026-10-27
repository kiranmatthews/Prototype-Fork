import {puzzleControls} from './puzzle-controls.mjs';
import {approachAncientHoard} from './ancient-gates-entrance-pilot.mjs';

/** All samples go through the production player. Tests may start at a section
 * before a run, but never move the player or mutate obstacles during a run. */
export function* runAncientGates(r,{from=0,to=11,stopAtBonus=false,trial=false,resumeAfterBonus=false,requireAllMainBoxes=false}={}){
 const c=puzzleControls(r),{p,l}=r;
 const hit=function*(name){const b=c.crateNamed(name);if(b?.alive)yield* c.hit(b,name);};
 const walk=function*(x,y,name='approach'){yield* c.walk([x,y,0],name);};
 const hop=function*(x,y,name='clear the opening',opts={}){
  const target=typeof x==='function'?x:[x,y,0],launch=c.pose(),double=opts.double??Math.abs(c.resolve(target)[0]-p.pos.x)>6.4;
  yield* c.charge();yield* c.tick({jumpReleased:true});c.check(p.state==='air',`${name} launches`);
  let popped=false,armed=false;
  yield* c.until(()=>p.grounded,()=>{
   const input={...c.steer(target),...(opts.airButtons??{})};
   if(double&&!popped&&p.vVel<1.5&&p.state==='air'){
    if(!armed){input.jumpHeld=true;armed=true;}else{input.jumpReleased=true;popped=true;}
   }
   if(p.state==='hang')input.jumpHeld=true;
   return input;
  },{label:name,limit:240});
  c.check(c.distance(target)<(opts.tolerance??1.5),`${name} missed receiver`);
  c.check(Math.abs(p.pos.y-c.resolve(target)[1])<(opts.heightTolerance??.16),`${name} landed at wrong height`);
  r.report.evidence.push({action:name,launch:launch.position,landing:p.pos.toArray(),double:popped,ground:p.groundHit?.name});
 };
 const fight=function*(x,name){
  const e=l.enemies.find(e=>Math.abs((e.x0+e.x1)/2-x)<.1),masks=p.masks;
  c.check(e,`${name} exists`);
  if(e.kind==='floater'){
   yield* walk(e.x0-2,e.baseY,`${name} takeoff`);yield* c.charge();yield* c.tick({jumpReleased:true});
   yield* c.until(()=>!e.alive,()=>({...c.steer([e.group.position.x,e.baseY,0]),
    spinHeld:c.distance([e.group.position.x,e.baseY,0])<2.2&&p.pos.y>e.group.position.y-.9}),{label:name,limit:160});
   yield* c.until(()=>p.grounded,()=>c.steer([e.x1+2,e.baseY,0]),{label:`land after ${name}`,limit:180});
   r.report.evidence.push({action:name,kind:e.kind,alive:e.alive});
  }else yield* c.enemy(e,name);
  c.check(p.masks>=masks,`${name} must not spend a mask to conceal contact`);
 };
 const bridge=function*(x,name){const b=l.spinBridges.find(b=>Math.abs(b.component.p[0]-x)<.01);c.check(b,`${name} exists`);
  yield* walk(x-1.2,b.component.p[1],`read ${name}`);yield* c.tick({spinHeld:true});
  yield* c.until(()=>b.deployed,{}, {label:`wait for ${name}`,limit:120});
  yield* walk(x+b.component.s[0]+1,b.component.p[1],`cross ${name}`);
  r.report.evidence.push({action:name,deployed:b.deployed});
 };
 const checkpoint=function*(x){
  const cp=l.checkpoints.find(cp=>Math.abs(cp.spawnPos.x-x)<.01);c.check(cp,'checkpoint exists');
  if(trial){yield* walk(x+.8,cp.box.min.y,`pass checkpoint ${x} in time trial`);return;}
  yield* walk(x-1.1,cp.box.min.y,`checkpoint ${x} approach`);
  let lastSpin=false;
  yield* c.tick({});yield* c.until(()=>cp.active,()=>{const spinHeld=p.spinning||!lastSpin;lastSpin=spinHeld;return {moveX:.2,spinHeld};},{label:`bank checkpoint ${x}`,limit:90});
  yield* c.stepFor(18);r.report.evidence.push({action:'checkpoint',x,active:cp.active});
 };
 const startDeaths=p.totalDeaths;
 const hammer=function*(x,y){
  const cr=l.crushers.find(cr=>cr.x===x);yield* walk(x-4,y,`read hammer ${x}`);
  yield* c.until(()=>{const f=((l.time+cr.phase)%cr.cycle)/cr.cycle;return f>.9&&f<.97;},{},{label:`fresh hammer ${x} opening`,limit:600});
  yield* c.until(()=>p.pos.x>x+3.6,{moveX:1},{label:`cross hammer ${x}`,limit:120});yield* c.stepFor(18);
 };
 const windBell=function*(x,y,clearance=2.8){
  const b=l.pendulums.find(b=>b.pivot.position.x===x);yield* walk(x-2.8,y,`read wind bell ${x}`);
  yield* c.until(()=>{const q=l.time*b.speed+b.phase;return Math.abs(Math.sin(q))>.48&&Math.abs(Math.cos(q))>.72&&Math.sin(q)*Math.cos(q)>0;},{},{label:`wind bell ${x} swings away`,limit:600});
  yield* c.until(()=>p.pos.x>x+clearance,{moveX:1},{label:`cross wind bell ${x}`,limit:120});yield* c.stepFor(12);
 };
 yield* c.stepFor(20);c.check(p.grounded,'supported start');
 if(trial){
  yield* c.walk([-19,0,-2.3],'choose the optional clock alcove');
  yield* c.walk([-16,0,-2.3],'touch the Ancient Gates trial clock');c.check(p.ttActive,'real clock contact starts the trial');
  yield* c.walk([-12,0,0],'rejoin the main route from the trial alcove');
 }
 for(let section=from;section<=to;section++){
  r.report.section=section;r.report.stage=`Section ${section+1}`;
  if(section===0){
   yield* hit('Gatehouse guardian mask');yield* walk(5,0);yield* hop(11.3,1,'root tooth one');
   yield* hit('First root offering');yield* walk(17.2,1);yield* hop(24.4,2.6,'rising root tooth');
   yield* walk(28.2,2.6);yield* hop(36.5,1.2,'falling root tooth');yield* hit('Low root offering');
   yield* walk(41.2,1.2);yield* hop(50.5,3,'long rising root gap');yield* fight(56,'read the first crab');
   yield* walk(61.1,3);yield* hop(69.5,3,'Bristle landing');yield* fight(77,'spin the Bristleback');
   yield* bridge(87,'first split timber gate');yield* checkpoint(105);
  }else if(section===1){
   yield* walk(120.4,3,'read the nitro');yield* hop(127.5,3,'clear the nitro without spinning');
   yield* bridge(131,'second split timber gate');
   yield* c.bounce(c.crateNamed('Split Gate climb arrow'),[162,10,0],'climb the split gate');
   yield* hit('Parapet reward');yield* walk(177.8,10);yield* hop(183,9.5,'first falling lintel');
   yield* hop(192,8,'second falling lintel');yield* hop(200,6.5,'third falling lintel');yield* hop(207,5,'falling lintel exit');
   yield* checkpoint(221);
  }else if(section===2){
   yield* hit('Mossback stair supplies');yield* walk(245,5);yield* hop(253.2,6.2,'lower Mossback stair');
   yield* fight(258,'lower Mossback stomp');yield* walk(263,6.2);yield* hop(271.4,8,'frog stair arrival');
   yield* fight(276,'read the Spring Frog');yield* walk(281,8);yield* hop(290.5,9.4,'upper Mossback stair');
   yield* fight(295,'upper Mossback stomp');yield* walk(299,9.4);yield* hop(309.5,8.2,'Watcher stair descent');
   yield* fight(317,'spin the Watcher');yield* walk(324,8.2);yield* hop(332.5,7,'Mossback refuge');
   yield* hit('Watcher landing reward');yield* checkpoint(343);
  }else if(section===3){
   yield* fight(362,'read the counterweight whirler');yield* walk(372.6,7,'ferry takeoff');const ferry=l.movers[0],lift=l.movers[1];
   yield* c.until(()=>ferry.mesh.position.x<379.5&&ferry.lastDelta.x>=0,{}, {label:'wait for returning counterweight ferry',limit:1000});
   yield* hop(()=>[ferry.mesh.position.x,7,0],null,'board the counterweight ferry',{double:false,tolerance:3});
   c.check(p.groundHit?.moverId===0,'actual ferry support');
   yield* c.until(()=>ferry.mesh.position.x>399,{}, {label:'ride the counterweight across the chasm',limit:1000});
   yield* hop(408,7,'leave ferry for transfer ledge');yield* walk(420,7,'lift observation lip');
   yield* c.until(()=>lift.mesh.position.y<7.4&&lift.lastDelta.y>=0,{}, {label:'wait for the low rising lift',limit:1000});
   yield* hop(()=>[429,lift.mesh.position.y+.425,0],null,'board the rising crown lift',{double:true,tolerance:2.7,heightTolerance:.25});
   c.check(p.groundHit?.moverId===1,'actual lift support');
   yield* c.until(()=>lift.mesh.position.y>12.7,{}, {label:'ride to the high counterweight court',limit:1000});
   yield* hop(439.2,14,'leave lift at the upper court');yield* hit('Hammer Gallery guardian mask');yield* checkpoint(456);
  }else if(section===4){
   yield* hammer(477,14);yield* walk(485,14);yield* hop(495.4,14,'first hammer floor opening');
   yield* hammer(507,14);yield* walk(517,14);yield* hop(525.2,12.5,'drop to swinging gallery tooth');
   yield* windBell(531,12.5);yield* walk(536,12.5);yield* hop(545.3,10,'low hammer descent');
   yield* hammer(557,10);yield* walk(567,10);yield* hop(577.5,9,'hammer gallery exit');yield* hit('Hammer keeper offering');yield* checkpoint(589);
  }else if(section===5){
   yield* walk(601,9,'aqueduct skating run-up');
   yield* c.until(()=>p.pos.x>633,{moveX:1,jumpHeld:true},{label:'accelerate up the aqueduct kicker',limit:400});
   yield* c.tick({moveX:1,jumpReleased:true});
   // Skate air carries its takeoff. Lateral input here deliberately rotates
   // the board, so a clean straight jump releases the stick in flight.
   yield* c.until(()=>p.grounded,{}, {label:'committed aqueduct skate landing',limit:200});
   c.check(p.pos.x>=651&&Math.abs(p.pos.y-10.3)<.2,'actual skate receiver');
   yield* c.until(()=>!p.freeSkate&&Math.abs(p.speed)<.08,{grabHeld:true},{label:'brake on the receiving arch',limit:240});
   yield* c.stepFor(18);yield* hit('Aqueduct landing cache');yield* walk(663,10.3,'aqueduct grind approach');
   yield* c.charge();yield* c.tick({moveX:1,jumpReleased:true,grindHeld:true});
   yield* c.until(()=>p.state==='grind',{moveX:1,grindHeld:true},{label:'catch descending aqueduct rail',limit:100});
   yield* c.until(()=>p.pos.x>691.5,()=>({moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)),moveY:1,grindHeld:true}),{label:'balance the descending aqueduct',limit:800});
   yield* c.until(()=>p.grounded&&p.state==='ride',()=>({moveX:p.state==='grind'?Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)):0,moveY:p.state==='grind'?1:0,grindHeld:true}),{label:'roll off onto the last aqueduct arch',limit:200});
   yield* c.until(()=>!p.freeSkate&&Math.abs(p.speed)<.08,{grabHeld:true},{label:'brake beyond the descending rail',limit:240});
   yield* c.stepFor(18);yield* checkpoint(709);
  }else if(section===6){
   yield* fight(723,'orchard Bristleback');yield* walk(733,8);yield* hop(741.4,9.2,'orchard frog branch');
   yield* fight(747,'orchard Spring Frog');yield* walk(753,9.2);yield* hop(761.5,7.5,'orchard watcher branch');
   yield* fight(768,'orchard Violet Watcher');yield* walk(773,7.5);yield* hop(781.5,8.5,'orchard shell branch');
   yield* fight(787,'orchard Mossback');yield* walk(793,8.5);yield* hop(802.6,6,'bull arena arrival');
   yield* fight(816,'bait the Russet Bull and punish recovery');yield* hit('Bull refuge offering');yield* checkpoint(835);
  }else if(section===7){
   yield* walk(856,6,'read the lantern fire mouth');
   yield* c.until(()=>{const q=(l.time+.15)%4.5;return q<.3;},{},{label:'fresh cool fire-mouth window',limit:600});
   yield* walk(868.8,6,'cross behind cooling flames');yield* hop(877.3,7.4,'reach the lantern staircase');yield* walk(885.8,7.4);
   yield* c.until(()=>l.phasePads[0].on&&(l.time/10)%1<.05,{},{label:'read a fresh lantern wave',limit:800});
   yield* hop(894,8,'first lantern step');c.check(p.groundHit?.name==='phase pad','first lantern support');
   yield* walk(897.8,8);yield* hop(905.7,9,'second lantern step');c.check(p.groundHit?.name==='phase pad','second lantern support');
   yield* walk(909.8,9);yield* hop(917.7,10,'third lantern step');c.check(p.groundHit?.name==='phase pad','third lantern support');
   yield* walk(921.8,10);yield* hop(931.3,10,'leave the lantern wave');yield* hit('Lantern keeper cache');yield* checkpoint(945);
  }else if(section===8){
   yield* windBell(963,10);yield* walk(971,10);yield* hop(979.2,11,'first wind-bell tooth');
   yield* walk(984,11);yield* hop(991.9,12,'second wind-bell tooth');yield* windBell(995,12,1.8);
   yield* walk(998,12);yield* hop(1006.3,13,'third wind-bell tooth');yield* walk(1011,13);yield* hop(1018.9,14,'crown wind-bell tooth');
   yield* windBell(1022,14,1.8);yield* walk(1025,14);yield* hop(1034.3,13,'wind-bell refuge');yield* fight(1043,'bell keeper Moa');yield* checkpoint(1055);
  }else if(section===9){
   if(!resumeAfterBonus){
   yield* walk(1062.7,13,'sunken court descent');yield* hop(1068,10,'drop into the sunken court',{double:false});yield* hit('Sunken masonry seal');
   yield* hop(1081.5,10,'clear the spent seal',{double:false});yield* hop(1088.5,10,'first restored stair');
   yield* hop(1097.5,9,'second restored stair');yield* hop(1106.5,8,'third restored stair');yield* hop(1117,8,'reach the reliquary court');
   if(stopAtBonus){yield* approachAncientHoard(r);return {enteredBonus:true,position:p.pos.toArray(),deaths:p.totalDeaths-startDeaths,frames:r.frame};}
   }else c.check(Math.abs(p.pos.x-1137)<.3&&Math.abs(p.pos.y-8)<.2,'continue from the actual bonus return');
   yield* walk(1137,8,'pass the optional reliquary alcove');
   yield* walk(1140.7,8,'sunken ferry lip');const ferry=l.movers[2];
   yield* c.until(()=>ferry.mesh.position.x<1149&&ferry.lastDelta.x>=0,{},{label:'catch the sunken cross-current',limit:800});
   yield* hop(()=>[ferry.mesh.position.x,8,0],null,'board sunken ferry',{double:true,tolerance:2.8});
   c.check(p.groundHit?.moverId===2,'actual second ferry support');
   yield* c.until(()=>ferry.mesh.position.x>1161,{},{label:'ride out of the switchyard',limit:800});
   yield* hop(1171.3,8,'sunken ferry receiver');yield* hit('Crown guardian mask');yield* checkpoint(1181);
  }else if(section===10){
   yield* c.bounce(c.crateNamed('Lower crown arrow'),[1210,15,0],'lower crown ascent',{double:true});
   yield* c.bounce(c.crateNamed('Upper crown arrow'),[1230,22,0],'upper crown ascent',{double:true});yield* fight(1236,'crown Violet Watcher');
   yield* walk(1241,22);yield* hop(1249,23.5,'narrow crown tooth');yield* walk(1254,23.5);yield* hop(1262,25,'highest crown tooth');
   yield* hit('Crown summit offering');yield* walk(1270,25);yield* hop(1279.3,24,'last gate refuge');yield* checkpoint(1286);
  }else if(section===11){
   yield* walk(1292.8,24);yield* hop(1300,23,'last falling tooth one');yield* hop(1310,21.5,'last falling tooth two');
   yield* hop(1320,20,'last falling tooth three');yield* hop(1330.4,18.5,'last whirler receiver');yield* fight(1336,'last Brass Whirler');
   yield* walk(1341,18.5);yield* hop(1350.2,17,'last isolated keystone');yield* walk(1355,17);yield* hop(1363.2,16,'sanctuary landing');
   yield* fight(1368,'sanctuary sentinel crab');yield* hit('Last gate offering');yield* hit('Clear the gate mine');
   if((from===0||requireAllMainBoxes)&&!trial)yield* c.clearAll('all main-route Ancient Gates boxes');
   yield* c.charge();yield* c.tick({jumpReleased:true});
   yield* c.until(()=>p.state==='finished',()=>c.steer([1376,16,0]),{label:'clear the spent mine switch into the Ancient Gates finish',limit:180});
  }
  c.check(p.ttActive===(trial&&section<11),trial?'clock-started trial remains active until the finish':'main route must not accidentally activate the optional clock');
  c.check(p.totalDeaths===startDeaths,'no hidden respawn during a section');
  r.report.evidence.push({action:'section complete',section,position:p.pos.toArray(),frame:r.frame});
 }
 return {from,to,position:p.pos.toArray(),deaths:p.totalDeaths-startDeaths,frames:r.frame,state:p.state,
  cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,bonusCrates:p.bonusCrates,gemEarned:p.gemEarned,...(trial?{trialTime:p.ttTime,medalTimes:l.medalTimes}:{})};
}
