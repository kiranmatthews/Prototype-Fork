import type {CampaignIslandId} from './campaign';
import type {MapSceneryPiece} from './mapDioramas';

/** One dominant silhouette per island; all surfaces are original Meshy assets. */
export const MAP_ISLAND_LANDFORMS:Partial<Record<CampaignIslandId,{
  piece:MapSceneryPiece;extras?:MapSceneryPiece[];plants:readonly (readonly [number,number])[];
}>>={
  'island-1':{
    piece:{asset:'motu-ridge',p:[0,1,-1],extent:1,yaw:-64,size:[64,60,58]},
    extras:[
      {asset:'sandstone',p:[-20,.5,9],extent:1,yaw:30,size:[17,17,16]},
      {asset:'sandstone',p:[19,.5,-8],extent:1,yaw:-25,size:[15,21,18]},
      {asset:'thicket',p:[-19,15,8],extent:12,yaw:20},
      {asset:'thicket',p:[18,19,-8],extent:11,yaw:0},
    ],
    plants:[[-18,4],[-14,-9],[-6,12],[9,15],[18,4],[13,-12],[-4,-18],[2,2],[-21,11],[20,-7],[4,-10]],
  },
  'island-2':{
    piece:{asset:'uga-karst',p:[0,1,-1],extent:1,yaw:-50,size:[57,52,49]},
    extras:[
      {asset:'gorge',p:[-21,.2,4],extent:1,yaw:45,size:[16,15,17]},
      {asset:'gorge',p:[17,.5,12],extent:1,yaw:125,size:[18,12,16]},
      {asset:'thicket',p:[-20,13,4],extent:10,yaw:20},
      {asset:'thicket',p:[16,10,12],extent:11,yaw:20},
    ],
    plants:[[-17,-7],[-13,11],[14,-11],[17,5],[-8,-16],[9,16],[4,8],[-22,2]],
  },
  'island-3':{
    piece:{asset:'spooky-escarpment',p:[0,1,-2],extent:1,yaw:-53,size:[50,54,46]},
    extras:[
      {asset:'ivy',p:[-14,14,13],extent:13,yaw:30},
      {asset:'ivy',p:[12,24,9],extent:15,yaw:120},
      {asset:'boulder',p:[-20,0,-10],extent:14,yaw:60},
      {asset:'boulder',p:[19,0,2],extent:12,yaw:-20},
    ],plants:[],
  },
  'island-4':{
    piece:{asset:'quay-headland',p:[0,-5,0],extent:1,yaw:15,size:[66,17,52]},
    extras:[{asset:'harbour-rooftops',p:[0,10,0],extent:28,yaw:-139}],
    plants:[[-20,4],[-13,-12],[11,-14],[19,3],[6,13],[-6,5]],
  },
  'island-5':{
    piece:{asset:'volcano',p:[0,0,-1],extent:1,yaw:30,size:[61,55,61]},
    extras:[{asset:'quagmire-caldera',p:[0,-54,-1],extent:1,yaw:30,size:[68,76,64]}],plants:[],
  },
};
