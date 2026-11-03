import { Float32BufferAttribute, type BufferGeometry } from 'three';
import type { ShoreSample } from '../unityOcean';
import { BEACHFRONT_SAND_BANK_LATERAL_SEGMENTS, BEACHFRONT_SAND_SUBMERGED_LATERAL_SEGMENTS,
  BEACHFRONT_SAND_WATERLINE_COLUMN, BEACHFRONT_SAND_TEXTURE_TILE_SIZE } from '../beachfrontCourse';

export const BANANA_BAY_SHORE_CLEARANCE=.65;
export const BANANA_BAY_OCEAN_WIDTH=1400;
// Continue the same single water surface around the mainland's western rim.
const LAGOON_WEST_EDGE=-900;

/** Read the actual fine sand contour, including its baked X reflection.
 * Parallel +X water rows keep the wide ocean injective through the tight
 * beach/lagoon turn; perpendicular offsets fold back over that curve. */
export function bananaBayWaterShore(sand:BufferGeometry,endZ:number):ShoreSample[]{
 const columns=BEACHFRONT_SAND_BANK_LATERAL_SEGMENTS+BEACHFRONT_SAND_SUBMERGED_LATERAL_SEGMENTS+1;
 const p=sand.getAttribute('position'),shore:ShoreSample[]=[];
 const endIndex=p.count-columns+BEACHFRONT_SAND_WATERLINE_COLUMN;
 const endShoreZ=p.getZ(endIndex);
 for(let row=0;row<p.count/columns;row++){
  const i=row*columns+BEACHFRONT_SAND_WATERLINE_COLUMN;
  const z=p.getZ(i),coastX=p.getX(i)+BANANA_BAY_SHORE_CLEARANCE;
  // Open the grid beneath the terminal headland before its sand ends. The
  // previous 90m offshore turn exposed the flat backdrop all around the pier.
  const t=Math.max(0,Math.min(1,(endShoreZ+16-z)/16)),ease=t*t*(3-2*t);
  shore.push({x:coastX+(LAGOON_WEST_EDGE-coastX)*ease,z,sx:1,sz:0,beachSlope:.055,bedSlope:.08});
 }
 const last=shore[shore.length-1];
 for(let z=last.z-4;z>=endZ-90;z-=4)shore.push({x:LAGOON_WEST_EDGE,z,sx:1,sz:0,beachSlope:0,bedSlope:0});
 return shore;
}

/** Continue the last sand row into a submerged rounded cap. Shared vertices
 * and UVs remove the rectangular open edge at the component-level join. */
export function extendBananaBayBeachSand(geometry:BufferGeometry):void {
 const columns=BEACHFRONT_SAND_BANK_LATERAL_SEGMENTS+BEACHFRONT_SAND_SUBMERGED_LATERAL_SEGMENTS+1;
 const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),color=geometry.getAttribute('color');
 const positions=Array.from(p.array),uvs=Array.from(uv.array),colors=Array.from(color.array),indices=Array.from(geometry.index!.array);
 const last=p.count-columns,steps=12;
 for(let row=1;row<=steps;row++)for(let col=0;col<columns;col++){
  const i=last+col,t=row/steps,across=col/(columns-1),length=12+6*Math.sin(Math.PI*across);
  const drop=t*t*(3-2*t),z=p.getZ(i)-length*t;
  positions.push(p.getX(i),p.getY(i)+(-2.8-p.getY(i))*drop,z);
  uvs.push(uv.getX(i),uv.getY(i)+(p.getZ(i)-z)/BEACHFRONT_SAND_TEXTURE_TILE_SIZE);
  colors.push(color.getX(i)+(1-color.getX(i))*drop,color.getY(i),color.getZ(i),color.getW(i));
 }
 for(let row=0;row<steps;row++)for(let col=0;col<columns-1;col++){
  const a=last+row*columns+col,b=a+columns;
  indices.push(a,b,a+1,a+1,b,b+1);
 }
 geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
 for(const name of ['uv','uv1','uv2'])geometry.setAttribute(name,new Float32BufferAttribute(uvs,2));
 geometry.setAttribute('color',new Float32BufferAttribute(colors,4));
 geometry.setIndex(indices);geometry.deleteAttribute('normal');geometry.computeVertexNormals();
 geometry.deleteAttribute('tangent');geometry.computeTangents();geometry.computeBoundingBox();geometry.computeBoundingSphere();
}
