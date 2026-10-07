import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createServer } from 'vite';

// Compare the production SVG transforms with actual Canvas matrix composition,
// including the authored non-uniform BONUS glyph sizes and optical spacing.
const multiply = (a, b) => [
  a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5],
];
const identity = () => [1, 0, 0, 1, 0, 0];
const point = (m, x, y) => [m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]];
function recorder() {
  let matrix = identity(); const stack = [];
  return {
    save() { stack.push([...matrix]); }, restore() { matrix = stack.pop(); },
    translate(x, y) { matrix = multiply(matrix, [1,0,0,1,x,y]); },
    scale(x, y) { matrix = multiply(matrix, [x,0,0,y,0,0]); },
    rotate(angle) { const c=Math.cos(angle),s=Math.sin(angle); matrix=multiply(matrix,[c,s,-s,c,0,0]); },
    point: (x, y) => point(matrix, x, y), matrix: () => matrix,
  };
}
function svgMatrix(raw) {
  const ctx = recorder();
  for (const [, op, args] of raw.matchAll(/(translate|rotate|scale)\(([^)]+)\)/g)) {
    const values = args.split(/\s+/).map(Number);
    if (op === 'rotate') ctx.rotate(values[0]*Math.PI/180);
    else ctx[op](...values);
  }
  return ctx.matrix();
}
const media = { matches: false };
globalThis.matchMedia = () => media;
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { BonusTitleAnimation, paintBonusTitle, bonusTitlePose, bonusTitleWordScale, BONUS_TITLE_LOOP_MS } = await server.ssrLoadModule('/src/bonusTitle.ts');
  const { layoutRooAtlas } = await server.ssrLoadModule('/src/roo-type/atlas.ts');
  const { ROO_ATLAS_METRICS } = await server.ssrLoadModule('/src/roo-type/atlas-metrics.ts');
  const { getRooAppearance } = await server.ssrLoadModule('/src/roo-type/settings.ts');
  const metrics = ROO_ATLAS_METRICS.bonus;
  const layout = layoutRooAtlas(metrics, 'BONUS', getRooAppearance().tracking);
  const layers = Array.from({length:3}, () => Array.from({length:5}, () => ({
    transform: '', setAttribute(name, value) { this[name] = value; },
  })));
  let onLayout;
  const host = { dataset: {}, addEventListener: (_event, listener) => { onLayout=listener; },
    closest: () => false,
    querySelectorAll: () => layers.map(layer => ({ querySelectorAll: () => layer })),
  };
  const animation = new BonusTitleAnimation(host); onLayout(); animation.restart(0);
  const rect = {x:100, y:20, width:(layout.width+.06)*100, height:128.5};
  const cap = 100, left = rect.x+.03*cap, top = rect.y+14.25;
  for (const reduced of [false, true]) {
    media.matches = reduced;
    for (const elapsed of [0, 650, 780, 1140, 1400, 1800, 2140, 2600, 3400, 4540]) {
      animation.update(elapsed);
      const ctx = recorder(), actual = [];
      const painter = { ready: true, draw(context, char, x, y, style) {
        const g=metrics.glyphs[char], s=style.size;
        actual.push(context.point(x+(g.inkRight-g.inkLeft)*s/2, y-s/2+((g.inkTop??0)+(g.inkBottom??1))*s/2));
        assert.ok(Math.hypot(...context.matrix().slice(0,2)) <= 1.000001, 'animated scale churns the atlas raster cache');
        return true;
      }};
      assert.equal(paintBonusTitle(ctx,painter,rect,cap,.8,elapsed),true);
      assert.equal(actual.length,5);
      for (const [i, entry] of layout.glyphs.entries()) {
        const g=metrics.glyphs[entry.char];
        const centre=[entry.x+(g.inkLeft+g.inkRight)*entry.sx/2,entry.y+((g.inkTop??0)+(g.inkBottom??1))*entry.sy/2];
        const expected=point(svgMatrix(layers[0][i].transform),...centre);
        assert.ok(Math.abs(actual[i][0]-(left+expected[0]*cap))<1e-7, `letter ${i} X differs across render paths at ${elapsed}`);
        assert.ok(Math.abs(actual[i][1]-(top+expected[1]*cap))<1e-7, `letter ${i} Y differs across render paths at ${elapsed}`);
        assert.equal(layers[0][i].transform,layers[2][i].transform,'shimmer layers separate during motion');
        if (reduced) assert.deepEqual(bonusTitlePose(elapsed,i,true),{y:0,angle:0,scaleX:1,scaleY:1,alpha:1});
      }
      assert.deepEqual(ctx.matrix(),identity(),'title paint leaks a Canvas transform');
    }
  }
  assert.equal(bonusTitleWordScale(1400),1,'title should keep its authored optical positions');
  assert.equal(bonusTitlePose(200,4).alpha,0,'last letter appears before its turn');
  assert.equal(bonusTitlePose(1800,4).alpha,1,'settled title never becomes complete');
  for (let time=0;time<BONUS_TITLE_LOOP_MS;time+=17) for(let i=0;i<5;i++) {
    assert.deepEqual(bonusTitlePose(time,i),bonusTitlePose(time+BONUS_TITLE_LOOP_MS,i),'loop discontinuity');
    assert.ok(bonusTitlePose(time,i).scaleX>0,'letter turn inverts the artwork');
    assert.equal(bonusTitleWordScale(time,true),1);
  }

  // Run the real destination/reset/visibility methods against the existing HUD
  // visibility model. A successful return begins payout in this same JS task.
  const source = await readFile(new URL('../src/ui.ts',import.meta.url),'utf8');
  const ast = ts.createSourceFile('ui.ts',source,ts.ScriptTarget.Latest,true);
  const cls = ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='UI');
  const names = ['setLevel','resetHudTransients','syncHudVisibility','setHudReveal'];
  const methods = names.map(name=>cls.members.find(m=>m.name?.text===name).getText(ast)).join('\n');
  const code = ts.transpileModule(`class Harness {${methods}}; globalThis.Harness=Harness;`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  const cleared=[], scheduled=[];
  const scope = {performance:{now:()=>0},HUD_REVEAL_EXIT_MS:150,window:{clearTimeout:id=>cleared.push(id),setTimeout:fn=>{scheduled.push(fn);return 9;}}};
  runInNewContext(code,scope);
  const { HudVisibilityState } = await server.ssrLoadModule('/src/hudVisibility.ts');
  function element() {
    const classes=new Set();return {style:{},setAttribute(){},classList:{
      add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v),
      toggle(v,on){if(on)classes.add(v);else classes.delete(v);},
    }};
  }
  for(const destination of ['standard','hub','competition']) {
    const ui = new scope.Harness();
    for(const name of ['gameHudLayer','livesRowEl','livesEl','bonusTitleEl','wumpaRowEl','crateRowEl','relicRowEl','scorePlateEl'])ui[name]=element();
    Object.assign(ui,{setBonusTransfer(){},endCombo(){},refreshEditControls(){},bonusTitleAnimation:animation,levelRows:new Map(),prevHud:{points:0},
      hudVisibility:new HudVisibilityState(),hudBonusExitTimer:7,bonusMode:true,runRowsHidden:false,endlessDeaths:false});
    ui.gameHudLayer.classList.add('hud-bonus');
    ui.setLevel('parent',destination,8,false);
    assert.equal(ui.gameHudLayer.classList.contains('hud-bonus'),false,`${destination} still uses the bonus bottom layout`);
    assert.equal(ui.bonusTitleEl.style.display,'none','BONUS leaks into the return frame');
    assert.equal(ui.hudBonusExitTimer,null);
    assert.equal(ui.hudVisibilityFrame.showBonusTitle,false);
  }
  assert.deepEqual(cleared,[7,7,7]);assert.equal(scheduled.length,0,'return schedules a delayed layout change');
  console.log('PASS BONUS loop, reduced motion, SVG/native glyph parity, stable atlas rasters and synchronous parent HUD restoration');
} finally { await server.close(); }
