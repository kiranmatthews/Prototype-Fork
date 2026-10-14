import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5178/';
const output=process.env.BONUS_BROWSER_OUTPUT||`${tmpdir()}/puzzle-bonus-review`;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),reports=[];
const courses=[['bonus-jungle',22,[39,.6,0]],['bonus-beachside-run',26,[117,2.8,0]],['bonus-coastal',36,[102,1.6,0]]];
try{
  for(const lite of [true,false])for(const [id,boxes,fixture]of courses){
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(new URL(`?playtest&level=${id}${lite?'&lite':''}`,base).href);
    await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:90000});
    await page.waitForTimeout(650);
    const snapshot=()=>page.evaluate(()=>{
      const g=window.__game,l=g.getLevel(),p=g.player;
      return {id:g.getCurrentLevel().id,position:p.pos.toArray(),state:p.state,grounded:p.grounded,
        totalCrates:l.totalCrates,enemies:l.enemies.length,checkpoints:l.checkpoints.length,
        camera:g.camera.position.toArray(),hud:l.hudMode,stamp:document.body.textContent.match(/Codex\/sol fork[^\n]*/)?.[0]?.slice(0,80)};
    });
    const spawn=await snapshot();assert.equal(spawn.grounded,true);assert.equal(spawn.hud,'bonus');assert.equal(spawn.totalCrates,boxes);
    assert.match(spawn.stamp,/Codex\/sol fork/);
    await page.screenshot({path:`${output}/${id}-${lite?'lite':'full'}-spawn.png`});
    // A real movement input verifies the destination side-camera control frame.
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(x=>window.__game.player.pos.x>x+.3,spawn.position[0],{timeout:10000});
    await page.keyboard.up('ArrowRight');
    const moved=await snapshot();assert.ok(moved.position[0]>spawn.position[0]+.1,'right input did not advance along the course');
    assert.ok(Math.abs(moved.position[2])<.2,'right input escaped the side-scrolling line');
    // Native respawn fixture for art/collision inspection; complete traversal is
    // covered independently by the input-only production Player tests.
    await page.evaluate(point=>{
      const g=window.__game,p=g.player,l=g.getLevel();
      p.respawn(l,true,false,{position:p.pos.clone().set(point[0],point[1]+.12,point[2]),heading:p.pos.clone().set(1,0,0)});
    },fixture);
    await page.waitForTimeout(950);
    const crossing=await snapshot();assert.ok(crossing.grounded,`${id} crossing observation is unsupported`);
    await page.screenshot({path:`${output}/${id}-${lite?'lite':'full'}-crossing.png`});
    assert.deepEqual(errors,[],`${id} browser errors`);
    reports.push({id,lite,spawn,crossing,errors});console.log(JSON.stringify(reports.at(-1)));
    await context.close();
  }
}finally{await browser.close();}
await writeFile(`${output}/report.json`,JSON.stringify(reports,null,2));
console.log('PASS three replacement bonuses in lite and full Chrome: supported spawns, side controls, crossing art and clean console.');
