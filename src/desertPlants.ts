import {DESERT_PLANT_ASSETS} from './desertPlantCatalog';
export {DESERT_PLANT_ASSETS};
export type DesertPlantKind=keyof typeof DESERT_PLANT_ASSETS;
export const isDesertCactus=(kind:string|undefined)=>
  kind==='canyonsaguaro'||kind==='canyonpricklypear'||kind==='canyonbarrel';

/** Preserve each sculpt's authored proportions when planting at a chosen height. */
export function desertPlantSize(kind:DesertPlantKind,height:number):[number,number,number]{
  const size=DESERT_PLANT_ASSETS[kind].size;
  return [height*size[0]/size[1],height,height*size[2]/size[1]];
}
