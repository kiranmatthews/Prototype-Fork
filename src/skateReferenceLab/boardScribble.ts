import * as THREE from 'three';
import {skateboardSettings} from '../skateboard/settings';

export const SCRIBBLE_FRAMES = 32;
export const SCRIBBLE_FPS = 60;
export const SCRIBBLE_DURATION = SCRIBBLE_FRAMES / SCRIBBLE_FPS;
// Only drawing 0 covers the full board. The smaller drawings handle both
// growth and clearing, at the same fixed pixel density and stroke weight.
const PARTIAL_FIRST = 14;
const PARTIAL_LAST = 31;
const APEX_DURATION = 1 / SCRIBBLE_FPS;
export const MOUNT_CLEAR_DURATION = (1 + PARTIAL_LAST - PARTIAL_FIRST + 1) / SCRIBBLE_FPS;
const partialFrame = (size: number) => Math.min(PARTIAL_LAST,
  PARTIAL_FIRST + Math.floor((1 - THREE.MathUtils.clamp(size,0,1)) * (PARTIAL_LAST-PARTIAL_FIRST+1) + 1e-7));
// Thirty-two source drawings. Every sample uses the same 384 × 128 pixels.
// Measured UV origins / ink anchors accommodate the hand-drawn row spacing,
// keeping the ink centred without rescaling a drawing or changing pen weight.
const FRAME_REGIONS = [
  [0,0.86328125,0.5,0.5],
  [0.25,0.864257813,0.497395833,0.5],
  [0.5,0.865234375,0.498697917,0.5],
  [0.75,0.865234375,0.48828125,0.49609375],
  [0,0.723632813,0.49609375,0.5],
  [0.25,0.7265625,0.5,0.49609375],
  [0.5,0.720703125,0.493489583,0.5],
  [0.75,0.717773438,0.497395833,0.5],
  [0,0.588867188,0.497395833,0.5],
  [0.25,0.5859375,0.498697917,0.49609375],
  [0.5,0.583007813,0.498697917,0.5],
  [0.75,0.580078125,0.498697917,0.5],
  [0,0.455078125,0.501302083,0.50390625],
  [0.25,0.456054688,0.497395833,0.5],
  [0.5,0.455078125,0.5,0.49609375],
  [0.75,0.455078125,0.498697917,0.50390625],
  [0,0.33203125,0.490885417,0.5],
  [0.25,0.3359375,0.4921875,0.5],
  [0.5,0.331054688,0.497395833,0.5],
  [0.75,0.331054688,0.493489583,0.5],
  [0,0.21484375,0.498697917,0.49609375],
  [0.25,0.21484375,0.502604167,0.5],
  [0.5,0.21484375,0.498697917,0.49609375],
  [0.75,0.21484375,0.5,0.5],
  [0,0.099609375,0.489583333,0.50390625],
  [0.25,0.098632813,0.493489583,0.5],
  [0.5,0.09765625,0.5,0.49609375],
  [0.75,0.09765625,0.498697917,0.5],
  [0,0,0.5,0.42578125],
  [0.25,0,0.498697917,0.44140625],
  [0.5,0,0.5,0.44921875],
  [0.75,0,0.501302083,0.44140625]
] as const;

/** The hold preview is reversible. A committed switch has one apex tick, then
 * clears through independently drawn smaller frames without scaling the card. */
export class BoardScribbleSequence {
  enabled = true;
  targetVisible = false;
  private mode: 'idle' | 'prepare' | 'unwind' | 'burst' = 'idle';
  private growTime = 0;
  progress = 0;
  duration = SCRIBBLE_DURATION;
  elapsed = 0;
  serial = 0;
  appearances = 0;
  disappearances = 0;
  get preparing(): boolean {return this.mode === 'prepare' || this.mode === 'unwind';}
  get frozen(): boolean {return this.mode === 'unwind';}
  get stage(): string {return this.mode;}
  get active(): boolean {return this.enabled && this.mode !== 'idle';}
  get frame(): number {
    if (this.preparing) return partialFrame(this.progress);
    if (this.elapsed + 1e-7 < this.growTime) return partialFrame(this.elapsed / this.growTime);
    if (this.elapsed + 1e-7 < this.growTime + APEX_DURATION) return 0;
    return partialFrame(1 - (this.elapsed-this.growTime-APEX_DURATION) / (this.duration-this.growTime-APEX_DURATION));
  }
  get boardVisible(): boolean {
    if (this.preparing) return false;
    if (!this.active) return this.targetVisible;
    return this.targetVisible ? this.elapsed + 1e-7 >= this.growTime + APEX_DURATION
      : this.elapsed + 1e-7 < this.growTime;
  }
  prepare(dt: number, holdSeconds: number): void {
    if (!this.preparing) {this.progress=0;this.elapsed=0;this.serial++;}
    this.mode='prepare';this.targetVisible=true;
    this.progress=Math.min(1,this.progress+dt/Math.max(APEX_DURATION,holdSeconds));
  }
  unwind(): void {if(this.preparing)this.mode='unwind';}
  // Only an explicit mount/dismount cue commits a burst. Bails and unrelated
  // board visibility changes never start one; the preparation is not a commit.
  start(visible: boolean, duration = SCRIBBLE_DURATION, growFrames = 8): void {
    this.duration = Math.max(2*APEX_DURATION,duration);
    this.growTime = THREE.MathUtils.clamp(growFrames/SCRIBBLE_FPS,0,this.duration-2*APEX_DURATION);
    this.targetVisible=visible;this.elapsed=0;this.progress=0;this.mode='burst';this.serial++;
    if (visible) this.appearances++; else this.disappearances++;
  }
  step(dt: number): void {
    if (this.mode==='unwind') {
      this.progress=Math.max(0,this.progress-dt/.18);
      if(this.progress<=1e-7)this.mode='idle';
    } else if (this.mode==='burst') {
      this.elapsed+=dt;
      if(this.elapsed+1e-7>=this.duration)this.mode='idle';
    }
  }
  cancel(): void {this.mode='idle';this.progress=0;}
  reset(): void {
    this.targetVisible=false;this.mode='idle';this.progress=0;
    this.elapsed=this.appearances=this.disappearances=0;
    this.duration=SCRIBBLE_DURATION;this.serial++;
  }
}

/** Thirty-two independently drawn PNG frames on a fixed-size billboard. Only the
 * atlas cell changes: no scale tween, alpha fade, or resampled shrinking image. */
export class BoardScribbleEffect {
  readonly sprite: THREE.Sprite;
  private readonly texture: THREE.Texture;
  private serial = -1;
  private readonly center = new THREE.Vector3();
  private readonly tail = new THREE.Vector3();
  private readonly nose = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly worldScale = new THREE.Vector3();
  private readonly attachment = new THREE.Matrix4();
  private readonly supportWorld = new THREE.Plane();
  private hasSupport = false;
  private readonly floor = new THREE.Plane();
  private readonly floorUniform = {value:new THREE.Vector4()};
  private readonly floorEnabled = {value:0};
  private readonly perspective = {value:1};
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positions = new THREE.BufferAttribute(new Float32Array(36),3);
  private readonly uvs = new THREE.BufferAttribute(new Float32Array(24),2);

  constructor(texture: THREE.Texture, private readonly root: THREE.Object3D,
    private readonly board: THREE.Object3D, private readonly clock: BoardScribbleSequence) {
    this.texture = texture.clone(); this.texture.needsUpdate = true;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.repeat.set(1 / 4, 1 / 8);
    this.texture.magFilter = this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    // Keep ink at the prop's depth: foreground limbs and level geometry occlude
    // it normally. Drawing late must not turn it into a screen-space overlay.
    // Use the late pass without alpha blending. Floor/grid colour cannot cut
    // the ink, while the character's existing depth still occludes it.
    const material = new THREE.SpriteMaterial({map:this.texture, transparent:true, blending:THREE.NoBlending,
      alphaTest:.35, depthTest:true, depthWrite:false, toneMapped:false, fog:false});
    // Split the card at the floor and change only vertex depth below that line.
    // Keeping clip-space XY/W and UVs preserves the drawing's screen outline.
    // Vertex depth also preserves per-sample floor/foot occlusion under MSAA;
    // a per-fragment depth override leaves a faint clipped edge after resolve.
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, {inkFloor:this.floorUniform, inkFloorEnabled:this.floorEnabled,
        inkPerspective:this.perspective});
      shader.vertexShader = `uniform vec4 inkFloor;
        uniform float inkFloorEnabled, inkPerspective;
      ` + shader.vertexShader.replace('gl_Position = projectionMatrix * mvPosition;', `
        gl_Position = projectionMatrix * mvPosition;
        if (inkFloorEnabled > 0.5 && dot(inkFloor.xyz, mvPosition.xyz) + inkFloor.w < 0.0) {
          vec3 rayOrigin = vec3(mvPosition.xy * (1.0 - inkPerspective), 0.0);
          vec3 rayDirection = mvPosition.xyz - rayOrigin;
          float denominator = dot(inkFloor.xyz, rayDirection);
          if (denominator < -0.000001) {
            float t = -(dot(inkFloor.xyz, rayOrigin) + inkFloor.w) / denominator;
            if (t > 0.0 && t < 1.0) {
              vec4 floorClip = projectionMatrix * vec4(rayOrigin + rayDirection * t, 1.0);
              gl_Position.z = floorClip.z / floorClip.w * gl_Position.w;
            }
          }
        }
      `);
    };
    material.customProgramCacheKey = () => 'board-scribble-ground-depth-v2';
    this.sprite = new THREE.Sprite(material);
    this.geometry.setAttribute('position',this.positions);
    this.geometry.setAttribute('uv',this.uvs);
    this.sprite.geometry = this.geometry;
    this.sprite.name = 'board-scribble'; this.sprite.renderOrder = 100;
    this.sprite.frustumCulled = false; this.sprite.visible = false;
  }

  update(camera: THREE.Camera, support?: THREE.Plane): void {
    this.sprite.visible = this.clock.active;
    // A/B hides the drawing without changing the size of the same burst.
    if (!this.clock.active) return;
    const newBurst = this.serial !== this.clock.serial;
    // A sub-render-frame tap has no displayed preparation to unwind. Do not
    // create its first drawing on an already airborne, released board pose.
    if(newBurst&&this.clock.frozen){this.sprite.visible=false;return;}
    if (newBurst || !this.clock.frozen) {
      this.hasSupport=!!support;
      if(support)this.supportWorld.copy(support);
      this.board.updateWorldMatrix(true,false);this.attachment.copy(this.board.matrixWorld);
    }
    this.floorEnabled.value = this.hasSupport ? 1 : 0;
    this.perspective.value = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? 1 : 0;
    if (this.hasSupport) {
      this.floor.copy(this.supportWorld);
      this.floor.constant -= .0005; // sub-millimetre clearance without painting over soles
      this.floor.applyMatrix4(camera.matrixWorldInverse);
      this.floorUniform.value.set(this.floor.normal.x, this.floor.normal.y, this.floor.normal.z, this.floor.constant);
    }
    // Both bursts follow the source prop, including the standing pickup's short
    // ink tail after the hand catch, before its unchanged carry/settle ends.
    {
      const s = skateboardSettings.value, scale = s.overallScale;
      const y = (s.boardToGroundDistance + .01) * scale;
      this.center.set(0, y, (s.deckNoseLength - s.deckTailLength) * .5 * scale);
      this.tail.set(0, y, -s.deckTailLength * scale);
      this.nose.set(0, y, s.deckNoseLength * scale);
      for (const v of [this.center, this.tail, this.nose]) this.root.worldToLocal(v.applyMatrix4(this.attachment));
      if (newBurst) {
        this.board.getWorldScale(this.worldScale);
        const width = (s.deckNoseLength + s.deckTailLength) * scale * this.worldScale.z * 1.45;
        // Same pixel density and quad dimensions for ALL thirty-two drawings.
        this.sprite.scale.set(width, width / 3, 1);
      }
    }
    this.serial = this.clock.serial;
    this.sprite.position.copy(this.root.localToWorld(this.a.copy(this.center)));
    this.a.copy(this.tail); this.b.copy(this.nose);
    this.root.localToWorld(this.a); this.root.localToWorld(this.b);
    this.a.applyMatrix4(camera.matrixWorldInverse); this.b.applyMatrix4(camera.matrixWorldInverse);
    this.sprite.material.rotation = Math.atan2(this.b.y - this.a.y, this.b.x - this.a.x);
    const frame = FRAME_REGIONS[this.clock.frame];
    this.sprite.center.set(frame[2], frame[3]);
    this.texture.offset.set(frame[0], frame[1]);
    this.updateGeometry(camera,this.hasSupport);
  }
  private updateGeometry(camera: THREE.Camera, grounded: boolean): void {
    const center = this.a.copy(this.sprite.position).applyMatrix4(camera.matrixWorldInverse);
    const c = Math.cos(this.sprite.material.rotation), s = Math.sin(this.sprite.material.rotation);
    // Each point stores card XY and its signed distance from the support plane.
    const corners = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y]) => {
      const u = (x+.5-this.sprite.center.x)*this.sprite.scale.x;
      const v = (y+.5-this.sprite.center.y)*this.sprite.scale.y;
      const d = grounded ? this.floor.distanceToPoint(this.b.set(center.x+c*u-s*v,center.y+s*u+c*v,center.z)) : 1;
      return new THREE.Vector3(x,y,d);
    });
    const clip = (side: number) => {
      const points: THREE.Vector3[] = [];
      const append = (point: THREE.Vector3) => {
        if (!points.length || points[points.length-1].distanceToSquared(point)>1e-16) points.push(point);
      };
      for (let i=0;i<4;i++) {
        const a=corners[i],b=corners[(i+1)%4],inside=a.z*side>=0,next=b.z*side>=0;
        if (inside) append(a);
        if (inside!==next) append(a.clone().lerp(b,a.z/(a.z-b.z)));
      }
      if (points.length>1&&points[0].distanceToSquared(points[points.length-1])<1e-16) points.pop();
      return points;
    };
    // At most four triangles. Splitting exactly at the floor prevents a single
    // triangle from interpolating a false near depth across the rider's feet.
    const polygons = corners.some(v=>v.z<0)&&corners.some(v=>v.z>0) ? [clip(1),clip(-1)] : [corners];
    let count=0;
    for (const polygon of polygons) for (let i=1;i+1<polygon.length;i++) {
      for (const v of [polygon[0],polygon[i],polygon[i+1]]) {
        this.positions.setXYZ(count,v.x,v.y,0);this.uvs.setXY(count,v.x+.5,v.y+.5);count++;
      }
    }
    this.geometry.setDrawRange(0,count);this.positions.needsUpdate=this.uvs.needsUpdate=true;
  }
  dispose(): void {this.sprite.removeFromParent(); this.geometry.dispose(); this.sprite.material.dispose(); this.texture.dispose();}
}
