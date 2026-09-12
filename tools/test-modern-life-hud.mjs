import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true}});
try{
  const {GameHudSurface,formatLifeHudValue}=await server.ssrLoadModule('/src/gameHudSurface.ts');
  for(const count of [0,3,12,999]){
    assert.equal(formatLifeHudValue(count,true),`${count} DEATHS`);
    assert.equal(formatLifeHudValue(`${count} DEATHS`,true),`${count} DEATHS`);
    assert.equal(formatLifeHudValue(count,false),String(count));
  }
  const style={display:'block',visibility:'visible',opacity:'1',getPropertyValue:()=> '1'};
  globalThis.getComputedStyle=()=>style;
  const row={classList:{contains:()=>false},style:{},getClientRects:()=>[{}]};
  const face={closest:()=>row};
  const value={isConnected:true,textContent:'3 DEATHS',querySelector:()=>null,style:{},getClientRects:()=>[{}],getBoundingClientRect:()=>lineRect};
  const surface=Object.create(GameHudSurface.prototype);
  surface.elements={lifeRow:row,lifeFace:face,lifeValue:value};
  const faceRect={x:1100,y:20,width:80,height:80};
  const lineRect={x:1040,y:108,width:200,height:36.8*1.285};
  surface.rect=el=>el===face?faceRect:el===value?lineRect:null;
  surface.drawLifeFace=()=>{};
  surface.drawPlainText=()=>assert.fail('Modern readout used a plain text font');
  const calls=[];surface.drawRooInRect=(_ctx,text,rect,style)=>calls.push({text,rect,style});
  for(const life of [{value:3,deathsMode:true},{value:'3 DEATHS',deathsMode:true},undefined]){
    calls.length=0;surface.paintCounters({}, {scaleX:1,scaleY:1},1280,720,{life},0);
    assert.equal(calls.length,1);assert.equal(calls[0].text,'3 DEATHS');
    assert.equal(calls[0].style.align,'center');assert.ok(Math.abs(calls[0].style.size-36.8)<1e-8);
    assert.ok(calls[0].rect.y>=faceRect.y+faceRect.height,'readout not below portrait');
  }
  calls.length=0;surface.paintCounters({}, {scaleX:1,scaleY:1},1280,720,{life:{value:3,deathsMode:false}},0);
  assert.equal(calls[0].text,'3');assert.equal(calls[0].style.align,'right');assert.ok(calls[0].style.size>70);
  const ui=await readFile(new URL('../src/ui.ts',import.meta.url),'utf8');
  assert.match(ui,/rooLives\.set\(formatLifeHudValue\(lifeReadout, s\.endlessDeaths\)\)/);
  assert.match(ui,/font-size: calc\(var\(--menu-action,[^;]+\.882\)/);
  assert.match(ui,/hud-life-row\.hud-deathcount[^}]+flex-direction: column/);
  assert.doesNotMatch(ui,/hud-deathcount-label|deathModeLabelEl/);
  console.log('PASS one Roo Modern count/caption below portrait, menu-scale native mirror, count updates and unchanged Classic format');
}finally{await server.close();}
