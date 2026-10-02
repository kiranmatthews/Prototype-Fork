// Browser-safe adaptive controller. Only ordinary controller samples cross
// this boundary; the pilot never changes position, velocity, tuning or camera.
export function createWaterparkPilot(source,options={}) {
 let phase='tower descent',jump=options.startJump??0,currentAir=null,priorStage=0,priorPipe=-1,priorLoopActive=false;
 const loops=source.WATERPARK_LOOPS??[source.WATERPARK_LOOP];
 let giantPhase=source.WATERPARK_GIANT?'drop':'done',giantReleased=false,giantExitIndex=0;
 const fastLine=options.fastLine===true||options.fastTurns===true;
 const evidence={transfers:[],jumps:[],phases:[],checkpoints:[],inverted:false,finished:false,backwardInputs:0,downhills:{},coasterRamps:{},loopEntries:[],inversions:[],giant:{air:false,landedRight:false,exited:false,peak:0,landing:null}};
 const position=p=>[p.pos.x,p.pos.y,p.pos.z];
 const distance=(p,q)=>Math.hypot(p.pos.x-q[0],p.pos.z-q[2]);
 const phaseTo=(next,p)=>{if(phase!==next){evidence.phases.push({from:phase,to:next,position:position(p)});phase=next;}};
 function direction(p,l,d,pace=1){
  if(d[2]>.01&&giantPhase==='done')evidence.backwardInputs++;
  const f=p.courseInputDirection(l)??p.camDir,n=Math.hypot(d[0],d[2])||1,fn=Math.hypot(f.x,f.z)||1;
  return {moveX:(d[0]*-f.z+d[2]*f.x)/n/fn*pace,moveY:(d[0]*f.x+d[2]*f.z)/n/fn*pace};
 }
 const toward=(p,l,q)=>direction(p,l,[q[0]-p.pos.x,0,q[2]-p.pos.z]);
 function sample(p,l){
  if(giantPhase!=='done'&&p.pos.z<-12){giantPhase='done';evidence.giant.exited=evidence.giant.air;}
  if(giantPhase!=='done'){
   if(giantPhase==='drop'&&p.pos.z<106)giantPhase='climb';
   if(giantPhase==='climb'&&p.vertAir){giantPhase='air';evidence.giant.air=true;}
   if(giantPhase==='air'){
    evidence.giant.peak=Math.max(evidence.giant.peak,p.pos.y);
    if(p.grounded){giantPhase='catch';evidence.giant.landing=position(p);evidence.giant.landedRight=p.pos.x>0;}
   }
   if(giantPhase==='catch'&&p.grounded&&p.groundHit?.name==='Giant vert right exit chute')giantPhase='exit';
   phaseTo(`giant ${giantPhase}`,p);
   if(giantPhase==='drop')return {...direction(p,l,[0,0,-1]),jumpHeld:true};
   if(giantPhase==='climb'){
    const release=!giantReleased&&p.pos.y>100&&p.grounded;if(release)giantReleased=true;
    return {...direction(p,l,[options.giantAngle??.22,0,-1]),jumpHeld:!release};
   }
   if(giantPhase==='air')return {jumpHeld:true};
   if(giantPhase==='catch')return {...toward(p,l,[24,70,108]),jumpHeld:true};
   const path=source.WATERPARK_GIANT_EXIT;let best=Infinity;
   for(let i=giantExitIndex;i<path.length;i++){const d=distance(p,path[i]);if(d<best){best=d;giantExitIndex=i;}}
   return {...toward(p,l,giantExitIndex>76?[0,60,-30]:path[Math.min(path.length-1,giantExitIndex+3)]),jumpHeld:true};
  }
  if(p.loopStatus.active){phaseTo('loop',p);return {moveY:1,jumpHeld:true};}
  if(p.loopStatus.completed>=loops.length){phaseTo('finish',p);return {...toward(p,l,source.WATERPARK_FINISH),jumpHeld:true};}
  const z=p.pos.z;
  phaseTo(z>-24?'tower descent':z>-160?'wave pools':z>-278?'downhill connector':z>-400?'coaster pools':z>-466?'upper flume descent':z>-538?'dry flume':z>-578?'loop summit':p.loopStatus.completed===0?'first gravity drop':p.loopStatus.completed===1?'second gravity drop':z>-798?'ravine launch':z>-920?'final loop gap':'third gravity drop',p);
  const targetX=p.loopStatus.completed>0?loops[p.loopStatus.completed-1].exit[0]:0;
  let input=toward(p,l,[targetX,p.pos.y,z-14]),jumpHeld=true,spinHeld=false;
  if(!p.grounded&&p.vertAir&&p.pipeHang){
   // Fresh press/release after the coping launch commits each forward spine.
   jumpHeld=options.holdThroughLanding&&p.vertBoardRelease.stage===2||
     p.vertBoardRelease.stage===1&&p.pos.y>(p.hangPipe?.lipY??p.pos.y)+.5&&!p.vertBoardRelease.pressArmed;
  }
  for(const [i,cp]of source.WATERPARK_CHECKPOINTS.entries()){
   if(i===0&&fastLine)continue;
   const near=i===0?z<-160&&z>cp.p[2]-3:jump>=3&&z>cp.p[2]-3;
   if(near&&p.grounded&&!l.checkpoints[i]?.active){
    input=toward(p,l,[cp.p[0],cp.p[1],Math.min(cp.p[2],z-2)]);
    spinHeld=distance(p,cp.p)<4;
   }
  }
  const edge=source.WATERPARK_JUMPS[jump];
  if(edge&&(p.grounded||p.coyoteTimer>0)&&!p.groundHit?.halfpipe){
   const remaining=p.pos.z-edge.takeoff[2];
   if(remaining<(options.releaseDistance??(jump===3?3:1.4))&&remaining>-(jump===3?1.5:.5)){
    currentAir={index:jump,name:edge.name,start:position(p),peak:p.pos.y,airborne:false};
    jump++;jumpHeld=false;
   }
  }
  return {...input,jumpHeld,spinHeld};
 }
 function observe(p,l){
  const pipe=l.halfpipes.indexOf(p.groundHit?.halfpipe??p.hangPipe),stage=p.vertBoardRelease.stage;
  if(stage===2&&priorStage===1&&pipe===priorPipe+1)evidence.transfers.push({from:priorPipe,to:pipe,position:position(p)});
  priorPipe=pipe;priorStage=stage;
  if(currentAir){
   currentAir.peak=Math.max(currentAir.peak,p.pos.y);currentAir.airborne||=!p.grounded;
   if(currentAir.airborne&&p.grounded){evidence.jumps.push({...currentAir,end:position(p)});currentAir=null;}
  }
  for(const [i,cp]of l.checkpoints.entries())if(cp.active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);
  for(const slope of source.WATERPARK_DOWNHILL??[]){
   if(p.loopStatus.active||p.loopStatus.completed>0)continue;
   if(p.pos.z>slope.from[2]||p.pos.z<slope.to[2]||Math.abs(p.pos.x-slope.from[0])>8||!p.grounded)continue;
   const run=evidence.downhills[slope.name]??={frames:0,entry:position(p),exit:position(p),minSpeed:Infinity,maxSpeed:0,mounted:true};
   run.frames++;run.exit=position(p);run.minSpeed=Math.min(run.minSpeed,p.speed);run.maxSpeed=Math.max(run.maxSpeed,p.speed);run.mounted&&=p.freeSkate;
  }
  for(const slope of source.WATERPARK_COASTER_RAMPS??[]){
   if(p.loopStatus.active||!p.grounded||Math.abs(p.pos.x-slope.from[0])>8||p.pos.z>slope.from[2]||p.pos.z<slope.to[2])continue;
   const run=evidence.coasterRamps[slope.name]??={frames:0,entry:position(p),exit:position(p),entrySpeed:p.speed,exitSpeed:p.speed,minSpeed:Infinity,mounted:true};
   run.frames++;run.exit=position(p);run.exitSpeed=p.speed;run.minSpeed=Math.min(run.minSpeed,p.speed);run.mounted&&=p.freeSkate;
  }
  if(p.loopStatus.active&&!priorLoopActive)evidence.loopEntries.push({index:p.loopStatus.completed,speed:p.speed,position:position(p)});
  priorLoopActive=p.loopStatus.active;
  if(p.loopStatus.active&&p.rideNormal.y<-.9&&!evidence.inversions.includes(p.loopStatus.completed))evidence.inversions.push(p.loopStatus.completed);
  evidence.inverted ||= p.loopStatus.active&&p.rideNormal.y<-.9;
  evidence.finished=p.state==='finished';
 }
 return {sample,observe,evidence,get phase(){return phase;}};
}
