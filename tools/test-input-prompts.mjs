import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createServer } from 'vite';
const stored=new Map();
globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
 const {InputPromptSystem,detectControllerFamily,CONTROLLER_FAMILIES,controllerGlyph,keyboardGlyph}=await server.ssrLoadModule('/src/inputPrompts.ts');
 const {INPUT_BINDINGS,actionButtonDown}=await server.ssrLoadModule('/src/inputBindings.ts');
 const cases=[['Xbox Wireless Controller','xbox'],['Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 05c4)','ps4'],['DualSense Wireless Controller','ps5'],['054c-0ce6-Wireless Controller','ps5'],['DualSense Edge','ps5'],['Nintendo Switch Pro Controller','switch'],['Joy-Con (L+R)','switch'],['Steam Deck Controller','steamdeck'],['Valve Neptune','steamdeck'],['Generic standard gamepad','xbox']];
 for(const [id,family] of cases)assert.equal(detectControllerFamily(id),family);
 const pad=(id,mapping='standard')=>({id,mapping,connected:true,index:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});
 const model=new InputPromptSystem();
 assert.equal(model.family,'keyboard');assert.match(model.resolve('mapProgress').url,/T_I_Key_Dark/);
 for(const [id,family] of cases){model.update(pad(id),false);assert.equal(model.family,family);for(const action of Object.keys(INPUT_BINDINGS))assert.equal(model.resolve(action).family,family);}
 model.update(pad('DualShock 4'),false);assert.match(model.resolve('jump').url,/Cross_Color_Stylized/);
 model.update(pad('DualSense'),false);assert.match(model.resolve('jump').url,/P5_Cross.png/);
 model.update(pad('Switch Pro'),false);assert.equal(model.resolve('confirm').label,'B');assert.equal(model.resolve('back').label,'A');assert.equal(model.resolve('spin').label,'Y');assert.equal(model.resolve('grind').label,'X');
 model.update(pad('Xbox'),false);model.setControllerOverride('steamdeck');assert.equal(model.family,'steamdeck');assert.equal(model.resolve('transfer').label,'R2');assert.match(model.resolve('jump').url,/_A_White/);
 const restored=new InputPromptSystem();restored.update(pad('Generic standard gamepad'),false);assert.equal(restored.family,'steamdeck','prompt override did not persist');
 model.update(null,false);assert.equal(model.family,'keyboard','controller override leaked into keyboard-only play');
 model.update(null,true);assert.equal(model.family,'touch');assert.equal(model.resolve('mapOptions'),null);
 model.setControllerOverride(null);model.update(pad('Unknown raw device',''),false);assert.equal(model.resolve('jump').label,'Button 1');assert.ok(model.resolve('jump').fallback);
 model.setHostFamily('ps5');model.update(null,false);assert.equal(model.family,'ps5');model.setHostFamily(null);assert.equal(model.family,'keyboard');
 assert.throws(()=>model.setHostFamily('bad'));assert.throws(()=>model.setControllerOverride('bad'));
 const all=[];
 for(const family of CONTROLLER_FAMILIES)for(let index=0;index<16;index++)all.push(controllerGlyph(family,index));
 for(const key of [...Object.values(INPUT_BINDINGS).map(b=>b.key),'MouseLeft','MouseRight','MouseMiddle','Digit4','KeyZ'])all.push(keyboardGlyph(key));
 for(const glyph of all){assert.doesNotMatch(glyph.label,/[\u{1f000}-\u{1ffff}]/u);if(!glyph.url.startsWith('data:'))await access(new URL('../public'+glyph.url,import.meta.url));}
 const p=pad('Xbox');for(const action of Object.keys(INPUT_BINDINGS)){p.buttons.forEach(b=>b.pressed=false);p.buttons[INPUT_BINDINGS[action].button].pressed=true;assert.equal(actionButtonDown(p,action),true);}
 const map=await readFile(new URL('../src/worldMapUI.ts',import.meta.url),'utf8');
 assert.match(map,/createInputGlyph\(action\)/);assert.doesNotMatch(map,/actionButton\("[△□○⚙]/);assert.doesNotMatch(map,/button\.append\([^\n]*keyHint/);
 const surface=await readFile(new URL('../src/gameInterfaceSurface.ts',import.meta.url),'utf8');assert.match(surface,/paintInputPrompts\(ctx(?:,|\))/);
 const input=await readFile(new URL('../src/input.ts',import.meta.url),'utf8');assert.match(input,/if \(!this.padOnly\) inputPrompts.update\(pad/,'P2 must not overwrite P1 prompt selection');
 console.log('PASS semantic prompt bindings, every asset path, five controller profiles, Switch positions, hot-plug fallback, raw-device safety, host adapters, and CRT wiring');
} finally {await server.close()}
