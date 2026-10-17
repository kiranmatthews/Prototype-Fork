/** Source-owned tunnel centre lines. Metres, Y up, downhill towards -Z. */
export type HollowPoint=[number,number,number];
export const HOLLOWWAKE_END=2480;
export const HOLLOWWAKE_RADIUS=13;
export const HOLLOWWAKE_BOULDER_RADIUS=6.2;
export const HOLLOWWAKE_ROOMS=[
 {entry:350,checkpoint:364,exit:380,name:'The dry notch'},
 {entry:754,checkpoint:768,exit:784,name:'Old flood lock'},
 {entry:1164,checkpoint:1178,exit:1194,name:'Root cellar'},
 {entry:1604,checkpoint:1618,exit:1634,name:'The listening hollow'},
 {entry:2044,checkpoint:2058,exit:2074,name:'Last dry pocket'},
];
export const HOLLOWWAKE_FORKS=[
 {a:100,split:164,b:334,offset:22,lift:0,name:'Twin drains'},
 {a:410,split:474,b:716,offset:24,lift:0,name:'Broken sluice / banked bend'},
 {a:806,split:870,b:1118,offset:29,lift:4,name:'Low siphon / rising ribway'},
 {a:1224,split:1288,b:1558,offset:24,lift:0,name:'The worm turns'},
 {a:1684,split:1748,b:2008,offset:27,lift:3,name:'Drowned crossing'},
 {a:2100,split:2164,b:2408,offset:21,lift:0,name:'Final split'},
];
export const HOLLOWWAKE_ACTS=[
 {a:-65,b:350,name:'The wake',group:10},
 {a:380,b:754,name:'Timber drains',group:11},
 {a:784,b:1164,name:'Siphon network',group:12},
 {a:1194,b:1604,name:'Wormwheel bends',group:13},
 {a:1634,b:2044,name:'The drowned passage',group:14},
 {a:2074,b:2440,name:'The wreck throat',group:15},
];
const bends:[number,number][]=[[-65,2],[0,0],[170,-24],[350,10],[500,47],[740,5],[870,-34],[1120,-53],[1260,8],[1450,59],[1620,17],[1790,-37],[1990,-15],[2190,39],[2400,18],[2520,-4]];
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const round=(v:number)=>Math.round(v*1e5)/1e5;
function rawX(s:number):number{
 let i=1;while(i<bends.length-1&&bends[i][0]<s)i++;
 const a=bends[i-1],b=bends[i],t=Math.max(0,Math.min(1,(s-a[0])/(b[0]-a[0])));
 return a[1]+(b[1]-a[1])*smooth(t);
}
function rawY(s:number):number{return 78-.061*s-5*smooth((s-790)/200)-8*smooth((s-1640)/400);}
function flatten(s:number,f:(s:number)=>number):number{
 const room=HOLLOWWAKE_ROOMS.find(r=>s>=r.entry-18&&s<=r.exit+18);
 if(!room)return f(s);
 const weight=s<room.entry?smooth((s-room.entry+18)/18):1-smooth((s-room.exit)/18);
 const value=f===rawY?f(room.checkpoint):f(room.entry)+(f(room.exit)-f(room.entry))*(s-room.entry)/(room.exit-room.entry);
 return f(s)+(value-f(s))*weight;
}
export const hollowX=(s:number)=>flatten(s,rawX);
export const hollowY=(s:number)=>flatten(s,rawY);
export const hollowGroup=(s:number)=>HOLLOWWAKE_ACTS.find(a=>s>=a.a&&s<a.b)?.group??(HOLLOWWAKE_ROOMS.some(r=>s>=r.entry&&s<=r.exit)?30+HOLLOWWAKE_ROOMS.findIndex(r=>s>=r.entry&&s<=r.exit):16);
export function hollowFork(s:number){return HOLLOWWAKE_FORKS.find(f=>s>=f.a&&s<=f.b);}
/** The broad approach separates into two readable lanes before the old fork.
 * Ten metres of offset clears the stone on either side of the decision spine. */
export function hollowOffset(s:number,branch:number):number{
 const f=hollowFork(s);if(!f)return 0;const shoulder=f.a+36,peak=(f.split+f.b)/2;
 const offset=s<shoulder?10*smooth((s-f.a)/36):s<peak?10+(f.offset-10)*smooth((s-shoulder)/(peak-shoulder)):f.offset*(1-smooth((s-peak)/(f.b-peak)));
 return(branch===0?-1:1)*offset;
}
export const hollowGapApplies=(gap:{branch:number},branch:number)=>gap.branch<0||gap.branch===branch;
export function hollowLift(s:number,branch:number):number{const f=hollowFork(s);return f&&branch===1?f.lift*smooth((2*Math.abs(hollowOffset(s,branch))-2*HOLLOWWAKE_RADIUS-2)/12):0;}
export function hollowCentre(s:number,branch=-1):HollowPoint{
 const x=hollowX(s),y=hollowY(s);if(branch<0)return[x,y,-s];
 const dx=(hollowX(s+.05)-hollowX(s-.05))/.1,n=Math.hypot(dx,1),u=hollowOffset(s,branch);
 return[x+u/n,y+hollowLift(s,branch),-s+dx*u/n];
}
export function hollowTangent(s:number,branch=-1):HollowPoint{const a=hollowCentre(s-.05,branch),b=hollowCentre(s+.05,branch),n=Math.hypot(b[0]-a[0],b[2]-a[2]);return[(b[0]-a[0])/n,0,(b[2]-a[2])/n];}
export const hollowYaw=(s:number,branch=-1)=>Math.atan2(-hollowTangent(s,branch)[0],-hollowTangent(s,branch)[2])*180/Math.PI;
export function hollowPoint(s:number,branch=-1,u=0,lift=0):HollowPoint{const p=hollowCentre(s,branch),d=hollowTangent(s,branch);return[p[0]-d[2]*u,p[1]+lift,p[2]+d[0]*u].map(round) as HollowPoint;}
export function hollowProgress(p:{x:number;z:number}|HollowPoint):number{
 const x=Array.isArray(p)?p[0]:p.x,z=Array.isArray(p)?p[2]:p.z;let s=-z;
 for(let i=0;i<5;i++){const dx=(hollowX(s+.05)-hollowX(s-.05))/.1;s-=((hollowX(s)-x)*dx+s+z)/(1+dx*dx);}return s;
}
export function hollowRadius(s:number):number{
 const room=HOLLOWWAKE_ROOMS.find(r=>s>=r.entry&&s<=r.exit);
 if(room)return 5.2;
 const release=[-30,...HOLLOWWAKE_ROOMS.map(r=>r.exit+10)].find(t=>Math.abs(s-t)<28);
 return release===undefined?HOLLOWWAKE_RADIUS:HOLLOWWAKE_RADIUS+3*(1-smooth(Math.abs(s-release)/28));
}
export const hollowFloorRise=(u:number,r=HOLLOWWAKE_RADIUS)=>r-Math.sqrt(Math.max(0,r*r-u*u));
