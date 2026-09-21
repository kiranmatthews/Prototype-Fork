import assert from 'node:assert/strict';
import {withSkateRuntime} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({THREE,Level})=>{
  const level=new Level(new THREE.Scene(),{id:'sky',name:'Sky Bridge'});
  try{
    assert.ok(level.ropes.length>0);let updates=0;
    for(const rope of level.ropes){const update=rope.visual.update.bind(rope.visual);rope.visual.update=(...args)=>{updates++;return update(...args);};}
    for(let i=0;i<120;i++)level.update(1/60);
    assert.equal(updates,0,'idle ropes must not rewrite vertex buffers or rebuild grind paths');
    const rope=level.ropes[0],middle=Math.floor(rope.rest.length/2),y=rope.rest[middle].y;
    for(let i=0;i<10;i++){rope.active=true;level.update(1/60);}
    assert.equal(updates,10);assert.ok(rope.rail.points[middle].y<y,'occupied rope still sags');
    for(let i=0;i<30;i++)level.update(1/60);
    assert.equal(rope.state,'idle');assert.equal(rope.rail.points[middle].y,y,'last recovery tick restores the exact rest path');
    const settled=updates;for(let i=0;i<60;i++)level.update(1/60);assert.equal(updates,settled);
    for(let i=0;i<Math.ceil(rope.breakTime*60)+3;i++){rope.active=true;level.update(1/60);}
    assert.equal(rope.state,'break');assert.equal(rope.rail.grindable,false);
    for(let i=0;i<Math.ceil((1.3+rope.regen)*60)+3;i++)level.update(1/60);
    assert.equal(rope.state,'idle');assert.equal(rope.rail.grindable,true);assert.equal(rope.rail.points[middle].y,y);
    console.log('PASS idle rope buffers, loaded sag, exact recovery, break collision and restring.');
  }finally{level.dispose();}
});
