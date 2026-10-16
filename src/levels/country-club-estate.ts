import * as THREE from 'three';
// Golf routing is authored independently of the race. The ninth and eighteenth
// return to the clubhouse; tee markers never carry flags or number boards.
export type EstatePoint=[number,number];
export const COUNTRY_CLUB_ESTATE_SCALE=.78;
export const estatePoint=(x:number,z:number):EstatePoint=>[x*COUNTRY_CLUB_ESTATE_SCALE,z*COUNTRY_CLUB_ESTATE_SCALE];
export const countryClubLandHeight=(x:number,z:number)=>8+7*Math.sin(-z/180)+3.4*Math.sin(-z/63)+2.2*Math.sin(x/80+z/230);
const golf=[
  {n:1,name:'Clubhouse meadow',path:[[25,25],[100,-60],[170,-135],[205,-200]],width:36,rx:17,rz:22,shape:0},
  {n:2,name:'East return',path:[[255,-220],[330,-170],[350,-70],[360,20]],width:31,rx:19,rz:16,shape:1},
  {n:3,name:'Long pond',path:[[405,-35],[410,-110],[395,-205]],width:24,rx:15,rz:19,shape:2},
  {n:4,name:'Oak dogleg',path:[[365,-245],[295,-285],[245,-360],[200,-470]],width:34,rx:20,rz:17,shape:3},
  {n:5,name:'Upper orchard',path:[[235,-500],[300,-460],[350,-390],[390,-320]],width:30,rx:16,rz:22,shape:4},
  {n:6,name:'Reed pocket',path:[[405,-370],[412,-460],[395,-555]],width:24,rx:18,rz:15,shape:5},
  {n:7,name:'Crosswind',path:[[345,-585],[235,-605],[110,-555],[15,-465]],width:38,rx:22,rz:17,shape:6},
  {n:8,name:'Rise and fall',path:[[-20,-415],[0,-335],[35,-260],[80,-205]],width:32,rx:17,rz:21,shape:7},
  {n:9,name:'Front nine home',path:[[55,-170],[20,-125],[-35,-85],[-85,10]],width:33,rx:20,rz:17,shape:8},
  {n:10,name:'West boundary',path:[[-190,-80],[-275,-180],[-330,-300],[-350,-445]],width:38,rx:18,rz:23,shape:9},
  {n:11,name:'Willow reach',path:[[-360,-485],[-375,-590],[-365,-690],[-310,-790]],width:33,rx:23,rz:17,shape:10},
  {n:12,name:'Short elbow',path:[[-285,-830],[-330,-895],[-335,-960],[-270,-1020]],width:29,rx:17,rz:19,shape:11},
  {n:13,name:'Southern links',path:[[-245,-1080],[-140,-1140],[-15,-1165],[100,-1150]],width:37,rx:21,rz:17,shape:12},
  {n:14,name:'Lake dogleg',path:[[145,-1120],[245,-1120],[290,-1055],[310,-960]],width:34,rx:18,rz:23,shape:13},
  {n:15,name:'Water garden',path:[[315,-920],[310,-850],[285,-775]],width:23,rx:17,rz:18,shape:14},
  {n:16,name:'Across the hollow',path:[[250,-740],[175,-700],[95,-665],[30,-605]],width:34,rx:20,rz:18,shape:15},
  {n:17,name:'Western bowl',path:[[-10,-610],[-95,-665],[-175,-680],[-250,-625]],width:32,rx:18,rz:21,shape:16},
  {n:18,name:'Long home',path:[[-240,-580],[-170,-440],[-145,-250],[-120,-20]],width:39,rx:23,rz:18,shape:17},
];
export const COUNTRY_CLUB_HOLES=golf.map(h=>{
  const path=h.path.map(p=>estatePoint(p[0],p[1])),tee=path[0],cup=path[path.length-1],last=path[path.length-2];
  const dx=cup[0]-last[0],dz=cup[1]-last[1],n=Math.hypot(dx,dz),f:EstatePoint=[dx/n,dz/n],r:EstatePoint=[-f[1],f[0]];
  const curve=new THREE.CatmullRomCurve3(path.map(q=>new THREE.Vector3(q[0],0,q[1])),false,'centripetal'),golfLength=curve.getLength(),samples=curve.getSpacedPoints(Math.ceil(golfLength/6));
  const minX=Math.min(...samples.map(p=>p.x))-h.width,maxX=Math.max(...samples.map(p=>p.x))+h.width,minZ=Math.min(...samples.map(p=>p.z))-h.width,maxZ=Math.max(...samples.map(p=>p.z))+h.width;
  return {...h,path,tee,cup,f,r,rx:h.rx,rz:h.rz,greenY:countryClubLandHeight(cup[0],cup[1])+.15,golfLength,samples,bounds:{minX,maxX,minZ,maxZ}};
});
export function countryClubGreenRadius(h:typeof COUNTRY_CLUB_HOLES[number],angle:number){
  return 1+.09*Math.sin(angle*3+h.shape*.85)+.055*Math.cos(angle*2+h.shape*.55);
}
export function countryClubGreenDistance(h:typeof COUNTRY_CLUB_HOLES[number],x:number,z:number){
  const dx=x-h.cup[0],dz=z-h.cup[1],u=(dx*h.r[0]+dz*h.r[1])/h.rx,v=(dx*h.f[0]+dz*h.f[1])/h.rz;
  return Math.hypot(u,v)/countryClubGreenRadius(h,Math.atan2(v,u));
}
export const COUNTRY_CLUB_GOLF_BUNKERS=COUNTRY_CLUB_HOLES.flatMap(h=>{
  const side=h.n===9?-1:h.n===12?1:h.n%2?1:-1;
  return [
    {hole:h.n,x:h.cup[0]+h.r[0]*side*(h.rx+9)-h.f[0]*9,z:h.cup[1]+h.r[1]*side*(h.rx+9)-h.f[1]*9,rx:7+(h.n%3),rz:12+(h.n%4),angle:Math.atan2(h.f[0],h.f[1])+.35,seed:h.n},
    ...(h.n%3!==0?[{hole:h.n,x:h.path[1][0]-h.r[0]*side*(h.width*.48+5),z:h.path[1][1]-h.r[1]*side*(h.width*.48+5),rx:8,rz:15,angle:Math.atan2(h.f[0],h.f[1])-.4,seed:h.n+18}]:[]),
  ];
});
export function countryClubGolfBunkerDistance(b:typeof COUNTRY_CLUB_GOLF_BUNKERS[number],x:number,z:number){
  const dx=x-b.x,dz=z-b.z,u=(dx*Math.cos(b.angle)-dz*Math.sin(b.angle))/b.rx,v=(dx*Math.sin(b.angle)+dz*Math.cos(b.angle))/b.rz;
  const a=Math.atan2(v,u);return Math.hypot(u,v)/(1+.16*Math.sin(a*3+b.seed));
}
export function countryClubGolfGround(x:number,z:number){
  let y=countryClubLandHeight(x,z);
  for(const h of COUNTRY_CLUB_HOLES){
    if(Math.abs(x-h.cup[0])>45||Math.abs(z-h.cup[1])>45)continue;
    const d=countryClubGreenDistance(h,x,z),t=Math.max(0,Math.min(1,(1.6-d)/.55)),blend=t*t*(3-2*t);
    // A shallow, fully supported putting plateau blends back into the estate.
    const tilt=((x-h.cup[0])*h.r[0]+(z-h.cup[1])*h.r[1])*.012;
    y+=(h.greenY+tilt-y)*blend;
  }
  for(const b of COUNTRY_CLUB_GOLF_BUNKERS){
    if(Math.abs(x-b.x)>35||Math.abs(z-b.z)>35)continue;
    const d=countryClubGolfBunkerDistance(b,x,z);if(d<1.15)y-=.65*(1-Math.min(1,d/1.15)**2);
  }
  return y;
}

const fieldColors={rough:new THREE.Color('#687b50'),fairA:new THREE.Color('#829c66'),fairB:new THREE.Color('#78925f'),green:new THREE.Color('#accb89'),collar:new THREE.Color('#8ea872'),sand:new THREE.Color('#d9c9a9')};
export function countryClubGolfField(x:number,z:number){
  let color=fieldColors.rough,detail=1,green=0,fairway=0,tee=0,bunker=0;
  for(const h of COUNTRY_CLUB_HOLES){
    if(x<h.bounds.minX||x>h.bounds.maxX||z<h.bounds.minZ||z>h.bounds.maxZ)continue;
    let best=Infinity,t=0;
    for(let i=1;i<h.samples.length;i++){
      const a=h.samples[i-1],b=h.samples[i],dx=b.x-a.x,dz=b.z-a.z,q=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz))),d=Math.hypot(x-a.x-dx*q,z-a.z-dz*q);
      if(d<best){best=d;t=(i-1+q)/(h.samples.length-1);}
    }
    const w=h.width*(.38+.62*Math.sin(Math.PI*t)**.6)*(1+.11*Math.sin(t*9+h.n));
    if(best<w/2+4)detail=Math.max(detail,2);
    if(best<w/2){color=Math.floor(t*h.golfLength/9)%2?fieldColors.fairA:fieldColors.fairB;fairway=h.n;}
    const dx=x-h.tee[0],dz=z-h.tee[1],a=h.path[1],fx=a[0]-h.tee[0],fz=a[1]-h.tee[1],len=Math.hypot(fx,fz);
    if(Math.abs((-fz*dx+fx*dz)/len)<5&&Math.abs((fx*dx+fz*dz)/len)<7){color=fieldColors.green;tee=h.n;detail=3;}
  }
  for(const h of COUNTRY_CLUB_HOLES){
    if(Math.abs(x-h.cup[0])>45||Math.abs(z-h.cup[1])>45)continue;
    const d=countryClubGreenDistance(h,x,z);if(d<1.4)detail=3;
    if(d<1.25){color=d<=1?fieldColors.green:fieldColors.collar;green=h.n;}
  }
  for(const b of COUNTRY_CLUB_GOLF_BUNKERS){
    if(Math.abs(x-b.x)>35||Math.abs(z-b.z)>35)continue;
    const d=countryClubGolfBunkerDistance(b,x,z);if(d<1.3)detail=3;if(d<1){color=fieldColors.sand;bunker=b.hole;}
  }
  return {color,detail,green,fairway,tee,bunker};
}
