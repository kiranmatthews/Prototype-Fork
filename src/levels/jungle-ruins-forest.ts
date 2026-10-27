import type { CustomComponent, DecorKind } from '../level';
import { jungleShoulderHeight } from '../jungleGround';

type Point = [number, number, number];

/** Treehouse's low carpet / fern / rooted thicket arrangement, fitted to the
 * existing Ruins banks. The playable corridor and all its openings stay clear. */
export function jungleRuinsForest(gx:(z:number)=>number,gy:(z:number)=>number,floor:number,canopy:number):CustomComponent[] {
  const out:CustomComponent[]=[];
  const prop=(kind:DecorKind,p:Point,s:Point,name:string,yaw=0,grp=floor,color='#ffffff')=>
    out.push({t:'decor',dkind:kind,p,s,yaw,color,nm:`Ruins forest · ${name}`,grp,
      solid:false,scenerySolid:false,edgeGrinding:false,castShadow:false});
  const soil=(z:number,offset:number)=>{
    const temple=z<-300&&z>-486;
    return gy(z)+(temple?16.3:jungleShoulderHeight(offset-(z>-34||z<-676?6.1:5.1),z));
  };
  const bands=[[12,-296],[-304,-482],[-496,-714]] as const;
  for(const [near,far]of bands)for(const side of [-1,1]){
    for(let z=near-3*side,i=0;z>far;z-=12.8,i++){
      const temple=z<-300&&z>-486,edge=temple?11.9:z>-34||z<-676?8.7:7.8;
      const shift=Math.sin(i*2.399+side),w=4.2+(i%3)*.4;
      prop(i%2?'trialsv2groundcovera':'trialsv2groundcoverb',
        [gx(z)+side*edge,soil(z,edge)-.22,z],[w,1.0+i%3*.13,3.4],
        'low moss and broadleaf carpet',side*67+i*137.5);
      const fz=z-3.5,fx=edge+1.1;
      prop(i%3?'trialsv2ferna':'trialsv2fernb',
        [gx(fz)+side*fx,soil(fz,fx)-.12,fz],[3.5,2.1,3.1],
        i%3?'layered green fern':'occasional copper fern',i*83+side*29);
      if(i%2===0){
        const rz=z-5.7,rx=edge+2.8;
        prop('treehousemossrock',[gx(rz)+side*rx,soil(rz,rx)-.65,rz],
          [4.7,2.5,3.5],'mossy stone nestled into the bank',side*23+i*51);
        prop('trialsv2groundcoverb',[gx(rz)+side*(rx-.3),soil(rz,rx)+.65,rz+.3],
          [3.2,.75,2.6],'small carpet spilling over a mossy stone',i*43);
      }
      if(i%2===1){
        const tx=edge+7.1+shift;
        prop('trialsv3thicket',[gx(z)+side*tx,soil(z,tx)-.24,z-3],
          [8.3,4.88,5.4],'rooted middle understory',side*39+i*137.5,canopy);
      }
      // Alternate the two real Treehouse trees at their measured proportions.
      // Their trunks stay behind the established broad leaves and palms.
      if(i%3===0){
        const offset=temple?25:21,width=23+(i%4)*1.2,kind=i%2?'trialsv2treea':'trialsv2treeb';
        prop(kind,[gx(z)+side*offset,soil(z,offset)-.48,z-7],
          [width,width*(i%2?.6833:.6439),width*(i%2?.9966:.6811)],
          'ancient tree behind the original palms',side*35+i*71,canopy);
      }
    }
  }
  // A handful of overhead boughs marks transitions; no repeated low ceiling.
  for(const [i,z]of [-28,-121,-246,-506,-607,-680].entries())for(const side of [-1,1])
    prop('trialsv3bough',[gx(z)+side*11.7,gy(z)+12.4,z+side*2],
      [15,5.8,7],'hanging crown at a forest threshold',side*24+i*19,canopy);

  // Actual three-dimensional trees mask the feet of these Treehouse plates.
  // Offset far enough to leave the route, arches and temple silhouettes open.
  for(const [i,z]of [-65,-196,-276,-354,-450,-544,-648].entries())for(const side of [-1,1]){
    const base=z<-300&&z>-486?16:0;
    prop('treehouserepairgrove',[gx(z)+side*52,base+gy(z)-4,z-28],
      [72,30.07,.02],'painted forest beyond the rooted trees',side*9,canopy,'#abc4b0');
    if(i%2===0)prop('treehouserepairridge',[gx(z)+side*77,base+gy(z)-9,z-74],
      [126,52.63,.02],'distant layered canopy ridge',side*5,canopy,'#c4d7cc');
  }
  // Local planting grows out of the elevated masonry instead of hovering at
  // the jungle's raised 16 m bank datum beside the temple cutting.
  for(const [i,z]of [-308,-330,-355,-381,-399,-426,-453,-477].entries()){
    // The five climbing blocks zigzag inside |x| <= 6.6. These edge plants
    // stand on the original floor, not an imaginary slope between the steps.
    const surface=(at:number)=>at>-386?0:at>=-444?11.5:11.5-(-444-at)/42*11.1;
    const y=surface(z);
    for(const side of [-1,1]){
      prop(i%2?'trialsv2groundcovera':'trialsv2groundcoverb',[side*7.35,y-.08,z],
        [2.0,.75,3.1],'moss in the outer temple joints',side*82+i*23);
      if(i%2===0)prop('trialsv2ferna',[side*7.65,surface(z-2)-.05,z-2],
        [2.35,1.5,2.2],'fern rooted behind the temple kerb',side*61+i*17);
    }
  }
  return out;
}
