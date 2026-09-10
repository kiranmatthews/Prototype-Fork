import * as THREE from "three";
import { loadRooAtlases, RooAtlasPainter } from './roo-type/atlas';
import { ROO_APPEARANCE_EVENT, rooLightPosition } from './roo-type/settings';
import { Level, COMBO_GEM_TINT } from "./level";
import { createSkateboardPresentation, rebuildSkateboardPresentation } from "./skateboard/model";
import { type SkateboardSettings } from "./skateboard/settings";
import { mapSkateboardSettings, DEFAULT_MAP_SKATEBOARD_SETTINGS } from "./skateboard/mapSettings";
import { TIME_MEDALS, defaultMedalTimes, type MedalTimes, type TimeMedal } from "./campaign";
import { setTimeMedalTier, TIME_MEDAL_COLORS } from "./timeMedalModel";

export interface MapLevelCardData {
  key: string;
  name: string;
  earned: readonly boolean[];
  trialUnlocked: boolean;
  times: readonly number[];
  target: number;
  targets?: MedalTimes;
  medal?: TimeMedal | null;
  competition?: boolean;
  cup?: boolean;
}

export function mapTrialTime(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return "—:——.——";
  const centiseconds = Math.floor(seconds * 100);
  return `${Math.floor(centiseconds / 6000)}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}

export const MAP_DECK_FLIP_SECONDS = 0.64;

/** Shared flip clock: change the printing only while the grip faces away. */
export class MapDeckFlip {
  shown: MapLevelCardData | null = null;
  private pending: MapLevelCardData | null = null;
  private elapsed = MAP_DECK_FLIP_SECONDS;
  private swapped = true;
  get active(): boolean { return this.elapsed < MAP_DECK_FLIP_SECONDS; }
  get phase(): number { return Math.min(1, this.elapsed / MAP_DECK_FLIP_SECONDS); }
  select(data: MapLevelCardData, immediate = false): void {
    this.pending = data;
    if (immediate || !this.shown) {
      this.shown = data; this.elapsed = MAP_DECK_FLIP_SECONDS; this.swapped = true;
    } else if (!this.active && this.shown.key !== data.key) {
      this.elapsed = 0; this.swapped = false;
    } else if (!this.active) this.shown = data;
  }
  step(dt: number): void {
    if (!this.active) return;
    this.elapsed = Math.min(MAP_DECK_FLIP_SECONDS, this.elapsed + Math.max(0, dt));
    if (!this.swapped && this.phase >= 0.5) { this.shown = this.pending; this.swapped = true; }
    if (!this.active && this.pending) {
      if (this.shown?.key !== this.pending.key) { this.elapsed = 0; this.swapped = false; }
      else this.shown = this.pending;
    }
  }
}

function canvasTexture(width: number, height: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function silhouette(ctx: CanvasRenderingContext2D, index: number, x: number, y: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(1.45, 1.45); ctx.fillStyle = "#272626";
  ctx.beginPath();
  if (index === 0) {
    ctx.moveTo(0, -53); ctx.lineTo(24, -25); ctx.lineTo(20, 13);
    ctx.lineTo(0, 56); ctx.lineTo(-20, 13); ctx.lineTo(-24, -25); ctx.closePath();
  } else if (index === 3) {
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
  } else {
    ctx.moveTo(-42, -16); ctx.lineTo(-24, -38); ctx.lineTo(24, -38);
    ctx.lineTo(42, -16); ctx.lineTo(0, 42); ctx.closePath();
  }
  ctx.fill(); ctx.restore();
}

/** Screen-space 3D, using the game's renderer and pre-CRT seam, never another canvas. */
export class MapLevelPresentation {
  readonly flip = new MapDeckFlip();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
  private readonly anchor = new THREE.Group();
  private readonly deckPivot = new THREE.Group();
  private readonly rewards: THREE.Group[] = [];
  private readonly faceTexture = canvasTexture(1536, 512);
  private readonly trialTexture = canvasTexture(768, 800);
  private readonly trial = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.trialTexture, transparent: true, toneMapped: false }));
  private inkKey = "";
  private time = 0;
  private draws = 0;
  private readonly board: THREE.Group;
  private readonly face: THREE.Mesh;
  private boardDirty = false;
  private readonly rooAtlas=new RooAtlasPainter();
  private lightPhase=NaN;

  constructor(private readonly deckHost: HTMLElement, private readonly trialHost: HTMLElement,
    private readonly boardSettings: SkateboardSettings = mapSkateboardSettings) {
    this.anchor.add(this.deckPivot);
    this.scene.add(this.anchor, this.trial, new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0xffeddb, 3);
    light.position.set(-1, 2, 4); this.scene.add(light);
    const mount = new THREE.Group();
    mount.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.PI / 2, "ZXY"));
    const board = this.board = createSkateboardPresentation(this.boardSettings.value);
    mount.add(board); this.deckPivot.add(mount);
    const face = this.face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.534), new THREE.MeshStandardMaterial({ map: this.faceTexture, roughness: 0.95, transparent: true, depthWrite: false }));
    face.position.z = 0.075; this.deckPivot.add(face);
    const factories = [() => Level.crystalMesh(), () => Level.gemMesh(), () => Level.gemMesh(1, COMBO_GEM_TINT), () => Level.timeRelicMesh()];
    for (const [i, make] of factories.entries()) {
      const model = make();
      for (const object of [...model.children]) if ((object as THREE.Sprite).isSprite) model.remove(object);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      model.position.sub(bounds.getCenter(new THREE.Vector3()));
      const spin = new THREE.Group(); spin.add(model);
      spin.scale.setScalar(0.205 / Math.max(size.y, Math.hypot(size.x, size.z)));
      const pivot = new THREE.Group(); pivot.add(spin);
      pivot.position.set(-0.51 + i * 0.34, -0.115, 0.22);
      pivot.rotation.x = 0.12;
      this.deckPivot.add(pivot); this.rewards.push(pivot);
    }
    this.updateBoard(false);
    let geometryKey = this.geometryKey();
    this.boardSettings.subscribe(() => {
      const next = this.geometryKey();
      if (next !== geometryKey) this.boardDirty = true;
      geometryKey = next;
      this.inkKey = "";
    });
    void document.fonts?.ready.then(() => { this.inkKey = ""; });
    void loadRooAtlases().then(()=>{this.inkKey='';});
    window.addEventListener(ROO_APPEARANCE_EVENT,()=>{this.inkKey='';});
  }

  private geometryKey(): string {
    const { mapTitleSize: _textSize, ...geometry } = this.boardSettings.value;
    return JSON.stringify(geometry);
  }

  get diagnostics() {
    return { shownKey: this.flip.shown?.key, flipping: this.flip.active, phase: this.flip.phase,
      earned: this.flip.shown?.earned, medal: this.flip.shown?.medal, targets: this.flip.shown?.targets, trialVisible: this.trial.visible, draws: this.draws,
      rotations: this.rewards.map(p => p.children[0].rotation.y),
      boardSettings: this.boardSettings.value, boardReady: this.board.userData.assetReady,
      boardGeometry: this.board.userData.geometryStats };
  }

  private updateBoard(rebuild = true): void {
    const value = this.boardSettings.value;
    if (rebuild) rebuildSkateboardPresentation(this.board, value);
    const scale = value.overallScale;
    this.board.position.y = -value.boardToGroundDistance * scale;
    const lengthRatio = (value.deckTailLength + value.deckNoseLength) /
      (DEFAULT_MAP_SKATEBOARD_SETTINGS.deckTailLength + DEFAULT_MAP_SKATEBOARD_SETTINGS.deckNoseLength);
    const widthRatio = value.deckHalfWidth / DEFAULT_MAP_SKATEBOARD_SETTINGS.deckHalfWidth;
    // Keep the typography and reward sockets uniformly scaled within the deck.
    const printScale = Math.min(lengthRatio, widthRatio) * scale;
    const centre = (value.deckNoseLength - value.deckTailLength) * 0.5 * scale;
    const printZ = Math.max(0.075, value.tailKickRise + 0.01, value.noseKickRise + 0.01, value.concaveDepth + 0.01) * scale;
    this.face.scale.setScalar(printScale);
    this.face.position.set(centre, 0, printZ);
    this.rewards.forEach((pivot, i) => {
      pivot.position.set(centre + (-0.51 + i * 0.34) * printScale, -0.115 * printScale, printZ + 0.145 * scale);
      pivot.scale.setScalar(printScale);
    });
    this.boardDirty = false;
  }

  select(data: MapLevelCardData, immediate = false): void { this.flip.select(data, immediate); }

  draw(renderer: THREE.WebGLRenderer, dt: number, size?: { width: number; height: number }, target = renderer.getRenderTarget()): void {
    const rect = this.deckHost.getBoundingClientRect();
    if (this.boardDirty) this.updateBoard();
    if (rect.width < 2 || rect.height < 2) return;
    this.flip.step(dt); this.time += Math.max(0, dt);
    const data = this.flip.shown;
    if (!data) return;
    const key = JSON.stringify(data);
    const lightPhase=Math.round(rooLightPosition()*64);
    if (key !== this.inkKey) { this.paint(data); this.inkKey = key; }
    else if(lightPhase!==this.lightPhase)this.paint(data,false);
    this.lightPhase=lightPhase;
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.left = -w / 2; this.camera.right = w / 2;
    this.camera.top = h / 2; this.camera.bottom = -h / 2; this.camera.updateProjectionMatrix();
    const phase = this.flip.phase, lift = Math.sin(Math.PI * phase);
    this.anchor.position.set(rect.x + rect.width / 2 - w / 2, h / 2 - rect.y - rect.height / 2 + lift * 9, 0);
    this.anchor.scale.setScalar(rect.width / 2.2);
    this.anchor.rotation.z = 0.085;
    this.deckPivot.rotation.x = -0.08 + Math.PI * 2 * (phase * phase * (3 - 2 * phase));
    this.deckPivot.rotation.y = Math.sin(phase * Math.PI * 2) * 0.07;
    this.rewards.forEach((pivot, i) => {
      pivot.visible = !data.competition && data.earned[i] === true;
      pivot.children[0].rotation.y = this.time * 0.8 + i * 0.45;
    });
    // The poster changes with the same hidden-face swap as the deck printing.
    const tr = this.trialHost.getBoundingClientRect();
    this.trial.visible = data.trialUnlocked && tr.width > 1 && tr.height > 1;
    this.trial.position.set(tr.x + tr.width / 2 - w / 2, h / 2 - tr.y - tr.height / 2, 0);
    this.trial.scale.set(tr.width * 0.92, tr.height * 0.92, 1);
    this.trial.rotation.z = 0.06;
    const oldTarget = renderer.getRenderTarget(), oldFace = renderer.getActiveCubeFace(), oldMip = renderer.getActiveMipmapLevel();
    const viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear;
    const dimensions = size ?? (() => { const s = renderer.getSize(new THREE.Vector2()); return { width: s.x, height: s.y }; })();
    try {
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, dimensions.width, dimensions.height);
      renderer.setScissorTest(false); renderer.autoClear = false;
      renderer.clearDepth(); renderer.render(this.scene, this.camera); this.draws++;
    } finally {
      renderer.setRenderTarget(oldTarget, oldFace, oldMip);
      renderer.setViewport(viewport); renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest); renderer.autoClear = autoClear;
    }
  }

  private paint(data: MapLevelCardData,updateTrial=true): void {
    setTimeMedalTier(this.rewards[3], data.medal ?? 'gold');
    const ctx = this.faceTexture.image.getContext("2d")!;
    ctx.clearRect(0, 0, 1536, 512);
    // Warm screen-printed reward sockets; missing shapes stay flat and dark.
    for (let i = 0; i < (data.competition ? 0 : 4); i++) {
      const x = 278 + i * 326.4;
      ctx.fillStyle = "#9e9b8b"; ctx.beginPath(); ctx.ellipse(x, 366, 109, 105, -0.08, 0, Math.PI * 2); ctx.fill();
      if (!data.earned[i]) silhouette(ctx, i, x, 366);
    }
    if (data.competition) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#f7d06f"; ctx.font = '75px "Staging Secondary", Arial, sans-serif';
      ctx.fillText(data.cup ? "🏆 JUNGLE CUP EARNED" : "3 RUNS · FINISH 1ST", 768, 360);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    let fontSize = this.boardSettings.value.mapTitleSize ?? 156;
    if(!this.rooAtlas.draw(ctx,data.name.toUpperCase(),768,137,{size:Math.min(190,fontSize)*.882,palette:'counter',align:'center',maxWidth:1430})){
    ctx.font = `${fontSize}px Roo, Impact, sans-serif`;
    // Fit long names horizontally and vertically without overlapping sockets.
    fontSize *= Math.min(1, 1430 / Math.max(1, ctx.measureText(data.name.toUpperCase()).width), 190 / fontSize);
    ctx.font = `${fontSize}px Roo, Impact, sans-serif`;
    ctx.strokeStyle = "#161719"; ctx.lineWidth = 15 * fontSize / 156;
    ctx.strokeText(data.name.toUpperCase(), 768, 145);
    const gold = ctx.createLinearGradient(0, 70, 0, 220);
    gold.addColorStop(0, "#ffe36b"); gold.addColorStop(0.55, "#ffb52c"); gold.addColorStop(1, "#f07b13");
    ctx.fillStyle = gold; ctx.fillText(data.name.toUpperCase(), 768, 137);
    }
    this.faceTexture.needsUpdate = true;
    if(updateTrial)this.paintTrial(data);
  }

  private paintTrial(data: MapLevelCardData): void {
    const ctx = this.trialTexture.image.getContext("2d")!;
    ctx.clearRect(0, 0, 768, 800);
    // A cut-paper race card, not another modal or stock announcement.
    const outline = (inset: number) => {
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const x = inset + (768 - inset * 2) * i / 20, jitter = Math.sin(i * 17.1) * 5;
        if (!i) ctx.moveTo(x, inset + jitter); else ctx.lineTo(x, inset + jitter);
      }
      ctx.lineTo(768 - inset, 800 - inset);
      for (let i = 20; i >= 0; i--) ctx.lineTo(inset + (768 - inset * 2) * i / 20, 800 - inset + Math.sin(i * 13.7) * 5);
      ctx.closePath();
    };
    outline(17); ctx.fillStyle = "#dfd9c8"; ctx.fill();
    outline(31); ctx.fillStyle = "#212323"; ctx.fill();
    ctx.save(); outline(31); ctx.clip();
    ctx.fillStyle = "#af3b27"; ctx.beginPath(); ctx.moveTo(540, 15); ctx.lineTo(760, 15); ctx.lineTo(650, 260); ctx.lineTo(450, 260); ctx.fill();
    // Restrained deterministic scratches leave the records unobscured.
    ctx.strokeStyle = "rgba(233,220,193,.22)"; ctx.lineWidth = 2;
    for (let i = 0; i < 80; i++) {
      const x = (i * 139.37) % 768, y = (i * 91.13) % 800;
      if (x > 65 && x < 705 && y > 235 && y < 725) continue;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8 + i % 17, y - 4); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = "#eee9da"; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(153, 140, 65, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(153, 140); ctx.lineTo(125, 105); ctx.moveTo(153, 140); ctx.lineTo(181, 132); ctx.stroke();
    ctx.fillStyle = "#eee9da"; ctx.fillRect(134, 51, 38, 15);
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.font = '74px "Staging Secondary", Impact, sans-serif'; ctx.fillText("TIME TRIAL", 254, 133, 440);
    ctx.fillStyle = '#c9c5b8'; ctx.font = '32px "Staging Secondary", sans-serif';
    ctx.fillText('YOUR BEST TIMES', 83, 243);
    for (const [i, rank] of ['1ST', '2ND', '3RD'].entries()) {
      const y = 310 + i * 91;
      ctx.textAlign = 'left'; ctx.fillStyle = '#c9c5b8'; ctx.font = '46px "Staging Secondary", sans-serif';
      ctx.fillText(rank, 83, y);
      ctx.textAlign = 'right'; ctx.fillStyle = '#f8f5e9'; ctx.font = '55px "Staging Secondary", monospace';
      ctx.fillText(mapTrialTime(data.times[i]), 680, y);
    }
    ctx.strokeStyle = '#666861'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(75, 546); ctx.lineTo(693, 546); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#c9c5b8'; ctx.font = '29px "Staging Secondary", sans-serif';
    ctx.fillText('MEDALS', 83, 585);
    const targets = data.targets ?? defaultMedalTimes(data.target);
    for (const [i, tier] of TIME_MEDALS.entries()) {
      const y = 635 + i * 52;
      const earned = !!data.medal && i >= TIME_MEDALS.indexOf(data.medal);
      ctx.textAlign = 'left'; ctx.fillStyle = '#' + TIME_MEDAL_COLORS[tier].toString(16).padStart(6,'0');
      ctx.font = '33px "Staging Secondary", sans-serif'; ctx.fillText(tier.toUpperCase(), 83, y);
      ctx.textAlign = 'right'; ctx.fillStyle = '#f8f5e9'; ctx.font = '34px "Staging Secondary", monospace'; ctx.fillText(earned ? 'EARNED' : mapTrialTime(targets[tier]), 680, y);
    }
    this.trialTexture.needsUpdate = true;
  }
}
