import type {CustomComponent} from '../level';
type P=[number,number,number];
type Triangle={p:P[];minX:number;maxX:number;minZ:number;maxZ:number};

/** Author-time triangle sampling, not an approximate height plane. Plants and
 * small dressing rest on the exact same native surface the player sees. */
export function creekSurfaceQuery(components:readonly CustomComponent[]){
 const cells=new Map<string,Triangle[]>(),size=16;
 for(const c of components)if(c.t==='mesh'&&c.vertices&&c.indices)for(let i=0;i<c.indices.length;i+=3){
  const p=c.indices.slice(i,i+3).map(id=>[c.vertices![id*3]+c.p[0],c.vertices![id*3+1]+c.p[1],c.vertices![id*3+2]+c.p[2]] as P);
  const cross=(p[1][0]-p[0][0])*(p[2][2]-p[0][2])-(p[2][0]-p[0][0])*(p[1][2]-p[0][2]);
  if(cross>=-.0001)continue;
  const t={p,minX:Math.min(...p.map(v=>v[0])),maxX:Math.max(...p.map(v=>v[0])),minZ:Math.min(...p.map(v=>v[2])),maxZ:Math.max(...p.map(v=>v[2]))};
  for(let x=Math.floor(t.minX/size);x<=Math.floor(t.maxX/size);x++)for(let z=Math.floor(t.minZ/size);z<=Math.floor(t.maxZ/size);z++){
   const key=`${x}:${z}`,list=cells.get(key)??[];list.push(t);cells.set(key,list);
  }
 }
 return(point:P,tolerance=1.2):number|null=>{
  const [x,y,z]=point;let best:number|null=null,distance=tolerance;
  for(const t of cells.get(`${Math.floor(x/size)}:${Math.floor(z/size)}`)??[]){
   if(x<t.minX||x>t.maxX||z<t.minZ||z>t.maxZ)continue;
   const [a,b,c]=t.p,det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
   const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
   const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det,w=1-u-v;
   if(Math.min(u,v,w)<-.0001)continue;const hit=u*a[1]+v*b[1]+w*c[1],d=Math.abs(hit-y);
   if(d<distance){distance=d;best=hit;}
  }return best;
 };
}
