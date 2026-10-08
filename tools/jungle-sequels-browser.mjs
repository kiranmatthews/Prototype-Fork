import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createServer} from 'vite';
import ts from 'typescript';
import {runTempleJourney} from './temple-winding-pilot.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5195/';
const output=process.env.JUNGLE_BROWSER_OUTPUT||`${tmpdir()}/winding-temple-browser`;
const levels=['jungle-terraces','jungle-skyline'],requested=process.argv.slice(2).filter(a=>!/^https?:/.test(a)&&a!=='--lite');
assert.ok(requested.every(id=>levels.includes(id)),'Select a known temple level');
// Supply authoring coordinates and the input controller locally. The game,
// level geometry, assets and simulation can then come from a production URL.
const text=await readFile(new URL('../src/levels/jungle-temple-space.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('temple-space.ts',text,ts.ScriptTarget.Latest,true);
const names=new Set(['TEMPLE_TURNS','SPACE_CACHE','templeFrame','templePoint','profileHeight','templeSourceHeight','templeLocal']);
const helpers=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)||ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.has(d.name.getText(ast))))
 .map(n=>n.getText(ast).replace(/^export\s+/,''));
const helperCode=ts.transpileModule(helpers.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false}});
let routes;
try{
 const {JUNGLE_SEQUEL_ROUTES}=await server.ssrLoadModule('/src/levels/jungle-sequels.ts');
 routes=Object.fromEntries(JUNGLE_SEQUEL_ROUTES.map(r=>[r.id,{id:r.id,end:r.end,profile:r.profile,sourceComponents:r.sourceComponents,pipes:r.pipes,gaps:r.gaps,data:{components:r.data.components.filter(c=>c.t==='crate')}}]));
}finally{await server.close();}
await mkdir(output,{recursive:true});const b=await chromium.launch({headless:true,channel:'chrome'});
try{for(const id of levels.filter(id=>!requested.length||requested.includes(id))){
 const page=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(new URL(`?playtest&level=${id}${process.argv.includes('--lite')?'&lite':''}`,base).href);
 await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:120000});
 await page.screenshot({path:`${output}/${id}-spawn.png`});
 await page.addScriptTag({content:`(()=>{${helperCode}\nwindow.templeSpace={templePoint,templeLocal,templeFrame};window.runTempleJourney=${runTempleJourney.toString()};})();`});
 await page.evaluate(descriptor=>{
  const g=window.__game,p=g.player,l=g.getLevel(),space=window.templeSpace,variant=descriptor.id==='jungle-terraces'?1:2;
  const route={...descriptor,toWorld:(s,y,z=0)=>space.templePoint(s,y,z,variant),toLocal:p=>space.templeLocal(p,variant,descriptor.sourceComponents,descriptor.profile),frameAt:s=>space.templeFrame(s,variant)};
  const tuning=JSON.stringify(g.TUNING),report=window.templeRun={frame:0,done:false,failure:null,trace:[],framing:[],stamp:document.querySelector('.hud-build')?.textContent};
  const context={p,l,route,worldDirectionInput:(d,pace=1)=>{const f=p.courseInputDirection(l)??p.camDir,n=Math.hypot(d.x,d.z);return n<.0001?{}:{moveX:(d.x*-f.z+d.z*f.x)/n*pace,moveY:(d.x*f.x+d.z*f.z)/n*pace};},lastInput:{}};
  const gen=window.runTempleJourney(context);let next=gen.next(),advanced=false,last={};const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
  p.step=(dt,input,level)=>{if(report.done)return step(dt,input,level);const s=next.value??{};input.moveX=s.moveX??0;input.moveY=s.moveY??0;
   const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
   for(const h of ['jumpHeld','spinHeld','grabHeld','grindHeld','transferHeld']){input[h]=s[h]??false;const e=h.replace('Held','Pressed');input[e]=s[e]??(input[h]&&!last[h]);}
   input.jumpReleased=s.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;last={...s};context.lastInput=last;step(dt,input,level);advanced=true;};
  p.commitRenderStep=(...args)=>{commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
   report.trace.push({frame:report.frame,position:p.pos.toArray(),s:route.toLocal(p.pos.toArray())[0],state:p.state,speed:p.speed,grounded:p.grounded,deaths:p.totalDeaths});
   try{next=gen.next();if(next.done){report.done=true;report.result=next.value;report.tuningUnchanged=JSON.stringify(g.TUNING)===tuning;report.checkpoints=l.checkpoints.map(cp=>cp.active);}}catch(error){report.done=true;report.failure=String(error);}
  };
 },routes[id]);
 const shots=new Set();for(let i=0;i<1200;i++){await page.waitForTimeout(250);const r=await page.evaluate(()=>{const r=window.templeRun;return{done:r.done,failure:r.failure,frame:r.frame,last:r.trace.at(-1)}});
  if(i%100===0)console.log(JSON.stringify({id,...r}));const bucket=Math.floor((r.last?.s??0)/100);if(!shots.has(bucket)&&r.frame>20){shots.add(bucket);await page.screenshot({path:`${output}/${id}-${bucket}.png`});}if(r.done)break;
 }
 const report=await page.evaluate(()=>window.templeRun);await writeFile(`${output}/${id}.json`,JSON.stringify({...report,errors},null,2));
 await page.screenshot({path:`${output}/${id}-finish.png`});assert.equal(report.done,true);assert.equal(report.failure,null);assert.equal(report.result.deaths,0);assert.equal(report.tuningUnchanged,true);assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);console.log('PASS real browser winding temple',id,report.frame);await page.close();
}}finally{await b.close()}
