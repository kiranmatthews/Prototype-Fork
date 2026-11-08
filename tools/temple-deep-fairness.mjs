// Deep review pilots for Temple of Embers fairness questions. Each case uses
// the production Level and Player through ordinary device samples; the only
// placement is the respawn position before a case starts. Cases:
//   caps      standing jump from a reservoir deck lip at the suspended cap
//   nitro920  respawn at the crown court checkpoint and push forward-right
//   sanctuary walk the procession centre lane at many patrol phases, no spin
//   gaps      fall beside the pit volumes of all four gaps and see what lands
//   refuge    stand in the summit fuse refuge and beside the restored caches
// Evidence goes to docs/temple-embers-design/deep/fairness.json.
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const OUT=process.env.TEMPLE_DEEP_OUTPUT||'docs/temple-embers-design/deep';
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const want=name=>!only||only.includes(name);
await mkdir(OUT,{recursive:true});

await withBlockworksRuntime(async r=>{
 const {l,p,THREE}=r,route=r.sourceModule.JUNGLE_TERRACES_ROUTE,report={};
 const local=q=>route.toLocal(Array.isArray(q)?q:q.toArray()).map(n=>+n.toFixed(2));
 const camera=()=>{const cam=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};p.camDir.set(cam.x,0,cam.z);};
 const place=(s,side,up=.12)=>{p.respawn(l,true,false,{position:new THREE.Vector3(...route.toWorld(s,route.groundAt(s)+up,side))});p.masks=0;r.stepFor(10);};
 const toward=(s,side,pace=1)=>{const q=route.toWorld(s,p.pos.y,side);return r.worldDirectionInput({x:q[0]-p.pos.x,z:q[2]-p.pos.z},pace);};
 const pose=()=>({local:local(p.pos),state:p.state,grounded:p.grounded,bailing:p.isBailing,deaths:p.totalDeaths,speed:+p.speed.toFixed(2),ground:p.groundHit?.name??null});
 const crateAt=(s,y,side=0)=>{let best=null,cost=Infinity;for(const c of l.crates){const q=local(c.box.getCenter(new THREE.Vector3()));const d=Math.hypot(q[0]-s,q[2]-side)+Math.abs(c.box.min.y-y)*.5;if(d<cost){cost=d;best=c;}}return cost<.8?best:null;};

 if(want('caps')){
  // Standing jump at each suspended cap from the deck lip, drifting toward
  // the bowl in the air. Also the giant bowl's entry life from its entry deck.
  const cases=[];
  for(const pipe of route.pipes){
   const half=(pipe.b-pipe.a)/2,wall=pipe.radius*Math.sin(pipe.arc*Math.PI/180),flat=half-wall-2,mid=(pipe.a+pipe.b)/2;
   const lipExit=mid+flat+wall,lipEntry=mid-flat-wall;
   const targets=[{s:pipe.b-2.6,stand:lipExit+.65,label:'exit cap'}];
   if(pipe.name.startsWith('Giant'))targets.push({s:pipe.a+2.6,stand:lipEntry-.65,label:'entry life'});
   for(const target of targets){
    const cap=crateAt(target.s,pipe.lipY+2.6);
    if(!cap){cases.push({pipe:pipe.name,label:target.label,error:'cap not found'});continue;}
    for(const [variant,chargeFrames]of [['charged',26],['tap',4]]){
     place(target.stand,0);
     const before={alive:cap.alive,pose:pose()};
     let peak=p.pos.y,launchV=null,frames=0;
     camera();r.stepFor(chargeFrames,{jumpHeld:true});r.tick({jumpHeld:false,jumpReleased:true});launchV=+p.vVel.toFixed(2);
     for(let i=0;i<110&&!(p.grounded&&i>8);i++){camera();peak=Math.max(peak,p.pos.y);r.tick({...toward(target.s,0,1)});frames++;if(!cap.alive)break;}
     r.stepFor(20);
     cases.push({pipe:pipe.name,label:target.label,variant,capStation:+target.s.toFixed(2),capBottom:+cap.box.min.y.toFixed(2),standStation:+target.stand.toFixed(2),
      lipTop:+(target.label==='exit cap'?lipExit:lipEntry).toFixed(2),launchVertical:launchV,peakFeet:+(peak-route.groundAt(target.stand)).toFixed(2),
      broke:!cap.alive,framesToBreak:frames,after:pose(),deaths:p.totalDeaths-before.pose.deaths});
    }
   }
  }
  report.caps=cases;console.log(JSON.stringify({caps:cases.map(c=>({pipe:c.pipe,label:c.label,variant:c.variant,broke:c.broke,peak:c.peakFeet,launch:c.launchVertical,landing:c.after?.local}))}));
 }

 if(want('nitro920')){
  const cases=[];
  const cp=l.checkpoints.map(c=>({c,s:local(c.spawnPos)[0]})).sort((a,b)=>Math.abs(a.s-920)-Math.abs(b.s-920))[0].c;
  const nitros=l.crates.filter(c=>c.nitro&&Math.abs(local(c.box.getCenter(new THREE.Vector3()))[0]-924)<6);
  for(const [label,dir,charge]of [['forward walk',0,false],['forward-right walk',.5,false],['right walk',1,false],['forward skate charge',0,true],['forward-right skate',.5,true]]){
   p.respawn(l,true,false,{position:cp.spawnPos.clone()});p.masks=0;r.stepFor(10);
   const start=pose(),alive0=nitros.map(n=>n.alive);
   let firstContact=null;
   for(let i=0;i<150;i++){
    camera();const f=route.frameAt(local(p.pos)[0]);
    const fwd={x:f.fx,z:f.fz},right={x:-f.fz,z:f.fx};
    const d={x:fwd.x*(1-dir)+right.x*dir,z:fwd.z*(1-dir)+right.z*dir};
    r.tick({...r.worldDirectionInput(d,1),jumpHeld:charge});
    if(firstContact===null&&nitros.some((n,k)=>n.alive!==alive0[k]))firstContact={frame:i,seconds:+(i/60).toFixed(2),pose:pose()};
    if(p.totalDeaths>start.deaths)break;
   }
   cases.push({label,spawn:start.local,nearestNitro:Math.min(...nitros.map(n=>n.box.distanceToPoint(cp.spawnPos))).toFixed(2),died:p.totalDeaths>start.deaths,nitroTouched:firstContact,end:pose()});
  }
  report.nitro920=cases;console.log(JSON.stringify({nitro920:cases}));
 }

 if(want('sanctuary')){
  const cases=[];
  const guardians=l.enemies.filter(e=>e.kind==='grunt'&&local(e.group.position)[0]>1300);
  for(const lane of [0,-.35,.35])for(const skate of [false,true])for(let wait=0;wait<480;wait+=48){
   place(1338,lane);
   r.stepFor(wait);
   const start=pose();let hit=null,maxSide=0;
   for(let i=0;i<900&&local(p.pos)[0]<1382;i++){
    camera();const s=local(p.pos)[0];
    r.tick({...toward(s+6,lane,1),jumpHeld:skate});
    maxSide=Math.max(maxSide,Math.abs(local(p.pos)[2]-lane));
    if(p.totalDeaths>start.deaths||p.isBailing){hit={pose:pose(),guardians:guardians.map(g=>({alive:g.alive,local:local(g.group.position)}))};break;}
   }
   cases.push({lane,skate,waitFrames:wait,died:p.totalDeaths>start.deaths,bailed:p.isBailing,hit,maxDrift:+maxSide.toFixed(2),guardiansAlive:guardians.map(g=>g.alive),end:pose()});
  }
  const deaths=cases.filter(c=>c.died||c.bailed).length;
  report.sanctuary={cases,deaths,total:cases.length,guardianBoxes:guardians.map(g=>({s:local(g.group.position)[0],w:+g.box.getSize(new THREE.Vector3()).x.toFixed(2),x0:local((()=>{const q=g.group.position.clone();q[g.axis]=g.x0;return q;})()),x1:local((()=>{const q=g.group.position.clone();q[g.axis]=g.x1;return q;})())}))};
  console.log(JSON.stringify({sanctuary:{deaths,total:cases.length,byLane:[0,-.35,.35].map(lane=>({lane,deaths:cases.filter(c=>c.lane===lane&&(c.died||c.bailed)).length,walkDeaths:cases.filter(c=>c.lane===lane&&!c.skate&&(c.died||c.bailed)).length})),guardianBoxes:report.sanctuary.guardianBoxes,
   hits:cases.filter(c=>c.hit).map(c=>({lane:c.lane,skate:c.skate,wait:c.waitFrames,at:c.hit.pose.local,state:c.hit.pose.state,guardians:c.hit.guardians}))}}));
 }

 if(want('gaps')){
  const cases=[];
  const drops=[[258.5,3.5,'jade bridge gap, lane edge inside the 8 m floor (bend sliver)'],[262,4.6,'jade bridge gap, shoulder'],[455,0,'sanctuary ollie gap, centre (control: pit must kill)'],[455,4.6,'sanctuary ollie gap, shoulder'],[455,-4.6,'sanctuary ollie gap, left shoulder'],[964,-4.6,'crown bridge gap, left shoulder'],[964,4.6,'crown bridge gap, right shoulder'],[1227.5,4.6,'final leap gap, right shoulder'],[1227.5,-4.6,'final leap gap, left shoulder'],[1227.5,0,'final leap gap, centre (control)']];
  for(const [s,side,label]of drops){
   const y=route.groundAt(s);
   p.respawn(l,true,false,{position:new THREE.Vector3(...route.toWorld(s,y-.5,side))});p.masks=0;
   const deaths=p.totalDeaths;let frames=0,landed=null;
   for(let i=0;i<900;i++){camera();r.tick({});frames++;if(p.totalDeaths>deaths)break;if(p.grounded&&i>20){landed=pose();r.stepFor(60);break;}}
   cases.push({label,s,side,fromY:+y.toFixed(1),died:p.totalDeaths>deaths,framesUntilDeath:p.totalDeaths>deaths?frames:null,secondsFalling:+(frames/60).toFixed(2),landed,finalPose:pose(),finalY:+p.pos.y.toFixed(1),dropMetres:landed?+(y-p.pos.y).toFixed(1):null});
  }
  report.gaps=cases;console.log(JSON.stringify({gaps:cases.map(c=>({label:c.label,died:c.died,secs:c.secondsFalling,drop:c.dropMetres,landed:c.landed?.local,ground:c.landed?.ground,state:c.finalPose.state}))}));
 }

 if(want('refuge')){
  const cases=[];
  for(const [s,side,label]of [[371.5,1.1,'summit refuge paver, right'],[371.5,-1.1,'summit refuge paver, left'],[373.9,-2.3,'collecting the second restored cache (standing beyond it)'],[370.4,-2.3,'collecting the first restored cache (standing before it)'],[818.5,1.1,'cloud refuge paver, right'],[818.5,-1.1,'cloud refuge paver, left']]){
   place(s,side);const deaths=p.totalDeaths,masks=p.masks;let firstDeath=null;
   for(let i=0;i<8.2*60;i++){camera();r.tick({});if(p.totalDeaths>deaths){firstDeath={seconds:+(i/60).toFixed(2),tiki:l.fireTikis.map(t=>t.state.phase)};break;}}
   cases.push({label,s,side,died:p.totalDeaths>deaths,firstDeath,end:pose()});
  }
  report.refuge=cases;console.log(JSON.stringify({refuge:cases.map(c=>({label:c.label,died:c.died,at:c.firstDeath?.seconds}))}));
 }

 if(want('caps2')){
  // Instrumented standing jumps at the teaching and high sanctuary exit caps.
  const cases=[];
  for(const pipe of route.pipes){
   const half=(pipe.b-pipe.a)/2,wall=pipe.radius*Math.sin(pipe.arc*Math.PI/180),flat=half-wall-2,mid=(pipe.a+pipe.b)/2,lipExit=mid+flat+wall;
   const capS=pipe.b-2.6,cap=crateAt(capS,pipe.lipY+2.6);
   for(const [variant,stand,steer,chargeFrames]of [['lip, steer back',lipExit+.65,true,26],['lip, vertical',lipExit+.65,false,26],['deck +1.4, steer back',lipExit+1.4,true,26],['deck +1.4, vertical',lipExit+1.4,false,26]]){
    p.respawn(l,true,false,{position:new THREE.Vector3(...route.toWorld(stand,route.groundAt(stand)+.12,0))});p.masks=0;
    const log=[];const snap=(tag)=>log.push({tag,local:local(p.pos),vVel:+p.vVel.toFixed(2),state:p.state,grounded:p.grounded,alive:cap.alive,head:+(p.pos.y+p.hitboxHalf.y*2).toFixed(2)});
    r.stepFor(12);snap('settled');
    camera();r.stepFor(chargeFrames,{jumpHeld:true});snap('charged');
    r.tick({jumpHeld:false,jumpReleased:true});snap('released');
    for(let i=0;i<80;i++){camera();r.tick(steer?{...toward(capS,0,1)}:{});if(i%4===0||!cap.alive)snap('air'+i);if(!cap.alive||(p.grounded&&i>6))break;}
    r.stepFor(15);snap('end');
    cases.push({pipe:pipe.name,variant,stand:+stand.toFixed(2),lipTop:+lipExit.toFixed(2),capStation:+capS.toFixed(2),capBottom:+cap.box.min.y.toFixed(2),broke:!cap.alive,peakHead:Math.max(...log.map(q=>q.head)),log});
   }
  }
  report.caps2=cases;console.log(JSON.stringify({caps2:cases.map(c=>({pipe:c.pipe,variant:c.variant,broke:c.broke,peakHead:c.peakHead,capBottom:c.capBottom,released:c.log.find(q=>q.tag==='released'),end:c.log.at(-1).local}))}));
 }

 if(want('nitro2')){
  const cases=[];
  const cp=l.checkpoints.map(c=>({c,s:local(c.spawnPos)[0]})).sort((a,b)=>Math.abs(a.s-920)-Math.abs(b.s-920))[0].c;
  const nitros=l.crates.filter(c=>c.nitro&&Math.abs(local(c.box.getCenter(new THREE.Vector3()))[0]-924)<6);
  for(const [label,input]of [['stick forward (camera)',{moveY:1}],['stick forward-right (camera)',{moveX:.5,moveY:1}],['stick forward-left (camera)',{moveX:-.5,moveY:1}],['stick forward + charge',{moveY:1,jumpHeld:true}]]){
   p.respawn(l,true,false,{position:cp.spawnPos.clone()});p.masks=0;r.stepFor(10);
   const start=pose(),alive0=nitros.map(n=>n.alive),trail=[];
   let death=null;
   for(let i=0;i<120;i++){
    camera();r.tick(input);
    if(i%6===0)trail.push({f:i,local:local(p.pos),world:p.pos.toArray().map(n=>+n.toFixed(2)),speed:+p.speed.toFixed(1)});
    if(p.totalDeaths>start.deaths){death={frame:i,seconds:+(i/60).toFixed(2),local:local(p.pos),nitro:nitros.map((n,k)=>n.alive!==alive0[k]).indexOf(true)};break;}
   }
   cases.push({label,spawnLocal:start.local,spawnWorld:cp.spawnPos.toArray().map(n=>+n.toFixed(2)),camera:{x:+p.camDir.x.toFixed(2),z:+p.camDir.z.toFixed(2)},nitros:nitros.map(n=>({local:local(n.box.getCenter(new THREE.Vector3())),world:n.box.getCenter(new THREE.Vector3()).toArray().map(v=>+v.toFixed(2)),distanceFromSpawn:+n.box.distanceToPoint(cp.spawnPos).toFixed(2)})),death,trail});
  }
  report.nitro2=cases;console.log(JSON.stringify({nitro2:cases.map(c=>({label:c.label,death:c.death,spawn:c.spawnLocal,nitros:c.nitros.map(n=>n.local),trail:c.trail.map(t=>t.local)}))}));
 }

 if(want('sanctuary2')){
  const cases=[];
  const guardians=l.enemies.filter(e=>e.kind==='grunt'&&local(e.group.position)[0]>1300);
  const plain=c=>c.alive&&!c.pending&&!c.metal&&!c.metalBounce&&!c.bang&&!c.nitroBang&&!c.bouncy&&!c.tnt&&!c.nitro;
  const run=(lane,start,skate,wait,label)=>{
   place(start,lane);r.stepFor(wait);
   const begin=pose();let hit=null,minGap=Infinity,speedAtCrate=null,tripped=false;
   for(let i=0;i<700&&local(p.pos)[0]<1382;i++){
    camera();const s=local(p.pos)[0];
    const crateAhead=l.crates.some(c=>plain(c)&&c.box.distanceToPoint(p.pos)<2.2&&local(c.box.getCenter(new THREE.Vector3()))[0]>s-.3);
    const spin=!skate&&crateAhead&&p.grounded&&(p.spinning||!r.lastInput.spinHeld);
    r.tick({...toward(s+6,lane,1),jumpHeld:skate,spinHeld:spin});
    for(const g of guardians)if(g.alive)minGap=Math.min(minGap,g.box.distanceToPoint(p.pos));
    if(speedAtCrate===null&&s>1346.8)speedAtCrate=+p.speed.toFixed(2);
    if(p.isBailing&&!tripped){tripped=true;hit={kind:'bail',pose:pose(),guardians:guardians.map(g=>({alive:g.alive,local:local(g.group.position)}))};}
    if(p.totalDeaths>begin.deaths){hit={kind:'death',pose:pose(),guardians:guardians.map(g=>({alive:g.alive,local:local(g.group.position)}))};break;}
   }
   cases.push({label,lane,start,skate,waitFrames:wait,died:p.totalDeaths>begin.deaths,tripped,hit,speedAtFirstCrate:speedAtCrate,minGuardianGap:+minGap.toFixed(2),guardiansAlive:guardians.map(g=>g.alive),reached:local(p.pos)[0],end:pose()});
  };
  for(const lane of [0,-.4,.4])for(let wait=0;wait<480;wait+=30)run(lane,1346.3,false,wait,'walk and spin the procession');
  for(const wait of [0,120,240,360])run(-.3,1336,true,wait,'arrive skating from the gauntlet top, charge held');
  for(const wait of [0,120,240,360])run(-.3,1336,false,wait,'arrive walking, no spin, lane -0.3');
  const summary=cases.reduce((m,c)=>{const k=c.label;m[k]??={runs:0,deaths:0,trips:0,reached1382:0,minGap:Infinity,speeds:[]};m[k].runs++;m[k].deaths+=c.died;m[k].trips+=c.tripped;m[k].reached1382+=c.reached>=1382;m[k].minGap=Math.min(m[k].minGap,c.minGuardianGap);if(c.speedAtFirstCrate!==null)m[k].speeds.push(c.speedAtFirstCrate);return m;},{});
  report.sanctuary2={cases,summary};
  console.log(JSON.stringify({sanctuary2:{summary,hits:cases.filter(c=>c.hit).map(c=>({label:c.label,lane:c.lane,wait:c.waitFrames,kind:c.hit.kind,at:c.hit.pose.local,speed:c.speedAtFirstCrate,guardians:c.hit.guardians}))}}));
 }

 if(want('caps3')){
  // Frame log of a suspended cap with the rider standing under its lip, no input.
  const cases=[];
  for(const pipe of route.pipes.slice(0,2)){
   const half=(pipe.b-pipe.a)/2,wall=pipe.radius*Math.sin(pipe.arc*Math.PI/180),flat=half-wall-2,mid=(pipe.a+pipe.b)/2,lipExit=mid+flat+wall;
   const capS=pipe.b-2.6,cap=crateAt(capS,pipe.lipY+2.6);
   for(const [variant,stand]of [['stand at lip +0.65',lipExit+.65],['stand far away',lipExit+12]]){
    p.respawn(l,true,false,{position:new THREE.Vector3(...route.toWorld(stand,route.groundAt(stand)+.12,0))});p.masks=0;
    const log=[];
    for(let i=0;i<150;i++){
     if(i%5===0||!cap.alive)log.push({f:i,capMinY:+cap.box.min.y.toFixed(3),capMeshY:+cap.mesh.position.y.toFixed(3),fallVel:cap.fallVel===undefined?null:+cap.fallVel.toFixed(2),alive:cap.alive,player:local(p.pos),vVel:+p.vVel.toFixed(2),state:p.state,bodyTop:+(p.crateBodyBox?.max?.y??0).toFixed(2)});
     if(!cap.alive)break;
     camera();r.tick({});
    }
    cases.push({pipe:pipe.name,variant,stand:+stand.toFixed(2),capStation:+capS.toFixed(2),authoredBottom:pipe.lipY+2.6,log});
   }
  }
  report.caps3=cases;console.log(JSON.stringify({caps3:cases.map(c=>({pipe:c.pipe,variant:c.variant,first:c.log[0],last:c.log.at(-1),frames:c.log.length}))}));
 }

 if(want('flame88')){
  const cases=[];
  for(const [s,side,label]of [[89.3,-2,'spinning the striped crate from behind (s 89.3)'],[86.7,-2,'spinning the striped crate from the front (s 86.7)'],[88,-3.3,'striped crate, lane side (side -3.3)'],[88,-0.7,'striped crate, centre side (side -0.7)'],[91.5,-2,'1.5 m past the crate, left lane'],[94,-2,'abreast of the first sentinel, left lane'],[94,3.15,'abreast of the first sentinel, right lane']]){
   place(s,side);const deaths=p.totalDeaths;let death=null;
   for(let i=0;i<8.2*60;i++){camera();r.tick({});if(p.totalDeaths>deaths){death={seconds:+(i/60).toFixed(2)};break;}}
   cases.push({label,s,side,died:p.totalDeaths>deaths,death});
  }
  report.flame88=cases;console.log(JSON.stringify({flame88:cases}));
 }

 if(want('leap1194')){
  const cases=[];
  const cp=l.checkpoints.map(c=>({c,s:local(c.spawnPos)[0]})).sort((a,b)=>Math.abs(a.s-1194)-Math.abs(b.s-1194))[0].c;
  const gap=route.gaps.find(g=>g.a===1224);
  for(const [label,charge,releaseAt]of [['respawn, charge from rest, ollie at the lip',true,gap.a-.35],['respawn, charge from rest, ollie 1 m early',true,gap.a-1.35],['respawn, no charge (roll), jump at the lip',false,gap.a-.35]]){
   p.respawn(l,true,false,{position:cp.spawnPos.clone()});p.masks=0;r.stepFor(10);
   const deaths=p.totalDeaths;let released=false,speedAtLip=null,landing=null,trail=[];
   for(let i=0;i<600;i++){
    camera();const s=local(p.pos)[0];
    const pop=!released&&p.grounded&&s>=releaseAt;
    if(pop){released=true;speedAtLip=+p.speed.toFixed(2);}
    r.tick({...toward(s+7,.0,1),jumpHeld:charge?!pop:(!pop&&false),...(pop&&!charge?{jumpPressed:true,jumpHeld:true}:{})});
    if(i%10===0)trail.push({s:+s.toFixed(1),speed:+p.speed.toFixed(1),grounded:p.grounded});
    if(p.totalDeaths>deaths)break;
    if(released&&p.grounded&&s>gap.b){landing=local(p.pos);break;}
   }
   cases.push({label,spawn:local(cp.spawnPos),releaseAt,speedAtLip,died:p.totalDeaths>deaths,landing,trail});
  }
  report.leap1194=cases;console.log(JSON.stringify({leap1194:cases.map(c=>({label:c.label,spawn:c.spawn,speedAtLip:c.speedAtLip,died:c.died,landing:c.landing}))}));
 }
 await writeFile(`${OUT}/fairness.json`,JSON.stringify(report,null,1));
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true,maxFrames:400000,
 controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z}});
