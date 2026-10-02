import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(argument=>/^https?:/.test(argument))||'http://127.0.0.1:5173';
const output=process.env.PUZZLE_BROWSER_OUTPUT||'/private/tmp/puzzle-trilogy-browser';
await mkdir(output,{recursive:true});
const cases=[
  {id:'crate-primer',name:'upper-reward',start:[33.3,.65,0],targets:[[35,9.8]]},
  {id:'crate-primer',name:'high-key',start:[61.3,.65,0],targets:[[67,8],[69,8],[72,8]]},
  {id:'switchyard',name:'finite-cap',start:[7.2,.12,0],targets:[[5,9]]},
  {id:'switchyard',name:'fuse-cap',start:[98.8,2.9,0],targets:[[101,11.8]]},
  {id:'switchyard',name:'return-row',start:[132.5,2.9,0],targets:[[140,12.4],[142,12.4],[144,12.4]]},
  {id:'clockwork-gauntlet',name:'high-green',start:[214.3,4.1,0],targets:[[221,12.4]]},
  {id:'clockwork-gauntlet',name:'upper-return',start:[159.7,4.1,0],targets:[[165,13.6],[167,13.6],[168,13.6]]},
  {id:'clockwork-gauntlet',name:'final-return',start:[217.7,4.1,0],targets:[[201,13.6],[204,13.6],[208,13.6]]},
];
const browser=await chromium.launch({headless:true,channel:'chrome'}),reports=[];
try {
  for(const id of [...new Set(cases.map(probe=>probe.id))]) {
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto(new URL(`?playtest&level=${id}`,base).href);
    await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
    for(const probe of cases.filter(probe=>probe.id===id)) {
      // Each composition begins with a single placement to isolate the view.
      // These are visibility checks; continuous gameplay is tested separately.
      await page.evaluate(start=>{
        const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...start)});
      },probe.start);
      await page.waitForTimeout(800);
      const report=await page.evaluate(async probe=>{
        const g=window.__game,p=g.player,l=g.getLevel(),source=(await import('/src/levels/puzzle-trilogy.ts')).PUZZLE_LEVELS.find(entry=>entry.id===probe.id).data;
        const width=innerWidth,height=innerHeight,v=p.pos.clone();
        const bounds=points=>{
          const projected=points.map(point=>{v.fromArray(point).project(g.camera);return v.toArray();});
          const ndc={minX:Math.min(...projected.map(point=>point[0])),maxX:Math.max(...projected.map(point=>point[0])),
            minY:Math.min(...projected.map(point=>point[1])),maxY:Math.max(...projected.map(point=>point[1])),maxZ:Math.max(...projected.map(point=>point[2]))};
          return {ndc,pixels:{left:(ndc.minX+1)*width/2,right:(ndc.maxX+1)*width/2,
            top:(1-ndc.maxY)*height/2,bottom:(1-ndc.minY)*height/2}};
        };
        const boxPoints=box=>[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[
          x<0?box.min.x:box.max.x,y<0?box.min.y:box.max.y,z<0?box.min.z:box.max.z])));
        const title=document.querySelector('.hud-bonus-title').getBoundingClientRect();
        const header={left:title.left-14,right:title.right+14,top:title.top-14,bottom:title.bottom+14};
        const specs=source.components.filter(component=>['crate','metal','outline'].includes(component.t));
        const targets=probe.targets.map(([x,y])=>{
          const index=specs.findIndex(component=>Math.abs(component.p[0]-x)<.04&&Math.abs(component.p[1]-y)<.04);
          if(index<0)throw Error(`Missing target ${x},${y}`);
          const crate=l.crates[index],projection=bounds(boxPoints(crate.box)),b=projection.pixels;
          return {name:specs[index].nm,position:crate.mesh.position.toArray(),alive:crate.alive,pending:crate.pending,
            ...projection,headerOverlap:!(b.right<header.left||b.left>header.right||b.bottom<header.top||b.top>header.bottom)};
        });
        const rider=p.riderRef;let vertices=0;
        rider.updateWorldMatrix(true,true);const points=[],world=g.camera.matrixWorld.clone(),instance=world.clone();
        const visit=node=>{
          if(node!==rider&&!node.visible)return;
          if(node.isMesh&&!node.userData.characterRenderProxy){
            const materials=Array.isArray(node.material)?node.material:[node.material],positions=node.geometry.getAttribute('position');
            if(positions&&materials.some(material=>material.visible&&material.opacity>0)){
              if(node.isSkinnedMesh)node.skeleton.update();
              for(let item=0;item<(node.isInstancedMesh?node.count:1);item++){
                world.copy(node.matrixWorld);if(node.isInstancedMesh){node.getMatrixAt(item,instance);world.multiply(instance);}
                for(let i=0;i<positions.count;i++){node.getVertexPosition(i,v).applyMatrix4(world);points.push(v.toArray());vertices++;}
              }
            }
          }
          for(const child of node.children)visit(child);
        };
        visit(rider);
        return {id:probe.id,name:probe.name,position:p.pos.toArray(),grounded:p.grounded,header,targets,
          rider:{vertices,...bounds(points)},cameraFollowDistance:l.cameraViews[0].cameraFollowDistance};
      },probe);
      await page.screenshot({path:`${output}/${id}-${probe.name}-preview-full.png`});
      reports.push(report);
      assert.equal(report.grounded,true,`${id}/${probe.name} view starts without support`);
      assert.equal(report.cameraFollowDistance,42,`${id}/${probe.name} did not use final puzzle framing`);
      for(const target of report.targets) {
        assert.ok(target.alive,`${id}/${probe.name} target disappeared before its puzzle`);
        assert.equal(target.headerOverlap,false,`${id}/${probe.name} ${target.name} is hidden by the BONUS header`);
        assert.ok(target.ndc.minX> -1&&target.ndc.maxX<1&&target.ndc.minY> -1&&target.ndc.maxY<1&&target.ndc.maxZ<1,
          `${id}/${probe.name} target falls outside the preview`);
      }
      assert.ok(report.rider.vertices>100&&report.rider.ndc.minX> -1&&report.rider.ndc.maxX<1&&report.rider.ndc.minY> -1&&report.rider.ndc.maxY<1,
        `${id}/${probe.name} full rider is cropped`);
      console.log(JSON.stringify({id,name:probe.name,targets:report.targets.length,headerOverlaps:report.targets.filter(target=>target.headerOverlap).length}));
    }
    assert.deepEqual(errors,[],`${id} console errors during preview compositions`);
    await page.close();
  }
  await writeFile(`${output}/final-preview-framing.json`,JSON.stringify(reports,null,2));
  console.log('PASS eight final full-render compositions: upper targets clear BONUS header, whole rider visible, no errors');
}finally{await browser.close();}
