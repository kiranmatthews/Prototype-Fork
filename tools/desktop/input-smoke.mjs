// Wait for actual game frames so slow software GPUs get a neutral input poll
// after the loading/menu release guard. Never alter game time or movement.
export async function moveOnSupportedGround(page) {
  const frame = await page.evaluate(() => window.__game.frameStats.frame);
  await page.waitForFunction(frame => window.__game.frameStats.frame >= frame + 3, frame, {timeout:30000});
  const start = await page.evaluate(() => window.__game.player.pos.toArray());
  await page.keyboard.down('ArrowUp');
  try {
    await page.waitForFunction(start => {
      const pos = window.__game.player.pos.toArray();
      return Math.hypot(...pos.map((n,i) => n - start[i])) > .2;
    }, start, {timeout:15000});
  } finally { await page.keyboard.up('ArrowUp'); }
  return {start, moved:await page.evaluate(() => window.__game.player.pos.toArray())};
}
