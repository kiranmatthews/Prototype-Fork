import * as THREE from 'three';
import {mergeVertices,toCreasedNormals} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {SimplexNoise} from '../../vendor/rock-generator/noise.js';
import type {CustomComponent,DecorKind} from '../level';
import {VISTA_PLACEMENTS} from '../desertVistaCatalog';
import {desertPlantSize,type DesertPlantKind} from '../desertPlants';

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

export const vistaRiverX=(z:number)=>670+Math.sin(z*.0032)*120+Math.sin(z*.008+.8)*42;
export const vistaRiverY=(z:number)=>-1014+(z+2400)*.065;

/** A connected geological cross section: rim, stepped scarp, wooded talus,
 * alluvial basin and the opposite mesa. Detail is fixed in world space. */
export function vistaHeight(x:number,z:number,profile:Profile):number{
  const u=x-profile.x;
  // Domain-warped drainage separates wooded saddles from broken cliffs. The
  // basin has its own gentle river grade; it does not copy the riding spline.
  const warp=noise.noise3D(x*.002,2,z*.003)*85;
  const broad=noise.fbm((x+warp)*.0031,2.1,z*.0035,4,2,.5);
  const grain=noise.fbm(x*.037,6,z*.037,3,2,.5);
  const scallop=noise.fbm(z*.008,4,1,3,2,.5)*35+Math.sin(z*.021)*13;
  const left=Math.max(0,-u);
  const shoulder=9+2.5*Math.sin(z*.031)+noise.noise3D(2,z*.05,7)*2;
  const upper=13*smooth(shoulder,36,left)+52*smooth(39+scallop*.3,75+scallop*.3,left)
    +66*smooth(98+scallop,180+scallop,left)+85*smooth(195,420,left);
  const slope=clamp(.12*smooth(12,60,u)+.34*smooth(60+scallop,150+scallop,u)
    +.24*smooth(150,330,u)+.30*smooth(330,620,u));
  const drainage=1-Math.abs(noise.noise3D((x+warp)*.004,5,z*.006));
  const floor=vistaRiverY(z)+18+broad*40+drainage*22;
  let y=mix(profile.y-.28+upper,floor,slope);
  y+=(broad*28+grain*1.6)*smooth(10,65,Math.abs(u));
  // Alternating headlands and forested saddles, not one uniform opposite wall.
  const escarpment=940+Math.sin(z*.0043)*175+noise.noise3D(z*.007,1,8)*85;
  const headland=.5+.5*Math.sin(z*.0068+noise.noise3D(z*.003,2,6)*1.6);
  const ridge=38+205*headland**3+30*noise.fbm(x*.0025,4,z*.0034,3,2,.5);
  y+=ridge*(.84*smooth(escarpment,escarpment+24,x)+.16*smooth(escarpment+24,escarpment+78,x));
  y+=150*smooth(escarpment+80,escarpment+730,x)*(1-Math.abs(noise.noise3D(x*.002,3,z*.003)));
  // Small absolute-elevation bedding breaks the rock without a terraced cake.
  const bed=y/7.8,phase=bed-Math.floor(bed);
  const exposure=smooth(32,90,left)+smooth(55,140,u)*(1-smooth(210,430,u));
  y-=smooth(.73,.94,phase)*.65*Math.min(1,exposure);
  const riverDistance=Math.abs(x-vistaRiverX(z));
  y=mix(y,vistaRiverY(z)-1.1,1-smooth(12,48,riverDistance));
  // Far ridges form overlapping silhouettes above the broad wooded saddle.
  y+=smooth(-4140,-5020,z)*(80+180*(1-Math.abs(noise.fbm(x*.0025,8,z*.003,3,2,.5))));
  return y;
}

export function vistaColour(x:number,y:number,z:number,u:number,normalY:number):THREE.Color{
  const band=.5+.5*Math.sin(y*.21+noise.noise3D(x*.008,1,z*.008)*.8);
  const colour=new THREE.Color('#bb5122').lerp(new THREE.Color('#dc9254'),band*.72);
  const mantle=smooth(.58,.91,normalY);
  colour.lerp(new THREE.Color('#c99963'),mantle*.38);
  const grove=noise.fbm(x*.012,4,z*.012,3,2,.5);
  const drySoil=smooth(35,170,u)*smooth(.48,.88,normalY)*smooth(-.55,.12,grove);
  colour.lerp(new THREE.Color('#8d7958'),drySoil*.70);
  colour.lerp(new THREE.Color('#c6b38b'),(1-smooth(14,47,Math.abs(x-vistaRiverX(z))))*.7);
  colour.lerp(new THREE.Color('#bd7944'),1-smooth(5,15,Math.abs(u)));
  return colour.multiplyScalar(.91+noise.fbm(x*.047,5,z*.047,3,2,.5)*.16);
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
      C.push({t:'mesh',p:[x,0,z],vertices,indices,normals,colors,uvs,tex:'desert-sandstone',solid:false,
        castShadow:x<300,grp:60,nm:'Native eroded amphitheatre and wooded basin'});
    }
  }
  function fracturedButtresses(){
    // Fixed native lofts use the MIT RockGenerator noise field. Vertical
    // jointing splits broad, angular fins; cap beds are narrow and irregular.
    let rockSeed=7112026;
    const rr=()=>{rockSeed=(Math.imul(rockSeed,1664525)+1013904223)>>>0;return rockSeed/4294967296;};
    function fin(s:number,u:number,w:number,h:number,d:number,rotation:number){
      const p=point(s,u),angle=rotation*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle);
      let base=ground(p[0],p[2]);
      for(let i=0;i<12;i++){
        const a=i/12*Math.PI*2,x=Math.cos(a)*w*.48,z=Math.sin(a)*d*.48;
        base=Math.min(base,ground(p[0]+x*ca+z*sa,p[2]-x*sa+z*ca));
      }
      p[1]=base-.6;
      const rows=44,cols=40,vertices:number[]=[],indices:number[]=[],uvs:number[]=[],colors:number[]=[];
      const phase=rr()*50;
      const corners=[[1,.55],[.55,1],[-.55,1],[-1,.55],[-1,-.55],[-.55,-1],[.55,-1],[1,-.55]];
      for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
        const t=j/rows,a=i/cols*Math.PI*2,cs=Math.cos(a),sn=Math.sin(a);
        const y=t*h+noise.noise3D(cs*2+phase,7,sn*2)*h*.014*smooth(.7,1,t);
        const bed=(p[1]+y)/4.1,layer=bed-Math.floor(bed);
        const joint=Math.pow(Math.max(0,Math.sin(a*5+phase+Math.sin(t*3)*.12)),18)*.17;
        const fracture=noise.fbm(cs*3+phase,t*5.8,sn*3,3,2,.52)*.085;
        const cap=smooth(.89,.915,t)*.10;
        const shelf=smooth(.73,.79,layer)*(1-smooth(.91,.97,layer))*.035;
        const scale=1.03-.18*t+fracture-joint+cap+shelf;
        const f=i/cols*8,edge=Math.floor(f)%8,along=f-Math.floor(f),a0=corners[edge],b0=corners[(edge+1)%8];
        const x=mix(a0[0],b0[0],along)*w*.5*scale;
        const z=mix(a0[1],b0[1],along)*d*.5*scale;
        vertices.push(round(x*ca+z*sa),round(y),round(-x*sa+z*ca));uvs.push(i/cols*w,y);
        const chalk=smooth(.90,.92,t)*.75+smooth(.74,.80,layer)*(1-smooth(.91,.98,layer))*.24;
        const colour=new THREE.Color('#bf5928').lerp(new THREE.Color('#e2b681'),Math.min(.8,chalk));
        colour.multiplyScalar(1-joint*2.1+noise.noise3D(cs*3+phase,y*.15,sn*3)*.14);
        colors.push(...colour.toArray());
        if(j<rows&&i<cols){const k=j*(cols+1)+i;indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}
      }
      const cap=vertices.length/3;vertices.push(0,h,0);uvs.push(.5,h);colors.push(...new THREE.Color('#dfb07b').toArray());
      for(let i=0;i<cols;i++)indices.push(rows*(cols+1)+i,cap,rows*(cols+1)+i+1);
      const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
      const creased=toCreasedNormals(geometry,.42),facets=mergeVertices(creased);
      C.push({t:'mesh',p,vertices:Array.from(facets.attributes.position.array),indices:Array.from(facets.index!.array),
        normals:Array.from(facets.attributes.normal.array),uvs:Array.from(facets.attributes.uv.array),colors:Array.from(facets.attributes.color.array),tex:'desert-sandstone',solid:false,
        castShadow:true,grp:63,nm:'Jointed sandstone fin with weathered cap'});
      geometry.dispose();creased.dispose();facets.dispose();
    }
    for(let s=start+90;s<length+5;s+=72){
      const h=20+rr()*15;
      fin(s,-17-rr()*7,9+rr()*6,h,12+rr()*10,yaw(s)+rr()*16-8);
      fin(Math.min(length,s+15),-34-rr()*12,19+rr()*10,h+16+rr()*16,21+rr()*10,yaw(s)+rr()*28-14);
      if(rr()>.35)fin(Math.min(length,s-12),-57-rr()*24,25+rr()*12,h+32,30+rr()*13,yaw(s)+rr()*34);
    }
    for(let s=start+170;s<length-30;s+=135){
      fin(s,62+rr()*65,20+rr()*18,26+rr()*24,25+rr()*16,yaw(s)+rr()*25);
    }
  }
  function gravel(){
    // Angular scree is geometry at every distance, with spatially batched
    // pebbles rather than large flat texture marks or thousands of GLB draws.
    const shard=new THREE.IcosahedronGeometry(1,0),shape=shard.getAttribute('position');
    let gravelSeed=15733;
    const rr=()=>{gravelSeed=(Math.imul(gravelSeed,1664525)+1013904223)>>>0;return gravelSeed/4294967296;};
    for(let from=start+65;from<length;from+=64){
      const end=Math.min(length,from+64),origin=point(from),vertices:number[]=[],indices:number[]=[],colors:number[]=[],uvs:number[]=[];
      const count=Math.floor((end-from)*12);
      for(let j=0;j<count;j++){
        const s=from+rr()*(end-from),side=rr()<.5?-1:1,onTrail=j%11===0;
        const u=onTrail?(rr()*2-1)*width(s)*.43:side*(width(s)/2+.1+Math.pow(rr(),1.7)*16);
        const p=point(s,u);p[1]=ground(p[0],p[2]);
        const radius=(.045+rr()**2*.36)*(onTrail?.48:1),rot=rr()*Math.PI*2,ca=Math.cos(rot),sa=Math.sin(rot),wide=1+rr()*.8;
        const colour=new THREE.Color('#bd794c').lerp(new THREE.Color('#d9b68a'),rr()*.55);
        for(let k=0;k<shape.count;k++){
          const x=shape.getX(k)*radius*wide,z=shape.getZ(k)*radius,y=(shape.getY(k)*.52+.16)*radius;
          indices.push(vertices.length/3);vertices.push(round(p[0]-origin[0]+x*ca+z*sa),round(p[1]-origin[1]+y),round(p[2]-origin[2]-x*sa+z*ca));
          colors.push(...colour.toArray());uvs.push(0,0);
        }
      }
      const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.setIndex(indices);geometry.computeVertexNormals();const normals=Array.from(geometry.attributes.normal.array);geometry.dispose();
      C.push({t:'mesh',p:origin,vertices,indices,colors,uvs,normals,tex:'desert-sandstone',solid:false,castShadow:true,grp:64,nm:'Native angular gravel and loose shoulder scree'});
    }
    shard.dispose();
  }
  // Native asset cells supply both visible geometry and exact collision;
  // duplicating the million terrain triangles into editor JSON is unnecessary.
  if(options.bakeTerrain){
    terrain(-300,100,-2400,-4000,2);
    terrain(100,300,-2400,-4000,4);
    terrain(-684,-300,-2144,-4000,4);
    terrain(300,2220,-2144,-4000,8);
    terrain(-684,2220,-4000,-5024,8);
    fracturedButtresses();gravel();return C;
  }
  for(const c of VISTA_PLACEMENTS)C.push({t:'decor',dkind:c.kind as DecorKind,p:[...c.p],s:[...c.s],
    scenerySolid:c.ground,castShadow:c.shadow,grp:60,nm:'Native eroded amphitheatre and wooded basin'});

  // Real moving water at the floor of the valley. The winding floodplain
  // and warm banks are part of the same height function as both rims.
  for(let from=-2160;from>-4800;from-=120){
    const vertices:number[]=[],indices:number[]=[],uvs:number[]=[],rows=30,cols=6;
    const origin:Point=[vistaRiverX(from),0,from];
    for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
      const z=from-i*4,x=vistaRiverX(z)+(j/cols*2-1)*(7+Math.sin(z*.013)*1.4);
      vertices.push(x-origin[0],vistaRiverY(z)-.6,z-origin[2]);uvs.push(j/cols*2,i*.9);
      if(i<rows&&j<cols){const a=i*(cols+1)+j;indices.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}
    }
    C.push({t:'mesh',p:origin,vertices,indices,uvs,tex:'custard-water',materialStyle:'jungle-stream',
      color:'#709c94',solid:false,castShadow:false,grp:60,nm:'Winding river 500 metres below the rim'});
  }

  // Vegetation follows open habitat pockets, with empty worn riding ground.
  // Imagegen-guided native plant sculpts keep their silhouettes at every distance.
  for(let i=0;i<2400;i++){
    const s=start+55+random()*(length-start-70),side=random()<.56?-1:1;
    const u=side*(width(s)/2+.35+Math.pow(random(),1.5)*23),p=point(s,u);p[1]=ground(p[0],p[2])-.05;
    const h=.35+random()*.85;
    const kind:DesertPlantKind=i%5===0?'canyonpricklypear':i%5===1?'canyonbarrel':i%5===2?'canyondryweed':'canyondrygrass';
    decor(kind,p,desertPlantSize(kind,h),random()*360,'Muted cactus and dry weed along the worn shoulder',i%5<3);
    if(i%7===0){const rock=.25+random()*.85;decor('deserttalus',p,[rock*2.2,rock,rock*1.5],random()*360,'Angular sandstone fragments among the native gravel',rock>.45);}
  }
  // Curved saguaros silhouette the bends without forming a hedge.
  seed=919711;
  for(let i=0;i<210;i++){
    const s=start+80+random()*(length-start-100),side=i%3===0?-1:1,u=side*(12+random()*70);
    const p=point(s,u);p[1]=ground(p[0],p[2])-.25;
    const h=3.4+random()*4.5;
    decor('canyonsaguaro',p,desertPlantSize('canyonsaguaro',h),random()*360,'Sculpted saguaro framing the rolling traverse',true);
  }
  for(const local of [260,660,1000,1340]){
    const s=start+local,p=point(s,-11.5);p[1]=ground(p[0],p[2])-.2;
    decor('canyonsaguaro',p,desertPlantSize('canyonsaguaro',7.4),yaw(s)+55,'Curved foreground cactus and long afternoon shadow',true);
  }
  seed=274039;
  for(let i=0;i<2400;i++){
    const z=-2380-random()*1920,x=65+random()*1180,p=profile(z),u=x-p.x;
    if(u<70||Math.abs(x-vistaRiverX(z))<20)continue;
    const pocket=noise.fbm(x*.012,4,z*.012,3,2,.5);
    if(pocket<-.13||random()>.78)continue;
    const y=ground(x,z),slope=Math.hypot(ground(x+3,z)-ground(x-3,z),ground(x,z+3)-ground(x,z-3))/6;
    if(slope>1.05)continue;
    const kind:DesertPlantKind=i%4===0?'canyonpricklypear':i%4===1?'canyonbarrel':'canyonsaguaro';
    const h=kind==='canyonsaguaro'?4+random()*5.5:1.3+random()*1.7;
    decor(kind,[x,y-.06,z],desertPlantSize(kind,h),random()*360,'Sparse muted cactus habitat across the open basin',false);
  }
  return C;
}
