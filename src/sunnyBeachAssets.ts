import type { JungleAssetSpec } from './jungleAssets';

/** Shared Meshy meshes/atlases, instanced in route cells with a distant LOD. */
export const SUNNY_BEACH_ASSETS = {
  sunnycliff: {file:'../sunny-beach/sunny-sandstone',label:'Sunny beach / golden sandstone',size:[12,13.14197,5.63459],wind:false,lod:true,distanceLod:true,cellSize:44,lodRange:[100,170],normalStrength:0,doubleSided:false},
  sunnyhibiscus: {file:'../sunny-beach/sunny-hibiscus',label:'Sunny beach / hibiscus',size:[2.6,1.31457,2.6],wind:true,lod:true,distanceLod:true,cellSize:36,lodRange:[35,65],normalStrength:0,doubleSided:true},
} as const satisfies Record<string,JungleAssetSpec>;
