import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5195/';
const common=await readFile(new URL('../pirate-wreck-pilot.mjs',import.meta.url),'utf8');
const source=common.slice(0,common.indexOf(' yield* wait(30);'))+`
 yield* wait(30);check(p.grounded,'Powder room start unsupported');
 yield* walk([-22,-4,-198],'Enter the powder cache');
 yield* walk([-23,-4,-202],'Collect the powder-room crystal');yield* wait(25);
 check(p.hasCrystal,'The optional crystal was not collected');
 yield* walk([-22,-4,-198],'Return to the crosswalk');
 yield* walk([-10,-4,-198],'Return to the lower hold');
 return {state:p.state,deaths:p.totalDeaths,position:p.pos.toArray(),grounded:p.grounded,crystalCollected:p.hasCrystal,evidence:report.evidence};
}`;
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'?playtest&level=drowned-crown');
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages(),g.player.preparePresentationAssets()]);});
 await page.evaluate(source=>{
  const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true,false,{position:p.pos.clone().set(-11,-3.9,-198),heading:p.camDir.clone().set(0,0,-1)});
  const report=window.powderReview={stage:'start',evidence:[],done:false,failure:null,frame:0,tuning:JSON.stringify(g.TUNING)};
  const journey=new Function(source.replace('export function* pirateJourney','return function* pirateJourney'))(),pilot=journey({p,l,report});let next=pilot.next(),last={},advanced=false;
  const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
  p.step=(dt,input,level)=>{if(report.done)return;const sample=next.value??{};
   for(const key of ['moveX','moveY'])input[key]=sample[key]??0;
   const length=Math.hypot(input.moveX,input.moveY);if(length>1){input.moveX/=length;input.moveY/=length;}
   input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
   for(const key of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){input[key]=sample[key]??false;input[key.replace('Held','Pressed')]=input[key]&&!last[key];}
   input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;last={...sample};step(dt,input,level);advanced=true;
  };
  p.commitRenderStep=(...args)=>{commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
   try{next=pilot.next();if(next.done){report.done=true;report.result=next.value;report.tuningUnchanged=JSON.stringify(g.TUNING)===report.tuning;}}
   catch(e){report.done=true;report.failure=String(e);report.position=p.pos.toArray();}
  };
 },source);
 await page.waitForFunction(()=>window.powderReview.done,null,{timeout:180000});
 const report=await page.evaluate(()=>window.powderReview);delete report.tuning;
 await writeFile('docs/drowned-crown/excellence/powder-browser.json',JSON.stringify({...report,errors},null,2)+'\n');
 assert.equal(report.failure,null);assert.equal(report.result.deaths,0);assert.equal(report.result.crystalCollected,true);assert.ok(report.tuningUnchanged);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,frames:report.frame,crystalCollected:true,errors}));
}finally{await browser.close();}
