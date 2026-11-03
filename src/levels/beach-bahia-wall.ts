import type {CustomComponent} from '../level';
import {BahiaCraft,bahiaBevel} from './beach-bahia-craft';

type Road={start:number;end:number;startY:number;endY:number};
const stone=['#efd1a3','#f0d8b1','#e5c7a0','#f5dcb6','#dfc3a1','#ecd0aa'];
const cap=['#ffe0a6','#f3d3a1','#ffe6b8','#f1cc94'];
const random=(n:number)=>{const x=Math.sin(n*127.1+39.7)*43758.5453;return x-Math.floor(x);};

// A masonry face is a shallow chamfered slab embedded in the continuous
// mortar core. No hidden inner cube faces: both exposed sides are authored.
function stoneFaces(w:number,h:number,l:number,b:number,seed:number){
 const v:number[]=[],ix:number[]=[],hy=h/2,hz=l/2;
 const inside=[[-hy+b,-hz+b],[hy-b,-hz+b],[hy-b,hz-b],[-hy+b,hz-b]];
 const outside=[[-hy+b,-hz],[hy-b,-hz],[hy,-hz+b],[hy,hz-b],[hy-b,hz],[-hy+b,hz],[-hy,hz-b],[-hy,-hz+b]];
 for(const sign of [-1,1]){
  const offset=v.length/3;
  for(const [i,[y,z]]of [...inside,...outside].entries())v.push(sign*(i<4?w/2:.419),y+.007*Math.sin(z*2+seed),z);
  const tris=[0,1,2,0,2,3,0,4,5,0,5,1,1,5,6,1,6,7,1,7,2,2,7,8,2,8,9,2,9,3,3,9,10,3,10,11,3,11,0,0,11,4];
  for(let i=0;i<tris.length;i+=3){const t=tris.slice(i,i+3);if(sign<0)t.reverse();ix.push(...t.map(n=>n+offset));}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();return g;
}
function capstone(w:number,h:number,l:number,b:number){
 const v:number[]=[],ix:number[]=[];
 for(const [y,inset]of [[-h/2,0],[h/2-b,0],[h/2,b]])for(const [x,z]of [[-1,-1],[-1,1],[1,1],[1,-1]])v.push(x*(w/2-inset),y,z*(l/2-inset));
 ix.push(0,2,1,0,3,2,8,9,10,8,10,11);
 for(let ring=0;ring<2;ring++)for(let j=0;j<4;j++){
  const a=ring*4+j,b=ring*4+(j+1)%4,c=a+4,d=b+4;ix.push(a,b,c,b,d,c);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();return g;
}

/** Keep each 12 m wall bay editable/cullable. All authored stone facets remain
 * present at every distance; batching only joins identical material draws. */
function batch(parts:CustomComponent[],name:string):CustomComponent {
  const first=parts[0],v:number[]=[],n:number[]=[],uv:number[]=[],colors:number[]=[],ix:number[]=[];
  for(const c of parts){const offset=v.length/3;
    for(let i=0;i<c.vertices!.length;i++)v.push(Math.round((c.vertices![i]+c.p[i%3]-first.p[i%3])*100000)/100000);
    n.push(...c.normals!);uv.push(...c.uvs!);colors.push(...c.colors!);ix.push(...c.indices!.map(i=>i+offset));
  }
  return {...first,nm:name,vertices:v,normals:n,uvs:uv,colors,indices:ix};
}

export function bahiaSeawall(road:readonly Road[],heightAt:(d:number)=>number,openings:readonly number[]):CustomComponent[]{
 const out:CustomComponent[]=[],open=(d:number)=>openings.some(z=>Math.abs(z-d)<3.2);
 let index=0;
 for(const seg of road){
  const cuts=new Set([seg.start,seg.end]);
  for(const z of openings)for(const d of [z-3.2,z+3.2])if(d>seg.start&&d<seg.end)cuts.add(d);
  const ends=[...cuts].sort((a,b)=>a-b);
  for(let k=1;k<ends.length;k++){
   const a=ends[k-1],b=ends[k];if(open((a+b)/2))continue;
   out.push({t:'wallpath',p:[7.2,heightAt(a)-.12,-a],pts:[[0,0,0,0],[0,a-b,0,heightAt(b)-heightAt(a)]],
    w:.85,rise:1.3,tex:'bahia-plaster',color:'#ae9073',grp:105,nm:`Bahia sandstone seawall ${++index}`});
   for(let start=a;start<b-.01;start+=12){
    const end=Math.min(start+12,b),kit=new BahiaCraft([7.2,0,-start],0,105,'Bahia dressed sandstone',true);
    const grade=(heightAt(end)-heightAt(start))/(end-start);
    const block=(name:string,d:number,y:number,w:number,h:number,l:number,color:string,bevel:number,seed:number)=>{
     const g=name==='individual limestone face'?stoneFaces(w,h,l,bevel,seed):capstone(w,h,l,bevel),p=g.attributes.position;
     for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)-p.getZ(i)*grade);
     g.computeVertexNormals();kit.mesh(name,g,[0,heightAt(d)+y,start-d],color);
    };
    for(let row=0;row<2;row++){
     let d=start,stoneNo=0;
     while(d<end-.02){
      const seed=Math.floor(start*11)+row*67+stoneNo++*13;
      const len=Math.min(end-d,(stoneNo===1&&row===1?.73:1.26)+random(seed)*.6);
      block('individual limestone face',d+len/2,row===0?.205:.755,.94+(random(seed+3)-.5)*.035,.535,len-.022,
       stone[Math.floor(random(seed+5)*stone.length)],.055,seed);d+=len;
     }
    }
    for(let d=start,i=0;d<end-.01;i++){
     const len=Math.min(1.66+random(start+i)*.35,end-d),seed=Math.floor(start*3)+i;
     block('separate softened capstone',d+len/2,1.165,1.16,.235,len-.018,cap[i%cap.length],.062,seed);d+=len;
    }
    out.push(batch(kit.components,`Bahia hand-set stone bay ${index} / ${start.toFixed(2)}`));
   }
  }
 }
 // Intermediate piers give the long promenade a human-scale cadence. Their
 // 14 m spacing is independent of access bays, whose clear width stays intact.
 for(const seg of road)for(let z=seg.start+9;z<seg.end-3;z+=14){
  if(openings.some(d=>Math.abs(d-z)<6))continue;
  const kit=new BahiaCraft([7.2,heightAt(z),-z],0,105,'Bahia intermediate pier',true);
  kit.box('pier foot',[0,.05,0],[1.16,.28,1.04],'#ddbf96',.07);
  for(let i=0;i<3;i++)kit.mesh('pier ashlar',bahiaBevel([1.03,.37,.87],.07,z+i,.012),[0,.38+i*.33,0],stone[(i+Math.floor(z))%stone.length]);
  kit.box('pier bevelled cap',[0,1.3,0],[1.28,.25,1.11],'#fbe0b2',.075);
  out.push({t:'wall',p:[7.2,heightAt(z)-.08,-z],s:[1.12,1.5,1.02],invisible:true,grp:105,nm:'Bahia intermediate pier contact'});
  out.push(batch(kit.components,`Bahia rhythm pier ${z.toFixed(2)}`));
 }
 for(const z of openings)for(const side of [-1,1]){
  const d=z+side*3.35,kit=new BahiaCraft([7.2,heightAt(d),-d],0,105,'Bahia access pier',true);
  out.push({t:'wall',p:[7.2,heightAt(d)-.12,-d],s:[1.1,1.48,.67],invisible:true,grp:105,nm:'Bahia beach opening stone pier'});
  kit.box('broad limestone foot',[0,.06,0],[1.28,.3,.91],'#d9b991',.07);
  for(let i=0;i<3;i++)kit.mesh('shaped pier course',bahiaBevel([1.06-i*.035,.4,.7-i*.018],.075,z+i,.012),[0,.39+i*.37,0],stone[(i+Math.floor(z))%stone.length]);
  kit.box('projecting capstone',[0,1.45,0],[1.36,.25,.99],'#ffe2ad',.085);
  // Short rounded returns frame the bay on the sand side, ending clear of the
  // 6.4 m opening. Their foot is fitted into the sand instead of hovering.
  for(let i=0;i<3;i++){
   const x=.65+i*.62,h=.91-i*.2;
   kit.box('stepped beach-side return',[x,h/2-.1,side*.03],[.66,h,.66],stone[(i+2)%stone.length],.07);
   kit.box('return cap',[x,h-.05,side*.03],[.74,.18,.82],'#f8dab0',.065);
   out.push({t:'wall',p:kit.point([x,-.1,side*.03]),s:[.7,h+.12,.74],invisible:true,grp:105,nm:'Bahia beach-side return contact'});
  }
  out.push(batch(kit.components,`Bahia finished access pier ${z} / ${side}`));
 }
 return out;
}
import * as THREE from 'three';
