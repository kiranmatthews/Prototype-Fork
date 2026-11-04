// Local-only visible fixture: production player, level, board model and solver.
import * as THREE from 'three';
import {createSkateboardPresentation} from '../src/skateboard/model';
const g:any=await new Promise(resolve=>{const wait=()=>{const game=(window as any).__game;game?resolve(game):requestAnimationFrame(wait);};wait();});
g.campaign.startEphemeral();const p=g.player,l=g.getLevel();await l.prepareJungleAssets();
const panel=document.createElement('div');panel.style.cssText='position:fixed;left:8px;top:8px;z-index:999999;background:#11251eee;color:white;padding:10px;max-width:330px;font:13px monospace';
panel.innerHTML='<strong>Loose boards · moving support</strong>';const buttons=document.createElement('div'),status=document.createElement('pre');status.id='board-platform-status';panel.append(buttons,status);document.body.append(panel);
let board:any=null,mover:any=null,elapsed=0,maxError=0,expected=new THREE.Vector3(),label='Ready',coasting=false;
const records:any[]=[];
function stage(index:number,roll=false){
 if(board)records.push({label,seconds:elapsed,maxError,rest:board.rest});
 l.discardedBoards.clear();mover=l.movers[index];mover.mesh.updateWorldMatrix(true,false);mover.mesh.geometry.computeBoundingBox();
 const top=mover.mesh.geometry.boundingBox.max.y;
 const at=new THREE.Vector3(-1.8,top+.12,0).applyMatrix4(mover.mesh.matrixWorld);
 p.respawn(l,true,true,{position:at,heading:new THREE.Vector3(0,0,-1)});g.gameFlow.hide();
 const source=createSkateboardPresentation();source.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(source);source.position.set(.6,top-bounds.min.y+.012,0).applyMatrix4(mover.mesh.matrixWorld);source.quaternion.copy(mover.mesh.quaternion);
 board=l.discardedBoards.spawn(source);board.breakStyle='none';l.discardedBoards.release(board);
 if(roll)board.velocity.set(0,0,-3).applyQuaternion(mover.mesh.quaternion);
 label=roll?'Coasting on ferry':index===0?'River ferry':mover.orbit&&mover.orbit[0]>0&&mover.orbit[1]>0?'Orbiting drum':'Vertical lift';elapsed=maxError=0;coasting=roll;
 expected.copy(mover.mesh.worldToLocal(board.root.position.clone()));
}
function button(text:string,action:()=>void){const b=document.createElement('button');b.textContent=text;b.style.cssText='margin:5px 3px 2px 0;padding:7px';b.onclick=action;buttons.append(b);}
button('Ferry',()=>stage(0));button('Lift',()=>stage(l.movers.findIndex((m:any)=>m.axisV.y!==0&&!m.orbit)));button('Orbit',()=>stage(l.movers.findIndex((m:any)=>m.orbit&&m.orbit[0]>0&&m.orbit[1]>0)));button('Coasting',()=>stage(0,true));
button('Native resolution',()=>g.renderQualitySettings.setRegularResolution(null));button('Normal resolution',()=>g.renderQualitySettings.setRegularResolution(720));
const native=l.discardedBoards.update.bind(l.discardedBoards);
l.discardedBoards.update=(dt:number,world:any)=>{native(dt,world);if(!board)return;elapsed+=dt;
 const local=mover.mesh.worldToLocal(board.root.position.clone());if(elapsed<.1)expected.copy(local);
 if(!coasting)maxError=Math.max(maxError,local.distanceTo(expected));
 status.textContent=JSON.stringify({scenario:label,seconds:+elapsed.toFixed(1),settled:board.rest,supportDriftMetres:+maxError.toFixed(6),boardWorld:board.root.position.toArray().map((n:number)=>+n.toFixed(2)),platformWorld:mover.mesh.position.toArray().map((n:number)=>+n.toFixed(2)),playerGrounded:p.grounded,counts:l.discardedBoards.diagnostics,records},null,1);
};
function expose(){panel.inert=false;panel.removeAttribute('aria-hidden');requestAnimationFrame(expose);}expose();
