import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import type { CloudRoadSection } from './cloudRoad';
import { SKYSTREAM_SUN } from './skystreamSun';

const WIDTH = 22, BOTTOM = -6.7, HEIGHT = 9.2, PERIOD = 23;
const NX = 128, NY = 64, NZ = 192;
const smoothMin = (a:number,b:number,k:number) => {
  const h=Math.max(k-Math.abs(a-b),0)/k;
  return Math.min(a,b)-h*h*k*.25;
};
let shared: {texture:THREE.Data3DTexture;empty:THREE.Data3DTexture;owners:number;buildMs:number}|undefined;

function emptyDistances(density:Uint8Array){
  const distance=new Float32Array(density.length);for(let i=0;i<distance.length;i++)distance[i]=density[i]?0:100;
  // Exact separable L1 distance, with a periodic longitudinal axis. L1/sqrt(3)
  // is a lower bound on Euclidean distance to every occupied density voxel.
  for(const [n,stride,step,lines] of [
    [NX,1,WIDTH/(NX-1),NY*NZ],[NY,NX,HEIGHT/(NY-1),NX*NZ],[NZ,NX*NY,PERIOD/NZ,NX*NY],
  ])for(let line=0;line<lines;line++){
    const base=stride===1?line*NX:stride===NX?line%NX+Math.floor(line/NX)*NX*NY:line;
    const periodic=stride===NX*NY;
    for(let i=1;i<n*(periodic?2:1);i++){
      const a=base+(i%n)*stride,b=base+((i-1)%n)*stride;distance[a]=Math.min(distance[a],distance[b]+step);
    }
    for(let i=n*(periodic?2:1)-2;i>=0;i--){
      const a=base+(i%n)*stride,b=base+((i+1)%n)*stride;distance[a]=Math.min(distance[a],distance[b]+step);
    }
  }
  const data=new Uint8Array(density.length);
  for(let i=0;i<data.length;i++)data[i]=Math.floor(Math.min(255,Math.max(0,distance[i]/Math.sqrt(3)-.3)*32));
  const texture=new THREE.Data3DTexture(data,NX,NY,NZ);texture.format=THREE.RedFormat;texture.type=THREE.UnsignedByteType;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.wrapR=THREE.RepeatWrapping;texture.unpackAlignment=1;texture.needsUpdate=true;
  return texture;
}

/** The same density construction as the bonus: merged billows, small curls,
 * three octaves of erosion and a shallow crown over independent collision.
 * One periodic volume is bent through the authored road frames. Neither the
 * density nor its silhouettes change with camera distance or reflection view. */
function acquireDensity() {
  if(!shared){
    const start=performance.now();let state=170932;
    const random=()=>{state=Math.imul(state,1664525)+1013904223|0;return (state>>>0)/4294967296;};
    const noise=new SimplexNoise({random});
    const lobes:{x:number;y:number;z:number;rx:number;ry:number;rz:number;rim:boolean}[]=[];
    for(let cell=0;cell<5;cell++)for(let row=-3;row<=3;row++){
      const rim=Math.abs(row)===3,x=row*(rim?2.45:2.8)+(random()-.5)*.6;
      const y=rim?-.65+random()*.3:-2.7+(random()-.5)*.9,z=(cell+random()*.5)*4.6;
      const rx=rim?1.9+random()*.65:2+random()*.9,ry=rim?1.35+random()*.5:2+random()*.85,rz=2.2+random()*.8;
      lobes.push({x,y,z,rx,ry,rz,rim});
      for(let j=0;j<3;j++){
        const a=random()*Math.PI*2,r=.55+random()*.65;
        lobes.push({x:x+Math.cos(a)*rx*.75,y:y+(random()-.5)*ry*1.4,z:z+Math.sin(a)*rz*.8,rx:r,ry:r*.9,rz:r,rim});
      }
    }
    const data=new Uint8Array(NX*NY*NZ);
    const periodicNoise=(x:number,y:number,z:number,f:number)=>{
      const blend=THREE.MathUtils.smoothstep(z,0,PERIOD);
      return THREE.MathUtils.lerp(noise.noise3d(x*f,y*f,z*f),noise.noise3d(x*f,y*f,(z-PERIOD)*f),blend);
    };
    for(let z=0;z<NZ;z++)for(let x=0;x<NX;x++){
      const px=(x/(NX-1)-.5)*WIDTH,pz=z/NZ*PERIOD;
      const nearby=lobes.map(b=>{let dz=pz-b.z;dz-=Math.round(dz/PERIOD)*PERIOD;return {...b,xz:((px-b.x)/b.rx)**2+(dz/b.rz)**2,m:Math.min(b.rx,b.ry,b.rz)};}).filter(b=>b.xz<(1+1.3/b.m)**2);
      const cap=.09+periodicNoise(px,2,pz,.65)*.055;
      for(let y=0;y<NY;y++){
        const py=BOTTOM+y/(NY-1)*HEIGHT;
        let body=(Math.sqrt((px/7)**2+((py+2.6)/3.1)**2)-1)*3.1,rim=10;
        for(const b of nearby){
          const d=(Math.sqrt(b.xz+((py-b.y)/b.ry)**2)-1)*b.m;
          if(b.rim)rim=smoothMin(rim,d,.52);else body=smoothMin(body,d,.52);
        }
        if(Math.min(body,rim)>.85)continue;
        const detail=periodicNoise(px,py,pz,.78)*.32+periodicNoise(px,py,pz,1.9)*.14+periodicNoise(px,py,pz,4.7)*.055;
        const d=smoothMin(Math.max(body+detail,py-cap),rim+detail,.45);
        data[x+NX*(y+NY*z)]=Math.round(THREE.MathUtils.smoothstep(-d,-.14,.32)*255);
      }
    }
    const texture=new THREE.Data3DTexture(data,NX,NY,NZ);
    texture.format=THREE.RedFormat;texture.type=THREE.UnsignedByteType;texture.unpackAlignment=1;
    texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.wrapR=THREE.RepeatWrapping;texture.needsUpdate=true;
    shared={texture,empty:emptyDistances(data),owners:0,buildMs:performance.now()-start};
  }
  const resource=shared;resource.owners++;let released=false;
  return {texture:resource.texture,empty:resource.empty,release:()=>{if(released)return;released=true;if(--resource.owners===0){resource.texture.dispose();resource.empty.dispose();shared=undefined;}}};
}

export function cloudRoadVolumeDiagnostics(){
  return {owners:shared?.owners??0,textures:shared?2:0,densityBytes:shared?.texture.image.data.byteLength??0,emptyBytes:shared?.empty.image.data.byteLength??0,buildMs:shared?.buildMs??0};
}

/** Diffuse transmittance varies more slowly than the visible density. Bake it
 * at each authored frame, retaining the full density for every camera ray.
 * This replaces eight shadow-ray texture reads per occupied camera sample
 * with one filtered lookup; it is independent of viewing distance. */
function bakeSun(texture:THREE.Data3DTexture,frames:{normal:THREE.Vector3;across:THREE.Vector3;tangent:THREE.Vector3;halfWidth:number}[],spacing:number,sun:THREE.Vector3){
  const density=texture.image.data as Uint8Array;
  const sample=(x:number,y:number,z:number)=>{
    const px=(x/WIDTH+.5)*(NX-1),py=(y-BOTTOM)/HEIGHT*(NY-1);
    if(px<=0||px>=NX-1||py<=0||py>=NY-1)return 0;
    const pz=((z/PERIOD)%1+1)%1*NZ,ix=Math.floor(px),iy=Math.floor(py),iz=Math.floor(pz);
    const fx=px-ix,fy=py-iy,fz=pz-iz,a=ix+NX*(iy+NY*iz),b=ix+NX*(iy+NY*((iz+1)%NZ));
    const lower=(density[a]*(1-fx)+density[a+1]*fx)*(1-fy)+(density[a+NX]*(1-fx)+density[a+NX+1]*fx)*fy;
    const upper=(density[b]*(1-fx)+density[b+1]*fx)*(1-fy)+(density[b+NX]*(1-fx)+density[b+NX+1]*fx)*fy;
    return (lower*(1-fz)+upper*fz)/255;
  };
  // Pack slices into a 2D atlas: the longest course component needs 1,688
  // frames, beyond the guaranteed WebGL2 3D-texture depth of 256. Bilinear XY
  // plus explicit Z interpolation gives the same trilinear light field.
  const nx=64,ny=32,nz=frames.length,columns=Math.min(32,nz),width=columns*nx,height=Math.ceil(nz/columns)*ny;
  const data=new Uint8Array(width*height*2);
  for(let z=0;z<nz;z++){
    const f=frames[z],sx=sun.dot(f.across)*7/f.halfWidth,sy=sun.dot(f.normal),sz=sun.dot(f.tangent),s=z*spacing;
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const px=(x/(nx-1)-.5)*WIDTH,py=BOTTOM+y/(ny-1)*HEIGHT;let depth=0;
      for(let j=0;j<8;j++){const distance=.35+j*.9;depth+=sample(px+sx*distance,py+sy*distance,s+sz*distance)*.9;}
      const i=(x+z%columns*nx+width*(y+Math.floor(z/columns)*ny))*2;
      data[i]=Math.round(Math.exp(-depth*.72)*255);data[i+1]=Math.round(Math.exp(-depth*.16)*255);
    }
  }
  const light=new THREE.DataTexture(data,width,height,THREE.RGFormat,THREE.UnsignedByteType);
  light.minFilter=light.magFilter=THREE.LinearFilter;light.unpackAlignment=1;light.needsUpdate=true;return light;
}

export function createCloudRoadVolume(sections:CloudRoadSection[],flatHalf?:number,gutterRadius=2.4,sunDirection=SKYSTREAM_SUN):THREE.Group{
  const root=new THREE.Group();root.name='Continuous volumetric cloud road';root.userData.cloudRoadVisual=true;
  root.userData.cloudRoadSource={sections,flatHalf,gutterRadius,sunDirection};
  const lengths=[0];for(let i=1;i<sections.length;i++)lengths.push(lengths[i-1]+sections[i].point.distanceTo(sections[i-1].point));
  const total=lengths[lengths.length-1];if(!(total>.01))return root;
  const count=Math.ceil(total/.65)+1,spacing=total/(count-1),data=new Float32Array(count*8);
  const frames:{point:THREE.Vector3;normal:THREE.Vector3;across:THREE.Vector3;tangent:THREE.Vector3;halfWidth:number}[]=[];
  let cursor=0;const previousQuaternion=new THREE.Quaternion();
  for(let i=0;i<count;i++){
    const s=i*spacing;while(cursor<sections.length-2&&lengths[cursor+1]<s)cursor++;
    const a=sections[cursor],b=sections[cursor+1],t=THREE.MathUtils.clamp((s-lengths[cursor])/(lengths[cursor+1]-lengths[cursor]||1),0,1);
    const point=a.point.clone().lerp(b.point,t),normal=a.normal.clone().lerp(b.normal,t).normalize();
    const across=a.across.clone().lerp(b.across,t);across.addScaledVector(normal,-across.dot(normal)).normalize();
    const tangent=normal.clone().cross(across);if(tangent.dot(b.point.clone().sub(a.point))<0)tangent.negate();
    const halfWidth=THREE.MathUtils.lerp(a.halfWidth,b.halfWidth,t);frames.push({point,normal,across,tangent,halfWidth});
    const zAxis=across.clone().cross(normal),quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,normal,zAxis));
    if(i>0&&previousQuaternion.dot(quaternion)<0)quaternion.set(-quaternion.x,-quaternion.y,-quaternion.z,-quaternion.w);
    previousQuaternion.copy(quaternion);
    data.set([...point.toArray(),halfWidth*(zAxis.dot(tangent)<0?-1:1),...quaternion.toArray()],i*8);
  }
  const frameTexture=new THREE.DataTexture(data,2,count,THREE.RGBAFormat,THREE.FloatType);frameTexture.needsUpdate=true;
  const density=acquireDensity();
  const light=bakeSun(density.texture,frames,spacing,sunDirection);
  const material=new THREE.ShaderMaterial({name:'Full cumulus road · density and sun scattering',glslVersion:THREE.GLSL3,
    transparent:true,depthWrite:true,side:THREE.BackSide,fog:true,
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),uDensity:{value:density.texture},uEmpty:{value:density.empty},uSkipEmpty:{value:true},uLight:{value:light},uLiveLighting:{value:false},uFrames:{value:frameTexture},
      uSpacing:{value:spacing},uCount:{value:count},uLength:{value:total},uSun:{value:sunDirection.clone()},
      uFlat:{value:flatHalf??-1},uGutter:{value:gutterRadius},uMin:{value:new THREE.Vector3()},uMax:{value:new THREE.Vector3()},
      uRange:{value:new THREE.Vector2()},uChord:{value:new THREE.Vector3()},uStart:{value:new THREE.Vector3()},
      uStartNormal:{value:new THREE.Vector3()},uEnd:{value:new THREE.Vector3()},uEndNormal:{value:new THREE.Vector3()}},
    vertexShader:`varying vec3 vOrigin;varying vec3 vDirection;
void main(){vOrigin=(inverse(modelMatrix)*vec4(cameraPosition,1.0)).xyz;vDirection=position-vOrigin;
gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`precision highp sampler3D;
out vec4 cloudOutput;
#define gl_FragColor cloudOutput
uniform sampler3D uDensity,uEmpty;uniform sampler2D uFrames,uLight;uniform bool uLiveLighting,uSkipEmpty;
uniform float uSpacing,uCount,uLength,uFlat,uGutter;
uniform vec3 uMin,uMax,uSun,uChord,uStart,uEnd,uStartNormal,uEndNormal;uniform vec2 uRange;
uniform mat4 modelViewMatrix,projectionMatrix;
varying vec3 vOrigin,vDirection;
#include <fog_pars_fragment>
struct Frame{vec3 p;vec3 x;vec3 y;vec3 z;float w;};
Frame frameAt(float s){
  float index=clamp(s/uSpacing,0.0,uCount-1.001);int i=int(index);float f=fract(index);
  vec4 p=mix(texelFetch(uFrames,ivec2(0,i),0),texelFetch(uFrames,ivec2(0,i+1),0),f);
  vec4 q=normalize(mix(texelFetch(uFrames,ivec2(1,i),0),texelFetch(uFrames,ivec2(1,i+1),0),f));
  vec3 x=vec3(1.0-2.0*(q.y*q.y+q.z*q.z),2.0*(q.x*q.y+q.z*q.w),2.0*(q.x*q.z-q.y*q.w));
  vec3 y=vec3(2.0*(q.x*q.y-q.z*q.w),1.0-2.0*(q.x*q.x+q.z*q.z),2.0*(q.y*q.z+q.x*q.w));
  vec3 z=cross(x,y)*sign(p.w);
  p.xyz+=z*(s-clamp(s,0.0,uLength));return Frame(p.xyz,x,y,z,abs(p.w));
}
float densityAt(vec3 q){
  vec3 uv=vec3(q.x/22.0+.5,(q.y+6.7)/9.2,q.z/23.0);
  if(uv.x<=0.0||uv.x>=1.0||uv.y<=0.0||uv.y>=1.0)return 0.0;
  // XY samples include both boundary texels; Z is periodic without a duplicate.
  uv.xy=uv.xy*vec2(127.0/128.0,63.0/64.0)+vec2(.5/128.0,.5/64.0);uv.z+=.5/192.0;
  return texture(uDensity,uv).r;
}
void main(){
  vec3 ray=normalize(vDirection),inv=1.0/ray;
  vec3 a=(uMin-vOrigin)*inv,b=(uMax-vOrigin)*inv,near=min(a,b),far=max(a,b);
  float start=max(0.0,max(max(near.x,near.y),near.z)),end=min(min(far.x,far.y),far.z);
  if(end<=start)discard;
  // Integrate the same world-anchored ray samples on both sides of a chunk
  // boundary. The first visible density assigns the whole ray to one chunk;
  // cutting a translucent integral in half leaves visible rectangular seams.
  start=max(0.0,start-6.0);end+=6.0;
  float ds=.2;
  float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
  start=(ceil(start/ds)+jitter)*ds;
  vec4 sum=vec4(0.0);float first=end,owner=0.0;bool hit=false,assigned=false;
  float s=uRange.x+dot(vOrigin+ray*start-uStart,uChord);Frame frame=frameAt(s);
  for(int j=0;j<4;j++){s+=dot(vOrigin+ray*start-frame.p,frame.z);frame=frameAt(s);}
  for(int i=0;i<320;i++){
    float t=start+float(i)*ds;if(t>end)break;vec3 point=vOrigin+ray*t;
    s+=dot(point-frame.p,frame.z);frame=frameAt(s);
    s+=dot(point-frame.p,frame.z);frame=frameAt(s);
    vec3 delta=point-frame.p;float x=dot(delta,frame.x),y=dot(delta,frame.y);
    if(uFlat>=0.0){float edge=min(frame.w-uFlat,max(0.0,abs(x)-uFlat));y-=uGutter-sqrt(max(.01,uGutter*uGutter-edge*edge));}
    vec3 q=vec3(x*7.0/frame.w,y,s);
    float cloud=densityAt(q);
    float cap=max(-s,s-uLength);if(cap>0.0)cloud*=1.0-smoothstep(0.0,1.35,cap);
    if(cloud<.006){
      if(uSkipEmpty){
        vec2 uv=vec2(q.x/22.0+.5,(q.y+6.7)/9.2);
        vec2 outside=max(vec2(0.0),max(-uv,uv-1.0))*vec2(22.0,9.2);
        vec3 lookup=vec3(clamp(uv,0.0,1.0)*vec2(127.0/128.0,63.0/64.0)+vec2(.5/128.0,.5/64.0),q.z/23.0+.5/192.0);
        float clearance=max(length(outside),texture(uEmpty,lookup).r*255.0/32.0);
        // Allow for the curved/gutter frame's coordinate stretch. Skips end on
        // the same .2 m integration grid; occupied samples are never thinned.
        int skip=int(floor(min(1.6,clearance*.25)/ds));i+=max(0,skip-1);
      }
      continue;
    }
    float lightFrame=clamp(s/uSpacing,0.0,uCount-1.001),slice=floor(lightFrame),columns=min(32.0,uCount);
    vec2 lightUv=clamp(vec2(q.x/22.0+.5,(q.y+6.7)/9.2),0.0,1.0)*vec2(63.0,31.0)+.5;
    vec2 lightSize=vec2(textureSize(uLight,0));
    vec2 offsetA=vec2(mod(slice,columns)*64.0,floor(slice/columns)*32.0);
    vec2 offsetB=vec2(mod(slice+1.0,columns)*64.0,floor((slice+1.0)/columns)*32.0);
    vec2 lighting=mix(texture(uLight,(offsetA+lightUv)/lightSize).rg,texture(uLight,(offsetB+lightUv)/lightSize).rg,fract(lightFrame));
    if(uLiveLighting){
      vec3 sun=vec3(dot(uSun,frame.x)*7.0/frame.w,dot(uSun,frame.y),dot(uSun,frame.z));
      float depth=0.0;for(int j=0;j<8;j++)depth+=densityAt(q+sun*(.35+float(j)*.9))*.9;
      lighting=vec2(exp(-depth*.72),exp(-depth*.16));
    }
    float direct=lighting.x,broad=lighting.y;
    vec3 light=vec3(.30,.40,.56)*.65+vec3(1.0,.97,.91)*(direct*.49+broad*.27);
    light+=vec3(.09,.10,.12)*(1.0-cloud)*direct;
    float alpha=1.0-exp(-cloud*ds*2.5),weight=(1.0-sum.a)*alpha;
    sum.rgb+=weight*light;sum.a+=weight;
    if(!assigned&&sum.a>.015){owner=s;assigned=true;if(owner<uRange.x-.005||owner>uRange.y+.005)discard;}
    if(!hit&&sum.a>.08){first=t;hit=true;}if(sum.a>.995)break;
  }
  if(sum.a<.015||owner<uRange.x-.005||owner>uRange.y+.005)discard;
  vec4 view=modelViewMatrix*vec4(vOrigin+ray*first,1.0),clip=projectionMatrix*view;
  gl_FragDepth=clip.z/clip.w*.5+.5;gl_FragColor=vec4(sum.rgb/max(sum.a,.001),sum.a);
  #ifdef USE_FOG
    gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,smoothstep(fogNear,fogFar,-view.z));
  #endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`});
  let disposed=false;material.addEventListener('dispose',()=>{if(disposed)return;disposed=true;frameTexture.dispose();light.dispose();density.release();});
  const chunkSteps=38;
  for(let first=0;first<count-1;first+=chunkSteps){
    const last=Math.min(count-1,first+chunkSteps),f0=frames[first],f1=frames[last];
    const start=f0.point.clone().addScaledVector(f0.tangent,first===0?-1.35:0),end=f1.point.clone().addScaledVector(f1.tangent,last===count-1?1.35:0);
    const range=new THREE.Vector2(first*spacing-(first===0?1.35:0),last*spacing+(last===count-1?1.35:0));
    const chord=end.clone().sub(start).normalize(),bounds=new THREE.Box3();
    for(let i=first;i<=last;i++)for(const x of [-1,1])for(const y of [BOTTOM,BOTTOM+HEIGHT+(flatHalf===undefined?0:gutterRadius)]){
      const f=frames[i];bounds.expandByPoint(f.point.clone().addScaledVector(f.across,x*WIDTH/2*f.halfWidth/7).addScaledVector(f.normal,y));
    }
    bounds.expandByScalar(1.5);
    const size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());
    const geometry=new THREE.BoxGeometry(size.x,size.y,size.z);geometry.translate(...centre.toArray());
    const mesh=new THREE.Mesh(geometry,material);mesh.name='Cumulus road · full density';
    mesh.userData.cloudRoadVisual=true;mesh.userData.cloudRoadVolume=true;mesh.userData.visualOnly=true;
    mesh.userData.castShadow=false;mesh.userData.edgeGrinding=false;mesh.userData.raySamples=320;mesh.userData.rayStep=.2;
    mesh.userData.volumeChunk={min:bounds.min,max:bounds.max,range,chord,start,end,startNormal:f0.tangent,endNormal:f1.tangent};
    mesh.onBeforeRender=(_renderer,_scene,_camera,_geometry,usedMaterial)=>{
      const shader=usedMaterial as THREE.ShaderMaterial,c=mesh.userData.volumeChunk;
      if(!shader.uniforms?.uRange)return;
      shader.uniforms.uMin.value.copy(c.min);shader.uniforms.uMax.value.copy(c.max);shader.uniforms.uRange.value.copy(c.range);
      shader.uniforms.uChord.value.copy(c.chord);shader.uniforms.uStart.value.copy(c.start);shader.uniforms.uEnd.value.copy(c.end);
      shader.uniforms.uStartNormal.value.copy(c.startNormal);shader.uniforms.uEndNormal.value.copy(c.endNormal);
      shader.uniformsNeedUpdate=true;
    };
    root.add(mesh);
  }
  root.userData.frameBytes=data.byteLength;root.userData.densityBytes=NX*NY*NZ;root.userData.lightingBytes=light.image.data.byteLength;
  return root;
}
