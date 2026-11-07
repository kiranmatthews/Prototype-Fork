import {DESERT_VISTA_ASSETS} from './desertVistaCatalog';
import {DESERT_PLANT_ASSETS} from './desertPlants';
/** Seeded native RockGenerator bakes; never substitute distance meshes. */
const rock=(file:string,label:string,size:readonly[number,number,number])=>({file:`../desert-canyon/${file}`,label:`Bryce · ${label}`,size,wind:false,normalStrength:0,doubleSided:false,cellSize:85});
export const DESERT_ASSETS={
  ...DESERT_VISTA_ASSETS,
  ...DESERT_PLANT_ASSETS,
  canyonpine:{file:'../desert-canyon/canyon-pine',label:'Bryce · reshaped existing native pine',size:[7.2,20,7] as const,wind:true,normalStrength:0,doubleSided:false,cellSize:65},
  // Basin woodland retains every native triangle. Static sheltered groves
  // avoid evaluating branch wind and two-sided foliage lighting millions of
  // times for distant trees; near-trail conifers and groundcover still sway.
  canyonwoodland:{file:'../country-club-art/umbrella-pine',label:'Bryce · existing broad woodland pine',size:[17,12.61267,16.07851] as const,wind:false,normalStrength:0,doubleSided:false,cellSize:96},
  canyonpinegrove:{file:'../desert-canyon/canyon-pine',label:'Bryce · full native pine grove',size:[7.2,20,7] as const,wind:false,normalStrength:0,doubleSided:false,cellSize:96},
  canyonscrub:{file:'../custard-creek/bank-shrub',label:'Bryce · existing fine-leaved scrub',size:[10,4.51875,9.77088] as const,wind:true,normalStrength:.08,doubleSided:false,cellSize:96},
  canyongrasspatch:{file:'../desert-canyon/grass-cluster',label:'Bryce · four complete native grass tufts',size:[1.702918,.4212,1.518972] as const,wind:true,normalStrength:0,doubleSided:true,cellSize:96},
  desertsurveyrim:rock('survey-rim','measured Wall Street amphitheatre',[320,138.12,320]),
  deserthoodoospire:rock('hoodoo-spire','eroded sandstone spire',[9,35,8]),
  deserthoodoocap:rock('hoodoo-cap','undercut capstone',[9,25,7]),
  deserthoodoofluted:rock('hoodoo-fluted','fluted cathedral buttress',[14,42,12]),
  deserthoodooneedle:rock('hoodoo-needle','slender hoodoo needle',[5.3,28,4.5]),
  deserthoodoobuttress:rock('hoodoo-buttress','broad layered buttress',[20,32,17]),
  deserthoodoolow:rock('hoodoo-low','eroded low shelf',[14,9,12]),
  deserthoodootwins:rock('hoodoo-twins','paired capstone towers',[15,35,10]),
  deserthoodoofin:rock('hoodoo-fin','thin sandstone fin',[22,35,8]),
  deserttalus:{...rock('talus','soft sculpted clay pebbles',[5.6,3.2,4.5]),clay:true},
} as const;
