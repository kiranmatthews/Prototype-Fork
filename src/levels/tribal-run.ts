import type {CustomComponent,CustomGroup,CustomLevelData} from '../level';
import {dressTribalRun} from './tribal-run-art';
import {tribalPoint as point,tribalYaw as yaw,tribalRibbon,tribalMix as mix,tribalSmooth as smooth,tribalValue,
 type TribalScalar,TRIBAL_RUN_LENGTH} from './tribal-run-route';
export {tribalPoint,tribalTangent,tribalYaw,tribalProgress,TRIBAL_RUN_LENGTH} from './tribal-run-route';

const C:CustomComponent[]=[];
export const TRIBAL_RUN_SECTIONS=[
 {a:0,b:260,name:'Gathering Ground',verb:'Pump the first beat'},
 {a:260,b:530,name:'Offbeat Steps',verb:'Hop across the drum crowns'},
 {a:530,b:830,name:'Crescent Basins',verb:'Carve the two sweeping bowls'},
 {a:830,b:1110,name:'Great Drum Court',verb:'Explore the high and low terraces'},
 {a:1110,b:1390,name:'Canopy Loom',verb:'Choose a woven line'},
 {a:1390,b:1660,name:'Sunken Stair',verb:'Climb, commit, then drop in'},
 {a:1660,b:2010,name:'Echo Bowls',verb:'Pump through the hanging beaters'},
 {a:2010,b:2330,name:'Last Chorus',verb:'Bring the rhythm home'},
].map((s,i)=>({...s,grp:10+i}));
const groups:CustomGroup[]=TRIBAL_RUN_SECTIONS.map(s=>({id:s.grp,nm:s.name,editorOnly:true}));
groups.push({id:1,nm:'Ordered course camera',editorOnly:true},{id:2,nm:'Visible basin and reset floor',editorOnly:true});
const group=(s:number)=>TRIBAL_RUN_SECTIONS.find(q=>s>=q.a&&s<q.b)?.grp??17;
export const TRIBAL_RUN_ROADS:{a:number;b:number;top:TribalScalar;width:TribalScalar;offset:TribalScalar;name:string}[]=[];
export const TRIBAL_RUN_GAPS:{a:number;b:number;top:number;u:number;name:string}[]=[];
export const TRIBAL_RUN_STEPS:{a:number;b:number;top:number;u:number;name:string}[]=[];
export const TRIBAL_RUN_CHECKPOINTS:{s:number;y:number;u:number;name:string}[]=[];
const road=(a:number,b:number,top:TribalScalar=0,width:TribalScalar=12,offset:TribalScalar=0,name='Carving causeway',depth=5)=>{
 C.push(...tribalRibbon(a,b,top,width,offset,group(a),name,undefined,depth));TRIBAL_RUN_ROADS.push({a,b,top,width,offset,name});
};
const grade=(a:number,b:number,ya:number,yb:number)=>(s:number)=>mix(ya,yb,smooth((s-a)/(b-a)));
const gap=(a:number,b:number,top:number,u:TribalScalar=0,name='Read the open water')=>{
 TRIBAL_RUN_GAPS.push({a,b,top,u:tribalValue(u,(a+b)/2),name});
 for(const s of [a-5,a-1,(a+b)/2,b+1])C.push({t:'wumpa',p:point(s,top+1+Math.sin((s-a+5)/(b-a+6)*Math.PI)*1.4,tribalValue(u,s)),grp:group(a),nm:name+' · jump arc'});
};
const crate=(s:number,y:number,u=0,kind:CustomComponent['kind']='wood',name='Drum-road offering')=>
 C.push({t:'crate',p:point(s,y,u),kind,grp:group(s),nm:name});
const cp=(s:number,y:number,u=0)=>{
 const name=TRIBAL_RUN_SECTIONS.find(q=>s>=q.a&&s<q.b)?.name+' · safe restart';
 C.push({t:'checkpoint',p:point(s,y,u),grp:group(s),nm:name});TRIBAL_RUN_CHECKPOINTS.push({s,y,u,name});
};
const rail=(a:number,b:number,y:TribalScalar,u:TribalScalar,name:string)=>{
 const p=point(a,tribalValue(y,a),tribalValue(u,a)),n=Math.ceil((b-a)/4);
 C.push({t:'rail',p,pts:Array.from({length:n+1},(_,i)=>{const s=mix(a,b,i/n),q=point(s,tribalValue(y,s),tribalValue(u,s));return[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]];}),color:'#e2c477',grp:group(a),nm:name});
 for(const s of [a-7,a-3,a+4])C.push({t:'wumpa',p:point(s,tribalValue(y,s)+1,tribalValue(u,s)),grp:group(a),nm:name+' · entry arc'});
};
const steps=(specs:[number,number,number,number][],name:string)=>{
 for(const [a,b,top,u]of specs){
  // The crowns swell into broad drum shapes while retaining nine-metre
  // takeoff/landing aprons. The curved shoulders reward a carving approach.
  road(a,b,top,s=>9+4*Math.sin(Math.PI*Math.max(0,Math.min(1,(s-a)/(b-a))))**.7,u,name);TRIBAL_RUN_STEPS.push({a,b,top,u,name});
  C.push({t:'wumpa',p:point((a+b)/2,top+1,u),grp:group(a),nm:name+' · landing centre'});
 }
};
const bowl=(a:number,b:number,y:TribalScalar,name:string)=>{
 const p=point(a,tribalValue(y,a)),n=Math.ceil((b-a)/8);
 C.push({t:'vertramp',p,pts:Array.from({length:n+1},(_,i)=>{const s=mix(a,b,i/n),q=point(s,tribalValue(y,s));return[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]];}),
  vkind:'half',w:4.4,rise:3.5,arc:56,deck:1.8,vert:false,bank:0,curve:'corner',tex:'solid',color:'#bbc4c7',grp:group(a),nm:name});
};

// 01. Safe rolls teach the level's cadence before the first six-metre hop.
const firstBeat=(s:number)=>s<56||s>142?0:1.35*Math.sin((s-56)/86*Math.PI*2);
road(-18,176,firstBeat,14,0,'Gathering ground · two gentle drum rolls');
road(182,311,0,12);gap(176,182,0,0,'First beat · six-metre hop');
for(const [s,u]of [[28,-3],[42,2],[59,-2],[102,3],[131,-3],[209,2],[229,-2]])crate(s,firstBeat(s),u);
crate(70,firstBeat(70),-4.5,'mask','First-beat safety mask');
C.push({t:'clock',p:point(9,0,4.5),grp:10,nm:'Optional time trial'});cp(250,0);

// 02. Four offset drum crowns. A lower landing catches the first lesson;
// its longer exit climbs back to the road. The high rail rewards commitment.
road(310,391,-4.5,25,0,'Offbeat recovery court');road(391,480,grade(391,480,-4.5,0),22,0,'Recovery court exit');
road(480,508,0,s=>mix(22,14,smooth((s-480)/28)),0,'Recovery lane rejoins the procession');
steps([[313,326.8,1.1,-2.7],[329,342.8,2.2,2.7],[345,358.8,3.3,-2.7],[361,378.8,4.4,2.7]],'Offbeat drum crown');
road(381,413,4.4,12,0,'Drum-crown reunion');road(413,480,grade(413,480,4.4,0),12);road(480,540,0,14);
rail(299,424,s=>s<313?mix(.75,2,(s-299)/14):s<345?mix(2,4.1,(s-313)/32):s<361?mix(4.1,5.15,(s-345)/16):grade(413,480,4.4,0)(s)+.75,-4,'Optional offbeat outside grind');
for(const [s,y,u]of [[319,1.1,-2.7],[335,2.2,2.7],[351,3.3,-2.7],[371,4.4,2.7],[398,4.4,3],[452,grade(413,480,4.4,0)(452),-3],[501,0,3]])crate(s,y,u);
cp(518,0);

// 03. Wide shallow bowls can be pumped on a board or crossed on foot.
bowl(540,670,grade(540,620,0,-3),'First crescent basin');
road(668,676,-3,13);gap(676,683,-3,0,'Crescent lip transfer');
road(683,696,-3,13);bowl(694,810,grade(735,810,-3,0),'Returning crescent basin');road(808,913,0,s=>mix(15,28,smooth((s-890)/23)));
for(const s of [555,600,643,713,770,790,852,879])crate(s,s<670?grade(540,620,0,-3)(s):s<810?grade(735,810,-3,0)(s):0,0);
rail(709,794,s=>tribalValue(grade(735,810,-3,0),s)+1.05,5.8,'Crescent rim reward line');cp(824,0);

// 04. Small terraces above an uninterrupted plaza let the player set their
// own pace; a raised side stage holds the bonus entrance and a clear return.
road(913,1080,0,28,0,'Great Drum Court lower plaza');
steps([[917,932,1.1,-4],[934,950,2.2,3.5],[952,970,3.3,-3]],'Great Drum Court optional crowns');
road(970,1000,3.3,8,-3,'Great Drum Court upper gallery');road(1000,1044,grade(1000,1044,3.3,0),8,-3);
for(const [s,y,u]of [[923,1.1,-4],[942,2.2,3.5],[960,3.3,-3],[989,3.3,-4],[1005,0,5],[1028,0,5],[1058,0,-4]])crate(s,y,u);
C.push({t:'bonusplatform',p:point(986,0,7.5),to:point(1002,.12,7.5),grp:13,nm:'The Resonance Vault entrance'});
road(1080,1110,0,15);cp(1088,0);

// 05. The two causeways exchange sides above and below one another. A thin
// upper deck leaves 6.4 metres of real headroom at the crossing, including the
// ordinary follow camera. Its longer
// gap is the faster line; the lower ribbon keeps the easier five-metre hop.
export const tribalBraid=(side:number)=>(s:number)=>side*5.2*smooth((s-1110)/28)*Math.cos(Math.PI*smooth((s-1178)/64))*(1-smooth((s-1250)/30));
const braid=tribalBraid;
// Separate before rising, and touch down before merging: the low route never
// has to pass through a descending deck's solid edge.
export const tribalLoomHeight=(s:number)=>7.2*smooth((s-1120)/35)*(1-smooth((s-1240)/24));
const high=tribalLoomHeight;
road(1110,1162,high,6.8,braid(-1),'Canopy loom upper ribbon',.8);road(1170,1280,high,6.8,braid(-1),'Canopy loom upper receiver',.8);gap(1162,1170,7.2,braid(-1),'Upper woven leap');
road(1110,1245,0,7.4,braid(1),'Canopy loom lower ribbon');road(1250,1280,0,7.4,braid(1),'Canopy loom lower receiver');gap(1245,1250,0,braid(1),'Lower woven hop');
// Carry the grind down to the flat reunion so its dismount does not throw the
// player into the steepening return deck or catch a second edge accidentally.
rail(1145,1290,s=>high(s)+.85,s=>braid(-1)(s)-2.4,'Canopy loom stitch grind');
for(const s of [1138,1154,1208,1258]){crate(s,high(s),braid(-1)(s));crate(s,0,braid(1)(s));}
road(1280,1422,0,13,0,'Loom reunion and stair approach');crate(1318,0,-3);crate(1353,0,3);cp(1380,0);

// 06. The main climb uses comfortable one-jump rises, then a short crumble
// crossing pays the height back as a long, supported skating descent.
steps([[1424,1439.8,1.2,-2.4],[1442,1457.8,2.4,2.4],[1460,1475.8,3.6,-2.4],[1478,1495.8,4.8,2.4]],'Sunken stair drum');
road(1498,1540,4.8,12,0,'Sunken stair summit');
for(let i=0;i<4;i++){const s=1541.75+i*3.5;C.push({t:'crumble',p:point(s,4.8),s:[11,.65,3.56],yaw:yaw(s),shake:1.15,speed:18,tex:'solid',color:'#cfb37e',grp:15,nm:'Sunken stair falling beat '+(i+1)});}
road(1554,1585,4.8,13);road(1585,1644,grade(1585,1644,4.8,-1),14,0,'Long celebratory drop-in');road(1644,1700,-1,15);
for(const [s,y,u]of [[1432,1.2,-2.4],[1450,2.4,2.4],[1468,3.6,-2.4],[1486,4.8,2.4],[1515,4.8,-3],[1570,4.8,3]])crate(s,y,u);
cp(1508,4.8,0);cp(1650,-1);

// 07. Broad rollers and pendulums encourage lateral carving. All swing
// lanes have a dry outside shoulder; no timing gate forces the player to wait.
const echo=(s:number)=>-1+2.2*Math.sin(Math.max(0,Math.min(1,(s-1700)/280))*Math.PI*4)**2;
road(1700,1980,echo,15,0,'Echo bowls · four rounded rollers');road(1980,2071,-1,14);
for(const [s,u,phase]of [[1764,-2.3,.3],[1885,2.3,1.9]])C.push({t:'pendulum',p:point(s,echo(s)+8,u),len:7,amp:.6,speed:1.35,phase,grp:16,nm:'Hanging drum beater · open outside shoulder'});
for(const s of [1718,1744,1798,1833,1915,1948])crate(s,echo(s),s%2?-3.5:3.5);
rail(1822,1924,s=>echo(s)+1.2,-6.2,'Echo upper rhythm grind');cp(1994,-1);

// 08. The final short call-and-response repeats familiar low rises, then
// ends with one generous eight-metre skating jump and a broad finish court.
steps([[2073,2086.8,.1,-2.2],[2089,2102.8,1.2,2.2],[2105,2122.8,2.3,-2.2]],'Last chorus drum');
road(2125,2160,2.3,12);road(2160,2210,grade(2160,2210,2.3,0),14);road(2210,2235,0,14);
gap(2235,2243,0,0,'Last chorus flight');road(2243,2334,0,17,0,'Festival arrival court');
for(const [s,y,u]of [[2080,.1,-2.2],[2096,1.2,2.2],[2113,2.3,-2.2],[2148,2.3,3],[2198,grade(2160,2210,2.3,0)(2198),-3],[2268,0,3],[2280,0,-3]])crate(s,y,u);
cp(2218,0,0);C.push({t:'crystal',p:point(2289,1.1),grp:17,nm:'The festival crystal'},{t:'gate',p:point(2310,0),yaw:yaw(2310),grp:17,nm:'Tribal Run finish'});

// A single low reset plane leaves every deliberate gap genuinely open.
const all=Array.from({length:117},(_,i)=>point(i*20)),xs=all.map(p=>p[0]),zs=all.map(p=>p[2]);
const minX=Math.min(...xs)-45,maxX=Math.max(...xs)+45,minZ=Math.min(...zs)-45,maxZ=Math.max(...zs)+45;
C.push({t:'pit',p:[(minX+maxX)/2,-11,(minZ+maxZ)/2],s:[maxX-minX,1,maxZ-minZ],color:'#667f87',grp:2,nm:'Greybox basin · visible fall-reset plane'});
for(let s=-18;s<=TRIBAL_RUN_LENGTH+20;s+=8)C.push({t:'camnode',p:point(s,.8),grp:1,nm:'Ordered drum-road camera'});
export const TRIBAL_RUN_LEVEL:CustomLevelData={v:1,name:'Tribal Run',spawn:point(0,.12),startWarpPad:false,killY:-24,fallRecoveryDrop:15,
 sky:'day',cameraAirLift:.65,cameraLookAhead:7,medalTimes:{gold:185,silver:225,bronze:280},
 atmosphere:{fogEnabled:true,fogNear:70,fogFar:240,fogColor:'#c1ccd1',ambientSky:'#e5edef',ambientGround:'#8b8f91',ambientIntensity:1.6,
 sunColor:'#fff1db',sunIntensity:1.8,fillIntensity:.55,drawDistance:300,shadowStrength:.6},
 groups,components:C};
dressTribalRun(TRIBAL_RUN_LEVEL,{roads:TRIBAL_RUN_ROADS,steps:TRIBAL_RUN_STEPS,checkpoints:TRIBAL_RUN_CHECKPOINTS});
