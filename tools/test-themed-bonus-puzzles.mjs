import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { runInputPilot } from './test-puzzle-trilogy.mjs';
import { runThemedBonusJourney, runThemedBonusWrongOrder } from './themed-bonus-pilot.mjs';
export { runThemedBonusJourney } from './themed-bonus-pilot.mjs';
const KIT='/src/levels/bonus-course-kit.ts',THEMES='/src/levels/themed-bonuses.ts';
const PATTERNS=['upper','finite','bridge','return','fuse','relay'];
const style={color:'#a79878',accent:'#debf71',tex:'stone',sky:'day'};
function testCourse(module,pattern){return module.makeBonusCourse({name:`Bonus module ${pattern}`,patterns:[pattern],style});}
export async function withThemedBonusRuntime(id,run,options={}) {
  let course;
  const module=options.modulePattern?KIT:THEMES;
  return withBlockworksRuntime(r=>run(Object.assign(r,{id,course})),{
    modulePath:module,levelId:id,controlFrame:()=>({x:0,z:-1}),
    source:sourceModule=>{
      course=options.modulePattern?testCourse(sourceModule,options.modulePattern):sourceModule.THEMED_BONUS_COURSES.find(entry=>entry.id===id||entry.parentId===id);
      if(!course)throw Error(`Missing themed bonus ${id}`);return course.data;
    },maxFrames:40000,...options,
  });
}
export async function runThemedBonusChecks({modulesOnly=false,negativeOnly=false,coursesOnly=false,ids=[],patterns=PATTERNS}={}) {
  const reports=[];
  async function run(id,pilot,options) {
    return withThemedBonusRuntime(id,async r=>{
      try {const report=runInputPilot(r,pilot);reports.push(report);console.log(JSON.stringify({id,...report.result,frames:report.frames}));return report;}
      catch(error){await writeFile(join(tmpdir(),'themed-bonus-failure.json'),JSON.stringify({id,error:error.message,report:r.report,trace:r.trace},null,2));throw error;}
    },options);
  }
  for(const pattern of coursesOnly?[]:patterns) {
    if(!negativeOnly) {
      const report=await run(`bonus-kit-${pattern}`,runThemedBonusJourney,{modulePattern:pattern});
      assert.equal(report.state,'finished');assert.equal(report.deaths,0);assert.equal(report.gemEarned,true);
    }
    await run(`bonus-kit-${pattern}-wrong`,runThemedBonusWrongOrder,{modulePattern:pattern});
  }
  if(!modulesOnly&&!negativeOnly) {
    const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
    let courseIds;
    try {const module=await server.ssrLoadModule(THEMES);courseIds=module.THEMED_BONUS_COURSES.filter(course=>!ids.length||ids.includes(course.id)||ids.includes(course.parentId)).map(course=>course.id);}
    finally {await server.close();}
    assert.ok(courseIds.length,'No themed courses selected');
    for(const id of courseIds) {
      const report=await run(id,runThemedBonusJourney,{});
      assert.equal(report.state,'finished');assert.equal(report.deaths,0);assert.equal(report.gemEarned,true);
    }
  }
  await writeFile(join(tmpdir(),'themed-bonus-physics.json'),JSON.stringify(reports,null,2));
  console.log(`PASS ${reports.length} themed-bonus input-only ${coursesOnly?'course journeys':'journeys and wrong-order trials'}`);
  return reports;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  await runThemedBonusChecks({modulesOnly:process.argv.includes('--modules-only'),coursesOnly:process.argv.includes('--courses-only'),negativeOnly:process.argv.includes('--negative-only'),ids:process.argv.filter(a=>a.startsWith('--id=')).map(a=>a.slice(5)),patterns:process.argv.some(a=>a.startsWith('--pattern='))?process.argv.filter(a=>a.startsWith('--pattern=')).map(a=>a.slice(10)):PATTERNS});
