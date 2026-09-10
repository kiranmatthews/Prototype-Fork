import * as THREE from 'three';
import './lab.css';
import { RooTypeGeometry, loadRooVectors, createRooMaterial, ROO_BEVEL } from './geometry';
import { RooAtlasPainter, loadRooAtlases } from './atlas';

async function main() {
const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `
<header><strong>ROO / BEVEL & LIGHT</strong><span>Original outlines. Cut faces. Moving light.</span><a href="./">Back to game</a></header>
<main><div class="stage"><canvas aria-label="Live three-dimensional Roo text"></canvas><canvas class="baked" aria-label="Roo PNG image font" hidden></canvas><div class="stamp">Codex/sol fork · Original RooRegular.ttf</div></div>
<aside><h1>Chiselled Roo</h1><p>Move across the lettering to move the key light. The bevel catches it as the letters turn.</p>
<label>Rendering<select id="mode"><option value="live">Live 3D · moving light</option><option value="baked">PNG font · baked light</option></select></label>
<label>Title<input id="text" type="text" value="BONUS" maxlength="24"></label>
<label>Title cap height <span id="size-v"></span><input id="size" type="range" min="70" max="190" value="166"></label>
<label>Title letter spacing <span id="tracking-v"></span><input id="tracking" type="range" min="-0.025" max="0.12" step="0.001" value="0.012"></label>
<label>Bevel width <span id="bevel-v"></span><input id="bevel" type="range" min="0.008" max="0.045" step="0.001" value="0.032"></label>
<label>Turn <span id="turn-v"></span><input id="turn" type="range" min="-25" max="25" step="0.5" value="0"></label>
<label class="check"><input id="motion" type="checkbox" checked>Gentle motion & light flicker</label>
<label class="check"><input id="backdrop" type="checkbox">Light background</label>
<button id="reset">Reset light & pose</button>
<button id="png" class="primary">Export transparent title PNG</button>
<button id="atlas">Export PNG image font + metrics</button>
<div id="report" aria-live="polite">Loading Roo outlines…</div></aside></main>`;

const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const stage = document.querySelector<HTMLDivElement>('.stage')!;
const canvas = stage.querySelector('canvas')!;
const bakedCanvas = stage.querySelector<HTMLCanvasElement>('.baked')!;
const painter = new RooAtlasPainter();
void loadRooAtlases();
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.z = 20;
const bonus = createRooMaterial('bonus'), counter = createRooMaterial('counter');
const source = await loadRooVectors();
let factory = new RooTypeGeometry(source);
let groups: THREE.Group[] = [], captions: THREE.Sprite[] = [];
let width = 0, height = 0;
let frozenTime: number | null = null;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
if (reduce.matches) input('motion').checked = false;
const light = new THREE.Vector3(-0.65, 0.85, 0.95).normalize();

function caption(text: string, x: number, y: number) {
  const c = document.createElement('canvas'); c.width = 1100; c.height = 50;
  const ctx = c.getContext('2d')!; ctx.font = '22px system-ui'; ctx.fillStyle = '#94a9be'; ctx.textAlign = 'center';
  ctx.fillText(text, 550, 33);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false }));
  sprite.scale.set(550, 25, 1); sprite.position.set(x,y,1); scene.add(sprite); captions.push(sprite);
}
function rebuild() {
  for (const g of groups) scene.remove(g); groups = [];
  for (const s of captions) { scene.remove(s); s.material.map?.dispose(); s.material.dispose(); } captions = [];
  const tracking = +input('tracking').value;
  const rows = [
    { text: input('text').value || 'BONUS', size: +input('size').value, y: height * .24, mat: bonus, tracking },
    { text: '0/23   99   100', size: 107, y: -height * .035, mat: counter, tracking: .07 },
    { text: 'ABCDEFGHIJKLM', size: 56, y: -height * .245, mat: bonus, tracking: .32 },
    { text: 'NOPQRSTUVWXYZ', size: 56, y: -height * .34, mat: bonus, tracking: .32 },
  ];
  for (const row of rows) {
    const g = factory.line(row.text, row.mat, row.tracking);
    g.userData.tracking=row.tracking;
    const scale = Math.min(row.size, (width-60)/Math.max(.001,g.userData.width));
    g.scale.setScalar(scale); g.position.y = row.y; scene.add(g); groups.push(g);
  }
  caption(`TITLE · ${Math.round(groups[0].scale.x)} px cap band`,0, height*.24 + groups[0].scale.x*.73);
  caption(`HUD COUNTERS · ${Math.round(groups[1].scale.x)} px cap band`,0, -height*.035 + 88);
  caption(`CHARACTER PROOF · ${Math.round(groups[2].scale.x)} px cap band`,0, -height*.245 + 50);
  for (const id of ['size','tracking','bevel','turn']) document.getElementById(id+'-v')!.textContent =
    id==='size' ? input(id).value+' px' : id==='turn' ? input(id).value+'°' : (100 * +input(id).value).toFixed(1)+'%';
  document.getElementById('report')!.textContent = `Bevel: ${(+input('bevel').value * +input('size').value).toFixed(1)} px at title size\nSpacing: ${(tracking * +input('size').value).toFixed(1)} px + Roo advances\nLive mesh → same-material PNG\nNo outline or drop shadow`;
}
function resize() {
  width = stage.clientWidth; height = Math.max(640,stage.clientHeight);
  // Two physical samples per CSS pixel even on a 1× display, plus MSAA.
  renderer.setPixelRatio(Math.min(3,Math.max(2,window.devicePixelRatio)));
  renderer.setSize(width,height,false);
  camera.left=-width/2; camera.right=width/2; camera.top=height/2; camera.bottom=-height/2; camera.updateProjectionMatrix(); rebuild();
}
new ResizeObserver(resize).observe(stage);
for (const id of ['text','size','tracking','turn']) input(id).addEventListener('input',rebuild);
input('bevel').addEventListener('input',()=>{ factory.dispose(); factory=new RooTypeGeometry(source,+input('bevel').value); rebuild(); });
input('backdrop').onchange=()=>stage.classList.toggle('light',input('backdrop').checked);
input('mode').onchange=()=>{
  const baked=input('mode').value==='baked';
  for(const id of ['bevel','turn','motion'])input(id).disabled=baked;
  document.querySelector('aside p')!.textContent=baked
    ? 'The shipped PNG font uses fixed lighting. Size and spacing remain editable. Switch to Live 3D to change the bevel or turn the letters.'
    : 'Move across the lettering to move the key light. The bevel catches it as the letters turn.';
};
stage.addEventListener('pointermove',e=>{const r=stage.getBoundingClientRect();light.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2,.95).normalize();});
document.getElementById('reset')!.onclick=()=>{light.set(-.65,.85,.95).normalize();input('turn').value='0';rebuild();};
function render(ms: number) {
  const t=(frozenTime ?? ms)/1000;
  const moving=input('motion').checked;
  const yaw=THREE.MathUtils.degToRad(+input('turn').value)+(moving?Math.sin(t*.55)*.045:0);
  for(let i=0;i<groups.length;i++) groups[i].rotation.set(moving?Math.sin(t*.43+i*.16)*.018:0,yaw,0);
  for(const material of [bonus,counter]) {
    material.uniforms.uLight.value.copy(light);
    material.uniforms.uIntensity.value=moving?1+.022*Math.sin(t*4.1)+.013*Math.sin(t*7.3):1;
  }
  const baked=input('mode').value==='baked';
  bakedCanvas.hidden=!baked;
  if(baked){
    const ctx=bakedCanvas.getContext('2d')!,ratio=renderer.getPixelRatio();
    if(bakedCanvas.width!==Math.round(width*ratio)||bakedCanvas.height!==Math.round(height*ratio)){
      bakedCanvas.width=Math.round(width*ratio);bakedCanvas.height=Math.round(height*ratio);
    }
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
    const texts=[input('text').value||'BONUS','0/23   99   100','ABCDEFGHIJKLM','NOPQRSTUVWXYZ'];
    groups.forEach((g,i)=>painter.draw(ctx,texts[i],width/2,height/2-g.position.y,
      {size:g.scale.x,tracking:g.userData.tracking*g.scale.x,palette:i===1?'counter':'bonus',align:'center'}));
    for(const sprite of captions){const map=sprite.material.map!;ctx.drawImage(map.image,width/2-275,height/2-sprite.position.y-12.5,550,25);}
  }
  for(const g of groups)g.visible=!baked;
  for(const s of captions)s.visible=!baked;
  renderer.render(scene,camera);
}
renderer.setAnimationLoop(render);
resize();

function download(name: string, data: Blob | string) {
  const a=document.createElement('a'); a.download=name; a.href=typeof data==='string'?data:URL.createObjectURL(data); a.click();
  if(typeof data!=='string')setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function exportTitle() {
  const { renderRooPng } = await import('./bake');
  const image=renderRooPng(renderer,factory,input('text').value||'BONUS',bonus,+input('size').value*2,+input('tracking').value);
  download('roo-title.png',image.toDataURL('image/png'));
}
document.getElementById('png')!.onclick=()=>void exportTitle();
document.getElementById('atlas')!.onclick=async()=>{
  const [{ bakeRooAtlas },{zipSync,strToU8}]=await Promise.all([import('./bake'),import('three/examples/jsm/libs/fflate.module.js')]);
  const files:Record<string,Uint8Array>={};
  for(const [name,material] of [['bonus',bonus],['counter',counter]] as const){
    const result=bakeRooAtlas(renderer,factory,material,name);
    const blob=await new Promise<Blob>(resolve=>result.canvas.toBlob(value=>resolve(value!),'image/png'));
    files[`roo-${name}-v1.png`]=new Uint8Array(await blob.arrayBuffer());
    files[`roo-${name}-v1.json`]=strToU8(JSON.stringify(result.metrics,null,2));
  }
  files['README.txt']=strToU8('Roo image font: each PNG has transparent padding. Use the JSON glyph crop, left/top bearings and advance. All positions are in cap-band units; multiply by your desired cap height. PNG capPixels=256. Preserve the same cap height and baseline across changing numbers. Lighting is baked; use the RooTypeGeometry live material for moving light.');
  download('roo-image-font.zip',new Blob([zipSync(files,{level:0})],{type:'application/zip'}));
};
Object.assign(window,{rooTypeLab:{renderer,source,scene,camera,bonus,counter,get factory(){return factory;},
  setTime:(value:number|null)=>{frozenTime=value;render(value??0);},render,
  async bake(){const {bakeRooAtlas}=await import('./bake');return ['bonus','counter'].map(name=>{
    const result=bakeRooAtlas(renderer,factory,name==='bonus'?bonus:counter,name as 'bonus'|'counter');
    return {name,metrics:result.metrics,png:result.canvas.toDataURL('image/png')};
  });},
  metrics:()=>({capBand:source.capBand,titleWidth:groups[0].userData.width*groups[0].scale.x,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,bevel:ROO_BEVEL}),ready:true}});
}
void main().catch(error=>{document.getElementById('report')!.textContent=`Unable to load Roo: ${String(error)}`;console.error(error);});
