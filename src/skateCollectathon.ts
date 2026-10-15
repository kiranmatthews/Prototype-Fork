import * as THREE from 'three';

/** Small opt-in objective for data-authored parks. Wumpa markers become tokens;
 * ordinary courses retain their original pickups and campaign rewards. */
export class SkateCollectathon {
  constructor(private readonly warehouseArt=false){}
  readonly tokens: { group: THREE.Group; box: THREE.Box3; name: string; collected: boolean; y: number }[] = [];
  private signs: { texture: THREE.CanvasTexture; canvas: HTMLCanvasElement }[] = [];
  get collected(): number { return this.tokens.filter(t => t.collected).length; }
  get complete(): boolean { return this.tokens.length > 0 && this.tokens.every(t => t.collected); }

  add(root: THREE.Group, p: [number, number, number], name: string): void {
    const group = new THREE.Group(); group.position.fromArray(p);
    const token = new THREE.Mesh(new THREE.OctahedronGeometry(.65),
      new THREE.MeshStandardMaterial({ color: 0xf3f3f3, emissive: 0x444444, roughness: .3, metalness: .35 }));
    group.add(token);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.95, .045, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    group.add(ring); root.add(group);
    this.tokens.push({ group, box: new THREE.Box3().setFromCenterAndSize(group.position, new THREE.Vector3(2, 2.2, 2)), name, collected: false, y: p[1] });
    const label = this.label(this.warehouseArt?name.slice(0,2):name.toUpperCase(), this.warehouseArt?1.2:6, this.warehouseArt?.6:.7);
    if(this.warehouseArt){label.position.set(0,2,0);group.add(label);}
    else {label.position.set(p[0], p[1] + 2, p[2]);root.add(label);}
  }

  entrance(root: THREE.Group, p: THREE.Vector3): void {
    if(this.warehouseArt)return;
    const sign = this.label('', 13, 4);
    sign.position.copy(p).add(new THREE.Vector3(0, 6.5, 11));
    root.add(sign); this.paintProgress();
  }

  private label(text: string, w: number, h: number): THREE.Sprite {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = Math.round(1024 * h / w);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(w, h, 1);
    if (text) {
      const c = canvas.getContext('2d')!; c.fillStyle = this.warehouseArt?'#193037':'#202225';
      if(this.warehouseArt){c.beginPath();c.arc(512,canvas.height/2,canvas.height*.44,0,Math.PI*2);c.fill();c.lineWidth=12;c.strokeStyle='#c29448';c.stroke();}
      else c.fillRect(0,0,canvas.width,canvas.height);
      c.fillStyle = this.warehouseArt?'#ffe2a3':'#eeeeee'; c.font = `bold ${this.warehouseArt?Math.round(canvas.height*.53):58}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(text, 512, canvas.height / 2, 980);
    } else this.signs.push({ texture, canvas });
    return sprite;
  }

  private paintProgress(): void {
    for (const { texture, canvas } of this.signs) {
      const c = canvas.getContext('2d')!;
      c.fillStyle = '#202225'; c.fillRect(0, 0, canvas.width, canvas.height);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#eeeeee';
      c.font = 'bold 70px sans-serif'; c.fillText('WAREHOUSE / FIVE LINES', 512, 58);
      c.font = '42px sans-serif'; c.fillText(this.complete ? 'ALL TOKENS FOUND / EXIT OPEN' : 'FIND THE FIVE HIGH TOKENS', 512, 129);
      c.fillText(`${this.collected} / ${this.tokens.length}     •     RETURN TO THIS PAD`, 512, 190);
      c.font = '30px sans-serif'; c.fillText('NO TIMER  /  EXPLORE  /  LINK YOUR LINES', 512, 257);
      texture.needsUpdate = true;
    }
  }

  collect(box: THREE.Box3): string[] {
    const names: string[] = [];
    // Earn the actual high area, rather than touching its pickup through the
    // underside with the top of the player's tall collision box.
    for (const token of this.tokens) if (!token.collected && box.min.y >= token.y - 1.35 && box.intersectsBox(token.box)) {
      token.collected = true; token.group.visible = false; names.push(token.name);
    }
    if (names.length) this.paintProgress();
    return names;
  }
  update(time: number): void {
    for (const token of this.tokens) if (!token.collected) {
      token.group.rotation.y = time * 1.3;
      token.group.position.y = token.y + Math.sin(time * 2.2) * .15;
    }
  }
  reset(hard: boolean): void {
    if (!hard) return;
    for (const token of this.tokens) { token.collected = false; token.group.visible = true; }
    this.paintProgress();
  }
}
