/** Real device samples only: no placement, velocity, checkpoint or tuning edits. */
export function createMayfieldPilot(m,{mode='foot',start=0}={}){
 let frame=0,progress=start,active=null,charge=0,stallAt=start,stallFrame=0;
 const evidence={mode,jumps:[],checkpoints:[],ground:[],crystal:false,peakSpeed:0};
 function at(s){const points=m.MAYFIELD_ROUTE;let i=1;while(i<points.length-1&&-points[i][2]<s)i++;const a=points[i-1],b=points[i],t=Math.max(0,Math.min(1,(s+a[2])/(a[2]-b[2])));return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,-s];}
 return{evidence,get progress(){return progress;},
  sample(p,l){
   progress=-p.pos.z;
   if(p.isBailing||['dead','gameover'].includes(p.state))throw Error(`Run failed: ${JSON.stringify({frame,progress,p:p.pos.toArray(),state:p.state,active})}`);
   if(progress>stallAt+2){stallAt=progress;stallFrame=frame;}else if(frame-stallFrame>480)throw Error(`Run stalled: ${JSON.stringify({progress,p:p.pos.toArray(),state:p.state,ground:p.groundHit?.name,active})}`);
   let jump=mode==='skate';const gap=m.MAYFIELD_GAPS.find(g=>progress<g.b+.15);
   if(active){jump=false;if(!p.grounded){active.air=true;active.airFrames++;}
    if(mode==='foot'&&active.air&&active.airFrames>=17&&active.airFrames<=20)jump=true;
    if(p.grounded&&progress>active.b){evidence.jumps.push({...active,landing:progress,y:p.pos.y});active=null;jump=mode==='skate';charge=0;}
   }
   if(!active&&gap&&p.grounded){
    if(mode==='skate'&&progress>=gap.a-1.5){active={...gap,takeoff:progress,air:false,airFrames:0};jump=false;}
    if(mode==='foot'&&progress>=gap.a-4.3){charge++;jump=charge<=24;if(charge===25){active={...gap,takeoff:progress,air:false,airFrames:0};jump=false;}}
   }
   let q=at(progress+(mode==='skate'?9:4));const aiming=active??gap;
   if(aiming&&progress>aiming.a-13)q=[0,aiming.y,-aiming.b-9];
   const cp=l.checkpoints.find(c=>!c.active&&c.spawnPos.z<p.pos.z+.2&&c.spawnPos.distanceTo(p.pos)<13);
   if(cp)q=cp.spawnPos.toArray();
   const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir;
   const steer={moveX:(dx*-f.z+dz*f.x)/n,moveY:(dx*f.x+dz*f.z)/n};
   if(p.state==='air'&&p.airFromSkate){steer.moveX=0;steer.moveY=0;}
   return {...steer,jumpHeld:jump,spinHeld:p.grounded&&(l.checkpoints.some(c=>!c.active&&c.spawnPos.distanceTo(p.pos)<2.8)||l.crates.some(c=>c.alive&&c.mesh.position.distanceTo(p.pos)<2.5))};
  },
  observe(p,l){frame++;progress=-p.pos.z;evidence.crystal=p.hasCrystal;evidence.peakSpeed=Math.max(evidence.peakSpeed,p.speed);for(let i=0;i<l.checkpoints.length;i++)if(l.checkpoints[i].active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);if(p.grounded){const mesh=p.groundHit?.mesh,c=l.builtFromData?.components[mesh?.userData.editorIdx];if(c?.nm&&!evidence.ground.includes(c.nm))evidence.ground.push(c.nm);}if(frame>18000)throw Error('Mayfield frame budget exhausted');}
 };
}
