/** Generated canvas clues and Meshy checkpoint art, reused at every refuge. */
const clue=(id:number)=>({file:'',image:`grove/clue-${id}.webp`,label:`No-Man’s Grove · clue ${id}`,size:[2.6,3.9,.02] as const,wind:false,matte:true,alphaCutout:true,fog:true});
export const GROVE_ASSETS={
  groveclue1:clue(1),groveclue2:clue(2),groveclue3:clue(3),groveclue4:clue(4),groveclue5:clue(5),
  groveclue6:clue(6),groveclue7:clue(7),groveclue8:clue(8),groveclue9:clue(9),groveclue10:clue(10),
  grovecamp:{file:'../grove/checkpoint-camp',label:'No-Man’s Grove · expedition refuge',size:[4.8,3.5,4.2] as const,wind:false,normalStrength:0,lod:false,doubleSided:true},
} as const;
