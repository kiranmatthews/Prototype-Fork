// Bundle the real discovery ledger dependency for isolated Node campaign tests.
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
export async function campaignTestModule() {
  const result=await build({entryPoints:[fileURLToPath(new URL('../src/campaign.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
  return result.outputFiles[0].text;
}
