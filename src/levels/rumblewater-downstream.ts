import type {CustomComponent} from '../level';
type P=[number,number,number];
type Scalar=number|((s:number)=>number);
interface Course {
 point(s:number,y?:number,u?:number):P;height(s:number):number;yaw(s:number):number;grp(s:number):number;
 bank(a:number,b:number,width?:Scalar,offset?:Scalar,name?:string,top?:Scalar):void;
 gap(a:number,b:number,u?:number,w?:number,name?:string):void;
 pipe(a:number,b:number,w?:number,rise?:number,u?:Scalar,name?:string,arc?:number):void;
 rail(a:number,b:number,u?:Scalar,lift?:Scalar,name?:string):void;
 fruit(a:number,b:number,u?:Scalar,lift?:Scalar,space?:number):void;
 box(s:number,u?:number,kind?:CustomComponent['kind'],lift?:number):void;
 takeoff(s:number,u?:number,width?:number,guide?:boolean):void;
 beat(s:number,kind:string,name:string):void;
}
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*smooth(t);
const at=(v:Scalar,s:number)=>typeof v==='function'?v(s):v;

/** Two authored downstream acts. Each room introduces a new decision before
 * the last act combines timing, lane changes, air and balance at shorter intervals. */
export function buildRumblewaterDownstream(C:CustomComponent[],k:Course):void {
 const {point:p,height:h,yaw,grp,bank,gap,pipe,rail,fruit,box,takeoff,beat}=k;
 const crusher=(s:number,u:number,w=5.2,phase=0)=>{
  C.push({t:'crusher',p:p(s,h(s),u),s:[w,3.2,5.2],cycle:3.5,phase,dkind:'custardboulder',grp:grp(s),nm:'Mill sluice stamping stone'});
  beat(s,'crusher','Moving sluice stone');
 };
 const pendulum=(s:number,u:number,phase=0)=>{
  C.push({t:'pendulum',p:p(s,h(s)+6.1,u),len:5.8,amp:.92,speed:1.7,phase,yaw:yaw(s),tex:'coast-timber',grp:grp(s),nm:'Swinging mill counterweight'});
  beat(s,'swing','Swinging counterweight');
 };
 const barrier=(s:number,u:number,kind:CustomComponent['kind']='metal',width=5,layers=2)=>{
  for(let row=0;row<layers;row++)for(let i=0;i<width;i++)box(s,u+(i-(width-1)/2)*.96,kind,row*.96);
  beat(s,kind==='wood'?'break':kind==='nitro'?'nitro':'slalom',kind==='wood'?'Breakable barricade':kind==='nitro'?'Nitro lane':'Stone-filled metal barricade');
 };
 const crumble=(a:number,b:number,w:number,u:Scalar=0,name='Collapsing mill timber')=>{
  const n=Math.ceil((b-a)/4.6),span=(b-a)/n;
  for(let i=0;i<n;i++){const s=a+(i+.5)*span;C.push({t:'crumble',p:p(s,h(s),at(u,s)),s:[w,.75,span+.15],yaw:yaw(s),shake:.7,speed:30,tex:'bridge-timber',grp:grp(s),nm:name});}
  beat(a,'crumble',name);
 };
 const crossStone=(s:number,u:number,range=3.2)=>{
  const d=(p(s+1)[0]-p(s-1)[0])/2;
  C.push({t:'stone',p:p(s,h(s),u),axis:Math.abs(d)<1?'x':'z',range,speed:4.8,radius:1.15,grp:grp(s),nm:'Quarry cross-rolling stone'});
  beat(s,'rolling','Cross-rolling quarry stone');
 };

 // 6. SLUICE YARDS: alternate around stamping stones, commit to a collapsing
 // crossing, then carry the same left/right reading into the pipe's low teeth.
 pipe(892,1028,5.5,2.4,0,'Broad working sluice canal',70);crusher(924,-3,6.4);crusher(978,3,6.4,.52);
 barrier(1006,-3,'wood',4,2);fruit(898,945,4.6,1,7);fruit(950,995,-4.8,1,7);
 gap(1028,1054,0,27,'Collapsed sluice bridge');crumble(1028,1054,8.6,0,'First falling timber bridge');
 rail(1014,1068,5.6,.8,'Sluice parapet shortcut');
 pipe(1054,1168,3.5,3.2,0,'Sluice teeth halfpipe');barrier(1089,-2.2);barrier(1127,2.2);
 fruit(1062,1080,2.3);fruit(1097,1115,-2.3);fruit(1140,1158,0);bank(1165,1193,16);

 // 7. COUNTERWEIGHT CAUSEWAY: the ground route introduces offset island
 // landings; the raised line introduces the first genuine rail-to-rail air.
 pipe(1188,1234,5.8,2.2,0,'Counterweight catch basin',70);pendulum(1210,0,0);fruit(1190,1220,5.8,1,6);
 const split=(s:number)=>smooth((s-1216)/25)*(1-smooth((s-1370)/46));
 const inner=(s:number)=>-6.1*split(s)+1.05*Math.sin((s-1230)/29)*split(s);
 for(const [a,b]of [[1227,1262],[1272,1320],[1331,1416]])bank(a,b,6.2,inner,'Counterweight stepping bank');
 gap(1262,1272,-6.1,8.2,'Causeway first offset leap');gap(1320,1331,-6.1,8.2,'Causeway returning leap');
 takeoff(1262,inner(1262),6.2);takeoff(1320,inner(1320),6.2);
 bank(1227,1247,6,s=>6*split(s),'Transfer-rail takeoff');bank(1370,1416,7,s=>6*split(s),'Transfer-rail landing');
 gap(1247,1370,6,9,'Counterweight broken high aqueduct');
 rail(1236,1293,s=>6*split(s),s=>.8+1.2*smooth((s-1236)/40),'First transfer launch');
 rail(1301,1390,s=>6*split(s),1.25,'First transfer receiver');beat(1293,'transfer','First eight-metre rail transfer');
 fruit(1240,1260,inner);fruit(1281,1311,inner);fruit(1340,1380,inner);box(1352,inner(1352),'mystery');
 bank(1412,1438,16);
 C.push({t:'bonusplatform',p:p(736,h(736),4),to:p(741,h(741)+.1),grp:111,nm:'Sheltered mill bonus'});

 // 8. MILL ROOFS: an uphill roof approach, two alternating diagonal gaps,
 // falling eaves and a sloping exit. The elevation profile is owned by the
 // common path, so the pursuing sphere rolls along the same roof grade.
 bank(1436,1502,12,0,'Rising mill roof');barrier(1468,3,'wood',3,2);fruit(1445,1488,-2.8);
 gap(1502,1513,0,26,'First broken mill roof');takeoff(1502,-1,10);
 bank(1513,1548,7.6,-4.4,'Left roof island');fruit(1518,1540,-2.5,1,6);
 gap(1548,1559,0,26,'Second diagonal roof gap');takeoff(1548,-1.4,8,false);fruit(1528,1546,s=>-4.4+(s-1534)*.24,1,4);fruit(1552,1566,s=>-1.52+(s-1546)*.24,2,4);
 bank(1559,1587,7.6,4.4,'Right roof island');fruit(1565,1581,2.5,1,5);
 gap(1587,1625,0,26,'Falling roof eaves');crumble(1587,1625,7.8,s=>2.5*(1-smooth((s-1587)/38)),'Falling mill eaves');
 bank(1625,1676,12);barrier(1647,-2.8,'nitro',2,1);fruit(1632,1666,3.1);

 // 9. FLOODED TEETH: two quicker jumps on short receiving islands instead
 // of another long open straight. Each receiver still has charging room.
 pipe(1674,1698,4.3,2.4,0,'Flooded teeth launch mouth',76);gap(1698,1708,0,24,'Flooded teeth entry jump');takeoff(1698,0,10);
 pipe(1708,1740,2.6,2.5,s=>mix(-1.5,1.5,(s-1708)/32),'Angled sluice pipe island',80);
 gap(1740,1751,0,24,'Flooded teeth exit jump');takeoff(1740,1,8);
 bank(1751,1800,14);fruit(1757,1784,0,1,6);box(1794,-4,'life');

 // 10. QUARRY LOCKS: the decisions now combine lane changes with timed hazards. Solid
 // slalom, a dangerous crate lane, moving stones and a collapsing bank mix
 // together, with a short optional grind to recover a clean line.
 pipe(1798,1864,5.2,3,0,'Quarry admission canal',80);barrier(1816,-2.2);barrier(1852,2.4,'nitro',5,1);
 pipe(1862,1928,3.5,3.2,0,'Quarry lock trough');crusher(1894,-2.4,5.8,.3);crossStone(1916,-3.5,2.4);
 fruit(1802,1816,3.9,1,6);fruit(1824,1860,-3.8,1,6);fruit(1875,1917,3.6,1,5);
 gap(1928,1940,0,26,'Quarry lock leap');takeoff(1928,2.5,10);
 bank(1940,1964,12);gap(1964,2000,0,26,'Quarry falling ledge');crumble(1964,2000,6.8,s=>1.4*Math.sin((s-1964)/11),'Quarry falling ledge');
 rail(1948,1988,3.8,.85,'Quarry outer salvage rail');bank(2000,2044,16);

 // 11. BROKEN AQUEDUCT: narrow ground islands demand three staggered leaps.
 // The other line is a three-part curved grind relay, with two airborne
 // catches. These are distinct skills; neither branch is a cosmetic detour.
 const relaySplit=(s:number)=>smooth((s-2026)/22)*(1-smooth((s-2195)/33));
 const lowBank=(s:number)=>-6.2*relaySplit(s)+1.25*Math.sin((s-2050)/24)*relaySplit(s);
 for(const [a,b]of [[2038,2076],[2087,2130],[2150,2180],[2192,2228]])bank(a,b,5.8,lowBank,'Advanced aqueduct stepping bank');
 for(const [a,b]of [[2076,2087],[2130,2150],[2180,2192]]){gap(a,b,-6.2,8.5,'Advanced staggered island jump');takeoff(a,lowBank(a),5.8);}
 for(const [a,b]of [[2044,2066],[2095,2120],[2156,2170],[2200,2220]])fruit(a,b,lowBank,1,5);
 beat(2130,'double-jump','Wide aqueduct double-jump');fruit(2133,2137,lowBank,2.2,4);fruit(2141,2153,lowBank,s=>5.2-.11*Math.abs(s-2145),4);
 bank(2034,2058,8.5,s=>6*relaySplit(s),'Three-rail admission');bank(2212,2240,8,s=>6*relaySplit(s),'Three-rail reception');
 gap(2058,2212,6,11,'Three-rail broken crescent');
 const relay=(s:number)=>6*relaySplit(s)+1.35*Math.sin((s-2040)/30)*relaySplit(s);
 rail(2036,2090,relay,s=>.8+.9*smooth((s-2036)/54),'Relay rail one');fruit(2034,2058,relay,1.8,4);
 rail(2098,2150,relay,1.25,'Relay rail two');rail(2158,2230,relay,.8,'Relay rail three');
 beat(2090,'transfer','First late relay air');beat(2150,'transfer','Second late relay air');
 C.push({t:'crystal',p:p(2209,h(2209)+1.9,relay(2209)),grp:grp(2209),nm:'Three-rail relay crystal'});
 bank(2226,2262,16);pendulum(2238,-3.6,1.2);fruit(2230,2252,4.5,1,5);

 // 12. FALLING THROAT: tight pipes combine the established slalom, a real
 // break, a stamping stone and a swinging counterweight at short intervals.
 pipe(2260,2324,3.15,3.5,0,'Narrow falling throat');barrier(2283,-2.1);barrier(2310,2.2,'wood',3,2);
 fruit(2267,2292,2.5,1,5);fruit(2298,2317,-2.2,1,5);
 gap(2324,2335,0,25,'Throat jump through the locks');takeoff(2324,0,10);
 pipe(2335,2416,3,3.5,0,'Counterweight throat');crusher(2360,2,5.4,.65);pendulum(2393,-5.5,2.1);
 fruit(2343,2371,-2.6,1,5);fruit(2380,2404,2.5,1,5);
 gap(2416,2428,0,25,'Offset throat receiver');takeoff(2416,1,9);
 pipe(2428,2472,2.8,3.2,s=>1.5*(1-smooth((s-2443)/29)),'Returning throat mouth');barrier(2451,1,'wood',3,1);
 bank(2470,2506,14);box(2494,-4,'life');

 // 13. CROWN COLLAPSE: moving diagonally across falling timber feeds a rapid
 // two-stamp chicane. Choose a final S-grind or collapsing stone run, then
 // release into the widest jump; the sphere finally loses its floor here.
 gap(2506,2542,0,25,'Crown falling switchback');crumble(2506,2542,6.6,s=>2*Math.sin((s-2506)*Math.PI/36),'Crown falling switchback');
 fruit(2508,2538,s=>2*Math.sin((s-2506)*Math.PI/36),1,5);
 pipe(2542,2578,5.5,2.3,0,'Twin-stamp crown trough',72);crusher(2549,-2.6,5.8,.15);crusher(2569,2.6,5.8,.65);
 fruit(2542,2552,3.9,1,5);fruit(2560,2574,-3.9,1,5);
 gap(2578,2620,0,27,'Final collapsing causeway');crumble(2578,2620,6.2,s=>-2.4*Math.sin((s-2578)*Math.PI/42),'Final collapsing causeway');
 const crown=(s:number)=>s<2572?3.7-7.3*smooth((s-2555)/17):s<2604?-3.6+6*smooth((s-2572)/32):2.4*(1-smooth((s-2604)/25));
 rail(2555,2629,crown,.9,'Final crown S-grind');
 bank(2620,2630,14);gap(2630,2642,0,32,'Final boulder-drop leap');takeoff(2630,0,12);
 bank(2642,2704,24,0,'Sanctuary receiving island');fruit(2648,2668,0,1,5);box(2663,7,'nitrobang');
}
