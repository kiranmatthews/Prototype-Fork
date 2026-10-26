import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type XYZ = readonly [number, number, number];
/** Sculpted, chamfered cross sections; local forward is -Z, metres, Y up. */
export function loft(rings: readonly (readonly [number, number, number, number, number])[]): THREE.BufferGeometry {
  const vertices: number[] = [], indices: number[] = [];
  for (const [z, width, low, high, cut] of rings) {
    const w = width / 2, c = Math.min(cut, width / 3, (high - low) / 3);
    for (const [x, y] of [[-w+c,low],[w-c,low],[w,low+c],[w,high-c],[w-c,high],[-w+c,high],[-w,high-c],[-w,low+c]]) vertices.push(x,y,z);
  }
  for (let r=0;r<rings.length-1;r++) for(let i=0;i<8;i++) {
    const a=r*8+i,b=r*8+(i+1)%8,c=b+8,d=a+8; indices.push(a,b,d,b,c,d);
  }
  for(let i=1;i<7;i++){indices.push(0,i+1,i);const o=(rings.length-1)*8;indices.push(o,o+i,o+i+1);}
  const g = new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);
  const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return flat;
}
export function bevelBox(w:number,h:number,d:number,cut=Math.min(w,h,d)*.22):THREE.BufferGeometry {
  return loft([[-d/2,w-cut*2,-h/2+cut,h/2-cut,cut*.2],[-d/2+cut,w,-h/2,h/2,cut],[d/2-cut,w,-h/2,h/2,cut],[d/2,w-cut*2,-h/2+cut,h/2-cut,cut*.2]]);
}
export function placed(g:THREE.BufferGeometry,p:XYZ=[0,0,0],r:XYZ=[0,0,0]):THREE.BufferGeometry {
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...r)));g.translate(...p);return g;
}
export function coloured(g:THREE.BufferGeometry,color:THREE.ColorRepresentation):THREE.BufferGeometry {
  if(g.index){const f=g.toNonIndexed();g.dispose();g=f;}
  // Baked broad colour regions, no textures, maps, or per-instance shader patches.
  const c=new THREE.Color(color),a=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(a,3));g.deleteAttribute('uv');return g;
}
export function merged(parts:THREE.BufferGeometry[],preserveUv=false):THREE.BufferGeometry {
  const prepared=parts.map(g=>{if(!preserveUv)g.deleteAttribute('uv');if(g.index){const f=g.toNonIndexed();g.dispose();return f;}return g;});
  const geometry=mergeGeometries(prepared,false);if(!geometry)throw new Error('Cart geometry attributes do not match');
  prepared.forEach(g=>g.dispose());geometry.computeBoundingSphere();return geometry;
}
export function strut(a:XYZ,b:XYZ,radius:number,sides=6):THREE.BufferGeometry {
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),dir=to.clone().sub(from);
  return new THREE.CylinderGeometry(radius,radius,dir.length(),sides,1).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize())).translate(...from.add(to).multiplyScalar(.5).toArray());
}
export function wheelGeometry():THREE.BufferGeometry {
  const p:number[]=[],ids:number[]=[],rings=[[-.19,.29],[-.16,.37],[-.10,.41],[.10,.41],[.16,.37],[.19,.29]];
  for(const [x,r] of rings)for(let i=0;i<12;i++){const t=i/12*Math.PI*2;p.push(x,Math.cos(t)*r,Math.sin(t)*r);}
  for(let k=0;k<5;k++)for(let i=0;i<12;i++){const a=k*12+i,b=k*12+(i+1)%12;ids.push(a,b,a+12,b,b+12,a+12);}
  const rubber=new THREE.BufferGeometry();rubber.setAttribute('position',new THREE.Float32BufferAttribute(p,3));rubber.setIndex(ids);rubber.computeVertexNormals();
  const pieces=[coloured(rubber,'#282d37')];
  for(const side of [-1,1]){
    const hub=new THREE.CylinderGeometry(.242,.242,.026,12).rotateZ(Math.PI/2).translate(side*.182,0,0);
    pieces.push(coloured(hub,'#ead8ab'));
    pieces.push(coloured(new THREE.CylinderGeometry(.115,.115,.045,10).rotateZ(Math.PI/2).translate(side*.203,0,0),'#58606c'));
    for(let i=0;i<6;i++){const a=i*Math.PI/3;pieces.push(coloured(new THREE.CylinderGeometry(.018,.018,.035,5).rotateZ(Math.PI/2).translate(side*.217,Math.cos(a)*.162,Math.sin(a)*.162),'#313844'));}
  }
  // Alternating broad tread blocks provide readable rolling motion at distance.
  for(let i=0;i<12;i++){const a=i*Math.PI/6;pieces.push(coloured(placed(new THREE.BoxGeometry(.23,.035,.12),[0,Math.cos(a)*.405,Math.sin(a)*.405],[a,0,(i%2?1:-1)*.12]),i%2?'#343945':'#222732'));}
  return merged(pieces);
}
