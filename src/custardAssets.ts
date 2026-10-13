/** Custard Creek storyboard-derived layers; shared cached scenery pipeline. */
export const CUSTARD_ASSETS = {
  custardclifffoliage:{file:'../custard-creek/cliff-foliage',label:'Custard trailing willow foliage',size:[12,8.97083,12],wind:true,lod:true,distanceLod:true,normalStrength:.10,doubleSided:false},
  custardgorgecliff:{file:'../custard-creek/gorge-cliff',label:'Custard broad layered sandstone cliff',size:[50,25.9507,29.26705],wind:false,lod:true,distanceLod:true,normalStrength:.22,doubleSided:false},
  custardboulder:{file:'../custard-creek/moss-boulder',label:'Custard sculpted mossy sandstone boulder',size:[5,4.6219,4.3089],wind:false,lod:true,distanceLod:true,normalStrength:.3,doubleSided:false},
  custardwillow:{file:'../custard-creek/willow-grove',label:'Custard fine-leaved river willow',size:[18,17.6284,17.5156],wind:true,lod:true,distanceLod:true,normalStrength:.14,doubleSided:false},
  custardgrove:{file:'../custard-creek/willow-thicket',label:'Custard five-tree willow thicket',size:[94,19.6842,28.1268],wind:true,lod:true,distanceLod:true,normalStrength:.14,doubleSided:false},
  custardmill:{file:'../custard-creek/mill-house',label:'Custard timber watermill',size:[9,10.2344,9.7184],wind:false,lod:true,distanceLod:true,normalStrength:.2,doubleSided:false},
  custardvalley:{file:'',image:'custard-creek/valley-far.webp',label:'Custard sunset valley panorama',size:[216,72.8,.02],wind:false,matte:true},
  custardforest:{file:'',image:'custard-creek/forest-mid-alpha.webp',label:'Custard layered willow woodland',size:[90,30,.02],wind:false,matte:true,edgeFade:.045,fog:true},
  custardwaterreflection:{file:'',image:'custard-creek/valley-far.webp',label:'Custard sunset water reflection',size:[216,72.8,.02],wind:false,matte:true},
  custardfallvista:{file:'',image:'custard-creek/waterfall-pool-v4.webp',label:'Custard enclosed downstream pool',size:[270,151.96,.02],wind:false,matte:true,edgeFade:.008},
  custardfallcliffs:{file:'',image:'custard-creek/waterfall-cliffs-v2.webp',label:'Custard recessed sandstone gorge walls',size:[144,48,.02],wind:false,matte:true,edgeFade:.12},
  // Legacy asset ID remains readable in old saved levels; the main course has no mist placements.
  custardfallmist:{file:'',image:'custard-creek/waterfall-mist-alpha.webp',label:'Legacy Custard spray',size:[54,18,.02],wind:false,matte:true,edgeFade:.08},
} as const;
