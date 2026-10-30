/** Remove crossed boundary edges without moving or dropping authored vertices.
 * Wide offset ribbons can fold at tight inner bends. Reversing the crossed
 * span retains their boundary samples and bounds while producing a simple loop. */
export function uncrossOutline(points: [number, number][]): [number, number][] {
  const result = points.map(point => [...point] as [number, number]);
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for (let pass=0;pass<result.length*result.length;pass++) {
    let changed=false;
    for (let i=0;i<result.length&&!changed;i++) for(let j=i+2;j<result.length;j++) {
      if(i===0&&j===result.length-1)continue;
      const a=result[i],b=result[(i+1)%result.length],c=result[j],d=result[(j+1)%result.length];
      if(cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) {
        result.splice(i+1,j-i,...result.slice(i+1,j+1).reverse());changed=true;break;
      }
    }
    if(!changed)return result;
  }
  throw new Error('Authored outline could not be uncrossed');
}
