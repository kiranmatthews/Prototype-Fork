import * as THREE from 'three';
import {BahiaCraft,bahiaBevel} from './beach-bahia-craft';
import {FontLoader} from 'three/examples/jsm/loaders/FontLoader.js';
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json?raw';
import type {CustomComponent} from '../level';

type P=[number,number,number];
export type BahiaBusiness='snack'|'funville'|'pizza';
export const BAHIA_BUSINESS_SLOTS=new Map<number,BahiaBusiness>([[4,'snack'],[19,'funville'],[33,'pizza'],[58,'snack'],[81,'pizza'],[105,'funville'],[129,'snack'],[158,'funville'],[185,'pizza']]);
const font=new FontLoader().parse(JSON.parse(fontJson));
const cream='#ffe0b2',teal='#249eaa',gold='#ffbf35',purple='#a84aaf',plum='#443651';

/** Hand-built editable kit. Transparent panes have real rooms behind them;
 * only the pizza slice and Funville marquee use generated meshes. */
export function bahiaShop(origin:P,yaw:number,grp:number,kind:BahiaBusiness):CustomComponent[]{
 const kit=new BahiaCraft(origin,yaw,grp,`Bahia ${kind}`),out=kit.components;
 const point=(p:P)=>kit.point(p);
 const mesh=kit.mesh.bind(kit),box=kit.box.bind(kit),cylinder=kit.cylinder.bind(kit),polygon=kit.polygon.bind(kit);
 const glass=(x:number,y:number,w:number,h:number,z=4.1)=>{
  mesh('separate transparent glass pane',new THREE.PlaneGeometry(w,h),[x,y,z],'#a3e5df',{tex:'solid',opacity:.12,doubleSided:true,castShadow:false});
  // Broad, faint reflections preserve the view into the fitted room.
  const points:[number,number][]=[[-w*.4,-h*.36],[-w*.28,-h*.36],[w*.12,h*.36],[0,h*.36]];
  const shapes=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
  mesh('subtle glass reflection',new THREE.ShapeGeometry(shapes),[x,y,z+.004],'#efffff',{tex:'solid',opacity:.09,doubleSided:true,castShadow:false});
 };
 const frame=(x:number,y:number,w:number,h:number,color=teal,z=4.16,glazed=true)=>{
  for(const side of [-1,1]){
   box('recessed dark window reveal',[x+side*w/2,y,z-.085],[.25,h+.28,.27],'#175a63',.035);
   box('separate window jamb',[x+side*w/2,y,z],[.19,h+.2,.3],color,.055);
   box('separate window rail',[x,y+side*h/2,z],[w+.22,.19,.3],color,.055);
  }
  box('projecting window sill',[x,y-h/2-.11,z+.07],[w+.38,.19,.5],color,.055);
  if(glazed)glass(x,y,w-.15,h-.15,z-.045);
 };
 const door=(x:number,w=1.65,color=teal)=>{
  frame(x,1.6,w,3.08,color,4.2);
  box('door kick plate',[x,.22,4.3],[w-.1,.3,.1],color,.025);
  box('door central mullion',[x,1.6,4.27],[.075,3.04,.12],color,.02);
  for(const side of [-1,1]){
   kit.beam('door handle bracket',[x+side*.21,1.21,4.3],[x+side*.21,1.21,4.47],.04,cream);
   kit.beam('door handle bracket',[x+side*.21,1.69,4.3],[x+side*.21,1.69,4.47],.04,cream);
   kit.beam('rounded door pull',[x+side*.21,1.21,4.47],[x+side*.21,1.69,4.47],.045,cream);
   for(const y of [.55,2.6])box('door hinge',[x+side*(w/2-.13),y,4.35],[.12,.22,.1],'#bfa784',.025);
  }
 };
 const sign=(dkind:'bahiasnacksign'|'bahiafunvillesign'|'bahiapizzaslice',p:P,s:P)=>out.push({t:'decor',dkind,p:point(p),s,yaw,grp,solid:false,scenerySolid:false,nm:`Bahia ${kind} / separate Tripo sculpted sign`});
 const pendant=(x:number,y:number,z:number)=>{
  cylinder('pendant cord',[x,y+.36,z],.025,.6,plum);
  cylinder('pendant shade',[x,y,z],.24,.21,gold,.09);
  mesh('warm pendant diffuser',new THREE.SphereGeometry(.15,8,5),[x,y-.1,z],cream,{emissive:'#8f5a13'});
 };
 const text=(word:string,y:number,z:number,color:string,size=.58,offsetX=0)=>{
  const widths=Array.from(word,c=>c===' '?.35:(font.data.glyphs[c]?.ha??700)/1000),total=widths.reduce((a,b)=>a+b+.04,0)*size;
  let x=-total/2+offsetX;
  Array.from(word).forEach((c,i)=>{if(c!==' '){const shapes=font.generateShapes(c,size);mesh(`hand-built sign letter ${c}`,new THREE.ExtrudeGeometry(shapes,{depth:.05,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:1,curveSegments:3,steps:1}),[x,y,z],color);}x+=(widths[i]+.04)*size;});
 };
 const stucco=kind==='snack'?gold:kind==='funville'?purple:cream;
 box('foundation skirt fitted below terrace',[0,-.5,0],[10.8,1,8.3],kind==='funville'?'#704383':kind==='snack'?'#d89858':'#bead8c',.065);
 box('interior floor',[0,-.12,0],[10.8,.24,8.3],kind==='funville'?'#426f89':'#ccaa78',.03,{tex:'bay-paving'});
 box('back wall',[0,2.25,-3.85],[10.8,4.6,.32],kind==='snack'?'#278a82':kind==='funville'?'#384b72':'#e4b991',.06,{tex:'bahia-plaster'});
 for(const x of [-5.23,5.23])box('side wall',[x,2.25,0],[.34,4.6,8.2],stucco,.07,{tex:'bahia-plaster'});
 box('roof slab',[0,4.5,0],[10.95,.34,8.4],stucco,.09,{tex:'bahia-plaster'});
 for(const x of [-5.1,5.1])box('front corner pillar',[x,2.2,4.04],[.48,4.4,.5],kind==='funville'?gold:stucco,.08,{tex:'bahia-plaster'});
 box('front lintel',[0,4.05,4.02],[10.4,.55,.45],stucco,.08,{tex:'bahia-plaster'});
 box('separate roof coping',[0,4.64,4.1],[11.15,.32,.83],kind==='snack'?'#ff932e':kind==='funville'?cream:teal,.1);
 if(kind==='snack'){
  box('counter front',[-1.3,.61,4.05],[7.3,1.22,.42],gold,.07,{tex:'bahia-plaster'});
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
  // The generated plaque misspelled SHACK as SNACK. A simple hand-built
  // plaque and actual letters give this storefront its correct name.
  const plaque:[number,number][]=[[-3.79,.75],[-3.55,1.2],[-2.5,1.51],[-.7,1.68],[1.75,1.55],[3.22,1.27],[3.73,.82],[3.63,.36],[2.67,.09],[.3,-.05],[-2.49,.08],[-3.49,.32]];
  polygon('carved sign dark edge',plaque,[-1.25,4.93,4.14],'#b66549',.36,.08);
  polygon('warm carved sign face',plaque.map(([x,y])=>[x*.974,(y-.8)*.86+.8]),[-1.25,4.93,4.52],'#efb783',.07,.035);
  text('SNACK SHACK',5.42,4.64,'#bd322a',.78,-1.25);
  for(const x of [-3.5,1]){box('snack sign metal upright',[x,4.91,4.28],[.22,.56,.22],plum,.035);}
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
  for(const x of [-1.2,1.2])box('pizza front pier',[x,1.95,4.1],[.34,3.9,.4],cream,.07,{tex:'bahia-plaster'});
  for(const x of [-3.15,3.15])box('teal window plinth',[x,.27,4.1],[3.45,.45,.45],teal);
  polygon('stepped cream parapet',[[-5.3,0],[5.3,0],[5.3,.38],[3.4,.38],[3.4,.7],[1.8,.7],[1.8,1.05],[-1.8,1.05],[-1.8,.7],[-3.4,.7],[-3.4,.38],[-5.3,.38]],[0,4.64,3.95],cream,.35);
  box('pizza nameplate',[0,5.81,4.16],[8.15,1.16,.4],teal,.08);box('pizza cream sign face',[0,5.81,4.4],[7.85,.88,.12],cream,.05);
  text('BAHIA PIZZA',5.55,4.48,'#c8422b',.65);
  sign('bahiapizzaslice',[0,6.42,4.17],[4.5,3.1,.58]);
  for(const x of [-3.25,3.25]){
   for(const z of [-1.3,2.6]){
    box('red upholstered booth seat',[x,.5,z],[2.45,.6,.86],'#e3634b',.11);
    box('red upholstered booth back',[x,1.02,z-.37],[2.45,1.26,.29],'#cf513b',.09);
   }
   cylinder('table pedestal',[x,.68,.7],.1,1.2,plum);box('yellow diner tabletop',[x,1.28,.7],[2.3,.12,1.4],gold,.08);
   pendant(x,3.5,.7);
  }
 }
 // Materials, construction seams and fittings are shared; each business keeps
 // its own silhouette and furnishings. Every glass surface remains separate.
 const bolt=(x:number,y:number,z:number)=>kit.ball('brass fixing',[x,y,z],.055,'#ffe8ae');
 const tileFloor=(a:string,b:string)=>{
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[],normals:number[]=[],uvs:number[]=[];
  for(let x=-4.8,i=0;x<5;x+=.8,i++)for(let z=-3.4,j=0;z<4;z+=.8,j++){
   const k=vertices.length/3,c=new THREE.Color((i+j)%2?a:b);
   vertices.push(x,.014,z,x+.79,.014,z,x,.014,z+.79,x+.79,.014,z+.79);
   for(let n=0;n<4;n++){normals.push(0,1,0);colors.push(c.r,c.g,c.b);uvs.push(0,0);}
   indices.push(k,k+2,k+1,k+1,k+2,k+3);
  }
  out.push({t:'mesh',p:point([0,0,0]),yaw,grp,nm:`Bahia ${kind} / fitted interior checker tiles`,vertices,colors,indices,normals,uvs,
   solid:false,tex:'solid',color:'#ffffff'});
 };
 const signMount=(x:number,bottom:number,top:number,z:number)=>{
  box('sign mounting upright',[x,(bottom+top)/2,z],[.18,top-bottom,.22],plum,.035);
  box('sign bolted foot',[x,bottom,z],[.48,.12,.66],plum,.035);
  for(const y of [bottom+.15,top-.12])bolt(x,y,z+.14);
 };
 const sconce=(x:number,y:number,z:number)=>{
  box('lamp backplate',[x,y+.06,z-.2],[.32,.34,.1],plum,.055);
  kit.beam('curved lamp bracket',[x,y+.12,z-.18],[x,y+.12,z+.15],.055,plum);
  cylinder('enamel lamp shade',[x,y,z+.2],.28,.23,plum,.12);
  cylinder('warm lamp lens',[x,y-.13,z+.2],.21,.04,cream,.21,12);
 };
 const vent=(x:number,y:number,z:number,w=1.1,h=.7)=>{
  box('vent housing',[x,y,z],[w,h,.18],plum,.07);
  box('vent dark recess',[x,y,z+.1],[w-.17,h-.15,.03],'#263941',.01);
  for(let dy=-h*.3;dy<h*.35;dy+=.16)box('vent louvre',[x,y+dy,z+.15],[w-.15,.075,.12],'#a3b5af',.02);
  for(const dx of [-1,1])for(const dy of [-1,1])bolt(x+dx*(w/2-.07),y+dy*(h/2-.07),z+.12);
 };
 // Proper stone plinths hide the floor-wall seam and ground the facade.
 for(const side of [-1,1])for(let z=-3.5;z<4;z+=1.45)
  box('side foundation stone',[side*5.28,.12,z],[.49,.36,1.4],kind==='pizza'?teal:kind==='snack'?'#dc9c6f':'#703b91',.075);
 for(const x of [-5.07,5.07])for(let y=.34;y<4.1;y+=.65){
  box('separate corner quoin',[x,y,4.12],[.49,.61,.52],kind==='funville'?'#ffc749':kind==='snack'?'#f5ae43':'#ffe1b6',.07);
 }
 for(const x of [-4.6,4.6])signMount(x,4.62,5.03,3.76);
 if(kind==='snack'){
  tileFloor('#a8c5a5','#d6d9ad');
  // Stepped parapet has individually capped blocks and a darker reveal.
  for(let x=-4.8;x<1.75;x+=1.3)box('orange parapet cap',[x,4.82,.15],[1.28,.28,8.65],'#f4a43b',.08);
  box('counter canopy shadow reveal',[-1.3,4.0,4.27],[7.62,.11,.5],'#a25e32',.025);
  box('projecting counter canopy',[-1.3,4.16,4.54],[7.9,.29,1.25],'#f5b437',.08);
  for(const x of [-3.8,-1.3,1.15])sconce(x,3.81,4.63);
  for(const x of [-3.8,-1.3,1.1]){
   polygon('cut stone counter bracket',[[0,0],[.35,0],[.27,-.4],[.04,-.57],[-.13,-.57]], [x,1.22,4.16],'#d9b58c',.42,.04);
  }
  for(let x=-4.7;x<2.4;x+=.88){
   box('counterfront tongue-and-groove panel',[x,.63,4.29],[.84,.93,.09],'#e6a83f',.025);
   box('countertop individual stone', [x,1.335,4.36],[.88,.12,1.08],'#ffe2b5',.045);
  }
  box('counterfront teal foot rail',[-1.3,.12,4.36],[7.5,.12,.18],teal,.035);
  // Three simple illuminated menu boards sit behind the hatch, above the
  // equipment. Cups and bars are geometry, not opaque pictures of a room.
  for(let i=0;i<3;i++){
   const x=-3.65+i*2.36,col=[teal,'#e56799',gold][i];
   box('suspended menu frame',[x,3.2,3.71],[2.14,.91,.14],'#126575',.055);
   box('menu cream inset',[x,3.2,3.8],[1.97,.74,.055],'#f8dfac',.025);
   cylinder('menu cup symbol',[x-.61,3.17,3.85],.16,.37,col,.21,8);
   kit.beam('menu cup straw',[x-.58,3.38,3.86],[x-.5,3.55,3.86],.027,cream);
   for(let j=0;j<3;j++)box('menu line',[x+.32,3.4-j*.19,3.85],[.75-j*.08,.055,.025],j===0?'#b25b4e':'#587e78',.008);
  }
  // Teal ceramic backsplash and real overhead cabinets.
  for(let x=-4.5,i=0;x<2.4;x+=.67,i++)for(let y=.45,j=0;y<1.8;y+=.34,j++)
   box('ceramic backsplash tile',[x,y,-3.64],[.63,.3,.035],(i+j)%3?'#3b9b8f':'#267d7a',.015);
  for(const x of [-3.8,-1.3,1.1]){
   box('overhead cabinet',[x,3.66,-3.53],[2.3,.82,.35],teal,.06);
   for(const side of [-1,1]){box('recessed cupboard panel',[x+side*.55,3.66,-3.33],[.99,.64,.06],'#168287',.025);bolt(x+side*.12,3.55,-3.24);}
  }
  box('steel slush fascia',[-3.05,1.59,3.99],[1.85,.34,.12],'#acb6b5',.035);
  for(let i=0;i<3;i++){
   const x=-3.64+i*.59;
   box('slush spout',[x,1.83,4.06],[.1,.12,.21],plum,.03);
   kit.ball('slush handle knob',[x,2.05,4.09],.085,plum);
   box('slush drip grate',[x,1.43,4.12],[.46,.06,.3],'#596b70',.01);
   for(let j=0;j<3;j++)box('drip grate slot',[x-.14+j*.14,1.47,4.13],[.04,.006,.21],plum,0);
  }
  for(let i=0;i<5;i++)cylinder('nested paper cup',[-1.35,1.46+i*.09,3.9],.12,.16,cream,.16,10);
  box('napkin dispenser',[-.79,1.52,3.95],[.36,.33,.32],'#9baeb1',.055);
  box('folded napkins',[-.79,1.71,3.96],[.27,.08,.2],'#fff2d5',.015);
  const screen=bahiaBevel([.43,.32,.075],.025);screen.rotateX(-.32);
  mesh('register display',screen,[.2,1.92,3.9],plum);box('register lit digits',[.2,1.93,3.96],[.29,.13,.025],'#7bceb9',.01);
  // Domed counter case: the transparent arch and two metal rails are separate.
  const caseX=1.35,caseZ=3.84;
  box('bakery case base',[caseX,1.46,caseZ],[1.52,.12,.8],plum,.035);
  const arch=new THREE.CylinderGeometry(.47,.47,1.44,12,1,true,0,Math.PI);arch.rotateZ(Math.PI/2);arch.rotateX(Math.PI/2);
  mesh('transparent bakery cover',arch,[caseX,1.48,caseZ],'#bde1da',{tex:'solid',opacity:.13,doubleSided:true,castShadow:false});
  for(const dx of [-.73,.73]){
   const points=[];for(let i=0;i<=10;i++){const a=i/10*Math.PI;points.push(new THREE.Vector3(caseX+dx,1.48+Math.sin(a)*.47,caseZ+Math.cos(a)*.47));}
   mesh('bakery arch frame',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),10,.025,5,false),[0,0,0],'#c8c1a8');
  }
  for(const dx of [-.43,0,.43]){cylinder('muffin paper case',[caseX+dx,1.6,caseZ],.12,.2,cream,.15,8);kit.ball('golden muffin top',[caseX+dx,1.72,caseZ],.165,'#e5a348');}
  for(const x of [2.02,4.98])box('pink tower corner trim',[x,5.82,3.98],[.27,2.3,.32],'#f0819a',.06);
  box('upper window central mullion',[3.45,5.8,4.03],[.11,1.2,.12],teal,.025);
  for(let x=2.02;x<5.1;x+=1.03)box('pink upper coping block',[x,7.1,3.92],[1.01,.32,.65],'#f28ca3',.075);
  // Vent belongs to the solid pier beside the hatch, not in front of a menu.
  vent(-5.04,2.78,4.36,.32,.74);
 }else if(kind==='funville'){
  tileFloor('#497e9a','#bbbc9b');
  // Layered carnival canopy and sloped central brow frame the existing sign.
  for(let i=0;i<7;i++){
   const x=-4.65+i*1.55,h=.23+.14*Math.cos(x*.42);
   box('faceted peach canopy block',[x,4.53+h/2,4.49],[1.53,h,1.24],i%2?'#f7c3a0':'#ffd4ac',.075);
   cylinder('recessed canopy light',[x,4.49,4.68],.13,.045,cream,.13,10);
   bolt(x-.61,4.62,5.13);
  }
  for(const x of [-4.65,4.65]){
   box('purple stepped parapet fin',[x,5.17,3.8],[.62,1.12,.57],'#9141a1',.09);
   cylinder('roof finial pin',[x,5.94,3.8],.11,.5,'#3d8eaf');
   for(const y of [5.72,5.9,6.08])cylinder('finial purple ring',[x,y,3.8],.23,.09,purple);
   kit.ball('finial gold globe',[x,6.24,3.8],.19,gold);
  }
  for(const x of [-2.7,2.7])signMount(x,4.72,5.35,3.89);
  for(const x of [-1.32,1.32]){
   cylinder('column broad base',[x,.13,4.4],.34,.26,'#4b87ab');
   cylinder('column neck capital',[x,3.94,4.4],.31,.2,'#7dcc38');
  }
  // A small sculpted carnival face above the doors is built from simple
  // ellipsoids and inset shapes, with a real curved grin and separate teeth.
  const face=new THREE.SphereGeometry(.54,16,10);face.scale(1.25,.76,.35);
  mesh('purple carnival face relief',face,[0,3.94,4.52],'#a354b6');
  for(const side of [-1,1]){
   const eye=new THREE.SphereGeometry(.16,10,7);eye.scale(.75,1,.3);
   mesh('carnival ivory eye',eye,[side*.26,4.03,4.706],cream);
   const pupil=new THREE.SphereGeometry(.065,8,6);pupil.scale(.7,1,.4);
   mesh('carnival dark pupil',pupil,[side*.24,4.03,4.751],plum);
  }
  kit.ball('carnival red nose',[0,3.89,4.77],.125,'#ef694e');
  polygon('curved carnival grin',[[-.41,.01],[-.3,-.12],[0,-.19],[.3,-.12],[.41,.01],[.27,-.04],[0,-.09],[-.27,-.04]],[0,3.79,4.71],cream,.025,.012);
  for(const x of [-.2,0,.2])box('carnival tooth seam',[x,3.685,4.75],[.018,.08,.012],plum,0);
  for(const x of [-.47,0,.47])kit.ball('carnival crown bell',[x,4.27+(x===0?.16:0),4.54],.08,gold);
  for(const x of [-3.03,3.03]){
   for(let dx=-1.3;dx<1.5;dx+=.91){box('purple plinth panel',[x+dx,.3,4.32],[.86,.43,.15],'#954ba4',.055);bolt(x+dx,.3,4.43);}
   // Lower wave-cut trim leaves the transparent middle of the pane open.
   polygon('teal window wave',[[-1.67,-.1],[1.67,-.1],[1.67,.2],[1.3,.07],[.85,.07],[.5,.35],[.7,.15],[.25,.03],[-.2,.03],[-.55,.22],[-.85,.06],[-1.3,.07],[-1.67,.3]],[x,.64,4.29],'#31c5b4',.07,.018);
  }
  box('entry first step',[0,.045,4.73],[2.94,.15,1.17],'#4f90b1',.07);
  box('entry landing nosing',[0,.145,4.37],[2.68,.14,.56],'#71abc2',.06);
  // Cabinet silhouettes gain a hood, angled control deck and individual inputs.
  for(let i=0;i<5;i++){
   const x=-3.8+i*1.85,col=[teal,'#ed5f83',gold,purple,'#8bcf32'][i];
   box('arcade screen dark bezel',[x,1.83,.255],[1.02,.82,.08],'#253a54',.04);
   box('arcade luminous display',[x,1.85,.305],[.82,.61,.025],'#4dc7c8',.01,{emissive:'#1d576d'});
   box('arcade overhanging marquee',[x,2.43,.31],[1.29,.28,.91],col,.055);
   box('arcade marquee light',[x,2.43,.78],[1.08,.14,.04],cream,.025,{emissive:'#55451b'});
   for(const dx of [-.36,0,.36])kit.ball('arcade button',[x+dx,1.39,.88],.055,[gold,'#f27270',teal][Math.round((dx+.36)/.36)]);
   kit.ball('arcade joystick ball',[x-.24,1.6,.74],.09,'#ef6c52');
   box('arcade coin slot plate',[x,.85,1.0],[.31,.42,.04],'#47536c',.02);
   box('arcade coin slot',[x,.91,1.035],[.16,.035,.02],'#1a2838',.003);
   for(let j=0;j<4;j++)box('arcade pixel obstacle',[x-.28+j*.18,1.64+(j%2)*.07,.33],[.1,.065,.01],gold,0);
  }
  // A compact transparent capsule machine is a readable foreground object.
  cylinder('capsule machine pedestal',[-4.1,.58,3.1],.29,1.14,purple,.25);
  cylinder('capsule globe collar',[-4.1,1.13,3.1],.37,.14,teal);
  mesh('transparent capsule globe',new THREE.SphereGeometry(.46,14,9),[-4.1,1.59,3.1],'#b5e4dc',{tex:'solid',opacity:.14,castShadow:false});
  for(let i=0;i<13;i++){const a=i*2.4,r=.22+(i%3)*.03;kit.ball('coloured capsule',[-4.1+Math.sin(a)*r,1.35+(i%3)*.12,3.1+Math.cos(a)*r],.095,[teal,gold,'#f57798'][i%3]);}
  box('capsule coin handle',[-4.1,.84,3.43],[.21,.12,.13],cream,.03);
  for(const x of [-3.1,3.1]){
   box('interior prize shelf',[x,2.98,-3.51],[2.75,.12,.42],teal,.035);
   for(let j=0;j<4;j++)cylinder('prize jar',[x-1+j*.66,3.22,-3.45],.18,.38,[gold,teal,purple][j%3],.13,8);
  }
 }else{
  tileFloor('#e9dcb0','#3f9994');
  // Sewn canvas follows a bent profile; each stripe has a closed underside and
  // rounded lower valance. The old flat alternating boxes are gone.
  const profile:[number,number][]=[[3.98,4.16],[4.24,4.13],[4.65,3.99],[5.1,3.75],[5.56,3.4],[5.57,3.28],[5.07,3.63],[4.6,3.88],[4.21,4.02],[3.98,4.05]];
  for(let i=0;i<14;i++){
   const x=-5.37+i*.78,col=i%2?gold:teal,shape=new THREE.Shape(profile.map(([z,y])=>new THREE.Vector2(z,y)));
   const g=new THREE.ExtrudeGeometry(shape,{depth:.78,bevelEnabled:false,curveSegments:1,steps:1});g.rotateY(-Math.PI/2);
   mesh('closed curved canvas stripe',g,[x+.78,0,0],col);
   polygon('scalloped canvas valance',[[-.39,.05],[.39,.05],[.39,-.12],[.27,-.23],[0,-.26],[-.27,-.23],[-.39,-.12]], [x+.39,3.36,5.55],col,.09,.02);
   kit.beam('canvas seam',[x+.78,4.16,3.98],[x+.78,3.4,5.56],.008,'#c1ba8d');
  }
  for(const x of [-4.78,4.78]){
   kit.beam('awning diagonal brace',[x,2.82,4.13],[x,3.52,5.16],.075,teal);
   bolt(x,2.85,4.24);
  }
  // Art Deco fan and inset turquoise diamonds articulate the stepped roofline.
  for(let i=0;i<13;i++)polygon('glazed diamond frieze',[[-.35,0],[0,.2],[.35,0],[0,-.2]],[i*.76-4.56,4.39,4.33],i%2?'#278b8c':'#45b2aa',.055,.012);
  for(let i=0;i<5;i++){
   const a=Math.PI*.12+i*Math.PI*.152,b=a+Math.PI*.14;
   polygon('sunburst parapet tile',[[0,0],[Math.cos(a)*1.02,Math.sin(a)*.49],[Math.cos(b)*1.02,Math.sin(b)*.49]], [0,4.7,4.34],i===2?gold:teal,.07,.012);
  }
  for(const x of [-3.47,3.47])signMount(x,4.63,5.42,4.03);
  for(const x of [-3.7,3.7]){bolt(x,5.48,4.49);bolt(x,6.15,4.49);}
  for(const x of [-3.15,3.15]){
   sconce(x,3.12,4.42);
   for(const dx of [-1.16,1.16])box('window slender mullion',[x+dx,1.91,4.23],[.075,2.66,.12],teal,.02);
   for(const z of [-1.3,2.6])for(let j=0;j<6;j++)box('upholstered booth fluting',[x-1.03+j*.41,1.07,z-.2],[.37,1.02,.1],j%2?'#df6951':'#d45a47',.045);
   cylinder('table salt pot',[x-.43,1.48,.7],.075,.25,cream,.07,8);
   cylinder('table pepper pot',[x-.2,1.48,.7],.075,.25,'#8e6350',.07,8);
   box('table napkin holder',[x+.34,1.45,.7],[.25,.3,.19],'#c7c4ae',.04);
  }
  // A real arched pizza oven and back counter can be seen through both windows.
  box('rear pizza prep counter',[0,.7,-2.83],[8.6,1.3,.9],'#d4a781',.055);
  box('prep countertop',[0,1.39,-2.76],[8.75,.16,1.05],cream,.045);
  box('pizza oven base',[-2.6,1.82,-2.77],[2.46,.72,.85],'#bb7053',.08);
  const archPts:[number,number][]=[[-.79,0],[.79,0]];
  for(let i=0;i<=12;i++){const a=i/12*Math.PI;archPts.push([Math.cos(a)*.79,.46+Math.sin(a)*.58]);}
  polygon('dark oven opening',archPts,[-2.6,1.53,-2.25],'#3e353c',.025,.01);
  for(let i=0;i<9;i++){
   const a=Math.PI*(i+.5)/9,g=bahiaBevel([.31,.3,.25],.035);g.rotateZ(a-Math.PI/2);
   mesh('individual oven arch brick',g,[-2.6+Math.cos(a)*.95,2.02+Math.sin(a)*.69,-2.12],i%2?'#d68559':'#e39b68');
  }
  for(const x of [-3.56,-1.64])box('oven arch side brick',[x,1.8,-2.12],[.3,.61,.26],'#d5875e',.035);
  for(let i=0;i<3;i++)box('stacked pizza box',[2.6,1.52+i*.13,-2.6],[1.05,.12,.93],i%2?'#f0d3a6':'#e6bf8c',.025);
  cylinder('pizza serving board',[.55,1.5,-2.55],.5,.07,'#a66e45',.5,16);
  cylinder('small pizza on prep counter',[.55,1.56,-2.55],.43,.06,'#f6bd55',.43,16);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder('small pizza topping',[.55+Math.sin(a)*.27,1.598,-2.55+Math.cos(a)*.27],.067,.014,'#b64a37',.067,8);}
  vent(-4.2,4.9,2.5,1.35,.67);
  box('roof extract base',[-3.65,4.82,.9],[1.52,.55,1.35],'#776b80',.07);
  cylinder('roof extract chimney',[-3.65,5.32,.9],.31,.55,'#9b929a',.31);
  cylinder('roof chimney rain cap',[-3.65,5.63,.9],.48,.1,'#b4a4a4',.32);
 }
 return out;
}
