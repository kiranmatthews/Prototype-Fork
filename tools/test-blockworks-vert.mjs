import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const k=2*Math.PI/660,point=s=>[66*Math.sin(k*s)-18*Math.sin(2*k*s),.02,20-s];
const all=[];
const cases=[...[790,826,874,900].flatMap(focus=>[-1,1].map(firstSide=>({focus,firstSide,held:false,along:0}))),
 ...[-1,1].map(firstSide=>({focus:826,firstSide,held:true,along:0})),
 ...[-1,1].map(firstSide=>({focus:874,firstSide,held:false,along:.2}))];
for(const {focus,firstSide,held,along} of cases){
 const result=await withBlockworksRuntime(r=>{
  const {p,sourceModule:m}=r;let side=firstSide,released=false,current=null;const airs=[],normal=m.routeTangent(focus);const tuningBefore=JSON.stringify(r.TUNING);
  const pipe=r.source.components.find(c=>c.t==='vertramp'&&c.grp===13);
  assert.equal(pipe.arc,90);assert.equal(pipe.arcSteps,24);
  for(let frame=0;frame<1400&&airs.length<4;frame++){
   if(p.isBailing||p.state==='dead')break;
   let input=current?{jumpHeld:p.vVel<0}:{};
   if(!current){const release=!held&&!released&&p.pos.y>2&&p.groundHit?.normal.y<.45;input={...r.worldDirectionInput({x:-normal[2]*side+normal[0]*along,z:normal[0]*side+normal[2]*along}),jumpHeld:!release&&!released,jumpReleased:release};if(release)released=true;}
   r.tick(input);
   if(!current&&!p.grounded&&(p.vertAir||p.pipeHang))current={side,peak:p.pos.y,frames:0};
   if(current){current.frames++;current.peak=Math.max(current.peak,p.pos.y);if(p.grounded){airs.push(current);current=null;side*=-1;released=false;}}
  }
  assert.equal(airs.length,4,`four successive airs at ${focus}, side ${firstSide}, held ${held}, along ${along}`);
  assert.ok(airs.every(a=>a.frames>=45&&a.peak>5),'each air must provide useful hangtime');
  // Angled approaches spend speed carving along the curve; only the
  // direct wall-to-wall pump is expected to gain four metres.
  if(along===0)assert.ok(airs.at(-1).peak>airs[0].peak+4,'successive wall pumps must build height');
  assert.ok(r.trace.every(t=>!t.bailing&&t.deaths===0&&t.state!=='dead'),'airs must not trip or die');
  assert.ok(p.grounded&&p.freeSkate,'return mounted onto the transition');
  assert.equal(JSON.stringify(r.TUNING),tuningBefore,'global tuning must remain unchanged');
  return{focus,firstSide,held,along,airs,end:r.snapshot(),trace:r.trace};
 },{start:point(focus),maxFrames:1400});
 all.push(result);console.log(JSON.stringify({focus,firstSide,held,along,airs:result.airs}));
}
if(process.env.VERT_OUTPUT)await writeFile(process.env.VERT_OUTPUT,JSON.stringify(all));
console.log('PASS 48 successive Blockworks vert airs: both walls, four curve positions, held/released charge and oblique approaches');
