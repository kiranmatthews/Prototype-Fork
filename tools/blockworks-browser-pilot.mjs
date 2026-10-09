import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {build} from 'esbuild';

/** Convert the existing synchronous input pilots into resumable generators.
 * Decisions and assertions stay shared; only input-producing helpers yield. */
export async function buildBlockworksBrowserPilot(){
 const operations=new Set(['tick','until','stepFor','walkTo','jumpTo','charge','releaseJump','skateAlong','grindUntil','skateRoofWedges']);
 const modules=[
  ['blockworks-skate-pilot.mjs',['skateRoofWedges'],[]],
  ['test-blockworks.mjs',['runOpeningAndTerrace','runFrozen'],['station','round']],
  ['test-blockworks-aqueduct.mjs',['pumpAqueductRow','runAqueduct'],[]],
  ['test-blockworks-foundry.mjs',['runFoundry'],[]],
  ['test-blockworks-movers.mjs',['runMachinery'],[]],
  ['test-blockworks-finale.mjs',['runFinale'],['rounded']],
 ];
 const chunks=[];
 for(const[file,exports,constants]of modules){
  const source=await readFile(new URL(file,import.meta.url),'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const selected=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&exports.includes(n.name?.text)||ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>constants.includes(d.name.getText(ast))));
  const functions=new Map(),names=new Map();
  const collect=node=>{
   if(ts.isFunctionDeclaration(node)&&node.name){functions.set(node.name.text,node);names.set(node,node.name.text);}
   if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer&&(ts.isArrowFunction(node.initializer)||ts.isFunctionExpression(node.initializer))){functions.set(node.name.text,node.initializer);names.set(node.initializer,node.name.text);}
   ts.forEachChild(node,collect);
  };selected.forEach(collect);
  const callable=node=>ts.isIdentifier(node)?node.text:ts.isPropertyAccessExpression(node)?node.name.text:null;
  const yields=new Set(operations);
  const usesYield=fn=>{
   let found=false;
   const walk=node=>{if(node!==fn&&ts.isFunctionLike(node))return;if(ts.isCallExpression(node)&&yields.has(callable(node.expression)))found=true;ts.forEachChild(node,walk);};
   walk(fn);return found;
  };
  for(let changed=true;changed;){changed=false;for(const[name,fn]of functions)if(!yields.has(name)&&usesYield(fn)){yields.add(name);changed=true;}}
  const transformer=context=>{
   const f=context.factory,modifiers=node=>node.modifiers?.filter(m=>m.kind!==ts.SyntaxKind.ExportKeyword&&m.kind!==ts.SyntaxKind.AsyncKeyword);
   const visit=node=>{
    if(ts.isExpressionStatement(node)){
     const e=ts.isAwaitExpression(node.expression)?node.expression.expression:node.expression;
     if(ts.isCallExpression(e)&&callable(e.expression)==='writeFile')return undefined;
    }
    if(ts.isFunctionDeclaration(node))return f.updateFunctionDeclaration(node,modifiers(node),yields.has(names.get(node))?f.createToken(ts.SyntaxKind.AsteriskToken):node.asteriskToken,node.name,node.typeParameters,node.parameters,node.type,ts.visitNode(node.body,visit));
    if(ts.isArrowFunction(node)&&yields.has(names.get(node))){
     const body=ts.visitNode(node.body,visit);
     return f.createFunctionExpression(undefined,f.createToken(ts.SyntaxKind.AsteriskToken),undefined,node.typeParameters,node.parameters,node.type,ts.isBlock(body)?body:f.createBlock([f.createReturnStatement(body)],true));
    }
    if(ts.isFunctionExpression(node)&&yields.has(names.get(node)))return f.updateFunctionExpression(node,modifiers(node),f.createToken(ts.SyntaxKind.AsteriskToken),node.name,node.typeParameters,node.parameters,node.type,ts.visitNode(node.body,visit));
    if(ts.isCallExpression(node)&&yields.has(callable(node.expression)))return f.createYieldExpression(f.createToken(ts.SyntaxKind.AsteriskToken),ts.visitEachChild(node,visit,context));
    return ts.visitEachChild(node,visit,context);
   };
   return node=>ts.visitNode(node,visit);
  };
  const result=ts.transform(ts.factory.updateSourceFile(ast,selected),[transformer]);
  const code=ts.createPrinter().printFile(result.transformed[0]);result.dispose();
  chunks.push(`const {${exports.join(',')}}=(()=>{${code};return{${exports.join(',')}};})();`);
 }
 const source=await build({entryPoints:[fileURLToPath(new URL('../src/levels/codex-lab.ts',import.meta.url))],bundle:true,write:false,format:'iife',globalName:'BlockworksSource',target:'es2020'});
 return{source:source.outputFiles[0].text,pilot:chunks.join('\n')+`
  return function* journey(r){
   const evidence=[];evidence.push(...(yield* runOpeningAndTerrace(r)));evidence.push(yield* runFrozen(r));
   evidence.push(yield* runAqueduct(r));evidence.push(yield* runFoundry(r,{exerciseReward:true,verifyRespawn:false}));
   evidence.push(yield* runMachinery(r));evidence.push(...(yield* runFinale(r)));
   assert.equal(r.p.state,'finished');assert.equal(r.p.totalDeaths,0);return evidence;
  };`};
}
