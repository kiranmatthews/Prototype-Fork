// Local browser review: initial placement followed exclusively by production input.
export async function installKonaReview(host=window){
  const g=host.__game,p=g.player,l=g.getLevel(),m=await import('/src/levels/kona.ts'),T=await import('/node_modules/.vite/deps/three.js');
  let sample={},pilot=null;const original=p.step.bind(p),update=g.input.update.bind(g.input);
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const turn=q=>Math.max(-1,Math.min(1,-wrap(Math.atan2(q[0]-p.pos.x,q[2]-p.pos.z)-Math.atan2(p.axisF.x,p.axisF.z))*2.5));
  const place=(q,heading)=>{pilot.heading=heading;pilot.aligned=pilot.kind==='recovery';p.resetRacePosition(l,new T.Vector3(...q),new T.Vector3(...heading).normalize());};
  g.input.pollGamepad=()=>{
   const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),a=n?.22+.78*Math.min(1,n):0;
   return {id:'Kona gameplay review controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*a,-y/n*a,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>{const held=i===0?sample.jumpHeld:i===1?sample.grabHeld:i===3?sample.grindHeld:i===7?sample.transferHeld:false;return{pressed:!!held,touched:!!held,value:held?1:0};})};
  };
  host.startKonaReview=kind=>{
   sample={};const s=pilot=host.konaReview={kind,frames:0,done:false,bails:0,deathsBefore:p.totalDeaths,livesBefore:p.lives,airFrames:0,grindFrames:0,maxY:-100,trace:[]};
   if(kind==='snake'){
    s.path=m.KONA_SNAKE.points.slice(4,-5);s.index=0;s.maxError=0;const a=s.path[0],b=s.path[3];place([a[0],a[1]+.04,a[2]],[b[0]-a[0],0,b[2]-a[2]]);
   }else if(kind==='vert'||kind==='transfer'){
    s.pipe=m.KONA_PIPES[0];const c=s.pipe.centre;place([c[0],c[1]+.04,c[2]],[1,0,0]);s.side=1;s.airs=0;s.released=false;s.transferred=false;
   }else if(kind==='jump'){
    const a=m.KONA_JUMP.a,b=m.KONA_JUMP.b,d=Math.hypot(b[0]-a[0],b[2]-a[2]);s.dir=[(b[0]-a[0])/d,0,(b[2]-a[2])/d];s.mid=[(a[0]+b[0])/2,0,(a[2]+b[2])/2];s.end=b;s.streetPhase=0;s.streetDeckY=a[1];place([a[0],a[1]+.06,a[2]],s.dir);
   }else if(kind==='rail'){
    const points=m.KONA_RAILS[9].points,a=points[0];s.a=a;s.b=points.at(-1);const d=Math.hypot(s.b[0]-a[0],s.b[2]-a[2]);s.dir=[(s.b[0]-a[0])/d,0,(s.b[2]-a[2])/d];s.released=false;place([a[0]-s.dir[0]*5,.05,a[2]-s.dir[2]*5],s.dir);
   }else if(kind==='recovery'){
    s.checkpoint=l.checkpoints.indexOf(l.activeCheckpoint);s.returnPoint=l.currentSpawn.toArray();place([300,4,300],[1,0,0]);s.died=false;
   }else if(kind==='finish'){
    const c=m.KONA_LEVEL.components.find(c=>c.t==='gate');s.gate=c.p;place([c.p[0],c.p[1]+.06,c.p[2]+8],[0,0,-1]);
   }
   g.input.consumeEdges();
  };
  p.step=(dt,input,level)=>{
   const s=pilot;if(!s||s.done){sample={};update();original(dt,input,level);return;}
   sample={};s.frames++;
   if(!s.aligned){const a=wrap(Math.atan2(s.heading[0],s.heading[2])-Math.atan2(p.axisF.x,p.axisF.z));sample={moveX:Math.max(-1,Math.min(1,-a*4)),grabHeld:true};update();original(dt,input,level);if(p.grounded&&(Math.abs(a)<.015||s.frames>150)&&s.frames>6)s.aligned=true;return;}
   const wasGrounded=p.grounded,previousSurface=p.groundHit?.name;
   if(s.kind==='snake'){
    let d=Infinity,at=s.index;for(let i=Math.max(0,s.index-3);i<Math.min(s.path.length,s.index+25);i++){const q=s.path[i],dd=Math.hypot(p.pos.x-q[0],p.pos.z-q[2]);if(dd<d){d=dd;at=i;}}
    s.index=Math.max(s.index,at);s.maxError=Math.max(s.maxError,d);const target=s.path[Math.min(s.path.length-1,s.index+8)],angle=Math.abs(wrap(Math.atan2(target[0]-p.pos.x,target[2]-p.pos.z)-Math.atan2(p.axisF.x,p.axisF.z)));
    sample={moveX:turn(target),moveY:1,grabHeld:angle>.42&&p.speed>7.5};if(s.index>=s.path.length-6)s.done=true;
   }else if(s.kind==='vert'||s.kind==='transfer'){
    if(p.grounded&&p.speed<5&&Math.abs(p.pos.x-s.pipe.centre[0])>s.pipe.flat+.7)s.side=-Math.sign(p.pos.x-s.pipe.centre[0]);
    const popHeight=s.kind==='transfer'?s.pipe.radius-.25:.65;
    const pop=p.grounded&&!s.released&&p.pos.y>s.pipe.centre[1]+popHeight&&p.groundHit?.normal.y<.8&&p.axisF.dot(p.groundHit.normal)<-.2;if(pop)s.released=true;
    sample=s.inAir?{...(s.kind==='transfer'?{moveY:1}:{})}:{moveX:turn([s.pipe.centre[0]+s.side*20,0,s.pipe.centre[2]]),moveY:1,jumpHeld:!s.released};if(pop)sample.jumpHeld=false;
   }else if(s.kind==='jump'){
    const along=(p.pos.x-s.mid[0])*s.dir[0]+(p.pos.z-s.mid[2])*s.dir[2];
    // At the corrected scale the first raised lip is an ollie-on, followed
    // by a second ollie across to the catcher. Recharge through the first air.
    if(s.streetPhase===0&&along>-10.25){s.streetPhase=1;s.firstReleaseAt=s.frames;}
    if(s.streetPhase===1&&s.airFrames>4&&p.grounded&&p.pos.y>s.streetDeckY+.9){
     if(s.lipLandingAt===undefined)s.lipLandingAt=s.frames;
     else s.streetPhase=2;
    }
    sample={moveY:1,jumpHeld:s.streetPhase===0||(s.streetPhase===1&&s.frames>s.firstReleaseAt+3),grindHeld:!p.grounded&&p.vVel<0,moveX:p.grounded?turn([s.end[0]+s.dir[0]*10,0,s.end[2]+s.dir[2]*10]):0};
    s.lateral=Math.abs((p.pos.x-s.mid[0])*s.dir[2]-(p.pos.z-s.mid[2])*s.dir[0]);
    if(s.airFrames>4&&p.grounded&&along>2){s.landedOn=p.groundHit?.name;s.done=true;}
   }else if(s.kind==='rail'){
    const along=(p.pos.x-s.a[0])*s.dir[0]+(p.pos.z-s.a[2])*s.dir[2];if(along>-1.4)s.released=true;
    sample={moveY:1,jumpHeld:!s.released,grindHeld:s.released,moveX:p.state==='grind'?Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)):0};
    if(s.grindFrames>15&&p.state!=='grind'&&p.grounded)s.done=true;
   }else if(s.kind==='finish')sample={moveY:1};
   update();original(dt,input,level);
   if(wasGrounded&&!p.grounded)s.takeoffFrom=previousSurface;
   s.maxY=Math.max(s.maxY,p.pos.y);if(!p.grounded)s.airFrames++;if(p.state==='grind')s.grindFrames++;if(p.isBailing)s.bails++;
   if(s.kind==='vert'||s.kind==='transfer'){
    if(!p.grounded&&!s.inAir)s.inAir=true;
    if(s.inAir&&p.grounded){s.airs++;s.inAir=false;s.released=false;s.side=-Math.sign(p.pos.x-s.pipe.centre[0]);}
    if(s.kind==='vert'&&s.airs>=4)s.done=true;
    if(s.kind==='transfer'&&s.airFrames>5&&p.grounded&&p.pos.x>s.pipe.centre[0]+s.pipe.flat+s.pipe.radius+.2&&p.pos.x<m.KONA_PIPES[1].centre[0]+m.KONA_PIPES[1].flat&&p.groundHit?.name==='Spinal grooves'){s.transferred=true;s.done=true;}
   }
   if(s.kind==='recovery'){if(p.state==='dead')s.died=true;if(s.died&&p.grounded&&p.state==='ride'&&p.pos.distanceTo(new T.Vector3(...s.returnPoint))<1.5)s.done=true;}
   if(s.kind==='finish'&&p.state==='finished')s.done=true;
   if(s.frames%6===0)s.trace.push({frame:s.frames,p:p.pos.toArray(),speed:p.speed,state:p.state,ground:p.groundHit?.name});
   if(s.frames>1800||p.isBailing&&s.kind!=='recovery'){s.failed=true;s.done=true;}
   s.position=p.pos.toArray();s.state=p.state;s.grounded=p.grounded;s.deaths=p.totalDeaths-s.deathsBefore;s.lives=p.lives;s.mounted=p.boardRolling;
  };
}
