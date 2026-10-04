import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=(process.argv.find(arg=>/^https?:/.test(arg))||'http://127.0.0.1:5199/').replace(/\/$/,'');
const option=name=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3);
const tag=option('tag')||'after';assert.match(tag,/^[a-z0-9-]+$/,'capture tag must be a simple filename');
const out='/private/tmp/ghost-train-v2-browser',after=`${out}/${tag}`,before=`${out}/before`;
await Promise.all([mkdir(after,{recursive:true}),mkdir(before,{recursive:true})]);
const sourceText=await readFile(new URL('../src/levels/ghost-train.ts',import.meta.url),'utf8');
const sourceSha256=createHash('sha256').update(sourceText).digest('hex');
const server=await createServer({root,configFile:false,appType:'custom',logLevel:'silent',cacheDir:`${out}/vite-cache`,server:{middlewareMode:true}});
let authored;
try{authored=await server.ssrLoadModule('/src/levels/ghost-train.ts');}finally{await server.close();}
assert.equal(authored.GHOST_TRAIN_PREVIEW_POINTS?.length,8,'source must author the eight flagship preview points');
const requested=option('scenes')?.split(',');
const fixtures=authored.GHOST_TRAIN_PREVIEW_POINTS.filter(fixture=>!requested||requested.includes(fixture.id)).map(fixture=>({
  ...fixture,room:authored.GHOST_TRAIN_ROOMS.find(room=>room.id===fixture.roomId),
  previewPoint:fixture.previewPoint??authored.ghostRoutePoint(fixture.s,fixture.y,fixture.u??0),
  heading:fixture.heading??authored.ghostRouteTangent(fixture.s),
}));
assert.ok(fixtures.length>0,'requested source preview points must exist');
for(const fixture of fixtures){assert.match(fixture.id,/^[a-z0-9-]+$/);assert.ok(fixture.previewPoint.every(Number.isFinite)&&fixture.heading.every(Number.isFinite));}
const baselines={
  station:'/private/tmp/ghost-train-art-audit/cart-approach.png',
  axes:'/private/tmp/ghost-train-art-audit/axe-close.png',
  banquet:'/private/tmp/ghost-train-art-audit/banquet-turkey-close.png',
  armour:'/private/tmp/ghost-train-art-audit/knight-closer.png',
  freight:'/private/tmp/ghost-train-browser/checkpoint-08-full.png',
  crypt:'/private/tmp/ghost-train-art-audit/crypt-approach.png',
  machinery:'/private/tmp/ghost-train-browser/checkpoint-12-full.png',
  throne:'/private/tmp/ghost-train-art-audit/throne-arrival.png',
};
const preserved=[];
for(const fixture of fixtures){
  const destination=`${before}/${fixture.id}.png`;
  try{await access(destination);preserved.push({id:fixture.id,path:destination});}
  catch{try{await copyFile(baselines[fixture.id],destination);preserved.push({id:fixture.id,path:destination,source:baselines[fixture.id]});}catch{preserved.push({id:fixture.id,missing:true});}}
}
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,channel:'chrome'}),consoleErrors=[],reports=[],failures=[];
const manifest={base,sourceSha256,captureMode:'Actual production gameplay camera; full renderer; ordinary simulation',
  baselineNote:'Original v1 production-camera views at semantically matched scenes; v2 views use source-authored preview positions.',
  initialPlacementsPerScene:1,fixtures,preserved,reports,consoleErrors,failures};
const save=()=>writeFile(`${after}/report.json`,JSON.stringify(manifest,null,2));
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',error=>consoleErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await page.goto(`${base}/?playtest&level=ghost-train`);
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='ghost-train'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async()=>{await window.__game.getLevel().prepareGhostTrainAssets();});
  await page.waitForFunction(()=>{
    const diagnostics=window.__game?.getLevel().ghostTrainDiagnostics;
    return diagnostics&&Object.keys(diagnostics.scenery.assets).length>=12&&Object.values(diagnostics.scenery.assets).every(asset=>asset.status==='ready')
      &&diagnostics.enemies.every(enemy=>enemy.status==='ready')&&['stone','floor','timber'].every(kind=>diagnostics.textures[kind]==='ready');
  },null,{timeout:120000});
  for(const fixture of fixtures){
    const firstError=consoleErrors.length;
    const initial=await page.evaluate(fixture=>{
      const g=window.__game,p=g.player;
      // The only actor placement in this scene. Leave physics, velocity,
      // pendulum phases, camera settings and ordinary fixed steps untouched.
      p.respawn(g.getLevel(),true,false,{position:p.pos.clone().fromArray(fixture.previewPoint),heading:p.pos.clone().fromArray(fixture.heading)});
      return{position:p.pos.toArray(),deaths:p.totalDeaths,state:p.state};
    },fixture);
    const settled=await page.evaluate(async()=>await new Promise(resolve=>{
      const g=window.__game,start=performance.now(),previous=g.camera.position.clone();let stable=0;
      function frame(){
        const elapsed=performance.now()-start,distance=g.camera.position.distanceTo(previous);previous.copy(g.camera.position);
        stable=distance<.035?stable+1:0;
        if((elapsed>=750&&stable>=8)||elapsed>2500){resolve({settled:stable>=8,elapsedMs:Math.round(elapsed),stableFrames:stable});return;}
        requestAnimationFrame(frame);
      }requestAnimationFrame(frame);
    }));
    const evidence=await page.evaluate(async fixture=>{
      const g=window.__game,l=g.getLevel(),p=g.player,camera=g.camera;
      const THREE={Vector3:p.pos.constructor,Box3:l.enemies[0].box.constructor};
      g.scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
      const forward=camera.getWorldDirection(new THREE.Vector3()),pitch=Math.atan2(-forward.y,Math.hypot(forward.x,forward.z))*180/Math.PI;
      const intersectsView=bounds=>{
        const corners=[];
        for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new THREE.Vector3(x,y,z));
        const view=corners.map(v=>v.clone().applyMatrix4(camera.matrixWorldInverse));
        if(view.every(v=>v.z>-camera.near)||view.every(v=>v.z<-camera.far))return false;
        const projected=corners.map(v=>v.project(camera));
        return !['x','y'].some(axis=>projected.every(v=>v[axis]<-1)||projected.every(v=>v[axis]>1));
      };
      const props=[],lights=[],maps=new Map();
      const visibleTree=object=>{for(let ancestor=object;ancestor;ancestor=ancestor.parent)if(!ancestor.visible)return false;return true;};
      g.scene.traverse(object=>{
        if(object.isLight)lights.push({name:object.name,type:object.type,color:object.color.getHexString(),intensity:object.intensity,
          distance:object.distance,castShadow:object.castShadow,position:object.getWorldPosition(new THREE.Vector3()).toArray(),
          target:object.target?.getWorldPosition(new THREE.Vector3()).toArray()});
        if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material]){
          const texture=material.map;if(texture&&!maps.has(texture.uuid))maps.set(texture.uuid,{material:material.name||material.type,
            width:texture.image?.width??0,height:texture.image?.height??0,ready:!!texture.image});
        }
        const kind=object.userData.ghostSkin??object.userData.ghostAsset?.kind;if(!kind)return;
        if(!object.userData.ghostSkin){for(let ancestor=object.parent;ancestor;ancestor=ancestor.parent)if(ancestor.userData.ghostSkin===kind)return;}
        const bounds=new THREE.Box3().setFromObject(object);if(bounds.isEmpty())return;
        const centre=bounds.getCenter(new THREE.Vector3()),distance=Math.hypot(centre.x-p.pos.x,centre.z-p.pos.z);
        if(distance>22)return;
        const visible=visibleTree(object)&&intersectsView(bounds),screen=centre.clone().project(camera);
        props.push({kind,name:object.name,distance:Number(distance.toFixed(2)),visible,position:object.getWorldPosition(new THREE.Vector3()).toArray(),
          size:bounds.getSize(new THREE.Vector3()).toArray(),screenCentre:[screen.x,screen.y],assetStatus:object.userData.ghostAsset?.status??null});
      });
      props.sort((a,b)=>a.distance-b.distance);
      const diagnostics=l.ghostTrainDiagnostics;
      return{fixtureId:fixture.id,name:fixture.name,authoredPoint:fixture.previewPoint,
        player:{position:p.pos.toArray(),grounded:p.grounded,state:p.state,bailing:p.isBailing,deaths:p.totalDeaths,mover:p.groundHit?.moverId??null},
        camera:{position:camera.position.toArray(),forward:forward.toArray(),pitch,heightAboveFeet:camera.position.y-p.pos.y,
          trailingDistance:Math.hypot(camera.position.x-p.pos.x,camera.position.z-p.pos.z),fov:camera.fov,upperRayAboveHorizon:camera.fov/2-pitch},
        nearProps:props,visibleNearProps:props.filter(prop=>prop.visible),assets:diagnostics.scenery.assets,textures:diagnostics.textures,
        lightingPool:diagnostics.scenery.showLights,lights,loadedTextureMaps:[...maps.values()],
        renderer:{render:g.getRenderFrameStats?.()??{...g.renderer.info.render},memory:{...g.renderer.info.memory},programs:g.renderer.info.programs?.length??0,
          drawingBuffer:g.renderer.getDrawingBufferSize({x:0,y:0,set(x,y){this.x=x;this.y=y;return this;},floor(){this.x=Math.floor(this.x);this.y=Math.floor(this.y);return this;},toArray(){return[this.x,this.y];}}).toArray(),quality:g.getRenderQualitySizes?.()},
        frameStats:{...g.frameStats},fullRender:true,actualGameplayCamera:true,initialPlacementCount:1};
    },fixture);
    await page.screenshot({path:`${after}/${fixture.id}.png`});
    const errors=consoleErrors.slice(firstError),qualityWarnings=[];
    if(evidence.camera.upperRayAboveHorizon<=0)qualityWarnings.push('Upper camera frustum excludes the horizon and most upper architecture.');
    if(!evidence.visibleNearProps.length)qualityWarnings.push('No Meshy or obstacle hero prop intersects the nearby gameplay-camera frustum.');
    if(!evidence.lightingPool?.active)qualityWarnings.push('No authored show light is active at this viewpoint.');
    if(!settled.settled)qualityWarnings.push('Production camera did not settle fully before capture.');
    if(evidence.player.bailing||['dead','gameover'].includes(evidence.player.state)||evidence.player.deaths>initial.deaths)failures.push({id:fixture.id,error:'Authored preview start was unsafe under ordinary physics.'});
    if(!evidence.player.grounded)qualityWarnings.push('Preview player is airborne at capture; inspect whether authored placement is supported.');
    if(errors.length)failures.push({id:fixture.id,error:'Browser console errors',errors});
    const report={...evidence,initial,settled,qualityWarnings,consoleErrors:errors};reports.push(report);await save();
    console.log(JSON.stringify({id:fixture.id,grounded:evidence.player.grounded,pitch:Number(evidence.camera.pitch.toFixed(1)),height:Number(evidence.camera.heightAboveFeet.toFixed(2)),
      visibleProps:evidence.visibleNearProps.map(prop=>prop.kind),lights:evidence.lightingPool,drawCalls:evidence.renderer.render.calls,triangles:evidence.renderer.render.triangles,qualityWarnings,errors}));
  }
  const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const sections=reports.map(report=>`<section><h2>${escape(report.name)}</h2><p>Actual gameplay camera · pitch ${report.camera.pitch.toFixed(1)}° · height ${report.camera.heightAboveFeet.toFixed(1)} m · ${report.visibleNearProps.length} nearby visible hero props</p><div class="pair"><figure><img src="before/${report.fixtureId}.png"><figcaption>Before · original deployed v1</figcaption></figure><figure><img src="${tag}/${report.fixtureId}.png"><figcaption>After · source-authored v2 preview point</figcaption></figure></div><p>${report.qualityWarnings.map(escape).join(' ')}</p></section>`).join('\n');
  await writeFile(`${out}/comparison-${tag}.html`,`<!doctype html><html><head><meta charset="utf-8"><title>Ghost train gameplay-camera comparison</title><style>body{margin:0;padding:30px;background:#17121e;color:#efe9f3;font:15px system-ui}h1{font-size:26px}h2{font-size:21px;margin-bottom:6px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:15px}figure{margin:0}img{width:100%;display:block}figcaption{padding:9px;background:#2b2235}section{margin:35px 0 50px}p{color:#cbbdd6}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style></head><body><h1>Ghost train · actual gameplay-camera comparison</h1><p>Full production renderer. Before and after show semantically matched scenes; after views use the authored v2 fixture positions. No scenic camera is presented as gameplay evidence.</p>${sections}</body></html>`);
  await save();assert.deepEqual(consoleErrors,[],'Chrome console must be clean');assert.deepEqual(failures,[],'source-authored preview starts must remain safe');
  console.log(JSON.stringify({scenes:reports.length,output:after,comparison:`${out}/comparison-${tag}.html`,sourceSha256,consoleErrors,failures}));
}finally{await browser.close();}
