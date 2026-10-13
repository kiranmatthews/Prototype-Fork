/** Portable measured route for browser QA against a production build. */
export function hydrateTempleRoute(descriptor){
 const {frames,step}=descriptor;
 const frameAt=s=>{
  const q=Math.max(0,Math.min(frames.length-1,(s+20)/step)),i=Math.min(frames.length-2,Math.floor(q)),t=q-i;
  const a=frames[i],b=frames[i+1],blend=k=>a[k]+(b[k]-a[k])*t;
  const fx=blend('fx'),fz=blend('fz'),length=Math.hypot(fx,fz)||1;
  return {x:blend('x'),z:blend('z'),fx:fx/length,fz:fz/length,scale:blend('scale'),yaw:Math.atan2(-fz,fx)*180/Math.PI};
 };
 const toWorld=(s,y,side=0)=>{const f=frameAt(s);return[f.x-f.fz*side,y,f.z+f.fx*side];};
 const toLocal=p=>{
  let best=0,cost=Infinity;
  for(let i=0;i<frames.length;i+=Math.round(1/step)){const q=frames[i],d=(p[0]-q.x)**2+(p[2]-q.z)**2+(p[1]-q.y)**2*.65;if(d<cost){cost=d;best=i;}}
  const s=best*step-20,f=frameAt(s),dx=p[0]-f.x,dz=p[2]-f.z;
  return[s+(dx*f.fx+dz*f.fz)/f.scale,p[1],-dx*f.fz+dz*f.fx];
 };
 return {...descriptor,frameAt,toWorld,toLocal};
}
