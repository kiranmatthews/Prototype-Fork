// Controller samples only: production movement, collision, rails and camera.
export function createMallPilot(m,{route='main',charge=true,secretOllie=true}={}){
 let progress=5,frame=0,active=null,jumped=new Set(),lastAdvance=0,lastS=5,secretPop=false,secretPopFrame=-Infinity;
 const evidence={route,sections:[],jumps:[],grinds:[],railNames:[],checkpoints:[],peakSpeed:0,minimumMovingSpeed:Infinity,bails:0,airFrames:0,crystal:false};
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const interpolate=(s,knots)=>{for(let i=1;i<knots.length;i++)if(s<=knots[i][0])return knots[i-1][1]+(knots[i][1]-knots[i-1][1])*smooth((s-knots[i-1][0])/(knots[i][0]-knots[i-1][0]));return knots.at(-1)[1];};
 const offsets=route==='car'?[[0,0],[43,7.8],[113,7.8],[129,5],[183,-6.1],[199,0],[319,0],[336,6.5],[371,6.5],[396,0]]:
  route==='upper'?[[0,0],[34,-1.4],[97,-1.4],[115,-6.1],[128,-6.1],[183,-6.1],[199,0],[319,0],[336,6.5],[371,6.5],[396,0]]:
  route==='coffee'?[[0,0],[16,0],[43,-11.2],[83,-9.8],[103,-6.2],[132,-10],[180,-10],[199,0],[217,0],[319,0],[336,6.5],[371,6.5],[396,0]]:
  route==='mezzanine'?[[0,0],[43,7.2],[65,5],[83,5],[96,3.8],[132,13.5],[162,13.5],[180,10.5],[190,10.5],[217,0],[319,0],[338,-6.5],[377,-6.5],[397,0]]:
  [[0,0],[43,7.2],[65,5],[83,5],[96,3.8],[132,13.5],[162,13.5],[180,10.5],[190,10.5],[217,0],[319,0],[336,6.5],[371,6.5],[396,0]];
 const launches=[...(route==='car'?[{s:86.5,end:100,name:'Car display jump'},{s:125,end:187,name:'Flying Leap',grind:true}]:route==='upper'?[{s:67.5,end:83,name:'Fountain Gap'},{s:128,end:187,name:'Flying Leap',grind:true}]:route==='coffee'?[{s:55,end:104,name:'Coffee Grind',grind:true},{s:136,end:185,name:'Lower light beam',grind:true}]:[]),{s:276.2,end:300,name:'Crossrail transfer',grind:true},...(route==='mezzanine'?[{s:375.5,end:395,name:'Mezzanine'}]:[])];
 return {evidence,get progress(){return progress;},
 sample(p,l){
  progress=m.mallProject(p.pos.x,p.pos.z,progress);
  if(p.isBailing||['dead','gameover'].includes(p.state))throw Error(`Mall run lost: ${JSON.stringify({progress,position:p.pos.toArray(),state:p.state,bailing:p.isBailing,active})}`);
  if(progress>lastS+1){lastS=progress;lastAdvance=frame;}else if(frame-lastAdvance>480)throw Error(`Mall stalled: ${JSON.stringify({progress,position:p.pos.toArray(),speed:p.speed,state:p.state,active})}`);
  const launch=launches.find(j=>!jumped.has(j.name));
  let jump=charge,grind=false;
  if(!active&&launch&&progress>=launch.s&&p.grounded){active={...launch,frame,air:false};jumped.add(launch.name);jump=false;}
  if(active){jump=false;grind=!!active.grind;if(!p.grounded)active.air=true;if(progress>active.end&&p.grounded){evidence.jumps.push({...active,landing:progress});active=null;jump=charge;}}
  const look=Math.max(5,p.speed*.65);
  let q=m.mallPoint(Math.min(408.5,progress+look),interpolate(progress+look,offsets));
  if((route==='upper'||route==='car')&&progress>114&&progress<145)q=m.mallBeamPoint(.55,-1.3);
  if(route==='coffee'&&progress>115&&progress<146)q=m.mallBeamPoint(.55,-1.3,9.25);
  const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1;
  const f=l.skatepark?p.axisF:(p.courseInputDirection(l)??p.camDir);
  let moveX=(dx*-f.z+dz*f.x)/n,moveY=(dx*f.x+dz*f.z)/n;
  // Skate air keeps launch momentum; lateral input spins the board. Align
  // before takeoff, then stay neutral until contact instead of air-steering.
  if(p.state==='air'&&p.airFromSkate){moveX=0;moveY=0;}
  if(active?.name==='Flying Leap'&&progress<133)grind=false;
  if(active?.name==='Lower light beam'&&progress<150)grind=false;
  if(secretPop&&frame-secretPopFrame<10)grind=false;
  if(p.state==='grind'){
   moveX=Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7));moveY=1;grind=true;
   const name=m.MALL_LEVEL.components[p.grindRail.object.userData.editorIdx]?.nm;
   if(name==='Suspended upper light rail'&&!secretPop&&secretOllie){
    moveX=0;moveY=0;jump=p.grindT/p.grindRail.totalLength<.53;
    if(!jump){secretPop=true;secretPopFrame=frame;evidence.jumps.push({name:'Hidden rail reward ollie',frame,progress});}
   }
  }
  return{moveX,moveY,jumpHeld:jump,grindHeld:grind,spinHeld:p.grounded&&l.checkpoints.some(c=>!c.active&&c.spawnPos.distanceTo(p.pos)<2.7)};
 },
 observe(p,l){
  frame++;progress=m.mallProject(p.pos.x,p.pos.z,progress);evidence.peakSpeed=Math.max(evidence.peakSpeed,p.speed);evidence.crystal=p.hasCrystal;
  if(frame>180&&p.grounded&&progress<390)evidence.minimumMovingSpeed=Math.min(evidence.minimumMovingSpeed,p.speed);
  if(!p.grounded)evidence.airFrames++;
  for(let i=0;i<m.MALL_KNOTS.length;i++)if(progress>=m.MALL_KNOTS[i].s&&!evidence.sections.includes(i))evidence.sections.push(i);
  if(p.state==='grind'){
   const i=l.rails.indexOf(p.grindRail);if(!evidence.grinds.includes(i))evidence.grinds.push(i);
   const name=m.MALL_LEVEL.components[p.grindRail.object.userData.editorIdx]?.nm;
   if(name&&!evidence.railNames.includes(name))evidence.railNames.push(name);
  }
  for(let i=0;i<l.checkpoints.length;i++)if(l.checkpoints[i].active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);
 }
 };
}
