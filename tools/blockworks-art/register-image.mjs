import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const [kind,name,source]=process.argv.slice(2);
if(!['props','environment'].includes(kind)||!/^[-a-z0-9]+$/.test(name)||!source)throw Error('Usage: register-image.mjs props|environment name generated.png');
const promptFile=kind==='props'?'asset-prompts.json':'environment-prompts.json';
const brief=JSON.parse(await readFile(resolve(root,'tools/blockworks-art',promptFile),'utf8'))[kind][name];
const output=resolve(root,brief.reference||brief.output);
if(!output.startsWith(root))throw Error('Invalid output');
await mkdir(dirname(output),{recursive:true});
try {await stat(output);throw Error('Output already exists; do not silently replace');}catch(e){if(e.code!=='ENOENT')throw e;}
await copyFile(source,output);
const file=resolve(root,'tools/blockworks-art/image-ledger.json');
let ledger;try{ledger=JSON.parse(await readFile(file,'utf8'));}catch{ledger={schemaVersion:1,images:{}};}
ledger.images[kind+'/'+name]={output:brief.reference||brief.output,source,provider:'built-in imagegen',prompt:brief.prompt,sha256:createHash('sha256').update(await readFile(output)).digest('hex'),createdAt:new Date().toISOString(),review:'pending'};
await writeFile(file,JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify({name,output}));
