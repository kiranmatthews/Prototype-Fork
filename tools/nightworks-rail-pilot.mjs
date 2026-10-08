// Native device-sample pilots for the two required Nightworks grind crossings.
// Sampling reads production state; observation records real contacts. Neither
// helper changes positions, velocity, movement tuning, checkpoints or time.
const clamp = value => Math.max(-1, Math.min(1, value));
const componentOf = object => {
  for (let node = object; node; node = node.parent) if (Number.isInteger(node.userData?.editorIdx)) return node.userData.editorIdx;
  return null;
};
const balanceInput = p => clamp(-p.balance * 5 - p.balanceVel * .7);
const directionInput = (p, l, x, z, pace = 1) => {
  const f = p.courseInputDirection(l) ?? p.camDir, n = Math.hypot(x, z) || 1, fn = Math.hypot(f.x, f.z) || 1;
  return { moveX: (x * -f.z + z * f.x) / n / fn * pace, moveY: (x * f.x + z * f.z) / n / fn * pace };
};
const railInGroup = (source, l, group) => l.rails.filter(rail => { const component = source.NIGHTWORKS_AFTER_HOURS_LEVEL.components[componentOf(rail.object)]; return component?.grp === group && component.t === 'rail'; });
const lineZ = rail => (rail.points[0].z + rail.points.at(-1).z) / 2;
const aligned = (p, x, z, threshold = .995) => (p.axisF.x * x + p.axisF.z * z) / (Math.hypot(x, z) || 1) > threshold;
const lineX = rail => (rail.points[0].x + rail.points.at(-1).x) / 2;
const checkpointSpin = (p, l) => l.checkpoints.some(cp => !cp.active && p.pos.distanceTo(cp.spawnPos) < 2.5);
const groundedComponent = (p, source) => p.grounded ? source.NIGHTWORKS_AFTER_HOURS_LEVEL.components[componentOf(p.groundHit?.mesh)] : null;

function recorder(kind, source) {
  let lastRail = null, previousMounted = false, frame = 0, pendingPop = null;
  const evidence = { kind, frame: 0, railCatches: [], pops: [], phaseContacts: [], mountedFrames: 0, footFrames: 0, bails: 0, deaths: 0, exit: null, done: false };
  return { evidence, pop(name, p) { pendingPop = { name, frame: frame + 1, takeoff: p.pos.toArray(), previousState: p.state, railComponent: componentOf(p.grindRail?.object) }; },
    observe(p, l) {
      frame++; evidence.frame = frame;
      if (pendingPop) {
        if (p.state === 'air' && ['ride', 'grind'].includes(pendingPop.previousState)) evidence.pops.push({ ...pendingPop, time: l.time, position: p.pos.toArray() });
        pendingPop = null;
      }
      previousMounted ||= p.boardRolling;
      if (previousMounted) { if (p.boardRolling) evidence.mountedFrames++; else if (p.state !== 'finished') evidence.footFrames++; }
      evidence.bails += Number(p.isBailing); evidence.deaths = p.totalDeaths;
      const rail = p.state === 'grind' ? componentOf(p.grindRail?.object) : null;
      if (rail !== null && rail !== lastRail) evidence.railCatches.push({ frame, component: rail, name: source.NIGHTWORKS_AFTER_HOURS_LEVEL.components[rail]?.nm, time: l.time, position: p.pos.toArray() });
      lastRail = rail;
      const support = groundedComponent(p, source);
      if (support?.t === 'phasepad') {
        const component = componentOf(p.groundHit?.mesh);
        if (!evidence.phaseContacts.some(contact => contact.component === component)) evidence.phaseContacts.push({ frame, component, name: support.nm, time: l.time, lit: l.phasePads.some(pad => componentOf(pad.mesh) === component && pad.on), position: p.pos.toArray() });
      }
    }, finish(p) { evidence.exit = { frame, position: p.pos.toArray(), mounted: p.boardRolling, state: p.state }; evidence.done = true; },
  };
}

export function createCounterweightPilot(source,options={}) {
  const stage = source.AFTER_HOURS_STAGES.find(s => s.kind === 'rail-transfer'), record = recorder('counterweight', source);
  let mode = 'reframe', released = false, readCursor = 0, readBrake = false, transferAim = 0, transferReleased = false;
  record.evidence.readFrames = 0; record.evidence.brakeFrames = 0;
  const transferSpeed=options.tuning?.grindTransferSpeed??4.8;
  const futureZ=(rail,time)=>{
    const c=source.NIGHTWORKS_AFTER_HOURS_LEVEL.components[componentOf(rail.object)];
    return c?.axis==='z'?c.p[2]+Math.sin(time*(c.speed??.6)+(c.phase??0))*(c.amp??0):lineZ(rail);
  };
  const transferWindow=(p,l,first,second)=>{
    const distance=Math.max(0,Math.min(...first.points.map(q=>q.x))-2-p.pos.x),speed=Math.abs(p.speed);
    const run=(Math.sqrt(speed*speed+18*distance)-speed)/9;
    const takeoff=l.time+run+.1+(first.totalLength-6)/Math.max(12,speed+9*run);
    return Math.abs(futureZ(second,takeoff+.6)-futureZ(first,takeoff))<3.4;
  };
  const pilot = { evidence: record.evidence, get done() { return record.evidence.done; },
    sample(p, l) {
      const [first, second] = railInGroup(source, l, stage.grp);
      if (!first || !second) throw new Error('Counterweight pilot needs both authored runtime rails');
      // Releasing the stick once lets a held northward approach acquire the
      // dock's east-facing camera frame while the charged board keeps rolling.
      if (mode === 'reframe') return { jumpHeld: p.charging, grindHeld: true, spinHeld: checkpointSpin(p, l) };
      if (mode === 'read') {
        record.evidence.readFrames++;
        if (!p.grounded) return {};
        // Directional coasting keeps the authored 12 m/s cruise after the
        // initial Circle brake, so reading does not keep adding charge speed.
        if (p.speed > 15) readBrake = true; if (p.speed < 13) readBrake = false;
        if (readBrake) { record.evidence.brakeFrames++; return { jumpHeld: false, grabHeld: true, spinHeld: checkpointSpin(p, l) }; }
        // A supported western turn brings a northbound delivery back through
        // its checkpoint, then gives the board a real eastbound run-up.
        const path = [[stage.start[0] - 8, stage.start[2] - 11], [stage.checkpoint[0], stage.checkpoint[2]]];
        const target = path[Math.min(readCursor, path.length - 1)];
        if (Math.hypot(p.pos.x - target[0], p.pos.z - target[1]) < (readCursor === 0 ? 4 : 2.5)) {
          if (readCursor === 0) readCursor++;
          else if(transferWindow(p,l,first,second)) { mode = 'approach'; return { jumpHeld: true, grindHeld: true, spinHeld: checkpointSpin(p, l) }; }
          else readCursor=0; // another supported reading circuit; never advance the phase clock directly
        }
        const next = path[Math.min(readCursor, path.length - 1)];
        return { ...directionInput(p, l, next[0] - p.pos.x, next[1] - p.pos.z, .55), jumpHeld: false, spinHeld: checkpointSpin(p, l) };
      }
      if (mode === 'approach' && p.state === 'grind' && p.grindRail === first) mode = 'first';
      if (mode === 'transfer' && p.state === 'grind' && p.grindRail === second) mode = 'second';
      if (mode === 'approach') {
        if (released && !p.grounded) return { grindHeld: true };
        const sample = { ...directionInput(p, l, 10, lineZ(first) - p.pos.z), jumpHeld: true, grindHeld: true, spinHeld: checkpointSpin(p, l) };
        if (!released && p.grounded && p.pos.x >= Math.min(...first.points.map(point => point.x)) - 2 && (p.axisF.x * 10 + p.axisF.z * (lineZ(first) - p.pos.z)) / Math.hypot(10, lineZ(first) - p.pos.z) > .995) { released = true; sample.jumpHeld = false; record.pop('Catch first counterweight', p); }
        return sample;
      }
      if (mode === 'first') {
        if (p.pos.x >= Math.max(...first.points.map(point => point.x)) - 6) {
          const aim={moveX:clamp((futureZ(second,l.time+.6)-p.pos.z)/Math.max(.01,transferSpeed*.6)),moveY:0,grindHeld:true};
          // Current controls commit lateral launch before releasing Jump;
          // an airborne stick change is a trick, not flight steering.
          if(transferAim++<3)return {...aim,jumpHeld:true};
          mode='transfer';record.pop('Counterweight handoff',p);return {...aim,jumpHeld:false};
        }
        return { moveX: balanceInput(p), moveY: 1, jumpHeld: true, grindHeld: true };
      }
      if (mode === 'transfer') {
        const grindHeld=transferReleased;transferReleased=true;
        return {moveX:0,moveY:0,jumpHeld:false,grindHeld};
      }
      if (mode === 'second') {
        if (p.pos.x >= Math.max(...second.points.map(point => point.x)) - 4) { mode = 'exit'; record.pop('Counterweight receiving dock', p); return { moveX: 0, moveY: 1, jumpHeld: false, grindHeld: true }; }
        return { moveX: balanceInput(p), moveY: 1, jumpHeld: true, grindHeld: true };
      }
      if(!p.grounded)return {grindHeld:false};
      return { ...directionInput(p, l, 10, stage.end[2] - p.pos.z), jumpHeld: false, grindHeld: false };
    },
    observe(p, l) {
      record.observe(p, l);
      if (mode === 'reframe') mode = p.boardRolling && p.speed > 15 ? 'read' : 'approach';
      if (mode === 'exit' && p.grounded && p.boardRolling && groundedComponent(p, source)?.nm === 'Pendulum receiving dock') record.finish(p);
    },
  };
  return pilot;
}

export const createAfterHoursCounterweightPilot = createCounterweightPilot;

export function createFinaleRailPilot(source) {
  const stage = source.AFTER_HOURS_STAGES.find(s => s.kind === 'finale'), record = recorder('finale', source);
  const phaseSource = source.NIGHTWORKS_AFTER_HOURS_LEVEL.components.find(c => c.grp === stage.grp && c.t === 'phasepad');
  let mode = 'read', phaseReleased = false, railReleased = false, groundCharge = 0, readBrake = false, summitAim = 0;
  const pilot = { evidence: record.evidence, get done() { return record.evidence.done; },
    sample(p, l) {
      const rail = railInGroup(source, l, stage.grp).find(r => source.NIGHTWORKS_AFTER_HOURS_LEVEL.components[componentOf(r.object)]?.t === 'rail');
      const pad = l.phasePads.find(pad => source.NIGHTWORKS_AFTER_HOURS_LEVEL.components[componentOf(pad.mesh)] === phaseSource);
      if (!rail || !pad) throw new Error('Finale pilot needs the authored final phase deck and moving ridge');
      if (mode === 'read') {
        const travel = (Math.sqrt(p.speed * p.speed + 18 * Math.max(0, p.pos.z + 600)) - p.speed) / 9;
        const k = (((l.time + travel + .6) / pad.cycle + pad.phase) % 1 + 1) % 1, remaining = k < pad.duty ? (pad.duty - k) * pad.cycle : -1;
        const ridgeSource=source.NIGHTWORKS_AFTER_HOURS_LEVEL.components[componentOf(rail.object)];
        const exitX=ridgeSource.p[0]+Math.sin((l.time+travel+3)*ridgeSource.speed+ridgeSource.phase)*ridgeSource.amp;
        // Take the phase-and-ridge chain when the moving crest will deliver
        // its committed final jump toward the gate, not the far dock edge.
        if (remaining > .65 && exitX>=128 && (!p.boardRolling || p.pos.z > -595 && p.axisF.z < -.75)) mode = 'phase-approach';
        else if (!p.boardRolling) return { jumpHeld: true };
        else {
          // Keep a slow mounted reading arc inside the dock if this helper is
          // entered from a continuous run rather than a fresh checkpoint.
          const dx = p.pos.x - stage.start[0], dz = p.pos.z - stage.start[2], distance = Math.hypot(dx, dz);
          const x = distance < 4 ? dx || 1 : dz - dx * .8, z = distance < 4 ? dz : -dx - dz * .8;
          if (p.speed > 15) readBrake = true; if (p.speed < 13) readBrake = false;
          // Brake excess entry speed once, then coast through the reading
          // arc. Circle holds its slide heading, so pumping/braking every
          // turn cannot steer a safe waiting circle on the small dock.
          if(readBrake)return {jumpHeld:false,grabHeld:true,spinHeld:checkpointSpin(p,l)};
          return { ...directionInput(p, l, x, z, .55), jumpHeld: false, spinHeld: checkpointSpin(p, l) };
        }
      }
      if (mode === 'phase-approach') {
        if (phaseReleased && !p.grounded) return {};
        const phaseAimX = phaseSource.p[0] + 3;
        const takeoffZ = phaseSource.p[2] + 5.8 + Math.max(9, p.speed * .6 * .9);
        const input = { ...directionInput(p, l, phaseAimX - p.pos.x, -12), jumpHeld: true, grindHeld: false, spinHeld: checkpointSpin(p, l) };
        if (!phaseReleased && p.grounded && p.pos.z <= takeoffZ && aligned(p, phaseAimX - p.pos.x, -12)) { phaseReleased = true; input.jumpHeld = false; record.pop('Final phase approach', p); }
        return input;
      }
      if (mode === 'phase') {
        groundCharge++;
        const targetZ = Math.max(...rail.points.map(point => point.z));
        const railSource = source.NIGHTWORKS_AFTER_HOURS_LEVEL.components[componentOf(rail.object)];
        const arrivalX = railSource.axis === 'x' ? railSource.p[0] + Math.sin((l.time + .55) * railSource.speed + railSource.phase) * railSource.amp : lineX(rail);
        const input = { ...directionInput(p, l, arrivalX - p.pos.x, targetZ - p.pos.z), jumpHeld: true, grindHeld: true };
        if (!railReleased && p.grounded && p.pos.z <= phaseSource.p[2] - 2.5 && p.xHoldT >= .4 - 1e-6 && aligned(p, arrivalX - p.pos.x, targetZ - p.pos.z, .99)) {
          railReleased = true; mode = 'rail-air'; input.jumpHeld = false; record.pop('Final moving-ridge catch', p);
        }
        return input;
      }
      if (mode === 'rail-air') return { grindHeld: true };
      if (mode === 'grind') {
        if (p.pos.z <= -663) {
          const aim={moveX:clamp((stage.end[0]-p.pos.x)*.25),moveY:0,grindHeld:true};
          if(summitAim++<3)return {...aim,jumpHeld:true};
          mode='summit-air';record.pop('Higher summit landing',p);return {...aim,jumpHeld:false};
        }
        return { moveX: balanceInput(p), moveY: 1, jumpHeld: true, grindHeld: true };
      }
      if (mode === 'summit-air') return { grindHeld: false };
      return { ...directionInput(p, l, stage.end[0] - p.pos.x, stage.end[2] - p.pos.z), jumpHeld: false };
    },
    observe(p, l) {
      record.observe(p, l);
      if (mode === 'phase-approach' && groundedComponent(p, source) === phaseSource) { mode = 'phase'; groundCharge = 0; }
      const rail = p.state === 'grind' ? source.NIGHTWORKS_AFTER_HOURS_LEVEL.components[componentOf(p.grindRail?.object)] : null;
      if (rail?.t === 'rail' && rail.grp === stage.grp) mode = 'grind';
      if (mode === 'summit-air' && p.grounded && groundedComponent(p, source)?.nm === 'Summit finish dock') mode = 'summit';
      if (p.state === 'finished' && record.evidence.phaseContacts.length && record.evidence.railCatches.some(c => source.NIGHTWORKS_AFTER_HOURS_LEVEL.components[c.component]?.t === 'rail')) record.finish(p);
    },
  };
  return pilot;
}

export const createAfterHoursFinaleRailPilot = createFinaleRailPilot;
