import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5177/';
const output = process.env.SPIN_POSE_OUT || '/private/tmp/spin-tpose-review';
await mkdir(output, { recursive: true });
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:900}});context.setDefaultNavigationTimeout(90000);
 const errors=[];const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
 const lab=await context.newPage();watch(lab);await lab.goto(base+'spin-lab.html');await lab.waitForFunction(()=>window.__spinLab?.ready,null,{timeout:90000});
 const pose=await lab.evaluate(()=>window.__spinLab.source.userData.spinArmPose);console.log('POSE',JSON.stringify(pose));
 for(const side of ['left','right']){const a=pose.landmarks[`shoulder-${side}`],b=pose.landmarks[`elbow-${side}`];assert.ok(Math.abs(a[1]-b[1])<1e-4);}
 await lab.locator('#spin-preview').uncheck();await lab.screenshot({path:output+'/default.png'});
 for(const [name,value]of[['Radial smear value','0'],['Height twist value','0'],['Radial stretch value','1'],['Height value','1'],['Waist flare value','0'],['3D distortion value','0'],['Blur copies value','1']])await lab.getByRole('spinbutton',{name,exact:true}).fill(value);
 await lab.waitForTimeout(400);await lab.screenshot({path:output+'/plain.png'});
 await lab.evaluate(async()=>{const {bakeSpinSmear,disposeSpinModel,DEFAULT_SPIN_SMEAR}=await import('/src/spin-effects/smear.ts');const {saveSpinSmearModel}=await import('/src/spin-effects/smearStore.ts');const raw=window.__spinLab.player.captureSpinSmearSource(false);const legacy=bakeSpinSmear(raw,{...DEFAULT_SPIN_SMEAR,sweepDegrees:315,trailCopies:3});await saveSpinSmearModel(legacy,{...DEFAULT_SPIN_SMEAR,sweepDegrees:315,trailCopies:3});disposeSpinModel(raw);disposeSpinModel(legacy);});
 await lab.reload();await lab.waitForFunction(()=>window.__spinLab?.ready,null,{timeout:90000});
 const migrated=await lab.evaluate(()=>({settings:window.__spinLab.settings,pose:window.__spinLab.production.sculpture.children[0].userData.spinSmear?.poseRevision,status:document.querySelector('#lab-status').textContent}));
 assert.equal(migrated.settings.sweepDegrees,315);assert.equal(migrated.settings.trailCopies,3);assert.equal(migrated.pose,2);assert.match(migrated.status,/new T-pose/);
 await lab.locator('#bake-model').click();await lab.waitForFunction(()=>window.__spinLab.bakeCount===1,null,{timeout:90000});
 assert.equal(await lab.evaluate(()=>window.__spinLab.production.diagnostics.modelSource),'baked');
 await lab.reload();await lab.waitForFunction(()=>window.__spinLab?.ready,null,{timeout:90000});assert.equal(await lab.evaluate(()=>window.__spinLab.production.diagnostics.modelSource),'baked');await lab.close();
 for(const mode of ['&lite','']){const game=await context.newPage();watch(game);await game.goto(base+'?playtest&level=codex-lab'+mode);await game.waitForFunction(()=>window.__game?.player.spinEffectDiagnostics?.assetReady&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
 assert.equal(await game.evaluate(()=>window.__game.player.spinEffects.sculpture.children[0].userData.spinSmear.poseRevision),2);await game.keyboard.down('KeyF');await game.waitForFunction(()=>window.__game.player.spinEffectDiagnostics.sculptureVisible&&!window.__game.player.bodyGroup.visible);
 await game.screenshot({path:output+'/game'+(mode?'-lite':'-full')+'.png'});await game.keyboard.up('KeyF');await game.close();}
 assert.deepEqual(errors,[]);console.log('PASS real skinned T-pose source, legacy recipe preservation/repose, baked persistence, lite/full gameplay spin and clean console.');
}finally{await browser.close();}
