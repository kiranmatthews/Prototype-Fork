import * as THREE from 'three';
import { REEF_COLORS as C, ReefGeometry } from './reefGeometry';

/** Handbuilt fictional reef village: no borrowed cultural emblems. Rigid
 * decorations are batched, with wind-owned palms, banners and canoes separate. */
export class ReefScenery {
  readonly root = new THREE.Group();
  private readonly leaves: THREE.Group[] = [];
  private readonly banners: THREE.Group[] = [];
  private readonly canoes: THREE.Group[] = [];
  private readonly surf: THREE.Mesh[] = [];
  readonly waterTime = { value: 0 };
  constructor(kit: ReefGeometry) {
    this.root.name = 'Low-poly sunset reef village';
    const rigid = new THREE.Group(); this.root.add(rigid);
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // Original banded sunset replaces the shared fantasy-cliff sky painting.
    // Vertex color and an unlit low-poly dome keep the reef horizon coherent
    // in full/lite rendering without another texture, pass or external asset.
    const skyGeometry = new THREE.SphereGeometry(260, 32, 12), positions = skyGeometry.getAttribute('position');
    const colors = [], bottom = new THREE.Color('#edb28b'), middle = new THREE.Color('#b4778e'), top = new THREE.Color('#586989');
    for (let i = 0; i < positions.count; i++) { const h = THREE.MathUtils.clamp(positions.getY(i) / 135, 0, 1);
      const color = h < .45 ? bottom.clone().lerp(middle, h / .45) : middle.clone().lerp(top, (h - .45) / .55);
      colors.push(color.r, color.g, color.b); }
    skyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(skyGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.position.z = -14; sky.renderOrder = -100; this.root.add(sky);
    const sunset = new THREE.Group(); sunset.position.set(-80, 9, -165); this.root.add(sunset);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(10, 32), new THREE.MeshBasicMaterial({ color: '#fff0b4', fog: false })); sunset.add(sun);
    for (let i = 0; i < 5; i++) { const band = new THREE.Mesh(new THREE.BoxGeometry(19, .22 + i * .11, .05),
      new THREE.MeshBasicMaterial({ color: i < 2 ? '#d99b8f' : '#ecb28c', fog: false }));
      band.position.set(0, -1.2 - i * 1.3, .07); sunset.add(band); }
    const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 320, 32, 24),
      new THREE.MeshStandardMaterial({ color: '#277b8e', roughness: .48, metalness: .25, flatShading: true }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -2.9, -30); water.receiveShadow = true;
    water.material.onBeforeCompile = shader => {
      shader.uniforms.reefTime = this.waterTime;
      shader.vertexShader = 'uniform float reefTime;\n' + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.z += sin(position.x*.15+reefTime*.9)*.18 + cos(position.y*.12-reefTime*.7)*.12;');
    };
    this.root.add(water);
    for (let i = 0; i < 32; i++) {
      const a = i * Math.PI / 16, x = Math.cos(a) * (25 + (i % 3)), z = -14 + Math.sin(a) * 27;
      kit.mesh(rigid, 'ball', i % 2 ? '#97795f' : '#d9b68c', [x, -1.8, z], [2 + (i % 2), 2, 2.6]);
      const foam = kit.mesh(this.root, 'ball', '#b8eee0', [x * 1.04, -2.45, -14 + (z + 14) * 1.07], [2.5, .06, 1.4], .18);
      foam.userData.home = foam.position.clone(); this.surf.push(foam);
      if (i % 3 === 0) for (let j = 0; j < 4; j++) {
        const coral = kit.mesh(rigid, 'cone', j % 2 ? '#e59382' : '#c96d7d', [x + Math.sin(j) * 1.1, -.4, z + Math.cos(j)], [.3, 2 + j * .25, .3]);
        coral.rotation.z = Math.sin(j + a) * .6;
      }
    }
    for (const side of [-1, 1]) {
      for (const z of [6, -9, -29, -43]) {
        const x = side * (27 + (z === -9 ? 2 : 0)), y = z === -43 ? 1 : -.3;
        kit.mesh(rigid, 'round', '#42635b', [x, y - 1.5, z], [6, 3, 5]);
        let last = v(x, y, z);
        for (let h = 0; h < 7; h++) {
          const next = v(x + side * h * h * .035, y + h + 1, z + h * .12);
          kit.segment(rigid, last, next, .48 - h * .025, h % 2 ? '#a77b4e' : C.wood); last = next;
        }
        const canopy = new THREE.Group(); canopy.position.copy(last); this.root.add(canopy); this.leaves.push(canopy);
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4, leaf = kit.mesh(canopy, 'ball', i % 2 ? '#519b76' : '#28765f', [Math.sin(a) * 2.2, -.45, Math.cos(a) * 2.2], [.72, .25, 3.2]);
          leaf.rotation.y = a; leaf.rotation.x = .24;
        }
        for (let i = 0; i < 3; i++) kit.mesh(canopy, 'ball', C.wood, [Math.sin(i * 2) * .6, -.8, Math.cos(i * 2) * .6], [.4, .5, .4]);
        kit.batch(canopy);
      }
      // Open meeting houses with individual thatch ridges and woven screens.
      const hx = side * 34, hz = -31;
      for (const dx of [-3, 3]) for (const dz of [-3, 3]) kit.segment(rigid, v(hx + dx, -1, hz + dz), v(hx + dx, 5.5, hz + dz), .23, C.wood);
      for (const slope of [-1, 1]) for (let i = 0; i < 10; i++) {
        const roof = kit.mesh(rigid, 'box', i % 2 ? '#d9ac65' : '#ba874d', [hx + slope * 2.2, 5.7, hz + (i - 4.5) * .7], [5.8, .25, .8]); roof.rotation.z = -slope * .55;
      }
      const banner = new THREE.Group(); banner.position.set(side * 24, 5, -4); this.root.add(banner); this.banners.push(banner);
      kit.segment(rigid, v(side * 24, 0, -4), v(side * 24, 5.5, -4), .12, C.wood);
      for (let i = 0; i < 7; i++) {
        const strip = kit.mesh(banner, 'box', i % 2 ? C.teal : C.gold, [side * (.4 + i * .3), -.65, 0], [.3, 1.3 - i * .06, .035]); strip.rotation.z = side * -.07;
      }
      kit.batch(banner);
      for (const z of [15, -4, -23]) {
        const canoe = new THREE.Group(); canoe.position.set(side * (35 + z * .1), -1.8, z); canoe.rotation.y = side * .3;
        this.root.add(canoe); this.canoes.push(canoe);
        kit.mesh(canoe, 'ball', '#9a4d38', [0, 0, 0], [1, .45, 5]);
        kit.mesh(canoe, 'ball', '#423c3e', [0, .25, 0], [.68, .16, 3.7]);
        for (const dz of [-2, 1]) kit.segment(canoe, v(-.8, .35, dz), v(-3.6, .35, dz), .12, C.wood);
        kit.mesh(canoe, 'ball', '#bd8753', [-3.6, .15, -.5], [.3, .3, 3.5]);
        kit.segment(canoe, v(0, .2, 0), v(0, 5.5, 0), .13, C.wood);
        const sail = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 5.3, 0, 0, .8, 0, 3, 1, 0], 3)), kit.material(C.cream));
        sail.geometry.computeVertexNormals(); sail.material.side = THREE.DoubleSide; canoe.add(sail); kit.batch(canoe);
      }
    }
    // Shell-carved victory arch and low distant islands frame the horizon.
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
      const a = i * .22, x = side * (5.4 - Math.sin(a) * 4.6), y = i * 1.25;
      const stone = kit.mesh(rigid, 'ball', i % 2 ? '#bcb391' : '#dfc89e', [x, y, -49], [1.3, .95, 1.25]); stone.rotation.z = side * a;
      kit.mesh(rigid, 'ball', C.teal, [x, y, -47.85], [.28, .22, .1], .2);
    }
    for (let i = 0; i < 7; i++) kit.mesh(rigid, 'round', '#536c70', [(i - 3) * 35, -2, -125 - (i % 2) * 28], [19, 7 + i % 3 * 3, 13]);
    kit.batch(rigid);
  }
  update(time: number, storm: number): void {
    this.waterTime.value = time;
    for (let i = 0; i < this.leaves.length; i++) this.leaves[i].rotation.z = Math.sin(time * (1.2 + storm * .4) + i) * (.035 + storm * .04);
    for (let i = 0; i < this.banners.length; i++) this.banners[i].rotation.y = Math.sin(time * 2 + i) * (.2 + storm * .2);
    for (let i = 0; i < this.canoes.length; i++) { this.canoes[i].position.y = -1.8 + Math.sin(time * 1.4 + i) * .12; this.canoes[i].rotation.z = Math.sin(time * .9 + i) * .04; }
    for (let i = 0; i < this.surf.length; i++) { const foam = this.surf[i], home = foam.userData.home as THREE.Vector3;
      foam.position.y = home.y + Math.sin(time * 1.2 + i * .4) * .06; foam.scale.x = 2.5 + Math.sin(time * .8 + i) * .35; }
  }
}
