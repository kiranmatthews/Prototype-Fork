import * as THREE from 'three';
import {AssetCache} from './assetLifetime';
import {sceneryLoads} from './assetLoadQueue';

type P=[number,number,number];
const v=(p:P)=>new THREE.Vector3(...p);
const textureCache=new AssetCache<'timber',THREE.Texture>(async(_key,_dependency,wanted)=>{
  const map=await sceneryLoads.run(()=>new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/carlisle-piers/weathered-timber.png`),wanted);
  map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;return map;
},map=>map.dispose());

/** Continuous solid timbers. UVs measure circumference and length, not boards. */
function timberGeometry(round:boolean,variant=0){
  const sides=round?16:8,rings=round?13:4,positions:number[]=[],uv:number[]=[],indices:number[]=[];
  const square=[[-.4,-.5],[.4,-.5],[.5,-.4],[.5,.4],[.4,.5],[-.4,.5],[-.5,.4],[-.5,-.4]];
  for(let row=0;row<rings;row++){
    const t=round?row/(rings-1):[0,.035,.965,1][row],y=t-.5;
    const end=row===0||row===rings-1?.91:1;
    for(let side=0;side<=sides;side++){
      const a=(side%sides)/sides*Math.PI*2;
      const irregular=1+.045*Math.sin(a*3+variant*1.7)+.026*Math.sin(a*7+t*3+variant);
      const radius=(.51-.035*t)*irregular*end;
      const x=round?Math.cos(a)*radius+Math.sin(t*3+variant)*.014:square[side%sides][0]*end;
      const z=round?Math.sin(a)*radius+Math.sin(t*4+variant*.6)*.014:square[side%sides][1]*end;
      positions.push(x,y,z);uv.push(side/sides*(round?Math.PI:3.77),t);
      if(row&&side){const b=row*(sides+1)+side;indices.push(b-sides-2,b-1,b,b-sides-2,b,b-sides-1);}
    }
  }
  // Separate cap vertices retain a proper cut end rather than smoothed tips.
  for(const end of [0,1]){
    const row=end*(rings-1),start=positions.length/3;
    positions.push(0,end-.5,0);uv.push(.5,.5);
    for(let s=0;s<=sides;s++){
      const i=(row*(sides+1)+s)*3,x=positions[i],y=positions[i+1],z=positions[i+2];
      positions.push(x,y,z);uv.push(x+.5,z+.5);
      if(s){if(end)indices.push(start,start+s+1,start+s);else indices.push(start,start+s,start+s+1);}
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();return geo;
}

function timberMaterial(){
  const material=new THREE.MeshStandardMaterial({color:0xd3c6b7,roughness:.91,bumpScale:.065});material.name='Salt-weathered structural timber';
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec2 pierSeaEnds; varying vec3 pierWorld; varying float pierWaterY;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      vec2 pierMetric=uv;vec3 pierOrigin=vec3(0.);
      #ifdef USE_INSTANCING
        pierMetric*=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
        pierOrigin=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
      #endif
      // Fixed metres per tile, in each member's own long-axis direction.
      vec2 pierUv=pierMetric/vec2(3.1,8.5)+fract(pierOrigin.xz*vec2(.071,.037));
      #ifdef USE_MAP
        vMapUv=pierUv;
      #endif
      #ifdef USE_BUMPMAP
        vBumpMapUv=pierUv;
      #endif
    `);
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 pierVertex=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        pierVertex=instanceMatrix*pierVertex;
      #endif
      pierWorld=(modelMatrix*pierVertex).xyz;
      pierWaterY=mix(pierSeaEnds.x,pierSeaEnds.y,clamp(position.y+.5,0.,1.));
    `);
    shader.fragmentShader='varying vec3 pierWorld; varying float pierWaterY;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float pierDamp=1.-smoothstep(.12,1.8,pierWorld.y-pierWaterY+.16*sin(pierWorld.x*2.3+sin(pierWorld.z*3.1)));
      diffuseColor.rgb*=mix(vec3(1.),vec3(.32,.42,.37),pierDamp*.85);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.48,pierDamp);');
  };
  material.customProgramCacheKey=()=> 'carlisle-solid-pier-timber';return material;
}

type Member={a:P;b:P;width:number;role:'pile'|'ledger'|'brace'|'plate'|'bolt';sea:[number,number]};
type Batch={geometry:THREE.BufferGeometry;material:THREE.Material;parent:THREE.Group;matrices:THREE.Matrix4[];members:Member[]};

/** Visual structure only; no contacts, platforms, camera or motion state. */
export class CarlislePierTimber{
  readonly diagnostics={status:'idle',piles:0,ledgers:0,braces:0,plates:0,bolts:0,placedTriangles:0,colliders:0,errors:[]as string[]};
  private readonly assets=textureCache.scope();
  private readonly timber=timberMaterial();
  private readonly iron=new THREE.MeshStandardMaterial({color:0x233441,roughness:.72,metalness:.35});
  private readonly boltMetal=new THREE.MeshStandardMaterial({color:0x69665d,roughness:.65,metalness:.55});
  private readonly logs=[0,1,2].map(i=>timberGeometry(true,i));
  private readonly beam=timberGeometry(false);
  private readonly bolt=new THREE.CylinderGeometry(.5,.5,1,6);
  private readonly batches=new Map<string,Batch>();
  private readonly meshes:THREE.InstancedMesh[]=[];
  private disposed=false;
  private add(geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Group,matrix:THREE.Matrix4,member:Member){
    const key=`${geometry.uuid}:${material.uuid}:${parent.uuid}:${member.role}`;let batch=this.batches.get(key);
    if(!batch){batch={geometry,material,parent,matrices:[],members:[]};this.batches.set(key,batch);}batch.matrices.push(matrix);batch.members.push(member);
  }
  pile(top:P,height:number,sea:number,parent:THREE.Group){
    for(const [dx,dz,width,drop]of [[0,0,1.5,1],[-.55,.42,.7,1.5],[.55,.42,.7,1.5]]){
      const a:P=[top[0]+dx,top[1]-height-drop,top[2]+dz],b:P=[a[0],top[1]-drop,a[2]],center=v(a).add(v(b)).multiplyScalar(.5);
      const variant=Math.abs(Math.floor(top[0]*7+top[2]*3+dx*11))%3;
      const matrix=new THREE.Matrix4().compose(center,new THREE.Quaternion(),new THREE.Vector3(width,height,width));
      this.add(this.logs[variant],this.timber,parent,matrix,{a,b,width,role:'pile',sea:[sea,sea]});this.diagnostics.piles++;
    }
  }
  private member(a:P,b:P,width:number,role:'ledger'|'brace',sea:[number,number],parent:THREE.Group){
    const delta=v(b).sub(v(a)),length=delta.length();if(length<.1)return;
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    this.add(this.beam,this.timber,parent,new THREE.Matrix4().compose(v(a).add(v(b)).multiplyScalar(.5),q,new THREE.Vector3(width,length,width)),{a,b,width,role,sea});
    if(role==='ledger')this.diagnostics.ledgers++;else this.diagnostics.braces++;
  }
  private joint(at:P,normal:THREE.Vector3,sea:number,parent:THREE.Group){
    // Seat the plate outside the 1.5m log, flush with the crossing brace face.
    const center=v(at).addScaledVector(normal,.84),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    const point=center.toArray()as P;
    this.add(this.beam,this.iron,parent,new THREE.Matrix4().compose(center,q,new THREE.Vector3(1.15,1.5,.16)),{a:point,b:point,width:1.5,role:'plate',sea:[sea,sea]});this.diagnostics.plates++;
    const boltQ=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
    for(const dy of [-.39,.39]){
      const p=center.clone().addScaledVector(normal,.12);p.y+=dy;const a=p.toArray()as P;
      this.add(this.bolt,this.boltMetal,parent,new THREE.Matrix4().compose(p,boltQ,new THREE.Vector3(.22,.13,.22)),{a,b:a,width:.22,role:'bolt',sea:[sea,sea]});this.diagnostics.bolts++;
    }
  }
  /** One bay connects two posts of the same off-course quay, below its deck. */
  bay(a:P,b:P,sea:[number,number],parent:THREE.Group,index:number,outward=1){
    const upper=Math.min(a[1],b[1])-2.6,lower=Math.max(sea[0],sea[1])+1.25;
    const at=(p:P,y:number):P=>[p[0],y,p[2]];
    this.member(at(a,upper),at(b,upper),1.05,'ledger',sea,parent);
    if(upper-lower<2)return;
    const normal=v(b).sub(v(a)).cross(new THREE.Vector3(0,1,0)).normalize().multiplyScalar(outward);
    const bottom=Math.max(lower,upper-8.5);
    // Paired diagonal faces avoid coplanar crossed timbers at the centre.
    const offset=(p:P,side:number)=>v(p).addScaledVector(normal,side*.38).toArray()as P;
    this.member(offset(at(a,upper-.2),1),offset(at(b,bottom),1),.72,'brace',sea,parent);
    this.member(offset(at(b,upper-.2),-1),offset(at(a,bottom),-1),.72,'brace',[sea[1],sea[0]],parent);
    for(const p of [at(a,upper),at(b,upper),at(a,bottom),at(b,bottom)])this.joint(p,normal,p[2]===a[2]?sea[0]:sea[1],parent);
    if(bottom-lower>2.5){
      this.member(at(a,bottom),at(b,bottom),.8,'ledger',sea,parent);
      const start=index%2?a:b,end=index%2?b:a;
      this.member(at(start,bottom),at(end,lower),.8,'brace',index%2?sea:[sea[1],sea[0]],parent);
    }
  }
  async load(){
    this.diagnostics.status='loading';
    for(const batch of this.batches.values()){
      // Per-batch water heights allow long slopes without a repeated wet stripe.
      const geometry=batch.geometry.clone();geometry.setAttribute('pierSeaEnds',new THREE.InstancedBufferAttribute(new Float32Array(batch.members.flatMap(m=>m.sea)),2));
      const mesh=new THREE.InstancedMesh(geometry,batch.material,batch.matrices.length);mesh.name=`Solid pier ${batch.members[0].role}`;
      batch.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;
      mesh.userData.visualOnly=true;mesh.userData.pierTimber=batch.members;batch.parent.add(mesh);this.meshes.push(mesh);
      this.diagnostics.placedTriangles+=(geometry.index!.count/3)*mesh.count;
    }this.batches.clear();
    try{const map=await this.assets.load('timber');if(this.disposed)return;this.timber.map=map;this.timber.bumpMap=map;this.timber.needsUpdate=true;this.diagnostics.status='ready';}
    catch(e){if(!this.disposed){this.diagnostics.status='error';this.diagnostics.errors.push(String(e));}throw e;}
  }
  dispose(){this.disposed=true;for(const mesh of this.meshes){mesh.removeFromParent();mesh.dispose();mesh.geometry.dispose();}this.meshes.length=0;this.logs.forEach(g=>g.dispose());this.beam.dispose();this.bolt.dispose();this.timber.dispose();this.iron.dispose();this.boltMetal.dispose();this.assets.dispose();}
}
