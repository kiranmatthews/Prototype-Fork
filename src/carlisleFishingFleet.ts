import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AssetCache,disposeTextures} from './assetLifetime';
import {sceneryLoads} from './assetLoadQueue';

type P=[number,number,number];
const cache=new AssetCache<'shrimp-boat',GLTF>(async(_key,_dependency,wanted)=>{
  const gltf=await sceneryLoads.run(()=>new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`${import.meta.env.BASE_URL}props/carlisle-fleet/shrimp-boat.glb`),wanted);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(n=>{const mesh=n as THREE.Mesh;if(!mesh.isMesh)return;
    mesh.geometry.userData.shared=true;
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      material.userData.shared=true;
      for(const t of Object.values(material))if(t?.isTexture){t.userData.shared=true;t.anisotropy=8;}
      const pbr=material as THREE.MeshStandardMaterial;if(!pbr.isMeshStandardMaterial)continue;
      pbr.roughness=Math.max(.78,pbr.roughness);pbr.metalness=0;
      // The source's amber window paint is the mask. Restrict it to the cabin
      // height so orange gunwales, roof trim and hull stripes do not emit light.
      pbr.onBeforeCompile=shader=>{
        shader.vertexShader='varying vec3 fleetLocal;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfleetLocal=position;');
        shader.fragmentShader='varying vec3 fleetLocal;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          float cabin=smoothstep(.25,.265,fleetLocal.y)*(1.-smoothstep(.323,.335,fleetLocal.y))*smoothstep(.11,.135,fleetLocal.x)*(1.-smoothstep(.295,.305,fleetLocal.x));
          float amber=smoothstep(.23,.38,diffuseColor.g/max(diffuseColor.r,.001))*(1.-smoothstep(.55,.8,diffuseColor.b/max(diffuseColor.g,.001)))*smoothstep(.12,.24,diffuseColor.r);
          totalEmissiveRadiance+=vec3(.72,.19,.025)*cabin*amber;
        `);
      };pbr.customProgramCacheKey=()=> 'carlisle-fishing-windows';
    }
  });return gltf;
},gltf=>{
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  gltf.scene.traverse(n=>{const m=n as THREE.Mesh;if(!m.isMesh)return;geometry.add(m.geometry);for(const a of Array.isArray(m.material)?m.material:[m.material])materials.add(a);});
  geometry.forEach(g=>g.dispose());for(const a of materials){for(const t of Object.values(a))if(t?.isTexture)textures.add(t);a.dispose();}disposeTextures(textures);
});

/** Small bounded motion about a fixed mooring, independent of player/camera. */
export function fishingMooringMotion(time:number,phase:number){
  return{heave:.16*Math.sin(time*.72+phase)+.045*Math.sin(time*1.13+phase*.7),
    roll:.012*Math.sin(time*.61+phase+1.2),pitch:.006*Math.sin(time*.83+phase*.8),yaw:.009*Math.sin(time*.28+phase)};
}

type Vessel={root:THREE.Group;at:THREE.Vector3;yaw:number;phase:number;length:number;light:THREE.Vector3;wash:THREE.Mesh};

/** Scenic vessels only. Native rideable bonus boats remain owned by Level. */
export class CarlisleFishingFleet{
  readonly diagnostics={status:'idle',vessels:0,sourceTriangles:0,placedTriangles:0,colliders:0,errors:[]as string[]};
  private readonly assets=cache.scope();
  private readonly vessels:Vessel[]=[];
  private readonly washGeometry=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  private disposed=false;
  add(at:P,yaw:number,parent:THREE.Group,washMaterial:THREE.Material,length=36){
    const root=new THREE.Group();root.name='Carlisle moored fishing vessel';root.position.set(...at);root.rotation.y=yaw;
    const phase=this.vessels.length*1.73+yaw,light=new THREE.Vector3();
    root.userData.visualOnly=true;root.userData.fishingVessel={at:[...at],yaw,phase,length};parent.add(root);
    // Foam remains on the water plane while the complete hull rocks above it.
    const wash=new THREE.Mesh(this.washGeometry,washMaterial);wash.name='Moored fishing hull wash';wash.position.set(at[0],at[1]+.04,at[2]);wash.rotation.y=yaw;wash.scale.set(length*1.16,1,length*.61);wash.renderOrder=2;wash.userData.visualOnly=true;parent.add(wash);
    this.vessels.push({root,at:new THREE.Vector3(...at),yaw,phase,length,light,wash});this.diagnostics.vessels++;
    this.update(0);return light;
  }
  async load(){
    this.diagnostics.status='loading';
    try{
      const gltf=await this.assets.load('shrimp-boat');if(this.disposed)return;
      const bounds=new THREE.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      gltf.scene.traverse(n=>{const source=n as THREE.Mesh;if(!source.isMesh)return;
        const triangles=(source.geometry.index?.count??source.geometry.getAttribute('position').count)/3;this.diagnostics.sourceTriangles+=triangles;
        for(const vessel of this.vessels){
          const scale=vessel.length/size.x,draft=vessel.length*.10;
          const transform=new THREE.Matrix4().makeScale(scale,scale,scale).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y, -center.z)).multiply(source.matrixWorld);
          transform.elements[13]-=draft;
          const mesh=new THREE.Mesh(source.geometry,source.material);mesh.name='Carlisle shrimp boat full mesh';mesh.applyMatrix4(transform);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.visualOnly=true;mesh.userData.sourceTriangles=triangles;vessel.root.add(mesh);this.diagnostics.placedTriangles+=triangles;
        }
      });this.diagnostics.status='ready';
    }catch(error){if(!this.disposed){this.diagnostics.status='error';this.diagnostics.errors.push(String(error));}throw error;}
  }
  update(time:number){
    for(const vessel of this.vessels){
      const m=fishingMooringMotion(time,vessel.phase);vessel.root.position.copy(vessel.at);vessel.root.position.y+=m.heave;
      // The asset's bow points along +X, so roll is about X and pitch about Z.
      vessel.root.rotation.set(m.roll,vessel.yaw+m.yaw,m.pitch,'YXZ');vessel.root.updateMatrix();
      vessel.light.set(vessel.length*.22,vessel.length*.195,0).applyMatrix4(vessel.root.matrix);
      vessel.wash.rotation.y=vessel.yaw+m.yaw;
    }
  }
  dispose(){this.disposed=true;for(const v of this.vessels){v.root.removeFromParent();v.wash.removeFromParent();}this.vessels.length=0;this.washGeometry.dispose();this.assets.dispose();}
}
