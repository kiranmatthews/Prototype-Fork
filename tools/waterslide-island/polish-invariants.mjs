import {createHash} from 'node:crypto';

// Visual materials, painted trim and non-colliding plants do not participate.
// Existing ground/side contacts, routes, gaps and race configuration do.
const keys=['t','dkind','p','s','pts','vertices','indices','normals','solid','scenerySolid','slip','edgeGrinding','vert','swimDepth','outOfBounds','lethal','invisible','to','len','w','rise','amp','axis','speed','cycle','phase','kind','yaw','arc','deck','curve','bank','gravityTrack','smoothCollision','openFloor'];
export function physicalFingerprint(source){
 const components=source.components.filter(c=>!(c.t==='decor'&&c.scenerySolid===false)&&!(c.t==='mesh'&&c.solid===false&&c.scenerySolid!==true));
 const data={spawn:source.spawn,killY:source.killY,cameraRig:source.cameraRig,skateRace:source.skateRace,
  components:components.map(c=>Object.fromEntries(keys.filter(k=>c[k]!==undefined).map(k=>[k,c[k]])))};
 // V8 versions differ in the final bits of trigonometric source coordinates.
 // Compare at one micrometre, far below any authored contact adjustment.
 return {components:components.length,sha256:createHash('sha256').update(JSON.stringify(data,(_key,value)=>
  typeof value==='number'?Math.round(value*1e6)/1e6:value)).digest('hex')};
}
