// Browser-safe adaptive controller. Only ordinary controller samples cross
// this boundary; the pilot never changes position, velocity, tuning or camera.
export function createWaterparkPilot(source,options={}) {
 let phase='tower descent',jump=0,currentAir=null,priorStage=0,priorPipe=-1;
 const fastLine=options.fastLine===true||options.fastTurns===true;
 const evidence={transfers:[],jumps:[],phases:[],checkpoints:[],inverted:false,finished:false,backwardInputs:0,downhills:{}};
 const position=p=>[p.pos.x,p.pos.y,p.pos.z];
 const distance=(p,q)=>Math.hypot(p.pos.x-q[0],p.pos.z-q[2]);
 const phaseTo=(next,p)=>{if(phase!==next){evidence.phases.push({from:phase,to:next,position:position(p)});phase=next;}};
 function direction(p,l,d,pace=1){
  if(d[2]>.01)evidence.backwardInputs++;
  const f=p.courseInputDirection(l)??p.camDir,n=Math.hypot(d[0],d[2])||1,fn=Math.hypot(f.x,f.z)||1;
  return {moveX:(d[0]*-f.z+d[2]*f.x)/n/fn*pace,moveY:(d[0]*f.x+d[2]*f.z)/n/fn*pace};
 }
 const toward=(p,l,q)=>direction(p,l,[q[0]-p.pos.x,0,q[2]-p.pos.z]);
 function sample(p,l){
  if(p.loopStatus.active){phaseTo('loop',p);return {moveY:1,jumpHeld:true};}
  if(p.loopStatus.completed>0){phaseTo('finish',p);return {...toward(p,l,[source.WATERPARK_LOOP.exit[0],0,source.WATERPARK_FINISH?.[2]??source.WATERPARK_LOOP.entry[2]-52]),jumpHeld:true};}
  const z=p.pos.z;
  phaseTo(z>-24?'tower descent':z>-160?'wave pools':z>-278?'downhill connector':z>-400?'coaster pools':z>-466?'upper flume descent':z>-538?'dry flume':z>-590?'splashdown descent':'loop approach',p);
  let input=toward(p,l,[0,p.pos.y,z-14]),jumpHeld=true,spinHeld=false;
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
  if(edge&&p.grounded&&!p.groundHit?.halfpipe){
   const remaining=p.pos.z-edge.takeoff[2];
   if(remaining<(options.releaseDistance??1.4)&&remaining>-.5){
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
   if(p.pos.z>slope.from[2]||p.pos.z<slope.to[2]||!p.grounded)continue;
   const run=evidence.downhills[slope.name]??={frames:0,entry:position(p),exit:position(p),minSpeed:Infinity,maxSpeed:0,mounted:true};
   run.frames++;run.exit=position(p);run.minSpeed=Math.min(run.minSpeed,p.speed);run.maxSpeed=Math.max(run.maxSpeed,p.speed);run.mounted&&=p.freeSkate;
  }
  evidence.inverted ||= p.loopStatus.active&&p.rideNormal.y<-.9;
  evidence.finished=p.state==='finished';
 }
 return {sample,observe,evidence,get phase(){return phase;}};
}
