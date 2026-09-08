import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ server }) => {
  // Button/layout semantics only; the full-render browser review checks ink,
  // clipping, actual focus, fonts and CRT. Exercise the real input/render code.
  const classes=()=>{
    const tokens=new Set();
    return {contains:s=>tokens.has(s),add:s=>tokens.add(s),remove:s=>tokens.delete(s),toggle(s,on=!tokens.has(s)){on?tokens.add(s):tokens.delete(s);return on;}};
  };
  const create=document.createElement.bind(document);
  document.createElement=tag=>{
    const element=create(tag),listeners=new Map();let html='',buttons=[];
    element.dataset={};element.classList=classes();element.querySelectorAll=selector=>selector.startsWith('button')?buttons.filter(b=>!b.disabled):[];
    element.querySelector=selector=>buttons.find(b=>!b.disabled&&selector.includes(`"${b.dataset.action}"`))??null;
    element.addEventListener=(name,fn)=>listeners.set(name,fn);
    Object.defineProperty(element,'innerHTML',{get:()=>html,set:value=>{
      html=value;buttons=[...value.matchAll(/<button data-action="([^"]+)"( disabled)?>(.*?)<\/button>/g)].map(match=>{
        const button={dataset:{action:match[1]},disabled:!!match[2],classList:classes(),tabIndex:0,
          closest:()=>button,setAttribute:()=>{},focus:()=>{document.activeElement=button;},scrollIntoView:()=>{},
          click:()=>listeners.get('click')?.({target:button})};
        return button;
      });
    }});
    return element;
  };
  document.body.dataset={};document.body.classList=classes();document.head=create('head');
  const { CompetitionPresentation }=await server.ssrLoadModule('/src/competition/presentation.ts');
  const { JungleCupEvent }=await server.ssrLoadModule('/src/competition/event.ts');
  const calls=[];const ui=new CompetitionPresentation(action=>calls.push(action));
  const event=new JungleCupEvent(()=>.5);ui.render(event);
  const buttons=()=>ui.element.querySelectorAll('button');
  const selected=()=>buttons().filter(b=>b.classList.contains('selected')).map(b=>b.dataset.action);
  const pad=(x=0,y=0,held=[])=>({axes:[x,y],buttons:Array.from({length:17},(_,i)=>({pressed:held.includes(i),value:held.includes(i)?1:0})),mapping:'standard',connected:true,id:'test',index:0});
  const neutral=()=>ui.updateInput(pad());
  const tap=(x,y,held=[])=>{neutral();ui.updateInput(pad(x,y,held));neutral();};
  assert.deepEqual(selected(),['start']);assert.deepEqual(buttons().map(b=>b.tabIndex),[0,-1,-1]);
  ui.updateInput(pad(0,0,[0]));assert.deepEqual(calls,[],'held confirm activated the opening menu');
  tap(1,0);assert.deepEqual(selected(),['guide'],'horizontal stick lacks a visible selection');
  tap(1,0);assert.deepEqual(selected(),['exit']);
  assert.equal(document.activeElement.dataset.action,'exit');
  neutral();ui.updateInput(pad(1,0));ui.updateInput(pad(1,0));
  assert.deepEqual(selected(),['start'],'held direction repeated');
  tap(-1,0);assert.deepEqual(selected(),['exit']);
  tap(0,-1);assert.deepEqual(selected(),['guide']);tap(0,1);assert.deepEqual(selected(),['exit']);
  tap(0,0,[14]);assert.deepEqual(selected(),['guide']);tap(0,0,[15]);assert.deepEqual(selected(),['exit']);
  ui.updateInput(pad(0,0,[0]));assert.deepEqual(calls,['exit']);
  assert.equal(buttons()[2].classList.contains('pressed'),true);
  ui.updateInput(pad(0,0,[0]));assert.equal(calls.length,1,'held confirm repeated an action');
  neutral();assert.equal(buttons()[2].classList.contains('pressed'),false);
  event.bails++;ui.render(event);assert.deepEqual(selected(),['exit'],'same-screen refresh lost selection');
  ui.render(event,true);tap(0,-1);assert.deepEqual(selected(),['exit'],'suppressed UI consumed navigation');
  ui.render(event);ui.updateInput(pad(0,0,[0]));assert.equal(calls.length,1,'held confirm after pause activated menu');
  neutral();
  tap(-1,0);tap(0,0,[0]);
  assert.ok(ui.element.innerHTML.includes('TRICKS & COMBOS'));
  assert.ok(ui.element.innerHTML.includes('Hardflip')&&ui.element.innerHTML.includes('Tailgrab'));
  assert.deepEqual(selected(),['guide-back']);assert.equal(calls.length,1,'guide dispatched a gameplay action');
  tap(0,0,[1]);assert.deepEqual(selected(),['guide'],'controller Back did not restore guide focus');
  assert.ok(ui.element.innerHTML.includes('BEAT YOUR RIVAL'));
  event.startRun();event.stepPresentation(3);event.stepRun(60,9876,false);ui.render(event);
  tap(0,0,[0]);assert.equal(calls.length,1,'disabled judge button activated');
  event.stepPresentation(3);ui.render(event);assert.deepEqual(selected(),['standings']);
  tap(0,0,[0]);assert.deepEqual(calls,['exit','standings']);
  event.showStandings();ui.render(event);tap(1,0);assert.deepEqual(selected(),['exit']);
  event.startRun();event.stepPresentation(3);event.stepRun(60,9876,true);ui.render(event);
  assert.ok(ui.element.innerHTML.includes('0:00')&&ui.element.innerHTML.includes('FINAL COMBO'));
  assert.doesNotMatch(ui.element.innerHTML,/9876|9,876|PTS|POINTS/,'the clock duplicated the existing points HUD');
  assert.match(ui.element.innerHTML,/BAILS/);
  const surface=await readFile('src/gameInterfaceSurface.ts','utf8');
  assert.match(surface,/INK = [^;]*\.competition-host/,'competition DOM ink is still above CRT');
  assert.match(surface,/this.competition\?\.paint\(ctx,size\)/,'competition does not enter the shared pre-CRT pass');
  console.log('PASS competition selection/focus, four-way stick/D-pad, hold edges, pressed state, disabled judges, refresh/pause handoff and one in-run points UI.');
});
