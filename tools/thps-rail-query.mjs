// Load the exact production math for the native C++ oracle and source audit.
import {build} from 'esbuild';
const result=await build({entryPoints:['src/referenceRailCapture.ts'],bundle:true,format:'esm',write:false});
const math=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
export const {nativeSquareRoot,nativeLinePair,nativeRailCandidate}=math;
