/** Seeded native RockGenerator bakes; never substitute distance meshes. */
const rock=(file:string,label:string,size:readonly[number,number,number])=>({file:`../desert-canyon/${file}`,label:`Bryce · ${label}`,size,wind:false,normalStrength:0,doubleSided:false,cellSize:85});
export const DESERT_ASSETS={
  canyonpine:{file:'../desert-canyon/canyon-pine',label:'Bryce · reshaped existing native pine',size:[7.2,20,7] as const,wind:true,normalStrength:0,doubleSided:false,cellSize:65},
  desertsurveyrim:rock('survey-rim','measured Wall Street amphitheatre',[320,138.12,320]),
  deserthoodoospire:rock('hoodoo-spire','eroded sandstone spire',[9,35,8]),
  deserthoodoocap:rock('hoodoo-cap','undercut capstone',[9,25,7]),
  deserthoodoofluted:rock('hoodoo-fluted','fluted cathedral buttress',[14,42,12]),
  deserthoodooneedle:rock('hoodoo-needle','slender hoodoo needle',[5.3,28,4.5]),
  deserthoodoobuttress:rock('hoodoo-buttress','broad layered buttress',[20,32,17]),
  deserthoodoolow:rock('hoodoo-low','eroded low shelf',[14,9,12]),
  deserthoodootwins:rock('hoodoo-twins','paired capstone towers',[15,35,10]),
  deserthoodoofin:rock('hoodoo-fin','thin sandstone fin',[22,35,8]),
  deserttalus:rock('talus','angular sandstone talus',[5.6,3.2,4.5]),
} as const;
