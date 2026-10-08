import { interactionTimeout } from './test-timing.mjs';
// Wait for actual game frames so slow software GPUs get a neutral input poll
// after the loading/menu release guard. Never alter game time or movement.
export async function moveOnSupportedGround(page) {
  await page.keyboard.up('ArrowUp');
  const frame = await page.evaluate(() => window.__game.frameStats.frame);
  await page.waitForFunction(frame => window.__game.frameStats.frame >= frame + 3 && window.__game.input.menuReleaseGuard === false, frame, {timeout:interactionTimeout(30000)});
  const start = await page.evaluate(() => window.__game.player.pos.toArray());
  await page.keyboard.down('ArrowUp');
  try {
    await page.waitForFunction(start => {
      const pos = window.__game.player.pos.toArray();
      return Math.hypot(...pos.map((n,i) => n - start[i])) > .2;
    }, start, {timeout:interactionTimeout(15000)});
  } catch (error) {
    const state = await Promise.race([page.evaluate(() => {
      const g=window.__game;
      return {frame:g.frameStats.frame,pos:g.player.pos.toArray(),moveY:g.input.moveY,
        guard:g.input.menuReleaseGuard,keys:[...g.input.keys],focus:document.hasFocus(),activeTag:document.activeElement?.tagName};
    }).catch(() => null),new Promise(resolve => setTimeout(() => resolve('unresponsive'),3000))]);
    throw new Error('Held movement did not advance: '+JSON.stringify({start,state}), {cause:error});
  } finally { await page.keyboard.up('ArrowUp'); }
  return {start, moved:await page.evaluate(() => window.__game.player.pos.toArray())};
}
