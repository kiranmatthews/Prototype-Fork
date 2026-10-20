import * as THREE from 'three';
import type {CustomComponent} from '../level';
import {treehouseTrialPoint,treehouseTrialZ,treehouseTrialOffset,TREEHOUSE_TRIALS_JOINS} from './treehouse-trials-continuity';
import {TREEHOUSE_REPAIR_MATTE_LAYERS} from './treehouse-matte-layers';
import {exactTreehouseSupport} from './treehouse-exact-support';
type P=[number,number,number];
const r=(n:number)=>+n.toFixed(5);
function authoringZ(z:number):number{
  let a=z,b=z+TREEHOUSE_TRIALS_JOINS.reduce((sum,j)=>sum+j.extra,0);
  for(let i=0;i<24;i++){const m=(a+b)/2;if(treehouseTrialZ(m)<z)a=m;else b=m;}
  return (a+b)/2;
}
const opening:[[number,number],...Array<[number,number]>]=[[-3,9],[1,9],[8,7],[20,7],[26,6],[31,2],[34,-4],[35,-10],[35,-16]];
function pathDistance(x:number,z:number):number{
  if(z<-16)return Math.abs(x-35-treehouseTrialOffset(authoringZ(z)));
  let distance=Infinity;
  for(let i=1;i<opening.length;i++){
    const a=opening[i-1],b=opening[i],dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
    distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }
  return Math.min(distance,Math.hypot((x+11)*.7,(z-8)*.8)-2,Math.hypot((x-14)*.62,z*.8)-2);
}
function unifySoil(c:CustomComponent):CustomComponent{
  if(c.t!=='mesh'||!c.vertices||c.materialStyle||!['dirt','treehouse-loam'].includes(c.tex??'')||c.invisible)return c;
  const colors:number[]=[],uvs:number[]=[];
  for(let i=0;i<c.vertices.length;i+=3){
    const x=c.p[0]+c.vertices[i],z=c.p[2]+c.vertices[i+2];
    const edge=3.45+.58*Math.sin(z*.13)+.27*Math.sin(z*.47+x*.09);
    const d=pathDistance(x,z)+.24*Math.sin(x*.77+z*.23);
    const color=new THREE.Color('#e8dcc4').lerp(new THREE.Color('#547348'),THREE.MathUtils.smoothstep(d,edge,edge+2.8));
    color.multiplyScalar(.985+.025*Math.sin(z*.21+x*.17));
    colors.push(...color.toArray().map(r));uvs.push(r(x/6.5),r(z/6.5));
  }
  return {...c,tex:'treehouse-loam',color:'#ffffff',colors,uvs};
}
function bounds():CustomComponent[]{
  const side=(s:number):P[]=>{
    const points:P[]=[];
    for(let z=-16;z>=-454;z-=2){
      const coast=THREE.MathUtils.smoothstep(-z,156,163)*(1-THREE.MathUtils.smoothstep(-z,189,199));
      const bonus=Math.exp(-Math.pow((z+216)/9,4));
      const cave=THREE.MathUtils.smoothstep(-z,277,285)*(1-THREE.MathUtils.smoothstep(-z,414,424));
      const half=8.2+cave*.8+(s>0?coast*13:bonus*6);
      points.push(treehouseTrialPoint([35+s*half,-25,z]));
    }
    return points;
  };
  const left=side(-1),right=side(1);
  const openingEdge:P[]=[[-30,-25,-18],[-32,-25,-8],[-31,-25,10],[-19,-25,14],[-2,-25,17],
    [18,-25,19],[38,-25,17],[48,-25,8],[49,-25,-7],[45,-25,-16]];
  const polygon=[...left.slice().reverse(),...openingEdge,...right];
  return [{t:'wallpath',p:[0,-25,0],pts:polygon.map(p=>[p[0],p[2],0]),w:.22,rise:50,
    closed:true,curve:'corner',containment:true,invisible:true,nm:'Treehouse fitted course-edge safety perimeter',grp:7}];
}
function timber(a:P,b:P,width:number,depth:number,name:string):CustomComponent{
  const delta=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),length=delta.length();
  const yaw=Math.atan2(-delta.z,delta.x),lean=Math.atan2(delta.y,Math.hypot(delta.x,delta.z));
  const half=depth/2;
  return {t:'decor',dkind:'trialsv2beam',p:[r((a[0]+b[0])/2+half*Math.cos(yaw)*Math.sin(lean)),
    r((a[1]+b[1])/2-half*Math.cos(lean)),r((a[2]+b[2])/2-half*Math.sin(yaw)*Math.sin(lean))],
    s:[length,depth,width],yaw:r(THREE.MathUtils.radToDeg(yaw)),amp:r(THREE.MathUtils.radToDeg(lean)),
    nm:name,grp:18};
}
function pipeDetails():CustomComponent[]{
  const C:CustomComponent[]=[],center=treehouseTrialPoint([35,-7.2,-349]),x=center[0],z=center[2],y=center[1];
  for(const side of [-1,1]){
    const deckX=x+side*7.26;
    for(let station=-20;station<=20;station+=8){
      const zz=z+station;
      C.push(timber([deckX,y-.35,zz],[deckX,y+4.3,zz],.34,.4,'Cavern pipe · grounded scaffold post'));
      C.push(timber([x+side*7.6,y-.35,zz-2.7],[deckX,y+4.05,zz+2.7],.26,.3,'Cavern pipe · diagonal trestle brace'));
      C.push(timber([x+side*5.32,y+4.04,zz],[x+side*7.45,y+4.04,zz],.35,.36,'Cavern pipe · exposed timber cross bearer'));
      C.push({t:'decor',dkind:'treehousemossrock',p:[x+side*8.5,y-.6,zz+2],s:[4.7,2.7,4.2],yaw:side*37+station,
        nm:'Cavern pipe · mossy rock shoulder around the timber',grp:19});
      C.push({t:'decor',dkind:station%16===0?'trialsv2ferna':'trialsv2fernb',p:[x+side*7.75,y+1.25,zz+2.3],s:[3.5,2.05,3.4],yaw:side*62,
        nm:'Cavern pipe · fern pocket beside scaffold',grp:17});
    }
    for(const end of [-1,1]){
      const zz=z+end*20.5;
      C.push({t:'woodpath',p:[deckX,y+4.2,zz],pts:[[0,0,0,0],[0,-end*8,0,0]],w:1.8,
        structureStyle:'light',rails:false,scaffold:false,supports:false,spacing:.42,tex:'treehouse-timber',
        nm:'Cavern pipe · short handmade side platform',grp:18});
      C.push(timber([x+side*8.1,y+4.2,zz],[x+side*8.1,y+5.35,zz],.22,.25,'Cavern pipe · platform guard post'));
      C.push(timber([x+side*8.1,y+5.25,zz],[x+side*8.1,y+5.25,zz-end*7.7],.17,.2,'Cavern pipe · weathered platform top rail'));
    }
  }
  // A low, asymmetric natural arch supplies the large reference silhouette.
  // Its measured inner opening clears the complete timber riding envelope.
  C.push({t:'decor',dkind:'treehousecavearch',p:[x,-8.0,z-3.5],s:[56,13.5,8],yaw:-3,amp:-8,
    nm:'Sunlit halfpipe · broad natural rock arch over the riding lane',grp:19});
  for(const side of [-1,1]){
    C.push(timber([x+side*5.3,y+4.25,z+23],[x+side*5.3,y+4.25,z-23],.19,.18,'Halfpipe warm wooden coping cover'));
    for(const station of [-17,-3,14]){
      C.push({t:'decor',dkind:side<0?'trialsv2ferna':'trialsv2fernb',p:[x+side*6.65,y+4.18,z+station],
        s:[3.7,2.2,3.5],yaw:side*53+station,nm:'Halfpipe · fern fronds overhanging the outer deck',grp:17});
      C.push({t:'decor',dkind:'treehousemossrock',p:[x+side*8.25,y+2.1,z+station+1.6],
        s:[4.7,3.9,5.4],yaw:station*4,nm:'Halfpipe · irregular moss rock above the timber shoulder',grp:19});
    }
  }
  // Root-like cross pieces sit above riding height and follow the rock vault.
  for(const station of [-14,8]){
    C.push(timber([x-10,y+11.3,z+station],[x-3,y+12.8,z+station-1.2],.52,.65,'Cavern pipe · old timber tied into the rock arch'));
    C.push(timber([x+3,y+12.8,z+station-1.2],[x+10,y+11.8,z+station],.5,.65,'Cavern pipe · broken overhead bearer'));
  }
  return C;
}
export function repairTreehouseWorld(input:readonly CustomComponent[]):CustomComponent[]{
  const C:CustomComponent[]=[];
  for(let c of input){
    if(c.nm==='Outer boundary around opening and the extended Treehouse Trials route')continue;
    if(['treehousetrialsforestmatte','treehousemattemid','treehousetrialscavematte'].includes(c.dkind??''))continue;
    c=unifySoil(c);
    // Open a sunlit window above the final bend; rooted foreground trees
    // stay at the shoulders instead of closing into a low leafy tunnel.
    if(c.t==='decor'&&['trialsv2treea','trialsv2treeb','trialsv2crowna','trialsv2crownb'].includes(c.dkind??'')&&authoringZ(c.p[2])<-408){
      const center=35+treehouseTrialOffset(authoringZ(c.p[2])),side=Math.sign(c.p[0]-center)||1;
      c={...c,p:[c.p[0]+side*3.5,c.p[1],c.p[2]],s:c.s?[c.s[0],c.s[1]*1.15,c.s[2]]:c.s};
    }
    if(c.nm==='Top of climb into the sunlit cavern'&&c.vertices){
      const vertices=[...c.vertices],top=treehouseTrialPoint([35,-7.2,-314]);
      for(let i=1;i<vertices.length;i+=3){
        const worldZ=c.p[2]+vertices[i+1];
        vertices[i]-=.28*(1-THREE.MathUtils.smoothstep(top[2]-worldZ,6,12));
      }
      c={...c,vertices,normals:undefined};
    }
    C.push(c);
  }
  const top=treehouseTrialPoint([35,-7.2,-314]);
  // The original buried climb mound ended below the gallery slab, leaving
  // a view of sky through the vertical join. A supported rocky berm spans
  // that join beneath the exact sculpted stair and summit contact meshes.
  const bermV:number[]=[],bermUv:number[]=[],bermIx:number[]=[];
  for(const [z,y] of [[4,-8.9],[1.5,-8.18],[-1,-7.65],[-4,-7.62]])for(let i=0;i<=16;i++){
    const x=-32+i*4,relief=Math.abs(x)<5?0:.07*Math.sin(x*.43+z);
    bermV.push(x,y+relief,z);bermUv.push((top[0]+x)/6.5,(top[2]+z)/6.5);
  }
  for(let row=0;row<3;row++)for(let col=0;col<16;col++){
    const a=row*17+col,b=a+1,c=a+17,d=c+1;bermIx.push(a,b,c,b,d,c);
  }
  C.push({t:'mesh',p:[top[0],0,top[2]],vertices:bermV,uvs:bermUv,indices:bermIx,tex:'treehouse-stone',
    color:'#c4bda8',solid:true,edgeGrinding:false,nm:'Climb summit · continuous buried stone berm closing the gallery seam',grp:19});
  for(const [offset,width,depth,kind] of [[3.6,9.4,7,'trialsv2riverstoneb'],[9.2,9.8,5.8,'trialsv2riverstonec']] as const){
    const stone:CustomComponent={t:'decor',dkind:kind,p:[top[0],-7.7,top[2]-offset],s:[width,.54,depth],
      nm:'Climb summit · fitted natural rock transition slab',grp:19};
    C.push(stone,exactTreehouseSupport(stone,'Climb summit · exact transition support'));
  }
  C.push(...bounds(),...pipeDetails(),...TREEHOUSE_REPAIR_MATTE_LAYERS);
  for(const [dx,z,yaw] of [[-10,-435,32],[12,-447,-24],[-12,-462,55],[13,-480,-37]] as const){
    C.push({t:'decor',dkind:'trialsv2treeb',p:treehouseTrialPoint([35+dx*1.55,-7.55,z]),s:[24,15.453,16.347],yaw,
      nm:'Exit real rooted tree framing the continuing forest path',grp:17});
    C.push({t:'decor',dkind:'trialsv2fernb',p:treehouseTrialPoint([35+dx*.63,-7.18,z+2]),s:[4,2.45,3.94],yaw,
      nm:'Exit layered fern foreground',grp:17});
  }
  return C;
}
