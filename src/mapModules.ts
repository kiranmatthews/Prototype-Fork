// Sealed Meshy rock modules plus code-owned closed, large-leaf foliage.
export const MAP_MODULES = {
  mapcliff:{file:'../map-kit/clay-buttress',label:'solid clay cliff buttress',size:[12,18,10],wind:false,lod:true,clay:true},
  mapridge:{file:'../map-kit/clay-terrace',label:'solid clay cliff terrace',size:[22,11,12],wind:false,lod:true,clay:true},
  maparch:{file:'',label:'solid clay sea arch',size:[20,15,10],wind:false,lod:true,clay:true},
  mapbroadleaf:{file:'',label:'solid broad-leaf tree',size:[8,7,7],wind:true,lod:true,clay:true},
  mappalm:{file:'',label:'solid six-leaf palm',size:[7,8,7],wind:true,lod:true,clay:true},
  mapbanana:{file:'',label:'solid banana leaves',size:[4,4,4],wind:true,lod:true,clay:true},
  mapgroundleaf:{file:'',label:'solid three-leaf plant',size:[2.7,1.4,2.7],wind:true,lod:true,clay:true},
} as const;
