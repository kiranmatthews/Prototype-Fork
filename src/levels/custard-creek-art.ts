import type {CustomComponent,CustomGroup} from '../level';
import {CARLISLE_ASSETS} from '../carlisleAssets';
import {buildCreekBank,buildCreekShoulder,type CreekSampler,type CreekBank} from './custard-terrain';
import {creekLedgeSection,creekCapStation} from './custard-ledge-profile';
import {creekSurfaceQuery} from './custard-surface-query';
import {measuredCreekLedge} from './custard-ledge-support';

type P=[number,number,number];
type Kind=keyof typeof CARLISLE_ASSETS;
interface Course extends CreekSampler {yaw(s:number):number;roads:CreekBank[];gaps:{a:number;b:number;u:number;name:string}[];surfaces:CustomComponent[]}
const noise=(s:number)=>{const x=Math.sin(s*71.17+11.39)*41738.127;return x-Math.floor(x);};
const q=(v:number)=>Math.round(v*10000)/10000;
const value=(v:CreekBank['width'],s:number)=>typeof v==='function'?v(s):v;
export const CUSTARD_ART_GROUPS:CustomGroup[]=[
 {id:90,nm:'Custard · sunset sandstone valley'},
 {id:91,nm:'Custard · rooted grasses and river gardens'},
 {id:92,nm:'Custard · mill ruins and warm timber'},
];

/** A river valley with glimpses across its folded reaches. Existing atlas
 * models share the scenery loader/LOD. Exposed ledge caps get measured contact. */
export function buildCreekArt(course:Course):CustomComponent[]{
 const out:CustomComponent[]=[];
 const prop=(kind:Kind,s:number,u:number,y:number,width:number,yaw:number,name:string,group=90,color='#fff0d3',shadow?:boolean)=>{
  const source=CARLISLE_ASSETS[kind].size,k=width/source[0];
  const visual:CustomComponent={t:'decor',dkind:kind,p:course.point(s,y,u),s:source.map(v=>q(v*k)) as P,yaw:q(yaw),color,
   solid:false,castShadow:shadow,grp:group,nm:`Custard ${name}`};out.push(visual);
  if(kind==='coastv2ledge')out.push(measuredCreekLedge(visual));
 };
 const extra=(dkind:CustomComponent['dkind'],s:number,u:number,y:number,size:P,yaw:number,name:string,color='#e7d1a2')=>{
  out.push({t:'decor',dkind,p:course.point(s,y,u),s:size,yaw,color,solid:false,nm:`Custard ${name}`,grp:92});
 };
 // Continuous native low shoulders make the outer valley coherent, while
 // irregular imported outcrops add silhouette and break the authored strips.
 for(let a=-16;a<2450;a+=96)for(const side of [-1,1])out.push(...buildCreekShoulder(course,a,Math.min(2450,a+96),side));
 const terrainY=creekSurfaceQuery(course.surfaces),shoulder=creekSurfaceQuery(out);
 const shoulderY=(p:P)=>shoulder(p,3)??p[1];
 for(let s=-12,i=0;s<2460;s+=22+noise(i+7)*8,i++)for(const side of [-1,1]){
  const h=course.height(s),yaw=course.yaw(s),high=(Math.floor(s/250)%2?1:-1)===side;
  const width=(high?19:14)+noise(i*3+side)*6,u=side*(high?28:27);
  const kind:Kind=i%5===1?'coastv2cavewall':i%5===3?'coastbeachrock':'coastv2buttress';
  const height=CARLISLE_ASSETS[kind].size[1]*width/CARLISLE_ASSETS[kind].size[0];
  prop(kind,s,u,h-(high?height*.65:height*.90)-3,width,yaw+(side<0?83:-94)+noise(i)*22,
   `river cliff ${i} ${side}`,90,side<0?'#eee0bd':'#d8c4aa',high?undefined:false);
  if(i%2===0)prop('coastv2buttress',s+7,side*39,h-18,27+noise(i+31)*5,yaw+side*90,
   `valley bedrock ${i} ${side}`,90,'#b1a6a2',false);
  if(i%3===0)prop('coastv2earthbank',s+5,side*20.4,h-5,7.5,yaw+side*88,
   `exposed root bank ${i} ${side}`,90,'#ddc69d',false);
  if(i%3===1){
   prop('coasttree',s+8,side*31,h-3,15+noise(i+2)*5,yaw+noise(i)*180,`sunlit willow canopy ${i} ${side}`,91,'#d0cf96');
   prop('coastcrown',s+3,side*27,h+4.8,9+noise(i)*3,yaw+side*45,`overhanging river leaves ${i} ${side}`,91,'#d0ce92');
  }
  if(i%2===1){const across=side*(24.5+noise(i+9)*1.2),p=course.point(s+4,h-2.6,across),y=shoulder(p,3);
   if(y!==null)prop('coastfern',s+4,across,y-.025,2.2,yaw+side*42,`lower fern garden ${i} ${side}`,91,'#d1cb95',false);}
 }
 // Fine verge cover is sampled in route metres, independent of mesh density.
 // Leave the reward and patrol lanes visible, including the two millrace arms.
 for(const road of course.roads)for(let s=road.a+.8;s<road.b-.7;s+=3.25)for(const side of [-1,1]){
  const section=creekLedgeSection(road,s),edge=side<0?section.left:section.right,seed=s*3+side;
  const x=side*(edge.flat+(edge.half-edge.flat)*(.08+noise(seed)*.42));
  const station=creekCapStation(road,s,x,edge.half),across=section.u+x,p=course.point(station,course.height(station),across),ground=terrainY(p);
  if(ground===null)continue;
  if(road.bare&&value(road.bare,s)>.65&&noise(seed)>.25)continue;
  prop(noise(seed+4)>.38?'coastv2grass':'coastv2grassb',station,across,ground-.008,1.15+noise(seed)*.55,
   noise(seed+2)*360,`verge grass ${q(s)} ${side}`,91,'#dbd29d',false);
  if(noise(seed+29)>.88){
   const xx=side*(edge.flat+.16),ss=creekCapStation(road,s+.7,xx,edge.half),point=course.point(ss,course.height(ss),section.u+xx),y=terrainY(point);
   if(y!==null)prop('coastfoliage',ss,section.u+xx,y-.05,1.1+noise(seed)*.3,noise(seed)*360,`copper fern ${q(s)} ${side}`,91,'#c6b084',false);
  }
 }
 for(let s=10;s<2440;s+=13.5)for(const side of [-1,1]){
  const across=side*(23+noise(s)*4),t=(Math.abs(across)-30)/10;
  const h=course.height(s)-3+.25*Math.sin(s*.049)+Math.cos(t*Math.PI/2)*(1.35+.35*Math.sin(s*.057));
  const y=shoulder(course.point(s,h,across),1.4);if(y===null)continue;
  prop('coastv2grassb',s,across,y-.008,1.4+noise(s+3)*.5,noise(s+7)*360,
   `riverbank meadow ${q(s)} ${side}`,91,'#d7cc9a',false);
 }
 // Deep roots on the actual gap faces are buried beneath the native cap.
 // Exposed tops receive the exact visible cap triangles, including chipped rims.
 for(const gap of course.gaps)for(const [s,sign]of [[gap.a,-1],[gap.b,1]]){
  if(gap.name==='Outer collapsing plank span'||gap.name==='Falling sluice crescent')continue;
  const h=course.height(s),width=gap.name.includes('aqueduct')?10:8.5;
  const height=width*CARLISLE_ASSETS.coastv2ledge.size[1]/10;
  prop('coastv2ledge',s+sign*3.3,gap.u,h-height-.28,width,course.yaw(s)+(sign<0?180:0),
   `broken bank root ${gap.name} ${sign}`,90,'#e3c49b');
 }
 // The curved spillway keeps its existing ride. A deep closed stone trough
 // supports the silhouette below its floor and outside its outer decks.
 out.push(...buildCreekBank(course,{a:850,b:1160,width:15,offset:0,top:s=>course.height(s)-.26,name:'Custard spillway foundation',group:90,solid:false,turf:false,spacing:6}));
 for(const side of [-1,1])out.push(...buildCreekBank(course,{a:850,b:1160,width:2.6,offset:side*9.25,top:s=>course.height(s)+2.30,name:'Custard spillway outer stone mass',group:90,solid:false,turf:false,spacing:6,outerFalloff:[8.98,3.2]}));
 // Three compositions give the route a mill-settlement identity without
 // repeating gates at every checkpoint or putting hut walls in playable lanes.
 for(const [s,u]of [[112,27],[574,-28],[790,-32],[1694,29],[2150,-29]]){
  const h=course.height(s);
  const base=shoulderY(course.point(s,h-2,u))-.10;
  extra('trialsv2porchhut',s,u,base,[9,6.2,7.9],course.yaw(s)+(u<0?68:-110),`riverside mill house ${s}`);
  prop('coastbeachrock',s,u,base-5.42,10,course.yaw(s),`mill house footing ${s}`,90,'#ceb58e',false);
 }
 for(const [s,u,width]of [[20,-10.5,2.3],[20,10.5,2.3],[744,-9.5,3.0],[835,10,3.2],[1206,-10,2.5],[2388,-12,3.4],[2388,12,2.8]]){
  prop('coastpillar',s,u,course.height(s)-2,width,course.yaw(s)+(u<0?15:-12),`worn mill pier ${s} ${u}`,92,'#ead7b1');
  prop('coastbeachrock',s,u,course.height(s)-7,10,course.yaw(s)+34,`submerged mill pier footing ${s} ${u}`,90,'#d1b78c',false);
 }
 prop('coastv2buttress',791,-18,course.height(791)+5-12*12.975/14-.45,12,course.yaw(791)+12,
  'deep mill roof foundation',90,'#ddc39d',false);
 // A grounded timber hoist explains the optional lift and frames the reward
 // roof. Uprights sit outside the axis-aligned deck's entire movement envelope.
 const lift=course.point(791,course.height(791),-11),floor=lift[1];
 const timber=(a:P,b:P,width:number,depth:number,label:string)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
  const yaw=Math.atan2(-dz,dx),lean=Math.atan2(dy,Math.hypot(dx,dz)),half=depth/2;
  out.push({t:'decor',dkind:'trialsv2beam',
   p:[q((a[0]+b[0])/2+half*Math.cos(yaw)*Math.sin(lean)),q((a[1]+b[1])/2-half*Math.cos(lean)),q((a[2]+b[2])/2-half*Math.sin(yaw)*Math.sin(lean))],
   s:[q(length),depth,width],yaw:q(yaw*180/Math.PI),amp:q(lean*180/Math.PI),solid:false,
   color:'#d6bb8b',grp:92,nm:`Custard mill hoist ${label}`});
 };
 const at=(x:number,y:number,z:number):P=>[lift[0]+x,floor+y,lift[2]+z];
 for(const z of [-3.85,3.85]){
  for(const x of [-3.3,3.3]){
   timber(at(x,-7.2,z),at(x,8.25,z),.48,.52,`river pile ${x} ${z}`);
   timber(at(x,5.8,z),at(x-Math.sign(x)*1.65,8.05,z),.3,.3,`knee brace ${x} ${z}`);
  }
  timber(at(-3.85,8.1,z),at(3.85,8.1,z),.66,.65,`crosshead ${z}`);
 }
 timber(at(0,8.1,-4.25),at(0,8.1,4.25),.48,.58,'overhead spindle');
 // Floating rail gaps get structural piers well below the rail's air lane.
 for(const s of [674,701,2306,2346])prop('coastspire',s,0,course.height(s)-18,7.5,course.yaw(s)+23,`broken aqueduct pier ${s}`,90,'#c6b08d');
 return out;
}
