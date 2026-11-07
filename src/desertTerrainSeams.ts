type TerrainArrays={vertices:number[];indices:number[];normals:number[];uvs:number[];colors:number[]};
/** Adjacent terrain regions have different fixed grids. Give their common
 * edges the same two-metre polyline instead of hiding T-junctions with skirts. */
export function stitchDesertTerrain(
  data:TerrainArrays,origin:readonly number[],ground:(x:number,z:number)=>number,
):void {
  const {vertices,indices,normals,uvs,colors}=data;
  const same=(a:number,b:number)=>Math.abs(a-b)<.001;
  const shared=(a:number,b:number)=>{
    const ax=vertices[a*3]+origin[0],az=vertices[a*3+2]+origin[2];
    const bx=vertices[b*3]+origin[0],bz=vertices[b*3+2]+origin[2];
    return same(ax,bx)&&[-300,100,300].some(x=>same(ax,x))
      ||same(az,bz)&&[-2144,-2400,-4000].some(z=>same(az,z));
  };
  const edgeCache=new Map<string,number[]>(),next:number[]=[];
  const normalAt=(index:number)=>{
    const x=vertices[index*3]+origin[0],z=vertices[index*3+2]+origin[2];
    const nx=ground(x-.5,z)-ground(x+.5,z),nz=ground(x,z-.5)-ground(x,z+.5);
    const length=Math.hypot(nx,1,nz);normals[index*3]=nx/length;normals[index*3+1]=1/length;normals[index*3+2]=nz/length;
  };
  const edge=(a:number,b:number)=>{
    if(!shared(a,b))return [a];
    normalAt(a);normalAt(b);
    const key=`${Math.min(a,b)}:${Math.max(a,b)}`,cached=edgeCache.get(key);
    if(cached){const points=a<b?cached:cached.slice().reverse();return points.slice(0,-1);}
    const lo=Math.min(a,b),hi=Math.max(a,b),points=[lo];
    const steps=Math.round(Math.hypot(vertices[lo*3]-vertices[hi*3],vertices[lo*3+2]-vertices[hi*3+2])/2);
    for(let i=1;i<steps;i++){
      const t=i/steps,index=vertices.length/3;
      const x=vertices[lo*3]*(1-t)+vertices[hi*3]*t,z=vertices[lo*3+2]*(1-t)+vertices[hi*3+2]*t;
      vertices.push(x,ground(x+origin[0],z+origin[2])-origin[1],z);
      for(let k=0;k<3;k++){normals.push(0);colors.push(colors[lo*3+k]*(1-t)+colors[hi*3+k]*t);}
      for(let k=0;k<2;k++)uvs.push(uvs[lo*2+k]*(1-t)+uvs[hi*2+k]*t);
      normalAt(index);points.push(index);
    }
    points.push(hi);edgeCache.set(key,points);
    return (a<b?points:points.slice().reverse()).slice(0,-1);
  };
  for(let i=0;i<indices.length;i+=3){
    const [a,b,c]=indices.slice(i,i+3),polygon=[...edge(a,b),...edge(b,c),...edge(c,a)];
    if(polygon.length===3){next.push(a,b,c);continue;}
    const center=vertices.length/3;
    for(let k=0;k<3;k++){
      vertices.push((vertices[a*3+k]+vertices[b*3+k]+vertices[c*3+k])/3);
      normals.push((normals[a*3+k]+normals[b*3+k]+normals[c*3+k])/3);
      colors.push((colors[a*3+k]+colors[b*3+k]+colors[c*3+k])/3);
    }
    for(let k=0;k<2;k++)uvs.push((uvs[a*2+k]+uvs[b*2+k]+uvs[c*2+k])/3);
    for(let j=0;j<polygon.length;j++)next.push(center,polygon[j],polygon[(j+1)%polygon.length]);
  }
  data.indices.splice(0,data.indices.length,...next);
}
