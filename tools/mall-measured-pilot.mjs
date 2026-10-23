// Ordinary controller samples; no in-run pose, velocity or tuning writes.
export function createMeasuredMallPilot(m){
 let stage=0,frame=0,seenVert=false,lastProgress=-Infinity,lastAdvance=0;
 const evidence={turns:[],sections:[],minSpeed:Infinity,maxSpeed:0,airFrames:0,grinds:[]};
 const waypoints=[[-15350,530],[-13500,530],[-13100,760],[-10800,780],[-10000,1000],[-7700,1000],[-6850,900],[-6550,870],[-6250,660],[-5500,550],[-4000,550],[-3500,480],[-3100,525],[-2700,700],[-2300,925],[-1900,1300],[-1500,1500],[-1100,1900],[-900,2300],[-1000,2900],[-1300,3000],[-1600,3350],[-1600,4300],[-1750,4900],[-1700,5450],[-1500,5800],[-1200,6050],[-500,6180],[-100,6100],[300,6000],[1800,5800],[3500,5800],[5400,5800],[6500,5800],[7600,5800],[9600,5800],[10700,5800],[11900,5780],[14000,5780],[15100,5860],[15600,5860],[15800,5780]];
 let waypoint=0,station=0;
 const path=[[-15830,150],...waypoints],dist=[0];for(let i=1;i<path.length;i++)dist.push(dist[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
 const at=d=>{let i=1;while(i<dist.length-1&&dist[i]<d)i++;const t=Math.max(0,Math.min(1,(d-dist[i-1])/(dist[i]-dist[i-1])));return path[i-1].map((v,j)=>v+(path[i][j]-v)*t);};
 return{evidence,get stage(){return stage;},sample(p,l){
  const s=m.mallSourcePoint(...p.pos.toArray()),f=p.axisF;let target;
  if(stage===0)target=[-13410,150];
  else if(stage===1)target=[s[0]-280,150];
  else {
   let best=Infinity,next=station;
   for(let i=1;i<path.length;i++){if(dist[i]<station-240||dist[i-1]>station+600)continue;const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((s[0]-a[0])*dx+(s[2]-a[1])*dz)/(dx*dx+dz*dz))),d=Math.hypot(s[0]-a[0]-dx*t,s[2]-a[1]-dz*t);if(d<best){best=d;next=dist[i-1]+t*(dist[i]-dist[i-1]);}}
   station=next;target=at(station+220);
   while(waypoint<waypoints.length-1&&station>dist[waypoint+1]-80){evidence.sections.push({waypoint,frame,source:s});waypoint++;}
  }
  const q=m.mallPoint(target[0],0,target[1]),dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1;
  let moveX=(dx*-f.z+dz*f.x)/n,moveY=(dx*f.x+dz*f.z)/n;
  if(stage>=1)moveX=Math.max(-1,Math.min(1,moveX*3));
  if(p.state==='air'&&p.airFromSkate){moveX=0;moveY=0;}
  if(p.state==='grind'){moveX=Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7));moveY=1;}
  const jumpHeld=!(stage===2&&(s[0]>-2200&&s[0]<-1770&&s[2]<1600||s[0]>420&&s[0]<900||s[0]>2180&&s[0]<2550||s[0]>9340&&s[0]<9650));
  return{moveX,moveY,jumpHeld,grindHeld:p.state==='grind',spinHeld:p.grounded&&l.checkpoints.some(c=>!c.active&&c.spawnPos.distanceTo(p.pos)<3)};
 },observe(p,l){
  frame++;const s=m.mallSourcePoint(...p.pos.toArray());if(p.groundHit?.vert)seenVert=true;
  if(stage===0&&seenVert&&p.grounded&&p.axisF.z>.6){evidence.turns.push({stage,frame,source:s});stage=1;seenVert=false;}
  if(stage===1&&seenVert&&p.grounded&&p.axisF.z<-.6&&s[0]<-15300){evidence.turns.push({stage,frame,source:s});stage=2;seenVert=false;}
  evidence.maxSpeed=Math.max(evidence.maxSpeed,p.speed);if(stage===2&&s[0]>-13400&&p.grounded&&p.state!=='finished')evidence.minSpeed=Math.min(evidence.minSpeed,p.speed);
  if(!p.grounded)evidence.airFrames++;
  if(p.state==='grind'){const i=l.rails.indexOf(p.grindRail);if(!evidence.grinds.includes(i))evidence.grinds.push(i);}
  const progress=stage===0?s[0]+15000:stage===1?3000-s[0]:20000+station;
  if(progress>lastProgress+5){lastProgress=progress;lastAdvance=frame;}
  if(p.isBailing||p.totalDeaths||['dead','gameover'].includes(p.state))throw Error(`Measured Mall lost ${JSON.stringify({stage,waypoint,source:s,state:p.state})}`);
  if(frame-lastAdvance>900)throw Error(`Measured Mall stalled ${JSON.stringify({stage,waypoint,source:s,speed:p.speed,state:p.state,ground:p.groundHit?.name})}`);
 }};
}
