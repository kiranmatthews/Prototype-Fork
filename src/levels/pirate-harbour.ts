import type { CustomComponent } from '../level';
import { pirateMeshes, SEA, type P } from './pirate-meshes';

/** The working waterfront: broad arrivals, three legible broken spans, then
 * the old sea gate. Collision and the visible deck use the shared woodpath. */
const C: CustomComponent[] = [], M = pirateMeshes(C);
let grp = 8;
const add = (c:CustomComponent) => C.push({grp,...c});
const section = (n:number) => { grp=n; M.setGroup(n); };
export const HARBOUR_SPAWN:P = [-72,2.12,205];
export const HARBOUR_ROUTE:P[] = [[-72,2,208],[-72,2,180],[-57,2,163],[-57,2,139],[-57,2,129],[-43,1,112],[-43,1,91],[-48,0,74],[-48,0,48]];

function boardwalk(nm:string,points:P[],w=7,rails=false) {
 const p=points[0];
 add({t:'woodpath',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),w,
  s:[w,.38,1],curve:'corner',structureStyle:'beach',scaffold:true,supports:true,rails,
  supportBaseY:-12,supportDepth:14,terrainSupports:false,baySpacing:5.5,spacing:.45,
  color:'#a77b51',tex:'wood',nm});
}
function fruit(a:P,b:P,count=5) {
 for(let i=0;i<count;i++){const t=i/(count-1);add({t:'wumpa',p:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+.9,a[2]+(b[2]-a[2])*t]});}
}
function house(p:P,width:number,height:number,color:string) {
 M.box('Harbour · limewashed warehouse',[p[0],p[1]+height/2,p[2]],[width,height,10],color);
 for(const side of [-1,1])M.box('Harbour · tiled pitched roof',[p[0]+side*width*.24,p[1]+height+1.3,p[2]],[width*.58,.35,12],'#914c3a',[0,0,side*-.35]);
 for(const x of [-.3,0,.3])for(const y of [2.8,6.1]){
  M.box('Harbour · dark shutter window',[p[0]+x*width,p[1]+y,p[2]+5.06],[1.6,1.8,.16],'#2b5355');
  M.box('Harbour · ochre window sill',[p[0]+x*width,p[1]+y-.9,p[2]+5.15],[2,.18,.36],SEA.sail);
 }
 M.box('Harbour · arcaded gallery',[p[0],p[1]+3.9,p[2]+7],[width+1,.3,4],SEA.timber);
 for(const x of [-.42,0,.42])M.beam('Harbour · gallery column',[p[0]+x*width,p[1],p[2]+8.6],[p[0]+x*width,p[1]+4,p[2]+8.6],.22,SEA.sail);
}
section(8);
boardwalk('Customs quay · safe arrival',[[-72,2,216],[-72,2,180]],12);
boardwalk('Quayside dogleg',[[-72,2,181],[-57,2,164]],8);
boardwalk('Cargo jetty · first near bank',[[-57,2,165],[-57,2,153]],7);
boardwalk('Cargo jetty · first far bank',[[-57,2,150.5],[-57,2,134]],7);
fruit([-72,2,199],[-72,2,183]);fruit([-67,2,175],[-57,2,164],4);
fruit([-57,2,155],[-57,2,146],4);
add({t:'crate',p:[-75,2,190],kind:'wood',nm:'Quayside supplies'});
for(const p of [[-77,2,202],[-77,2,199],[-62,2,163]] as P[])M.barrel(p);
for(const p of [[-77,2,209],[-77,2,181],[-61,2,139]] as P[])M.lantern(p);
// The town is supported by a real sea wall and planted land behind the quay.
add({t:'platform',p:[-111,-4,155],s:[52,12,130],color:'#897d67',tex:'stone',nm:'Harbour masonry sea wall'});
for(const [x,z,w,h,c] of [[-93,211,15,10,'#d3b984'],[-111,190,18,12,'#d2c5a0'],[-94,175,14,9,'#c99570'],[-112,151,17,11,'#b4b29c'],[-94,137,15,10,'#dcc6a0']] as [number,number,number,number,string][])house([x,2,z],w,h,c);
for(const p of [[-86,2,192],[-85,2,160],[-86,2,120],[-122,2,217]] as P[])add({t:'decor',dkind:'junglepalmtree',p,s:[9,14,9],nm:'Harbour palms'});

section(9);
boardwalk('Cargo jetty · second far bank',[[-57,2,131],[-57,2,126],[-43,1,112]],7);
boardwalk('Fort wharf · third near bank',[[-43,1,113],[-43,1,103]],6);
boardwalk('Fort wharf · third far bank',[[-43,1,100],[-43,1,89]],7);
add({t:'checkpoint',p:[-55,2,138],nm:'Harbour · cargo jetty'});
fruit([-57,2,136],[-57,2,127],4);fruit([-43,1,105],[-43,1,96],4);
// A narrow, optional mast line makes a deliberate alternative to the two hops.
boardwalk('Optional salvage balance beam',[[-59.5,2,146],[-64,2.8,130],[-54,1.9,123]],1.6);
add({t:'rail',p:[-63.4,3.08,134],len:15,yaw:15,nm:'Salvaged spar grind'});
add({t:'platform',p:[-65,-4,142],s:[7,12,9],tex:'crown-limestone',color:'#cac7b8',nm:'Cargo crane masonry foundation'});
M.beam('Harbour · cargo crane upright',[-65,2,142],[-65,15,142],.55);
M.beam('Harbour · cargo crane jib',[-65,14,142],[-50,12,143],.42);
M.rope('Harbour · crane stays',[-65,15,142],[-50,12,143],.2,.11);
M.rope('Harbour · hanging cargo hoist',[-50,12,143],[-50,4,143],0,.09);
M.box('Harbour · suspended cargo pallet',[-50,3.7,143],[3.7,.35,3.4],SEA.timber);
M.barrel([-50,3.9,143]);
// Anchored mooring timbers and broken stumps explain each missing span.
for(const z of [153,150.5,134,131,103,100])for(const side of [-1,1]){
 const x=z>120?-57:-43,y=z>120?2:1;
 M.beam('Harbour · split piling',[x+side*3.4,-11,z],[x+side*3.4,y+.8,z],.34);
}
for(const p of [[-34,-8,170],[-21,-8,129]] as P[]){
 M.box('Harbour · moored lighter hull',[p[0],p[1],p[2]],[8,3.4,19],SEA.timber);
 M.beam('Harbour · lighter mast',[p[0],p[1]+1,p[2]],[p[0],p[1]+18,p[2]],.3);
 M.rope('Harbour · lighter mooring',[p[0]-4,p[1]+2,p[2]+5],[-39,0,p[2]+8],1.5,.1);
}

section(10);
boardwalk('Fort wall boardwalk',[[-43,1,90],[-48,0,74],[-48,0,47]],7,true);
add({t:'checkpoint',p:[-48,0,60],nm:'Harbour · smugglers sea gate'});
fruit([-48,0,72],[-48,0,51]);
M.lantern([-52,0,59]);
// The fort sits on the cavern's rocky headland, not on the route.
for(let i=0;i<6;i++)M.rock('Harbour · headland limestone',[-76-i%2*13,0,57-i*14],[18,21,15],i,'#6e8582');
M.box('Harbour · fort curtain wall',[-69,21,61],[26,12,24],'#b8ae8e');
for(const x of [-81,-57])for(const z of [51,72])M.box('Harbour · fort corner bastion',[x,24,z],[8,18,9],'#aaa087');
for(let x=-82;x<=-56;x+=4)M.box('Harbour · parapet merlon',[x,29,74],[2.4,2,2.2],SEA.sail);
for(const x of [-59,-37])M.rock('Harbour · sea gate shoulder',[x,5,48],[6,12,8],x,SEA.stone);
M.rock('Harbour · sea gate lintel',[-48,14,48],[13,4,8],2,SEA.stone);
M.beam('Harbour · entrance timber lintel',[-54,8,49],[-42,8,49],.4);
for(const x of [-54,-42])M.beam('Harbour · entrance brace',[x,0,49],[x,8,49],.3);
// Outdoor water joins the existing moonpool at the same -10 m waterline.
const water:number[]=[];
M.quad(water,[-190,-10,270],[155,-10,270],[155,-10,51],[-190,-10,51]);
M.mesh('Harbour · open Caribbean water',water,'#2d7783',false,{materialStyle:'water',emissive:'#062b32'});
add({t:'pit',p:[-20,-10.2,166],s:[340,1,230],invisible:true,nm:'Harbour deep water'});
export const PIRATE_HARBOUR_COMPONENTS=C;
