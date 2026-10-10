import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5354').replace(/\/$/,'');
const metadata=JSON.parse(await readFile(new URL('../src/edgeGrindingSnapshots.json',import.meta.url),'utf8'));
const selected=process.env.EDGE_BROWSER_LEVELS?.split(',');
const ids=selected??[...Object.keys(metadata.sources),'jungle','flats','slip','dark','descent','beachfront','meshylook-thorns','astra-chimeworks','backport-lab'];
const full=new Set(['treehouse-trail','test','custard-creek','dark','ghost-train','waterpark-cup','island-hopper','bonus-easy']);
const output=process.env.EDGE_REVIEW_OUTPUT||'/private/tmp/course-edges-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1280,height:800}});
await context.addInitScript(()=>{navigator.getGamepads=()=>[];});
const results=[],errors=[],cacheResults=[];
try{
  for(const lite of [true,false])for(const id of ids){
    if(process.env.EDGE_BROWSER_MODE==='full'&&lite)continue;
    if(!lite&&!full.has(id))continue;
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push({id,lite,error:e.message}));
    page.on('console',m=>{if(m.type()==='error')errors.push({id,lite,error:m.text()});});
    try{
      await page.goto(`${base}/?playtest&level=${id}${lite?'&lite':''}`,{timeout:120000});
      await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
      if(await page.evaluate(()=>!!window.__game.getCompetition()))await page.evaluate(()=>window.__game.competitionAction('retry'));
      const candidates=await page.evaluate(()=>{
        const g=window.__game,p=g.player,l=g.getLevel(),q=window.__edgeAudit={budget:0,rail:null,consume:g.input.consumeEdges.bind(g.input)};
        const native=p.step.bind(p);g.input.consumeEdges=()=>{};
        p.step=(dt,input,level)=>{if(q.budget<=0)return;native(dt,input,level);q.consume();q.budget--;};
        q.candidates=l.surfaceEdgeRails.flatMap(rail=>{
          const mesh=l.surfaceEdgeOwners.get(rail),c=l.builtFromData?.components[mesh?.userData.editorIdx];
          if(!rail.grindable||rail.totalLength<6||c?.outline||['mover','phasepad','crumble','spinbridge'].includes(c?.t))return [];
          const point=rail.pointAt(rail.totalLength*.3);
          if(point.y<l.killY+1||l.killBoxes.some(box=>box.containsPoint(point))||l.finishGlow.containsPoint(point))return [];
          return [{rail,mesh,name:c?.nm??mesh?.name??'surface',length:rail.totalLength}];
        }).sort((a,b)=>b.length-a.length).slice(0,12);
        return q.candidates.map(({name,length})=>({name,length}));
      });
      const assets=!lite?await page.evaluate(async()=>{
        const l=window.__game.getLevel();await Promise.all([l.prepareJungleAssets(),l.prepareSurfaceImages()]);
        return {nightworks:l.nightworksRocks?.diagnostics??null};
      }):null;
      if(assets?.nightworks){assert.deepEqual(assets.nightworks.errors,[]);assert.equal(assets.nightworks.ready,assets.nightworks.models);}
      assert.ok(candidates.length,`${id}: no ordinary live platform edge`);
      const advance=async frames=>{
        await page.evaluate(frames=>{window.__edgeAudit.budget=frames;},frames);
        await page.waitForFunction(()=>window.__edgeAudit.budget===0,null,{timeout:20000});
        return page.evaluate(()=>{const p=window.__game.player;return {state:p.state,bail:p.isBailing,position:p.pos.toArray(),t:p.grindT,same:p.grindRail===window.__edgeAudit.rail};});
      };
      let caught=null;
      for(let i=0;i<candidates.length&&!caught;i++)for(const side of [0,.35,-.35]){
        await page.keyboard.up('KeyE');
        await page.evaluate(({i,side})=>{
          const g=window.__game,p=g.player,l=g.getLevel(),q=window.__edgeAudit,rail=q.candidates[i].rail,t=rail.totalLength*.3;
          const position=rail.pointAt(t),heading=rail.tangentAt(t),n=Math.hypot(heading.x,heading.z);
          position.y+=.25;if(n){position.x+=heading.z/n*side;position.z-=heading.x/n*side;}
          // Establish the same supported camera reference as an ordinary
          // approach, before placing the short airborne catch fixture.
          let supported=position;
          const ray=new p.raycaster.constructor(),down=position.clone().set(0,-1,0);
          for(const offset of [.2,-.2,0]){
            const probe=position.clone();if(n){probe.x+=heading.z/n*offset;probe.z-=heading.x/n*offset;}probe.y+=1;
            ray.set(probe,down);ray.far=2;
            const hit=l.raycastGround(ray).find(h=>h.object===q.candidates[i].mesh&&Math.abs(h.point.y-position.y)<.8);
            if(hit){supported=hit.point.clone();supported.y+=.06;break;}
          }
          p.respawn(l,true,true,{position:supported,heading});p.camDir.copy(heading);p.axisF.copy(heading).setY(0).normalize();
          p.pos.copy(position);p.prevPos.copy(position);p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.speed=8;p.vVel=0;
          q.rail=rail;g.input.update();q.consume();
        },{i,side});
        await page.keyboard.down('KeyE');const state=await advance(1);
        if(state.state!=='grind')continue;
        const end=await advance(12);
        if(end.state==='grind'&&!end.bail){caught={candidate:candidates[i],state,end};break;}
      }
      assert.ok(caught,`${id}: no native-keyboard grind catch on ${JSON.stringify(candidates)}`);
      const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
      results.push({id,lite,...caught,stamp,assets});
      if(!lite)await page.screenshot({path:`${output}/${id}-full.png`});
      console.log(`PASS ${lite?'lite':'full'} ${id}: ${caught.candidate.name}`);
      await writeFile(`${output}/review.json`,JSON.stringify({base,results,errors},null,2));
    }finally{await page.close();}
  }
  const legacy=JSON.parse(await readFile(new URL('./fixtures/edge-grinding-legacy-bonus.json',import.meta.url),'utf8'));
  for(const authored of [false,true]){
    const cached=JSON.parse(JSON.stringify(legacy));if(authored)cached.data.edgeGrindingRevision=1;
    const isolated=await browser.newContext({viewport:{width:1280,height:800}}),page=await isolated.newPage();
    await page.addInitScript(entry=>{
      navigator.getGamepads=()=>[];localStorage.setItem('solProtoUserLevels',JSON.stringify([entry]));
    },cached);
    page.on('pageerror',e=>errors.push({id:'cached-bonus',authored,error:e.message}));
    page.on('console',m=>{if(m.type()==='error')errors.push({id:'cached-bonus',authored,error:m.text()});});
    try{
      await page.goto(`${base}/?playtest&level=bonus-easy&lite`,{timeout:120000});
      await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
      const actual=await page.evaluate(()=>{
        const l=window.__game.getLevel();return {rails:l.surfaceEdgeRails.length,
          disabled:l.builtFromData.components.filter(c=>c.t==='platform'&&c.edgeGrinding===false).length};
      });
      if(authored){assert.equal(actual.disabled,3);assert.equal(actual.rails,0);}
      else {assert.equal(actual.disabled,0);assert.ok(actual.rails>0);}
      cacheResults.push({authored,...actual});console.log(`PASS browser cache: ${authored?'authored opt-outs preserved':'pristine defaults upgraded'}`);
    }finally{await isolated.close();}
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS ${results.length} real-keyboard course checks, including ${results.filter(r=>!r.lite).length} full-render passes; ${cacheResults.length} cache checks; clean consoles.`);
}finally{await writeFile(`${output}/review.json`,JSON.stringify({base,results,cacheResults,errors},null,2));await browser.close();}
