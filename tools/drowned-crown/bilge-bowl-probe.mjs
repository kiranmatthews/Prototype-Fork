import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from '../jungle-cup-harness.mjs';

// Focused production-physics probe. Each case is placed once at its start;
// thereafter only complete ordinary device samples can move the player.
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const output=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'/private/tmp/drowned-bilge-bowl-probe.json';
const report={mode:'campaign controls; ordinary input only after each initial placement',cases:[]};
const empty={id:'bilge-probe-loader',name:'Bilge probe loader',data:{v:1,name:'Bilge probe loader',spawn:[0,.1,0],killY:-30,components:[{t:'platform',p:[0,-.5,0],s:[5,1,5]},{t:'gate',p:[0,0,-2]}]}};
await withSkateRuntime(async({server,THREE,Level,Player,CONST,TUNING})=>{
 const {PIRATE_BILGE_BOWL_COMPONENTS}=await server.ssrLoadModule('/src/levels/pirate-bilge-bowl.ts');
 const data={v:1,name:'Giant bilge bowl probe',spawn:[18,16.08,-165],killY:-30,
  components:[...PIRATE_BILGE_BOWL_COMPONENTS,{t:'platform',p:[0,15.5,-370],s:[16,1,12],tex:'solid',color:'#587982'},{t:'gate',p:[0,16,-374]},
   {t:'mesh',p:[80,0,-230],vertices:[-12,0,9,12,0,9,12,0,-9,-12,0,-9],indices:[0,1,2,0,2,3],solid:true,vert:true,skateCamera:true,gravityTrack:true,tex:'solid',color:'#587982',nm:'Probe-only authored skate surface'},
   {t:'rail',p:[85,.85,-230],len:14,yaw:0,nm:'Probe-only ordinary freestanding rail'}]};
 const l=new Level(new THREE.Scene(),{id:'drowned-bilge-probe',name:data.name,data});
 l.update(0);l.scene.updateMatrixWorld(true);
 const p=new Player(l.scene);p.enterLevel('drowned-crown');p.competitionMode=false;p.endlessDeaths=false;
 const tuningBefore=JSON.stringify(TUNING);
 let last={},current,frames;
 const snapshot=()=>({frame:frames,position:p.pos.toArray(),state:p.state,grounded:p.grounded,speed:p.speed,verticalSpeed:p.vVel,vertAir:p.vertAir,freeSkate:p.freeSkate,bailing:p.isBailing,normal:p.rideNormal.toArray(),ground:p.groundHit?.name,rail:p.grindRail?.object?.name,deaths:p.totalDeaths});
 const start=(name,position,heading)=>{
  p.respawn(l,true,false,{position:new THREE.Vector3(...position),heading:new THREE.Vector3(...heading)});
  p.camDir.set(0,0,-1);last={};frames=0;current={name,initial:snapshot(),trace:[],peakY:p.pos.y,maxSpeed:0,pumpingFrames:0,airFrames:0,grindFrames:0};report.cases.push(current);
 };
 const toward=(q,pace=1)=>{
  const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir,fn=Math.hypot(f.x,f.z)||1;
  return{moveX:(dx*-f.z+dz*f.x)/n/fn*pace,moveY:(dx*f.x+dz*f.z)/n/fn*pace};
 };
 const tick=(sample={},allowBail=false)=>{
  const input=makeInput(sample);
  for(const held of ['jumpHeld','grindHeld','grabHeld','spinHeld','transferHeld'])if(!(held.replace('Held','Pressed')in sample))input[held.replace('Held','Pressed')]=!!input[held]&&!last[held];
  if(!('jumpReleased'in sample))input.jumpReleased=!input.jumpHeld&&!!last.jumpHeld;
  last={...input};p.step(CONST.fixedStep,input,l);l.update(CONST.fixedStep);p.flushLevelCrateRewards(l);frames++;
  current.peakY=Math.max(current.peakY,p.pos.y);current.maxSpeed=Math.max(current.maxSpeed,Math.abs(p.speed));
  if(p.grounded&&p.charging&&p.groundHit?.vert)current.pumpingFrames++;
  if(p.vertAir)current.airFrames++;if(p.state==='grind')current.grindFrames++;
  if(frames%30===0)current.trace.push(snapshot());
  assert.ok(p.pos.toArray().every(Number.isFinite),'Non-finite movement');
  assert.ok((allowBail||!p.isBailing)&&!['dead','gameover'].includes(p.state),'Probe bailed or died: '+JSON.stringify(snapshot()));
 };
 try{
  if(!only||only==='air'){
  start('Gallery drop, charged wall air and native landing',[18,16.08,-165],[0,0,-1]);
  let floor=false,air=false,landed=false;
  for(let i=0;i<1500&&!landed;i++){
   floor||=p.grounded&&p.pos.y<.2;
   tick(air?{jumpHeld:true}:{...toward([18,0,-295]),jumpHeld:true});
   if(p.vertAir&&!air){air=true;current.launch=snapshot();}
   if(air&&p.grounded&&current.airFrames>12&&current.peakY>16.5){landed=true;current.landing=snapshot();}
  }
  current.droppedToFloor=floor;current.completed=air&&landed;current.final=snapshot();
  console.log(JSON.stringify({...current,trace:undefined}));
  assert.ok(floor&&air&&landed,'Drop/pump/air/return was not completed');

  }
  if(!only||only==='coping'){
  start('Native coping catch from the upper apron',[-54,16.08,-230],[.45,0,-.89]);
  for(let i=0;i<420&&current.grindFrames<12;i++)tick({...toward([-50,16,-238]),jumpHeld:i<24,grindHeld:i>=24,moveY:p.state==='grind'?0:toward([-50,16,-238]).moveY,moveX:p.state==='grind'?Math.max(-1,Math.min(1,-p.balance*8-p.balanceVel)):toward([-50,16,-238]).moveX});
  current.completed=current.grindFrames>=12;current.final=snapshot();console.log(JSON.stringify({...current,trace:undefined}));
  assert.ok(current.completed,'Ordinary apron hop did not catch the native coping');

  }
  if(!only||only==='exit'){
  start('Floor-level throat and gallery exit',[0,.08,-255],[0,0,-1]);
  const path=[[0,0,-280],[0,0,-299],[0,16,-365]];let at=0;
  for(let i=0;i<2400&&at<path.length;i++){
   const q=path[at];if(Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z)<.45&&Math.abs(q[1]-p.pos.y)<.3){at++;continue;}
   tick(toward(q,.85));
  }
  current.completed=at===path.length;current.final=snapshot();console.log(JSON.stringify({...current,trace:undefined}));
  assert.ok(current.completed,'Floor-level exit route failed');
  }
  if(!only||only==='rail'){
   start('Ordinary rail still blocks an authored vert surface',[75,.08,-230],[1,0,0]);
   for(let i=0;i<240&&!p.isBailing;i++)tick({...toward([95,0,-230]),jumpHeld:true},true);
   current.completed=p.isBailing;current.final=snapshot();console.log(JSON.stringify({...current,trace:undefined}));
   assert.ok(current.completed,'The authored coping exception incorrectly disabled an ordinary rail');
  }
  assert.equal(JSON.stringify(TUNING),tuningBefore,'Probe changed movement tuning');
 }finally{await writeFile(output,JSON.stringify(report,null,2)+'\n');l.dispose();}
},{levelEntry:empty});
console.log('PASS giant bilge bowl ordinary-input '+(only??'drop/pump/air/landing, coping and floor exit')+'.');
