import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AssetCache,disposeTextures} from './assetLifetime';
import {sceneryLoads} from './assetLoadQueue';
import {carlislePoint} from './levels/carlisle-tidal-relay';

type Kind='dune-bank'|'marsh-bank';
export type CoastalBank={kind:Kind;station:number;offset:number;width:number;turn:number;submerge:number};

/** Unequal connected reaches and open inlets, rather than evenly spaced dots. */
export const CARLISLE_COASTAL_BANKS:CoastalBank[]=[
  [-180,-345,185,.2],[-35,-330,190,-.15],[110,-355,205,.35],[260,-345,180,-.3],[395,-365,200,.1],[545,-380,180,.5],
  [80,-465,235,-.5],[380,-490,245,.8],
  [865,-335,180,-.45],[995,-355,190,.2],[1130,-380,185,-.15],[1255,-405,160,.6],
  [1465,-375,200,-.3],[1615,-355,190,.3],[1760,-390,205,-.6],[1920,-370,185,.25],
  [2080,-395,190,-.1],[2235,-360,200,.45],[2390,-385,185,-.45],[2540,-410,165,.2],
  [1680,-510,250,.8],[2050,-510,225,-.7],[2400,-505,230,.5],
  [2815,-350,195,-.4],[2960,-390,185,.35],
  [3230,-375,200,.65],[3370,-410,160,-.25],
  [3710,-345,190,-.25],[3850,-365,195,.35],[3995,-345,205,-.3],[4150,-380,200,.2],
  [3900,-490,250,.75],
].map(([station,offset,width,turn],i)=>({kind:i%3===1?'marsh-bank':'dune-bank',station,offset,width,turn,submerge:1.7+(i%3)*.3}));

const cache=new AssetCache<Kind,GLTF>(async(key,_dependency,wanted)=>{
  const gltf=await sceneryLoads.run(()=>new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}props/carlisle-coast/${key}.glb`),wanted);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(n=>{const m=n as THREE.Mesh;if(!m.isMesh)return;
    m.geometry.userData.shared=true;
    for(const a of Array.isArray(m.material)?m.material:[m.material]){
      a.userData.shared=true;
      for(const t of Object.values(a))if(t?.isTexture){t.userData.shared=true;t.anisotropy=8;}
      const pbr=a as THREE.MeshStandardMaterial;if(pbr.isMeshStandardMaterial){pbr.roughness=Math.max(.85,pbr.roughness);pbr.metalness=0;}
    }
  });return gltf;
},gltf=>{
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  gltf.scene.traverse(n=>{const m=n as THREE.Mesh;if(!m.isMesh)return;geometry.add(m.geometry);for(const a of Array.isArray(m.material)?m.material:[m.material])materials.add(a);});
  geometry.forEach(g=>g.dispose());for(const a of materials){for(const t of Object.values(a))if(t?.isTexture)textures.add(t);a.dispose();}disposeTextures(textures);
});

/** Match the rendered sea's actual piecewise-linear profile, including slopes. */
export function coastalWaterProfile(geometry:THREE.BufferGeometry){
  const p=geometry.getAttribute('position'),rows=new Map<number,number>();
  for(let i=0;i<p.count;i++)rows.set(p.getZ(i),p.getY(i));
  const points=[...rows].sort((a,b)=>a[0]-b[0]);
  return(z:number)=>{
    let a=0,b=points.length-1;while(b-a>1){const mid=(a+b)>>1;if(points[mid][0]<=z)a=mid;else b=mid;}
    const [az,ay]=points[a],[bz,by]=points[b],slope=(by-ay)/(bz-az);
    return{height:ay+THREE.MathUtils.clamp(z-az,0,bz-az)*slope,slope:z<az||z>bz?0:slope};
  };
}

/** A uniform asset scale plus an additive sea-profile bend. Every source
 * triangle, UV and modeled relief is retained; there is no collision or LOD. */
export function fitCoastalBank(source:THREE.BufferGeometry,transform:THREE.Matrix4,water:ReturnType<typeof coastalWaterProfile>){
  const geometry=source.clone().applyMatrix4(transform),p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),tangent=geometry.getAttribute('tangent');
  const relativeHeight=new Float32Array(p.count),normal=new THREE.Vector3(),direction=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    const sea=water(p.getZ(i));relativeHeight[i]=p.getY(i);p.setY(i,p.getY(i)+sea.height);
    normal.fromBufferAttribute(n,i);normal.z-=sea.slope*normal.y;normal.normalize();n.setXYZ(i,normal.x,normal.y,normal.z);
    if(tangent){direction.fromBufferAttribute(tangent,i);direction.y+=sea.slope*direction.z;direction.normalize();tangent.setXYZ(i,direction.x,direction.y,direction.z);}
  }
  geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.shared=false;
  return{geometry,relativeHeight};
}

/** Intersect the complete bank with its waterline. Foam follows that contour,
 * including the eroded inlets, instead of an enclosing circle or rectangle. */
export function coastalShoreRibbon(geometry:THREE.BufferGeometry,height:Float32Array,water:ReturnType<typeof coastalWaterProfile>){
  const p=geometry.getAttribute('position'),index=geometry.index,positions:number[]=[],uv:number[]=[],indices:number[]=[];
  const count=index?.count??p.count;
  for(let i=0;i<count;i+=3){
    const corners=[0,1,2].map(j=>index?index.getX(i+j):i+j),hits:THREE.Vector2[]=[];
    for(let j=0;j<3;j++){
      const a=corners[j],b=corners[(j+1)%3],ha=height[a],hb=height[b];
      if((ha<=0&&hb>0)||(hb<=0&&ha>0)){const t=-ha/(hb-ha);hits.push(new THREE.Vector2(THREE.MathUtils.lerp(p.getX(a),p.getX(b),t),THREE.MathUtils.lerp(p.getZ(a),p.getZ(b),t)));}
    }
    if(hits.length!==2)continue;
    const [a,b]=hits,d=b.clone().sub(a),length=d.length();if(length<.025)continue;
    const side=new THREE.Vector2(-d.y,d.x).multiplyScalar(2.5/length),start=positions.length/3;
    for(const [point,sign,u,v]of [[a,-1,0,0],[b,-1,length,0],[a,1,0,1],[b,1,length,1]]as const){
      const x=point.x+side.x*sign,z=point.y+side.y*sign;positions.push(x,water(z).height+.055,z);uv.push(u,v);
    }
    indices.push(start,start+2,start+1,start+1,start+2,start+3);
  }
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));result.setIndex(indices);result.computeBoundingSphere();return result;
}

function shoreMaterial(){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:{value:0}}]),
    vertexShader:`varying vec2 shoreUV;varying vec2 shoreWorld;
      #include <fog_pars_vertex>
      void main(){shoreUV=uv;shoreWorld=position.xz;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader:`varying vec2 shoreUV;varying vec2 shoreWorld;uniform float time;
      #include <fog_pars_fragment>
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        float phase=sin(time*.85+noise(shoreWorld*.055)*5.);
        float band=exp(-pow((shoreUV.y-(.5+phase*.10))/.21,2.));
        float flecks=smoothstep(.32,.75,noise(shoreWorld*1.7+vec2(time*.08,-time*.04)));
        float broken=.25+.75*noise(shoreWorld*.21+time*.035);
        gl_FragColor=vec4(vec3(.16,.28,.34),band*flecks*broken*.28);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`});
}

export class CarlisleCoastalBanks{
  readonly diagnostics={status:'idle',banks:0,sourceTriangles:0,placedTriangles:0,shoreSegments:0,colliders:0,errors:[]as string[]};
  private readonly assets=cache.scope();
  private readonly nodes:THREE.Mesh[]=[];
  private readonly wash=shoreMaterial();
  private disposed=false;
  async load(sea:THREE.BufferGeometry,parent:(z:number)=>THREE.Group){
    this.diagnostics.status='loading';
    try{
      const kinds:Kind[]=['dune-bank','marsh-bank'],assets=await Promise.all(kinds.map(k=>this.assets.load(k)));if(this.disposed)return;
      const water=coastalWaterProfile(sea);
      for(let i=0;i<kinds.length;i++){
        const gltf=assets[i],bounds=new THREE.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
        gltf.scene.traverse(n=>{const source=n as THREE.Mesh;if(!source.isMesh)return;
          const sourceTriangles=(source.geometry.index?.count??source.geometry.getAttribute('position').count)/3;this.diagnostics.sourceTriangles+=sourceTriangles;
          for(const spec of CARLISLE_COASTAL_BANKS.filter(p=>p.kind===kinds[i])){
            const at=new THREE.Vector3(...carlislePoint(spec.station,0,spec.offset)),toward=new THREE.Vector3(...carlislePoint(spec.station,0,spec.offset+1)).sub(at);
            const yaw=Math.atan2(toward.x,toward.z)+spec.turn,scale=spec.width/Math.max(size.x,size.z);
            const transform=new THREE.Matrix4().compose(new THREE.Vector3(at.x,-bounds.min.y*scale-spec.submerge,at.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(scale,scale,scale));
            transform.multiply(new THREE.Matrix4().makeTranslation(-center.x,0,-center.z)).multiply(source.matrixWorld);
            const {geometry,relativeHeight}=fitCoastalBank(source.geometry,transform,water),mesh=new THREE.Mesh(geometry,source.material);
            mesh.name=`Carlisle ${spec.kind} ${spec.station}`;mesh.userData.visualOnly=true;mesh.userData.coastalBank={...spec,sourceTriangles};mesh.castShadow=true;mesh.receiveShadow=true;parent(at.z).add(mesh);this.nodes.push(mesh);
            const ribbon=coastalShoreRibbon(geometry,relativeHeight,water),foam=new THREE.Mesh(ribbon,this.wash);foam.name='Coastal shoreline wash';foam.userData.visualOnly=true;foam.renderOrder=2;parent(at.z).add(foam);this.nodes.push(foam);
            this.diagnostics.banks++;this.diagnostics.placedTriangles+=sourceTriangles;this.diagnostics.shoreSegments+=(ribbon.index?.count??0)/6;
          }
        });
      }
      this.diagnostics.status='ready';
    }catch(error){if(!this.disposed){this.diagnostics.status='error';this.diagnostics.errors.push(String(error));}throw error;}
  }
  update(time:number){this.wash.uniforms.time.value=time;}
  dispose(){this.disposed=true;for(const n of this.nodes){n.removeFromParent();n.geometry.dispose();}this.nodes.length=0;this.wash.dispose();this.assets.dispose();}
}
