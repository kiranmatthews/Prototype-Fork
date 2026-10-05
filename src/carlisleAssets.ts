/** Carlisle's scenery shares the modular loader, cache and editor path.
 * Reused forms keep their measured proportions; their placements/palette are
 * authored independently of Treehouse Trials. No scenery owns collision. */
export const CARLISLE_ASSETS = {
  coastcliff:{file:'../carlisle-coast/cliff-bay',label:'Carlisle fractured sandstone cliff',size:[16,12.381,9.877],wind:false,distanceLod:true,normalStrength:.18,lod:true,doubleSided:false},
  coastspire:{file:'../carlisle-coast/canyon-spire',label:'Carlisle weathered canyon spire',size:[9,13.943,6.832],wind:false,distanceLod:true,normalStrength:.16,lod:true,doubleSided:false},
  coastshelf:{file:'../carlisle-coast/moss-shelf',label:'Carlisle moss crowned rocky shelf',size:[10,2.936,4.339],wind:false,distanceLod:true,normalStrength:.16,lod:true,doubleSided:false},
  coastpillar:{file:'../carlisle-coast/tiki-pillar',label:'Carlisle carved temple pillar',size:[3,9.444,2.518],wind:false,distanceLod:true,normalStrength:.2,lod:true,doubleSided:false},
  coastarch:{file:'../carlisle-coast/temple-lintel',label:'Carlisle broken temple gateway',size:[18,11.761,6.361],wind:false,distanceLod:true,normalStrength:.16,lod:true,doubleSided:false},
  coastfoliage:{file:'../carlisle-coast/red-foliage',label:'Carlisle coral leaf fern garden',size:[3,1.238,3],wind:true,distanceLod:true,normalStrength:.08,lod:true,doubleSided:false},
  coastbeachrock:{file:'../beachfront/stonecliff-bastion',label:'Carlisle coastal Stonecliff variant',size:[10,5.56641,5.48829],wind:false,distanceLod:true,normalStrength:0,lod:false,doubleSided:false},
  coastfern:{file:'../treehouse-trials-v2/fern-a',label:'Carlisle deep green fern',size:[3,1.601,2.798],wind:true,distanceLod:true,normalStrength:.1,lod:true,doubleSided:false},
  coastcarpet:{file:'../treehouse-trials-v2/groundcover-a',label:'Carlisle mossy verge planting',size:[5,1.043,2.581],wind:true,distanceLod:true,normalStrength:.08,lod:true,doubleSided:false},
  coastcrown:{file:'../treehouse-trials-v2/crown-b',label:'Carlisle overhanging leaf crown',size:[26,9.405,26],wind:true,distanceLod:true,normalStrength:.08,lod:true,doubleSided:false},
  coasttree:{file:'../treehouse-trials-v2/tree-b',label:'Carlisle ravine canopy tree',size:[26,16.741,17.709],wind:true,distanceLod:true,normalStrength:.1,lod:true,doubleSided:false},
} as const;
