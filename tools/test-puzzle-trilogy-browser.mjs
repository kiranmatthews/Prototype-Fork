import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const playwright=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(playwright);
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5173';
const full=process.argv.includes('--full');
const selected=process.argv.find(a=>a.startsWith('--level='))?.slice(8);
const ids=selected?[selected]:['crate-primer','switchyard','clockwork-gauntlet'];
const output=process.env.PUZZLE_BROWSER_OUTPUT||join(tmpdir(),'puzzle-trilogy-browser');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const reports=[];
try {
  for(const id of ids) {
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto(new URL(`?playtest&level=${id}${full?'':'&lite'}`,base).href);
    try {await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});}
    catch(error) {
      console.log(JSON.stringify({id,errors,loading:await page.evaluate(()=>({ready:!!window.__game,
        diagnostics:window.__game?.getLoadingDiagnostics?.(),body:document.body.innerText.slice(0,400)}))}));
      throw error;
    }
    await page.evaluate(async id=>{
      const g=window.__game,l=g.getLevel(),p=g.player;
      const m=await import('/src/levels/puzzle-trilogy.ts');
      const {CONST}=await import('/src/tuning.ts');
      const {runPuzzleJourney}=await import('/tools/puzzle-trilogy-pilot.mjs');
      const report=window.puzzleReview={id,frame:0,done:false,failed:null,stage:'start',trace:[],actions:[],evidence:[],framing:[],previews:[]};
      const fields=['moveX','moveY','jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed','grabHeld','grabPressed','transferHeld','transferPressed','restartPressed'];
      let last={},advanced=false;
      const normalize=sample=>{
        const input=Object.fromEntries(fields.map(key=>[key,key==='moveX'||key==='moveY'?0:false]));Object.assign(input,sample);
        const length=Math.hypot(input.moveX,input.moveY);if(length>1){input.moveX/=length;input.moveY/=length;}
        input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
        for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){
          const pressed=held.replace('Held','Pressed');if(!(pressed in sample))input[pressed]=!!input[held]&&!last[held];
        }
        if(!('jumpReleased' in sample))input.jumpReleased=!input.jumpHeld&&!!last.jumpHeld;
        return input;
      };
      const snapshot=()=>({frame:report.frame,position:p.pos.toArray(),state:p.state,grounded:p.grounded,
        speed:p.speed,verticalSpeed:p.vVel,bailing:p.isBailing,deaths:p.totalDeaths,gemEarned:p.gemEarned,ground:p.groundHit?.name,
        mover:p.groundHit?.moverId??null,input:{...last},
        ...(p.pos.x>210?{masks:p.masks,playerBounds:{min:p.playerBox.min.toArray(),max:p.playerBox.max.toArray()},
          projectiles:l.projectiles.filter(shot=>Math.abs(shot.mesh.position.x-p.pos.x)<24)
            .map(shot=>({position:shot.mesh.position.toArray(),velocity:shot.vel.toArray(),min:shot.box.min.toArray(),max:shot.box.max.toArray()}))}:{}),
      });
      const context={id,p,l,sourceModule:m,source:m.PUZZLE_LEVELS.find(e=>e.id===id).data,
        dt:CONST.fixedStep,TUNING:g.TUNING,report,trace:report.trace,get frame(){return report.frame;}};
      const generator=runPuzzleJourney(context);let pending=generator.next();
      const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
      p.step=(dt,input,level)=>{
        if(report.done)return;
        try{last=normalize(pending.value??{});Object.assign(input,last);step(dt,input,level);advanced=true;}
        catch(error){report.failed={message:String(error),snapshot:snapshot()};report.done=true;}
      };
      p.commitRenderStep=(...args)=>{
        commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;report.trace.push(snapshot());
        try{pending=generator.next();if(pending.done){report.done=true;report.result=pending.value;report.end=snapshot();}}
        catch(error){report.failed={message:String(error),snapshot:snapshot()};report.done=true;}
      };
      // Project the live character mesh after the actual renderer updated its
      // matrices. This includes skinned/morphed vertices and board geometry.
      const vertex=p.pos.clone(),instance=g.camera.matrixWorld.clone(),world=instance.clone();let lastFrame=-30;
      const render=g.renderer.render.bind(g.renderer);
      g.renderer.render=(scene,camera)=>{
        const result=render(scene,camera);
        if(scene!==g.scene||camera!==g.camera||report.done||report.frame-lastFrame<15)return result;
        lastFrame=report.frame;const rider=p.riderRef;if(!rider)return result;
        rider.updateWorldMatrix(true,true);let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity,vertices=0,behind=0;
        const visit=node=>{
          if(node!==rider&&!node.visible)return;
          if(node.isMesh&&!node.userData.characterRenderProxy){
            const materials=Array.isArray(node.material)?node.material:[node.material],positions=node.geometry.getAttribute('position');
            if(positions&&materials.some(material=>material.visible&&material.opacity>0)){
              if(node.isSkinnedMesh)node.skeleton.update();
              for(let item=0;item<(node.isInstancedMesh?node.count:1);item++){
                world.copy(node.matrixWorld);if(node.isInstancedMesh){node.getMatrixAt(item,instance);world.multiply(instance);}
                for(let i=0;i<positions.count;i++){
                  node.getVertexPosition(i,vertex).applyMatrix4(world).project(camera);vertices++;
                  minY=Math.min(minY,vertex.y);maxY=Math.max(maxY,vertex.y);minX=Math.min(minX,vertex.x);maxX=Math.max(maxX,vertex.x);
                  if(vertex.z>1)behind++;
                }
              }
            }
          }
          for(const child of node.children)visit(child);
        };
        visit(rider);
        report.framing.push({frame:report.frame,x:p.pos.x,y:p.pos.y,state:p.state,grounded:p.grounded,minY,maxY,minX,maxX,vertices,behind});
        if(p.grounded&&/takeoff|approach/.test(report.stage)) {
          const specs=context.source.components.filter(component=>['crate','metal','outline'].includes(component.t));
          for(let i=0;i<specs.length;i++) {
            const component=specs[i],box=l.crates[i];
            if(!box?.alive||Math.abs(box.mesh.position.x-p.pos.x)>16||box.box.min.y-p.pos.y<3)continue;
            vertex.copy(box.mesh.position).project(camera);
            report.previews.push({frame:report.frame,name:component.nm,position:box.mesh.position.toArray(),
              player:p.pos.toArray(),ndc:vertex.toArray()});
          }
        }
        return result;
      };
    },id);
    const captured=new Set();
    for(let poll=0;poll<1800;poll++) {
      await page.waitForTimeout(250);
      const state=await page.evaluate(()=>({done:window.puzzleReview.done,stage:window.puzzleReview.stage,
        frame:window.puzzleReview.frame,x:window.__game.player.pos.x,y:window.__game.player.pos.y}));
      const bucket=Math.floor(state.x/(id==='crate-primer'?50:id==='switchyard'?67:84));
      if(!captured.has(bucket)&&bucket>=0&&bucket<=2&&state.frame>30){
        await page.screenshot({path:`${output}/${id}-${bucket}-${full?'full':'lite'}.png`});captured.add(bucket);
      }
      if(state.y>6&&!captured.has('high')) {
        await page.screenshot({path:`${output}/${id}-high-room-${full?'full':'lite'}.png`});captured.add('high');
      }
      if(poll%120===0)console.log(JSON.stringify({id,...state}));
      if(state.done)break;
    }
    const report=await page.evaluate(()=>window.puzzleReview);
    await writeFile(`${output}/${id}-${full?'full':'lite'}.json`,JSON.stringify({...report,errors},null,2));
    await page.screenshot({path:`${output}/${id}-finish-${full?'full':'lite'}.png`});
    console.log(JSON.stringify({id,done:report.done,frame:report.frame,failed:report.failed,end:report.end,errors}));
    assert.equal(report.done,true,`${id} browser pilot timed out`);
    assert.equal(report.failed,null,`${id} browser assertions failed: ${JSON.stringify(report.failed)}`);
    assert.equal(report.end.state,'finished',`${id} did not reach the real finish gate`);
    assert.equal(report.result.bonusCrates,0,`${id} main-route pilot unexpectedly received bonus crates`);
    assert.equal(report.end.gemEarned,report.result.bonusCrateTotal===0,`${id} main-route clear did not respect its linked-bonus gem requirement`);
    assert.equal(report.result.cratesBroken,report.result.activeStageCrates,`${id} left a main-route crate`);
    assert.ok(report.framing.length>20,`${id} has insufficient live rendered-rider framing evidence`);
    const sampled=report.framing.filter(row=>row.vertices>100&&row.frame>45);
    assert.ok(sampled.every(row=>row.behind===0&&row.minX>-1.1&&row.maxX<1.1),`${id} rider leaves horizontal view`);
    const cropped=sampled.filter(row=>row.minY< -1.12||row.maxY>1.12);
    assert.ok(cropped.length<=2,`${id} rendered rider cropped vertically: ${JSON.stringify(cropped)}`);
    assert.deepEqual(errors,[],`${id} browser console errors`);
    assert.ok(report.previews.length>3,`${id} has no high puzzle-target preview evidence`);
    assert.ok(report.previews.every(row=>Math.abs(row.ndc[0])<1.12&&Math.abs(row.ndc[1])<1.12&&row.ndc[2]<1),
      `${id} hides an upper puzzle target before takeoff: ${JSON.stringify(report.previews.filter(row=>Math.abs(row.ndc[0])>=1.12||Math.abs(row.ndc[1])>=1.12))}`);
    reports.push({id,frames:report.frame,result:report.result,framing:sampled.length,previewSamples:report.previews.length,errors});
    await page.close();
  }
  console.log(JSON.stringify({mode:full?'full':'lite',reports},null,2));
  console.log('PASS real Chrome input-only trilogy main-route clears, linked-bonus reward requirement, rider framing and error-free finish');
} finally {await browser.close();}
