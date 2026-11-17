import assert from 'node:assert/strict';
import {mkdir,writeFile}from'node:fs/promises';
import {withBlockworksRuntime}from'./blockworks-runner.mjs';
const report={bridges:[]},out=process.env.CARLISLE_CRATE_OUTPUT||'/tmp/carlisle-crates';
await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const{l,p,THREE,sourceModule:m,source}=r;
 for(const b of m.CARLISLE_RELAY_CARGO)for(const metal of [false,true]){
  p.respawn(l,true);l.update(0);
  const crates=l.crates.filter(c=>source.components[c.mesh.userData.editorIdx].nm?.startsWith(b.name+' · '+(metal?'durable spine':'grind parcel')));
  const first=crates.reduce((a,c)=>c.mesh.position.z>a.mesh.position.z?c:a),last=crates.reduce((a,c)=>c.mesh.position.z<a.mesh.position.z?c:a);
  const x=first.mesh.position.x+(metal?.5:-.5),y=b.baseY,z=first.box.max.z+3.0;
  p.respawn(l,true,false,{position:new THREE.Vector3(x,y+.1,z),heading:new THREE.Vector3(0,0,-1)});
  let caught=false,grindFrames=0,done=false,charge=0,wasGround=false,samples=[];
  const brokenBefore=p.cratesBroken;
  for(let f=0;f<1200;f++){
   if(p.grounded&&p.pos.z<last.box.min.z-.5){done=true;break;}
   const q=new THREE.Vector3(x,y,Math.min(last.box.min.z-2,p.pos.z-6));
   let input=r.steerToward(q,{pace:1});
   if(p.state==='grind'){
    caught||=l.isCrateRail(p.grindRail);grindFrames++;
    input={moveY:1,moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)),grindHeld:true};charge=0;
   }else{
    if(p.grounded&&!wasGround)charge=26;
    if(f===0)charge=26;
    if(charge>0){input={...input,moveX:0,moveY:0,jumpHeld:charge>1};charge--;}
    else input.grindHeld=true;
   }
   wasGround=p.grounded;r.tick(input);
   if(f%15===0)samples.push({f,position:p.pos.toArray(),state:p.state,ground:p.surfaceName,grind:p.grindRail?.points.map(v=>v.toArray()).filter((_,i)=>i===0),input});
   if(p.totalDeaths||p.isBailing)break;
  }
  const row={name:b.name,metal,done,caught,grindFrames,broken:p.cratesBroken-brokenBefore,deaths:p.totalDeaths,bailing:p.isBailing,end:p.pos.toArray(),first:first.mesh.position.toArray(),last:last.mesh.position.toArray(),samples};
  report.bridges.push(row);console.log(JSON.stringify({...row,samples:undefined}));
 }
},{modulePath:'/src/levels/carlisle-tidal-relay.ts',levelId:'carlisle-coast',source:m=>m.CARLISLE_TIDAL_RELAY_LEVEL,allowCheckpointTrips:true});
await writeFile(out+'/bridges.json',JSON.stringify(report,null,2)+'\n');
assert.ok(report.bridges.every(r=>r.done&&r.caught&&r.grindFrames>12&&!r.deaths&&!r.bailing),'all bridge approaches must work');
console.log('PASS native approaches across three cargo bridges and durable steel spines');
