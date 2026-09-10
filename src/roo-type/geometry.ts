/*! Roo bevel lab uses Clipper (Angus Johnson / Timo) and JSBN (Tom Wu).
 * License notices: fonts/ROO-TYPE-NOTICES.txt */
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import ClipperLib from 'clipper-lib';

export type RooTreatment = 'counter' | 'bonus';
interface Command { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }
export interface RooVectorGlyph { advance: number; bounds: [number, number, number, number]; commands: Command[] }
export interface RooVectorSource {
  version: number;
  family: string;
  sha256: string;
  capBand: { bottom: number; top: number; height: number; unitsPerEm: number };
  glyphs: Record<string, RooVectorGlyph>;
  kern: Record<string, number>;
}

/** All dimensions are relative to the fixed, font-wide cap band. */
export const ROO_BEVEL = Object.freeze({ width: 0.032, rise: 0.026, depth: 0.026, tracking: 0.012 });

export async function loadRooVectors(): Promise<RooVectorSource> {
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/roo-bevel-source-v1.json`);
  if (!response.ok) throw new Error(`Roo outlines: HTTP ${response.status}`);
  return response.json();
}

export function rooGlyphGeometry(glyph: RooVectorGlyph, width: number = ROO_BEVEL.width): THREE.BufferGeometry {
  const path = new THREE.ShapePath();
  for (const c of glyph.commands) {
    switch (c.type) {
      case 'M': path.moveTo(c.x!, c.y!); break;
      case 'L': path.lineTo(c.x!, c.y!); break;
      case 'Q': path.quadraticCurveTo(c.x1!, c.y1!, c.x!, c.y!); break;
      case 'C': path.bezierCurveTo(c.x1!, c.y1!, c.x2!, c.y2!, c.x!, c.y!); break;
      case 'Z': path.currentPath?.closePath(); break;
    }
  }
  // A generic ExtrudeGeometry inset folds over the narrow tips in N, M, &.
  // Clip a real inset, then triangulate the ring between the two contours.
  // Topology may split at a thin stroke, but the original silhouette cannot grow.
  const integerScale = 1e6;
  const contours: ClipperLib.Paths = [];
  for (const shape of path.toShapes(true)) {
    const points=shape.extractPoints(12);
    for(const [index,ring] of [points.shape,...points.holes].entries()) {
      let contour=ring.map(p=>({X:Math.round(p.x*integerScale),Y:Math.round(p.y*integerScale)}));
      contour=ClipperLib.Clipper.CleanPolygon(contour,120);
      if(ClipperLib.Clipper.Orientation(contour)!==(index===0))contour.reverse();
      contours.push(contour);
    }
  }
  const offset=new ClipperLib.ClipperOffset(2,.001*integerScale);
  offset.AddPaths(contours,ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etClosedPolygon);
  const inset=new ClipperLib.PolyTree(); offset.Execute(inset,-width*integerScale);
  const difference=new ClipperLib.Clipper();
  difference.AddPaths(contours,ClipperLib.PolyType.ptSubject,true);
  difference.AddPaths(ClipperLib.Clipper.PolyTreeToPaths(inset),ClipperLib.PolyType.ptClip,true);
  const ring=new ClipperLib.PolyTree();
  difference.Execute(ClipperLib.ClipType.ctDifference,ring,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
  const positions:number[]=[];
  const edgeRings=contours.map(c=>c.map(p=>new THREE.Vector2(p.X/integerScale,p.Y/integerScale)));
  function distanceToOutline(p:THREE.Vector2) {
    let distance=Infinity;
    for(const contour of edgeRings)for(let i=0;i<contour.length;i++){
      const a=contour[i],b=contour[(i+1)%contour.length];
      const dx=b.x-a.x,dy=b.y-a.y;
      const t=THREE.MathUtils.clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
      distance=Math.min(distance,Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t));
    }
    return distance;
  }
  function surface(polygons:ClipperLib.ExPolygons,z:(p:THREE.Vector2)=>number,back=false){
    for(const polygon of polygons){
      const convert=(c:ClipperLib.Path)=>c.map(p=>new THREE.Vector2(p.X/integerScale,p.Y/integerScale));
      const contour=convert(polygon.outer),holes=polygon.holes.map(convert);
      const triangles=THREE.ShapeUtils.triangulateShape(contour,holes),vertices=contour.concat(...holes);
      const heights=vertices.map(z);
      for(const triangle of triangles){
        const [a,b,c]=triangle.map(i=>vertices[i]);
        const ccw=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>0;
        if(ccw===back)triangle.reverse();
        for(const i of triangle)positions.push(vertices[i].x,vertices[i].y,heights[i]);
      }
    }
  }
  surface(ClipperLib.JS.PolyTreeToExPolygons(inset),()=>ROO_BEVEL.rise);
  surface(ClipperLib.JS.PolyTreeToExPolygons(ring),p=>Math.min(1,distanceToOutline(p)/Math.max(width,1e-6))*ROO_BEVEL.rise);
  const original=new ClipperLib.Clipper(),originalTree=new ClipperLib.PolyTree();
  original.AddPaths(contours,ClipperLib.PolyType.ptSubject,true);
  original.Execute(ClipperLib.ClipType.ctUnion,originalTree,ClipperLib.PolyFillType.pftNonZero);
  surface(ClipperLib.JS.PolyTreeToExPolygons(originalTree),()=>-ROO_BEVEL.depth,true);
  for(const contour of edgeRings)for(let i=0;i<contour.length;i++){
    const a=contour[i],b=contour[(i+1)%contour.length],d=-ROO_BEVEL.depth;
    positions.push(a.x,a.y,0,b.x,b.y,d,b.x,b.y,0, a.x,a.y,0,a.x,a.y,d,b.x,b.y,d);
  }
  const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));raw.computeVertexNormals();
  const geometry = toCreasedNormals(raw, Math.PI / 5);
  raw.dispose();
  geometry.translate(0, -0.5, 0);
  geometry.computeBoundingBox();
  return geometry;
}

export function layoutRoo(source: RooVectorSource, raw: string, tracking: number = ROO_BEVEL.tracking) {
  const letters: Array<{ char: string; x: number }> = [];
  let pen = 0, min = Infinity, max = -Infinity;
  const text = raw.toUpperCase();
  for (let i = 0; i < text.length; i++) {
    const char = source.glyphs[text[i]] ? text[i] : '?';
    const glyph = source.glyphs[char];
    if (!glyph) continue;
    if (glyph.commands.length) {
      letters.push({ char, x: pen });
      min = Math.min(min, pen + glyph.bounds[0]);
      max = Math.max(max, pen + glyph.bounds[2]);
    }
    pen += glyph.advance + (source.kern[text.slice(i, i + 2)] ?? 0);
    if (i < text.length - 1) pen += tracking;
  }
  if (!Number.isFinite(min)) min = max = 0;
  return { letters, min, max, width: max - min, advance: pen };
}

export function createRooMaterial(palette: RooTreatment): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: `Roo.Chiselled.${palette}`, toneMapped: false,
    uniforms: {
      uBonus: { value: palette === 'bonus' ? 1 : 0 },
      uLight: { value: new THREE.Vector3(-0.65, 0.85, 0.95).normalize() },
      uIntensity: { value: 1 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vLocal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uBonus;
      uniform vec3 uLight;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vLocal;
      vec3 linearRGB(vec3 c) {
        return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
      }
      void main() {
        float h = clamp(vLocal.y + 0.5, 0.0, 1.0);
        vec3 gold = mix(vec3(0.85,0.16,0.025), vec3(1.0,0.39,0.015), smoothstep(0.0,0.35,h));
        gold = mix(gold, vec3(1.0,0.72,0.015), smoothstep(0.30,0.68,h));
        gold = mix(gold, vec3(1.0,0.94,0.045), smoothstep(0.65,1.0,h));
        vec3 green = mix(vec3(0.015,0.11,0.91), vec3(0.005,0.39,1.0), smoothstep(0.0,0.22,h));
        green = mix(green, vec3(0.02,0.76,0.14), smoothstep(0.24,0.47,h));
        green = mix(green, vec3(0.26,0.92,0.005), smoothstep(0.44,0.82,h));
        green = mix(green, vec3(0.46,1.0,0.01), smoothstep(0.80,1.0,h));
        vec3 base = linearRGB(mix(gold, green, uBonus));
        vec3 n = normalize(vNormal);
        vec3 light = normalize(uLight);
        float diffuse = max(0.0, dot(n, light));
        float chamfer = smoothstep(0.12,0.64,length(n.xy));
        float fill = max(0.0, dot(n, normalize(vec3(0.7,-0.5,0.6))));
        float spec = pow(max(0.0, dot(n, normalize(light + vec3(0.0,0.0,1.0)))), 58.0);
        float edgeLight = pow(diffuse, 4.0) * chamfer;
        vec3 tint = mix(vec3(1.0,0.86,0.28), vec3(0.65,1.0,0.27), uBonus);
        vec3 color = base * (0.40 + 0.72 * diffuse * uIntensity + 0.16 * fill);
        color *= 1.0 - 0.22 * chamfer * (1.0 - diffuse);
        color += linearRGB(tint) * edgeLight * 0.24 * uIntensity;
        color += mix(linearRGB(tint),vec3(1.0),0.38) * spec * 0.55 * uIntensity;
        gl_FragColor = vec4(color,1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

export class RooTypeGeometry {
  private cache = new Map<string, THREE.BufferGeometry>();
  constructor(readonly source: RooVectorSource, readonly bevel: number = ROO_BEVEL.width) {}
  glyph(char: string) {
    if (!this.cache.has(char)) this.cache.set(char, rooGlyphGeometry(this.source.glyphs[char], this.bevel));
    return this.cache.get(char)!;
  }
  line(text: string, material: THREE.Material, tracking: number = ROO_BEVEL.tracking) {
    const layout = layoutRoo(this.source, text, tracking);
    const group = new THREE.Group();
    for (const letter of layout.letters) {
      const mesh = new THREE.Mesh(this.glyph(letter.char), material);
      mesh.position.x = letter.x - (layout.min + layout.max) / 2;
      group.add(mesh);
    }
    group.userData.width = layout.width;
    return group;
  }
  dispose() { for (const geometry of this.cache.values()) geometry.dispose(); this.cache.clear(); }
}
