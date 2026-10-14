import type {CustomComponent,CustomGroup,CustomLevelData} from '../level';
import {RUMBLEWATER_REFUGES,RUMBLEWATER_REFUGE_GROUPS,outsideRefuges,buildRumblewaterRefuges} from './rumblewater-refuges';
import {buildRumblewaterDownstream} from './rumblewater-downstream';
import {rumblewaterArt,RUMBLEWATER_ART_GROUPS} from './rumblewater-art';
import {buildCreekBank,buildCreekCollision,type CreekBank} from './custard-terrain';

type Point=[number,number,number];
type Scalar=number|((s:number)=>number);
const C:CustomComponent[]=[],groups:CustomGroup[]=[];
const val=(n:Scalar,s:number)=>typeof n==='function'?n(s):n;
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const round=(n:number)=>Math.round(n*10000)/10000;
export const RUMBLEWATER_END=2676;
export const RUMBLEWATER_BOULDER_END=2630;
const openingX=(s:number)=>26*Math.sin(s/72)+11*Math.sin(s/147);
const bends:[number,number][]=[[850,openingX(850)],[1050,66],[1270,28],[1460,-48],[1625,-70],
 [1830,18],[2040,65],[2260,-19],[2460,-58],[2676,8]];
const slope=(i:number)=>i===0?(openingX(850.1)-openingX(849.9))/.2:
 i===bends.length-1?(bends[i][1]-bends[i-1][1])/(bends[i][0]-bends[i-1][0]):
 (bends[i+1][1]-bends[i-1][1])/(bends[i+1][0]-bends[i-1][0]);
export function rumbleX(s:number):number {
 if(s<=850)return openingX(s);
 if(s>=RUMBLEWATER_END)return bends[bends.length-1][1]+(s-RUMBLEWATER_END)*slope(bends.length-1);
 let i=1;while(bends[i][0]<s)i++;
 const a=bends[i-1],b=bends[i],span=b[0]-a[0],t=(s-a[0])/span;
 return (2*t*t*t-3*t*t+1)*a[1]+(t*t*t-2*t*t+t)*span*slope(i-1)
   +(-2*t*t*t+3*t*t)*b[1]+(t*t*t-t*t)*span*slope(i);
}
export function rumbleHeight(s:number):number {
  return 22-8*smooth(s/310)-14*smooth((s-310)/256)-9*smooth((s-600)/242)
    -13*smooth((s-920)/516)-9*smooth((s-1600)/184)-15*smooth((s-1784)/474)
    -14*smooth((s-2258)/222)-5*smooth((s-2480)/150)
    +4*smooth((s-1436)/36)*(1-smooth((s-1570)/100))
    -.9*smooth((s-1548)/11)*(1-smooth((s-1587)/38));
}
export function rumbleTangent(s:number):Point {
  const x=(rumbleX(s+.1)-rumbleX(s-.1))/.2,len=Math.hypot(x,1);return[x/len,0,-1/len];
}
export function rumblePoint(s:number,y=rumbleHeight(s),u=0):Point {
  const d=rumbleTangent(s);return[rumbleX(s)-d[2]*u,y,-s+d[0]*u].map(round) as Point;
}
export const rumbleYaw=(s:number)=>Math.atan2(-rumbleTangent(s)[0],-rumbleTangent(s)[2])*180/Math.PI;
export function rumbleProgress(p:{x:number;z:number}|Point):number {
  const x=Array.isArray(p)?p[0]:p.x,z=Array.isArray(p)?p[2]:p.z;
  let s=-z;for(let i=0;i<4;i++){
    const dx=(rumbleX(s+.1)-rumbleX(s-.1))/.2;
    s-=((rumbleX(s)-x)*dx+s+z)/(1+dx*dx);
  }return s;
}
export const RUMBLEWATER_SECTIONS=[
  {a:0,b:136,name:'The release'},
  {a:136,b:310,name:'Two broken banks'},
  {a:310,b:566,name:'Serpent spillway'},
  {a:566,b:716,name:'High wire / low water'},
  {a:716,b:892,name:'Millrace threshold'},
  {a:892,b:1168,name:'Sluice yards · dodge and crumble'},
 {a:1168,b:1436,name:'Pendulum causeway · jump or transfer'},
 {a:1436,b:1676,name:'Broken mill roofs · offset air'},
 {a:1676,b:1784,name:'Flooded teeth · quick landings'},
 {a:1784,b:2010,name:'Quarry locks · layered slalom'},
 {a:2010,b:2258,name:'Broken aqueduct · three-rail relay'},
 {a:2258,b:2470,name:'Falling throat · pipe gauntlet'},
 {a:2470,b:2630,name:'Crown collapse · final exam'},
 {a:2630,b:2704,name:'Sanctuary leap'},
].map((s,i)=>({...s,grp:10+i}));
for(const s of RUMBLEWATER_SECTIONS)groups.push({id:s.grp,nm:s.name,editorOnly:true});
groups.push({id:1,nm:'Reverse camera / screen-relative controls',editorOnly:true});
const grp=(s:number)=>RUMBLEWATER_SECTIONS.find(t=>s<t.b)?.grp??23;
const sampler={point:rumblePoint,height:rumbleHeight};
export const RUMBLEWATER_BANKS:CreekBank[]=[];
export const RUMBLEWATER_CHECKPOINTS=RUMBLEWATER_REFUGES.map(r=>r.checkpoint);
export {RUMBLEWATER_REFUGES};
export const RUMBLEWATER_BEATS:{s:number;kind:string;name:string}[]=[];
const beat=(s:number,kind:string,name:string)=>RUMBLEWATER_BEATS.push({s,kind,name});
export const RUMBLEWATER_GAPS:{a:number;b:number;u:number;name:string}[]=[];
function bank(a:number,b:number,width:Scalar=18,offset:Scalar=0,name='Worn creek sandstone',top:Scalar=rumbleHeight){
  for(const [lo,hi]of outsideRefuges(a,b)){
    const spec:CreekBank={a:lo,b:hi,width,offset,name,group:grp(lo),top,minHalf:typeof width==='number'?width/2-.15:undefined};
    RUMBLEWATER_BANKS.push(spec);C.push(...buildCreekBank(sampler,spec),...buildCreekCollision(sampler,spec));
  }
}
function gap(a:number,b:number,u=0,w=27,name='Open water jump'){
  RUMBLEWATER_GAPS.push({a,b,u,name});beat(a,b-a>18?'crossing':'jump',name);
  C.push({t:'pit',p:rumblePoint((a+b)/2,Math.min(rumbleHeight(a),rumbleHeight(b))-5,u),s:[w,1,b-a+5],yaw:rumbleYaw((a+b)/2),invisible:true,nm:name,grp:grp(a)});
}
export const RUMBLEWATER_PIPES:{a:number;b:number;name:string;width:number;arc:number}[]=[];
function pipe(a:number,b:number,w=4.5,rise=3.5,u:Scalar=0,name='Sculpted serpent halfpipe',arc=86){
  const spans=outsideRefuges(a,b);
  if(spans.length!==1||spans[0][0]!==a||spans[0][1]!==b){for(const [lo,hi]of spans)pipe(lo,hi,w,rise,u,name,arc);return;}
  RUMBLEWATER_PIPES.push({a,b,name,width:w*2,arc});
  const p=rumblePoint(a,rumbleHeight(a),val(u,a)),pts:NonNullable<CustomComponent['pts']>=[],n=Math.ceil((b-a)/4);
  for(let i=0;i<=n;i++){const s=a+(b-a)*i/n,q=rumblePoint(s,rumbleHeight(s),val(u,s));pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);}
  C.push({t:'vertramp',p,pts,w,rise,vkind:'half',arc,arcSteps:24,curve:'corner',deck:1.1,bank:0,rails:true,hangLock:true,
    tex:'custard-sandstone',color:'#eedfc2',grp:grp(a),nm:name});
}
export const RUMBLEWATER_RAILS:{a:number;b:number;name:string}[]=[];
function rail(a:number,b:number,u:Scalar=0,lift:Scalar=.76,name='Sweeping aqueduct grind'){
  const p=rumblePoint(a,rumbleHeight(a)+val(lift,a),val(u,a)),pts:NonNullable<CustomComponent['pts']>=[],n=Math.ceil((b-a)/3);
  for(let i=0;i<=n;i++){const s=a+(b-a)*i/n,q=rumblePoint(s,rumbleHeight(s)+val(lift,s),val(u,s));pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);}
  C.push({t:'rail',p,pts,grp:grp(a),nm:name});RUMBLEWATER_RAILS.push({a,b,name});beat(a,'grind',name);
}
function fruit(a:number,b:number,u:Scalar=0,lift:Scalar=1,space=8){
  for(let s=a;s<=b;s+=space)C.push({t:'wumpa',p:rumblePoint(s,rumbleHeight(s)+val(lift,s),val(u,s)),grp:grp(s),nm:'Escape route fruit'});
}
function box(s:number,u=0,kind:CustomComponent['kind']='wood',lift=0){C.push({t:'crate',p:rumblePoint(s,rumbleHeight(s)+lift,u),kind,grp:grp(s),nm:'Rumblewater reward'});}
function takeoff(s:number,u=0,width=9,guide=true){
  for(const side of [-1,1])C.push({t:'decor',dkind:'coastpillar',p:rumblePoint(s-2,rumbleHeight(s)-.2,u+side*(width/2+1.2)),
    s:[.62,1.95,.52],yaw:rumbleYaw(s),scenerySolid:true,color:'#ead9b0',grp:grp(s),nm:'Paired takeoff markers'});
  if(guide){fruit(s-14,s-2,u,1,4);fruit(s+4,s+4,u,2.5);}
}

// Opening sightline: the enormous stone is visible behind a supported start.
// First leap previews the same paired stone markers used throughout the run.
bank(-62,86,18);gap(86,95);bank(95,136,18);takeoff(86,0,18);
fruit(12,70,0);box(35,4,'mask');box(56,-4);box(60,-4);box(110,3,'mystery');
C.push({t:'clock',p:rumblePoint(2,rumbleHeight(2),5),nm:'Rumblewater time trial'});


// First fork: two jumps on the wide left bank, or a faster long curved grind
// on the right. Both merge on a broad arrival; neither is a cosmetic branch.
const fork=(s:number)=>smooth((s-136)/24)*(1-smooth((s-278)/32));
for(const [a,b] of [[136,190],[198,248],[256,310]])bank(a,b,7,s=>-7*fork(s),'Jumping inner bank');
for(const [a,b] of [[136,174],[280,310]])bank(a,b,7,s=>7*fork(s),'Aqueduct approach and landing');
gap(190,198,-7,9,'First inner-bank jump');gap(248,256,-7,9,'Second inner-bank jump');gap(174,280,7,10,'Broken outer aqueduct');
rail(159,294,s=>7*fork(s),s=>.76+2*Math.sin(Math.PI*(s-159)/135),'Outer aqueduct / fast route');
takeoff(190,-7,7);takeoff(248,-7,7);fruit(145,180,s=>-7*fork(s));fruit(204,240,-7);fruit(265,298,s=>-7*fork(s));
fruit(171,282,s=>7*fork(s),s=>1.8+2*Math.sin(Math.PI*(s-159)/135));box(225,-7,'life');
bank(308,324,18);

// Most of the middle course is genuinely rideable curved transition geometry.
// An open centre gives time to carve; the low reward arcs encourage wall use.
pipe(323,470);gap(470,479);pipe(479,566);takeoff(470,0,15);
fruit(336,448,s=>2.8*Math.sin((s-336)/28));fruit(493,553,s=>-2.6*Math.sin((s-493)/23));
rail(349,436,s=>-6.4+1.0*Math.sin((s-349)*Math.PI/87),3.15,'Serpent outside coping');
for(const [s,u] of [[364,2.5],[406,-2],[452,3],[510,-2],[545,2.6]])box(s,u);

// Second fork. A lower twisting pipe with an 8m leap and an elevated ruin
// shelf/rail route remain simultaneously visible from the same forward camera.
bank(564,616,22);
const low=(s:number)=>-7.2*smooth((s-584)/24)*(1-smooth((s-687)/29));
pipe(612,624,2.6,2.4,low,'Lower snake / entry');gap(624,632,-7.2,9,'Lower snake jump');pipe(632,714,2.6,2.4,low,'Lower snake / return');
const high=(s:number)=>7*smooth((s-584)/24)*(1-smooth((s-687)/29));
const highLift=(s:number)=>3*smooth((s-584)/28)*(1-smooth((s-675)/41));
bank(584,621,6,high,'Rising mill shelf',s=>rumbleHeight(s)+highLift(s));
bank(660,716,6,high,'High mill receiver',s=>rumbleHeight(s)+highLift(s));
rail(608,678,high,s=>highLift(s)+.72,'High mill rail / alternate route');gap(621,660,7,9,'High mill broken span');
fruit(596,620,low);fruit(640,710,low);fruit(615,670,high,s=>highLift(s)+1.7);takeoff(624,-7.2,5.2);
box(663,high(663),'life',highLift(663));

// The old finale becomes the threshold to the working mill district. Its
// generous early jump remains a teaching beat; the chase continues downstream.
bank(714,761,22);box(748,4,'mask');
pipe(759,842,4.6,3.7,0,'First thunder chute');rail(770,831,s=>3.4-5.8*smooth((s-780)/42),.76,'Threshold diagonal grind');
fruit(772,824,s=>-2.7*Math.sin((s-772)/21));gap(842,853,0,32,'Millrace threshold leap');takeoff(842,0,17);
bank(853,894,18,0,'Millrace arrival');fruit(859,884,0,1,5);

buildRumblewaterDownstream(C,{point:rumblePoint,height:rumbleHeight,yaw:rumbleYaw,grp,bank,gap,pipe,rail,fruit,box,takeoff,beat});
groups.push(...RUMBLEWATER_REFUGE_GROUPS);
buildRumblewaterRefuges(C,sampler,rumbleYaw,RUMBLEWATER_BANKS);
C.push({t:'gate',p:rumblePoint(RUMBLEWATER_END),yaw:rumbleYaw(RUMBLEWATER_END),nm:'Rumblewater sanctuary'});

// Camera/input spine points back up-course: DOWN escapes toward the lens and
// LEFT/RIGHT remain screen-relative. Branches share this stable local frame.
for(let s=RUMBLEWATER_END+44;s>=-64;s-=8)C.push({t:'camnode',p:rumblePoint(s),grp:1,nm:'Camera-facing escape frame'});
C.push({t:'pit',p:[0,-82,-RUMBLEWATER_END/2],s:[360,1,RUMBLEWATER_END+180],invisible:true,nm:'Gorge water reset'});
groups.push(...RUMBLEWATER_ART_GROUPS);
C.push(...rumblewaterArt(sampler,RUMBLEWATER_BANKS,rumbleYaw,RUMBLEWATER_END,RUMBLEWATER_CHECKPOINTS));
export const RUMBLEWATER_RUN_LEVEL:CustomLevelData={v:1,name:'Rumblewater Run',spawn:rumblePoint(0,22.12),startWarpPad:false,
  killY:-96,sky:'carlisle',keepPlayFog:true,cameraAirLift:1,medalTimes:{gold:118,silver:146,bronze:180},groups,components:C,
  boulderChase:{path:Array.from({length:673},(_,i)=>rumblePoint(-58+(RUMBLEWATER_BOULDER_END+58)*i/672)),radius:8.2,speed:12,headStart:27,shelters:RUMBLEWATER_REFUGES.map(r=>({entry:rumblePoint(r.entry),exit:rumblePoint(r.exit)}))},
  atmosphere:{fogEnabled:true,fogNear:75,fogFar:205,fogColor:'#c8c5a8',ambientSky:'#f2e4c8',ambientGround:'#7a8570',ambientIntensity:2.2,
    sunColor:'#fff0c9',sunIntensity:2.4,fillColor:'#abc5bf',fillIntensity:.8,drawDistance:250,shadowStrength:.6},
};

const measure=(f:(s:number)=>number,end:number)=>{let length=0;for(let s=0;s<end;s+=.5)length+=Math.hypot(.5,f(s+.5)-f(s));return length;};
export const RUMBLEWATER_LENGTH=measure(rumbleX,RUMBLEWATER_END);
export const RUMBLEWATER_ORIGINAL_LENGTH=measure(openingX,892);
export const RUMBLEWATER_DIFFICULTY=[0,1,2].map(act=>({act:act+1,a:act*892,b:(act+1)*892,
 beats:RUMBLEWATER_BEATS.filter(v=>v.s>=act*892&&v.s<(act+1)*892),
 obstacles:C.filter(c=>(['crusher','pendulum','stone'].includes(c.t)||c.t==='crate'&&['metal','nitro'].includes(c.kind??''))&&c.grp!<=(act===0?14:act===1?18:22)&&c.grp!>=(act===0?10:act===1?15:19)).length}));
