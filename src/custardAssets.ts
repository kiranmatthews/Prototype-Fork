/** Custard Creek storyboard-derived layers; shared cached scenery pipeline. */
export const CUSTARD_ASSETS = {
  custardboulder:{file:'../custard-creek/moss-boulder',label:'Custard sculpted mossy sandstone boulder',size:[5,4.6219,4.3089],wind:false,lod:true,distanceLod:true,normalStrength:.3,doubleSided:false},
  custardwillow:{file:'../custard-creek/willow-grove',label:'Custard fine-leaved river willow',size:[18,17.6284,17.5156],wind:true,lod:true,distanceLod:true,normalStrength:.14,doubleSided:false},
  custardgrove:{file:'../custard-creek/willow-thicket',label:'Custard five-tree willow thicket',size:[94,19.6842,28.1268],wind:true,lod:true,distanceLod:true,normalStrength:.14,doubleSided:false},
  custardmill:{file:'../custard-creek/mill-house',label:'Custard timber watermill',size:[9,10.2344,9.7184],wind:false,lod:true,distanceLod:true,normalStrength:.2,doubleSided:false},
  custardvalley:{file:'',image:'custard-creek/valley-far.webp',label:'Custard sunset valley panorama',size:[216,72.8,.02],wind:false,matte:true},
  custardforest:{file:'',image:'custard-creek/forest-mid-alpha.webp',label:'Custard layered willow woodland',size:[90,30,.02],wind:false,matte:true,edgeFade:.045,fog:true},
  custardwaterreflection:{file:'',image:'custard-creek/valley-far.webp',label:'Custard sunset water reflection',size:[216,72.8,.02],wind:false,matte:true},
  custardfallvista:{file:'',image:'custard-creek/waterfall-vista.webp',label:'Custard waterfall summit valley vista',size:[216,72.6,.02],wind:false,matte:true,edgeFade:.12},
  custardfallcliffs:{file:'',image:'custard-creek/waterfall-cliffs-cutout.webp',label:'Custard layered gorge cascades',size:[150,50,.02],wind:false,matte:true,edgeFade:.12},
  custardfallmist:{file:'',image:'custard-creek/waterfall-mist-alpha.webp',label:'Custard translucent waterfall spray',size:[54,18,.02],wind:false,matte:true,edgeFade:.08},
} as const;
