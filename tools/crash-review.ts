const g:any=await new Promise(resolve=>{const ready=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(ready);};ready();});
const panel=document.createElement('div');panel.style.cssText='position:fixed;right:0;top:0;z-index:999999;background:#071724e8;color:white;padding:8px;font:12px monospace;max-height:80vh;overflow:auto;max-width:45vw';
const report=document.createElement('pre');report.dataset.testid='crash-report';const rows:any[]=[];let running=false,resizes=0;
const resize=g.renderer.setDrawingBufferSize.bind(g.renderer);g.renderer.setDrawingBufferSize=(...args:any[])=>{resizes++;return resize(...args);};
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const show=(phase:string)=>report.textContent=JSON.stringify({phase,rows},null,2);
function snapshot(label:string){const crt=g.getCrtDiagnostics();rows.push({label,level:g.getCurrentLevel().id,memory:{...g.renderer.info.memory},canvas:[g.renderer.domElement.width,g.renderer.domElement.height],scenery:g.getLevel().jungleAssetDiagnostics,crt:{active:crt?.active,bytes:crt?.estimatedTargetBytes,draws:crt?.lastDrawCount},recovery:g.getGraphicsRecoveryDiagnostics(),resizes});show(label);}
function button(label:string,action:()=>Promise<void>){const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:8px;margin:3px';b.onclick=async()=>{if(running)return;running=true;show('Running '+label);try{await action();show('Passed '+label);}catch(error){show('FAILED '+String(error));}finally{running=false;}};panel.append(b);}
button('Real level transitions',async()=>{
 g.renderQualitySettings.setRegularResolution(540);g.crtGuestSettings.setEnabled(false);g.gameFlow.hide();
 for(const id of ['sky','treehouse-trail','jungle','dark','warproom','test','sky','treehouse-trail','sky']){
  await g.gameFlow.transition(()=>{if(!g.switchLevel(id))throw Error('level rejected');g.gameFlow.hide();});
  await wait(350);snapshot(id);
  if(g.getLevel().jungleAssetDiagnostics?.errors?.length)throw Error('scenery load error');
 }
});
button('CRT allocation cycle',async()=>{
 g.renderQualitySettings.setRegularResolution(540);g.crtGuestSettings.setEnabled(true);await wait(1500);snapshot('CRT on');
 if(!g.getCrtDiagnostics()?.active)throw Error('CRT did not activate');
 g.crtGuestSettings.setEnabled(false);await wait(300);snapshot('CRT off');
 if(g.getCrtDiagnostics()?.estimatedTargetBytes!==0)throw Error('disabled CRT still owns targets');
 g.crtGuestSettings.setEnabled(true);await wait(400);snapshot('CRT restored');
 if(!g.getCrtDiagnostics()?.active)throw Error('CRT failed to re-enable');g.crtGuestSettings.setEnabled(false);
});
button('Repeated viewport events',async()=>{
 await wait(200);const before=resizes;
 for(let i=0;i<20;i++)window.dispatchEvent(new Event('resize'));
 await wait(100);snapshot('duplicate resize events');if(resizes!==before)throw Error('unchanged viewport reallocated');
});
async function recoverGraphics(){
 const ext=g.renderer.getContext().getExtension('WEBGL_lose_context');if(!ext)throw Error('loss simulation unsupported');
 ext.loseContext();await wait(150);const stopped=g.frameStats.frame;
 if(!g.getGraphicsRecoveryDiagnostics().lost)throw Error('context loss not observed');
 await wait(150);if(g.frameStats.frame!==stopped)throw Error('simulation advanced while context was lost');
 ext.restoreContext();await wait(1800);snapshot('graphics restored');
 if(g.getGraphicsRecoveryDiagnostics().lost||g.frameStats.frame<=stopped)throw Error('rendering did not recover');
}
button('Lose and restore graphics',recoverGraphics);
button('Treehouse graphics recovery',async()=>{
 g.switchLevel('treehouse-trail');g.gameFlow.hide();await g.getLevel().prepareJungleAssets();await wait(700);
 snapshot('compressed Treehouse before loss');await recoverGraphics();
});
panel.append(report);document.body.append(panel);show('Ready');
