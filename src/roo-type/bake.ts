import * as THREE from 'three';
import { RooTypeGeometry, type RooTreatment } from './geometry';

export interface RooAtlasGlyph {
  x: number; y: number; width: number; height: number;
  /** Destination left/top relative to the glyph pen and the top of the cap band. */
  left: number; top: number; advance: number; inkLeft: number; inkRight: number;
  inkTop?: number; inkBottom?: number;
}
export interface RooAtlasMetrics {
  lightFrames?: number;
  version: number; palette: RooTreatment; capPixels: number; width: number; height: number;
  fontSha256: string; capBand: RooTypeGeometry['source']['capBand'];
  glyphs: Record<string,RooAtlasGlyph>; kern: Record<string,number>;
  /** Optical layouts measured from the supplied reference; values are cap-band units. */
  layouts?: Record<string,{width:number;glyphs:Array<{char:string;x:number;y:number;width:number;height:number}>}>;
}

function renderPng(renderer: THREE.WebGLRenderer, group: THREE.Object3D, capPixels: number): HTMLCanvasElement {
  const box = new THREE.Box3().setFromObject(group);
  const padding = 6 / capPixels;
  box.min.x -= padding; box.max.x += padding; box.min.y -= padding; box.max.y += padding;
  const width = Math.ceil((box.max.x-box.min.x)*capPixels), height = Math.ceil((box.max.y-box.min.y)*capPixels);
  // A precise pixels-per-cap ratio survives integer canvas rounding.
  box.max.x = box.min.x + width/capPixels; box.min.y=box.max.y-height/capPixels;
  const camera = new THREE.OrthographicCamera(box.min.x,box.max.x,box.max.y,box.min.y,.1,100);
  camera.position.z=20;
  const scene = new THREE.Scene(); scene.add(group);
  const previous = { size: renderer.getSize(new THREE.Vector2()), ratio: renderer.getPixelRatio(),
    target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(),
    viewport: renderer.getViewport(new THREE.Vector4()), scissor: renderer.getScissor(new THREE.Vector4()), scissorTest: renderer.getScissorTest() };
  const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
  try {
    renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.setClearColor(0,0);
    renderer.setPixelRatio(1); renderer.setSize(width*2,height*2,false);
    renderer.render(scene,camera);
    const ctx=canvas.getContext('2d')!; ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(renderer.domElement,0,0,width,height);
  } finally {
    scene.remove(group);
    renderer.setPixelRatio(previous.ratio); renderer.setSize(previous.size.x,previous.size.y,false);
    renderer.setRenderTarget(previous.target); renderer.setViewport(previous.viewport); renderer.setScissor(previous.scissor);
    renderer.setScissorTest(previous.scissorTest); renderer.setClearColor(previous.color,previous.alpha);
  }
  canvas.dataset.left=String(box.min.x); canvas.dataset.top=String(.5-box.max.y);
  return canvas;
}

export function renderRooPng(renderer: THREE.WebGLRenderer, factory: RooTypeGeometry, text: string,
  material: THREE.Material, capPixels: number, tracking: number) {
  return renderPng(renderer,factory.line(text,material,tracking),capPixels);
}

/** Exactly the live geometry/material, supersampled on transparent black, with advance/bearing metadata. */
export function bakeRooAtlas(renderer: THREE.WebGLRenderer, factory: RooTypeGeometry,
  material: THREE.Material, palette: RooTreatment, capPixels=256) {
  const entries: Array<{ char: string; canvas: HTMLCanvasElement; x: number; y: number }> = [];
  const glyphs: Record<string,RooAtlasGlyph>={};
  const atlasWidth=2048, gutter=4;
  let x=gutter,y=gutter,rowHeight=0;
  for(const [char,glyph] of Object.entries(factory.source.glyphs)) {
    if(!glyph.commands.length){glyphs[char]={x:0,y:0,width:0,height:0,left:0,top:0,advance:glyph.advance,inkLeft:0,inkRight:0};continue;}
    const canvas=renderPng(renderer,new THREE.Mesh(factory.glyph(char),material),capPixels);
    if(x+canvas.width+gutter>atlasWidth){x=gutter;y+=rowHeight+gutter;rowHeight=0;}
    entries.push({char,canvas,x,y});
    glyphs[char]={x,y,width:canvas.width,height:canvas.height,left:+canvas.dataset.left!,top:+canvas.dataset.top!,advance:glyph.advance,inkLeft:glyph.bounds[0],inkRight:glyph.bounds[2]};
    x+=canvas.width+gutter;rowHeight=Math.max(rowHeight,canvas.height);
  }
  const canvas=document.createElement('canvas');canvas.width=atlasWidth;canvas.height=y+rowHeight+gutter;
  const ctx=canvas.getContext('2d')!; for(const entry of entries)ctx.drawImage(entry.canvas,entry.x,entry.y);
  const metrics: RooAtlasMetrics = {version:1,palette,capPixels,width:canvas.width,height:canvas.height,
    fontSha256:factory.source.sha256,capBand:factory.source.capBand,glyphs,kern:factory.source.kern};
  return {canvas,metrics};
}
