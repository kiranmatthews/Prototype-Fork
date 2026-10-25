import type { CustomComponent, CustomLevelData } from '../level';
import type { RaceKnot } from '../race/types';
import { lazySourceField } from './lazy-source';

type Point = [number, number, number];
export const CART_RALLY_LENGTH = 2320;
export const CART_RALLY_JUMPS = [150,310,470,690,850,1010,1230,1390,1550,1770,1930,2090].map((s,i)=>({
  start:s, end:s+26+(i%3)*4, name:['Lagoon leap','Palm canyon','Coral carry'][i%3],
}));
export const CART_RALLY_PIPES = [[540,640],[1080,1180],[1620,1720],[2160,2260]] as const;
export const CART_RALLY_CHECKPOINTS = [80,410,790,1190,1710,2030];
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
const round=(x:number)=>Math.round(x*1e5)/1e5;
function centreX(s:number){return 60*Math.sin(s/240)+24*Math.sin(s/110);}
function routeX(s:number){
  const jump=CART_RALLY_JUMPS.find(j=>s>j.start-55&&s<j.start+115);
  if(!jump)return centreX(s);
  const at=jump.start,dx=(centreX(at+.1)-centreX(at-.1))/.2;
  const blend=smooth((s-at+55)/20)*smooth((at+115-s)/30);
  return centreX(s)*(1-blend)+(centreX(at)+dx*(s-at))*blend;
}
function frame(s:number){return {x:routeX(s),dx:(routeX(s+.05)-routeX(s-.05))/.1};}

function height(s:number){
  let y=25+9*Math.sin(s/210)+4*Math.sin(s/73);
  for(const j of CART_RALLY_JUMPS){
    // Broad concave toe, tall kicker and long, descending landing tabletop.
    if(s>=j.start-32&&s<=j.start)y+=8*((s-j.start+32)/32)**2;
    else if(s>j.start&&s<j.start+100)y+=8*(1-smooth((s-j.start)/100));
  }
  return y;
}
function pipeAmount(s:number){return Math.max(0,...CART_RALLY_PIPES.map(([a,b])=>smooth((s-a)/15)*smooth((b-s)/15)));}
export function cartRallyPoint(s:number,u=0,up=0):Point {
  const f=frame(s),n=Math.hypot(1,f.dx),pipe=pipeAmount(s);
  const bank=pipe*11*(1-Math.sqrt(Math.max(0,1-(Math.max(0,Math.abs(u)-4)/11)**2)));
  return [round(f.x+u/n),round(height(s)+bank+up),round(-s+u*f.dx/n)];
}
const line:RaceKnot[]=[];
for(let s=18;s<=CART_RALLY_LENGTH;s+=2)line.push([...cartRallyPoint(s),28]);

function build():CustomComponent[]{
  const c:CustomComponent[]=[],add=(v:CustomComponent)=>c.push(v);
  const strip=(name:string,a:number,b:number,lo:number,hi:number,color:string,tex:string,solid=true,lift=0)=>{
    const vertices:number[]=[],indices:number[]=[],uvs:number[]=[],normals:number[]=[];
    const rows=Math.max(1,Math.ceil((b-a)/2)),cols=Math.max(1,Math.ceil((hi-lo)/1.1));
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const s=a+(b-a)*j/rows,u=lo+(hi-lo)*i/cols;
      vertices.push(...cartRallyPoint(s,u,lift));uvs.push(u/6,s/6);
      const left=cartRallyPoint(s,u-.01),right=cartRallyPoint(s,u+.01),back=cartRallyPoint(s-.01,u),front=cartRallyPoint(s+.01,u);
      const x=right.map((v,k)=>v-left[k]),z=front.map((v,k)=>v-back[k]);
      const n=[x[1]*z[2]-x[2]*z[1],x[2]*z[0]-x[0]*z[2],x[0]*z[1]-x[1]*z[0]],length=Math.hypot(...n)||1;
      normals.push(...n.map(v=>v/length));
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const p=j*(cols+1)+i,q=p+cols+1;indices.push(p,p+1,q,p+1,q+1,q);
    }
    add({t:'mesh',nm:name,p:[0,0,0],vertices,indices,uvs,normals,solid,color,tex,smoothCollision:true});
  };
  for(let s=-8;s<CART_RALLY_LENGTH+50;s+=24){
    const end=Math.min(s+24,CART_RALLY_LENGTH+50);
    const cuts=[s,end,...CART_RALLY_JUMPS.flatMap(j=>[j.start,j.end]).filter(v=>v>s&&v<end)].sort((a,b)=>a-b);
    for(let i=0;i<cuts.length-1;i++){
      const a=cuts[i],b=cuts[i+1],mid=(a+b)/2;
      if(CART_RALLY_JUMPS.some(j=>mid>j.start&&mid<j.end))continue;
      const pipe=pipeAmount(mid)>.1;
      strip(pipe?'Azure half pipe':'Ivory rally road',a,b,-15,15,pipe?'#48bdc2':'#f2dfb3',pipe?'solid':'sand');
      for(const side of [-1,1])strip('Coral edge stripe',a,b,side<0?-15:14,side<0?-14:15,Math.floor(s/8)%2?'#f07153':'#fff5d5','solid',false,.035);
    }
  }
  // Winding islands beneath the elevated road, with genuine sea gaps.
  for(let s=0;s<CART_RALLY_LENGTH;s+=56){
    if(CART_RALLY_JUMPS.some(j=>Math.abs(s-(j.start+j.end)/2)<40))continue;
    const p=cartRallyPoint(s),shelfY=p[1]-13;
    add({t:'rock',nm:'Sunlit coral island',p:[p[0],shelfY-10,p[2]],s:[90,32,84],color:'#c7aa7c',tex:'sand',seed:s+31});
    for(const side of [-1,1]){
      const q=cartRallyPoint(s,side*(23+(s%3)*5));q[1]=shelfY+7;
      add({t:'decor',dkind:'palm',nm:'Palm grove',p:q,rise:12+(s%4),amp:side*.2,w:1.4});
    }
  }
  // Alternating low chicanes leave a wide, readable driving line. Sand bays
  // are physical slow surfaces; jumping over them is an optional faster line.
  for(const [index,s]of [90,390,760,920,1300,1470,1830,2020].entries()){
    const side=index%2?1:-1,p=cartRallyPoint(s,side*9);
    add({t:'wall',nm:'Coral chicane barrier',p,s:[5,1.8,4],yaw:0,color:'#e87a52',tex:'solid'});
    strip('Sand trap',s-9,s+14,side>0?-14:3,side>0?-3:14,'#d3aa67','sand',true,.055);
  }
  for(const [i,j]of CART_RALLY_JUMPS.entries()){
    for(let s=j.start-16;s<j.start-3;s+=5)strip('Launch chevron',s,s+.9,-12,12,'#f3a849','solid',false,.06);
    for(const side of [-1,1]){
      const p=cartRallyPoint(j.start-1,side*15,0);
      add({t:'platform',nm:`Jump ${i+1} beacon`,p:[p[0],p[1]+4,p[2]],s:[.7,8,.7],tex:'solid',color:'#f3c65e'});
      add({t:'platform',nm:'Launch flag',p:[p[0],p[1]+7,p[2]],s:[2.5,1.4,.16],tex:'solid',color:i%2?'#ff7f63':'#63e1d4'});
    }
  }
  for(let s=65;s<CART_RALLY_LENGTH-70;s+=115){
    if(CART_RALLY_JUMPS.some(j=>s>j.start-45&&s<j.start+100))continue;
    for(const u of [-9,-3,3,9])add({t:'crate',kind:'mystery',p:cartRallyPoint(s,u),nm:'Rally item row'});
  }
  for(const s of CART_RALLY_CHECKPOINTS){
    add({t:'checkpoint',p:cartRallyPoint(s),nm:'Rally recovery checkpoint'});
    for(const u of [-6,0,6])add({t:'crate',kind:'empty',p:cartRallyPoint(s+8,u),nm:'Rally box gem crate'});
  }
  for(let s=0;s<=CART_RALLY_LENGTH+35;s+=16)add({t:'camnode',p:cartRallyPoint(s),nm:'Rally chase camera'});
  add({t:'gate',p:cartRallyPoint(CART_RALLY_LENGTH),yaw:-Math.atan(frame(CART_RALLY_LENGTH).dx)*180/Math.PI,nm:'Coconut Cart Rally finish'});
  add({t:'pit',p:[0,-35,-CART_RALLY_LENGTH/2],s:[600,1,CART_RALLY_LENGTH+160],invisible:true,nm:'Lagoon recovery'});
  return c;
}
export const COCONUT_CART_RALLY_LEVEL:CustomLevelData={
  v:1,name:'Coconut Cart Rally',spawn:cartRallyPoint(18,0,.12),startWarpPad:false,killY:-45,
  sky:'day',ocean:{p:[-320,-8,-1160],length:2560,width:640,seaward:1,geometryVersion:2,sourceCoordinates:'three',look:'waterpark-island',horizonMode:'surround',shoreGeometry:'ground',longitudinalSegments:160,lateralSegments:40},keepPlayFog:true,cameraLookAhead:14,cameraAirLift:.8,
  cameraRig:{camDist:13,camHeight:7.5,camPitch:18,camFov:68},
  atmosphere:{fogEnabled:true,fogNear:160,fogFar:560,fogColor:'#a2dadd',ambientSky:'#d9f3ff',ambientGround:'#bda882',ambientIntensity:1.15,sunColor:'#fff0ce',sunIntensity:2,fillColor:'#b3ebee',fillIntensity:.5,shadowStrength:.65,backdrop:'sky',drawDistance:650,fallbackTop:'#38a6d3',fallbackBottom:'#c5eef0',fallbackRidges:false,fallbackStars:false},
  medalTimes:{gold:125,silver:150,bronze:185},
  skateRace:{v:1,racers:8,vehicle:'golf-cart',seed:251026,stages:['Lagoon launchways','Palm canyon','Coral half pipes','Seaside sprint'],line,
    jumps:CART_RALLY_JUMPS.map(j=>({takeoff:cartRallyPoint(j.start),landing:cartRallyPoint(j.end)})),finishWidth:30,originalLength:CART_RALLY_LENGTH},
  components:[],
};
lazySourceField(COCONUT_CART_RALLY_LEVEL,'components',build);
