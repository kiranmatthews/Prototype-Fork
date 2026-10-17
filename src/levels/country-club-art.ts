import * as THREE from 'three';
import type {CustomComponent} from '../level';
import {COUNTRY_CLUB_LENGTH as length,COUNTRY_CLUB_GAPS as gaps,COUNTRY_CLUB_PONDS as ponds,
  COUNTRY_CLUB_HOLES as holes,COUNTRY_CLUB_BOUNDS as bounds,countryClubPoint as point,
  countryClubFrame as frame,countryClubWidth as width,countryClubGroundHeight as ground,
  countryClubNearestRoad as nearest,countryClubPitField} from './country-club-layout';
import {countryClubGolfField,countryClubGreenDistance,countryClubLandHeight,COUNTRY_CLUB_GOLF_BUNKERS} from './country-club-estate';

type P=[number,number,number];
const rnd=(n:number)=>{const v=Math.sin(n*127.1+31.7)*43758.5453;return v-Math.floor(v);};
/** Art follows the real terrain. No vegetation intrudes on the ride envelope,
 * jump approaches, cup greens, tees or excavated pit floors. */
export function dressCountryClub(C:CustomComponent[]) {
  const decor=(kind:NonNullable<CustomComponent['dkind']>,p:P,scale:number,yaw:number,name:string,s?:P)=>{
    C.push({t:'decor',dkind:kind,p,w:scale,yaw,...(s?{s}:{}),scenerySolid:false,grp:13,nm:name});
  };
  const clear=(x:number,z:number,pad:number,protectFairway=true)=>{
    const road=nearest(x,z),g=countryClubGolfField(x,z);
    return x>bounds.minX+8&&x<bounds.maxX-8&&z>bounds.minZ+8&&z<bounds.maxZ-8&&
      road.distance>width(road.s)/2+pad&&!countryClubPitField(x,z)&&!g.bunker&&!g.tee&&!g.green&&(!protectFairway||!g.fairway)&&
      !holes.some(h=>countryClubGreenDistance(h,x,z)<1.6||Math.hypot(x-h.tee[0],z-h.tee[1])<12)&&
      !ponds.some(p=>Math.hypot((x-p.x)/p.rx,(z-p.z)/p.rz)<1.22);
  };
  for(const c of C)if(c.nm==='Estate / broadleaf grove'){
    c.dkind=rnd(c.p[0]+c.p[2])>.2?'countryoak':'countryumbrellapine';c.w=.9+rnd(c.p[0]+c.p[2])*.55;c.yaw=rnd(c.p[0])*360;
    c.scenerySolid=false;delete c.rise;delete c.vr;delete c.tn;
  }
  let seed=1;
  for(let s=28;s<length;s+=37)for(const side of [-1,1]){
    const n=seed++,p=point(s,side*(width(s)/2+15+rnd(n)*17));
    if(!clear(p[0],p[2],12))continue;p[1]=ground(p[0],p[2])-.12;
    const scale=.95+rnd(n+30)*.6;
    if(n%7===0){decor('baytrunk',p,1.1,rnd(n)*360,'Estate / sculpted palm trunk');decor('baycrown',[p[0],p[1]+8.4,p[2]],1.45,rnd(n)*360,'Estate / sculpted palm crown');}
    else decor(n%5===0?'countryumbrellapine':'countryoak',p,scale,rnd(n)*360,'Estate / framing sculpted tree');
    if(n%2===0)decor('bayrock',[p[0]+side*3,p[1]-.25,p[2]+2],.22+rnd(n)*.13,rnd(n+2)*360,'Estate / cream stone cluster');
    decor('treehousebush',[p[0]-side*3,p[1],p[2]+2],.8+rnd(n),rnd(n)*360,'Estate / sculpted shrub');
  }
  // Close grass groups make a rich rim without a solid fence or visual noise
  // across the player's approach. Existing instanced scenery handles the LOD.
  for(let s=14;s<length-20;s+=11)for(const side of [-1,1]){
    if(gaps.some(g=>s>g.a-10&&s<g.b+12))continue;
    const p=point(s,side*(width(s)/2+3.4));
    if(!clear(p[0],p[2],2.6,false))continue;p[1]=ground(p[0],p[2]);
    decor('coastv2grass',p,1.25+rnd(s)*.8,rnd(s+side)*360,'Estate / verge grass');
    if(Math.floor(s)%5===0)decor('treehousebush',[p[0]+side*2,p[1]-.2,p[2]],.55,rnd(s)*360,'Estate / low verge shrub');
  }
  // Rounded dressed kerbs: visible geometry follows the exact road profile,
  // leaving physical traversal and sand openings intact.
  for(let s=0;s<length-2;s+=10)for(const side of [-1,1]){
    if(gaps.some(g=>s>g.a-2&&s<g.b+2))continue;
    const u=side*(width(s)/2+.18),a=point(s,u),b=point(Math.min(length,s+9.94),side*(width(s+9.94)/2+.18));
    if(countryClubPitField(a[0],a[2])||countryClubPitField(b[0],b[2]))continue;
    const f=frame(s),r=f.r,half=.3,v:number[]=[];
    for(const p of [a,b])for(const [du,h] of [[-half,.02],[0,.2],[half,.02]])v.push(p[0]+r[0]*du,p[1]+h,p[2]+r[2]*du);
    const indices:number[]=[];for(let i=0;i<2;i++)indices.push(i,i+1,i+3,i+1,i+4,i+3);
    C.push({t:'mesh',p:[0,0,0],vertices:v,indices,tex:'bay-stucco',color:Math.floor(s/3)%4===0?'#efdbb1':'#fff0cf',solid:false,doubleSided:true,grp:13,nm:'Race / rounded limestone kerb'});
  }
  // A continuous apron meets the rectangular estate edge; ridges then rise
  // into actual wooded silhouettes, without a visible horizon/terrain seam.
  const cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2;
  const horizon=(a:number,t:number,layer:number):P=>{
    const dx=Math.cos(a),dz=Math.sin(a),edge=Math.min(((bounds.maxX-bounds.minX)/2-3)/Math.max(.001,Math.abs(dx)),((bounds.maxZ-bounds.minZ)/2-3)/Math.max(.001,Math.abs(dz))),
      radius=edge+t*90+layer*290,x=cx+dx*radius,z=cz+dz*radius,
      shape=[0,20,76,54,-45],i=Math.min(3,Math.floor(t)),rise=THREE.MathUtils.lerp(shape[i],shape[i+1],t-i),
      silhouette=.75+.2*Math.sin(a*7+layer)+.13*Math.sin(a*13+2)+.09*Math.sin(a*23),
      y=countryClubLandHeight(x,z)+rise*silhouette;
    return [x,y,z];
  };
  for(let layer=0;layer<2;layer++){
    const v:number[]=[],colors:number[]=[],uvs:number[]=[],indices:number[]=[],count=96;
    for(let ring=0;ring<5;ring++)for(let i=0;i<=count;i++){
      const a=i/count*Math.PI*2,p=horizon(a,ring,layer);v.push(...p);uvs.push(p[0]/14,p[2]/14);
      const color=new THREE.Color(layer?'#78a9ae':'#5b9051').multiplyScalar(.88+.12*Math.sin(a*19+ring*3));colors.push(color.r,color.g,color.b);
      if(ring&&i){const q=(ring-1)*(count+1)+i-1,p=ring*(count+1)+i-1;indices.push(q,p,q+1,q+1,p,p+1);}
    }
    C.push({t:'mesh',p:[0,0,0],vertices:v,indices,colors,uvs,tex:'country-turf',color:'#ffffff',solid:false,castShadow:false,edgeGrinding:false,doubleSided:true,grp:13,nm:`Estate / wooded horizon layer ${layer+1}`});
  }
  for(let i=0;i<90;i++)for(let band=0;band<3;band++){
    const a=(i+rnd(i+band)/2)/90*Math.PI*2,p=horizon(a,.6+band*.7+rnd(i*3+band)*.25,0);
    decor(i%5===0?'countryumbrellapine':'countryoak',p,1.1+rnd(i+band*90)*1.1,rnd(i*7)*360,'Estate / distant wooded ridge');
  }
  // Grass lips give sand traps a planted edge; all clumps remain off the fast lane.
  for(const b of COUNTRY_CLUB_GOLF_BUNKERS)for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2,r=1.16*(1+.16*Math.sin(a*3+b.seed)),u=Math.cos(a)*b.rx*r,v=Math.sin(a)*b.rz*r,
      x=b.x+u*Math.cos(b.angle)+v*Math.sin(b.angle),z=b.z-u*Math.sin(b.angle)+v*Math.cos(b.angle),n=nearest(x,z);
    if(n.distance<width(n.s)/2+2)continue;
    decor('coastv2grass',[x,ground(x,z)-.1,z],1.15+rnd(i+b.seed)*.6,a*180/Math.PI,'Estate / bunker grass lip');
  }
  // Bevelled blue inlays dress the existing physical boost pads.
  for(const pad of C.filter(c=>c.t==='speedpad')){
    const w=pad.s![0]/2,d=pad.s![2]/2,a=(pad.yaw??0)*Math.PI/180,v:number[]=[],colors:number[]=[],indices:number[]=[];
    for(const [inset,h,color] of [[0,.012,'#446fb4'],[.22,.018,'#b9e5ed'],[.38,.022,'#0088e3']] as const){
      for(const [x,z]of [[-w+inset,-d+inset],[w-inset,-d+inset],[w-inset,d-inset],[-w+inset,d-inset]]){v.push(pad.p[0]+x*Math.cos(a)+z*Math.sin(a),pad.p[1]+h,pad.p[2]-x*Math.sin(a)+z*Math.cos(a));const c=new THREE.Color(color);colors.push(c.r,c.g,c.b);}
    }
    for(let j=0;j<2;j++)for(let i=0;i<4;i++){const n=j*4+i,k=j*4+(i+1)%4;indices.push(n,k,n+4,k,k+4,n+4);}
    for(const z of [-d+.38,d-.38]){v.push(pad.p[0]+z*Math.sin(a),pad.p[1]+.022,pad.p[2]+z*Math.cos(a));const c=new THREE.Color('#19dfff');colors.push(c.r,c.g,c.b);}
    indices.push(8,13,12,8,11,13,12,10,9,12,13,10);
    C.push({t:'mesh',p:[0,0,0],vertices:v,indices,colors,color:'#ffffff',tex:'solid',emissive:'#00334f',solid:false,doubleSided:true,edgeGrinding:false,grp:13,nm:'Race / bevelled boost inlay'});
    const arrows:number[]=[],arrowIndices:number[]=[];
    for(const z of [-2,0,2]){
      const k=arrows.length/3;
      for(const [x,zz]of [[-2.4,z+.6],[0,z-.8],[2.4,z+.6],[0,z+.1]])arrows.push(pad.p[0]+x*Math.cos(a)+zz*Math.sin(a),pad.p[1]+.035,pad.p[2]-x*Math.sin(a)+zz*Math.cos(a));
      arrowIndices.push(k,k+1,k+3,k+1,k+2,k+3);
    }
    C.push({t:'mesh',p:[0,0,0],vertices:arrows,indices:arrowIndices,color:'#e9ffff',emissive:'#82babb',tex:'solid',solid:false,doubleSided:true,edgeGrinding:false,grp:13,nm:'Race / luminous boost chevrons'});

  }
  // Reuse the measured modular architecture for a recognisable country club.
  const house=C.find(c=>c.nm==='Clubhouse / central pavilion')!,x=house.p[0],z=house.p[2],floor=house.p[1]-3.5;
  for(const c of C){
    if(c.nm?.startsWith('Clubhouse /')&&c.t==='platform'){
      c.color=c.nm.includes('roof')?'#c96c31':c.nm.includes('foundation')?'#d1bd92':'#fff0d0';c.tex='bay-stucco';
      if(c.nm.includes('roof'))c.artProxy=true;
    }
  }
  const roof=(px:number,py:number,pz:number,w:number,d:number,rise:number)=>{
    const v:number[]=[],uvs:number[]=[],ii:number[]=[];
    for(const side of [-1,1])for(let i=0;i<=12;i++){
      const t=i/12,z=side*d/2*t,y=rise*(1-t)-.18*Math.sin(t*Math.PI);
      for(const x of [-w/2,w/2]){v.push(px+x,py+y,pz+z);uvs.push(x/3,t*d/6);}
      if(i){const k=v.length/3-4;ii.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const ends:number[]=[];for(const side of [-1,1])ends.push(px+side*(w/2-2),py,pz-d/2+1,px+side*(w/2-2),py+rise-.3,pz,px+side*(w/2-2),py,pz+d/2-1);
    C.push({t:'mesh',p:[0,0,0],vertices:ends,indices:[0,1,2,3,4,5],tex:'bay-stucco',color:'#fff0d0',solid:false,doubleSided:true,edgeGrinding:false,grp:13,nm:'Clubhouse / closed stucco gable'});
    C.push({t:'mesh',p:[0,0,0],vertices:v,indices:ii,uvs,tex:'bay-terracotta',color:'#f1b27e',solid:false,doubleSided:true,edgeGrinding:false,grp:13,nm:'Clubhouse / curved terracotta roof'});
  };
  roof(x,floor+7,z,30,24,5.8);
  for(const side of [-1,1])roof(x+side*18,floor+4.6,z+3,16,24,3.2);
  decor('baydoor',[x,floor+.1,z+10.18],1.55,0,'Clubhouse / arched entrance');
  for(const dx of [-20,-14,-8,8,14,20]){
    decor('baywindow',[x+dx,floor+1.1,z+(Math.abs(dx)>13?14.2:10.2)],1.1,0,'Clubhouse / shuttered window');
    decor('baypot',[x+dx,floor,z+17],1.3,0,'Clubhouse / flowering planter');
  }
  for(const side of [-1,1])decor('baylamp',[x+side*8,floor,z+20],1.2,0,'Clubhouse / forecourt lantern');
}
