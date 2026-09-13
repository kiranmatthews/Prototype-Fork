import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';
const harness=await readFile(new URL('../validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try{
 const {Level}=await server.ssrLoadModule('/src/level.ts');
 const {CARLISLE_COAST_LEVEL:d,CARLISLE_ORIGINAL_INDICES:ids}=await server.ssrLoadModule('/src/levels/carlisle-coast.ts');
 const l=new Level(new THREE.Scene(),{id:'rail-audit',name:d.name,data:d});l.root.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(),rows=[];
 for(const r of l.rails.filter(r=>r.object.userData.cityRail)){
  let min=Infinity,at=null,hits=0;
  for(let t=0;t<=r.totalLength;t+=.5){const p=r.pointAt(t);ray.set(new THREE.Vector3(p.x,p.y+3,p.z),new THREE.Vector3(0,-1,0));ray.far=6;const h=ray.intersectObjects(l.groundMeshes,false)[0];if(h){hits++;const clear=p.y+.09-h.point.y;if(clear<min){min=clear;at=p.toArray();}}}
  rows.push({original:ids[r.object.userData.editorIdx],minClearance:Math.round(min*1000)/1000,at,hits});
 }
 console.log(JSON.stringify(rows,null,2));l.dispose();
}finally{await server.close();}
