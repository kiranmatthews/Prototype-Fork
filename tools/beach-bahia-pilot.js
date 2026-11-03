// Existing Beach Street keyboard pilot, exposed by the local review UI.
export function runRoute({beats,jumps,preview}){
  const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true);p.lives=99;
  g.renderQualitySettings.setRegularResolution(preview?null:480);g.crtGuestSettings.setEnabled(!preview);
  const keys=new Set(),used=new Set();let releasedUntil=-1,cp='',lastTrace=-1;
  const pad=l.bonusPlatformDiagnostics,padContactZ=l.kiteBonusPad?.body.z;
  const state=window.__kitePilot={done:false,crashes:[],trace:[],jumps:[],checkpoints:[],keys:[],maxGripError:0,canopyBounds:{minX:1,maxX:-1,minY:1,maxY:-1},canopyClips:[]};
  let frame=0;
  const key=(code,down)=>{if(keys.has(code)===down)return;if(down)keys.add(code);else keys.delete(code);document.body.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code==='Space'?' ':code,bubbles:true}));state.keys.push({z:-p.pos.z,code,down});};
  const line=z=>{let a={z:-15,lane:0,kind:'rest'};for(const b of beats){if(z<b.z+(b.kind==='gap'?25:7)){const leave=a.z+(a.kind==='gap'?25:7),arrive=b.z-(b.kind==='gap'?25:17),t=Math.max(0,Math.min(1,(z-leave)/Math.max(1,arrive-leave)));return a.lane+(b.lane-a.lane)*t*t*(3-2*t);}a=b;}return 0;};
  const snap=()=>({z:-p.pos.z,x:p.pos.x,y:p.pos.y,state:p.state,grounded:p.grounded,lives:p.lives,speed:p.speed,crates:p.cratesBroken,totalCrates:l.totalCrates,bonusCrates:l.bonusCrateTotal,crystal:p.hasCrystal,gem:p.gemEarned});
  const run=()=>{
   if(state.done)return;
   const z=-p.pos.z;
   if(p.state==='dead'||p.state==='gameover'){state.crashes.push(snap());state.done=true;}
   if(p.state==='finished'||preview&&z>215)state.done=true;
   if(state.done){for(const c of [...keys])key(c,false);state.final=snap();return;}
   if(p.kiteReleased){
    if(!state.release){state.release={...snap(),at:p.runTime};for(const c of [...keys])key(c,false);}
    const elapsed=p.runTime-state.release.at,walking=elapsed>=6.4;
    if(elapsed>=3)state.waitingAtFinish??=snap();
    if(elapsed>=3.8)state.walkedRight??=snap();
    if(!walking){
     key('ArrowRight',elapsed>=3&&elapsed<3.8);key('ArrowLeft',elapsed>=3.8&&elapsed<4.6);
     key('ArrowDown',elapsed>=4.6&&elapsed<5.4);
    }
    if(walking){
     state.walkedBack??=snap();key('ArrowDown',false);
     key('ArrowLeft',p.pos.x>.1);key('ArrowRight',p.pos.x<-.1);key('ArrowUp',true);
     if(z>=3000.5&&state.finishJumpAt===undefined)state.finishJumpAt=p.runTime;
     key('Space',state.finishJumpAt!==undefined&&p.runTime-state.finishJumpAt<.10);
    }
    requestAnimationFrame(run);return;
   }
   let target=line(z+2);
   // Bypass to the left, then steer toward the next planter's right opening
   // as soon as the tilted pad's actual contact plane clears. Waiting until
   // after its visual centre wastes turning room against a sustained gust.
   if(pad&&padContactZ!==undefined&&z>-pad.z-14&&z<-pad.z+18){
    target=z<-padContactZ?pad.x-2.1:3.8;
    state.bonusBypass??={contactZ:padContactZ,centreZ:pad.z,trace:[]};
    if(!state.bonusBypass.trace.length||z-state.bonusBypass.trace.at(-1).z>=1)
     state.bonusBypass.trace.push({...snap(),target,wind:p.kiteMotion.wind,lateral:p.kiteMotion.lateral});
   }
   const error=target-p.pos.x-(p.kiteMotion?.lateral??0)*.12;
   // Real DOM keyboard events: no teleports, velocity writes or invulnerability.
   key('ArrowRight',error>.10);key('ArrowLeft',error<-.10);
   const jump=jumps.find(j=>!used.has(j.name)&&z>=j.at-.5);
   if(jump){used.add(jump.name);releasedUntil=p.runTime+.10;state.jumps.push({name:jump.name,...snap()});}
   key('Space',p.runTime>=releasedUntil);
   const checkpoint=l.currentSpawn.toArray().join(',');if(cp!==checkpoint){cp=checkpoint;state.checkpoints.push({spawn:l.currentSpawn.toArray(),...snap()});}
   if(Math.floor(z/30)>lastTrace){lastTrace=Math.floor(z/30);state.trace.push(snap());}
   state.maxGripError=Math.max(state.maxGripError,...(p.kiteVisual?.gripErrors??[0]));
   if(z>20&&p.kiteTowing&&p.kiteVisual?.root.visible&&frame++%6===0){
    const v=p.pos.clone();let clips=false;
    p.kiteVisual.sail.traverse(o=>{const a=o.geometry?.getAttribute('position');if(!a)return;for(let i=0;i<a.count;i++){
     v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).project(g.camera);const b=state.canopyBounds;
     b.minX=Math.min(b.minX,v.x);b.maxX=Math.max(b.maxX,v.x);b.minY=Math.min(b.minY,v.y);b.maxY=Math.max(b.maxY,v.y);
     clips ||= Math.abs(v.x)>1.02||Math.abs(v.y)>1.02;
    }});
    if(clips&&state.canopyClips.length<12)state.canopyClips.push(snap());
   }
   requestAnimationFrame(run);
  };run();
}
