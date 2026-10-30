import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {AssetCache} from './assetLifetime';
import {sceneryLoads} from './assetLoadQueue';

type P=[number,number,number];
const paintCache=new AssetCache<'navy',THREE.Texture>(async(_key,_dependency,wanted)=>{
  const map=await sceneryLoads.run(()=>new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/carlisle-steel/weathered-navy.png`),wanted);
  map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;map.userData.shared=true;return map;
},map=>map.dispose());

/** A solid chamfered plate, with a fixed metre-sized bevel on every edge. */
function plate(w:number,h:number,d:number,bevel=.035){
  const b=Math.min(bevel,w/5,h/4,d/5),positions:number[]=[];
  const ring=(y:number,inset:number)=>{
    const x=w/2-inset,z=d/2-inset,c=Math.min(b,x/3,z/3);
    return[[-x+c,y,-z],[x-c,y,-z],[x,y,-z+c],[x,y,z-c],[x-c,y,z],[-x+c,y,z],[-x,y,z-c],[-x,y,-z+c]];
  };
  const rings=[ring(-h/2,b),ring(-h/2+b,0),ring(h/2-b,0),ring(h/2,b)];
  const tri=(a:number[],b:number[],c:number[])=>positions.push(...a,...b,...c);
  for(let j=0;j<3;j++)for(let i=0;i<8;i++){
    const k=(i+1)%8,a=rings[j][i],b=rings[j][k],c=rings[j+1][k],e=rings[j+1][i];tri(a,c,b);tri(a,e,c);
  }
  for(let i=0;i<8;i++){const k=(i+1)%8;tri([0,-h/2,0],rings[0][i],rings[0][k]);tri([0,h/2,0],rings[3][k],rings[3][i]);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  return geometry;
}

type Template={size:P;panels:number;girders:number;fasteners:number;parts:{geometry:THREE.BufferGeometry;material:THREE.Material;name:string}[];triangles:number};

/** Complete visual shells inside the native moving boxes. No collision or motion. */
export class CarlisleSteelDecks{
  readonly diagnostics={status:'idle',decks:0,templates:0,panels:0,girders:0,fasteners:0,placedTriangles:0,colliders:0,errors:[]as string[]};
  private readonly assets=paintCache.scope();
  private readonly paint=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.74,metalness:.38,vertexColors:true,bumpScale:.012});
  private readonly frame=new THREE.MeshStandardMaterial({color:0x8497a8,roughness:.8,metalness:.42,vertexColors:true,bumpScale:.014});
  private readonly orange=new THREE.MeshStandardMaterial({color:0xbe5426,roughness:.7,metalness:.3,vertexColors:true,bumpScale:.008});
  private readonly metal=new THREE.MeshStandardMaterial({color:0x687785,roughness:.58,metalness:.68,vertexColors:true});
  private readonly templates=new Map<string,Template>();
  private readonly groups:THREE.Group[]=[];
  private disposed=false;
  constructor(){
    for(const m of [this.paint,this.frame,this.orange,this.metal])m.userData.shared=true;
    this.paint.name='Weathered navy deck plates';this.frame.name='Marine steel frame';this.orange.name='Burnt-orange edge caps';this.metal.name='Recessed hex fasteners';
  }
  private template(size:P){
    const key=size.join(':');let template=this.templates.get(key);if(template)return template;
    const [w,h,d]=size,top=h/2,rim=.65,parts=new Map<THREE.Material,THREE.BufferGeometry[]>();
    let panels=0,girders=0,fasteners=0,serial=0;
    const add=(geometry:THREE.BufferGeometry,p:P,material:THREE.Material,tone=1)=>{
      const position=geometry.attributes.position,normal=geometry.attributes.normal,uv:number[]=[],colors:number[]=[];
      // Metre-scale maps follow each solid member. Unequal deterministic offsets
      // stop every panel repeating the same prominent paint chips.
      const u=(serial*.317)%1,v=(serial++*.619)%1;
      for(let i=0;i<position.count;i++){
        const x=position.getX(i),y=position.getY(i),z=position.getZ(i),nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
        const a=ny>=nx&&ny>=nz?x:nx>nz?z:x,b=ny>=nx&&ny>=nz?z:y;uv.push(a/5+u,b/5+v);colors.push(tone,tone,tone);
      }
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.translate(...p);
      const batch=parts.get(material)??[];batch.push(geometry);parts.set(material,batch);
    };
    const box=(p:P,s:P,m:THREE.Material,bevel=.035,tone=1)=>add(plate(...s,bevel),p,m,tone);
    const bolt=(x:number,z:number)=>{add(new THREE.CylinderGeometry(.105,.105,.055,6).toNonIndexed(),[x,top-.0325,z],this.metal);fasteners++;};
    // Continuous backing shows through the narrow recessed seams. Its highest
    // face is below the plate tops, never coplanar with them.
    box([0,top-.23,0],[w-rim*2,.18,d-rim*2],this.frame,.02);
    const nx=Math.ceil((w-rim*2)/3.8),nz=Math.ceil((d-rim*2)/5.2),pw=(w-rim*2)/nx,pd=(d-rim*2)/nz;
    for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
      const tone=.95+.09*((x*7+z*11)%13)/12;
      box([-w/2+rim+(x+.5)*pw,top-.09,-d/2+rim+(z+.5)*pd],[pw-.025,.18,pd-.025],this.paint,.025,tone);panels++;
    }
    // Long I-section edge members remain inside the original 1.4m box depth.
    for(const side of [-1,1]){
      const x=side*(w/2-.31);
      box([x,0,0],[.14,h-.48,d],this.frame);
      box([x,top-.18,0],[.62,.24,d],this.frame);
      box([x,-h/2+.12,0],[.62,.24,d],this.frame);girders++;
      box([side*(w/2-.105),top-.0425,0],[.12,.035,d-.1],this.orange,.007);
      for(let z=-d/2+1.1;z<d/2-.6;z+=4.6)bolt(x,z);
      for(const end of [-1,1])box([x,top-.05,end*(d/2-1.7)],[.62,.04,3.2],this.orange,.009);
    }
    for(const end of [-1,1]){
      const z=end*(d/2-.31);
      box([0,0,end*(d/2-.075)],[w-.62,h,.15],this.frame,.025);
      box([0,top-.18,z],[w-.62,.24,.62],this.frame);
      box([0,top-.0425,end*(d/2-.105)],[w-.65,.035,.12],this.orange,.007);
      for(let x=-w/2+1.4;x<w/2-1;x+=4.6)bolt(x,z);
      for(const side of [-1,1])box([side*(w/2-1.5),top-.05,z],[2.3,.04,.62],this.orange,.009);
    }
    const crossCount=Math.max(2,Math.ceil((d-1)/5.2));
    for(let i=1;i<crossCount;i++){
      const z=-d/2+i*d/crossCount;
      box([0,-.14,z],[w-1.24,h-.52,.13],this.frame,.025);
      box([0,-h/2+.09,z],[w-1.24,.18,.48],this.frame,.025);
      box([0,top-.4,z],[w-1.24,.16,.48],this.frame,.025);girders++;
    }
    const merged:Template['parts']=[];let triangles=0;
    for(const [material,pieces]of parts){
      const geometry=mergeGeometries(pieces,false)!;pieces.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.shared=true;
      triangles+=geometry.attributes.position.count/3;merged.push({geometry,material,name:material.name});
    }
    template={size:[...size],panels,girders,fasteners,parts:merged,triangles};this.templates.set(key,template);this.diagnostics.templates=this.templates.size;return template;
  }
  add(size:P,parent:THREE.Object3D){
    const t=this.template(size),group=new THREE.Group();group.name='Plated marine steel deck';group.userData.visualOnly=true;group.userData.steelDeck={size:[...size],panels:t.panels,girders:t.girders,fasteners:t.fasteners};
    for(const part of t.parts){const mesh=new THREE.Mesh(part.geometry,part.material);mesh.name=part.name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
    parent.add(group);this.groups.push(group);this.diagnostics.decks++;this.diagnostics.panels+=t.panels;this.diagnostics.girders+=t.girders;this.diagnostics.fasteners+=t.fasteners;this.diagnostics.placedTriangles+=t.triangles;
  }
  async load(){
    if(!this.groups.length)return;
    this.diagnostics.status='loading';
    try{const map=await this.assets.load('navy');if(this.disposed)return;
      for(const m of [this.paint,this.frame]){m.map=map;m.bumpMap=map;m.needsUpdate=true;}
      this.orange.bumpMap=map;this.orange.needsUpdate=true;this.diagnostics.status='ready';
    }catch(error){if(!this.disposed){this.diagnostics.status='error';this.diagnostics.errors.push(String(error));}throw error;}
  }
  dispose(){
    this.disposed=true;this.groups.forEach(g=>g.removeFromParent());this.groups.length=0;
    for(const t of this.templates.values())for(const p of t.parts)p.geometry.dispose();this.templates.clear();
    for(const m of [this.paint,this.frame,this.orange,this.metal])m.dispose();this.assets.dispose();
  }
}
