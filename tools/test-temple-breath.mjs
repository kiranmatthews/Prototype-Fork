import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
 const {TempleBreath,templeTikiPhase}=await server.ssrLoadModule('/src/templeBreath.ts');
 const {puffs}=await server.ssrLoadModule('/src/puffs.ts');
 const make=()=>{const breath=new TempleBreath(7.1,7.8,0,28);new THREE.Group().add(breath);return breath;};
 const a=make(),b=make();
 const visible=effect=>{const p=effect.flames.geometry.attributes.position,c=effect.flames.geometry.attributes.color,out=[];for(let i=0;i<p.count;i++)if(c.getW(i)>.01)out.push(p.getX(i),p.getY(i),p.getZ(i),c.getW(i));return out;};
 const positionBuffer=a.flames.geometry.attributes.position.array,colorBuffer=a.flames.geometry.attributes.color.array;
 for(let frame=0;frame<=756;frame++){const t=frame/120;a.update(t,templeTikiPhase(t),true);}
 b.update(6.3,templeTikiPhase(6.3),true);
 assert.deepEqual(visible(a),visible(b),'flame geometry must agree after a direct seek and 120Hz stepping');
 assert.ok(a.diagnostics.flames>5&&a.diagnostics.hotContacts>0&&a.diagnostics.embers>0);
 const emissions=a.diagnostics.smokeEmissions;a.update(6.3,templeTikiPhase(6.3),true);assert.equal(a.diagnostics.smokeEmissions,emissions,'paused time must not emit another smoke puff');
 const minZ=t=>{a.update(t,templeTikiPhase(t),true);const p=a.flames.geometry.attributes.position,c=a.flames.geometry.attributes.color;let z=Infinity;for(let i=0;i<p.count;i++)if(c.getW(i)>.01)z=Math.min(z,p.getZ(i));return z;};
 const early=minZ(6.92),late=minZ(7.08);assert.ok(late>early+.5,'cutoff must move the trailing flames away from the mouth, never retract them');
 assert.ok(early>1.3,'the mouth clears first after fuel stops');
 a.update(7.6,templeTikiPhase(7.6),true);assert.equal(a.diagnostics.flames,0);assert.ok(a.diagnostics.embers>0,'embers should outlive the hot flames');assert.ok(a.boxes.every(box=>box.isEmpty()),'cooling embers and smoke must be harmless');
 a.update(8.5,templeTikiPhase(8.5),true);assert.equal(a.diagnostics.embers,0,'embers must settle finitely');
 assert.equal(a.flames.geometry.attributes.position.array,positionBuffer);assert.equal(a.flames.geometry.attributes.color.array,colorBuffer);
 for(const mesh of [a.flames,a.embers])for(const attr of Object.values(mesh.geometry.attributes))assert.ok([...attr.array].every(Number.isFinite));
 for(const effect of [a,b])for(const mesh of [effect.flames,effect.embers]){mesh.geometry.dispose();mesh.material.dispose();}puffs.clear();
 console.log(JSON.stringify({pass:true,deterministic:true,cutoffTailZ:[early,late],drawCallsPerTiki:2,flameVertices:positionBuffer.length/3}));
}finally{await server.close();}
