import * as THREE from 'three';
import { createCrateArt } from '../../src/crateArt';
import { illustratedCrateHud } from '../../src/illustratedCrateHud';
import { illustratedFruitHud } from '../../src/illustratedFruitHud';
import { CRATE_HUD_VIEW, createCrateHudCamera, crateHudScale } from '../../src/crateHudCamera';

const host = document.querySelector<HTMLElement>('#preview')!;
const renderer = new THREE.WebGLRenderer({canvas: document.querySelector<HTMLCanvasElement>('#render')!, alpha: true, antialias: true});
renderer.setPixelRatio(devicePixelRatio);
renderer.autoClear = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 2));
const key = new THREE.DirectionalLight(0xffffff, 2.1);key.position.set(.5,.9,1);scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff,.7);fill.position.set(-.8,-.2,.5);scene.add(fill);
const oldArt = createCrateArt('wood',1);
const old = oldArt.root;
const crate = illustratedCrateHud();
const fruit = illustratedFruitHud();
void oldArt.ready.then(() => {
  const shell = crate.getObjectByName('Illustrated crate / complete carved surface') as THREE.Mesh;
  const triangles = (geometry: THREE.BufferGeometry) => (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  document.body.dataset.sourceTriangles = String(triangles(oldArt.shell.geometry));
  document.body.dataset.hudTriangles = String(triangles(shell.geometry));
  document.body.dataset.sharedGeometry = String(shell.geometry === oldArt.shell.geometry);
  document.body.dataset.privateMaterial = String(shell.material !== oldArt.shell.material);
});
const models = [old, crate, fruit].map(model => {
  const spin = new THREE.Group(); spin.add(model);
  const pivot = new THREE.Group(); pivot.add(spin);scene.add(pivot);
  return {model, spin, pivot};
});
const ortho = new THREE.OrthographicCamera(-.5,.5,.5,-.5,-500,500);
let perspective = createCrateHudCamera();
let tilt = CRATE_HUD_VIEW.tilt, angle = CRATE_HUD_VIEW.yaw, playing = true;
const tiltInput = document.querySelector<HTMLInputElement>('#tilt')!;
const lensInput = document.querySelector<HTMLInputElement>('#lens')!;
const update = () => {
  tilt = THREE.MathUtils.degToRad(Number(tiltInput.value));
  perspective = createCrateHudCamera(Number(lensInput.value));
  document.querySelector('#tilt-value')!.textContent = `${tiltInput.value}°`;
  document.querySelector('#lens-value')!.textContent = `${lensInput.value} mm`;
  document.querySelector('#new-caption')!.textContent = `${tiltInput.value}° tilt · ${lensInput.value} mm lens`;
};
tiltInput.addEventListener('input',update);lensInput.addEventListener('input',update);
document.querySelector('#play')!.addEventListener('click',event => {playing=!playing;(event.target as HTMLElement).textContent=playing?'Pause rotation':'Play rotation';});
document.querySelector('#reset')!.addEventListener('click',()=>{tiltInput.value='17';lensInput.value='100';angle=CRATE_HUD_VIEW.yaw;update();});
document.querySelector('#background')!.addEventListener('click',event=>{const light=document.body.classList.toggle('light');(event.target as HTMLElement).textContent=light?'Dark backdrop':'Light backdrop';});
const targets = [
  {el:document.querySelector<HTMLElement>('#before')!, index:0},
  {el:document.querySelector<HTMLElement>('#after')!, index:1},
  {el:document.querySelector<HTMLElement>('#small-crate')!, index:1},
  {el:document.querySelector<HTMLElement>('#small-fruit')!, index:2},
];
let previous = performance.now();
function frame(now:number) {
  const dt=Math.min((now-previous)/1000,.05);previous=now;
  if(playing)angle+=dt*CRATE_HUD_VIEW.turnRate;
  const area=host.getBoundingClientRect();
  const pixels = renderer.getSize(new THREE.Vector2());
  if (pixels.x !== area.width || pixels.y !== area.height) renderer.setSize(area.width,area.height,false);
  renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
  for(const {el,index} of targets){
    const rect=el.getBoundingClientRect(), aspect=rect.width/rect.height;
    for(let i=0;i<models.length;i++)models[i].pivot.visible=i===index;
    const {spin,pivot}=models[index];spin.rotation.y=angle;
    let camera:THREE.Camera=ortho;
    ortho.left=-aspect/2;ortho.right=aspect/2;ortho.updateProjectionMatrix();
    if(index===1){
      pivot.rotation.x=tilt;
      perspective.aspect=aspect;perspective.updateProjectionMatrix();
      pivot.scale.setScalar(crateHudScale(aspect,.515,Math.SQRT2*.515,perspective.position.z,tilt));
      camera=perspective;
    }else if(index===0){
      pivot.rotation.x=Math.atan(1/Math.SQRT2);
      pivot.scale.setScalar(Math.min(.94/(Math.cos(pivot.rotation.x)+Math.SQRT2*Math.sin(pivot.rotation.x)),aspect*.94/Math.SQRT2));
    }else{
      pivot.rotation.x=0;
      // Fruit geometry is authored at unit height; use its unscaled local bounds.
      const geometry=(models[index].model.children[0] as THREE.Mesh).geometry;
      geometry.computeBoundingBox();
      const size=geometry.boundingBox!.getSize(new THREE.Vector3());
      const centre=geometry.boundingBox!.getCenter(new THREE.Vector3());
      models[index].model.position.copy(centre).negate();
      pivot.scale.setScalar(Math.min(1,aspect)*.86/size.y);
    }
    renderer.setViewport(rect.left-area.left,area.bottom-rect.bottom,rect.width,rect.height);
    renderer.setScissor(rect.left-area.left,area.bottom-rect.bottom,rect.width,rect.height);
    renderer.clearDepth();renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
