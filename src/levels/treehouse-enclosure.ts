import * as THREE from 'three';
import type {CustomComponent} from '../level';
import {treehouseTrialPoint,treehouseTrialZ,treehouseTrialOffset} from './treehouse-trials-continuity';

type P=[number,number,number];
type Kind=NonNullable<CustomComponent['dkind']>;
const r=(v:number)=>+v.toFixed(5);
const profile:P[]=[[35,0,-16],[35,0,-28],[35,-1.7,-35],[35,-3,-42],[35,-2.2,-46],
  [35,-5.1,-50],[35,-6.7,-67],[35,-5.9,-71],[35,-9,-75],[35,-10.6,-94],
  [35,-9.8,-98],[35,-13,-102],[35,-14,-112],[35,-14,-282],[35,-7.2,-314],[35,-7.2,-500]];
function sourceZ(world:number):number{
  let a=world,b=world+234;
  for(let i=0;i<24;i++){const m=(a+b)/2;if(treehouseTrialZ(m)<world)a=m;else b=m;}
  return (a+b)/2;
}
function floor(z:number):number{
  for(let i=1;i<profile.length;i++)if(z<=profile[i-1][2]&&z>=profile[i][2]){
    const a=profile[i-1],b=profile[i];return a[1]+(b[1]-a[1])*(z-a[2])/(b[2]-a[2]);
  }
  return z>-16?0:-7.2;
}
const coastal=(z:number,side:number)=>side>0&&z<-158&&z>-195;
const hutSites=(side:number)=>side<0?[-173,-199,-221,-285]:[-212];
function garden(z:number,side:number):number{
  return hutSites(side).reduce((v,site)=>v*(1-.94*Math.exp(-Math.pow((z-site)/8.5,2))),1);
}
const porch=(z:number,side:number)=>hutSites(side).some(site=>Math.abs(z-site)<8);
const offsets=[8,11,16,24,38,58,78],heights=[-.45,1.4,3.6,4.8,5.9,7.4,8.4];
function bankHeight(z:number,offset:number,side:number):number{
  const d=Math.abs(offset);let h=heights[heights.length-1];
  for(let i=1;i<offsets.length;i++)if(d<=offsets[i]){
    h=THREE.MathUtils.lerp(heights[i-1],heights[i],THREE.MathUtils.clamp((d-offsets[i-1])/(offsets[i]-offsets[i-1]),0,1));break;
  }
  return floor(z)+h*(d<24?garden(z,side):1)+.18*Math.sin(z*.17+side*1.3)+.12*Math.sin(offset*.31+z*.13);
}
const intervals=[[-16,-282],[-411,-500]] as const;

/** Layer complete living volumes beyond the already supported play corridor.
 * Sample in world metres so stretched joining sections receive equal density.
 * Every root and matte foot is seated in the same continuous earth profile. */
export function encloseTreehouseWorld(input:readonly CustomComponent[]):CustomComponent[]{
  const bendRelief=(z:number)=>11*Math.exp(-Math.pow((z+569)/17,4));
  const C:CustomComponent[]=input.map((c):CustomComponent=>{
    if(c.t==='decor'&&c.nm==='Halfpipe · fern fronds overhanging the outer deck'){
      const cx=35+treehouseTrialOffset(sourceZ(c.p[2])),side=Math.sign(c.p[0]-cx)||1;
      return {...c,p:[c.p[0]+side*2.1,c.p[1],c.p[2]]};
    }
    if(c.t==='decor'&&c.nm==='Mature forest before the distant cave entrance'){
      const z=sourceZ(c.p[2]),cx=35+treehouseTrialOffset(z),side=Math.sign(c.p[0]-cx)||1;
      const x=c.p[0]+side*3.3;
      return {...c,p:[x,bankHeight(z,Math.abs(x-cx),side)-.45,c.p[2]]};
    }
    if(c.t==='mesh'&&c.vertices&&c.nm?.startsWith('Continuous enclosing left cavern rock shell')){
      const vertices=[...c.vertices];for(let i=0;i<vertices.length;i+=3)vertices[i]-=bendRelief(c.p[2]+vertices[i+2]);
      return {...c,vertices,normals:undefined};
    }
    if(c.t==='mesh'&&c.vertices&&c.nm?.startsWith('Continuous natural cavern roof')){
      const vertices=[...c.vertices];for(let i=0;i<vertices.length;i+=3){
        const z=c.p[2]+vertices[i+2],cx=35+treehouseTrialOffset(sourceZ(z)),x=c.p[0]+vertices[i];
        vertices[i]-=bendRelief(z)*THREE.MathUtils.clamp((cx-x-5)/15,0,1);
      }
      return {...c,vertices,normals:undefined};
    }
    if(c.t==='decor'&&/cavewall|mossrock/.test(c.dkind??'')){
      const cx=35+treehouseTrialOffset(sourceZ(c.p[2]));
      if(c.p[0]<cx-5)return {...c,p:[c.p[0]-bendRelief(c.p[2])*.8,c.p[1],c.p[2]]};
    }
    return {...c};
  });
  const plant=(kind:Kind,x:number,y:number,z:number,w:number,h:number,d:number,yaw:number,name:string,shadow=true)=>
    C.push({t:'decor',dkind:kind,p:[r(x),r(y),r(z)],s:[r(w),r(h),r(d)],yaw:r(yaw),
      castShadow:shadow,nm:'Bush enclosure · '+name,grp:17});
  for(const [near,far] of intervals)for(const side of [-1,1]){
    const worldNear=treehouseTrialZ(near),worldFar=treehouseTrialZ(far);
    // Short overlapping strips keep editor meshes bounded and follow every bend.
    for(let front=worldNear;front>worldFar;front-=42){
      const back=Math.max(worldFar,front-42),rows=Math.ceil((front-back)/2.5),v:number[]=[],uv:number[]=[],colors:number[]=[],ix:number[]=[];
      for(let row=0;row<=rows;row++){
        const wz=THREE.MathUtils.lerp(front,back,row/rows),z=sourceZ(wz),cx=35+treehouseTrialOffset(z);
        for(const offset of offsets){
          const x=cx+side*offset,y=bankHeight(z,offset,side);
          v.push(x,y,wz);uv.push(x/6.5,wz/6.5);
          const color=new THREE.Color('#526b36').lerp(new THREE.Color('#354b2c'),(offset-8)/70*.55);
          color.multiplyScalar(.95+.06*Math.sin(wz*.12+offset));colors.push(...color.toArray());
        }
      }
      for(let row=0;row<rows;row++)for(let col=0;col<offsets.length-1;col++){
        const z=sourceZ(THREE.MathUtils.lerp(front,back,(row+.5)/rows));if(coastal(z,side))continue;
        const a=row*offsets.length+col,b=a+1,c=a+offsets.length,d=c+1;
        if(side>0)ix.push(a,b,c,b,d,c);else ix.push(a,c,b,b,c,d);
      }
      if(ix.length)C.push({t:'mesh',p:[0,0,0],vertices:v.map(r),indices:ix,uvs:uv.map(r),colors:colors.map(r),
        tex:'treehouse-loam',color:'#ffffff',solid:false,edgeGrinding:false,
        nm:'Bush enclosure · continuous rising forest floor',grp:16});
    }
    let i=0;
    for(let wz=worldNear-4-side*2;wz>worldFar;wz-=8.4,i++){
      const z=sourceZ(wz);if(coastal(z,side))continue;
      const cx=35+treehouseTrialOffset(z),j=Math.sin(i*2.399+side),x=cx+side*(12.8+j*.9);
      const width=8.3+(i%3)*.65;
      if(!porch(z,side))plant('trialsv3thicket',x,bankHeight(z,Math.abs(x-cx),side)-.32,wz,width,width*.59,width*.58,
        side*57+i*137.5,'opaque middle understory thicket',false);
      if(i%2===0){
        const offset=19.8+Math.sin(i*.8)*1.2,treeWidth=22+(i%3)*1.5;
        plant(i%4?'trialsv2treea':'trialsv2treeb',cx+side*offset,bankHeight(z,offset,side)-.5,wz-3.2,
          treeWidth,treeWidth*(i%4?.6833:.6439),treeWidth*(i%4?.9966:.6811),side*34+i*71,
          'overlapping rooted middle forest',false);
      }
      if(i%3===1){
        const offset=34+(i%2)*3,width=27+(i%3)*2;
        plant(i%2?'trialsv2treea':'trialsv2treeb',cx+side*offset,bankHeight(z,offset,side)-.6,wz-8,
          width,width*.67,width*.82,side*59+i*83,'second forest depth behind the trunks',false);
      }
      // Low leaf curtains tie the close verge to the raised understory.
      if(i%2===1&&!porch(z,side))plant(i%3?'trialsv2groundcoverb':'trialsv2groundcovera',cx+side*(8.7+j*.35),
        floor(z)+.35,wz+2.4,6.2,i%3?2.26:1.3,i%3?5.6:3.2,side*73+i*31,
        'irregular layered leaf skirt along the bank');
    }
    // Complete dense matte silhouettes seal distant lateral sightlines. No
    // card crosses the playable corridor or a coastal water opening.
    for(let wz=worldNear-19,i=0;wz>worldFar-35;wz-=38,i++){
      const z=sourceZ(wz);if(coastal(z,side))continue;
      const x=35+treehouseTrialOffset(z)+side*(37+Math.sin(i*1.3)*2);
      const width=62+(i%3)*4;
      C.push({t:'decor',dkind:'trialsv3understorymatte',p:[r(x),r(floor(z)+2.5),r(wz)],s:[width,width/3,.02],
        yaw:-side*(42+(i%3)*8),color:i%2?'#93ae85':'#9fb890',castShadow:false,
        nm:'Bush enclosure · continuous layered forest behind the real plants',grp:6});
    }
  }
  // A high leafy ceiling retains patches of blue sky and light, while the
  // forest no longer reads as two isolated rows beside an exposed road.
  for(const [near,far] of intervals){
    let i=0;for(let wz=treehouseTrialZ(near)-12;wz>treehouseTrialZ(far);wz-=17.5,i++){
      const z=sourceZ(wz),side=i%2?-1:1;if(z<-157&&z>-194)continue;
      const cx=35+treehouseTrialOffset(z),width=18+(i%3)*1.1;
      plant('trialsv3bough',cx+side*8.1,floor(z)+(z<-30&&z>-114?11.5:8.8)+(i%3)*.6,wz,
        width,width*.39,width*.48,side<0?12:168,'interlocking high boughs and hanging vines');
    }
  }
  // Opening enclosure faces inland; the ocean/treehouse view stays legible.
  for(const [x,z,width,yaw] of [[-30,-21,22,38],[0,-32,26,-17],[21,-35,26,26],[49,-21,25,-33],[53,3,24,-68]] as const){
    plant('trialsv2treea',x,-.4,z,width,width*.6833,width*.9966,yaw,'rooted inland edge around the opening');
    plant('trialsv3thicket',x,-.25,z+4,width*.44,width*.26,width*.26,yaw,'dense roots beneath the opening canopy');
  }
  // Mossy ledges and varied ferns carry the bush into the sunlit cavern.
  for(let z=-317,i=0;z>=-380;z-=7,i++)for(const side of [-1,1]){
    const pocket=side<0&&z<-362?9:0;
    const p=treehouseTrialPoint([35+side*(8.8+pocket+Math.sin(i)*.6),-7.2,z]);
    plant(i%2?'trialsv2groundcovera':'trialsv2groundcoverb',p[0],p[1]+.15,p[2],5.8,i%2?1.21:2.12,i%2?3:5.23,side*69+i*77,'cavern moss and ferns around timber foundations');
    if(i%2===0)plant('trialsv3thicket',p[0]+side*1.7,p[1]+1.4,p[2]-1.8,6.5,3.2,4.1,side*31+i*53,'leafy cavern wall pocket');
  }
  // A close, elevated descent composition sees over the previous ramp.
  // Its ten-metre feather ends before the first bend; gameplay keeps -Z.
  C.push({t:'camnode',cameraView:true,p:[35,-7,-96],s:[26,48,94],radius:10,yaw:0,
    cameraPosition:[35,2,-87],cameraTarget:[35,-3.8,-96],cameraFov:42,
    cameraFollowDistance:10.7061,cameraFollowTargetHeight:3.2,
    nm:'Downhill canopy corridor · gently elevated continuous follow',grp:7});
  return C;
}
