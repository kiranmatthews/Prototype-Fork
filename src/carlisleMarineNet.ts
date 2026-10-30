import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { marineNetBounds } from './trampolineSurface';

type P = [number, number, number];
/** Measured centres of the eight holes in the complete P1 housing, in bbox units.
 * X/Z are centred; Y is measured from its foot. The housing is asymmetric. */
export const MARINE_NET_EYES: readonly P[] = [
  [-.3788,.87,-.2593],[-.3788,.87,.2495],[.4305,.87,-.2436],[.4281,.87,.2417],
  [-.1667,.87,-.4462],[.1643,.87,-.4462],[-.1259,.87,.4374],[.2026,.87,.4462],
];
export const marineFrameHeight = (w:number,d:number) => Math.min(1.55,Math.min(w,d)*.105);

const deform = /* glsl */`
  attribute float netMobility;
  uniform vec4 netImpact;
  uniform vec4 netBounds;
  uniform float netAge;
  uniform float netPreview;
  float netOffset(vec2 p) {
    vec2 uv=(p-netBounds.xy)/netBounds.zw;
    float dome=max(0.,1.-uv.x*uv.x)*max(0.,1.-uv.y*uv.y);
    vec2 hit=(p-netImpact.xy)/netBounds.zw;
    float radius=length(hit);
    float local=exp(-dot(hit,hit)*2.8);
    float envelope=.18+.82*dome;
    float t=netAge;
    float settle=1.-smoothstep(1.4,2.,t);
    float rebound=sin(t*15.)*exp(-t*2.8)*1.3;
    float wave=sin(radius*11.-t*17.)*exp(-pow((radius-t*1.4)/.32,2.))*exp(-t*2.5)*.15;
    return -envelope*(netPreview+(netImpact.z*(rebound*(.30+.70*local)+wave)*settle));
  }
`;
type SharedRopes={geometry:THREE.BufferGeometry;normal:THREE.DataTexture;roughness:THREE.DataTexture;refs:number};
const ropeResources=new Map<string,SharedRopes>();

/** Knotted, braided ropes and threaded lashings. Only their rendered positions bend. */
export class CarlisleMarineNet {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly eyes:THREE.Vector3[];
  readonly diagnostics={impacts:0,age:2,depth:0,hit:[0,0] as [number,number],anchors:8};
  private readonly uniforms={
    netImpact:{value:new THREE.Vector4(0,0,0,0)},netBounds:{value:new THREE.Vector4()},
    netAge:{value:2},netPreview:{value:0},
  };
  private readonly material:THREE.MeshStandardMaterial;
  private readonly depth:THREE.MeshDepthMaterial;
  private readonly distance:THREE.MeshDistanceMaterial;
  private readonly shared:SharedRopes;
  private readonly resourceKey:string;
  private readonly maxDepth:number;
  constructor(readonly width:number,readonly length:number,readonly frameHeight=marineFrameHeight(width,length)) {
    this.group.name='Laced elastic marine net';this.group.userData.visualOnly=true;
    const w=width,d=length,h=frameHeight;
    const [x0,x1,z0,z1]=marineNetBounds(w,d);
    const cx=(x0+x1)/2,cz=(z0+z1)/2,hx=(x1-x0)/2,hz=(z1-z0)/2;
    this.uniforms.netBounds.value.set(cx,cz,hx,hz);
    this.maxDepth=Math.min(2.25,Math.min(w,d)*.175);
    this.eyes=MARINE_NET_EYES.map(([x,y,z])=>new THREE.Vector3(x*w,(y-.87)*h,z*d));
    this.resourceKey=[w,d,h].join(':');
    let shared=ropeResources.get(this.resourceKey);
    if(!shared){
      const radius=Math.min(w,d)*.0038,sag=Math.min(.15,Math.min(w,d)*.012);
      const pieces:THREE.BufferGeometry[]=[];
      const profile=(x:number,z:number)=>Math.max(0,1-((x-cx)/hx)**2)*Math.max(0,1-((z-cz)/hz)**2);
      const position=(x:number,z:number,y=0)=>new THREE.Vector3(x,y-sag*profile(x,z),z);
      const tube=(curve:THREE.Curve<THREE.Vector3>,r:number,color:number,mobility:(t:number)=>number=()=>1,segments?:number)=>{
        const arc=curve.getLength(),count=segments??Math.max(8,Math.ceil(arc/(Math.min(w,d)*.025)));
        const geometry=new THREE.TubeGeometry(curve,count,r,6,false),n=geometry.attributes.position.count;
        const colors=new Float32Array(n*3),flex=new Float32Array(n),c=new THREE.Color(color),uv=geometry.attributes.uv;
        for(let i=0;i<n;i++){
          const t=uv.getX(i),shade=.94+.06*Math.sin(t*arc*19);
          colors.set([c.r*shade,c.g*shade,c.b*shade],i*3);flex[i]=mobility(curve.getUtoTmapping(t,0));
          uv.setX(i,t*arc/(r*12));
        }
        geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('netMobility',new THREE.BufferAttribute(flex,1));pieces.push(geometry);
      };
      const curve=(points:THREE.Vector3[],closed=false)=>new THREE.CatmullRomCurve3(points,closed,'centripetal',.5);
      const spacing=Math.min(w,d)*.039,step=spacing*Math.SQRT2,origin=-hx-hz+step*.5;
      for(const slope of [-1,1])for(let b=origin;b<hx+hz;b+=step){
        const candidates=[[-hx,-slope*hx+b],[hx,slope*hx+b],[(-hz-b)/slope,-hz],[(hz-b)/slope,hz]];
        const points=candidates.filter(([x,z])=>Math.abs(x)<=hx+1e-5&&Math.abs(z)<=hz+1e-5)
          .filter((p,i,a)=>a.findIndex(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6)===i);
        if(points.length!==2)continue;
        const [a,bp]=points,delta=new THREE.Vector2(bp[0]-a[0],bp[1]-a[1]),steps=Math.max(4,Math.ceil(delta.length()/spacing)*2);
        const path=Array.from({length:steps+1},(_,i)=>{
          const t=i/steps,x=a[0]+delta.x*t+cx,z=a[1]+delta.y*t+cz;
          // Interlaced strands pass over/under each other instead of intersecting.
          const crossing=((z-cz)+slope*(x-cx)-origin)/step+Math.round((b-origin)/step);
          return position(x,z,Math.cos(crossing*Math.PI)*radius*.8*slope);
        });
        tube(curve(path),radius,slope===1?0xcb551f:0xe77630);
      }
      // Bound perimeter, continuously following all four sides.
      const corners=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
      for(let i=0;i<4;i++){
        const a=corners[i],b=corners[(i+1)%4];
        tube(curve(Array.from({length:13},(_,j)=>position(a[0]+(b[0]-a[0])*j/12,a[1]+(b[1]-a[1])*j/12))),radius*1.9,0xe98039);
      }
      // Actual knot collars at every diamond intersection, including the perimeter ties.
      const knot=(p:THREE.Vector3,tangent:THREE.Vector3,r=radius)=>{
        const side=new THREE.Vector3(-tangent.z,0,tangent.x).normalize(),points=[];
        for(let i=0;i<=12;i++){
          const a=i/12*Math.PI*4;
          points.push(p.clone().addScaledVector(side,Math.cos(a)*r*1.1).add(new THREE.Vector3(0,Math.sin(a)*r*1.1,0)).addScaledVector(tangent,(i/12-.5)*r*3));
        }
        tube(curve(points),r*.53,0xb3481d,()=>1,14);
      };
      for(let a=-hx-hz+step*.5;a<hx+hz;a+=step)for(let b=-hx-hz+step*.5;b<hx+hz;b+=step){
        const x=(b-a)/2,z=(a+b)/2;
        if(Math.abs(x)<hx-radius*3&&Math.abs(z)<hz-radius*3)knot(position(x+cx,z+cz),new THREE.Vector3(1,0,1).normalize());
      }
      this.eyes.forEach((eye,index)=>{
        const side=index<4,sign=index<2?-1:index<4?1:index<6?-1:1;
        const normal=side?new THREE.Vector3(sign,0,0):new THREE.Vector3(0,0,sign);
        const tangent=side?new THREE.Vector3(0,0,1):new THREE.Vector3(1,0,0);
        const tied=side?position(sign<0?x0:x1,eye.z):position(eye.x,sign<0?z0:z1);
        // Two turns go through the measured hole and around its crown. The pinned
        // part has zero mobility; deformation tapers only along the hanging legs.
        for(const turn of [-1,1]){
          const spread=radius*2.5,near=tied.clone().addScaledVector(tangent,turn*spread*1.6);
          const hole=eye.clone().addScaledVector(tangent,turn*radius*.3);
          const outer=hole.clone().addScaledVector(normal,radius*2.7);
          const over=eye.clone().add(new THREE.Vector3(0,h*.145+radius,0));
          const inner=over.clone().addScaledVector(normal,-radius*3.2);
          const path=curve([near,near.clone().lerp(hole,.6),hole,outer,over,inner,near.clone().addScaledVector(tangent,turn*radius*2)]);
          tube(path,radius*.74,0xf49a54,t=>t<1/3?1-t*3:t>5/6?(t-5/6)*6:0,32);
        }
        knot(tied,tangent,radius*1.9);
      });
      // Corner guys wrap the existing corner blocks rather than stopping in midair.
      corners.forEach(([x,z])=>{
        const p=position(x,z),outer=new THREE.Vector3(x<cx?-w*.44:w*.46,-h*.17,z<cz?-d*.46:d*.46);
        tube(curve([p,p.clone().lerp(outer,.5),outer,new THREE.Vector3(outer.x,-h*.38,outer.z),p.clone().add(new THREE.Vector3(radius*3,0,0))]),radius,0xe98039,t=>Math.abs(t-.5)*2,24);
      });
      const geometry=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
      geometry.computeBoundingBox();geometry.boundingBox!.min.y-=this.maxDepth*2;geometry.boundingBox!.max.y+=this.maxDepth;geometry.computeBoundingSphere();
      geometry.userData.shared=true;
      shared={geometry,...braidedMaps(),refs:0};shared.normal.userData.shared=shared.roughness.userData.shared=true;
      ropeResources.set(this.resourceKey,shared);
    }
    this.shared=shared;shared.refs++;
    this.material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.9,normalMap:shared.normal,normalScale:new THREE.Vector2(.6,.6),roughnessMap:shared.roughness});
    this.depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});this.distance=new THREE.MeshDistanceMaterial();
    for(const material of [this.material,this.depth,this.distance]){
      material.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,this.uniforms);shader.vertexShader=deform+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed.y+=netOffset(position.xz)*netMobility;`);
        if(material===this.material)shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
          float e=.005;
          float dx=(netOffset(position.xz+vec2(e,0.))-netOffset(position.xz-vec2(e,0.)))/(2.*e)*netMobility;
          float dz=(netOffset(position.xz+vec2(0.,e))-netOffset(position.xz-vec2(0.,e)))/(2.*e)*netMobility;
          objectNormal=normalize(vec3(objectNormal.x-dx*objectNormal.y,objectNormal.y,objectNormal.z-dz*objectNormal.y));
        `);
      };
      material.customProgramCacheKey=()=>`marine-rope-v2-${material.type}`;
    }
    this.mesh=new THREE.Mesh(shared.geometry,this.material);this.mesh.name='Woven ropes, knots and eight threaded lashings';
    this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.mesh.customDepthMaterial=this.depth;this.mesh.customDistanceMaterial=this.distance;
    this.group.add(this.mesh);
  }
  impact(x:number,z:number,speed:number) {
    const depth=this.maxDepth*THREE.MathUtils.clamp(speed/52,.5,1.25);
    const b=this.uniforms.netBounds.value;
    // A native rim contact transmits its load to the adjacent bound edge.
    this.uniforms.netImpact.value.set(THREE.MathUtils.clamp(x,b.x-b.z*.94,b.x+b.z*.94),THREE.MathUtils.clamp(z,b.y-b.w*.94,b.y+b.w*.94),depth,0);this.uniforms.netAge.value=0;
    this.diagnostics.impacts++;this.diagnostics.hit=[x,z];this.diagnostics.depth=depth;this.diagnostics.age=0;
  }
  update(dt:number) {this.uniforms.netAge.value=Math.min(2,this.uniforms.netAge.value+dt);this.diagnostics.age=this.uniforms.netAge.value;}
  get compression(){return this.uniforms.netPreview.value/this.maxDepth;}
  setCompression(value:number) {this.uniforms.netPreview.value=THREE.MathUtils.clamp(value,0,1)*this.maxDepth;}
  /** Portable workshop export: retain the same ropes and bake a compression morph.
   * Gameplay uses the live impact shader, which cannot be serialized in glTF. */
  bakeForExport() {
    const group=new THREE.Group();group.copy(this.group,false);
    const geometry=this.mesh.geometry.clone();geometry.userData.shared=false;
    const position=geometry.attributes.position,compressed=position.clone(),mobility=geometry.attributes.netMobility,b=this.uniforms.netBounds.value;
    for(let i=0;i<position.count;i++){
      const x=(position.getX(i)-b.x)/b.z,z=(position.getZ(i)-b.y)/b.w;
      const dome=Math.max(0,1-x*x)*Math.max(0,1-z*z);
      compressed.setY(i,position.getY(i)-(.18+.82*dome)*this.maxDepth*mobility.getX(i));
    }
    const deformed=geometry.clone();deformed.setAttribute('position',compressed);deformed.computeVertexNormals();
    geometry.morphAttributes.position=[compressed];geometry.morphAttributes.normal=[deformed.attributes.normal.clone()];deformed.dispose();
    const material=this.material.clone(),maps:THREE.Texture[]=[];
    // GLTFExporter merges metallic/roughness through a canvas and cannot draw a
    // DataTexture image directly. Make temporary export-only bitmap sources.
    for(const key of ['normalMap','roughnessMap'] as const){
      const source=material[key] as THREE.DataTexture,bitmap=document.createElement('canvas');
      bitmap.width=source.image.width;bitmap.height=source.image.height;
      const context=bitmap.getContext('2d')!,pixels=context.createImageData(bitmap.width,bitmap.height);
      pixels.data.set(source.image.data as Uint8Array);context.putImageData(pixels,0,0);
      const texture=new THREE.CanvasTexture(bitmap);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.flipY=false;
      material[key]=texture;maps.push(texture);
    }
    const mesh=new THREE.Mesh(geometry,material);mesh.name=this.mesh.name;
    mesh.morphTargetDictionary={compression:0};group.add(mesh);
    return{group,dispose:()=>{geometry.dispose();material.dispose();maps.forEach(t=>t.dispose());}};
  }
  dispose(){
    if(--this.shared.refs===0){this.shared.geometry.dispose();this.shared.normal.dispose();this.shared.roughness.dispose();ropeResources.delete(this.resourceKey);}
    this.material.dispose();this.depth.dispose();this.distance.dispose();this.group.removeFromParent();
  }
}

function braidedMaps() {
  const size=128,n=new Uint8Array(size*size*4),r=new Uint8Array(size*size*4);
  const height=(x:number,y:number)=>Math.sin((x/size*2-y/size*3)*Math.PI*2)*.65+Math.sin((x/size*14+y/size*9)*Math.PI*2)*.13;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const at=(y*size+x)*4,dx=(height(x+1,y)-height(x-1,y))*1.6,dy=(height(x,y+1)-height(x,y-1))*1.6;
    const normal=new THREE.Vector3(-dx,-dy,1).normalize();n.set([(normal.x*.5+.5)*255,(normal.y*.5+.5)*255,(normal.z*.5+.5)*255,255],at);
    const value=220+height(x,y)*24;r.set([value,value,value,255],at);
  }
  const texture=(data:Uint8Array<ArrayBuffer>)=>{const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;return t;};
  return{normal:texture(n),roughness:texture(r)};
}
