import * as THREE from 'three';
import type {CustomComponent,CustomLevelData} from '../level';
import {tribalPoint as at,tribalYaw as yaw,tribalValue as value,type TribalScalar} from './tribal-run-route';
type Road={a:number;b:number;width:TribalScalar;offset:TribalScalar};
const round=(n:number)=>+n.toFixed(4);
export function encloseTribalRun(data:CustomLevelData,roads:Road[],height:(s:number)=>number){
 data.components=data.components.filter(c=>!['Meshy island above the lagoon','Full Meshy broad-canopy island tree','Full Meshy lagoon palm','Lagoon fern crown','Coral foliage among the jade leaves','Low water-worn lagoon islet','Broadleaf islet planting','High canopy over the woven crossing'].includes(c.nm??''));
 data.keepPlayFog=true;data.atmosphere={fogEnabled:true,fogNear:45,fogFar:155,fogColor:'#829d78',backdrop:'fog',
  ambientSky:'#d8e5c5',ambientGround:'#68754a',ambientIntensity:1.34,sunColor:'#fff0bf',sunIntensity:1.8,
  sunDirection:[-.7,.8,.3],fillColor:'#a8c8ab',fillIntensity:.55,drawDistance:220,shadowStrength:.68};
 data.groups!.push({id:106,nm:'Treehouse bush corridor',editorOnly:true});
 const C=data.components,gaps=roads.slice(1).map((r,i)=>[roads[i].b,r.a]).filter(([a,b])=>b>a+.01);
 const inner=(s:number,side:number)=>{
  const r=roads.find(r=>s>=r.a&&s<=r.b);let w=r?value(r.width,s)/2+side*value(r.offset,s)+.65:22;
  for(const [a,b]of gaps){const d=s<a?a-s:s>b?s-b:0;if(d<18)w=Math.max(w,13+9*(1-THREE.MathUtils.smoothstep(d,0,18)));}
  return w;
 };
 const bankHeight=(s:number,d:number)=>{
  const surface=[[0,-1],[3,.6],[9,2.7],[18,4.6],[32,6.2],[44,7.5]];
  for(let i=1;i<surface.length;i++)if(d<=surface[i][0]){const a=surface[i-1],b=surface[i];return height(s)+THREE.MathUtils.lerp(a[1],b[1],(d-a[0])/(b[0]-a[0]));}
  return height(s)+7.5;
 };
 const prop=(kind:CustomComponent['dkind'],s:number,y:number,u:number,size:[number,number,number],turn:number,name:string)=>
  C.push({t:'decor',dkind:kind,p:at(s,y,u),s:size,yaw:yaw(s)+turn,solid:false,scenerySolid:false,castShadow:true,grp:106,nm:'Bush corridor · '+name});
 // The forest has continuous closed earth beneath it, with a real river
 // channel between its banks. Its near edge widens around each moving deck.
 const profile=[[0,-12],[0,-1],[3,.6],[9,2.7],[18,4.6],[32,6.2],[44,7.5],[44,-12]];
 let distance=0;
 const profileUV=profile.map(([x,y],i)=>{if(i)distance+=Math.hypot(x-profile[i-1][0],y-profile[i-1][1]);return distance;});
 for(let a=-26;a<2350;a+=42)for(const side of [-1,1]){
  const b=Math.min(a+42,2350),rows=Math.ceil((b-a)/3),origin=at(a,0),v:number[]=[],uv:number[]=[],ix:number[]=[];
  for(let row=0;row<=rows;row++){
   const s=a+(b-a)*row/rows;
   for(let j=0;j<profile.length;j++){const [offset,h]=profile[j],p=at(s,height(s)+h,side*(inner(s,side)+offset));v.push(p[0]-origin[0],p[1],p[2]-origin[2]);uv.push(profileUV[j]/7,s/7);}
   if(row<rows)for(let j=0;j<profile.length;j++){
    const i=row*8+j,k=row*8+(j+1)%8,n=i+8,m=k+8;
    if(side>0)ix.push(i,k,n,k,m,n);else ix.push(i,n,k,k,n,m);
   }
  }
  for(const row of [0,rows])for(const face of THREE.ShapeUtils.triangulateShape(profile.map(([x,y])=>new THREE.Vector2(x*side,y)),[])){
   const ids=face.map(i=>row*8+i),p=new THREE.Vector3().fromArray(v,ids[0]*3),q=new THREE.Vector3().fromArray(v,ids[1]*3),r=new THREE.Vector3().fromArray(v,ids[2]*3);
   const ahead=new THREE.Vector3(...at(a+1,0)).sub(new THREE.Vector3(...at(a,0))).multiplyScalar(row?1:-1);
   if(q.sub(p).cross(r.sub(p)).dot(ahead)<0)ids.reverse();ix.push(...ids);
  }
  C.push({t:'mesh',p:origin,vertices:v.map(round),indices:ix,uvs:uv.map(round),tex:'treehouse-loam',color:'#657b43',solid:false,scenerySolid:false,grp:106,nm:'Bush corridor · closed continuous forest bank'});
  const pts:Array<[number,number,number,number]>=[];
  for(let s=a;s<b+.01;s+=Math.min(3,(b-a)/rows)){const p=at(s,height(s)-1,side*(inner(s,side)+.45));pts.push([p[0]-origin[0],p[2]-origin[2],0,p[1]]);}
  C.push({t:'wallpath',p:origin,pts,w:.5,rise:15,solid:true,containment:true,invisible:true,edgeGrinding:false,grp:106,nm:'Bush corridor · outer forest boundary'});
 }
 for(let s=-15,i=0;s<2345;s+=9,i++)for(const side of [-1,1]){
  const edge=inner(s,side),wiggle=Math.sin(i*2.4+side)*.65;
  prop('trialsv3thicket',s,bankHeight(s,3)-.4,side*(edge+3+wiggle),[9,5.1,6],side*55+i*137.5,'overlapping opaque thicket');
  if(i%2===0)prop(i%4?'trialsv2treea':'trialsv2treeb',s-3,bankHeight(s,13)-.5,side*(edge+13),[27,18.2,24],side*34+i*71,'rooted mature forest');
  if(i%2===1)prop(i%3?'trialsv2groundcovera':'trialsv2groundcoverb',s+2,height(s)-.25,side*(edge+.8),[6.5,2.4,5.4],side*73+i*31,'irregular fern verge');
  if(i%5===0){
   const p=at(s,bankHeight(s,29),side*(edge+29));
   C.push({t:'decor',dkind:'trialsv3understorymatte',p,s:[62,62/3,.02],yaw:yaw(s)-side*55,color:'#8eac7a',solid:false,scenerySolid:false,castShadow:false,grp:106,nm:'Bush corridor · dense forest depth'});
  }
 }
 for(let s=18,i=0;s<2320;s+=23,i++){
  const side=i%2?-1:1;
  prop('trialsv3bough',s,height(s)+11.5+(i%3)*.5,side*(inner(s,side)-1),[29,11,14],side<0?12:168,'high interlocking canopy');
 }
}
