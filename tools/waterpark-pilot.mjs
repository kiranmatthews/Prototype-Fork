// Browser-safe, feedback-driven route pilot. It reads live contact/camera state
// and emits ordinary controller samples; it never writes motion or tuning.
export function createWaterparkPilot(source,options={}) {
  let phase='entry approach',pause=0,jump=0,currentAir=null,priorStage=0,priorPipe=-1;
  const evidence={transfers:[],jumps:[],phases:[],checkpoints:[],inverted:false,finished:false};
  const position=p=>[p.pos.x,p.pos.y,p.pos.z];
  const distance=(p,q)=>Math.hypot(p.pos.x-q[0],p.pos.z-q[2]);
  const phaseTo=(next,p)=>{evidence.phases.push({from:phase,to:next,position:position(p)});phase=next;};
  function direction(p,l,d,pace=1){
    const f=p.courseInputDirection(l)??p.camDir,n=Math.hypot(d[0],d[2])||1,fn=Math.hypot(f.x,f.z)||1;
    return {moveX:(d[0]*-f.z+d[2]*f.x)/n/fn*pace,moveY:(d[0]*f.x+d[2]*f.z)/n/fn*pace};
  }
  const toward=(p,l,q,pace=1)=>direction(p,l,[q[0]-p.pos.x,0,q[2]-p.pos.z],pace);
  function cruise(p,l,dir){
    let jumpHeld=true;
    if(p.vertAir&&p.pipeHang)jumpHeld=p.vertBoardRelease.stage===1&&p.pos.y>(p.hangPipe?.lipY??p.pos.y)+.5&&!p.vertBoardRelease.pressArmed;
    const edge=source.WATERPARK_JUMPS[jump];
    if(edge&&p.grounded&&!p.groundHit?.halfpipe){
      const remaining=(edge.takeoff[0]-p.pos.x)*edge.dir[0]+(edge.takeoff[2]-p.pos.z)*edge.dir[2];
      if(remaining<1.4&&remaining>-.5){
        currentAir={index:jump,name:edge.name,start:position(p),peak:p.pos.y,airborne:false};
        jump++;jumpHeld=false;
      }
    }
    return {...direction(p,l,dir),jumpHeld};
  }
  function sample(p,l){
    if(phase==='entry approach'){
      if(p.pos.z<=28)phaseTo('wave pools',p);
      else return {...toward(p,l,[-48,12,27]),jumpHeld:true};
    }
    if(phase==='wave pools'){
      if(jump===1&&p.grounded&&p.pos.z<-118)phaseTo(options.fastTurns?'concourse carve':'concourse brake',p);
      else return cruise(p,l,[0,0,-1]);
    }
    if(phase==='concourse carve'){
      if(p.pos.x>-28&&p.pos.z<-154){phaseTo('coaster pools',p);return cruise(p,l,[1,0,0]);}
      let angle=Math.atan2(p.pos.z+135,p.pos.x+23);if(angle<0)angle+=Math.PI*2;
      const ahead=Math.min(Math.PI*1.5,Math.max(Math.PI,angle)+.32);
      return {...toward(p,l,[-23+25*Math.cos(ahead),12,-135+25*Math.sin(ahead)]),jumpHeld:true};
    }
    if(phase==='upper carve'){
      if(p.pos.z>-140&&p.pos.x>132){phaseTo('dry flume',p);return cruise(p,l,[0,0,1]);}
      const angle=Math.atan2(p.pos.z+136,p.pos.x-114),ahead=Math.min(0,Math.max(-Math.PI/2,angle)+.32);
      return {...toward(p,l,[114+24*Math.cos(ahead),18,-136+24*Math.sin(ahead)]),jumpHeld:true};
    }
    if(phase==='concourse brake'||phase==='upper turn brake'){
      if(Math.abs(p.speed)<.2){pause=45;phaseTo(phase==='concourse brake'?'concourse settle':'upper turn settle',p);}
      return {jumpHeld:true,grabHeld:true};
    }
    if(phase==='concourse settle'||phase==='upper turn settle'){
      if(--pause<=0)phaseTo(phase==='concourse settle'?'concourse checkpoint':'south turn',p);
      return {grabHeld:true};
    }
    if(phase==='concourse checkpoint'){
      const cp=source.WATERPARK_CHECKPOINTS[0].p;
      if(l.checkpoints[0]?.active){phaseTo('east alignment',p);return {};}
      return {...toward(p,l,cp,Math.min(.6,Math.max(.2,distance(p,cp)/5))),spinHeld:distance(p,cp)<2.5};
    }
    if(phase==='east alignment'){
      const q=[-34,12,-160];
      if(distance(p,q)<1){phaseTo('coaster pools',p);return {jumpHeld:true,...direction(p,l,[1,0,0])};}
      return toward(p,l,q,Math.min(.65,Math.max(.2,distance(p,q)/5)));
    }
    if(phase==='coaster pools'){
      if(jump===2&&p.grounded&&p.pos.x>=118)phaseTo(options.fastTurns?'upper carve':'upper turn brake',p);
      else return cruise(p,l,[1,0,0]);
    }
    if(phase==='south turn'){
      const q=[138,18,-131];
      if(distance(p,q)<1){phaseTo('dry flume',p);return {jumpHeld:true,...direction(p,l,[0,0,1])};}
      return toward(p,l,q,Math.min(.65,Math.max(.2,distance(p,q)/5)));
    }
    if(phase==='dry flume'){
      if(jump===3&&p.grounded&&p.pos.z>-58)phaseTo('loop checkpoint',p);
      else return cruise(p,l,[0,0,1]);
    }
    if(phase==='loop checkpoint'){
      const cp=source.WATERPARK_CHECKPOINTS[1].p;
      if(l.checkpoints[1]?.active){phaseTo('loop approach',p);return {...toward(p,l,[138,0,6]),jumpHeld:true};}
      return {...toward(p,l,cp),jumpHeld:true,spinHeld:distance(p,cp)<4};
    }
    if(phase==='loop approach'){
      if(p.loopStatus.active)phaseTo('loop',p);
      else return {...toward(p,l,[138,0,8]),jumpHeld:true};
    }
    if(phase==='loop'){
      if(p.loopStatus.completed>0)phaseTo('finish',p);
      else return {moveY:1,jumpHeld:true};
    }
    if(phase==='finish')return {...toward(p,l,[118,0,52]),jumpHeld:true};
    return {};
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
    evidence.inverted ||= p.loopStatus.active&&p.rideNormal.y<-.9;
    evidence.finished=p.state==='finished';
  }
  return {sample,observe,evidence,get phase(){return phase;}};
}
