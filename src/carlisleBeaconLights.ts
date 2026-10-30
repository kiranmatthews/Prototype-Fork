import * as THREE from 'three';
import { carlislePoint } from './levels/carlisle-tidal-relay';

type P = [number, number, number];
const count = 4;
const forward = new THREE.Vector3(0, 0, 1);

/** A bounded scattering volume, rendered once at its exit surface. Integrating
 * through the volume avoids a camera-facing triangle or a visible cone wall.
 * The landward sector is shuttered: the shafts stay over the open water. */
function shaftMaterial() {
  return new THREE.ShaderMaterial({
    name: 'Copper lighthouse haze', transparent: true, depthWrite: false,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      localEye: { value: new THREE.Vector3() },
      dimensions: { value: new THREE.Vector3() }, power: { value: 0 },
    }]),
    vertexShader: `varying vec3 exitPoint;
      #include <fog_pars_vertex>
      void main(){exitPoint=position;
        vec4 mvPosition=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 localEye;uniform vec3 dimensions;uniform float power;
      varying vec3 exitPoint;
      #include <fog_pars_fragment>
      void main(){
        vec3 ray=normalize(exitPoint-localEye);
        // Clip the integration interval to the volume's conservative box.
        vec3 safeRay=sign(ray)*max(abs(ray),vec3(.00001));
        safeRay+=vec3(equal(safeRay,vec3(0.)))*.00001;
        vec3 a=(vec3(-1.,-1.,0.)-localEye)/safeRay;
        vec3 b=(vec3(1.)-localEye)/safeRay;
        vec3 lo=min(a,b),hi=max(a,b);
        float start=max(0.,max(lo.x,max(lo.y,lo.z)));
        float end=min(length(exitPoint-localEye),min(hi.x,min(hi.y,hi.z)));
        float stepSize=max(0.,end-start)/20.,density=0.;
        for(int i=0;i<20;i++){
          vec3 p=localEye+ray*(start+(float(i)+.5)*stepSize);
          float radius=mix(.16,1.,clamp(p.z,0.,1.));
          float r=length(p.xy)/radius;
          float edge=(1.-smoothstep(.62,1.,r))*exp(-r*r*3.);
          float fade=smoothstep(0.,.025,p.z)*(1.-smoothstep(.55,1.,p.z));
          density+=edge*fade/(1.+p.z*5.);
        }
        float opticalDepth=density*length(ray*dimensions)*stepSize*.23;
        float alpha=(1.-exp(-opticalDepth))*power;
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            alpha*=exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
          #else
            alpha*=1.-smoothstep(fogNear,fogFar,vFogDepth);
          #endif
        #endif
        gl_FragColor=vec4(vec3(.44,.16,.048),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export class CarlisleBeaconLights {
  readonly diagnostics = { beacons: 0, shafts: 0, decorativeColliders: 0 };
  private readonly origins = Array.from({ length: count }, () => new THREE.Vector4(1e6, 0, 1e6, 1));
  private readonly directions = Array.from({ length: count }, () => new THREE.Vector3(1, 0, 0));
  private readonly materials = new Map<THREE.Material, THREE.Material>();
  private readonly geometry = new THREE.CylinderGeometry(1, .16, 1, 32, 1, false)
    .rotateX(Math.PI / 2).translate(0, 0, .5);
  private readonly entries: {
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    outward: THREE.Vector3; direction: THREE.Vector3; phase: number; period: number;
  }[] = [];
  private readonly inverse = new THREE.Matrix4();

  add(p: P, size: P, parent: THREE.Object3D) {
    const i = this.entries.length;
    if (i >= count) throw new Error('Carlisle beacon light capacity exceeded');
    // Measured lantern band of the complete Tripo tower; keep the original
    // model, fitting transform, window frames and painted glass intact.
    const origin = this.origins[i].set(p[0], p[1] + size[1] * .785, p[2], size[1] * .06);
    let nearest = new THREE.Vector3(), distance = Infinity;
    for (let station = 0; station <= 4000; station += 10) {
      const q = new THREE.Vector3(...carlislePoint(station, 0));
      const d = (q.x - p[0]) ** 2 + (q.z - p[2]) ** 2;
      if (d < distance) { distance = d; nearest = q; }
    }
    const outward = new THREE.Vector3(p[0] - nearest.x, 0, p[2] - nearest.z).normalize();
    const material = shaftMaterial(), mesh = new THREE.Mesh(this.geometry, material);
    mesh.name = 'Sweeping harbour beacon'; mesh.userData.visualOnly = true;
    mesh.position.set(origin.x, origin.y, origin.z);
    const range = 210 + size[1] * .5;
    mesh.scale.set(range * .09, range * .055, range);
    material.uniforms.dimensions.value.copy(mesh.scale);
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      this.inverse.copy(mesh.matrixWorld).invert();
      material.uniforms.localEye.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(this.inverse);
      material.uniformsNeedUpdate = true;
    };
    parent.add(mesh);
    this.entries.push({ mesh, outward, direction: this.directions[i], phase: i * 1.73, period: 24 + i * 3 });
    this.diagnostics.beacons++; this.diagnostics.shafts++;
    this.update(0);
  }

  /** Scope-owned materials share the original mesh/texture data. The cached
   * GLTF never captures a disposed level's clock or lighting uniforms. */
  material(source: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
    if (Array.isArray(source)) return source.map(m => this.material(m) as THREE.Material);
    const existing = this.materials.get(source);
    if (existing) return existing;
    const material = source.clone() as THREE.MeshStandardMaterial;
    material.name = 'Rotating harbour lantern glass';
    material.onBeforeCompile = shader => {
      shader.uniforms.beaconOrigins = { value: this.origins };
      shader.uniforms.beaconDirections = { value: this.directions };
      shader.vertexShader = 'varying vec3 beaconPoint;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 beaconVertex=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          beaconVertex=instanceMatrix*beaconVertex;
        #endif
        beaconPoint=(modelMatrix*beaconVertex).xyz;`);
      shader.fragmentShader = `varying vec3 beaconPoint;uniform vec4 beaconOrigins[${count}];
        uniform vec3 beaconDirections[${count}];\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float nearest=1.e12,turn=0.,band=0.;
        for(int i=0;i<${count};i++){
          vec3 q=beaconPoint-beaconOrigins[i].xyz;
          float d=dot(q.xz,q.xz);
          if(d<nearest){nearest=d;
            turn=pow(max(dot(normalize(vec3(q.x,.0001,q.z)),beaconDirections[i]),0.),10.);
            band=1.-smoothstep(.8,1.,abs(q.y)/beaconOrigins[i].w);
          }
        }
        float glassMask=smoothstep(.25,.50,diffuseColor.g/max(diffuseColor.r,.001))
          *smoothstep(.15,.4,diffuseColor.r)*(1.-smoothstep(.35,.75,diffuseColor.b/max(diffuseColor.g,.001)));
        totalEmissiveRadiance+=vec3(1.,.21,.025)*glassMask*(.5+band*turn*2.1);`);
    };
    material.customProgramCacheKey = () => 'carlisle-rotating-lantern-v1';
    this.materials.set(source, material);
    return material;
  }

  update(time: number) {
    for (const { mesh, outward, direction, phase, period } of this.entries) {
      const angle = time * Math.PI * 2 / period + phase;
      direction.set(Math.cos(angle), .018, Math.sin(angle)).normalize();
      mesh.quaternion.setFromUnitVectors(forward, direction);
      // A shielded landward sector prevents the haze from washing across the
      // course. Smooth shutters avoid flashes as the rotating lens emerges.
      const facing = direction.dot(outward);
      const power = THREE.MathUtils.smoothstep(facing, .5, .8) * .65;
      mesh.material.uniforms.power.value = power;
      mesh.visible = power > .0001;
    }
  }

  dispose() {
    for (const { mesh } of this.entries) { mesh.removeFromParent(); mesh.material.dispose(); }
    this.entries.length = 0;
    this.materials.forEach(m => m.dispose()); this.materials.clear();
    this.geometry.dispose();
  }
}
