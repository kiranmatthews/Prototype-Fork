import * as THREE from 'three';
import { milkBlob, MILK_SIZE, MILK_VARIANTS } from '../src/milk';
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x102b28); document.body.prepend(renderer.domElement);
const models = MILK_VARIANTS.map((name, i) => {
  const blob = milkBlob(MILK_SIZE, i); scene.add(blob);
  const label = document.createElement('div'); label.className = 'label';
  label.innerHTML = `${String(i + 1).padStart(2, '0')} / ${name}<small>HOVERING MILK</small>`; document.body.append(label);
  return { blob, label };
});
let moving = true, dark = true, angle = 0;
document.querySelector('#motion')!.addEventListener('click', event => {
  moving = !moving; const button = event.currentTarget as HTMLButtonElement;
  button.textContent = moving ? 'Rotation on' : 'Rotation off'; button.setAttribute('aria-pressed', String(moving));
});
document.querySelector('#backdrop')!.addEventListener('click', event => {
  dark = !dark; document.body.classList.toggle('light', !dark); renderer.setClearColor(dark ? 0x102b28 : 0x86988f);
  (event.currentTarget as HTMLButtonElement).textContent = dark ? 'Dark backdrop' : 'Light backdrop';
});
const point = new THREE.Vector3(); let last = performance.now(), width = 0, height = 0;
function frame(now: number) {
  const dt = Math.min(.05, (now - last) * .001); last = now;
  if (moving) angle += dt;
  const w = innerWidth, h = innerHeight, portrait = w < 600;
  if (width !== w || height !== h) {
    width = w; height = h; renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  camera.position.set(0, 0, portrait ? 7.9 : 6.5); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  models.forEach(({ blob, label }, i) => {
    blob.position.set(portrait ? (i % 2 - .5) * 1.25 : (i % 3 - 1) * 1.35,
      portrait ? .9 - Math.floor(i / 2) * 1.2 : .5 - Math.floor(i / 3) * 1.35, 0);
    blob.position.y += Math.sin(angle * 1.5 + i) * .035;
    blob.rotation.set(.13, angle * .35 + i * .42, -.08);
    point.copy(blob.position); point.y -= .51; point.project(camera);
    label.style.left = `${(point.x * .5 + .5) * w}px`; label.style.top = `${(-point.y * .5 + .5) * h}px`;
  });
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
