// Controller samples only: production movement, collision, rails and camera.
export function createMallPilot(m,{route='main',charge=true,secretOllie=true,fountainEntry=route==='upper-fast'?68:68.5}={}){
 const entry=createMallEntryPilot(m);
 let progress=entry.progress,frame=0,active=null,jumped=new Set(),lastAdvance=0,lastS=5,secretPop=false,secretPopFrame=-Infinity,secretRail=null;
 const evidence={route,entry:entry.evidence,sections:[],jumps:[],grinds:[],railNames:[],checkpoints:[],upperTransfer:null,fountainLandingFrames:0,fountainBrakingFrames:0,peakSpeed:0,minimumMovingSpeed:Infinity,bails:0,airFrames:0,crystal:false};
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const interpolate=(s,knots)=>{for(let i=1;i<knots.length;i++)if(s<=knots[i][0])return knots[i-1][1]+(knots[i][1]-knots[i-1][1])*smooth((s-knots[i-1][0])/(knots[i][0]-knots[i-1][0]));return knots.at(-1)[1];};
 const fountainRoute=['upper','upper-fast'].includes(route),upperRoute=fountainRoute||['car','escalator'].includes(route);
 const fountainAim=route==='upper-fast'?-1.7:-1.2;
 const leftAisle=['coffee','escalator'].includes(route);
 const offsets=route==='escalator'?[[0,0],[28,-2.6],[38,-5.5],[53,-12.2],[85,-12.2],[96,-10.4],[117,-10.4],[128,-6.1],[183,-6.1],[199,0],[319,0],[336,6.5],[362,6.5],[373,0],[396,0]]:
  route==='car'?[[0,0],[43,7.8],[113,7.8],[129,5],[183,-6.1],[199,0],[319,0],[336,6.5],[362,6.5],[373,0],[396,0]]:
  fountainRoute?[[0,0],[34,-2.6],[49,-2.8],[55,-3.8],[59,-3.8],[63,-2.7],[68.5,fountainAim],[77,fountainAim],[84,0],[97,-1.4],[115,-6.1],[128,-6.1],[183,-6.1],[199,0],[319,0],[336,6.5],[362,6.5],[373,0],[396,0]]:
  route==='coffee'?[[0,0],[28,-2.6],[38,-5.5],[53,-11.2],[83,-9.8],[103,-6.2],[132,-10],[180,-10],[199,0],[217,0],[319,0],[336,6.5],[362,6.5],[373,0],[396,0]]:
  route==='underpass'?[[0,0],[43,4.7],[65,4.7],[83,5],[96,3.8],[132,13.5],[162,13.5],[180,10.5],[190,10.5],[217,0],[319,0],[336,6.5],[362,6.5],[373,0],[396,0]]:
  route==='mezzanine'?[[0,0],[43,7.2],[65,7.8],[83,5],[96,3.8],[132,13.5],[162,13.5],[180,10.5],[190,10.5],[217,0],[319,0],[338,-6.5],[377,-6.5],[397,0]]:
  [[0,0],[43,7.2],[65,7.8],[83,5],[96,3.8],[132,13.5],[162,13.5],[180,10.5],[190,10.5],[217,0],[319,0],[336,6.5],[362,6.5],[373,0],[396,0]];
 const launches=[...(route==='escalator'?[{s:128,end:187,name:'Flying Leap',grind:true}]:route==='car'?[{s:86.5,end:100,name:'Car display jump'},{s:125,end:187,name:'Flying Leap',grind:true}]:fountainRoute?[...(route==='upper-fast'?[{s:fountainEntry,end:84,name:'Fountain through jump'}]:[{s:fountainEntry,end:74,name:'Fountain entry'},{s:77.8,end:84,name:'Fountain exit'}]),{s:128,end:187,name:'Flying Leap',grind:true}]:route==='coffee'?[{s:55,end:104,name:'Coffee Grind',grind:true},{s:136,end:185,name:'Lower light beam',grind:true}]:[]),{s:276.2,end:300,name:'Crossrail transfer',grind:true},...(route==='mezzanine'?[{s:375.5,end:395,name:'Mezzanine'}]:[])];
 return {evidence,get progress(){return progress;},
 sample(p,l){
  if(!entry.done)return entry.sample(p,l);
  progress=m.mallProject(p.pos.x,p.pos.z,progress);
  if(p.isBailing||['dead','gameover'].includes(p.state))throw Error(`Mall run lost: ${JSON.stringify({progress,position:p.pos.toArray(),state:p.state,bailing:p.isBailing,active})}`);
  if(progress>lastS+1){lastS=progress;lastAdvance=frame;}else if(frame-lastAdvance>480)throw Error(`Mall stalled: ${JSON.stringify({progress,position:p.pos.toArray(),speed:p.speed,state:p.state,active})}`);
  const launch=launches.find(j=>!jumped.has(j.name));
  let jump=charge,grind=false;
  const exitAligned=launch?.name!=='Fountain exit'||Math.abs(p.axisF.x)<.1||progress>=78.25;
  if(!active&&launch&&progress>=launch.s&&p.grounded&&exitAligned){active={...launch,frame,air:false};jumped.add(launch.name);jump=false;}
  if(active){jump=false;grind=!!active.grind;if(!p.grounded)active.air=true;if(progress>active.end&&p.grounded){evidence.jumps.push({...active,landing:progress});active=null;jump=charge;}}
  const look=leftAisle&&progress<50?8:fountainRoute&&progress>48&&progress<86?4:!fountainRoute&&progress<65?5:Math.max(5,p.speed*.65);
  let q=m.mallPoint(Math.min(408.5,progress+look),interpolate(progress+look,offsets));
  if(progress<(fountainRoute||leftAisle?12:28))q=m.mallPoint(34,2.2);
  if(fountainRoute&&progress>=73&&progress<80)q=m.mallPoint(87,0);
  if(progress>225&&progress<310){
   const s=progress+Math.max(5,p.speed*.3),u=s<268?3.3*smooth((s-232)/28):s<299?6.5-13*(s-268)/31:-6.5*(1-smooth((s-299)/20));
   q=m.mallPoint(s,u);
  }
  if(upperRoute&&progress>(route==='escalator'?119:114)&&progress<145)q=m.mallBeamPoint(.55,-1.3);
  if(route==='coffee'&&progress>115&&progress<146)q=m.mallBeamPoint(.55,-1.3,9.25);
  const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1;
  const f=l.skatepark?p.axisF:(p.courseInputDirection(l)??p.camDir);
  let moveX=(dx*-f.z+dz*f.x)/n,moveY=(dx*f.x+dz*f.z)/n;
  const brake=route==='upper'&&progress>58&&progress<fountainEntry&&p.grounded&&p.speed>14.3;
  // Braking doubles the native turn rate. Reduce the stick angle while
  // slowing so the controlled line still follows the outside of the bench.
  if(fountainRoute&&progress>48&&progress<69)moveX=Math.max(-1,Math.min(1,moveX*3*(route==='upper'?p.speed/23:1)*(brake?.5:1)));
  if(route==='mezzanine'&&progress>319&&progress<375)moveX=Math.max(-1,Math.min(1,moveX*2));
  // A brief grounded countersteer aligns the second ollie with the aperture.
  if(route==='upper'&&p.grounded&&progress>74&&progress<78.5){moveX=-Math.max(-1,Math.min(1,p.axisF.x*8));moveY=0;}
  // Skate air keeps launch momentum; lateral input spins the board. Align
  // before takeoff, then stay neutral until contact instead of air-steering.
  if(p.state==='air'&&p.airFromSkate){moveX=0;moveY=0;}
  if(active?.name==='Flying Leap'&&progress<133)grind=false;
  if(active?.name==='Lower light beam'&&progress<150)grind=false;
  if(active?.name==='Crossrail transfer'&&progress<280)grind=false;
  if(secretPop&&frame-secretPopFrame<10)grind=false;
  if(p.state==='grind'){
   moveX=Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7));moveY=1;grind=true;
   const name=m.MALL_LEVEL.components[p.grindRail.object.userData.editorIdx]?.nm;
   if(name==='Suspended upper light rail'&&!secretPop&&secretOllie){
    const fraction=p.grindT/p.grindRail.totalLength;
    moveX=0;moveY=0;jump=fraction<.53;
    // Hold the transfer direction before release, as required by the
    // authored rail ollie. Resolve it through the ordinary camera controls.
    if(fraction>.49){
     const a=m.mallBeamPoint(0),b=m.mallBeamPoint(1),n=Math.hypot(b[0]-a[0],b[2]-a[2]);
     const rx=-(b[2]-a[2])/n,rz=(b[0]-a[0])/n;
     const c=m.MALL_LEVEL.components[p.grindRail.object.userData.editorIdx];
     const side=(c.p[0]-a[0])*rx+(c.p[2]-a[2])*rz>0?-1:1;
     const f=p.camDir,fn=Math.hypot(f.x,f.z)||1;
     moveX=side*(rx*-f.z+rz*f.x)/fn;moveY=side*(rx*f.x+rz*f.z)/fn;
    }
    if(!jump){secretPop=true;secretPopFrame=frame;secretRail=l.rails.indexOf(p.grindRail);evidence.jumps.push({name:'Hidden rail reward ollie',frame,progress,fromRail:secretRail});}
   }
  }
  // A controlled two-jump line checks the actual landing inside the short
  // fountain passage. The unbraked upper-fast line independently checks flow.
  if(brake)evidence.fountainBrakingFrames++;
  return{moveX,moveY,jumpHeld:jump,grindHeld:grind,grabHeld:brake,spinHeld:p.grounded&&l.checkpoints.some(c=>!c.active&&c.spawnPos.distanceTo(p.pos)<2.7)};
 },
 observe(p,l){
  frame++;
  if(!entry.done){entry.observe(p,l);progress=entry.progress;lastAdvance=frame;lastS=progress;return;}
  progress=m.mallProject(p.pos.x,p.pos.z,progress);evidence.peakSpeed=Math.max(evidence.peakSpeed,p.speed);evidence.crystal=p.hasCrystal;
  if(progress>=34&&p.grounded&&progress<390)evidence.minimumMovingSpeed=Math.min(evidence.minimumMovingSpeed,p.speed);
  if(!p.grounded)evidence.airFrames++;
  if(p.grounded&&p.groundHit?.name==='Fountain passage floor')evidence.fountainLandingFrames++;
  for(let i=0;i<m.MALL_KNOTS.length;i++)if(progress>=m.MALL_KNOTS[i].s&&!evidence.sections.includes(i))evidence.sections.push(i);
  if(p.state==='grind'){
   const i=l.rails.indexOf(p.grindRail);if(!evidence.grinds.includes(i))evidence.grinds.push(i);
   const name=m.MALL_LEVEL.components[p.grindRail.object.userData.editorIdx]?.nm;
   if(name&&!evidence.railNames.includes(name))evidence.railNames.push(name);
   if(name==='Suspended upper light rail'&&secretPop&&i!==secretRail){
    if(!evidence.upperTransfer)evidence.upperTransfer={fromRail:secretRail,toRail:i,frame,position:p.pos.toArray(),frames:0};
    evidence.upperTransfer.frames++;
   }
  }
  for(let i=0;i<l.checkpoints.length;i++)if(l.checkpoints[i].active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);
 }
 };
}

// Focused loop review. The fast case approaches from the actual level spawn;
// the low-speed cases use explicit initial placements in the surface harness.
export function createMallPlanterPilot(m,{direction=1,fromSpawn=false}={}){
 const approach=fromSpawn?createMallPilot(m,{route:'upper-fast'}):null;
 const evidence={name:'Oval bench rim',direction,fromSpawn,caught:false,steps:0,seams:0,laps:0,bailed:false,peakSpeed:0,end:null};
 let frame=0,progress=approach?.progress??5,lastT=null,travel=0,done=false;
 return{evidence,get done(){return done;},get progress(){return progress;},
  sample(p,l){
   progress=fromSpawn?approach.progress:m.mallProject(p.pos.x,p.pos.z,progress);
   if(fromSpawn&&progress<58&&!evidence.caught)return approach.sample(p,l);
   const grinding=p.state==='grind';
   return{moveY:grinding||p.grounded?1:0,moveX:grinding?Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)):0,jumpHeld:!fromSpawn&&frame<4,grindHeld:fromSpawn||frame>=4};
  },
  observe(p,l){
   frame++;approach?.observe(p,l);progress=fromSpawn?approach.progress:m.mallProject(p.pos.x,p.pos.z,progress);
   evidence.bailed||=p.isBailing;evidence.end=p.pos.toArray();
   const rail=p.grindRail;
   if(p.state==='grind'&&m.MALL_LEVEL.components[rail.object.userData.editorIdx]?.nm==='Oval bench rim'){
    evidence.caught=true;evidence.steps++;evidence.peakSpeed=Math.max(evidence.peakSpeed,p.speed);
    if(lastT!==null){let ds=p.grindT-lastT;if(Math.abs(ds)>rail.totalLength/2){ds-=Math.sign(ds)*rail.totalLength;evidence.seams++;}travel+=Math.abs(ds);}
    lastT=p.grindT;evidence.laps=travel/rail.totalLength;
   }else if(evidence.caught)done=true;
   done||=evidence.laps>2.1||evidence.bailed||p.state==='dead';
  },
 };
}

// The folded entrance is a genuine pair of native quarter-pipe returns.
// Stage changes observe contact and direction; they never teleport, reverse
// velocity or supply a scripted transition. The optional pop uses Space release.
export function createMallEntryPilot(m,{pop=false}={}){
 let stage=0,entered=false,air=false,popped=false,frame=0,done=false,progress=-78;
 const evidence={pop,turns:[],transitionFrames:[0,0],airFrames:[0,0],peakFeetY:[30,18],returnedSpeeds:[],bails:0};
 return{evidence,get done(){return done;},get progress(){return progress;},
  sample(p){
   const quarter=stage===0||stage===2;
   if(quarter&&p.grounded&&p.groundHit?.vert&&p.rideNormal.y<.5)popped=true;
   const q=stage===0?[pop?-.2:-1,0,-34]:stage===1?[-2.1,0,18]:stage===2?[pop?-.5:0,0,22]:[2.2,0,-35];
   const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.axisF;
   return{moveX:p.grounded?(dx*-f.z+dz*f.x)/n:0,moveY:p.grounded?(dx*f.x+dz*f.z)/n:0,jumpHeld:!(pop&&popped)};
  },
  observe(p){
   frame++;const s=10-p.pos.z,quarter=stage===0||stage===2,index=stage===2?1:0;
   if(p.isBailing||['dead','gameover'].includes(p.state)){evidence.bails++;throw Error('Mall entrance lost: '+JSON.stringify({stage,position:p.pos.toArray(),state:p.state}));}
   if(quarter){
    if(p.groundHit?.vert){entered=true;evidence.transitionFrames[index]++;}
    if(entered&&!p.grounded){air=true;evidence.airFrames[index]++;}
    evidence.peakFeetY[index]=Math.max(evidence.peakFeetY[index],p.pos.y);
   }
   const returned=quarter&&entered&&air&&p.grounded&&(stage===0?p.axisF.z>0:p.axisF.z<0);
   if(returned){evidence.turns.push({name:stage===0?'Gold quarter return':'Blue quarter return',frame,position:p.pos.toArray()});evidence.returnedSpeeds.push(p.speed);stage++;entered=false;air=false;popped=false;}
   if(stage===1&&p.grounded&&p.pos.z>5){stage=2;entered=false;air=false;popped=false;}
   if(stage===3&&s>=6&&p.grounded)done=true;
   progress=stage===0?-78+Math.min(30,s)-5:stage===1?-50+28-s:stage===2?-20:s;
   if(frame>900)throw Error('Mall entrance stalled: '+JSON.stringify({stage,position:p.pos.toArray()}));
  },
 };
}
