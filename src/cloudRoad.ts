import * as THREE from 'three';
import { bakeCloudOptics, createCloudRoadMaterial } from './cloudRoadLighting';
import { SKYSTREAM_SUN } from './skystreamSun';
import { createCloudRoadFringe, type CloudFringe } from './cloudRoadFringe';
export { createCloudRoadVolume as createCloudRoad } from './cloudRoadVolume';

export interface CloudRoadSection {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  across: THREE.Vector3;
  halfWidth: number;
}

const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const smoothMin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * .25;
};

/** A swept implicit volume: overlapping ellipsoid distance fields merge into
 * one watertight billowing body, with a shallow cloud cap over the ride plane.
 * The shell is presentation only. No cloud vertices enter contact queries.
 * Full authored tessellation is retained in every view; chunks only cull. */
export function createHybridCloudRoad(sections: CloudRoadSection[], flatHalf?: number, gutterRadius = 2.4, sunDirection = SKYSTREAM_SUN): THREE.Group {
  const root = new THREE.Group();root.name = 'Continuous cloud road';
  root.userData.cloudRoadVisual = true;
  const length = [0];
  for(let i=1;i<sections.length;i++)length.push(length[i-1]+sections[i].point.distanceTo(sections[i-1].point));
  const total=length[length.length-1];
  if(total<.01)return root;
  const material = createCloudRoadMaterial();
  let cursor=0;
  const sectionAt=(s:number):CloudRoadSection=>{
    while(cursor<sections.length-2 && length[cursor+1]<s)cursor++;
    while(cursor>0 && length[cursor]>s)cursor--;
    const t=THREE.MathUtils.clamp((s-length[cursor])/(length[cursor+1]-length[cursor]||1),0,1);
    const a=sections[cursor],b=sections[cursor+1];
    return {point:a.point.clone().lerp(b.point,t),normal:a.normal.clone().lerp(b.normal,t).normalize(),
      across:a.across.clone().lerp(b.across,t).normalize(),halfWidth:THREE.MathUtils.lerp(a.halfWidth,b.halfWidth,t)};
  };
  const count=Math.ceil(total/.65),around=112;
  const seed=sections[0].point.x*.31+sections[0].point.z*.17;
  let rings:THREE.Vector3[][]=[];
  let optics:number[][][]=[];
  const wisps:CloudFringe[]=[];
  for(let i=0;i<=count;i++){
    const s=total*i/count,f=sectionAt(s),cell=Math.floor(s/4.6);
    const lobes:{x:number;y:number;z:number;rx:number;ry:number;rz:number}[]=[];
    for(let j=cell-2;j<=cell+2;j++)for(let row=-2;row<=2;row++){
      const random=hash(j+seed,row+17),second=hash(j+seed+83,row+2);
      lobes.push({x:row*f.halfWidth*.43+(random-.5)*1.3,y:-2.8+(second-.5)*1.2,
        z:(j+.25+.5*second)*4.6,rx:2.4+random*1.4,ry:2+second*1.7,rz:3.1+random*1.8});
    }
    const shoulders=[];
    for(const side of [-1,1])for(let j=cell-2;j<=cell+2;j++){
      const r=hash(j+seed+51,side+7);
      shoulders.push({x:side*(f.halfWidth+.2),y:-.6+r*.25,z:(j+r*.4)*4.6,rx:1.9+r*.65,ry:1.3+r*.65,rz:2.6+r*.7});
    }
    // Cull only distance-field contributors that cannot reach the iso-surface.
    // This keeps the exact same shell while avoiding hundreds of millions of
    // redundant ellipsoid evaluations on a four-kilometre road.
    const nearby=lobes.map(b=>({...b,xx:1/(b.rx*b.rx),yy:1/(b.ry*b.ry),zz:((s-b.z)/b.rz)**2,m:Math.min(b.rx,b.ry,b.rz)}))
      .filter(b=>b.zz<(1+1/b.m)**2);
    const rim=shoulders.map(b=>({...b,xx:1/(b.rx*b.rx),yy:1/(b.ry*b.ry),zz:((s-b.z)/b.rz)**2,m:Math.min(b.rx,b.ry,b.rz)}))
      .filter(b=>b.zz<(1+.7/b.m)**2);
    const field=(x:number,y:number)=>{
      let d=(Math.sqrt(x*x/(f.halfWidth*f.halfWidth)+(y+2.4)*(y+2.4)/6.76)-1)*2.6;
      for(const b of nearby){const e=(Math.sqrt((x-b.x)*(x-b.x)*b.xx+(y-b.y)*(y-b.y)*b.yy+b.zz)-1)*b.m;d=smoothMin(d,e,.85);}
      const gutter=flatHalf===undefined?0:gutterRadius-Math.sqrt(Math.max(.01,gutterRadius*gutterRadius-Math.min(f.halfWidth-flatHalf,Math.max(0,Math.abs(x)-flatHalf))**2));
      const cap=.025+.065*Math.sin(s*.43+x*.6)*Math.cos(s*.24-x*.35)+gutter;
      d=-smoothMin(-d,cap-y,.55);
      // Round shoulders are unioned after the ride cap: they retain spherical
      // crowns instead of stretching the cap into sharp mountain ridges.
      for(const b of rim){const e=(Math.sqrt((x-b.x)*(x-b.x)*b.xx+(y-b.y)*(y-b.y)*b.yy+b.zz)-1)*b.m;d=smoothMin(d,e,.7);}
      return d;
    };
    // Follow the actual implicit contour with tangent prediction and Newton
    // correction. Unlike a radial/height projection this retains concavities
    // where separate billows join, without stretched triangles or silhouettes.
    const gradient=(x:number,y:number)=>{
      const h=.008;
      return [(field(x+h,y)-field(x-h,y))/(2*h),(field(x,y+h)-field(x,y-h))/(2*h)];
    };
    let below=-2.4,above=3;
    for(let k=0;k<15;k++){const y=(below+above)/2;if(field(0,y)<0)below=y;else above=y;}
    const startY=(below+above)/2,contour:[number,number][]=[[0,startY]];
    let x=0,y=startY;
    for(let k=0;k<600;k++){
      const g=gradient(x,y),n=Math.hypot(...g)||1,previousX=x;
      x+=g[1]/n*.24;y-=g[0]/n*.24;
      for(let j=0;j<3;j++){
        const v=field(x,y),q=gradient(x,y),den=q[0]*q[0]+q[1]*q[1]||1;
        x-=v*q[0]/den;y-=v*q[1]/den;
      }
      if(k>30&&previousX<0&&x>=0&&Math.abs(y-startY)<.3)break;
      contour.push([x,y]);
    }
    contour.push([0,startY]);
    const perimeter=[0];
    for(let j=1;j<contour.length;j++)perimeter.push(perimeter[j-1]+Math.hypot(contour[j][0]-contour[j-1][0],contour[j][1]-contour[j-1][1]));
    const ring:THREE.Vector3[]=[],localRing:[number,number][]=[];let segment=0;
    for(let j=0;j<=around;j++){
      const d=perimeter[perimeter.length-1]*j/around;
      while(segment<contour.length-2&&perimeter[segment+1]<d)segment++;
      const t=(d-perimeter[segment])/(perimeter[segment+1]-perimeter[segment]||1);
      const a=contour[segment],b=contour[segment+1];
      localRing.push([THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t)]);
      ring.push(f.point.clone().addScaledVector(f.across,THREE.MathUtils.lerp(a[0],b[0],t)).addScaledVector(f.normal,THREE.MathUtils.lerp(a[1],b[1],t)));
    }
    rings.push(ring);
    optics.push(bakeCloudOptics(contour,localRing,sunDirection.dot(f.across),sunDirection.dot(f.normal)));
    // Two shoulders every ~13 m, with an underside wisp every other station.
    // These sparse domains extend at most 0.6 m beyond the exact shell and
    // never cover the riding crown. All instances retain their authored shape.
    if(i>0&&i<count&&i%20===10){
      const picks=[localRing.slice(0,around).reduce((best,p,j)=>p[0]>localRing[best][0]?j:best,0),
        localRing.slice(0,around).reduce((best,p,j)=>p[0]<localRing[best][0]?j:best,0)];
      if(i%40===10)picks.push(localRing.slice(0,around).reduce((best,p,j)=>p[1]<localRing[best][1]?j:best,0));
      for(const j of picks){
        const a=localRing[(j+around-1)%around],b=localRing[(j+1)%around];
        const outward=f.across.clone().multiplyScalar(a[1]-b[1]).addScaledVector(f.normal,b[0]-a[0]).normalize();
        const along=f.across.clone().cross(f.normal).normalize(),aroundSurface=outward.clone().cross(along).normalize();
        const matrix=new THREE.Matrix4().makeBasis(along.multiplyScalar(1.5+hash(i+seed,j)*.5),aroundSurface.multiplyScalar(.8),outward.multiplyScalar(.5));
        matrix.setPosition(ring[j].clone().addScaledVector(outward,.1));
        wisps.push({matrix,optics:optics[i][j]});
      }
    }
  }
  // Ellipsoidal end domes overlap adjacent components and give exposed jump
  // ends a soft silhouette. The collision ribbon still ends at its authored point.
  const endRings=(atStart:boolean)=>{
    const index=atStart?0:count,f=sections[atStart?0:sections.length-1];
    const tangent=atStart?sections[0].point.clone().sub(sections[1].point).normalize():
      sections[sections.length-1].point.clone().sub(sections[sections.length-2].point).normalize();
    const centre=f.point.clone().addScaledVector(f.normal,-2.4),caps:THREE.Vector3[][]=[];
    for(let k=1;k<=10;k++){
      const a=k/10*Math.PI/2;
      caps.push(rings[index].map(p=>p.clone().sub(centre).multiplyScalar(Math.cos(a)).add(centre).addScaledVector(tangent,1.35*Math.sin(a))));
    }
    return atStart?caps.reverse():caps;
  };
  const beginning=endRings(true),ending=endRings(false);rings=[...beginning,...rings,...ending];
  optics=[...beginning.map(()=>optics[0]),...optics,...ending.map(()=>optics[optics.length-1])];
  const last=rings.length-1;
  // A 25 m chunk is a visibility boundary only, never a reduced-detail mesh.
  const chunkRings=38;
  for(let start=0;start<last;start+=chunkRings){
    const end=Math.min(last,start+chunkRings),positions:number[]=[],normals:number[]=[],indices:number[]=[],light:number[]=[];
    for(let i=start;i<=end;i++)for(let j=0;j<=around;j++){
      positions.push(...rings[i][j].toArray());
      light.push(...optics[i][j].map(value=>Math.round(value*255)));
      const left=rings[i][(j+around-1)%around],right=rings[i][(j+1)%around];
      const before=rings[Math.max(0,i-1)][j],after=rings[Math.min(last,i+1)][j];
      const normal=new THREE.Vector3().subVectors(right,left).cross(new THREE.Vector3().subVectors(after,before)).normalize();
      normals.push(...normal.toArray());
      if(i<end&&j<around){const a=(i-start)*(around+1)+j,b=a+around+1;indices.push(a,a+1,b,a+1,b+1,b);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setIndex(indices);
    geo.setAttribute('cloudOptics',new THREE.Uint8BufferAttribute(light,2,true));
    geo.computeBoundingBox();geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,material);mesh.name='Cloud billows · full detail';
    mesh.userData.visualOnly=true;mesh.userData.cloudRoadVisual=true;mesh.userData.edgeGrinding=false;
    mesh.userData.castShadow=false;mesh.userData.receiveShadow=true;root.add(mesh);
  }
  if(wisps.length)root.add(createCloudRoadFringe(wisps));
  return root;
}
