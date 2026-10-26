import type {CustomComponent} from '../level';
import {RALLY_SPONSORS} from '../rallySponsors';
import {stadiumPoint,stadiumSections,STADIUM} from './cart-stadium-layout';

// These positions match the existing collision wall's rendered stations.
function wallPoint(s:number,side:number,offset:number){
 const a=-8+Math.floor((s+8)/4)*4,t=(s-a)/4;
 const p=stadiumPoint(a,side*offset,0),q=stadiumPoint(a+4,side*offset,0);
 return p.map((value,i)=>value+(q[i]-value)*t);
}
function sponsorSupport(at:number,finish:number,side:number){
 const stations=[at];for(let s=-8+(Math.floor((at+8)/4)+1)*4;s<finish;s+=4)stations.push(s);stations.push(finish);
 const actualWall=stations.map(s=>wallPoint(s,side,STADIUM.wallOffset));
 const c0=wallPoint(at,side,0),c1=wallPoint(finish,side,0),length=Math.hypot(c1[0]-c0[0],c1[2]-c0[2]);
 const tx=(c1[0]-c0[0])/length,tz=(c1[2]-c0[2])/length,nx=-tz*side,nz=tx*side;
 const folded=actualWall.some((p,i)=>i>0&&(p[0]-actualWall[i-1][0])*tx+(p[2]-actualWall[i-1][2])*tz<=.01);
 const along=actualWall.map(p=>p[0]*tx+p[2]*tz),lo=Math.min(...along),hi=Math.max(...along);
 const outside=Math.max(...actualWall.map(p=>p[0]*nx+p[2]*nz));
 return {at,finish,side,stations,actualWall,c0,c1,tx,tz,nx,nz,folded,lo,hi,outside};
}
let foldedSupports:ReturnType<typeof sponsorSupport>[]|undefined;
/** Straighten the decorative upper wall behind the same four corrected ads.
 * Called only for visual vertices; coastwall collision keeps its original path. */
export function stadiumSponsorWallPoint(s:number,side:number){
 if(!foldedSupports){
  foldedSupports=[];
  for(const section of stadiumSections())for(let at=section.start+2;at<section.end-4;at+=22){
   const support=sponsorSupport(at,Math.min(at+20,section.end-2),section.side);if(support.folded)foldedSupports.push(support);
  }
 }
 const original=wallPoint(s,side,STADIUM.wallOffset);
 const support=foldedSupports.find(p=>p.side===side&&s>=Math.floor(p.at/4)*4&&s<=Math.ceil(p.finish/4)*4);
 if(!support)return original;
 const {at,finish,tx,tz,nx,nz,lo,hi,outside}=support,start=Math.floor(at/4)*4,end=Math.ceil(finish/4)*4;
 const a=wallPoint(start,side,STADIUM.wallOffset),b=wallPoint(end,side,STADIUM.wallOffset);
 const begin=Math.min(lo-.2,a[0]*tx+a[2]*tz),last=Math.max(hi+.2,b[0]*tx+b[2]*tz);
 const along=begin+(last-begin)*(s-start)/(end-start),back=outside+.35;
 return [tx*along+nx*back,original[1],tz*along+nz*back].map(value=>Math.round(value*1e5)/1e5);
}

/** Curved sheet-metal hoardings with large ads and smaller pasted-over stickers.
 * Negative U selects metal; cropped atlas UVs select cutout artwork. Everything
 * stays in the existing single mesh/material per stand section. */
export function stadiumSponsors(start:number,end:number,side:number):CustomComponent{
 const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
 // CCR is the default and the only main design allowed in adjoining repeats.
 const wide=[7,7,0,7,1,7,6,7,2,7],stickers=[3,4,5],facing=side>0?-1:1;
 // Follow the rendered wall's global four-metre stations exactly. Sampling
 // the analytic offset curve between them can expose heading discontinuities
 // which the authored wall never renders, sending an ad across the track.
 const arcTable=(at:number,finish:number,inset:number)=>{
  const samples:{s:number,d:number,p:number[]}[]=[];let previous:number[]|null=null,total=0;
  const {stations,c0,c1,tx,tz,nx,nz,folded,lo,hi,outside:wallOutside}=sponsorSupport(at,finish,side);
  if(folded){
   // An offset wall can double back at a sharp route heading. The billboard
   // must not inherit that fold: its flat support stays outside every wall
   // point in this interval, including the foremost pasted-on sticker.
   const outside=wallOutside+.16-inset;
   samples.push({s:at,d:0,p:[tx*lo+nx*outside,c0[1],tz*lo+nz*outside]},
    {s:finish,d:hi-lo,p:[tx*hi+nx*outside,c1[1],tz*hi+nz*outside]});
   total=hi-lo;
  }else for(const s of stations){
   const p=wallPoint(s,side,27.23-inset);if(previous)total+=Math.hypot(p[0]-previous[0],p[2]-previous[2]);
   samples.push({s,d:total,p});previous=p;
  }
  const steps=samples.length-1;
  const distanceAt=(s:number)=>{
   let lo=0,hi=steps;while(hi-lo>1){const mid=(lo+hi)>>1;if(samples[mid].s<s)lo=mid;else hi=mid;}
   const a=samples[lo],b=samples[hi];return a.d+(b.d-a.d)*(s-a.s)/(b.s-a.s);
  };
  const segmentAt=(distance:number)=>{
   const d=Math.max(0,Math.min(total,distance));let lo=0,hi=steps;
   while(hi-lo>1){const mid=(lo+hi)>>1;if(samples[mid].d<d)lo=mid;else hi=mid;}
   const a=samples[lo],b=samples[hi],t=(d-a.d)/Math.max(1e-10,b.d-a.d);return {a,b,t};
  };
  const atDistance=(distance:number)=>{const {a,b,t}=segmentAt(distance);return a.s+(b.s-a.s)*t;};
  const pointAt=(distance:number,height:number)=>{
   const {a,b,t}=segmentAt(distance);return a.p.map((value,i)=>value+(b.p[i]-value)*t+(i===1?height:0));
  };
  const corners=samples.slice(1,-1).map(sample=>sample.d);
  return {total,distanceAt,atDistance,pointAt,corners};
 };
 const patch=(arc:ReturnType<typeof arcTable>,center:number,width:number,height:number,x:number,y:number,angle:number,brand:number)=>{
  const cells=Math.max(1,Math.ceil(width/2)),cs=Math.cos(angle),sn=Math.sin(angle),art=brand<0?null:RALLY_SPONSORS[brand];
  const cuts=Array.from({length:cells+1},(_,i)=>i/cells);
  // Preserve every rendered wall corner instead of cutting across the polyline.
  for(const corner of arc.corners)for(const py of [-height/2,height/2]){
   const u=.5+((corner-center)/facing-x+py*sn)/(width*cs);if(u>0&&u<1)cuts.push(u);
  }
  cuts.sort((a,b)=>a-b);
  for(let cell=0;cell<cuts.length-1;cell++){
   if(cuts[cell+1]-cuts[cell]<1e-6)continue;
   const n=vertices.length/3;
   for(const [u,v]of [[cuts[cell],0],[cuts[cell+1],0],[cuts[cell],1],[cuts[cell+1],1]]){
    const px=(u-.5)*width,py=(v-.5)*height;
    const distance=center+facing*(x+px*cs-py*sn),h=y+px*sn+py*cs;
    vertices.push(...arc.pointAt(distance,h).map(value=>Math.round(value*1e5)/1e5));
    uvs.push(...(art?[art.uv[0]+u*(art.uv[2]-art.uv[0]),art.uv[1]+v*(art.uv[3]-art.uv[1])]:[-1-u,v]).map(value=>Math.round(value*1e6)/1e6));
   }
   indices.push(n,n+1,n+2,n+1,n+3,n+2);
  }
 };
 for(let at=start+2,board=0;at<end-4;at+=22,board++){
  const finish=Math.min(at+20,end-2),metalArc=arcTable(at,finish,0),artArc=arcTable(at,finish,.035),stickerArc=arcTable(at,finish,.11);
  const tiles=Math.max(1,Math.round(metalArc.total/20)),tileWidth=metalArc.total/tiles;
  const ordinal=Math.floor((start+8)/48)*2+board,primary=wide[(ordinal+(side>0?3:0))%wide.length];
  const boardHeight=primary===1?7.7:6.55,boardY=10.05+boardHeight/2;
  patch(metalArc,metalArc.total/2,metalArc.total,boardHeight,0,boardY,0,-1);
  for(let tile=0;tile<tiles;tile++){
   const centerS=metalArc.atDistance((tile+.5)*tileWidth);
   const seed=ordinal+tile+(side>0?3:0),stickerSeed=ordinal*2+tile+(side>0?1:0);
   const brand=tile===0?primary:7,sticker=stickers[stickerSeed%stickers.length];
   const sign=seed%2?1:-1,scale=Math.min(1,tileWidth/20),height=(brand===1?7.3:6.12)*scale;
   const mainWidth=Math.min(tileWidth-.44*scale,height*RALLY_SPONSORS[brand].aspect);
   const mainX=brand===1?0:RALLY_SPONSORS[brand].aspect<2.5?-sign*2.05*scale:0;
   patch(artArc,artArc.distanceAt(centerS),mainWidth,height,mainX,boardY,0,brand);
   // Smaller labels cross the main artwork and board edges, with varied tilt.
   const stickerHeight=(sticker===3?3.5:sticker===4?3.1:3.4)*scale;
   const stickerX=sign*(sticker===3?7.4:sticker===4?7.0:7.2)*scale;
   const stickerY=sticker===4?11.85:14.8+(seed%3)*.12;
   patch(stickerArc,stickerArc.distanceAt(centerS),stickerHeight*RALLY_SPONSORS[sticker].aspect,stickerHeight,stickerX,stickerY,sign*(.10+(seed%3)*.025),sticker);
  }
 }
 return {t:'mesh',nm:'Stadium sponsor hoarding',p:[0,0,0],vertices,indices,uvs,doubleSided:true,color:'#ffffff',tex:'rally-sponsors',solid:false,castShadow:false};
}
