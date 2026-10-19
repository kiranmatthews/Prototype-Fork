import assert from 'node:assert/strict';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const code=await transform(await readFile('src/levels/jungle-minefield.ts','utf8'),{loader:'ts',format:'esm'});
const m=await import('data:text/javascript;base64,'+Buffer.from(code.code).toString('base64'));
const requested=process.argv.slice(2).map(Number),ids=requested.length?requested:[2,4,6,8,3,10,1,5,9,7];
await mkdir('/private/tmp/grove-traversal',{recursive:true});
for(const id of ids){
 const f=m.GROVE_FIELDS[id-1],startX=f.data.spots?.[0][0]??(id===6?-1.5:id===1?-3.6:0),start=[startX,.1,id===7?-f.clueAt-2:-f.start+9];
 let report={id};
 try{await withBlockworksRuntime(async r=>{
  r.stepFor(25);const p=r.p;
  const jump=(target)=>{
   const straightFoot=f.data.spots!==undefined;
   const secondJumpAt=(straightFoot?Math.abs(target[0]-p.pos.x)+Math.abs(target[2]-p.pos.z)>7:r.distanceTo(target)>8)?38:15;
   const steer=()=>{
    if(!straightFoot)return r.steerToward(target,{pace:Math.min(1,r.distanceTo(target)/.8)});
    // Ordinary cardinal taps: finish the lateral correction, then travel
    // forward. Tiny analog diagonals invoke the game's slower diagonal drive.
    const dx=target[0]-p.pos.x,dz=target[2]-p.pos.z;
    if(Math.abs(dx)>.12)return r.worldDirectionInput({x:dx,z:0},Math.min(1,Math.abs(dx)/.3));
    return Math.abs(dz)>.08?r.worldDirectionInput({x:0,z:dz},Math.min(1,Math.abs(dz)/.3)):{};
   };
   r.charge(26);r.releaseJump(steer());let t=0;
   r.until(()=>p.grounded,()=>{t++;return {...steer(),jumpHeld:t===secondJumpAt&&(straightFoot||r.distanceTo(target)>2)};},{maxFrames:180,label:'safe landing'});
   assert.ok(r.distanceTo(target)<1.3,'jump stopped short '+JSON.stringify({target,at:p.pos.toArray()}));r.stepFor(14);
  };
  if(f.data.spots){
   r.walkTo([startX,0,-f.start+.5],{pace:.2,arrivalTolerance:.45});
   let previous;
   for(const target of [...f.data.spots.map(([x,z])=>[x,0,z]),[f.data.spots.at(-1)[0],0,-f.end-1.5]]){
    // Use the safe disk as footing, including a small step toward the next
    // circle. Finish settling on each spot before loading the next foot jump.
    if(previous&&r.distanceTo(target)>8){
     const dx=target[0]-previous[0],dz=target[2]-previous[2],d=Math.hypot(dx,dz);
     r.walkTo([previous[0]+dx/d*.85,0,previous[2]+dz/d*.85],{pace:.15});
    }
    jump(target);r.walkTo(target,{pace:.15});previous=target;
   }
  }else if(id===6){
   r.until(()=>-p.pos.z>f.end+2,{moveY:1},{maxFrames:2400,label:'second-column run'});
  }else if(id===3){
   r.grindUntil(()=>-p.pos.z>f.end+3&&p.grounded,{buttons:{jumpHeld:true},maxFrames:2200,label:'complete curving rail'});
  }else if(id===1){
   r.grindUntil(()=>-p.pos.z>m.GROVE_FIRST_RAIL_BANK_END-5,{buttons:{jumpHeld:true},maxFrames:1200,label:'first safe rail'});
   r.stepFor(2,{moveX:1,moveY:0,jumpHeld:true,grindHeld:true});
   r.releaseJump({moveX:1,moveY:0,grindHeld:false});
   r.grindUntil(()=>-p.pos.z>f.end+3,{approachInput:()=>r.steerToward([0,m.GROVE_FIRST_RAIL_HEIGHT,-m.GROVE_FIRST_RAIL_BANK_END-8]),buttons:()=>({grindHeld:p.pos.x>-1.4}),maxFrames:1600,label:'transfer to second safe rail'});
  }else if(id===7){
   r.until(()=>-p.pos.z>f.start-2,{moveY:1,jumpHeld:true},{maxFrames:600,label:'unassisted ramp run-up'});
   r.releaseJump({moveY:1});r.until(()=>p.grounded&&-p.pos.z>f.end,{moveY:1},{maxFrames:300,label:'speed jump landing'});
  }else{
   const rows=id===5?m.GROVE_GRID_SAFE:id===9?m.GROVE_GRID9_SAFE:m.GROVE_GRID10_SAFE,depth=(f.end-f.start)/rows.length;
   const path=[];let col=rows[0][0];
   r.walkTo([-4.5+col*3,0,-f.start+2],{pace:.2,arrivalTolerance:.45});
   path.push([-4.5+col*3,0,-f.start-1]);
   for(let row=0;row<rows.length;row++){
    const allowed=rows[row],next=rows[row+1]??[col];
    if(!allowed.includes(col))col=allowed[0];
    const target=next.find(c=>allowed.includes(c))??allowed[0];
    path.push([-4.5+col*3,0,-f.start-(row+.5)*depth]);
    if(target!==col){col=target;path.push([-4.5+col*3,0,-f.start-(row+.5)*depth]);}
   }
   for(const target of path){if(r.l.crates.some(c=>c.tnt&&Math.hypot(c.mesh.position.x-target[0],c.mesh.position.z-target[2])<.4))target[0]-=1.15;}
   for(const target of path){
    if(Math.abs(target[0]-p.pos.x)>6.5&&Math.abs(target[2]-p.pos.z)<.4)jump([p.pos.x+Math.sign(target[0]-p.pos.x)*3,0,target[2]]);
    jump(target);
   }
   jump([-4.5+col*3,0,-f.end-3]);
  }
  if(!p.grounded)r.until(()=>p.grounded,{moveY:1,jumpHeld:true},{maxFrames:160,label:'land in safe camp'});
  assert.ok(-p.pos.z>f.end);assert.equal(p.totalDeaths,0);assert.ok(r.l.minefields.fields.every(f=>!f.detonated));
  report={id,pass:true,frames:r.frame,final:r.snapshot(),maxHeight:Math.max(...r.trace.map(t=>t.position[1]))};
  await writeFile(`/private/tmp/grove-traversal/${id}-inputs.json`,JSON.stringify({id,start,frames:r.trace.map(t=>t.input)}));
 },{modulePath:'/src/levels/jungle-minefield.ts',source:m=>m.JUNGLE_MINEFIELD_LEVEL,levelId:'jungle-minefield',start,maxFrames:6000,onTick:s=>{report.last=s;}});}catch(e){report.pass=false;report.error=String(e);process.exitCode=1;}
 await writeFile(`/private/tmp/grove-traversal/${id}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
