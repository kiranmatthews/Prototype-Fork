import * as THREE from 'three';
import {SimplexNoise} from '../../vendor/rock-generator/noise.js';
import type {CustomComponent,DecorKind} from '../level';
import {VISTA_PLACEMENTS} from '../desertVistaCatalog';

type Point=[number,number,number];
type Profile={x:number;y:number;s:number};
const noise=new SimplexNoise(20261107);
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const round=(x:number)=>Math.round(x*10000)/10000;

/** Zwf8svpX__E, opening cliff traverse: close sediment shelves on the left,
 * exposed trail above a forested basin on the right. Authored reconstruction,
 * not extracted game geometry. This continuation keeps the original course. */
export const VISTA_KNOTS:Point[]=[
  [0,-470,-2320],[0,-477,-2360],[-12,-486,-2410],[-60,-501,-2480],
  [-108,-520,-2550],[-125,-537,-2640],[-97,-558,-2720],[-51,-568,-2790],
  [-34,-588,-2860],[-68,-612,-2935],[-118,-626,-3000],[-170,-639,-3080],
  [-155,-660,-3160],[-94,-679,-3240],[-71,-698,-3320],[-101,-714,-3400],
  [-169,-735,-3480],[-206,-760,-3570],[-187,-779,-3640],[-140,-797,-3720],
  [-100,-815,-3790],[-104,-826,-3840],
];

export const vistaRiverX=(z:number)=>710+Math.sin(z*.0032)*105+Math.sin(z*.009+.8)*34;

/** A connected geological cross section: rim, stepped scarp, wooded talus,
 * alluvial basin and the opposite mesa. Detail is fixed in world space. */
export function vistaHeight(x:number,z:number,profile:Profile):number{
  const u=x-profile.x;
  const broad=noise.fbm(x*.004,2.1,z*.004,4,2,.5);
  const grain=noise.fbm(x*.035,6,z*.035,3,2,.5);
  const scallop=Math.sin(z*.014)*8+noise.noise3D(3,z*.008,2)*24;
  const left=Math.max(0,-u-10);
  const edge=8+Math.sin(z*.071)*1.1+noise.noise3D(2,z*.026,7)*2+smooth(18,70,Math.abs(u))*scallop*.15;
  const face=32+Math.sin(z*.027)*6+noise.noise3D(5,z*.013,1)*6;
  const upper=face*smooth(edge,edge+9+Math.sin(z*.041)*4,left)+24*smooth(26,42+scallop*.25,left)
    +35*smooth(43+scallop*.3,82+scallop*.3,left)+45*smooth(85,160,left)
    +35*smooth(180,310,left);
  const lower=32*smooth(4.4,17,u)+135*smooth(28+scallop,90+scallop,u)
    +105*smooth(112+scallop,175+scallop,u)+135*smooth(215,410,u)
    +100*smooth(420,620,u);
  const mesaEdge=1050+Math.sin(z*.0037)*160+noise.noise3D(z*.006,1,8)*75;
  const mesa=255*smooth(mesaEdge,mesaEdge+95,x)+105*smooth(mesaEdge+135,mesaEdge+205,x)
    +90*smooth(mesaEdge+310,mesaEdge+640,x);
  const weathering=(broad*42+grain*3.4+Math.sin(z*.048+x*.02)*2.5)*smooth(9,60,Math.abs(u));
  let y=profile.y-.25+upper-lower+mesa+weathering;
  const rockFace=Math.max(smooth(10,24,left),smooth(12,35,u)*(1-smooth(200,450,u)),smooth(mesaEdge-20,mesaEdge+70,x));
  const bedding=12.5,layer=y/bedding,frac=layer-Math.floor(layer);
  const terraced=(Math.floor(layer)+smooth(.05,.55,frac))*bedding;
  y=mix(y,terraced,rockFace*.48);
  // A pale river terrace is cut through the low basin, with wooded islands.
  const riverDistance=Math.abs(x-vistaRiverX(z));
  const riverBed=profile.y-518;
  y=mix(y,riverBed,smooth(0,1,1-smooth(10,58,riverDistance)));
  // Close the far end with another stepped amphitheatre, beyond the finish.
  y+=smooth(-4070,-4700,z)*(110+140*smooth(280,850,u));
  return y;
}

export function vistaColour(x:number,y:number,z:number,u:number,normalY:number):THREE.Color{
  const band=.5+.5*Math.sin(y*.23+noise.noise3D(x*.008,1,z*.008)*.8);
  const colour=new THREE.Color().setRGB(mix(.57,.75,band),mix(.235,.355,band),mix(.105,.18,band));
  const forest=smooth(95,280,u)*(1-smooth(1000,1260,x))*smooth(.48,.83,normalY)
    *(.93+.07*noise.fbm(x*.022,4,z*.022,3,2,.5));
  colour.lerp(new THREE.Color(.065,.095,.052),forest);
  colour.lerp(new THREE.Color(.43,.40,.28),1-smooth(16,50,Math.abs(x-vistaRiverX(z))));
  colour.lerp(new THREE.Color(.52,.255,.105),1-smooth(4.1,10,Math.abs(u)));
  return colour.multiplyScalar(.92+noise.fbm(x*.047,5,z*.047,3,2,.5)*.13);
}

export function buildVista(options:{start:number;length:number;point:(s:number,u?:number)=>Point;yaw:(s:number)=>number;
  profile:(z:number)=>Profile;ground:(x:number,z:number)=>number;width:(s:number)=>number;bakeTerrain?:boolean}):CustomComponent[]{
  const {start,length,point,yaw,profile,ground,width}=options;
  const C:CustomComponent[]=[];
  let seed=11072026;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const decor=(kind:DecorKind,p:Point,size:Point,rotation:number,name:string,shadow=true,color?:string)=>{
    C.push({t:'decor',dkind:kind,p:p.map(round) as Point,s:size,yaw:rotation,scenerySolid:false,
      castShadow:shadow,color,grp:61,nm:name});
  };
  function terrain(x0:number,x1:number,z0:number,z1:number,grid:number){
    const tile=grid===2?96:128;
    for(let x=x0;x<x1;x+=tile)for(let z=z0;z>z1;z-=tile){
      const nx=Math.ceil((Math.min(x+tile,x1)-x)/grid),nz=Math.ceil((z-Math.max(z-tile,z1))/grid);
      const dx=(Math.min(x+tile,x1)-x)/nx,dz=(z-Math.max(z-tile,z1))/nz;
      const vertices:number[]=[],indices:number[]=[],normals:number[]=[],uvs:number[]=[],colors:number[]=[];
      for(let k=0;k<=nz;k++)for(let j=0;j<=nx;j++){
        const wx=x+j*dx,wz=z-k*dz,p=profile(wz),y=ground(wx,wz),u=wx-p.x;
        vertices.push(round(j*dx),round(y),round(-k*dz));uvs.push(round(wx),round(wz));
        const h=grid*.5,gx=(ground(wx+h,wz)-ground(wx-h,wz))/(2*h),gz=(ground(wx,wz+h)-ground(wx,wz-h))/(2*h);
        const normal=new THREE.Vector3(-gx,1,-gz).normalize();normals.push(...normal.toArray().map(round));
        colors.push(...vistaColour(wx,y,wz,u,normal.y).toArray().map(round));
        if(j<nx&&k<nz){const a=k*(nx+1)+j;indices.push(a,a+1,a+nx+1,a+1,a+nx+2,a+nx+1);}
      }
      // Fixed terrain detail by authored region, never selected by distance.
      // Native skirts close tessellation boundaries on steep eroded faces.
      const edge:number[]=[];
      for(let j=0;j<=nx;j++)edge.push(j);
      for(let k=1;k<=nz;k++)edge.push(k*(nx+1)+nx);
      for(let j=nx-1;j>=0;j--)edge.push(nz*(nx+1)+j);
      for(let k=nz-1;k>0;k--)edge.push(k*(nx+1));
      for(let i=0;i<edge.length;i++){
        const a=edge[i],b=edge[(i+1)%edge.length],c=vertices.length/3;
        vertices.push(vertices[a*3],vertices[a*3+1]-4,vertices[a*3+2],vertices[b*3],vertices[b*3+1]-4,vertices[b*3+2]);
        normals.push(...normals.slice(a*3,a*3+3),...normals.slice(b*3,b*3+3));
        colors.push(...colors.slice(a*3,a*3+3),...colors.slice(b*3,b*3+3));
        uvs.push(...uvs.slice(a*2,a*2+2),...uvs.slice(b*2,b*2+2));indices.push(a,c,b,b,c,c+1);
      }
      C.push({t:'mesh',p:[x,0,z],vertices,indices,normals,colors,uvs,tex:'desert-sandstone',
        solid:false,castShadow:x<300,grp:60,nm:'Native vista landform · sediment shelves and forested basin'});
    }
  }
  function sedimentWall(){
    // A swept rock face can undercut and overhang; a height field alone
    // turns these shelves into a regular steep bank. Horizontal bedding is
    // measured in absolute elevation, independent of the descending trail.
    const surface=(s:number,t:number)=>{
      const base=point(s)[1]-8,back=point(s,-59),top=ground(back[0],back[2]);
      const y=mix(base,top,t),bedding=(y+noise.noise3D(s*.007,2,4)*1.5)/10;
      const phase=bedding-Math.floor(bedding);
      const lip=2.2*(smooth(.58,.80,phase)-smooth(.92,1,phase));
      const erosion=noise.fbm(s*.035,y*.11,7,4,2,.5)*1.5;
      const u=Math.min(-5.9,-7.4-52*t*t+lip+erosion);
      const p=point(s,u);p[1]=t===1?ground(p[0],p[2])-.25:y;
      return new THREE.Vector3(...p);
    };
    for(let from=start+65;from<length;from+=96){
      const to=Math.min(length,from+96),rows=Math.ceil((to-from)/2),cols=80;
      const vertices:number[]=[],indices:number[]=[],normals:number[]=[],colors:number[]=[],uvs:number[]=[];
      const origin=point(from);
      for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
        const s=mix(from,to,i/rows),t=j/cols,p=surface(s,t);
        const along=surface(s+.2,t).sub(surface(s-.2,t)),up=surface(s,Math.min(1,t+.002)).sub(surface(s,Math.max(0,t-.002)));
        const normal=along.cross(up).normalize();
        vertices.push(...p.clone().sub(new THREE.Vector3(...origin)).toArray().map(round));
        normals.push(...normal.toArray().map(round));uvs.push(s,p.y);
        const band=(p.y+noise.noise3D(s*.007,2,4)*1.5)/10,phase=band-Math.floor(band);
        const chalk=smooth(.63,.79,phase)*(1-smooth(.91,1,phase));
        const colour=new THREE.Color('#c77840').lerp(new THREE.Color('#edc595'),chalk*.53);
        colour.multiplyScalar(.90+noise.fbm(s*.055,p.y*.12,8,3,2,.5)*.16);
        colors.push(...colour.toArray().map(round));
        if(i<rows&&j<cols){const a=i*(cols+1)+j;indices.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
      }
      C.push({t:'mesh',p:origin,vertices,indices,normals,colors,uvs,tex:'desert-sandstone',solid:false,
        castShadow:true,grp:63,nm:'Undercut sandstone bedding · native sculpted cliff'});
    }
  }
  // The previous course occupies x=-300..300 through z=-2400. Shared
  // height/normal queries join its end; side panels extend its visible rim.
  if(options.bakeTerrain){
    sedimentWall();
    terrain(-300,100,-2400,-4000,2);
    terrain(100,300,-2400,-4000,4);
    terrain(-684,-300,-2144,-4000,4);
    terrain(300,2220,-2144,-4000,8);
    terrain(-684,2220,-4000,-5024,8);
    return C;
  }
  for(const c of VISTA_PLACEMENTS)C.push({t:'decor',dkind:c.kind as DecorKind,p:[...c.p],s:[...c.s],
    scenerySolid:false,castShadow:c.shadow,grp:60,nm:'Native vista landform · sediment shelves and forested basin'});
  // A narrow matching ground apron owns off-trail contact. The detailed
  // landscape is baked into native spatial cells through the existing asset pipeline.
  for(let from=start;from<length;from+=64){
    const rows=Math.ceil(Math.min(64,length-from)/2),cols=16,origin=point(from),vertices:number[]=[],indices:number[]=[];
    for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
      const q=point(Math.min(length,from+i*2),-20+j*2.5);
      vertices.push(round(q[0]-origin[0]),round(ground(q[0],q[2])-origin[1]-.05),round(q[2]-origin[2]));
      if(i<rows&&j<cols){const a=i*(cols+1)+j;indices.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}
    }
    C.push({t:'mesh',p:origin,vertices,indices,tex:'solid',invisible:true,
      outOfBounds:true,edgeGrinding:false,castShadow:false,grp:62,nm:'Rim shoulder contact and recovery'});
  }

  // Real moving water at the floor of the valley. The winding floodplain
  // and warm banks are part of the same height function as both rims.
  for(let from=-2160;from>-4800;from-=120){
    const vertices:number[]=[],indices:number[]=[],uvs:number[]=[],rows=30,cols=6;
    const origin:Point=[vistaRiverX(from),0,from];
    for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
      const z=from-i*4,x=vistaRiverX(z)+(j/cols*2-1)*(7+Math.sin(z*.013)*1.4);
      vertices.push(x-origin[0],profile(z).y-517.3,z-origin[2]);uvs.push(j/cols*2,i*.9);
      if(i<rows&&j<cols){const a=i*(cols+1)+j;indices.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}
    }
    C.push({t:'mesh',p:origin,vertices,indices,uvs,tex:'custard-water',materialStyle:'jungle-stream',
      color:'#709c94',solid:false,castShadow:false,grp:60,nm:'Winding river 500 metres below the rim'});
  }

  // The high ledge is grounded in a dense, continuous cross section instead
  // of isolated monoliths. Its pale caps expose narrow horizontal bedding.
  for(let s=start+90;s<length-12;s+=31){
    const u=-16-random()*2,p=point(s,u),h=20+random()*12;
    p[1]-=4;
    decor('deserthoodoolow',p,[26+random()*12,h,18+random()*2],yaw(s)+85+random()*10,'Rounded sediment ledge on the uphill face');
  }
  for(let i=0;i<420;i++){
    const s=start+65+random()*(length-start-80),side=random()<.63?-1:1;
    const u=side*(width(s)/2+1+random()*9),p=point(s,u);p[1]=ground(p[0],p[2])-.06;
    const h=.25+random()*.60;
    decor(i%4?'coastv2grassb':'custardbankshrub',p,[h*2.7,h,h*2.3],random()*360,'Scrub rooted in exposed ledge cracks',i%4===0,'#aeb795');
    if(i%3===0){const rock=.25+random()*.65;decor('deserttalus',p,[rock*1.8,rock,rock*1.3],random()*360,'Loose scree beside the riding line');}
  }
  // Sparse foreground trees frame the opening without screening the valley.
  for(let i=0;i<66;i++){
    const s=start+130+random()*(length-start-150),side=i%4===0?-1:1,u=side*(15+random()*35);
    const p=point(s,u);p[1]=ground(p[0],p[2])-.3;const h=14+random()*14;
    decor('canyonpine',p,[h*.35,h,h*.34],random()*360,'Existing conifer rooted on the cliff terraces',true,'#bbc6b0');
  }
  for(const local of [325,720,1010,1390]){
    const s=start+local,p=point(s,12.5);p[1]=ground(p[0],p[2])-.3;
    decor('canyonpine',p,[10.5,35,10],yaw(s)+55,'Foreground conifer framing the open basin');
  }
  // Full native trees, grouped into irregular groves along moist folds.
  // A larger instancing grain reduces draw calls; no simplified meshes.
  for(let i=0;i<1800;i++){
    const z=-2250-random()*2450,x=100+random()*1300,p=profile(z),u=x-p.x;
    if(u<100||x>1030+Math.sin(z*.0037)*150||Math.abs(x-vistaRiverX(z))<22)continue;
    const pocket=noise.noise3D(x*.009,1,z*.009);
    if(pocket<-.18||random()>.83)continue;
    const y=ground(x,z),slope=Math.hypot(ground(x+3,z)-ground(x-3,z),ground(x,z+3)-ground(x,z-3))/6;
    if(slope>1.25)continue;
    const broad=i%5===0,h=broad?22+random()*15:19+random()*20;
    decor(broad?'canyonwoodland':'canyonpinegrove',[x,y-.4,z],[h*(broad?1.3:.4),h,h*(broad?1.22:.38)],random()*360,'Native conifer grove on the valley slope',false,'#a7bca6');
  }
  // Scenic terrain is visual-only: falling off the exposed rim returns to
  // the last checkpoint well before reaching the valley hundreds of metres below.
  for(let z=-2340;z>-3940;z-=80){
    const next=z-80,a=profile(z).y-70,b=profile(next).y-70;
    C.push({t:'mesh',p:[0,0,0],vertices:[-600,a,z,600,a,z,-600,b,next,600,b,next],indices:[0,1,2,1,3,2],
      tex:'solid',lethal:true,invisible:true,edgeGrinding:false,castShadow:false,grp:62,nm:'Continuous cliff fall recovery beneath the rim'});
  }
  return C;
}
