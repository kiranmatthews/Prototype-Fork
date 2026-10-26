import * as THREE from 'three';
import { bevelBox,placed,merged } from './geometry';
/** One compact shared housing, three outward sockets. Source image proportions
 * are interpreted as a stylized game prop; rear mounting detail is inferred. */
export const SIDE_NOZZLE={x:1.225,y:.75,z:.18,spacing:.25} as const;
export type NozzleMaterial='nozzleCream'|'nozzleBrass'|'nozzleRing'|'nozzleSoot'|'nozzleOrange';
export interface NozzlePart {name:string;material:NozzleMaterial;geometry:THREE.BufferGeometry}
function panel(w:number,h:number,r:number,depth:number){
  const s=new THREE.Shape(),x=-w/2,y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  for(const z of [-SIDE_NOZZLE.spacing,0,SIDE_NOZZLE.spacing]){const hole=new THREE.Path();hole.absarc(z,0,.092,0,Math.PI*2,true);s.holes.push(hole);}
  return new THREE.ExtrudeGeometry(s,{depth,steps:1,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:2,curveSegments:10});
}
export function createTripleNozzleParts():NozzlePart[]{
  const result:NozzlePart[]=[];
  for(const side of [-1,1]){
    const add=(name:string,material:NozzleMaterial,geos:THREE.BufferGeometry[])=>result.push({name:`triple-nozzle-${name}-${side}`,material,geometry:merged(geos)});
    add('housing','nozzleCream',[placed(panel(.82,.32,.055,.23).rotateY(side*Math.PI/2),[side*.94,.75,.18]),placed(bevelBox(.035,.28,.77,.01),[side*.944,.75,.18])]);
    add('mount','nozzleSoot',[placed(bevelBox(.16,.16,.28,.025),[side*.95,.55,.18])]);
    add('front-insert','nozzleSoot',[placed(panel(.76,.265,.03,.012).rotateY(side*Math.PI/2),[side*1.18,.75,.18])]);
    const lips:THREE.BufferGeometry[]=[],cups:THREE.BufferGeometry[]=[],fins:THREE.BufferGeometry[]=[];
    for(const offset of [-SIDE_NOZZLE.spacing,0,SIDE_NOZZLE.spacing]){
      const z=SIDE_NOZZLE.z+offset;
      lips.push(placed(new THREE.TorusGeometry(.101,.015,8,20).rotateY(Math.PI/2),[side*1.21,.75,z]));
      // Real concave bell, with a deep closed throat and no flat black disc at
      // its opening. The outward lip and emitter share the same local axis.
      const profile=[[0,-.12],[.05,-.12],[.068,-.10],[.080,-.06],[.086,-.02],[.087,0]].map(([r,h])=>new THREE.Vector2(r,h));
      const cup=new THREE.LatheGeometry(profile,20),indices=cup.getIndex()!;
      for(let i=0;i<indices.count;i+=3){const b=indices.getX(i+1);indices.setX(i+1,indices.getX(i+2));indices.setX(i+2,b);}cup.computeVertexNormals();
      cups.push(placed(cup.rotateZ(-side*Math.PI/2),[side*1.21,.75,z]));
      for(const n of [-1,1])fins.push(placed(bevelBox(.17,.052,.047,.013),[side*1.04,.922,z+n*.051]));
    }
    add('brass-lips','nozzleRing',lips);add('inner-cups','nozzleSoot',cups);add('cooling-fins','nozzleOrange',fins);
    add('mount-fastener','nozzleBrass',[placed(new THREE.CylinderGeometry(.033,.033,.014,10).rotateZ(Math.PI/2),[side*1.037,.55,.18])]);
  }
  return result;
}
