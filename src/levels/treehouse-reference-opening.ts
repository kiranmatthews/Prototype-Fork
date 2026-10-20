import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {CustomComponent} from '../level';
import {openingHousePoint,TREEHOUSE_CLEARING_ROUTE} from './treehouse-opening';
import {treehouseTrialPoint} from './treehouse-trials-continuity';

type P=[number,number,number];
const round=(n:number)=>+n.toFixed(5);
const shoreZ=(x:number)=>16+x*.07+Math.sin(x*.1)*1.4;

/** Reference composition, applied after the long-course transform. The beach,
 * cabin and halfpipe share the native course's collision and asset pipeline. */
export function referenceTreehouseOpening(source:CustomComponent[]):CustomComponent[]{
  const C:CustomComponent[]=[];
  const batches=new Map<string,{geometries:THREE.BufferGeometry[],tex:string,color:string,name:string,grp:number,extra:Partial<CustomComponent>}>();
  const geometry=(g:THREE.BufferGeometry,name:string,tex='treehouse-timber',color='#b3946c',grp=8,extra:Partial<CustomComponent>={})=>{
    if(!g.index){const n=g.attributes.position.count;g.setIndex(Array.from({length:n},(_,i)=>i));}
    if(!g.attributes.normal)g.computeVertexNormals();
    const key=[name,tex,color,grp,JSON.stringify(extra)].join('|');
    if(!batches.has(key))batches.set(key,{geometries:[],tex,color,name,grp,extra});
    batches.get(key)!.geometries.push(g);
  };
  const box=(p:P,s:P,name:string,color='#b3946c',tex='treehouse-timber',grp=8,transform?:(g:THREE.BufferGeometry)=>void)=>{
    const g=new THREE.BoxGeometry(...s).translate(...p);
    if(tex==='treehouse-timber'){
      const uv=g.attributes.uv,offset=(Math.abs(Math.floor(p[0]*3+p[2]*7))%6)/6;
      for(let i=0;i<uv.count;i++)uv.setXY(i,offset+.014+uv.getX(i)*.137,uv.getY(i)*Math.max(.45,s[1]/4));
    }
    if(transform)transform(g);geometry(g,name,tex,color,grp);
  };
  const rod=(a:P,b:P,radius:number,name:string,color='#a08051',grp=8)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.sub(start);
    const g=new THREE.CylinderGeometry(radius*.88,radius,delta.length(),7,1).translate(0,delta.length()/2,0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())).translate(...a);
    geometry(g,name,'treehouse-timber',color,grp);
  };
  const rope=(points:P[],name:string,radius=.055,color='#aa8b59',grp=8)=>{
    geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,radius,5,false),name,'solid',color,grp);
  };
  const decor=(dkind:NonNullable<CustomComponent['dkind']>,p:P,s:P,yaw:number,name:string,color?:string,amp?:number)=>
    C.push({t:'decor',dkind,p,s,yaw,nm:'Reference opening · '+name,grp:10,color,amp});
  const house=(g:THREE.BufferGeometry)=>g.translate(17,0,6).rotateY(-Math.PI/18).translate(-17,0,-6);
  const hp=(p:P)=>openingHousePoint(p);
  const route=new THREE.CatmullRomCurve3(TREEHOUSE_CLEARING_ROUTE.map(p=>new THREE.Vector3(...p))).getPoints(96);
  const pathDistance=(x:number,z:number)=>Math.min(...route.map(p=>Math.hypot(p.x-x,p.z-z)));
  for(let c of source){
    if(c.dkind==='treehousebody'||c.nm==='Warm recessed doorway')continue;
    if(c.nm?.startsWith('Diagonal structural bracing beneath treehouse'))continue;
    if((c.nm==='Cabin and balcony grounded support post'||c.nm==='Stone footing beneath a timber support')&&c.p[2]>-3)continue;
    if(c.nm==='Framing jungle tree'&&c.p[0]<0)c={...c,dkind:'trialsv2treea',color:'#b4c8b8'};
    if(c.nm==='Framing jungle tree'&&c.p[0]>0)continue;
    if(c.nm==='Planted understory clump'&&c.p[0]>-10)continue;
    if(c.nm==='Layered rear undergrowth'&&c.p[0]>7)continue;
    if(c.t==='decor'&&/bush|fern|groundcover|thicket/.test(c.dkind??'')&&c.p[2]>-25&&c.p[2]<16&&pathDistance(c.p[0],c.p[2])<3.8)continue;
    if(c.nm==='Separate canopy above the treehouse roof')c={...c,p:[-20,20.8,-15],s:[31,8,22],color:'#879e8b'};
    if(c.t==='clock')c={...c,p:treehouseTrialPoint([35,0,-22])};
    if(c.nm==='Treehouse fitted course-edge safety perimeter')c={...c,pts:c.pts!.map(p=>p[1]>10?[p[0],shoreZ(p[0])+5.8,...p.slice(2)] as typeof p:p)};
    if(c.nm?.startsWith('Continuous painted opening ground')||c.nm?.includes('continuous curved sandy shore')||c.nm?.includes('western sandy shelf')){
      const colors:number[]=[],uvs:number[]=[];
      if(c.nm?.includes('continuous curved sandy shore')){
        const vertices=c.vertices!.slice();
        for(let i=0;i<vertices.length;i+=3){const offshore=vertices[i+2]-shoreZ(vertices[i]);vertices[i+1]-=Math.max(0,offshore-4.4)*.23;}
        c={...c,vertices};
      }
      for(let i=0;i<c.vertices!.length;i+=3){
        const x=c.vertices![i]+c.p[0],z=c.vertices![i+2]+c.p[2],distance=pathDistance(x,z);
        const pipeDistance=Math.hypot((x-14)*.78,(z+.8)*.85)-3.8;
        const houseDistance=Math.hypot((x+12)*.85,(z-3)*.8)-4;
        const bank=Math.min(distance,pipeDistance,houseDistance);
        const green=THREE.MathUtils.smoothstep(bank,3.3,6.8)*(1-THREE.MathUtils.smoothstep(z,12,shoreZ(x)+1));
        const color=new THREE.Color('#eee2c5').lerp(new THREE.Color('#546842'),green);
        const forest=new THREE.Color('#e8dcc4').lerp(new THREE.Color('#547348'),THREE.MathUtils.smoothstep(Math.abs(x-35),3.45,6.25));
        color.lerp(forest,1-THREE.MathUtils.smoothstep(z,-16,4));
        color.multiplyScalar(.985+.025*Math.sin(x*.7+z*.13));colors.push(...color.toArray().map(round));uvs.push(x/6.5,z/6.5);
      }
      c={...c,tex:'treehouse-beach',color:'#ffffff',materialStyle:undefined,colors,uvs,normals:undefined};
    }
    C.push(c);
  }

  // Individual uneven boards preserve the reference's rectangular cabin silhouette.
  const shades=['#e6d8bc','#f0e1c7','#d1c3a9','#ddcfb4','#dfc9a7'];
  for(const z of [-10.1,-2.1])for(let i=0;i<24;i++){
    const x=-22.75+i*.49,front=z>-3,door=front&&x>-20.9&&x<-18.5;
    const height=door?1.15:4.9,base=door?12.25:8.4;
    box([x,base+height/2,z],[.474,height,.22],'Reference cabin · irregular vertical plank shell',shades[i%5],'treehouse-timber',8,house);
  }
  for(const x of [-22.95,-11.05])for(let i=0;i<16;i++)box([x,10.85,-9.85+i*.5],[.22,4.9,.486],
    'Reference cabin · irregular vertical plank shell',shades[(i+2)%5],'treehouse-timber',8,house);
  for(const x of [-23,-11])for(const z of [-10.2,-2])box([x,10.9,z],[.42,5.25,.43],'Reference cabin · thick corner framing','#765231','treehouse-timber',8,house);
  for(const y of [8.7,12.9])for(const z of [-10.32,-1.94])box([-17,y,z],[12.4,.25,.26],'Reference cabin · horizontal battens','#825f3c','treehouse-timber',8,house);
  for(const x of [-20.96,-18.47])box([x,10.45,-1.83],[.21,4.1,.35],'Reference cabin · doorway jambs','#79522e','treehouse-timber',8,house);
  box([-19.72,10.3,-2.45],[2.32,3.85,.08],'Reference cabin · dark door recess','#39291c','solid',8,house);
  const doorGlow=new THREE.PlaneGeometry(1.35,2.9).translate(-19.8,10.0,-2.38);house(doorGlow);
  geometry(doorGlow,'Reference cabin · warm inner doorway','solid','#c48d47',8,{emissive:'#492006'});
  // The canvas ridge runs across the cabin, exposing the broad sloping sail
  // to the beach view. All four corners remain tied to the balcony posts.
  for(const x of [-23,-11]){
    rod(hp([x,12.8,-6.1]),hp([x,16.0,-6.1]),.14,'Reference roof · ridge supports');
    rod(hp([x,13.1,-11.45]),hp([x,16,-6.1]),.1,'Reference roof · sloping rafters');
    rod(hp([x,16,-6.1]),hp([x,13.1,-.75]),.1,'Reference roof · sloping rafters');
  }
  rod(hp([-24.7,16.05,-6.1]),hp([-9.3,16.05,-6.1]),.16,'Reference roof · exposed ridge pole','#b59b72');
  const roofPoint=(u:number,v:number):P=>{
    const x=-17+v*7.15,z=-6.1+u*5.35;
    const sag=.48*Math.sin(Math.PI*Math.abs(u))+.3*Math.sin(Math.PI*(v+1)/2)*Math.abs(u);
    return [x,16.06-Math.abs(u)*2.7-sag+.095*Math.sin(u*20+v*.8)*Math.abs(u),z];
  };
  const rv:number[]=[],ru:number[]=[],ri:number[]=[];const cols=48,rows=30;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    rv.push(...roofPoint(col/cols*2-1,row/rows*2-1));ru.push(col/cols,row/rows);
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col,b=a+1,c=a+cols+1,d=c+1;ri.push(a,b,c,b,d,c);}
  const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute(rv,3));roof.setAttribute('uv',new THREE.Float32BufferAttribute(ru,2));roof.setIndex(ri);roof.computeVertexNormals();house(roof);
  geometry(roof,'Reference roof · continuous sagging striped sail','treehouse-canvas','#fff0d2',8,{doubleSided:true});
  for(const v of [-1,1])rope(Array.from({length:33},(_,i)=>hp(roofPoint(i/16-1,v))),'Reference roof · stitched bound canvas hem',.041,'#b39a6b');
  for(const u of [-1,1])for(const v of [-1,1]){
    const end=hp([v<0?-24.1:-9.8,12.75,u<0?-11.3:-.5]);
    rod([end[0],8.22,end[2]],end,.10,'Reference roof · corner tie post');
    rope([hp(roofPoint(u,v)),end],'Reference roof · taut corner lashing',.044);
  }

  // Leafy banks hide the large support floor and define the narrow S-shaped sand path.
  for(const [x,z,w,h,d,yaw] of [[7,-18,10.5,11,7,-18],[2,-12.5,6.5,4.6,5.8,25],[11,-12.5,5,3.2,4,-20]] as number[][])
    decor(h>8?'trialsv2cavewallb':'treehousemossrock',[x,-.3,z],[w,h,d],yaw,'mossy pale rock beyond the halfpipe','#c2c2a7');
  const planting:number[][]=[[-21,8,6,3,5,14],[-13,5,5,2.4,4,56],[-9,1,5,2.4,4,-12],[-7,-10,5,2.8,4,20],
    [2,2,4,2,3,-35],[1,-12,5,3.5,4,41],[7,-12,5,3.4,4,-26],[12,-15,4,2.5,3,65],
    [16,8,7,4.8,6,10],[19,-1,7,4.8,5,75],[22,-6,7,4.6,5,-18],[26,-13,7,4.7,5,22],
    [-13,15,7,3.3,5,31],[-5,14,5,2.2,4,-31],[10,13,4.5,2.9,4,61],[12,19,6,2.6,4,41]];
  for(const [i,[x,z,w,h,d,yaw]] of planting.entries()){
    // Both transitions and the open-ended approach need their full clear width.
    if(pathDistance(x,z)<3.4||Math.abs(x-14)<6.65+w*.4&&Math.abs(z+.8)<2.9+d*.4)continue;
    decor(i%3?'trialsv3thicket':'treehousebush',[x,-.18,z],[w,h,d],yaw,'layered rooted path-edge foliage');
    decor(i%2?'trialsv2ferna':'trialsv2fernb',[x-.8,-.12,z+1.7],[w*.55,h*.65,d*.62],yaw+51,'fern overlapping the sandy bank');
  }
  decor('treehousehost',[23,-.45,10],[22,26,16],-38,'foreground right trunk and sweeping boughs','#a8af80');
  decor('trialsv3bough',[12,12.9,6],[27,9.9,13],170,'overhead left-reaching canopy and hanging leaves');
  decor('trialsv3bough',[-3,19.5,-9],[24,8.1,12],30,'layered middle canopy leaving the roof visible');
  decor('trialsv2crownb',[23,12.3,-15],[29,10.5,20],-14,'deep right canopy behind the framing trunk','#b5c9bc');
  decor('junglevine',[13,14,7],[12,6.6,1.1],-8,'long loop suspended from the overhead bough');
  decor('junglevine',[4,14.4,-4],[3.6,8,1],14,'slender hanging vine behind the pipe');
  // Shore rocks are embedded in the shared wet sand, with timber washed against them.
  for(const [x,z,w,h,d,yaw] of [[-9,19.6,5.8,2.7,4,17],[-14,18,6.4,3.8,4,-31],[-5.5,20.8,3,1.6,2.4,65],
    [13,23,7.4,3,5,17],[10.4,20.8,4.6,2.5,3.4,-25],[14,17,5,3.5,4,60]] as number[][])
    decor('treehousemossrock',[x,-.75,z],[w,h,d],yaw,'pale beach boulder with a buried foot','#c5c4af');
  for(const [i,p] of [[-8.4,.15,21],[-6.7,-.25,20.8],[10,.1,21],[13,.8,20.3]].entries()){
    const g=new THREE.BoxGeometry(.42,2.7,.3).rotateZ((i%2?-.45:.4)).translate(...p as P);
    geometry(g,'Reference shoreline · leaning broken driftwood','treehouse-timber','#b7a17d',10);
  }
  // Pointed wooden board: a convex face and tapered thickness, visible at oblique angles.
  const sv:number[]=[],su:number[]=[],si:number[]=[];const rings=24,sides=12;
  for(let j=0;j<=rings;j++){
    const t=j/rings,y=t*4.8,half=.88*Math.pow(Math.sin(Math.PI*(.055+t*.945)),.72)*(1-.32*t);
    for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2;sv.push(Math.cos(a)*half,y,Math.sin(a)*.14*Math.sin(Math.PI*(.04+t*.92)));su.push(.17+k/sides*.14,t);}
  }
  for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){const a=j*(sides+1)+k,b=a+sides+1;si.push(a,a+1,b,a+1,b+1,b);}
  const board=new THREE.BufferGeometry();board.setAttribute('position',new THREE.Float32BufferAttribute(sv,3));board.setAttribute('uv',new THREE.Float32BufferAttribute(su,2));board.setIndex(si);board.computeVertexNormals();board.rotateZ(.26).rotateY(-.28).translate(11.7,-.15,20);
  geometry(board,'Reference shoreline · leaning wooden surfboard','treehouse-timber','#fff2db',10);
  const stripe=new THREE.Shape();stripe.moveTo(-.12,.18);stripe.quadraticCurveTo(-.2,3.0,0,4.65);stripe.quadraticCurveTo(.2,3,.12,.18);stripe.closePath();
  const sg=new THREE.ShapeGeometry(stripe,20).translate(0,0,.14).rotateZ(.26).rotateY(-.28).translate(11.7,-.15,20);
  geometry(sg,'Reference shoreline · pale surfboard centre inlay','solid','#dbc8a1',10);

  for(const b of batches.values()){
    const g=mergeGeometries(b.geometries,false)!;
    C.push({t:'mesh',p:[0,0,0],vertices:Array.from(g.attributes.position.array,round),normals:Array.from(g.attributes.normal.array,round),
      uvs:Array.from(g.attributes.uv.array,round),indices:Array.from(g.index!.array),tex:b.tex,color:b.color,nm:b.name,grp:b.grp,solid:false,edgeGrinding:false,...b.extra});
    g.dispose();for(const part of b.geometries)part.dispose();
  }
  return C;
}
