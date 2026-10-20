import type {CustomComponent} from '../level';
import {treehouseTrialPoint} from './treehouse-trials-continuity';
const C:CustomComponent[]=[];
const ratio=1944/812;
function layer(kind:NonNullable<CustomComponent['dkind']>,p:[number,number,number],width:number,name:string,yaw=0,tint='#ffffff'){
  C.push({t:'decor',dkind:kind,p:treehouseTrialPoint(p),s:[width,width/ratio,.02],yaw,color:tint,nm:name,grp:6});
}
// Complete isolated silhouettes are staggered in depth and remain outside
// the traversable corridor. Their feet sit below the real forest floor.
for(const [z,y] of [[-65,-4],[-130,-17],[-214,-17],[-275,-17],[-437,-10],[-480,-10]] as const){
  layer('treehouserepairgrove',[-13,y,z],72,'Complete painted midground grove · left',5,'#b6caba');
  layer('treehouserepairgrove',[83,y-1,z-13],74,'Complete painted midground grove · right',-8,'#adc8ba');
  layer('treehouserepairridge',[-32,y-9,z-51],126,'Misty layered jungle ridge beyond the left grove',2,'#cfdfd5');
  layer('treehouserepairridge',[105,y-9,z-68],126,'Misty layered jungle ridge beyond the right grove',-5,'#c3d9d0');
}
layer('treehouserepairgrove',[-17,-4,-34],78,'Layered grove behind the coastal treehouse',0,'#c7d4be');
layer('treehouserepairgrove',[72,-4,-46],72,'Complete grove beyond the opening halfpipe',-8,'#bfceb8');
// Two complementary roof layers sit behind actual rock ribs and timber.
for(const [z,dx,y,width,yaw] of [[-331,-4,2.4,29,-7],[-350,5,2.8,31,9],[-371,-3,2.7,30,-6],[-393,4,1.6,29,7]] as const)
  layer('treehouserepairvines',[35+dx,y,z],width,'Layered hanging vines beneath the natural cavern roof',yaw,'#879d7c');
// End scenery follows the real rightward continuation, rather than placing a
// giant flat image across the gate's sightline.
layer('treehouserepairgrove',[6,-10,-455],80,'Exit forest foreground grove beside the turning path',3,'#b6ceb2');
layer('treehouserepairgrove',[98,-10,-477],86,'Exit forest middle layer beyond the bend',-11,'#bed4bd');
layer('treehouserepairridge',[38,-22,-513],138,'Exit distant canopy ridge in the open blue sky',0,'#d0ded2');
export const TREEHOUSE_REPAIR_MATTE_LAYERS=C;
