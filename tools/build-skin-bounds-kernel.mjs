/** Rebuild the embedded exact f64 skin-bounds kernel.
 * Install wabt@1.0.39 outside the app, then run:
 * node tools/build-skin-bounds-kernel.mjs --wabt=/path/to/node_modules/wabt/index.js
 * Add --simd for the optional paired-f64 variant.
 * No compiler or runtime package is shipped to the browser. --check verifies
 * the checked-in bytes against this readable WebAssembly generator. */
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),arg=process.argv.find(a=>a.startsWith('--wabt='));
const simd=process.argv.includes('--simd');
const compiler=arg?pathToFileURL(arg.slice(7)).href:require.resolve('wabt');
const wabt=await (await import(compiler)).default();
const get=name=>`(local.get $${name})`,set=(name,value)=>`(local.set $${name} ${value})`;
const add=(a,b)=>`(f64.add ${a} ${b})`,mul=(a,b)=>`(f64.mul ${a} ${b})`;
const load=(pointer,offset=0)=>`(f64.load offset=${offset} ${get(pointer)})`;
// Parenthesization deliberately matches the JS left-to-right scalar loop.
const transform=(pointer,axis,x,y,z)=>add(add(add(mul(load(pointer,axis*8),get(x)),mul(load(pointer,(axis+4)*8),get(y))),mul(load(pointer,(axis+8)*8),get(z))),load(pointer,(axis+12)*8));
// Pair X/Y without fused or relaxed operations. Each lane retains the
// scalar expression's add/multiply order; Z and all validity checks stay f64.
const vget=name=>`(f64x2.splat ${get(name)})`;
const vload=(pointer,offset)=>`(v128.load offset=${offset} ${get(pointer)})`;
const vadd=(a,b)=>`(f64x2.add ${a} ${b})`,vmul=(a,b)=>`(f64x2.mul ${a} ${b})`;
const transformXY=(pointer,x,y,z)=>vadd(vadd(vadd(vmul(vload(pointer,0),vget(x)),vmul(vload(pointer,32),vget(y))),vmul(vload(pointer,64),vget(z))),vload(pointer,96));
const finite=names=>names.map(name=>`(if (i32.eqz (f64.le (f64.abs ${get(name)}) (f64.const 0x1.fffffffffffffp+1023))) (then (return (i32.const 0))))`).join('\n');
const wat=`(module
  ;; One reusable workspace, physically capped at 8 MiB. No per-mesh arena.
  (memory (export "memory") 1 128)
  (func (export "measure")
    (param $count i32) (param $morphCount i32) (param $base i32)
    (param $deltas i32) (param $influences i32) (param $indices i32)
    (param $weights i32) (param $palette i32) (param $inverse i32) (param $out i32)
    (result i32)
    (local $i i32) (local $m i32) (local $p i32) (local $w i32) (local $j i32)
    (local $d i32) (local $bone i32)
    (local $x f64) (local $y f64) (local $z f64)
    (local $sx f64) (local $sy f64) (local $sz f64)
    (local $px f64) (local $py f64) (local $pz f64)
    (local $weight f64) (local $influence f64)
    ${simd?'(local $sxy v128) (local $pxy v128)':''}
    (local $minx f64) (local $miny f64) (local $minz f64)
    (local $maxx f64) (local $maxy f64) (local $maxz f64)
    ${['x','y','z'].map(a=>`${set('min'+a,'(f64.const inf)')} ${set('max'+a,'(f64.const -inf)')}`).join('\n')}
    (block $done (loop $vertices
      (br_if $done (i32.ge_u ${get('i')} ${get('count')}))
      ${set('p',`(i32.add ${get('base')} (i32.mul ${get('i')} (i32.const 24)))`)}
      ${['x','y','z'].map((a,i)=>set(a,load('p',i*8))).join('\n')}
      ${set('m','(i32.const 0)')}
      (block $morphDone (loop $morphs
        (br_if $morphDone (i32.ge_u ${get('m')} ${get('morphCount')}))
        ${set('influence',`(f64.load (i32.add ${get('influences')} (i32.mul ${get('m')} (i32.const 8))))`)}
        (if (f64.ne ${get('influence')} (f64.const 0)) (then
          ${set('d',`(i32.add ${get('deltas')} (i32.mul (i32.add (i32.mul ${get('m')} ${get('count')}) ${get('i')}) (i32.const 24)))`)}
          ${['x','y','z'].map((a,i)=>set(a,add(get(a),mul(load('d',i*8),get('influence'))))).join('\n')}
        ))
        ${set('m',`(i32.add ${get('m')} (i32.const 1))`)} (br $morphs)
      ))
      ${finite(['x','y','z'])}
      ${simd?`${set('sxy','(v128.const f64x2 0 0)')} ${set('sz','(f64.const 0)')}`:['sx','sy','sz'].map(a=>set(a,'(f64.const 0)')).join('\n')}
      ;; Four authored weight slots, always visited in source order. Unroll
      ;; only the fixed slot loop; keep zero skips and all f64 operations.
      ${set('w',`(i32.add ${get('weights')} (i32.mul ${get('i')} (i32.const 32)))`)}
      ${set('j',`(i32.add ${get('indices')} (i32.mul ${get('i')} (i32.const 16)))`)}
      ${Array.from({length:4},(_,channel)=>`
        ${set('weight',load('w',channel*8))}
        (if (f64.ne ${get('weight')} (f64.const 0)) (then
          ${set('bone',`(i32.add ${get('palette')} (i32.mul (i32.load offset=${channel*4} ${get('j')}) (i32.const 128)))`)}
          ;; Slot 15 is the exact reciprocal of the constant divisor.
          ${simd?set('sxy',vadd(get('sxy'),vmul(vmul(transformXY('bone','x','y','z'),`(f64x2.splat ${load('bone',120)})`),vget('weight'))))+set('sz',add(get('sz'),mul(mul(transform('bone',2,'x','y','z'),load('bone',120)),get('weight')))):['x','y','z'].map((a,i)=>set('s'+a,add(get('s'+a),mul(mul(transform('bone',i,'x','y','z'),load('bone',120)),get('weight'))))).join('\n')}
        ))
      `).join('\n')}
      ${simd?['sx','sy'].map((a,i)=>set(a,`(f64x2.extract_lane ${i} ${get('sxy')})`)).join('\n'):''}
      ${finite(['sx','sy','sz'])}
      ${simd?set('pxy',vmul(transformXY('inverse','sx','sy','sz'),`(f64x2.splat ${load('inverse',120)})`))+['px','py'].map((a,i)=>set(a,`(f64x2.extract_lane ${i} ${get('pxy')})`)).join('\n')+set('pz',mul(transform('inverse',2,'sx','sy','sz'),load('inverse',120))):['x','y','z'].map((a,i)=>set('p'+a,mul(transform('inverse',i,'sx','sy','sz'),load('inverse',120)))).join('\n')}
      ${finite(['px','py','pz'])}
      ${['x','y','z'].map(a=>`${set('min'+a,`(f64.min ${get('min'+a)} ${get('p'+a)})`)} ${set('max'+a,`(f64.max ${get('max'+a)} ${get('p'+a)})`)}`).join('\n')}
      ${set('i',`(i32.add ${get('i')} (i32.const 1))`)} (br $vertices)
    ))
    ${['minx','miny','minz','maxx','maxy','maxz'].map((a,i)=>`(f64.store offset=${i*8} ${get('out')} ${get(a)})`).join('\n')}
    (i32.const 1)
  )
)`;
const parsed=wabt.parseWat('skin-bounds-kernel.wat',wat,{simd});
parsed.validate();
const {buffer}=parsed.toBinary({canonicalize_lebs:true,write_debug_names:false});parsed.destroy();
const hash=createHash('sha256').update(wat).digest('hex');
const lines=Array.from({length:Math.ceil(buffer.length/24)},(_,i)=>`  ${Array.from(buffer.subarray(i*24,(i+1)*24)).join(',')},`);
const generated=`// Generated by tools/build-skin-bounds-kernel.mjs with wabt 1.0.39. Do not hand edit.\n// ${simd?'Paired f64 SIMD with scalar fallback; no fused or relaxed arithmetic.':'Scalar f64 fallback; no SIMD or relaxed arithmetic.'} No approximation, imports or network.\n// Generator WAT SHA-256: ${hash}\nexport const ${simd?'SKIN_BOUNDS_SIMD_WASM_BYTES':'SKIN_BOUNDS_WASM_BYTES'} = new Uint8Array([\n${lines.join('\n')}\n]);\n`;
const target=new URL(`../src/character/skinBounds${simd?'Simd':''}KernelBytes.ts`,import.meta.url);
if(process.argv.includes('--check')){
  if(await readFile(target,'utf8')!==generated)throw new Error('Skin bounds kernel bytes are stale; rebuild them.');
  console.log(`PASS embedded skin kernel is reproducible (${buffer.length} bytes)`);
}else{await writeFile(target,generated);console.log(`Wrote ${fileURLToPath(target)} (${buffer.length} bytes)`);}
