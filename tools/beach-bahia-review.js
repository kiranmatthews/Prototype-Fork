// Local-only review UI. Uses the real game renderer, lighting, physics and assets.
import * as THREE from 'three';
import {BEACH_KITE_BEATS as beats,BEACH_KITE_JUMPS as jumps} from '../src/levels/beach-street-gameplay.ts';
import {runRoute} from './beach-bahia-pilot.js';
const g=await new Promise(resolve=>{const ready=()=>{const game=window.__game;if(game&&!game.gameFlow.blocksGameplay)resolve(game);else requestAnimationFrame(ready);};ready();});
g.restoreBuiltin('coastal-street-run');await g.switchLevel('coastal-street-run');await g.getLevel().prepareJungleAssets();
const panel=document.createElement('section');panel.style.cssText='position:fixed;z-index:2147483646;left:10px;top:10px;padding:8px;background:#11262ee8;color:white;font:12px monospace;max-width:680px';
const buttons=document.createElement('div'),status=document.createElement('pre');status.style.cssText='white-space:pre-wrap;max-height:80px;overflow:auto';panel.append(buttons,status);document.body.append(panel);
let eye=null,target=[0,0,0],angle=52;
const render=g.renderer.render.bind(g.renderer),view=g.getLevel().updateSceneryView.bind(g.getLevel()),step=g.player.step.bind(g.player);
g.player.step=(...args)=>{if(!eye)step(...args);};
function camera(){if(!eye)return;g.camera.position.fromArray(eye);g.camera.up.set(0,1,0);g.camera.fov=angle;g.camera.lookAt(new THREE.Vector3().fromArray(target));g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld(true);}
g.getLevel().updateSceneryView=(c,...args)=>{camera();view(c,...args);};
g.renderer.render=(scene,c)=>{
 if(scene===g.scene&&c===g.camera&&eye){camera();view(c);}
 // A detached still camera must not stretch the frozen rider's kite lines
 // through a shop. Hide only the player for stills; Play restores real play.
 const actors=eye?[g.player.group,g.player.kiteVisual?.root].filter(Boolean):[],visibility=actors.map(o=>o.visible);
 actors.forEach(o=>o.visible=false);
 try{render(scene,c);}finally{actors.forEach((o,i)=>o.visible=visibility[i]);}
};
const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.style.margin='3px';b.onclick=fn;buttons.append(b);};
const shot=(e,t,f=52)=>{eye=e;target=t;angle=f;g.crtGuestSettings.setEnabled(false);g.renderQualitySettings.setRegularResolution(null);};
const source=g.getLevel().builtFromData;
for(const [label,kind]of [['Snack Shack','snack'],['Funville','funville'],['Bahia Pizza','pizza']]){
 const c=source.components.find(c=>c.nm===`Bahia ${kind} / interior floor`),p=c.p;
 button(label,()=>shot([p[0]+20,p[1]+6,p[2]+7],[p[0]+1.8,p[1]+3.8,p[2]],49));
 button(label+' detail',()=>shot([p[0]+13,p[1]+3.4,p[2]+4],[p[0]+3.9,p[1]+2.7,p[2]],59));
}
button('Beach opening',()=>shot([2,15,-37],[31,.4,-72],60));
button('Wall detail',()=>shot([3.7,13.8,-49],[8.4,12.7,-57],62));
button('Beach-side entry',()=>shot([13,13.9,-47],[6.7,12.9,-59],66));
button('Shore and islands',()=>shot([33,6,-151],[94,3,-217],64));
button('High road beach',()=>shot([1,19,-1174],[38,0,-1218],61));
button('Long coast',()=>shot([60,19,-2880],[14,7,-2985],63));
let placement=0;
const shopFloors=source.components.filter(c=>/^Bahia .* \/ interior floor$/.test(c.nm??''));
button('Next shop placement',()=>{
 const floor=shopFloors[placement++%shopFloors.length],p=floor.p;
 shot([p[0]+20,p[1]+6,p[2]+7],[p[0]+1.8,p[1]+3.8,p[2]],49);
 status.dataset.shop=floor.nm+' '+placement+'/'+shopFloors.length;
});
button('Native MAX',()=>{g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
button('Normal presentation',()=>{g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
button('Play',()=>{eye=null;g.player.respawn(g.getLevel(),true);});
button('Run full route',()=>{eye=null;runRoute({beats,jumps,preview:false});});
button('Hide controls',()=>panel.style.opacity=panel.style.opacity==='0'?'1':'0');
setInterval(()=>{const p=window.__kitePilot,l=g.getLevel();status.textContent=JSON.stringify({ready:true,assets:l.jungleAssetDiagnostics?.errors??[],buffer:[g.renderer.domElement.width,g.renderer.domElement.height],position:g.player.pos.toArray(),route:p?{done:p.done,crashes:p.crashes,checkpoints:p.checkpoints.length,jumps:p.jumps.length,final:p.final}:null,stamp:document.querySelector('.hud-build')?.textContent});},1000);
shot([2,15,-37],[31,.4,-72],60);
