import * as THREE from 'three';
import type {CustomComponent} from '../level';

type P=[number,number,number];
type Scalar=number|((s:number)=>number);
export interface CreekSampler {point(s:number,y?:number,u?:number):P;height(s:number):number}
export interface CreekBank {a:number;b:number;width:Scalar;offset:Scalar;name:string;group:number;top?:Scalar;solid?:boolean;turf?:boolean;spacing?:number;outerFalloff?:[number,number]}
const val=(v:Scalar,s:number)=>typeof v==='function'?v(s):v;
const q=(v:number)=>Math.round(v*10000)/10000;
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const ripple=(s:number,side:number)=>Math.sin(s*.19+side*1.7)*.22+Math.sin(s*.071+side*3)*.31;

/** Native curved stone: the cap itself owns contact. Broad worn courses and
 * recessed seams close into a deep root; no rectangular floor hides below it.
 * The authored lane and endpoints stay at their original supported heights. */
export function buildCreekBank(sampler:CreekSampler,bank:CreekBank):CustomComponent[]{
 const out:CustomComponent[]=[],{a,b,width,offset,name,group}=bank;
 const top=bank.top??sampler.height;
 for(let start=a;start<b;start+=48){
  const end=Math.min(b,start+48),rows=Math.ceil((end-start)/(bank.spacing??2)),origin=sampler.point(start,0);
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[],colors:number[]=[],normalPairs:[number,number][]=[];
  const add=(p:P,uv:[number,number],col:P)=>{const id=vertices.length/3;vertices.push(q(p[0]-origin[0]),q(p[1]),q(p[2]-origin[2]));uvs.push(...uv.map(q));colors.push(...col.map(q));return id;};
  const quad=(a:number,b:number,c:number,d:number)=>indices.push(a,c,b,b,c,d);
  const tops:number[][]=[],left:number[][]=[],right:number[][]=[],bottom:[number,number][]=[];
  const coarse=bank.solid===false&&bank.turf!==false;
  const depths=coarse?[0,.33,.67,1]:[0,.13,.32,.37,.65,.70,1],ledge=coarse?[0,.18,.12,-.22]:[0,.24,.1,.4,.05,.33,-.22];
  for(let i=0;i<=rows;i++){
   const s=start+(end-start)*i/rows,w=val(width,s),u=val(offset,s),h=val(top,s);
   const cap=1-.06*(1-smooth(Math.min(s-a,b-s)/2.6));
   const half=(side:number)=>bank.turf===false?w/2:w/2*cap+.40+(ripple(s,side)+.53)*.68;
   const topRow:number[]=[];
   for(const t of [-1,-.9,-.65,0,.65,.9,1]){
    const side=t<0?-1:1,x=t*half(side),rim=Math.abs(t)>.95;
    const hill=bank.solid===false&&bank.turf!==false?Math.cos(t*Math.PI/2)*(1.35+.35*Math.sin(s*.057)):0;
    const excess=bank.outerFalloff?Math.max(0,Math.abs(u+x)-bank.outerFalloff[0]):0;
    const drop=excess*(bank.outerFalloff?.[1]??0);
    const p=sampler.point(s,h+hill-drop-(rim?.105:0),u+x);
    const shade=.94+.035*Math.sin(s*.087+x*.7);
    const acrossUv=bank.outerFalloff?Math.sign(u+x)*(Math.min(Math.abs(u+x),bank.outerFalloff[0])+excess*Math.hypot(1,bank.outerFalloff[1])):x;
    topRow.push(add(p,[(s+16)/3.1,acrossUv/3.1],rim||bank.turf===false?[.72*shade,.60*shade,.42*shade]:[.63*shade,.77*shade,.43*shade]));
   }
   tops.push(topRow);
   const bankRows:number[][]=[];
   for(const side of [-1,1]){
    const ids:number[]=[],depth=8.3+1.0*Math.sin(s*.036)+.35*Math.cos(s*.21);
    for(let k=0;k<depths.length;k++){
     const f=depths[k],root=(1-f*(bank.solid===false?.22:.45)),x=side*(half(side)*root+ledge[k]+ripple(s,side)*(f*.8));
     let station=s;
     if(s===a)station+=f*(.8+.65*Math.cos(x*1.5))*(bank.solid===false?1:Math.min(2.6,(b-a)/6));
     if(s===b)station-=f*(.8+.65*Math.cos(x*1.5))*(bank.solid===false?1:Math.min(2.6,(b-a)/6));
     const drop=bank.outerFalloff?Math.max(0,Math.abs(u+side*half(side))-bank.outerFalloff[0])*bank.outerFalloff[1]*(1-f):0;
     const y=h-.105-depth*f-drop,p=sampler.point(station,y,u+x),seam=k===3||k===5;
     const shade=(.97-f*.25)*(seam?.72:1)*(.94+.07*Math.sin(s*.23+x));
     ids.push(add(p,[(station+16)/3.1,y/3.1],[.72*shade,.60*shade,.42*shade]));
    }
    normalPairs.push([ids[0],topRow[side<0?0:6]]);bankRows.push(ids);
   }
   left.push(bankRows[0]);right.push(bankRows[1]);
   bottom.push([bankRows[0][depths.length-1],bankRows[1][depths.length-1]]);
  }
  for(let i=0;i<rows;i++){
   for(let j=0;j<6;j++)quad(tops[i][j],tops[i+1][j],tops[i][j+1],tops[i+1][j+1]);
   for(let k=0;k<depths.length-1;k++){
    quad(left[i][k],left[i][k+1],left[i+1][k],left[i+1][k+1]);
    quad(right[i][k],right[i+1][k],right[i][k+1],right[i+1][k+1]);
   }
   quad(bottom[i][0],bottom[i][1],bottom[i+1][0],bottom[i+1][1]);
  }
  // Triangulate each end in its own side view; close even internal chunks so
  // editable/exported components remain independent manifold solids.
  for(const row of [0,rows]){
   const border=[...tops[row],...right[row].slice(1),...left[row].slice(1).reverse()];
   const points=border.map(id=>new THREE.Vector2(id<0?0:vertices[id*3],vertices[id*3+1]));
   // Use lateral coordinates, not world X: the river turns through all headings.
   const s=start+(end-start)*row/rows,centre=sampler.point(s,0),ahead=sampler.point(s+.1,0),dx=ahead[0]-centre[0],dz=ahead[2]-centre[2],len=Math.hypot(dx,dz);
   points.forEach((p,i)=>{const id=border[i];p.x=(-(vertices[id*3]+origin[0]-centre[0])*dz+(vertices[id*3+2]+origin[2]-centre[2])*dx)/len;});
   const faceIds=border.map((id,i)=>{
    const y=vertices[id*3+1],shade=.88+.08*Math.cos(y*.48);
    const next=add([vertices[id*3]+origin[0],y,vertices[id*3+2]+origin[2]],[points[i].x/3.1,y/3.1],[.72*shade,.60*shade,.42*shade]);
    normalPairs.push([id,next]);return next;
   });
   const emit=(ids:number[])=>{
    const a=new THREE.Vector3().fromArray(vertices,ids[0]*3),b=new THREE.Vector3().fromArray(vertices,ids[1]*3),c=new THREE.Vector3().fromArray(vertices,ids[2]*3);
    const normal=b.sub(a).cross(c.sub(a));if((normal.x*dx+normal.z*dz)*(row===0?-1:1)<0)ids.reverse();indices.push(...ids);
   };
   if(bank.solid!==false&&(s===a||s===b)){
    const columns=[-1,-.9,-.65,0,.65,.9,1],faces=new Map(border.map((id,i)=>[id,faceIds[i]]));
    const w=val(width,s),u=val(offset,s),h=val(top,s),depth=8.3+Math.sin(s*.036)+.35*Math.cos(s*.21);
    const cap=1-.06*(1-smooth(Math.min(s-a,b-s)/2.6));
    const half=(side:number)=>w/2*cap+.40+(ripple(s,side)+.53)*.68;
    let previous=faceIds.slice(0,7);
    for(let k=1;k<depths.length-1;k++){
     const fraction=depths[k],root=1-fraction*.45;
     const lo=-(half(-1)*root+ledge[k]+ripple(s,-1)*fraction*.8),hi=half(1)*root+ledge[k]+ripple(s,1)*fraction*.8;
     const y=h-.105-depth*fraction,current:number[]=[];
     for(let j=0;j<columns.length;j++){
      if(j===0){current.push(faces.get(left[row][k])!);continue;}
      if(j===6){current.push(faces.get(right[row][k])!);continue;}
      const x=lo+(hi-lo)*(columns[j]+1)/2;
      const station=s+(s===a?1:-1)*fraction*(.8+.65*Math.cos(x*1.5))*Math.min(2.6,(b-a)/6);
      const shade=(.98-fraction*.25)*(k===3||k===5?.77:1);
      current.push(add(sampler.point(station,y,u+x),[(u+x)/3.1,y/3.1],[.72*shade,.60*shade,.42*shade]));
     }
     for(let j=0;j<6;j++){emit([previous[j],previous[j+1],current[j]]);emit([current[j],previous[j+1],current[j+1]]);}
     previous=current;
    }
    const last=depths.length-1,lo=faces.get(left[row][last])!,hi=faces.get(right[row][last])!;
    for(let j=0;j<6;j++)emit([previous[j],previous[j+1],lo]);emit([previous[6],hi,lo]);
    continue;
   }
   for(const tri of THREE.ShapeUtils.triangulateShape(points,[])){
    const boundary:number[]=[];
    // Earcut omits collinear rim points. Subdivide only those triangle edges
    // so every adjacent top/side edge has an exact partner after UV welding.
    for(let edge=0;edge<3;edge++){
     const a=tri[edge],b=tri[(edge+1)%3],pa=points[a],pb=points[b],dx=pb.x-pa.x,dy=pb.y-pa.y,den=dx*dx+dy*dy;
     const extras=points.map((p,id)=>({id,t:((p.x-pa.x)*dx+(p.y-pa.y)*dy)/den,cross:Math.abs((p.x-pa.x)*dy-(p.y-pa.y)*dx)}))
      .filter(v=>v.id!==a&&v.id!==b&&v.t>.000001&&v.t<.999999&&v.cross<.00001).sort((a,b)=>a.t-b.t);
     boundary.push(a,...extras.map(v=>v.id));
    }
    if(boundary.length===3){emit(tri.map(id=>faceIds[id]));continue;}
    const capCentre=tri.reduce((sum,id)=>sum.add(new THREE.Vector3().fromArray(vertices,faceIds[id]*3)),new THREE.Vector3()).multiplyScalar(1/3);
    const lateral=tri.reduce((sum,id)=>sum+points[id].x,0)/3;
    const middle=add([capCentre.x+origin[0],capCentre.y,capCentre.z+origin[2]],[lateral/3.1,capCentre.y/3.1],[.65,.54,.38]);
    for(let i=0;i<boundary.length;i++)emit([faceIds[boundary[i]],faceIds[boundary[(i+1)%boundary.length]],middle]);
   }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
  // The cap/side UV split shares a smooth crest, without stretched UV triangles.
  const n=geo.getAttribute('normal');for(const [a,b]of normalPairs){const v=new THREE.Vector3(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
  const normals=Array.from(n.array).map(q);geo.dispose();
  out.push({t:'mesh',p:origin,vertices,indices,normals,uvs,colors,tex:'coast-terrain',color:'#fff5dd',solid:bank.solid!==false,castShadow:bank.solid===false?false:undefined,edgeGrinding:false,grp:group,nm:name});
 }
 return out;
}

/** Broad closed low shoulders ground the valley beyond the playable banks.
 * Their tops remain below the route; they cannot bridge a challenge gap. */
export function buildCreekShoulder(sampler:CreekSampler,a:number,b:number,side:number):CustomComponent[]{
 return buildCreekBank(sampler,{a,b,width:20,offset:side*30,
  top:s=>sampler.height(s)-3+.25*Math.sin(s*.049),name:'Custard sculpted low river shoulder',group:91,
  solid:false,spacing:6});
}
