import type {CustomComponent,CustomGroup,CustomLevelData} from '../level';
import {rumblewaterArt,RUMBLEWATER_ART_GROUPS} from './rumblewater-art';
import {buildCreekBank,buildCreekCollision,type CreekBank} from './custard-terrain';

type Point=[number,number,number];
type Scalar=number|((s:number)=>number);
const C:CustomComponent[]=[],groups:CustomGroup[]=[];
const val=(n:Scalar,s:number)=>typeof n==='function'?n(s):n;
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const round=(n:number)=>Math.round(n*10000)/10000;
export const RUMBLEWATER_END=892;
export const RUMBLEWATER_BOULDER_END=842;
export const rumbleX=(s:number)=>26*Math.sin(s/72)+11*Math.sin(s/147);
export function rumbleHeight(s:number):number {
  return 22-8*smooth(s/310)-14*smooth((s-310)/256)-9*smooth((s-600)/242);
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
  {a:716,b:842,name:'Last rumble'},
  {a:842,b:920,name:'Sanctuary leap'},
].map((s,i)=>({...s,grp:10+i}));
for(const s of RUMBLEWATER_SECTIONS)groups.push({id:s.grp,nm:s.name,editorOnly:true});
groups.push({id:1,nm:'Reverse camera / screen-relative controls',editorOnly:true});
const grp=(s:number)=>RUMBLEWATER_SECTIONS.find(t=>s<t.b)?.grp??15;
const sampler={point:rumblePoint,height:rumbleHeight};
export const RUMBLEWATER_BANKS:CreekBank[]=[];
export const RUMBLEWATER_GAPS:{a:number;b:number;u:number;name:string}[]=[];
function bank(a:number,b:number,width:Scalar=18,offset:Scalar=0,name='Worn creek sandstone',top:Scalar=rumbleHeight){
  const spec:CreekBank={a,b,width,offset,name,group:grp(a),top,minHalf:typeof width==='number'?width/2-.15:undefined};
  RUMBLEWATER_BANKS.push(spec);C.push(...buildCreekBank(sampler,spec),...buildCreekCollision(sampler,spec));
}
function gap(a:number,b:number,u=0,w=27,name='Open water jump'){
  RUMBLEWATER_GAPS.push({a,b,u,name});
  C.push({t:'pit',p:rumblePoint((a+b)/2,Math.min(rumbleHeight(a),rumbleHeight(b))-5,u),s:[w,1,b-a+5],yaw:rumbleYaw((a+b)/2),invisible:true,nm:name,grp:grp(a)});
}
function pipe(a:number,b:number,w=4.5,rise=3.5,u:Scalar=0,name='Sculpted serpent halfpipe'){
  const p=rumblePoint(a,rumbleHeight(a),val(u,a)),pts:NonNullable<CustomComponent['pts']>=[],n=Math.ceil((b-a)/4);
  for(let i=0;i<=n;i++){const s=a+(b-a)*i/n,q=rumblePoint(s,rumbleHeight(s),val(u,s));pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);}
  C.push({t:'vertramp',p,pts,w,rise,vkind:'half',arc:86,arcSteps:24,curve:'corner',deck:1.1,bank:0,rails:true,hangLock:true,
    tex:'custard-sandstone',color:'#eedfc2',grp:grp(a),nm:name});
}
export const RUMBLEWATER_RAILS:{a:number;b:number;name:string}[]=[];
function rail(a:number,b:number,u:Scalar=0,lift:Scalar=.76,name='Sweeping aqueduct grind'){
  const p=rumblePoint(a,rumbleHeight(a)+val(lift,a),val(u,a)),pts:NonNullable<CustomComponent['pts']>=[],n=Math.ceil((b-a)/3);
  for(let i=0;i<=n;i++){const s=a+(b-a)*i/n,q=rumblePoint(s,rumbleHeight(s)+val(lift,s),val(u,s));pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);}
  C.push({t:'rail',p,pts,grp:grp(a),nm:name});RUMBLEWATER_RAILS.push({a,b,name});
}
function fruit(a:number,b:number,u:Scalar=0,lift:Scalar=1,space=8){
  for(let s=a;s<=b;s+=space)C.push({t:'wumpa',p:rumblePoint(s,rumbleHeight(s)+val(lift,s),val(u,s)),grp:grp(s),nm:'Escape route fruit'});
}
function box(s:number,u=0,kind:CustomComponent['kind']='wood',lift=0){C.push({t:'crate',p:rumblePoint(s,rumbleHeight(s)+lift,u),kind,grp:grp(s),nm:'Rumblewater reward'});}
function cp(s:number){C.push({t:'checkpoint',p:rumblePoint(s),grp:grp(s),nm:'Rumblewater fresh head start'});}
function takeoff(s:number,u=0,width=9){
  for(const side of [-1,1])C.push({t:'decor',dkind:'coastpillar',p:rumblePoint(s-2,rumbleHeight(s)-.2,u+side*(width/2+1.2)),
    s:[.62,1.95,.52],yaw:rumbleYaw(s),scenerySolid:true,color:'#ead9b0',grp:grp(s),nm:'Paired takeoff markers'});
  fruit(s-14,s-2,u,1,4);fruit(s+4,s+4,u,2.5);
}

// Opening sightline: the enormous stone is visible behind a supported start.
// First leap previews the same paired stone markers used throughout the run.
bank(-62,86,18);gap(86,95);bank(95,136,18);takeoff(86,0,18);
fruit(12,70,0);box(35,4,'mask');box(56,-4);box(60,-4);box(110,3,'mystery');
C.push({t:'clock',p:rumblePoint(2,rumbleHeight(2),5),nm:'Rumblewater time trial'});
cp(121);

// First fork: two jumps on the wide left bank, or a faster long curved grind
// on the right. Both merge on a broad arrival; neither is a cosmetic branch.
const fork=(s:number)=>smooth((s-136)/24)*(1-smooth((s-278)/32));
for(const [a,b] of [[136,190],[198,248],[256,310]])bank(a,b,7,s=>-7*fork(s),'Jumping inner bank');
for(const [a,b] of [[136,174],[280,310]])bank(a,b,7,s=>7*fork(s),'Aqueduct approach and landing');
gap(190,198,-7,9,'First inner-bank jump');gap(248,256,-7,9,'Second inner-bank jump');gap(174,280,7,10,'Broken outer aqueduct');
rail(159,294,s=>7*fork(s),s=>.76+2*Math.sin(Math.PI*(s-159)/135),'Outer aqueduct / fast route');
takeoff(190,-7,7);takeoff(248,-7,7);fruit(145,180,s=>-7*fork(s));fruit(204,240,-7);fruit(265,298,s=>-7*fork(s));
fruit(171,282,s=>7*fork(s),s=>1.8+2*Math.sin(Math.PI*(s-159)/135));box(225,-7,'life');
bank(308,324,18);cp(316);

// Most of the middle course is genuinely rideable curved transition geometry.
// An open centre gives time to carve; the low reward arcs encourage wall use.
pipe(323,470);gap(470,479);pipe(479,566);takeoff(470,0,15);
fruit(336,448,s=>2.8*Math.sin((s-336)/28));fruit(493,553,s=>-2.6*Math.sin((s-493)/23));
rail(349,436,s=>-6.4+1.0*Math.sin((s-349)*Math.PI/87),3.15,'Serpent outside coping');
for(const [s,u] of [[364,2.5],[406,-2],[452,3],[510,-2],[545,2.6]])box(s,u);

// Second fork. A lower twisting pipe with an 8m leap and an elevated ruin
// shelf/rail route remain simultaneously visible from the same forward camera.
bank(564,616,22);cp(578);
const low=(s:number)=>-7.2*smooth((s-584)/24)*(1-smooth((s-687)/29));
pipe(612,624,2.6,2.4,low,'Lower snake / entry');gap(624,632,-7.2,9,'Lower snake jump');pipe(632,714,2.6,2.4,low,'Lower snake / return');
const high=(s:number)=>7*smooth((s-584)/24)*(1-smooth((s-687)/29));
const highLift=(s:number)=>3*smooth((s-584)/28)*(1-smooth((s-675)/41));
bank(584,621,6,high,'Rising mill shelf',s=>rumbleHeight(s)+highLift(s));
bank(660,716,6,high,'High mill receiver',s=>rumbleHeight(s)+highLift(s));
rail(608,678,high,s=>highLift(s)+.72,'High mill rail / alternate route');gap(621,660,7,9,'High mill broken span');
fruit(596,620,low);fruit(640,710,low);fruit(615,670,high,s=>highLift(s)+1.7);takeoff(624,-7.2,5.2);
C.push({t:'crystal',p:rumblePoint(663,rumbleHeight(663)+highLift(663)+1.35,high(663)),nm:'High-wire crystal'});

// Last push: a broad restart then the deepest, fastest pipe. Its low diagonal
// rail is optional; the final gap has a wider, lower receiver and clear gate.
bank(714,761,22);cp(739);box(748,4,'mask');
pipe(759,842,4.6,3.7,0,'Final thunder chute');rail(770,831,s=>3.4-5.8*smooth((s-780)/42),.76,'Last-chance diagonal grind');
fruit(772,824,s=>-2.7*Math.sin((s-772)/21));gap(842,853,0,32,'Boulder-drop final leap');takeoff(842,0,17);
bank(853,920,24,0,'Sanctuary receiving island');fruit(859,884,0,1,5);
C.push({t:'gate',p:rumblePoint(RUMBLEWATER_END),yaw:rumbleYaw(RUMBLEWATER_END),nm:'Rumblewater sanctuary'});

// Camera/input spine points back up-course: DOWN escapes toward the lens and
// LEFT/RIGHT remain screen-relative. Branches share this stable local frame.
for(let s=936;s>=-64;s-=8)C.push({t:'camnode',p:rumblePoint(s),grp:1,nm:'Camera-facing escape frame'});
C.push({t:'pit',p:[0,-20,-450],s:[200,1,1100],invisible:true,nm:'Gorge water reset'});
groups.push(...RUMBLEWATER_ART_GROUPS);
C.push(...rumblewaterArt(sampler,RUMBLEWATER_BANKS,rumbleYaw));
export const RUMBLEWATER_RUN_LEVEL:CustomLevelData={v:1,name:'Rumblewater Run',spawn:rumblePoint(0,22.12),startWarpPad:false,
  killY:-34,sky:'carlisle',keepPlayFog:true,cameraAirLift:1,medalTimes:{gold:42,silver:55,bronze:75},groups,components:C,
  boulderChase:{path:Array.from({length:226},(_,i)=>rumblePoint(-58+900*i/225)),radius:8.2,speed:12,headStart:27},
  atmosphere:{fogEnabled:true,fogNear:75,fogFar:205,fogColor:'#c8c5a8',ambientSky:'#f2e4c8',ambientGround:'#7a8570',ambientIntensity:2.2,
    sunColor:'#fff0c9',sunIntensity:2.4,fillColor:'#abc5bf',fillIntensity:.8,drawDistance:250,shadowStrength:.6},
};
