// Modular Meshy T2 assets. Source prompts, budget and measured GLBs: tools/map-kit.
export const MAP_MODULES = {
  mapcliff:{file:'../map-kit/cliff-buttress',label:'island cliff buttress',size:[13,18,10],wind:false,normalStrength:.45,lod:true},
  mapridge:{file:'../map-kit/ridge-spine',label:'island volcanic ridge',size:[23,13,10],wind:false,normalStrength:.4,lod:true},
  maparch:{file:'../map-kit/sea-arch',label:'island sea arch',size:[20,15,10],wind:false,normalStrength:.4,lod:true},
} as const;
