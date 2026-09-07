import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('src/input.ts',root),'utf8');
const main=await readFile(new URL('src/main.ts',root),'utf8');
function compile(text){return ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText}
const bindings={};new Function('exports',compile(await readFile(new URL('src/inputBindings.ts',root),'utf8')))(bindings);
const listeners=new Map();
const window={addEventListener(type,fn){listeners.set(type,fn)}};
const dependencies={
 './touch':{TouchControls:class{enabled=false}},
 './cameraLook':{shapeLookStick:()=>({x:0,y:0})},
 './inputBindings':bindings,
 './inputPrompts':{inputPrompts:{update(){}}},
};
const exports={};new Function('require','exports','window','navigator',compile(source))(id=>dependencies[id],exports,window,{});
let visible=false;
const input=new exports.Input(false,()=>visible);
input.pollGamepad=()=>null;
const key=(type,code)=>listeners.get(type)({code,repeat:false,target:null,preventDefault(){}});
key('keydown','KeyR');input.update();assert.equal(input.restartPressed,false);
visible=true;input.update();assert.equal(input.restartPressed,false,'held hidden R became a reset when debug opened');
key('keyup','KeyR');input.update();key('keydown','KeyR');key('keyup','KeyR');input.update();assert.equal(input.restartPressed,true,'visible quick reset tap was lost');
visible=false;input.update();assert.equal(input.restartPressed,false,'queued reset survived hiding debug');
key('keydown','KeyR');visible=true;input.update();assert.equal(input.restartPressed,false,'hidden R became an edge when M was pressed before the next poll');
key('keyup','KeyR');input.update();visible=false;
key('keydown','KeyP');key('keydown','KeyI');input.update();assert.equal(input.pausePressed,true);assert.equal(input.inventoryHeld,true,'debug gate changed normal inventory input');
for(const padOnly of [false,true]) {
 const rider=new exports.Input(padOnly,()=>visible);
 const pad={axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false}))};rider.pollGamepad=()=>pad;
 visible=false;pad.buttons[8].pressed=true;rider.update();assert.equal(rider.restartPressed,false);
 visible=true;rider.update();assert.equal(rider.restartPressed,false,'held Share reset when debug became visible');
 pad.buttons[8].pressed=false;rider.update();pad.buttons[8].pressed=true;rider.update();assert.equal(rider.restartPressed,true,'enabled Share no longer resets');
 rider.consumeEdges();rider.update();assert.equal(rider.restartPressed,false,'held Share repeated');
 visible=false;rider.restartPressed=true;rider.update();assert.equal(rider.restartPressed,false);
 rider.armMenuReleaseGuard();rider.update();assert.equal(rider.menuReleaseGuard,false,'disabled Share blocked neutral menu release');
 visible=true;rider.update();assert.equal(rider.restartPressed,false,'menu release resurrected hidden held Share');
}
const file=ts.createSourceFile('main.ts',main,ts.ScriptTarget.Latest,true);
let warpIf;
function visit(node){if(ts.isIfStatement(node)&&node.thenStatement.getText(file).includes('player.warpCheckpoint(')&&(!warpIf||node.getWidth(file)<warpIf.getWidth(file)))warpIf=node;ts.forEachChild(node,visit)}
visit(file);assert.ok(warpIf);
const canWarp=new Function('current','gameFlow','editor','e',`return ${warpIf.expression.getText(file)}`);
for(const code of ['KeyK','KeyL']) {
 assert.equal(canWarp({id:'jungle'},{developerChromeVisible:false},{active:false},{code}),false);
 assert.equal(canWarp({id:'jungle'},{developerChromeVisible:true},{active:false},{code}),true);
 assert.equal(canWarp({id:'warproom'},{developerChromeVisible:true},{active:false},{code}),false);
 assert.equal(canWarp({id:'jungle'},{developerChromeVisible:true},{active:true},{code}),false);
}
assert.equal((main.match(/new Input\((?:true|false), \(\) => gameFlow\?\.developerChromeVisible \?\? false\)/g)??[]).length,2,'both riders must follow live debug visibility');
assert.match(main,/onRestart: restartCurrentRun/,'normal menu Restart must remain available');
assert.match(main,/onResultsRetry: retryFromResults/,'normal results Retry must remain available');
console.log('PASS debug-only keyboard/Share reset, P1/P2 gating, held-button release semantics, K/L guards and preserved menu actions');
