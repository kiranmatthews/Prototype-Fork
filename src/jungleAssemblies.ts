import * as THREE from "three";
import { JUNGLE_MODULES, type JungleModuleKind } from "./jungleModules";
import type { CustomComponent } from "./level";

export const JUNGLE_ASSEMBLY_KINDS = ["templeplatform", "templewall", "roofedtemple", "hangingarch"] as const;
export type JungleAssemblyKind = typeof JUNGLE_ASSEMBLY_KINDS[number];
export type JunglePartKind = JungleModuleKind | "joint" | "earth" | "vine";
export interface JunglePart { kind: JunglePartKind; matrix: THREE.Matrix4; color: string; }
export interface JungleAssemblySpec {
  dkind: JungleAssemblyKind; p: [number, number, number]; s?: [number, number, number];
  w?: number; yaw?: number; amp?: number; vr?: number; seed?: number; color?: string; openFloor?: boolean;
}
export const JUNGLE_ASSEMBLY_SIZES: Record<JungleAssemblyKind, [number,number,number]> = {
  templeplatform: [4,2,4], templewall: [6,5,1.4], roofedtemple: [14,13,12], hangingarch: [20,13,2.8],
};
export function isJungleAssembly(kind: string): kind is JungleAssemblyKind {
  return (JUNGLE_ASSEMBLY_KINDS as readonly string[]).includes(kind);
}
export const masonryRandom = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 8.233) * 43758.5453; return x - Math.floor(x);
};
const STONE_COLORS = ["#f2eedf", "#e1e8db", "#eee2cb", "#ffffff", "#d7dfd2"];
const JOINT = "#3f493e";

class Parts {
  values: JunglePart[] = [];
  constructor(readonly seed = 0) {}
  add(kind: JunglePartKind, x: number, y: number, z: number,
      size?: readonly [number, number, number], yaw = 0, roll = 0, color = "#ffffff"): void {
    const dims = size ?? (kind in JUNGLE_MODULES ? JUNGLE_MODULES[kind as JungleModuleKind].size : [1,1,1]);
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(yaw), THREE.MathUtils.degToRad(roll), "YXZ")),
      new THREE.Vector3(...dims));
    this.values.push({ kind, matrix, color });
  }
  append(parts: JunglePart[], transform = new THREE.Matrix4()): void {
    for (const p of parts) this.values.push({ ...p, matrix: transform.clone().multiply(p.matrix) });
  }
  stone(x: number, y: number, z: number, size: [number,number,number], index: number, yaw = 0): void {
    const r = masonryRandom(this.seed + index * 37);
    const kind = r > 0.92 ? "fracturedstoneblock" : r > 0.83 ? "wornstoneblock" : "stoneblock";
    this.add(kind, x,y,z,size,yaw + (r < 0.48 ? 180 : 0),0,STONE_COLORS[Math.floor(masonryRandom(index * 13 + this.seed) * STONE_COLORS.length)]);
  }
}

/** A bonded wall of individual stones. A recessed mortar core closes the joints. */
export function templeWallParts(width: number, height: number, depth: number, seed = 0, cap = true): JunglePart[] {
  const p = new Parts(seed);
  const w = Math.max(0.3,width), h = Math.max(0.2,height), d = Math.max(0.2,depth);
  const capH = cap ? Math.min(0.38, h * 0.12) : 0;
  const bodyH = h-capH;
  p.add("joint",0,0,0,[Math.max(.1,w-.08),h-.035,Math.max(.1,d-.12)],0,0,JOINT);
  const courses = Math.max(1,Math.round(bodyH)), courseH=bodyH/courses;
  const nominal = Math.min(2.25,w);
  let index=0;
  for(let row=0;row<courses;row++) {
    let cursor=-w/2;
    const first=row%2 ? nominal*.5 : nominal;
    while(cursor < w/2-.01) {
      const span=Math.min(cursor===-w/2?first:nominal,w/2-cursor);
      p.stone(cursor+span/2,row*courseH+.015,0,[Math.max(.12,span-.035),courseH-.028,d],index++);
      cursor+=span;
    }
  }
  if(capH>0) {
    const scale=capH/.75, count=Math.max(1,Math.round(w/(3*scale))), span=w/count;
    for(let i=0;i<count;i++) p.add("stonecornice",-w/2+(i+.5)*span,bodyH,0,[span+.015,capH,d+.18]);
  }
  return p.values;
}

/** Paving is individual slabs with real dirt-filled joints and occasional missing stones. */
export function templePlatformParts(width: number, height: number, depth: number, seed = 0): JunglePart[] {
  const p=new Parts(seed), w=Math.max(.5,width),h=Math.max(.25,height),d=Math.max(.5,depth);
  const slabH=Math.min(.28,h*.5), bodyH=h-slabH;
  p.add("earth",0,0,0,[w-.04,h-.025,d-.04],0,0,"#d7c5a4");
  if(bodyH>.2) {
    p.append(templeWallParts(w,bodyH,Math.min(1,d*.35),seed,false),new THREE.Matrix4().makeTranslation(0,0,d/2-.5));
    if(d>2) p.append(templeWallParts(w,bodyH,Math.min(1,d*.35),seed+107,false),new THREE.Matrix4().makeTranslation(0,0,-d/2+.5));
    if(d>2&&w>2) for(const side of [-1,1]) {
      const matrix=new THREE.Matrix4().makeRotationY(Math.PI/2);
      matrix.setPosition(side*(w/2-.5),0,0);
      p.append(templeWallParts(d-2,bodyH,1,seed+side*73,false),matrix);
    }
  }
  const nx=Math.max(1,Math.round(w/2)),nz=Math.max(1,Math.round(d/2));
  const sx=w/nx,sz=d/nz;
  const longFloor=h<1.3&&Math.min(w,d)>10&&Math.max(w,d)>16;
  for(let ix=0;ix<nx;ix++) for(let iz=0;iz<nz;iz++) {
    const id=ix*71+iz*193+seed;
    const x=-w/2+(ix+.5)*sx,z=-d/2+(iz+.5)*sz;
    // Quiet runs of exposed earth break the paving into believable surviving patches.
    const along=w>d?x:z,across=w>d?z:x;
    const trail = Math.abs(across - Math.sin(along*.105 + seed*.002)*1.2) < 1.55;
    const lostPatch = Math.sin(x*.29+z*.23+seed*.01)+Math.sin(z*.135-x*.17) > .95;
    if(longFloor&&(trail||lostPatch)) continue;
    p.add("stonepaver",x,bodyH,z,[sx-.045,slabH,sz-.045],(Math.floor(masonryRandom(id+3)*4))*90,0,
      STONE_COLORS[Math.floor(masonryRandom(id+9)*STONE_COLORS.length)]);
  }
  return p.values;
}

function column(p: Parts, x: number, y: number, z: number, top: number, seed: number): void {
  p.add("stonebase",x,y,z);
  const bodyBottom=y+.85, bodyHeight=Math.max(.5,top-bodyBottom-1.15);
  const count=Math.max(1,Math.floor(bodyHeight/1.8));
  const spacer=bodyHeight-count*1.8;
  if(spacer>.03) p.add("stoneblock",x,bodyBottom,z,[1.65,spacer,1.65],0,0,"#dfe5d7");
  for(let i=0;i<count;i++) p.add("stoneshaft",x,bodyBottom+Math.max(0,spacer)+i*1.8,z,
    [1.65,1.8,1.65],(i+seed)%2?180:0,0,i%2?"#eee6d5":"#ffffff");
  p.add("stonecapital",x,top-1.15,z);
}

function roofBelt(p: Parts,w: number,d: number,y: number): void {
  const corner=3;
  for(const sx of [-1,1]) for(const sz of [-1,1]) {
    const yaw=sx>0?(sz>0?0:90):(sz>0?-90:180);
    p.add("stonecorner",sx*(w/2-corner/2),y,sz*(d/2-corner/2),[corner,.75,corner],yaw);
  }
  const wx=Math.max(0,w-2*corner),dz=Math.max(0,d-2*corner);
  for(const side of [-1,1]) {
    if(wx>.1) {const n=Math.max(1,Math.round(wx/3));for(let i=0;i<n;i++)p.add("stonecornice",-wx/2+(i+.5)*wx/n,y,side*(d/2-.575),[wx/n+.02,.75,1.15],side>0?0:180);}
    if(dz>.1) {const n=Math.max(1,Math.round(dz/3));for(let i=0;i<n;i++)p.add("stonecornice",side*(w/2-.575),y,-dz/2+(i+.5)*dz/n,[dz/n+.02,.75,1.15],side>0?90:-90);}
  }
}

/** Three roof courses, assembled from straight slope blocks and separate hip corners. */
function roof(p: Parts,width: number,depth: number,y: number,damaged: boolean): void {
  roofBelt(p,width,depth,y-.75);
  const levels=Math.max(1,Math.min(3,Math.floor(Math.min(width,depth)/3.6)));
  for(let row=0;row<levels;row++) {
    const w=width-row*3.6,d=depth-row*3.6,base=y+row*.85-.2;
    if(w<3||d<3) break;
    for(const sx of [-1,1]) for(const sz of [-1,1]) {
      if(damaged&&row===0&&sx<0&&sz>0)continue;
      const yaw=sx>0?(sz>0?0:90):(sz>0?-90:180);
      p.add("stonehip",sx*(w/2-1),base,sz*(d/2-1),[2,1.1,2],yaw);
    }
    const across=Math.max(.2,w-4),along=Math.max(.2,d-4);
    for(const side of [-1,1]) {
      const nx=Math.max(1,Math.round(across/2));
      for(let i=0;i<nx;i++) {
        if(damaged&&row===0&&side>0&&i===0)continue;
        p.add("stoneroof",-across/2+(i+.5)*across/nx,base,side*(d/2-1),[across/nx+.015,1.1,2],side>0?0:180);
      }
      if(d>4.1) {const nz=Math.max(1,Math.round(along/2));for(let i=0;i<nz;i++)p.add("stoneroof",side*(w/2-1),base,-along/2+(i+.5)*along/nz,[along/nz+.015,1.1,2],side>0?90:-90);}
    }
  }
  const capW=Math.max(2,width-(levels-1)*3.6-3.9),capD=Math.max(.75,depth-(levels-1)*3.6-3.9);
  p.add("joint",0,y+(levels-1)*.85+.72,0,[capW,.3,capD],0,0,"#858a74");
  const n=Math.max(1,Math.round(capW/2));
  for(let i=0;i<n;i++)p.add("stoneridge",-capW/2+(i+.5)*capW/n,y+(levels-1)*.85+.75,0,[capW/n+.02,.65,Math.max(.85,capD)]);
}

/** A real module assembly: plinth, six columns, beams, cornices and a stepped hip roof. */
export function templePavilionParts(width=14,height=13,depth=12,seed=0,damaged=false,openFloor=false): JunglePart[] {
  const p=new Parts(seed),w=Math.max(9,width),d=Math.max(8,depth),h=Math.max(10,height);
  if(!openFloor)p.append(templePlatformParts(w,.9,d,seed));
  const eave=h-3.2,beamBottom=eave-1.75,columnTop=beamBottom;
  const xs=[-w/2+1.7,w/2-1.7],zs=d>10?[-d/2+1.7,0,d/2-1.7]:[-d/2+1.7,d/2-1.7];
  let index=0;
  for(const x of xs)for(const z of zs)column(p,x,openFloor?0:.9,z,columnTop,index++);
  for(const side of [-1,1]) {
    const span=w-1.1,n=Math.max(2,Math.round(span/4));
    for(let i=0;i<n;i++)p.add("stonelintel",-span/2+(i+.5)*span/n,beamBottom,side*(d/2-1.7),[span/n+.015,1,1.1],side>0?0:180);
    const sideSpan=d-2.3,nz=Math.max(1,Math.round(sideSpan/4));
    for(let i=0;i<nz;i++)p.add("stoneblock",side*(w/2-1.7),beamBottom,-sideSpan/2+(i+.5)*sideSpan/nz,[sideSpan/nz,1,1.1],90);
  }
  roof(p,w+.8,d+.8,eave,damaged);
  // One crest at the front, with plain stone around it to make the carving count.
  p.add("stonefrieze",0,eave+.85,d/2-1.6,[2,1.5,.65]);
  if(!openFloor)for(let i=0;i<3;i++)p.add("stonestep",0,i*.3,d/2+.9-i*.8,[3,.45,1.05]);
  if(damaged) {
    p.add("fracturedstoneblock",-w/2-.4,0,d/2-.1,[2,1,1],-18,7);
    p.add("stonepaver",-w/2-.8,.12,d/2+1.2,[2,.28,2],32,-11);
  }
  return p.values;
}

/** The curve is authored from separate voussoirs, with independently stacked piers. */
export function templeArchParts(width=20,height=13,depth=2.8,seed=0): JunglePart[] {
  const p=new Parts(seed),radius=Math.max(4,width/2-2),radial=1.2;
  const centerY=Math.max(3,height-radius-radial/2),columnTop=centerY-.65;
  for(const side of [-1,1])column(p,side*radius,0,0,columnTop,side+2);
  let count=Math.max(13,Math.round(Math.PI*(radius+.6)/1.36)+1);if(count%2===0)count++;
  const arcStep=Math.PI/(count-1),outerWidth=(radius+.6)*arcStep-.015;
  for(let i=0;i<count;i++) {
    const phi=i*arcStep,dx=Math.cos(phi),dy=Math.sin(phi);
    p.add("stonearch",dx*(radius-radial/2),centerY+dy*(radius-radial/2),0,
      [outerWidth,radial,Math.min(1.65,depth)],0,THREE.MathUtils.radToDeg(phi)-90,
      STONE_COLORS[i%STONE_COLORS.length]);
  }
  p.add("stonefrieze",0,centerY+radius-.95,.7,[1.85,1.4,.45]);
  for(const side of [-1,1])p.add("vine",side*radius*.34,centerY+radius-2.9,.8,[radius*.72,3,1],0,0,"#52723d");
  return p.values;
}

export function jungleAssemblyParts(spec: JungleAssemblySpec): JunglePart[] {
  const [w,h,d]=spec.s??JUNGLE_ASSEMBLY_SIZES[spec.dkind],seed=spec.seed??Math.round(spec.p[0]*13+spec.p[2]*7);
  let parts: JunglePart[];
  if(spec.dkind==="templeplatform")parts=templePlatformParts(w,h,d,seed);
  else if(spec.dkind==="templewall")parts=templeWallParts(w,h,d,seed);
  else if(spec.dkind==="roofedtemple")parts=templePavilionParts(w,h,d,seed,(spec.vr??0)%2===1,spec.openFloor??false);
  else parts=templeArchParts(w,h,d,seed);
  const transform=new THREE.Matrix4().compose(new THREE.Vector3(...spec.p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0,THREE.MathUtils.degToRad(spec.yaw??0),THREE.MathUtils.degToRad(spec.amp??0),"YXZ")),
    new THREE.Vector3().setScalar(spec.w??1));
  const tint=new THREE.Color(spec.color??"#ffffff");
  return parts.map(part=>({kind:part.kind,matrix:transform.clone().multiply(part.matrix),
    color:'#'+new THREE.Color(part.color).multiply(tint).getHexString()}));
}

/** Flatten a composed landmark into individually editable, grouped source components. */
export function jungleAssemblyComponents(spec: JungleAssemblySpec, name: string, group?: number): CustomComponent[] {
  const parts=jungleAssemblyParts(spec), out:CustomComponent[]=[];
  const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3(),e=new THREE.Euler(0,0,0,"YXZ");
  for(const [i,part] of parts.entries()) {
    part.matrix.decompose(p,q,s);e.setFromQuaternion(q,"YXZ");
    if(part.kind==="vine") {out.push({t:"decor",dkind:"junglevine",p:[p.x,p.y,p.z],s:[s.x,s.y,s.z],nm:name+' vines',grp:group});continue;}
    if(part.kind==="joint"||part.kind==="earth") {
      const center=new THREE.Vector3(0,.5,0).applyMatrix4(part.matrix);
      out.push({t:"decor",dkind:"block",p:[center.x,center.y,center.z],s:[s.x,s.y,s.z],yaw:THREE.MathUtils.radToDeg(e.y),
        color:part.color,tex:part.kind==="earth"?"dirt":"solid",nm:name+' joint bed',grp:group});
    } else out.push({t:"decor",dkind:part.kind,p:[p.x,p.y,p.z],s:[s.x,s.y,s.z],yaw:THREE.MathUtils.radToDeg(e.y),
      amp:THREE.MathUtils.radToDeg(e.z),color:part.color,solid:false,nm:`${name} / ${JUNGLE_MODULES[part.kind].label} ${i+1}`,grp:group});
  }
  return out;
}
