import * as THREE from 'three';
import type {CartState} from './physics';
import {CART_RALLY_LENGTH,cartRallyFrame,rallySurfacePoint} from '../levels/cart-stadium-layout';

interface Contact {x:number;y:number;z:number;s:number;travel:number;}
interface Chunk {mesh:THREE.Mesh;position:THREE.BufferAttribute;uv:THREE.BufferAttribute;stamp:THREE.BufferAttribute;next:number;count:number;dirty:boolean;last:number;}
const CHUNK_LENGTH=100,CAPACITY=1024,SPACING=.95,LIFE=110;
/** Real wheel histories, bounded separately along the course. Four vertices per
 * segment, analytic tread, no render targets, texture uploads or physics writes. */
export class RallyMudTracks {
 readonly root=new THREE.Group();
 private readonly clock={value:0};
 private readonly material=new THREE.MeshStandardMaterial({color:'#633619',roughness:.78,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 private readonly chunks:Chunk[]=[];
 private readonly contacts:(Contact|null)[]=[];
 private made=0;
 constructor(){
  this.root.name='Persistent rally tyre tracks';
  this.material.onBeforeCompile=s=>{
   s.uniforms.uTrackTime=this.clock;
   s.vertexShader='attribute float trackBirth;varying float vTrackAge;varying vec2 vTrackUv;uniform float uTrackTime;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTrackAge=uTrackTime-trackBirth;vTrackUv=uv;');
   s.fragmentShader='varying float vTrackAge;varying vec2 vTrackUv;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',/* glsl */`
    #include <color_fragment>
    float edge=abs(vTrackUv.x*2.0-1.0);
    float shoulder=sin(vTrackUv.y*31.0+vTrackUv.x*4.0)*.055;
    float outline=1.0-smoothstep(.78+shoulder,1.0,edge);
    float tread=1.0-smoothstep(.26,.48,abs(fract(vTrackUv.y*4.7+abs(vTrackUv.x-.5)*.95)-.5));
    float rim=smoothstep(.63,.85,edge)*(1.0-smoothstep(.84,.98,edge));
    diffuseColor.rgb*=.63+tread*.49+rim*.85;
    diffuseColor.a*=outline*(.43+tread*.24)*(1.0-smoothstep(70.0,${LIFE.toFixed(1)},vTrackAge));
    if(diffuseColor.a<.012)discard;
   `);
  };
  this.material.customProgramCacheKey=()=> 'rally-wheel-history-v1';
  for(let i=0;i<Math.ceil((CART_RALLY_LENGTH+60)/CHUNK_LENGTH);i++){
   const g=new THREE.BufferGeometry(),position=new THREE.BufferAttribute(new Float32Array(CAPACITY*12),3),uv=new THREE.BufferAttribute(new Float32Array(CAPACITY*8),2),stamp=new THREE.BufferAttribute(new Float32Array(CAPACITY*4),1);
   for(const a of [position,uv,stamp])a.setUsage(THREE.DynamicDrawUsage);
   const indices=new Uint16Array(CAPACITY*6);for(let j=0;j<CAPACITY;j++){const n=j*4;indices.set([n,n+1,n+2,n+1,n+3,n+2],j*6);}
   g.setAttribute('position',position);g.setAttribute('uv',uv);g.setAttribute('trackBirth',stamp);g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(CAPACITY*12),3));g.setIndex(new THREE.BufferAttribute(indices,1));g.setDrawRange(0,0);
   const normals=g.getAttribute('normal');for(let j=0;j<CAPACITY*4;j++)normals.setY(j,1);
   const bounds=new THREE.Box3();for(let at=i*CHUNK_LENGTH-8;at<=(i+1)*CHUNK_LENGTH+8;at+=4)for(const u of [-28,0,28])bounds.expandByPoint(new THREE.Vector3(...rallySurfacePoint(at,u)));
   bounds.expandByScalar(3);g.boundingBox=bounds;g.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
   const mesh=new THREE.Mesh(g,this.material);mesh.name=`Tyre tracks ${i}`;mesh.receiveShadow=true;mesh.renderOrder=1;mesh.visible=false;this.root.add(mesh);
   this.chunks.push({mesh,position,uv,stamp,next:0,count:0,dirty:false,last:-LIFE});
  }
 }
 private contact(x:number,z:number,travel:number):Contact{
  let s=-z,u=0;
  for(let n=0;n<4;n++){const f=cartRallyFrame(s);u=(x-f.x)*f.n;s=-z+u*f.nz;}
  const p=rallySurfacePoint(s,u);return {x,y:p[1]+.025,z,s,travel};
 }
 update(time:number,carts:readonly CartState[],owners:readonly number[]){
  this.clock.value=time;
  for(let i=0;i<carts.length;i++){
   const c=carts[i],active=owners[i]>=0&&c.health>0&&c.grounded&&!c.tumbling&&Math.abs(c.speed)>2;
   const sn=Math.sin(c.yaw),cs=Math.cos(c.yaw);
   for(let wheel=0;wheel<2;wheel++){
    const id=i*2+wheel,old=this.contacts[id];
    if(!active){this.contacts[id]=null;continue;}
    const side=wheel?1:-1,x=c.x+cs*side*.925+sn*1.075,z=c.z-sn*side*.925+cs*1.075;
    const distance=old?Math.hypot(x-old.x,z-old.z):0;
    if(old&&distance<SPACING)continue;
    const next=this.contact(x,z,c.travel);
    // Never bridge a jump, teleport, tall wall, or detached wheel.
    if(Math.abs(next.y-c.y)>1.0){this.contacts[id]=null;continue;}
    this.contacts[id]=next;
    if(!old||distance>3||Math.abs(next.y-old.y)>1.25)continue;
    const chunk=this.chunks[Math.floor(Math.max(0,Math.min(CART_RALLY_LENGTH+40,next.s))/CHUNK_LENGTH)];
    if(!chunk)continue;
    const dx=(next.x-old.x)/distance,dz=(next.z-old.z)/distance,width=.23,n=chunk.next*4;
    for(let end=0;end<2;end++)for(let side=0;side<2;side++){
     const p=end?next:old,sign=side?1:-1,at=n+end*2+side;
     chunk.position.setXYZ(at,p.x-dz*width*sign,p.y,p.z+dx*width*sign);
     chunk.uv.setXY(at,side,p.travel);chunk.stamp.setX(at,time);
    }
    // Keep at most one pending upload range even while a chunk is culled.
    // WebGL clears ranges after upload; multiple simulation ticks merge here.
    for(const [attribute,start,count]of [[chunk.position,n*3,12],[chunk.uv,n*2,8],[chunk.stamp,n,4]] as const){
     const pending=attribute.updateRanges[0];
     if(pending){const end=Math.max(pending.start+pending.count,start+count);pending.start=Math.min(pending.start,start);pending.count=end-pending.start;}
     else attribute.addUpdateRange(start,count);
    }
    chunk.last=time;chunk.next=(chunk.next+1)%CAPACITY;chunk.count=Math.min(CAPACITY,chunk.count+1);chunk.dirty=true;this.made++;
   }
  }
  for(const chunk of this.chunks){
   if(time-chunk.last>=LIFE)chunk.mesh.visible=false;
   if(!chunk.dirty)continue;
   chunk.mesh.visible=true;chunk.mesh.geometry.setDrawRange(0,chunk.count*6);
   chunk.position.needsUpdate=true;chunk.uv.needsUpdate=true;chunk.stamp.needsUpdate=true;chunk.dirty=false;
  }
 }
 get diagnostics(){return {segments:this.chunks.reduce((n,c)=>n+c.count,0),emitted:this.made,capacity:this.chunks.length*CAPACITY,chunks:this.chunks.length,bytes:this.chunks.length*CAPACITY*(12*2+8+4+3)*4};}
 dispose(){this.root.removeFromParent();for(const c of this.chunks)c.mesh.geometry.dispose();this.material.dispose();this.contacts.length=0;}
}
