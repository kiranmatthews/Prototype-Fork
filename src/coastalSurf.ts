import * as THREE from 'three';

/** A small analytic surf model, inspired by Tidewater's depth-limited breakers
 * and advancing/backwashing foam. No FFT, compute dispatch or shader variants.
 * Both GLSL and CPU use these equations (the ocean sampler drives swimming). */
export const SURF_DEFAULTS = Object.freeze({
  surfHeight: 0.26,
  surfPeriod: 7.2,
  surfWidth: 18,
  foamStrength: 0.68,
});
export interface SurfParams {
  surfHeight: number;
  surfPeriod: number;
  surfWidth: number;
  foamStrength: number;
}
export const SWELL_GLSL = /* glsl */ `
void coastSwell(vec2 xz, vec4 wave, vec2 rawDir, float time, float attenuation,
  inout vec3 displacement, inout vec2 slope) {
  float k = 6.28318530718 / max(wave.x, 0.01);
  vec2 dir = rawDir / max(length(rawDir), 0.00001);
  if (length(rawDir) < 0.00001) dir = vec2(1.0, 0.0);
  float phase = dot(xz, dir) * k - sqrt(9.8 * k) * time * wave.z;
  float amplitude = wave.y * attenuation;
  // Horizontal steepness is bounded by the actual wave amplitude. The old
  // sharp/k term moved nearly flat water sideways by several metres.
  float q = min(min(max(wave.w, 0.0), 0.75), 0.35 / max(k * abs(amplitude), 0.001));
  displacement.y += amplitude * cos(phase);
  displacement.xz -= dir * amplitude * q * sin(phase);
  slope += dir * k * amplitude * sin(phase) / max(1.0 - q * k * amplitude * cos(phase), 0.35);
}
void coastSwells(vec2 xz, float shore, float time, vec4 wave1, vec2 dir1,
  vec4 wave2, vec2 dir2, inout vec3 displacement, inout vec2 slope) {
  float attenuation = smoothstep(0.0, 12.0, shore);
  coastSwell(xz, wave1, dir1, time, attenuation, displacement, slope);
  coastSwell(xz, wave2, dir2, time, attenuation, displacement, slope);
  float detail = (abs(wave1.y) + abs(wave2.y)) * 0.16;
  coastSwell(xz, vec4(17.0, detail, 0.65, 0.45), vec2(0.8, 0.6), time, attenuation, displacement, slope);
  coastSwell(xz, vec4(7.1, detail * 0.45, 0.82, 0.35), vec2(-0.4, 0.9165), time, attenuation, displacement, slope);
}
`;
export const SURF_GLSL = /* glsl */ `
uniform vec4 uSurf; // height, period, offshore width, foam strength
float surfPhase(float shore, vec2 xz, float time) {
  // Integrated shallow-water travel time: fronts slow and bunch near shore.
  float travel = sqrt(max(shore + 1.5, 0.0)) * 1.7;
  return travel + time * 6.28318530718 / max(uSurf.y, 0.5)
    + sin(xz.x * 0.047 + xz.y * 0.031) * 0.32;
}
vec3 surfProfileDepth(float shore, float bedDepth, vec2 xz, float time) {
  float depth = max(bedDepth, 0.0);
  float phase = surfPhase(shore, xz, time);
  float c = max(cos(phase), 0.0);
  float envelope = smoothstep(-0.7, 1.4, shore)
    * (1.0 - smoothstep(uSurf.z * 0.55, max(uSurf.z, 0.01), shore));
  // Shoaling grows the crest, then depth limits it into a low rolling bore.
  float height = min(max(uSurf.x, 0.0) * (1.0 + 0.65 * exp(-depth)), depth * 0.42 + 0.025);
  float crest = c * c * c;
  float y = (crest - 0.2122) * height * envelope;
  float slope = -3.0 * c * c * sin(phase) * height * envelope
    * 0.85 / sqrt(max(shore + 1.5, 0.15));
  float breaking = envelope * (1.0 - smoothstep(1.0, 3.0, depth));
  return vec3(y, slope, breaking);
}
vec3 surfProfile(float shore, vec2 xz, float time) {
  return surfProfileDepth(shore, shore * 0.14, xz, time);
}
float surfRunup(vec2 xz, float time) {
  float p = time * 6.28318530718 / max(uSurf.y, 0.5) + 2.0820663
    + sin(xz.x * 0.047 + xz.y * 0.031) * 0.32;
  float cycle = fract(p / 6.28318530718);
  // Faster uprush, longer draining settle; both meet with zero velocity.
  float lap = cycle < 0.38 ? smoothstep(0.0, 0.38, cycle)
    : 1.0 - smoothstep(0.38, 1.0, cycle);
  return lap * min(max(uSurf.x, 0.0) * 6.0, 2.0);
}
float surfFoamDepth(float shore, float depth, vec2 xz, float time, float noise) {
  float phase = surfPhase(shore, xz, time);
  float breaking = surfProfileDepth(shore, depth, xz, time).z;
  float crest = smoothstep(0.55, 0.95, cos(phase));
  // A torn trailing sheet, then a beaded leading edge that advances inland.
  float trail = smoothstep(-0.45, 0.75, sin(phase))
    * smoothstep(-0.5, 0.7, cos(phase));
  float front = shore + surfRunup(xz, time);
  float edge = (1.0 - smoothstep(0.08, 0.7, abs(front)))
    * smoothstep(-0.12, 0.05, front);
  float lace = smoothstep(0.25, 0.7, noise);
  return clamp((breaking * (crest * 0.78 + trail * lace * 0.42)
    + edge * (0.55 + lace * 0.45)) * uSurf.w, 0.0, 1.0);
}
float surfFoam(float shore, vec2 xz, float time, float noise) {
  return surfFoamDepth(shore, shore * 0.14, xz, time, noise);
}
`;

const smooth = (a: number, b: number, x: number): number => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export function sampleSurf(shore: number, x: number, z: number, time: number, p: SurfParams, bedDepth=shore*0.14) {
  const phase = Math.sqrt(Math.max(shore + 1.5, 0)) * 1.7
    + time * Math.PI * 2 / Math.max(p.surfPeriod, 0.5)
    + Math.sin(x * 0.047 + z * 0.031) * 0.32;
  const depth = Math.max(bedDepth, 0);
  const c = Math.max(Math.cos(phase), 0);
  const envelope = smooth(-0.7, 1.4, shore)
    * (1 - smooth(p.surfWidth * 0.55, Math.max(p.surfWidth, 0.01), shore));
  const height = Math.min(Math.max(p.surfHeight, 0) * (1 + 0.65 * Math.exp(-depth)), depth * 0.42 + 0.025);
  return {
    height: (c * c * c - 0.2122) * height * envelope,
    slope: -3 * c * c * Math.sin(phase) * height * envelope * 0.85 / Math.sqrt(Math.max(shore + 1.5, 0.15)),
    influence: envelope * (1 - smooth(1, 3, depth)), phase,
  };
}
export function sampleRunup(x:number,z:number,time:number,p:SurfParams):number {
  const phase=time*Math.PI*2/Math.max(p.surfPeriod,0.5)+2.0820663+Math.sin(x*0.047+z*0.031)*0.32;
  const cycle=phase/(Math.PI*2)-Math.floor(phase/(Math.PI*2));
  const lap=cycle<0.38?smooth(0,0.38,cycle):1-smooth(0.38,1,cycle);
  return lap*Math.min(Math.max(p.surfHeight,0)*6,2);
}
export function sampleSurfFoam(shore:number,x:number,z:number,time:number,noise:number,p:SurfParams):number {
  const surf=sampleSurf(shore,x,z,time,p),phase=surf.phase;
  const crest=smooth(0.55,0.95,Math.cos(phase));
  const trail=smooth(-0.45,0.75,Math.sin(phase))*smooth(-0.5,0.7,Math.cos(phase));
  const front=shore+sampleRunup(x,z,time,p);
  const edge=(1-smooth(0.08,0.7,Math.abs(front)))*smooth(-0.12,0.05,front);
  const lace=smooth(0.25,0.7,noise);
  return THREE.MathUtils.clamp((surf.influence*(crest*0.78+trail*lace*0.42)+edge*(0.55+lace*0.45))*p.foamStrength,0,1);
}

interface Edge { ax: number; az: number; bx: number; bz: number; nx: number; nz: number; slope: number }
export interface ShoreField {
  texture: THREE.DataTexture;
  bounds: THREE.Vector4;
  segments: number;
  hasBed: boolean;
  sample(x: number, z: number): { distance: number; nx: number; nz: number; slope: number; depth: number };
}

/** Extract actual waterline contours once, then rasterize a signed-distance
 * field. It serves waves, shallow colour and foam even when lite skips depth.
 * World coordinates make it independent of course direction and camera angle. */
export function createShoreField(meshes: readonly THREE.Mesh[], seaLevel: number, bounds: THREE.Box3): ShoreField {
  const edges: Edge[] = [];
  const bedTriangles:number[][]=[];
  const box = new THREE.Box3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normal = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const height = seaLevel + 0.025;
  for (const mesh of meshes) {
    if (!mesh.visible || (mesh as THREE.InstancedMesh).isInstancedMesh || mesh.userData.noWaterShore) continue;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (mats.every(m => !m.visible || m.transparent || !m.depthWrite)) continue;
    const geometry = mesh.geometry, pos = geometry.getAttribute('position'), index = geometry.getIndex();
    if (!pos) continue;
    geometry.computeBoundingBox(); box.copy(geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
    if (box.min.y > seaLevel+2 || box.max.x < bounds.min.x || box.min.x > bounds.max.x
      || box.max.z < bounds.min.z || box.min.z > bounds.max.z) continue;
    for (let i = 0, count = index?.count ?? pos.count; i < count; i += 3) {
      a.fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(pos, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(pos, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
      if(Math.min(a.y,b.y,c.y)<=seaLevel+2 && Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))>1e-6)
        bedTriangles.push([a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z]);
      if (Math.min(a.y,b.y,c.y) > height || Math.max(a.y,b.y,c.y) < height) continue;
      normal.crossVectors(ab.subVectors(b,a), ac.subVectors(c,a));
      if (normal.y < 0) normal.negate();
      const nl = Math.hypot(normal.x,normal.z);
      if (nl < 1e-6) continue;
      let n = 0;
      for (const [p,q] of [[a,b],[b,c],[c,a]]) {
        if ((p.y <= height && q.y > height) || (q.y <= height && p.y > height))
          points[n++].lerpVectors(p,q,(height-p.y)/(q.y-p.y));
      }
      if (n === 2 && points[0].distanceToSquared(points[1]) > 1e-8)
        edges.push({ax:points[0].x,az:points[0].z,bx:points[1].x,bz:points[1].z,nx:normal.x/nl,nz:normal.z/nl,
          slope:THREE.MathUtils.clamp(nl/Math.max(Math.abs(normal.y),0.0001),0.035,1)});
    }
  }
  // Spatial bins keep preprocessing bounded by nearby coastline, not the
  // number of triangles in the entire map. Beyond 32m no surf needs a contour.
  const cell = 16, bins = new Map<string, Edge[]>();
  for (const e of edges) {
    for (let x = Math.floor(Math.min(e.ax,e.bx)/cell); x <= Math.floor(Math.max(e.ax,e.bx)/cell); x++)
      for (let z = Math.floor(Math.min(e.az,e.bz)/cell); z <= Math.floor(Math.max(e.az,e.bz)/cell); z++) {
        const key = `${x},${z}`; const entries = bins.get(key) ?? []; entries.push(e); bins.set(key,entries);
      }
  }
  const nearest = (x: number,z: number) => {
    let best = 32*32, distance = 32, nx = 1, nz = 0, slope = 0.14;
    const cx = Math.floor(x/cell), cz = Math.floor(z/cell);
    for (let ix = cx-2; ix <= cx+2; ix++) for (let iz = cz-2; iz <= cz+2; iz++) {
      for (const e of bins.get(`${ix},${iz}`) ?? []) {
        const dx=e.bx-e.ax,dz=e.bz-e.az, t=THREE.MathUtils.clamp(((x-e.ax)*dx+(z-e.az)*dz)/(dx*dx+dz*dz),0,1);
        const px=x-e.ax-dx*t,pz=z-e.az-dz*t, d=px*px+pz*pz;
        if (d < best) { best=d; distance=Math.sqrt(d)*((px*e.nx+pz*e.nz)<0?-1:1); nx=e.nx;nz=e.nz;slope=e.slope; }
      }
    }
    return {distance,nx,nz,slope};
  };
  const spanX = Math.max(1,bounds.max.x-bounds.min.x), spanZ = Math.max(1,bounds.max.z-bounds.min.z);
  const width = edges.length||bedTriangles.length?Math.min(1024,Math.max(2,Math.ceil(spanX/1.5))):1;
  const rows = edges.length||bedTriangles.length?Math.min(1024,Math.max(2,Math.ceil(spanZ/1.5))):1;
  const bed=new Float32Array(width*rows).fill(seaLevel-8);
  for(const [ax,ay,az,bx,by,bz,cx,cy,cz] of bedTriangles){
    const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
    const minX=Math.max(0,Math.floor((Math.min(ax,bx,cx)-bounds.min.x)/spanX*width-.5));
    const maxX=Math.min(width-1,Math.ceil((Math.max(ax,bx,cx)-bounds.min.x)/spanX*width-.5));
    const minZ=Math.max(0,Math.floor((Math.min(az,bz,cz)-bounds.min.z)/spanZ*rows-.5));
    const maxZ=Math.min(rows-1,Math.ceil((Math.max(az,bz,cz)-bounds.min.z)/spanZ*rows-.5));
    for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
      const wx=bounds.min.x+(x+.5)/width*spanX,wz=bounds.min.z+(z+.5)/rows*spanZ;
      const wa=((bz-cz)*(wx-cx)+(cx-bx)*(wz-cz))/den;
      const wb=((cz-az)*(wx-cx)+(ax-cx)*(wz-cz))/den;
      if(wa<-.00001||wb<-.00001||wa+wb>1.00001)continue;
      const h=wa*ay+wb*by+(1-wa-wb)*cy;
      bed[z*width+x]=Math.max(bed[z*width+x],Math.min(seaLevel+2,h));
    }
  }
  const data = new Uint16Array(width*rows*4);
  for(let z=0;z<rows;z++) for(let x=0;x<width;x++) {
    const value=nearest(bounds.min.x+(x+.5)/width*spanX,bounds.min.z+(z+.5)/rows*spanZ),i=(z*width+x)*4;
    data[i]=THREE.DataUtils.toHalfFloat(value.distance);data[i+1]=THREE.DataUtils.toHalfFloat(value.nx);
    data[i+2]=THREE.DataUtils.toHalfFloat(value.nz);data[i+3]=THREE.DataUtils.toHalfFloat(seaLevel-bed[z*width+x]);
  }
  const texture=new THREE.DataTexture(data,width,rows,THREE.RGBAFormat,THREE.HalfFloatType);
  texture.name='Coast distance and direction';texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  const sample = (x:number,z:number) => {
    const fx=THREE.MathUtils.clamp((x-bounds.min.x)/spanX*width-.5,0,width-1);
    const fz=THREE.MathUtils.clamp((z-bounds.min.z)/spanZ*rows-.5,0,rows-1);
    const ix=Math.floor(fx),iz=Math.floor(fz),tx=fx-ix,tz=fz-iz;
    const channel=(c:number) => {
      const at=(dx:number,dz:number)=>THREE.DataUtils.fromHalfFloat(data[(Math.min(rows-1,iz+dz)*width+Math.min(width-1,ix+dx))*4+c]);
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(0,0),at(1,0),tx),THREE.MathUtils.lerp(at(0,1),at(1,1),tx),tz);
    };
    const distance=channel(0),depth=channel(3);
    return {distance,nx:channel(1),nz:channel(2),depth,slope:THREE.MathUtils.clamp(Math.abs(depth)/Math.max(Math.abs(distance),.25),.035,1)};
  };
  return {texture,bounds:new THREE.Vector4(bounds.min.x,bounds.min.z,spanX,spanZ),segments:edges.length,hasBed:bedTriangles.length>0,sample};
}
