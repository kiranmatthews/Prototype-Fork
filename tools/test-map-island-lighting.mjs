import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
  const {MapIslandLighting}=await server.ssrLoadModule('/src/mapIslandLighting.ts');
  const {resolveLevelAtmosphere,CUSTOM_LEVEL_THEME}=await server.ssrLoadModule('/src/levelAtmosphere.ts');
  const {CAMPAIGN_ISLANDS}=await server.ssrLoadModule('/src/campaign.ts');
  const base=resolveLevelAtmosphere({theme:CUSTOM_LEVEL_THEME,skyPreset:'coast',isCampaignMap:true});
  const rig=()=>({hemi:new THREE.HemisphereLight(),sun:new THREE.DirectionalLight(),fill:new THREE.DirectionalLight(),
    fog:new THREE.Fog('#ffffff',185,380),background:new THREE.Color(),haze:new THREE.Color()});
  const lights=rig(),controller=new MapIslandLighting(lights,base);
  controller.update('treehouse-trail',0);
  const initial=lights.fog.color.clone();
  controller.update('waterpark',0);
  assert.ok(lights.fog.color.equals(initial),'zero elapsed time must not change the island lighting');
  controller.update('waterpark',1/60);
  const firstStep=lights.fog.color.clone();
  assert.ok(!firstStep.equals(initial),'island transfer must blend the atmosphere');
  for(let frame=0;frame<600;frame++)controller.update('waterpark',1/60);
  const settled=lights.fog.color.clone();
  const distance=(a,b)=>Math.hypot(a.r-b.r,a.g-b.g,a.b-b.b);
  assert.ok(distance(firstStep,initial)<distance(settled,initial)*.1,'transfer changed atmosphere in one frame');
  assert.ok(lights.background.equals(settled)&&lights.haze.equals(settled),'fog, sky and clear colour must stay aligned');
  assert.equal(lights.fog.near,185);assert.equal(lights.fog.far,380);
  for(let frame=0;frame<600;frame++)controller.update('treehouse-trail',1/60);
  assert.ok(distance(lights.fog.color,initial)<1e-8,'returning to Motu must recover the base atmosphere');

  const authored={fogColor:'#648297',ambientIntensity:1.3,sunIntensity:2.7};
  for(const island of CAMPAIGN_ISLANDS){
    const custom=rig(),customController=new MapIslandLighting(custom,{...base,...authored},authored);
    customController.update(island.levelKeys[0],0);
    assert.equal(custom.fog.color.getHexString(),'648297');
    assert.equal(custom.hemi.intensity,1.3);assert.equal(custom.sun.intensity,2.7);
  }
  console.log('PASS smooth map atmosphere transfers, shared fog/sky colour, base restoration and explicit editor overrides');
} finally {await server.close();}
