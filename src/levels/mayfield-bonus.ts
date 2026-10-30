import { BoxGeometry, ShapeGeometry } from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';
import type { CustomLevelData } from '../level';
import { MALL_LEVEL } from './mall';
import { sourceAssembly } from './mayfield-source';
import { makeBonusCourse } from './bonus-course-kit';

// A compact prize-counter detour. The arrow, bridge switch and finite stack
// use the normal bonus mechanics; all rewards return to the same parent run.
export const MAYFIELD_BONUS_COURSE=makeBonusCourse({
  name:'Bonus: After Hours',patterns:['upper','bridge','finite'],
  style:{color:'#e2d3ae',accent:'#63aaa4',tex:'pavement',sky:'day'},
});
const data=MAYFIELD_BONUS_COURSE.data,C=data.components;
const font=new FontLoader().parse(fontData);
const art=(geo:BoxGeometry|ShapeGeometry,p:[number,number,number],color:string,nm:string)=>{
  geo.translate(...p);C.push({t:'mesh',p:[0,0,0],vertices:Array.from(geo.attributes.position.array),indices:geo.index?Array.from(geo.index.array):Array.from({length:geo.attributes.position.count},(_,i)=>i),color,tex:'solid',solid:false,edgeGrinding:false,grp:90,nm});geo.dispose();
};
const box=(p:[number,number,number],s:[number,number,number],color:string,nm:string)=>art(new BoxGeometry(...s),p,color,nm);
function sign(label:string,x:number,y:number,width:number,color='#7d6596'){
  box([x,y,-4.7],[width,2.5,.3],color,`${label} sign`);
  const geo=new ShapeGeometry(font.generateShapes(label,1),3);geo.computeBoundingBox();
  const b=geo.boundingBox!,k=Math.min(1,(width-1)/(b.max.x-b.min.x)),center=(b.min.x+b.max.x)/2;geo.scale(k,k,1);geo.translate(-center*k,-.4,0);
  art(geo,[x,y,-4.52],'#f8e4bd',`${label} lettering`);
}
// Keep an actual slice of the Mall's first galleria at full scale, facing the
// side-view play plane. Only the rear half is retained, so no foreground wall
// hides the crate decisions. It is scenery and cannot bridge the service gap.
const gallery=sourceAssembly(MALL_LEVEL,c=>c.t==='mesh',{
  pivot:[15,118.786,-80],target:[0,0,6],yaw:-90,scale:[1,1,1],
},'Mayfield bonus / original Mall galleria',91,[80,175],[-40,5]);
for(const c of gallery){c.solid=false;delete c.solidSides;delete c.skateCamera;delete c.gravityTrack;c.edgeGrinding=false;}
C.push(...gallery);
export const MAYFIELD_BONUS_SOURCE_TRIANGLES=gallery.reduce((n,c)=>n+(c.indices?.length??0)/3,0);

// Open-front retail mezzanine. Store pilasters and fascia stay behind the
// player; front lips sit below the walkable surface, including the hidden span.
for(const c of [...C])if(c.t==='mesh'&&c.s&&c.grp!==90&&c.grp!==91){
  const [w,h,d]=c.s;
  if(c.outline)continue; // the switch owns the entire missing bridge
  box([c.p[0],c.p[1]-h/2-.8,0],[w,1.6,d],'#bdb39c','Mezzanine slab body');
  box([c.p[0],c.p[1]+h/2-.12,3.23],[w,.2,.12],'#4b9e9b','Mezzanine teal front edge');
  box([c.p[0],c.p[1]+h/2-.43,3.25],[w,.25,.16],'#df9f9f','Mezzanine coral fascia');
}
for(const x of [-7,24,58,88,99]){
  box([x,6,-5.2],[.8,12,.8],'#e5d7b5','Retail gallery pilaster');
  box([x,12.5,-5.2],[2,1,1.6],'#64aaa4','Pilaster capital');
}
box([47,13.3,-5.2],[112,.8,2.2],'#e5d7b5','Open arcade lintel');
for(const x of [5,32,61,91])box([x,12.7,-4.9],[12,.08,.45],'#fff1d4','Arcade ceiling light');
sign('AFTER HOURS',-1,5.5,19);sign('PRIZE COUNTER',14,11.6,22,'#4a9694');
sign('SERVICE BRIDGE',45,5.5,24);sign('LAST TOKENS',73,11.6,22,'#4a9694');
sign('BACK TO MAYFIELD',94,5.5,23);
for(const x of [3,28,60,84]){
  box([x,.6,-3.4],[1.1,1.2,1.1],'#a78b95','Arcade planter');
  box([x,1.5,-3.4],[1.4,.9,1.4],'#6a9976','Planter foliage');
}
for(const c of C)if(c.t==='pit')c.invisible=true;
Object.assign(data,{
  startWarpPad:false,skatepark:false,alwaysSkate:false,keepPlayFog:true,jungleDepthFade:false,
  atmosphere:{fogEnabled:true,fogNear:90,fogFar:230,fogColor:'#c4d6da',drawDistance:300,
    ambientSky:'#fff1dc',ambientGround:'#869296',ambientIntensity:1.5,
    sunColor:'#fff0ce',sunIntensity:1.4,fillColor:'#b9dce2',fillIntensity:.6,shadowStrength:.4,backdrop:'fog'},
});
data.groups!.push({id:90,nm:'After Hours arcade trim',editorOnly:true},{id:91,nm:'Actual Mall galleria backdrop',editorOnly:true});
export const MAYFIELD_BONUS_LEVEL:CustomLevelData=data;
