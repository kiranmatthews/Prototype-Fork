// Isolate the production grounded-spin solve, including changing support,
// contacts and incoming rotation. Optional snapshots leave the checkout alone.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';
const snapshot = process.argv.find(arg => arg.startsWith('--source-snapshot='))?.split('=').slice(1).join('=');
const server = await createServer({ appType:'custom', logLevel:'silent', server:{middlewareMode:true}, plugins:snapshot?[{
  name:'ground-spin-snapshot', enforce:'pre', async load(id) {
    const rel=path.relative(process.cwd(),id.split('?')[0]);
    if(rel==='src/character/bailGroundContact.ts')return readFile(path.join(snapshot,rel),'utf8');
  },
}]:[] });
try {
  const {stepBailGroundSpin}=await server.ssrLoadModule('/src/character/bailGroundContact.ts');
  const spin=new THREE.Vector3(),velocity=new THREE.Vector3(),normal=new THREE.Vector3(),contact=new THREE.Vector3();
  const cases=Array.from({length:36},(_,i)=>({spin:[Math.sin(i)*12,Math.cos(i)*4,Math.sin(i*.7)*8],
    velocity:[Math.sin(i)*9,0,-10],normal:new THREE.Vector3(Math.sin(i)*.3,1,Math.cos(i)*.4).normalize().toArray(),
    contact:[Math.sin(i)*.6,-.5,Math.cos(i)*.3]}));
  const samples=[];let checksum=0;
  for(let trial=-8;trial<9;trial++) {
    const start=performance.now();
    for(let i=0;i<30000;i++) {
      const c=cases[i%cases.length];spin.fromArray(c.spin);velocity.fromArray(c.velocity);normal.fromArray(c.normal);contact.fromArray(c.contact);
      stepBailGroundSpin(spin,velocity,normal,contact,1/60,14,1);checksum+=spin.x;
    }
    if(trial>=0)samples.push((performance.now()-start)/30000);
  }
  samples.sort((a,b)=>a-b);
  console.log(JSON.stringify({source:snapshot??'current',scope:'Grounded angular contact solve plus reusable input setup; local Node CPU only, 9 x 30000 warm samples.',
    medianStepMs:samples[4],samples,checksum},null,2));
} finally {await server.close();}
