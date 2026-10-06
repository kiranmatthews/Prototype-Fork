import type {CustomComponent,CustomGroup} from '../level';
import {CARLISLE_ASSETS} from '../carlisleAssets';
import {buildCreekBank,buildCreekShoulder,type CreekSampler,type CreekBank} from './custard-terrain';

type P=[number,number,number];
type Kind=keyof typeof CARLISLE_ASSETS;
interface Course extends CreekSampler {yaw(s:number):number;roads:CreekBank[];gaps:{a:number;b:number;u:number;name:string}[]}
const noise=(s:number)=>{const x=Math.sin(s*71.17+11.39)*41738.127;return x-Math.floor(x);};
const q=(v:number)=>Math.round(v*10000)/10000;
const value=(v:CreekBank['width'],s:number)=>typeof v==='function'?v(s):v;
export const CUSTARD_ART_GROUPS:CustomGroup[]=[
 {id:90,nm:'Custard · sunset sandstone valley'},
 {id:91,nm:'Custard · rooted grasses and river gardens'},
 {id:92,nm:'Custard · mill ruins and warm timber'},
];

/** A river valley with glimpses across its folded reaches. Existing atlas
 * models share the scenery loader/LOD; no visual prop enters contact queries. */
export function buildCreekArt(course:Course):CustomComponent[]{
 const out:CustomComponent[]=[];
 const prop=(kind:Kind,s:number,u:number,y:number,width:number,yaw:number,name:string,group=90,color='#fff0d3',shadow?:boolean)=>{
  const source=CARLISLE_ASSETS[kind].size,k=width/source[0];
  out.push({t:'decor',dkind:kind,p:course.point(s,y,u),s:source.map(v=>q(v*k)) as P,yaw:q(yaw),color,
   solid:false,castShadow:shadow,grp:group,nm:`Custard ${name}`});
 };
 const extra=(dkind:CustomComponent['dkind'],s:number,u:number,y:number,size:P,yaw:number,name:string,color='#e7d1a2')=>{
  out.push({t:'decor',dkind,p:course.point(s,y,u),s:size,yaw,color,solid:false,nm:`Custard ${name}`,grp:92});
 };
 // Continuous native low shoulders make the outer valley coherent, while
 // irregular imported outcrops add silhouette and break the authored strips.
 for(let a=-16;a<2450;a+=96)for(const side of [-1,1])out.push(...buildCreekShoulder(course,a,Math.min(2450,a+96),side));
 // Root meadow plants on the actual triangulated shoulder, including its
 // curved row interpolation. This query runs only while authoring the data.
 const triangles:{p:P[];minX:number;maxX:number;minZ:number;maxZ:number}[]=[];
 for(const c of out)if(c.t==='mesh'&&c.vertices&&c.indices)for(let i=0;i<c.indices.length;i+=3){
  const p=c.indices.slice(i,i+3).map(id=>[c.vertices![id*3]+c.p[0],c.vertices![id*3+1]+c.p[1],c.vertices![id*3+2]+c.p[2]] as P);
  const area=(p[1][0]-p[0][0])*(p[2][2]-p[0][2])-(p[2][0]-p[0][0])*(p[1][2]-p[0][2]);
  if(area>=-.01)continue;
  triangles.push({p,minX:Math.min(...p.map(v=>v[0])),maxX:Math.max(...p.map(v=>v[0])),minZ:Math.min(...p.map(v=>v[2])),maxZ:Math.max(...p.map(v=>v[2]))});
 }
 const shoulderY=(position:P)=>{
  let best=position[1],distance=Infinity;
  for(const t of triangles){const [x,,z]=position;if(x<t.minX||x>t.maxX||z<t.minZ||z>t.maxZ)continue;
   const [a,b,c]=t.p,det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
   const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
   const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det,w=1-u-v;
   if(Math.min(u,v,w)<-.0001)continue;const y=u*a[1]+v*b[1]+w*c[1],d=Math.abs(y-position[1]);
   if(d<distance){distance=d;best=y;}
  }return best;
 };
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
   prop('coastcrown',s-1,side*24,h+4.8,9+noise(i)*3,yaw+side*45,`overhanging river leaves ${i} ${side}`,91,'#d0ce92');
  }
  if(i%2===1)prop('coastfern',s+4,side*22.5,h-2.6,2.2,yaw+side*42,`lower fern garden ${i} ${side}`,91,'#d1cb95',false);
 }
 // Fine verge cover is sampled in route metres, independent of mesh density.
 // Leave the reward and patrol lanes visible, including the two millrace arms.
 for(const road of course.roads)for(let s=road.a+.6;s<road.b-.5;s+=2.4)for(const side of [-1,1]){
  const h=course.height(s),w=value(road.width,s),u=value(road.offset,s),seed=s*3+side;
  const across=u+side*(w*.41+noise(seed)*.04*w);
  prop(noise(seed+4)>.4?'coastv2grass':'coastv2grassb',s,across,h-.008,.96+noise(seed)*.5,
   noise(seed+2)*360,`verge grass ${q(s)} ${side}`,91,'#e2dcab',false);
  if(noise(seed+29)>.91)prop('coastfoliage',s+1,u+side*(w/2+.25),h-.23,1.15,
   noise(seed)*360,`copper fern ${q(s)} ${side}`,91,'#d6bc8e',false);
 }
 // Rounded outcrops are embedded beneath the live bank edges, adding
 // mineral mass to the eroded native silhouette while keeping every gap open.
 for(const road of course.roads)for(let s=road.a+5;s<road.b-4;s+=14.5)for(const side of [-1,1]){
  const w=value(road.width,s),u=value(road.offset,s),h=course.height(s),size=w<7?3.2:4.8;
  prop('coastbeachrock',s,u+side*(w/2-.30),h-size*.556641-.22,size,course.yaw(s)+side*88,
   `embedded bank outcrop ${q(s)} ${side}`,90,'#e2c59e',false);
 }
 for(let s=10;s<2440;s+=13.5)for(const side of [-1,1]){
  const across=side*(23+noise(s)*4),t=(Math.abs(across)-30)/10;
  const h=course.height(s)-3+.25*Math.sin(s*.049)+Math.cos(t*Math.PI/2)*(1.35+.35*Math.sin(s*.057));
  prop('coastv2grassb',s,across,shoulderY(course.point(s,h,across))-.008,1.4+noise(s+3)*.5,noise(s+7)*360,
   `riverbank meadow ${q(s)} ${side}`,91,'#d7cc9a',false);
 }
 // Deep roots on the actual gap faces are buried beneath the native cap.
 // Their silhouette never becomes an invisible replacement for support.
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
 // Floating rail gaps get structural piers well below the rail's air lane.
 for(const s of [674,701,2306,2346])prop('coastspire',s,0,course.height(s)-18,7.5,course.yaw(s)+23,`broken aqueduct pier ${s}`,90,'#c6b08d');
 return out;
}
