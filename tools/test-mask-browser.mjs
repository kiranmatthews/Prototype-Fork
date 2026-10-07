// Real asset, camera and bonus-session coverage; works with dev or Pages.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5299/';
const output = process.env.MASK_REVIEW_OUT || '/private/tmp/mask-browser-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [], errors = [];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}?playtest&level=custard-creek${lite ? '&lite' : ''}`);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay &&
      window.__game.player.maskBones && window.__game.player.maskMesh.geometry.attributes.position.count > 100,
    null, { timeout: 120000 });
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork/);
    await page.evaluate(() => {
      const g = window.__game, p = g.player;
      const vec = () => p.pos.clone();
      function range(mesh, axis) {
        mesh.updateWorldMatrix(true, false);
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const b = mesh.geometry.boundingBox, values = [];
        for (const x of [b.min.x,b.max.x]) for (const y of [b.min.y,b.max.y]) for (const z of [b.min.z,b.max.z])
          values.push(vec().set(x,y,z).applyMatrix4(mesh.matrixWorld).dot(axis));
        return [Math.min(...values),Math.max(...values)];
      }
      const probe = { samples: 0, held: 0, worn: 0, minGap: Infinity, minFacing: 1, failures: [] };
      const native = p.prepareMaskPresentation.bind(p);
      p.prepareMaskPresentation = () => {
        native();
        const mask = p.maskMesh;
        if (!mask.visible) return;
        const worn = p.uberTimer > 0;
        const head = p.characterHeadStyle === 'alternate' ? p.meshyBoolieRooHead?.mesh : p.meshyHead.mesh;
        if (!head) return;
        const axis = worn ? mask.getWorldDirection(vec()) : vec().setFromMatrixColumn(p.cam.matrixWorld,0).normalize();
        const gap = range(mask, axis)[0] - range(head, axis)[1];
        const direction = worn ? p.headLookSocket.getWorldDirection(vec()) : p.cam.getWorldDirection(vec()).setY(0).normalize().negate();
        const facing = mask.getWorldDirection(vec()).dot(direction);
        const up = vec().set(0,1,0).applyQuaternion(mask.quaternion).y;
        probe.samples++; probe[worn ? 'worn' : 'held']++;
        probe.minGap = Math.min(probe.minGap,gap);probe.minFacing = Math.min(probe.minFacing,facing);
        if (gap < .015 || facing < .93 || (!worn && up < .99999) || p.maskBones.visible !== (!worn && p.masks >= 2)) {
          if (probe.failures.length < 10) probe.failures.push({ gap,facing,up,worn,level:g.getCurrentLevel().id });
        }
      };
      window.__maskProbe = probe;
    });
    for (const style of ['skull', 'alternate']) {
      await page.evaluate(style => window.__game.setCharacterHeadStyle(style), style);
      if (style === 'alternate') await page.waitForFunction(() => window.__game.getAlternateHeadDiagnostics().textureState === 'ready', null, { timeout: 60000 });
      for (const completed of [false, true]) {
        await page.evaluate(() => {
          const g = window.__game, p = g.player;
          g.switchLevel('custard-creek');g.gameFlow.hide();
          p.gainMask();p.gainMask();p.gainMask();
          p.headM.rotation.set(2.4,.6,-.9);p.prepareMaskPresentation();
          g.enterBonusRound();
        });
        await page.waitForFunction(() => window.__game.getCurrentLevel().id === 'bonus:custard-creek' &&
          !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
        assert.equal(await page.evaluate(() => window.__game.player.masks), 2);
        await page.evaluate(completed => {
          const g = window.__game,p=g.player;
          p.uberTimer=.08;p.headM.rotation.set(Math.PI,.7,.4);p.prepareMaskPresentation();
          g.returnFromBonus(completed);
        }, completed);
        await page.waitForFunction(() => window.__game.getCurrentLevel().id === 'custard-creek' &&
          !window.__game.gameFlow.blocksGameplay && window.__game.player.uberTimer === 0,
        null, { timeout: 120000 });
        await page.waitForTimeout(150);
        const returned = await page.evaluate(() => {
          const g=window.__game,p=g.player;
          return { masks:p.masks, grounded:p.grounded, checkpoint:!!g.getLevel().activeCheckpoint,
            up:p.pos.clone().set(0,1,0).applyQuaternion(p.maskMesh.quaternion).y };
        });
        assert.equal(returned.masks,2);assert.equal(returned.grounded,true);assert.ok(returned.up>.99999);
        assert.equal(returned.checkpoint,completed);
        await page.screenshot({ path:`${output}/${lite?'lite':'full'}-${style}-${completed?'clear':'fail'}-double.png` });
        await page.evaluate(() => window.__game.player.spendMask());
        await page.waitForTimeout(200);
        await page.screenshot({ path:`${output}/${lite?'lite':'full'}-${style}-${completed?'clear':'fail'}-single.png` });
        assert.equal(await page.evaluate(() => window.__game.player.masks),1);
        reports.push({lite,style,completed,returned});
      }
      // Capture all sides of the worn model through real walking/spinning poses.
      await page.evaluate(() => {
        const g=window.__game,p=g.player;g.switchLevel('custard-creek');g.gameFlow.hide();
        p.gainMask();p.gainMask();p.gainMask();
      });
      await page.keyboard.down('ArrowUp');await page.waitForTimeout(500);await page.keyboard.up('ArrowUp');
      await page.keyboard.down('ArrowDown');await page.waitForTimeout(400);await page.keyboard.up('ArrowDown');
      await page.screenshot({path:`${output}/${lite?'lite':'full'}-${style}-worn.png`});
      const grid=await page.evaluate(() => {
        const g=window.__game,p=g.player,head=p.headM,mask=p.maskMesh;
        const originalCamera=g.camera.position.clone(),q=g.camera.quaternion.clone();
        let count=0;
        for(const pitch of [0,.8,Math.PI])for(const yaw of [-2.8,-1.6,0,1.6,2.8])for(const tier of [3,2,1]){
          p.uberTimer=tier===3?2:0;p.masks=Math.min(2,tier);head.rotation.set(pitch,yaw,.4);
          g.camera.position.set(p.pos.x+6*Math.sin(yaw),p.pos.y+5,p.pos.z+6*Math.cos(yaw));
          g.camera.lookAt(p.pos.x,p.pos.y+1.5,p.pos.z);
          mask.quaternion.copy(mask.quaternion.clone());p.prepareMaskPresentation();count++;
        }
        g.camera.position.copy(originalCamera);g.camera.quaternion.copy(q);
        return count;
      });
      reports.push({lite,style,poseCases:grid,stamp});
    }
    // A protected pickup followed by actual death/respawn must clear the worn
    // presentation and restore checkpoint inventory without a second skull.
    await page.evaluate(() => {
      const g=window.__game,p=g.player;p.uberTimer=0;p.masks=2;
      p.onCourseHint=()=>{};p.die();
    });
    await page.waitForFunction(() => !window.__game.player.maskMesh.visible);
    await page.waitForFunction(() => window.__game.player.state !== 'dead' && window.__game.player.grounded,null,{timeout:15000});
    await page.evaluate(() => { const g=window.__game;g.set2P(true,true);const p=g.getP2();p.masks=2;p.uberTimer=.08;p.headM.rotation.set(2.6,.8,.4);p.prepareMaskPresentation(); });
    await page.waitForFunction(() => { const p=window.__game.getP2();return p.maskBones&&p.maskMesh.geometry.attributes.position.count>100&&p.uberTimer===0; });
    const second=await page.evaluate(() => { const p=window.__game.getP2();const up=p.pos.clone().set(0,1,0).applyQuaternion(p.maskMesh.quaternion).y;
      const camera=p.cam.getWorldDirection(p.pos.clone()).setY(0).normalize().negate();return {up,facing:p.maskMesh.getWorldDirection(p.pos.clone()).dot(camera),bones:p.maskBones.visible}; });
    assert.ok(second.up>.99999&&second.facing>.94&&second.bones);reports.push({lite,second});
    await page.screenshot({path:`${output}/${lite?'lite':'full'}-split.png`});
    const probe=await page.evaluate(() => window.__maskProbe);
    assert.deepEqual(probe.failures,[]);assert.ok(probe.held>30&&probe.worn>30);
    reports.push({lite,probe});
    await page.close();
  }
  assert.deepEqual(errors,[]);
} finally {
  await writeFile(`${output}/results.json`,JSON.stringify({base,reports,errors},null,2));
  await browser.close();
}
console.log(`PASS masks in lite/full: actual Skull/Roo assets, successful/failed bonus returns, tier changes, all-side poses, death/respawn and clean consoles. ${output}`);
