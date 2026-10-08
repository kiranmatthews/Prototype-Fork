import * as THREE from 'three';
import { ICE_SURFACE } from './surfaceBehavior';

/** Opaque optical ice: glossy grazing reflections, cloudy inclusions and
 * thin branching fissures. Metre-space coordinates work on boxes, drawn
 * polygons, slopes and authored meshes without stretched UVs or extra passes. */
export function createIceMaterial(source?: THREE.Material, bounds?: THREE.Box3): THREE.MeshPhongMaterial {
  const base = source as THREE.MeshPhongMaterial | undefined;
  const material = new THREE.MeshPhongMaterial({
    color: ICE_SURFACE.color, specular: 0xc4eaff, shininess: 110,
    emissive: 0x071721, side: source?.side ?? THREE.FrontSide,
    fog: base?.fog !== false,
  });
  material.name = 'Ice · cloudy depth, fine fissures and polished sheen';
  material.userData.texKind = 'ice';
  material.userData.iceSurface = true;
  material.onBeforeCompile = shader => {
    shader.uniforms.iceBounds = {value: new THREE.Vector4(bounds?.min.x??-100000,
      bounds?.max.x??100000,bounds?.min.z??-100000,bounds?.max.z??100000)};
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vIcePosition;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvIcePosition = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying vec3 vIcePosition;
      uniform vec4 iceBounds;
      float iceHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float iceNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(iceHash(i),iceHash(i+vec2(1,0)),f.x),
          mix(iceHash(i+vec2(0,1)),iceHash(i+vec2(1,1)),f.x),f.y);
      }
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 iceUV = vIcePosition.xz + vIcePosition.y * vec2(.31,.13);
      float cloud = iceNoise(iceUV*.7)*.65 + iceNoise(iceUV*2.6)*.35;
      vec2 crystal = iceUV*.72, cell=floor(crystal), within=fract(crystal);
      float nearest=9.0, second=9.0;
      for(int ix=-1;ix<=1;ix++) for(int iz=-1;iz<=1;iz++) {
        vec2 offset=vec2(float(ix),float(iz));
        vec2 seed=vec2(iceHash(cell+offset),iceHash(cell+offset+19.13));
        vec2 delta=offset+.2+seed*.6-within;
        float distance2=dot(delta,delta);
        if(distance2<nearest){second=nearest;nearest=distance2;}
        else second=min(second,distance2);
      }
      float fine = 1.0-smoothstep(.004,.017,sqrt(second)-sqrt(nearest));
      float edge = min(min(vIcePosition.x-iceBounds.x,iceBounds.y-vIcePosition.x),
        min(vIcePosition.z-iceBounds.z,iceBounds.w-vIcePosition.z));
      float frost = 1.0-smoothstep(.04,.22+cloud*.22,edge);
      vec2 bubbles=fract(iceUV*9.0)-.5;
      float bubble=(1.0-smoothstep(.022,.07,length(bubbles))) * step(.88,iceHash(floor(iceUV*9.0)));
      diffuseColor.rgb *= mix(vec3(.35,.69,.81),vec3(.91,.98,1.0),smoothstep(.12,.84,cloud));
      diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.83,.95,1.0),max(frost*.8,fine*.35+ bubble*.28));
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float iceFresnel = pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),3.0);
      outgoingLight = mix(outgoingLight, vec3(.72,.88,.97), iceFresnel*.38);
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => 'shared-optical-ice-v1';
  return material;
}

const warnings = new WeakMap<THREE.Mesh, THREE.MeshBasicMaterial>();

/** A single child mesh follows the REAL falling support. No static decoration
 * survives its fall, and no visible seam adds a second collision surface. */
export function dressFallAwaySurface(mesh: THREE.Mesh): void {
  if (warnings.has(mesh)) return;
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox!;
  const w = box.max.x - box.min.x, d = box.max.z - box.min.z, y = box.max.y + .025;
  const vertices: number[] = [];
  const strip = (ax: number, az: number, bx: number, bz: number, width: number) => {
    const len = Math.hypot(bx-ax,bz-az), x = -(bz-az)/len*width/2, z = (bx-ax)/len*width/2;
    vertices.push(ax-x,y,az-z, ax+x,y,az+z, bx+x,y,bz+z,
      ax-x,y,az-z, bx+x,y,bz+z, bx-x,y,bz-z);
  };
  // Ochre binding remnants at either end, and a split across the deck.
  for (const side of [-1,1]) {
    const z = side*(d/2-.16);
    strip(-w/2+.1,z,w/2-.1,z,.085);
  }
  const points = [[-.48,-.26],[-.24,-.1],[-.11,-.15],[.09,.07],[.23,.02],[.48,.24]];
  for(let i=1;i<points.length;i++)strip(points[i-1][0]*w,points[i-1][1]*d,points[i][0]*w,points[i][1]*d,.045);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({color:0x815027,side:THREE.DoubleSide});
  const seams = new THREE.Mesh(geometry,material);
  seams.name = 'Fall-away split and warning bindings';
  seams.userData.visualOnly = true;
  seams.userData.edgeGrinding = false;
  mesh.add(seams);
  warnings.set(mesh,material);
}

export function updateFallAwayWarning(mesh: THREE.Mesh, progress: number): void {
  const material = warnings.get(mesh);
  if (!material) return;
  material.color.setHex(progress <= 0 ? 0x815027 : 0xf0ae4e);
  if (progress > 0) material.color.multiplyScalar(.7 + .3*Math.sin(progress*38)**2);
}
