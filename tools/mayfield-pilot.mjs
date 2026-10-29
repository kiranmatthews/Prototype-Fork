/** Real controller samples; no pose, velocity, checkpoint, collision or tuning edits. */
export function createMayfieldPilot(m,{mode='foot',start=0,autoJump=true}={}){
 let frame=0,progress=start,stallAt=start,stallFrame=0,jumpPhase=0,lastJump=-1000;
 const points=m.MAYFIELD_ROUTE,dist=[0];for(let i=1;i<points.length;i++)dist.push(dist.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2]));
 const evidence={mode,jumps:[],checkpoints:[],ground:[],crystal:false,peakSpeed:0,sourceGround:{mall:0,school:0,warehouse:0,kona:0}};
 function at(d){let i=1;while(i<points.length-1&&dist[i]<d)i++;const t=Math.max(0,Math.min(1,(d-dist[i-1])/(dist[i]-dist[i-1])));return points[i-1].map((v,k)=>v+(points[i][k]-v)*t);}
 return{evidence,get progress(){return progress;},
  sample(p,l){
   if(p.isBailing||['dead','gameover'].includes(p.state))throw Error(`Run failed: ${JSON.stringify({frame,progress,p:p.pos.toArray(),state:p.state})}`);
   let best=Infinity,next=progress;
   for(let i=1;i<points.length;i++){if(dist[i]<progress-8||dist[i-1]>progress+35)continue;const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[2]-a[2],d=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((p.pos.x-a[0])*dx+(p.pos.z-a[2])*dz)/d)),error=Math.hypot(p.pos.x-a[0]-dx*t,p.pos.z-a[2]-dz*t);if(error<best){best=error;next=dist[i-1]+t*(dist[i]-dist[i-1]);}}
   progress=next;if(progress>stallAt+1){stallAt=progress;stallFrame=frame;}
   if(frame-stallFrame>600)throw Error(`Run stalled: ${JSON.stringify({progress,p:p.pos.toArray(),state:p.state,ground:p.groundHit?.name})}`);
   let q=at(progress+(mode==='skate'?7:2.5));
   const cp=l.checkpoints.find(c=>!c.active&&c.spawnPos.distanceTo(p.pos)<8);if(cp)q=cp.spawnPos.toArray();
   const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir;
   const steer={moveX:(dx*-f.z+dz*f.x)/n,moveY:(dx*f.x+dz*f.z)/n};
   let jump=mode==='skate';
   if(autoJump&&mode==='foot'&&frame-stallFrame>40&&frame-lastJump>180&&p.grounded){jumpPhase=1;lastJump=frame;evidence.jumps.push({progress,p:p.pos.toArray()});}
   if(jumpPhase){jump=jumpPhase<=8;jumpPhase++;if(jumpPhase>60)jumpPhase=0;}
   if(p.state==='air'&&p.airFromSkate){steer.moveX=0;steer.moveY=0;}
   const far=at(progress+22),fx=far[0]-q[0],fz=far[2]-q[2],fn=Math.hypot(fx,fz)||1,turn=Math.acos(Math.max(-1,Math.min(1,(dx*fx+dz*fz)/(n*fn))));
   // Brake for the entrance's compact 180-degree turns, using the same ordinary
   // control available to a player. The long downhill lanes retain full pace.
   const cap=turn>.12?(m.MAYFIELD_PARKING_ROUTE&&progress<260?8:12):22;
   return {...steer,grabHeld:mode==='skate'&&p.freeSkate&&p.grounded&&p.speed>cap,jumpHeld:jump,spinHeld:p.grounded&&(l.checkpoints.some(c=>!c.active&&c.spawnPos.distanceTo(p.pos)<2.8)||l.crates.some(c=>c.alive&&c.mesh.position.distanceTo(p.pos)<2.5))};
  },
  observe(p,l){frame++;evidence.crystal=p.hasCrystal;evidence.peakSpeed=Math.max(evidence.peakSpeed,p.speed);for(let i=0;i<l.checkpoints.length;i++)if(l.checkpoints[i].active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);if(p.grounded){const mesh=p.groundHit?.mesh,c=l.builtFromData?.components[mesh?.userData.editorIdx],nm=c?.nm??p.groundHit?.name??'';if(nm&&!evidence.ground.includes(nm))evidence.ground.push(nm);for(const source of Object.keys(evidence.sourceGround))if(nm.toLowerCase().startsWith(source))evidence.sourceGround[source]++;}if(frame>36000)throw Error('Mayfield frame budget exhausted');}
 };
}
