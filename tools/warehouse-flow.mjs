/** Quick rendered-input combo/flow check. Full sessions: test-warehouse-browser.mjs. */
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runSession} from './warehouse-session-browser.mjs';
const plan=JSON.parse(await readFile(new URL('../docs/warehouse-flow/plans/arrival-manual-hip.json',import.meta.url),'utf8'));
plan.lite=true;const folder=await mkdtemp(join(tmpdir(),'warehouse-flow-')),file=join(folder,'plan.json');await writeFile(file,JSON.stringify(plan));
process.env.WAREHOUSE_OUTPUT??=join(folder,'evidence');
const report=await runSession(file,process.argv[2]??'http://127.0.0.1:5332/');
assert.equal(report.pass,true,report.failures.join('\n'));
