import type {CustomComponent} from '../level';

type P=[number,number,number];

/** Keep the authored bank's exact top plane, with a closed body to the apron. */
export function motuSolidBank(c:CustomComponent):CustomComponent {
  const x=(c.w??8)/2,z=(c.len??10)/2,h=c.rise??4;
  const vertices=[-x,0,z,x,0,z,x,h,-z,-x,h,-z,
    -x,-.06,z,x,-.06,z,x,-.06,-z,-x,-.06,-z];
  const indices=[0,1,2,0,2,3];
  for(const [a,b,d,e]of [[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0],[4,7,6,5]])
    indices.push(a,b,d,a,d,e);
  return {...c,t:'mesh',vertices,indices,grindTopTriangles:2,solidSides:true,vert:false};
}

/** The reconstruction ribbon already has a closed indexed body. Extend its
 * bottom to the apron so raised approaches have fitted timber walls. */
export function motuGroundedRibbon(c:CustomComponent):CustomComponent {
  const vertices=[...c.vertices!];
  for(let i=0;i<vertices.length/3;i++)if(i%4>=2)vertices[i*3+1]=-.06;
  return {...c,vertices};
}

/** Caps under the open ends only: no wall crosses the flat riding channel.
 * Motu's paths are level, unbanked corner paths; their endpoint tangent is
 * identical to the native swept ramp's first/last straight segment. */
export function motuRampEndCaps(c:CustomComponent):CustomComponent[] {
  if(c.t!=='vertramp'||c.closed)return [];
  const radius=c.rise??6,flat=c.w??3,arc=(c.arc??90)*Math.PI/180,steps=c.arcSteps??24;
  const half:[number,number][]=[];
  for(let i=0;i<=steps;i++)half.push([flat+radius*Math.sin(arc*i/steps),radius*(1-Math.cos(arc*i/steps))]);
  const lip=half[half.length-1],lipY=lip[1]+(c.lipRise??0),deck=c.deck??0,bank=c.outerBank??0;
  if(c.lipRise)half.push([lip[0],lipY]);
  if(bank>0){if(deck>0)half.push([lip[0]+deck,lipY]);half.push([lip[0]+deck+bank,0]);}
  else if(deck>0)half.push([lip[0]+deck,lipY],[lip[0]+deck+.1,lipY],[lip[0]+deck+.1,0]);
  const profile=c.vkind==='half'?[...half.map(([x,y])=>[-x,y] as [number,number]).reverse(),...half]:[[0,0] as [number,number],...half];
  const nodes=c.pts??[[0,-(c.len??30)/2],[0,(c.len??30)/2]],yaw=(c.yaw??0)*Math.PI/180,cs=Math.cos(yaw),sn=Math.sin(yaw);
  return [0,nodes.length-1].map((end,index)=>{
    const a=nodes[end],b=nodes[index===0?1:end-1],sign=index===0?1:-1;
    const tx=(b[0]-a[0])*sign,tz=(b[1]-a[1])*sign,length=Math.hypot(tx,tz),rx=tz/length,rz=-tx/length;
    const point=(x:number,y:number):P=>{
      const px=a[0]+rx*x,pz=a[1]+rz*x;
      return [c.p[0]+px*cs+pz*sn,c.p[1]+(a[3]??0)+y,c.p[2]-px*sn+pz*cs];
    };
    const vertices:number[]=[],indices:number[]=[];
    for(let i=0;i<profile.length-1;i++){
      const [x,y]=profile[i],[xx,yy]=profile[i+1];
      if(Math.abs(x-xx)<1e-9)continue;
      const n=vertices.length/3;vertices.push(...point(x,y),...point(xx,yy),...point(xx,-.06),...point(x,-.06));
      indices.push(n,n+1,n+2,n,n+2,n+3);
    }
    return {t:'mesh',nm:`Motu / closed ramp end / ${c.nm} / ${index+1}`,p:[0,0,0],vertices,indices,
      solidSides:true,doubleSided:true,vert:false,tex:c.tex,color:c.color};
  });
}
