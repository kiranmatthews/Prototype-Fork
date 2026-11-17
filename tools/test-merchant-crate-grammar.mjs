import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runMerchantRoute} from './merchant-pilot.mjs';
const output=process.env.MERCHANT_OUTPUT||'/tmp/merchant-validation';await (await import('node:fs/promises')).mkdir(output,{recursive:true});
const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8')),data=pack.levels.find(e=>e.id==='drowned-crown').data,report={harvests:[],patrols:[]};
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),groups=new Map();
 assert.equal(l.crates.length,184);assert.equal(l.totalCrates,236);
 for(const b of l.crates){const spec=r.source.components[b.mesh.userData.editorIdx],nm=spec.nm.split(' ·')[0];if(!groups.has(nm))groups.set(nm,[]);groups.get(nm).push(b);}
 for(const [nm,boxes]of groups){const x=boxes[0].mesh.position.x,z=boxes[0].mesh.position.z,y=Math.min(...boxes.map(b=>b.box.min.y)),candidates=[];
  for(const [dx,dz]of [[0,2.5],[0,-2.5],[2.5,0],[-2.5,0],[0,1.8],[0,-1.8]]){ray.set(new THREE.Vector3(x+dx,y+2,z+dz),down);ray.far=4;const hit=l.raycastGround(ray)[0];if(hit&&Math.abs(hit.point.y-y)<.8){const q=hit.point.clone().add(new THREE.Vector3(0,.08,0));candidates.push({q,clearance:Math.min(...l.enemies.map(e=>e.group.position.distanceTo(q)))});}}
  candidates.sort((a,b)=>b.clearance-a.clearance);assert.ok(candidates.length,'supported approach '+nm);
  p.respawn(l,true,false,{position:candidates[0].q,heading:boxes[0].mesh.position.clone().sub(candidates[0].q).setY(0)});r.stepFor(20);
  try{r.until(()=>boxes.every(b=>!b.alive),()=>{const b=boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0];return {...r.steerToward(b.mesh.position,{pace:.3}),spinHeld:r.frame%24<12};},{maxFrames:1000,label:nm});assert.equal(p.totalDeaths,0);}
  catch(e){await writeFile(output+'/harvest-failure.json',JSON.stringify({name:nm,error:String(e),trace:r.trace.slice(-250)},null,2));throw e;}
  report.harvests.push({name:nm,count:boxes.length,deaths:p.totalDeaths});
 }
 p.respawn(l,true);assert.ok(l.crates.every(b=>b.alive));report.resetRestores=true;
 for(let f=0;f<600;f++){l.update(1/60);if(f%30)continue;for(const e of l.enemies){ray.set(new THREE.Vector3(e.group.position.x,e.baseY+2,e.group.position.z),down);ray.far=4;const hit=l.raycastGround(ray)[0];assert.ok(hit&&Math.abs(hit.point.y-e.baseY)<.65,'patrol floor '+e.kind);}}
 report.patrolProbes=260;report.enemies=l.enemies.map(e=>({kind:e.kind,p:e.group.position.toArray()}));
 await writeFile(output+'/grammar.json',JSON.stringify(report,null,2));
 if(process.env.MERCHANT_SKIP_ROUTE)return;
 p.respawn(l,true);r.report={stage:'spawn',actions:[],evidence:[]};
 try{const result=runInputPilot(r,runMerchantRoute);await writeFile(output+'/journey.json',JSON.stringify(result,null,2));console.log('PASS continuous route',result.state,result.deaths);}
 catch(e){await writeFile(output+'/route-failure.json',JSON.stringify({error:String(e),report:r.report,trace:r.trace.slice(-300)},null,2));throw e;}
},{modulePath:'/src/levels/pirate-wreck.ts',source:()=>data,levelId:'drowned-crown',maxFrames:150000,allowCheckpointTrips:true});
console.log('PASS 55 cargo harvests and patrol support');
