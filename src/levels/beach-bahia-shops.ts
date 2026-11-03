import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {FontLoader} from 'three/examples/jsm/loaders/FontLoader.js';
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json?raw';
import type {CustomComponent} from '../level';

type P=[number,number,number];
export type BahiaBusiness='snack'|'funville'|'pizza';
export const BAHIA_BUSINESS_SLOTS=new Map<number,BahiaBusiness>([[4,'snack'],[19,'funville'],[33,'pizza'],[58,'snack'],[81,'pizza'],[105,'funville'],[129,'snack'],[158,'funville'],[185,'pizza']]);
const round=(v:number)=>Math.round(v*100000)/100000;
const font=new FontLoader().parse(JSON.parse(fontJson));
const cream='#ffe1a1',teal='#149eaa',gold='#ffbc24',purple='#993ba1',plum='#48334d';

/** Hand-built editable kit. Transparent panes have real rooms behind them;
 * the only generated meshes are the three separately authored sculpted signs. */
export function bahiaShop(origin:P,yaw:number,grp:number,kind:BahiaBusiness):CustomComponent[]{
 const out:CustomComponent[]=[],r=yaw*Math.PI/180,co=Math.cos(r),si=Math.sin(r);
 const point=([x,y,z]:P):P=>[round(origin[0]+x*co+z*si),round(origin[1]+y),round(origin[2]-x*si+z*co)];
 const mesh=(name:string,g:THREE.BufferGeometry,p:P,color:string,extra:Partial<CustomComponent>={})=>{
  if(!g.index){const old=g;g=mergeVertices(g,.00001);old.dispose();}
  out.push({t:'mesh',p:point(p),yaw,grp,nm:`Bahia ${kind} / ${name}`,solid:false,tex:'solid',color,
   vertices:Array.from(g.attributes.position.array,round),normals:Array.from(g.attributes.normal.array,round),
   ...(g.attributes.uv?{uvs:Array.from(g.attributes.uv.array,round)}:{}),indices:Array.from(g.index!.array),...extra});g.dispose();
 };
 const box=(name:string,p:P,s:P,color:string,bevel=.045,extra:Partial<CustomComponent>={})=>
  mesh(name,bevel?new RoundedBoxGeometry(...s,1,Math.min(bevel,...s.map(v=>v/4))):new THREE.BoxGeometry(...s),p,color,extra);
 const cylinder=(name:string,p:P,rad:number,h:number,color:string,top=rad)=>mesh(name,new THREE.CylinderGeometry(top,rad,h,12),p,color);
 const polygon=(name:string,pts:[number,number][],p:P,color:string,depth=.12)=>{
  const shape=new THREE.Shape(pts.map(v=>new THREE.Vector2(...v)));
  mesh(name,new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1,steps:1}),p,color);
 };
 const glass=(x:number,y:number,w:number,h:number,z=4.1)=>{
  mesh('separate transparent glass pane',new THREE.PlaneGeometry(w,h),[x,y,z],'#75dae1',{opacity:.19,doubleSided:true,castShadow:false});
  // Narrow highlights leave almost all the pane transparent.
  polygon('glass glint',[[-.045,-h*.28],[.015,-h*.28],[.36,h*.28],[.29,h*.28]],[x-w*.22,y,z+.012],'#d3ffff',.002);
 };
 const frame=(x:number,y:number,w:number,h:number,color=teal,z=4.16,glazed=true)=>{
  for(const side of [-1,1])box('separate window jamb',[x+side*w/2,y,z],[.16,h+.2,.24],color);
  for(const side of [-1,1])box('separate window rail',[x,y+side*h/2,z],[w+.2,.16,.24],color);
  if(glazed)glass(x,y,w-.12,h-.12,z-.035);
 };
 const door=(x:number,w=1.65,color=teal)=>{
  frame(x,1.6,w,3.08,color,4.2);
  box('door glass middle rail',[x,1.05,4.3],[w,.1,.12],color);
  for(const side of [-1,1])box('door handle',[x+side*.15,1.45,4.39],[.065,.48,.09],cream,.03);
 };
 const sign=(dkind:'bahiasnacksign'|'bahiafunvillesign'|'bahiapizzaslice',p:P,s:P)=>out.push({t:'decor',dkind,p:point(p),s,yaw,grp,solid:false,scenerySolid:false,nm:`Bahia ${kind} / separate Tripo sculpted sign`});
 const pendant=(x:number,y:number,z:number)=>{
  cylinder('pendant cord',[x,y+.36,z],.025,.6,plum);
  cylinder('pendant shade',[x,y,z],.24,.21,gold,.09);
  mesh('warm pendant diffuser',new THREE.SphereGeometry(.15,10,6),[x,y-.1,z],cream,{emissive:'#8f5a13'});
 };
 const text=(word:string,y:number,z:number,color:string,size=.58)=>{
  const widths=Array.from(word,c=>c===' '?.35:(font.data.glyphs[c]?.ha??700)/1000),total=widths.reduce((a,b)=>a+b+.04,0)*size;
  let x=-total/2;
  Array.from(word).forEach((c,i)=>{if(c!==' '){const shapes=font.generateShapes(c,size);mesh(`hand-built sign letter ${c}`,new THREE.ExtrudeGeometry(shapes,{depth:.05,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:1,curveSegments:3,steps:1}),[x,y,z],color);}x+=(widths[i]+.04)*size;});
 };
 const stucco=kind==='snack'?gold:kind==='funville'?purple:cream;
 box('interior floor',[0,-.12,0],[10.8,.24,8.3],kind==='funville'?'#426f89':'#ccaa78',.03,{tex:'bay-paving'});
 box('back wall',[0,2.25,-3.85],[10.8,4.6,.32],kind==='snack'?'#278a82':kind==='funville'?'#384b72':'#ecbb79',.06,{tex:'bay-stucco'});
 for(const x of [-5.23,5.23])box('side wall',[x,2.25,0],[.34,4.6,8.2],stucco,.07,{tex:'bay-stucco'});
 box('roof slab',[0,4.5,0],[10.95,.34,8.4],stucco,.09,{tex:'bay-stucco'});
 for(const x of [-5.1,5.1])box('front corner pillar',[x,2.2,4.04],[.48,4.4,.5],kind==='funville'?gold:stucco,.08,{tex:'bay-stucco'});
 box('front lintel',[0,4.05,4.02],[10.4,.55,.45],stucco,.08,{tex:'bay-stucco'});
 box('separate roof coping',[0,4.64,4.1],[11.15,.3,.64],kind==='snack'?'#ff932e':kind==='funville'?cream:teal,.1);
 if(kind==='snack'){
  box('counter front',[-1.3,.61,4.05],[7.3,1.22,.42],gold,.07,{tex:'bay-stucco'});
  box('stone serving counter',[-1.3,1.3,4.32],[7.6,.2,1.05],cream,.07);
  frame(-1.3,2.62,7.3,2.36,teal,4.16,false);
  for(const x of [-4.82,2.4])box('hatch jamb',[x,2.55,4.18],[.2,2.6,.32],teal);
  for(const x of [2.59,4.94])box('pink door wall jamb',[x,1.65,4],[.35,3.3,.3],'#ee579a');
  box('pink door wall header',[3.76,3.86,4],[2.7,1.15,.3],'#ee579a');door(3.76,1.95);
  box('pink upper-room back wall',[3.45,5.8,-2.9],[3.5,2.35,.3],'#d94389');
  for(const x of [1.86,5.08])box('pink upper-room side wall',[x,5.8,.45],[.3,2.35,7],'#ee579a');
  for(const y of [4.95,6.65])box('pink upper-room window wall',[3.45,y,3.8],[3.5,.65,.3],'#ee579a');
  frame(3.45,5.8,2.8,1.25,gold,3.98);
  box('pink upper-room roof',[3.45,7.02,.45],[3.65,.26,7.25],'#ee7185');
  sign('bahiasnacksign',[-1.25,4.65,4.17],[7.5,2.35,.62]);
  for(const x of [-3.8,-1.3,1.1])pendant(x,3.65,3.55);
  for(const y of [1.35,2.2,3.05]){
   box('interior stocked shelf',[-.9,y,-2.9],[7.5,.12,.8],cream);
   for(let i=0;i<8;i++)cylinder('drink cup on shelf',[-4.1+i*.85,y+.22,-2.8],.14,.3,[teal,'#ef687f',gold][i%3],.18);
  }
  box('slush machine base',[-3.05,1.54,3.65],[1.8,.35,.62],plum);
  for(let i=0;i<3;i++){
   const x=-3.64+i*.59;
   box('slush drink inside transparent tank',[x,2.04,3.65],[.42,.62,.41],[teal,'#fa448d',gold][i],.07);
   mesh('separate transparent slush tank',new THREE.BoxGeometry(.51,.9,.52),[x,2.12,3.65],'#c4eeed',{opacity:.16,doubleSided:true,castShadow:false});
   box('slush tank lid',[x,2.6,3.65],[.57,.15,.59],plum);
   box('slush pull lever',[x,1.9,4.02],[.09,.29,.1],plum);
  }
  box('counter register',[.2,1.6,3.8],[.65,.42,.55],plum);
 }else if(kind==='funville'){
  sign('bahiafunvillesign',[0,4.65,4.16],[9.2,3.1,.75]);
  frame(-3.03,2.1,3.55,3.25,teal);frame(3.03,2.1,3.55,3.25,teal);door(0,2.05,'#b0ce22');
  for(const x of [-1.32,1.32]){
   cylinder('blue entry column',[x,1.92,4.4],.2,3.84,'#408dbe');
   for(const y of [3.0,3.3,3.6,3.9])cylinder('lime column ring',[x,y,4.4],.32,.13,'#a6e31d');
  }
  for(const x of [-3.03,3.03]){
   polygon('window lightning bolt',[[-1.45,.38],[.15,.55],[-.35,.18],[1.45,.1],[-.1,-.45],[.1,-.05]], [x,2.15,4.28],'#fc7446',.055);
   box('purple window plinth',[x,.29,4.12],[3.7,.48,.44],purple);
  }
  for(let i=0;i<5;i++){
   const x=-3.8+i*1.85,col=[teal,'#ed5f83',gold,purple,'#8bcf32'][i];
   box('arcade cabinet base',[x,.75,.45],[1.22,1.5,1.05],col);
   box('arcade cabinet upright',[x,1.83,.04],[1.22,1.08,.35],col);
   box('arcade glowing screen',[x,1.83,.235],[.89,.66,.025],'#45bac3',.01,{emissive:'#175e74'});
   box('arcade control shelf',[x,1.3,.66],[1.22,.12,.65],plum);
   cylinder('arcade joystick',[x-.24,1.47,.74],.04,.22,gold);
   mesh('arcade game star',new THREE.IcosahedronGeometry(.18,0),[x,1.86,.29],gold,{emissive:'#936d16'});
  }
  for(const x of [-3,0,3])pendant(x,3.75,1.8);
 }else{
  frame(-3.15,1.91,3.3,2.75);frame(3.15,1.91,3.3,2.75);door(0,1.8);
  for(const x of [-1.2,1.2])box('pizza front pier',[x,1.95,4.1],[.34,3.9,.4],cream,.07,{tex:'bay-stucco'});
  for(const x of [-3.15,3.15])box('teal window plinth',[x,.27,4.1],[3.45,.45,.45],teal);
  polygon('stepped cream parapet',[[-5.3,0],[5.3,0],[5.3,.38],[3.4,.38],[3.4,.7],[1.8,.7],[1.8,1.05],[-1.8,1.05],[-1.8,.7],[-3.4,.7],[-3.4,.38],[-5.3,.38]],[0,4.64,3.95],cream,.35);
  for(let i=0;i<14;i++){
   const x=-5.06+i*.78,g=new THREE.BoxGeometry(.78,.16,1.55);g.rotateX(.3);
   mesh('separate striped awning panel',g,[x,3.8,4.64],i%2?gold:teal);
   box('awning scallop',[x,3.49,5.37],[.78,.25,.18],i%2?gold:teal,.07);
  }
  box('pizza nameplate',[0,5.63,4.06],[7.8,1.1,.32],teal,.08);box('pizza cream sign face',[0,5.63,4.25],[7.5,.87,.12],cream,.05);
  text('BAHIA PIZZA',5.37,4.34,'#c8422b',.65);
  sign('bahiapizzaslice',[0,6.22,4.04],[4.5,3.1,.58]);
  for(const x of [-3.25,3.25]){
   for(const z of [-1.3,2.6]){
    box('red upholstered booth seat',[x,.5,z],[2.45,.6,.86],'#e3634b',.11);
    box('red upholstered booth back',[x,.95,z-.37],[2.45,1.1,.25],'#cf513b',.09);
   }
   cylinder('table pedestal',[x,.68,.7],.1,1.2,plum);box('yellow diner tabletop',[x,1.28,.7],[2.3,.12,1.4],gold,.08);
   pendant(x,3.5,.7);
  }
 }
 return out;
}
