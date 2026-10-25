import type {CustomComponent} from '../level';
import {COASTAL_TOWN_ASSETS} from '../coastalTownAssets';
import {ROOFTOP_KOOK_ASSETS} from '../rooftopKookAssets';
import {COUNTRY_CLUB_ASSETS} from '../countryClubAssets';

type P=[number,number,number];
const assets={...COASTAL_TOWN_ASSETS,...ROOFTOP_KOOK_ASSETS,...COUNTRY_CLUB_ASSETS};

/** A low riverside gallery. Native Meshy bays supply the entire worn facade,
 * bowed canopy, columns and rails; contact decks and landscape stay editable. */
export function dressStormPorch(components:CustomComponent[]):void{
 const model=(kind:keyof typeof assets,p:P,scale:number,yaw=0,grp=90)=>components.push({t:'decor',dkind:kind,p,
  s:assets[kind].size.map(n=>n*scale) as P,yaw,solid:false,scenerySolid:false,grp,nm:assets[kind].label});
 // The measured canopy projects 0.55m beyond its column feet. Recess the
 // complete native bay so the playable line sits under that eave, in front
 // of the columns; no foreground pillar can conceal a jump or landing.
 for(const x of [0,25,50,75,100])model('kookstormveranda',[x,-.05,-5.95],1);
 for(const [a,b] of [[-12,26],[32,70],[86,108]]){
  const count=Math.ceil((b-a)/4.35),pitch=(b-a)/count;
  for(let i=0;i<count;i++)model('kookstormrail',[a+pitch*(i+.5),-.03,4.05],pitch/6);
  components.push({t:'platform',p:[(a+b)/2,-1.1,-4.5],s:[b-a,1.3,16.6],tex:'stone',color:'#9a9c88',
   solid:false,scenerySolid:false,grp:90,nm:'Low weathered estate foundation'});
 }
 model('kookstormrail',[14,4.2,-1.65],1.22);
 for(const x of [-8,19,38,62,88,100])model('baypot',[x,.02,-3.1],.9,x*11);
 for(const x of [3,44,94])model('kookhydrangea',[x,-1.4,7.1],.72,0,91);
 for(const x of [22,66])model('bayvine',[x,.1,-4.7],1.2,0);

 // Uneven lawns slope into a sinuous tidal bank. Fixed geometry at every
 // viewing distance; world-sized turf UVs remain aligned across each strip.
 const shore=(x:number)=>14+2.4*Math.sin(x*.052)+1.3*Math.sin(x*.117);
 const ground=(front:boolean,side?:[number,number])=>{
  const vertices:number[]=[],indices:number[]=[],colors:number[]=[],uvs:number[]=[];
  const nx=side?20:62,nz=side?3:14;
  for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){
   const x=side?side[0]+i/nx*(side[1]-side[0]):-95+i*4.6,t=j/nz;
   const z=side?-5.3+t*9:front?3.7+t*(shore(x)+10-3.7):-100+t*94.7;
   const bank=front&&!side?Math.max(0,Math.min(1,(z-shore(x)+1)/8)):0;
   const y=-1.34+.16*Math.sin(x*.09)*Math.sin(z*.23)-4.3*bank*bank;
   vertices.push(x,y,z);uvs.push(x/8,z/8);
   const shade=.94+.055*Math.sin(x*.67+z*.35);
   colors.push(shade*(1-.1*bank),shade*(1-.16*bank),shade*(1-.06*bank));
  }
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
   const a=i*(nz+1)+j,b=a+nz+1;indices.push(a,a+1,b,b,a+1,b+1);
  }
  components.push({t:'mesh',p:[0,0,0],vertices,indices,colors,uvs,tex:'country-turf',color:'#8fa970',
   solid:true,...(side?{lethal:true}:{}),castShadow:false,grp:91,nm:side?'Grounded live-oak side garden':front?'Sinuous riverbank and rain-dark lawn':'Manor grounds at garden level'});
 };
 ground(true);ground(false);
 // The garden meets the stone foundation and continues around both ends;
 // only the actual repair openings expose water beneath the playable lane.
 ground(false,[-95,-12]);ground(false,[108,190.2]);
 components.push({t:'mesh',p:[48,-2.65,0],vertices:[-240,0,-160,240,0,-160,240,0,200,-240,0,200],
  indices:[0,2,1,0,3,2],uvs:[0,0,40,0,40,30,0,30],tex:'custard-water',materialStyle:'jungle-stream',
  solid:false,scenerySolid:false,doubleSided:true,lethal:true,color:'#537c83',opacity:.9,castShadow:false,grp:91,
  nm:'Storm-grey tidal river and flooded repair channels'});
 components.push({t:'pit',p:[48,-2.95,0],s:[160,1,10],invisible:true,grp:91,nm:'Flooded porch repair channels'});

 // The original full Meshy manor anchors the gallery. Live oaks, flowers
 // and low stone margins connect the building to the ground and water.
 model('kookclubhouse',[50,-1.3,-44],1.7,0,91);
 for(const [x,z,scale] of [[-24,-9,1.5],[-41,13,1.45],[132,-17,1.7],[156,12,1.4],[-51,-49,1.8],[140,-61,1.9]])
  model('countryoak',[x,-1.4,z],scale,x*13,91);
 for(const [x,z,scale] of [[-13,9,.23],[19,13,.18],[56,10,.22],[81,11,.2],[112,13,.26]])
  model('bayrock',[x,-2.7,z],scale,x*7,91);
 for(const [x,z] of [[-17,-5],[118,-7],[-28,7],[127,9]])model('kookhydrangea',[x,-1.2,z],.85,x*9,91);
 for(const [x,z,scale] of [[-70,110,.75],[90,126,.9],[185,100,.8]]){
  model('kookestate',[x,-1.2,z],scale,180,91);
  model('countryoak',[x-19,-1.4,z+7],1.4,x,91);
 }
 components.push({t:'platform',p:[50,-4,138],s:[420,5.4,60],tex:'country-turf',color:'#657c72',
  pts:[[-210,-27,10],[-132,-31,12],[-60,-24,14],[18,-33,16],[110,-25,12],[210,-29,12],[210,30,10],[-210,30,10]],
  solid:false,scenerySolid:false,grp:91,nm:'Distant settled riverbank'});
}
