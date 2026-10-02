import {withBlockworksRuntime} from './blockworks-runner.mjs';
// The authoring coordinates are a read-only view of the real winding level.
// Inputs are rotated into the production camera frame; physics, crate state,
// velocity, hit budgets and collision geometry always remain world-space.
export async function withTempleRuntime(run,options){
 let route;const config={...options,source:m=>{
  route=m.JUNGLE_SEQUEL_ROUTES.find(r=>r.id===options.levelId);
  if(options.start)config.start=route.toWorld(...options.start);
  return route.data;
 },controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z}};
 return withBlockworksRuntime(async real=>{
  const vec=p=>new real.THREE.Vector3(...route.toLocal(p.toArray()));
  const objects=new WeakMap();
  const crate=c=>{
   if(objects.has(c))return objects.get(c);
   const mesh=new Proxy(c.mesh,{get(o,k){if(k==='position')return vec(o.position);const v=o[k];return typeof v==='function'?v.bind(o):v;}});
   const wrapper=new Proxy(c,{get(o,k){if(k==='mesh')return mesh;if(k==='__real')return o;return o[k];}});objects.set(c,wrapper);return wrapper;
  };
  const p=new Proxy(real.p,{get(o,k){if(k==='pos')return vec(o.pos);const v=o[k];return typeof v==='function'?v.bind(o):v;}});
  const l=new Proxy(real.l,{get(o,k){if(k==='crates')return o.crates.map(crate);const v=o[k];return typeof v==='function'?(...args)=>v.apply(o,args.map(a=>a?.__real??a)):v;}});
  const tick=sample=>{
   const f=route.frameAt(route.toLocal(real.p.pos.toArray())[0]),cam=real.p.courseInputDirection(real.l)??{x:real.p.camDir.x,z:real.p.camDir.z};
   real.p.camDir.set(cam.x,0,cam.z);
   const mx=sample.moveX??0,my=sample.moveY??0,dx=f.fx*mx+f.fz*my,dz=f.fz*mx-f.fx*my;
   return real.tick({...sample,moveX:dx*-cam.z+dz*cam.x,moveY:dx*cam.x+dz*cam.z});
  };
  const r={...real,p,l,source:{...route.data,components:route.sourceComponents},tick,stepFor:(n,s={})=>{for(let i=0;i<n;i++)tick(s);},get frame(){return real.frame;}};
  return run(r);
 },config);
}
