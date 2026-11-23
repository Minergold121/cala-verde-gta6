// The 10 story jobs. Each job is stages; a stage is one verb — drive to a
// marker, steal a car, wait for low tide, cross the causeway, fight, lose the
// heat, ram a roadblock, escape by boat. Completing a job pays cash and
// respect, unlocks weapons, and advances the story dialogue.
import { CITY, dist2 } from './config.js';
import { isLowTide } from './world.js';
import { spawnThugs, clearThugs } from './combat.js';
import { spawnCar, playerCar } from './vehicles.js';
import { addHeat } from './police.js';

const ISLAND = { x: CITY.islandX, z: CITY.islandZ };

export const JOBS = [
  {
    title: 'FIRST FARE', giver: 'celia',
    intro: 'Package in the trunk, Milo. Marina drop, no detours, no heroes.',
    payout: 900, respect: 40,
    stages: [
      { kind: 'goto', text: 'Pick up Celia\u2019s package at the docks office', x: 60, z: -150, r: 9 },
      { kind: 'goto', text: 'Drive the package to the marina drop', x: -210, z: 30, r: 10 },
      { kind: 'goto', text: 'Return to Celia\u2019s garage in her quarter', x: 30, z: 30, r: 9 },
    ],
  },
  {
    title: 'HOT WIRE', giver: 'june',
    intro: 'The Meridian GT sits at the casino valet. Take it. June is already grinning.',
    payout: 1600, respect: 70,
    stages: [
      { kind: 'steal', text: 'Steal the Meridian GT from the casino valet', x: -30, z: 150, r: 12, carDef: 'meridian' },
      { kind: 'lose', text: 'Lose the police — break line of sight', x: 0, z: 0, r: 0 },
      { kind: 'goto', text: 'Deliver the Meridian GT to the garage', x: 30, z: 30, r: 9 },
    ],
  },
  {
    title: 'LOW TIDE', giver: 'sana',
    intro: 'Sana watched the water all morning. The causeway opens at low tide — and only then.',
    payout: 2100, respect: 90, tide: true,
    stages: [
      { kind: 'waitTide', text: 'Wait for LOW TIDE — watch the tide gauge', x: -230, z: CITY.islandZ, r: 14 },
      { kind: 'goto', text: 'Cross the sandbar causeway to the stash island', x: ISLAND.x, z: ISLAND.z, r: 12 },
      { kind: 'collect', text: 'Grab the stash from the island hut', x: ISLAND.x + 8, z: ISLAND.z + 4, r: 6 },
      { kind: 'goto', text: 'Get the stash back to the garage before the tide turns', x: 30, z: 30, r: 9 },
    ],
  },
  {
    title: 'MARKED MERIDIAN', giver: 'celia',
    intro: 'A Vulture is joyriding a marked car through Old Town — with CVPD watching. Take it back quietly. Or don\u2019t.',
    payout: 2400, respect: 110,
    stages: [
      { kind: 'fight', text: 'Take the marked car from the Vultures in Old Town', x: -60, z: -150, r: 16, thugs: 3 },
      { kind: 'steal', text: 'Steal the marked Sunrunner', x: -60, z: -150, r: 10, carDef: 'sunrunner' },
      { kind: 'goto', text: 'Bring the car to the garage, heat or no heat', x: 30, z: 30, r: 9 },
    ],
  },
  {
    title: 'LAST WAVE', giver: 'june',
    intro: 'Timed run, Milo. Pier, full throttle, and do not stop for the view.',
    payout: 2800, respect: 130,
    stages: [
      { kind: 'timed', text: 'Reach the marina pier in 75 seconds', x: -285, z: 30, r: 12, seconds: 75 },
      { kind: 'goto', text: 'Shake the tail — reach the beachfront safe street', x: -180, z: 180, r: 12 },
    ],
  },
  {
    title: 'CONVOY ON THE CAUSEWAY', giver: 'tomas',
    intro: 'Tomas welded the bumper himself. The roadblock is 0.5 km out. You know what to do.',
    payout: 3400, respect: 160,
    stages: [
      { kind: 'heat', text: 'Draw CVPD heat — 3 stars or more', x: 0, z: 0, r: 0 },
      { kind: 'goto', text: 'Ram the CVPD roadblock on the coast road, 0.5 km', x: -210, z: -120, r: 14 },
      { kind: 'goto', text: 'Escape down the beachfront to the safe house', x: -180, z: 210, r: 12 },
    ],
  },
  {
    title: 'THE WHEELMAN TEST', giver: 'celia',
    intro: 'Celia\u2019s test is simple: lose them all, and come home with the paint still on.',
    payout: 3800, respect: 180,
    stages: [
      { kind: 'heat', text: 'Get the CVPD on your tail — 2 stars or more', x: 0, z: 0, r: 0 },
      { kind: 'lose', text: 'Shake every unit and reach the safe street', x: 150, z: 90, r: 12 },
    ],
  },
  {
    title: 'GOLDEN HOUR', giver: 'dante',
    intro: 'Dante\u2019s boat sails at dusk. Lose the manhunt before it leaves the marina.',
    payout: 4600, respect: 220,
    stages: [
      { kind: 'heat', text: 'The manhunt is on — 3 stars and rising', x: 0, z: 0, r: 0 },
      { kind: 'timed', text: 'Reach the marina before the boat sails — 90 seconds', x: -260, z: 30, r: 14, seconds: 90 },
      { kind: 'fight', text: 'Hold the pier against Dante\u2019s Vultures', x: -260, z: 30, r: 18, thugs: 4 },
      { kind: 'lose', text: 'Lose the manhunt', x: 0, z: 0, r: 0 },
    ],
  },
  {
    title: 'SWAP PLATES', giver: 'june',
    intro: 'Crew job. June drives, Tomas fixes mid-chase, Sana spots the blocks. You just drive like the Verde is watching.',
    payout: 5400, respect: 260,
    stages: [
      { kind: 'goto', text: 'Pick up June at the casino strip', x: -60, z: 180, r: 10 },
      { kind: 'goto', text: 'Tomas is waiting at the docks with fresh plates', x: 120, z: -120, r: 10 },
      { kind: 'goto', text: 'Sana\u2019s lookout: the villa hills drop', x: 180, z: 60, r: 10 },
      { kind: 'goto', text: 'Bring the crew home to the garage', x: 30, z: 30, r: 9 },
    ],
  },
  {
    title: 'KING TIDE', giver: 'celia',
    intro: 'The big one. Highest tide window of the year, Dante\u2019s whole stash on the island, one boat out. Make it count, Milo.',
    payout: 9000, respect: 400, tide: true,
    stages: [
      { kind: 'waitTide', text: 'Wait for the LOW TIDE window', x: -230, z: CITY.islandZ, r: 14 },
      { kind: 'goto', text: 'Cross the causeway to the stash island', x: ISLAND.x, z: ISLAND.z, r: 12 },
      { kind: 'fight', text: 'Take the island from Dante\u2019s Vultures', x: ISLAND.x, z: ISLAND.z, r: 18, thugs: 5 },
      { kind: 'collect', text: 'Grab the King Tide stash', x: ISLAND.x + 8, z: ISLAND.z + 4, r: 6 },
      { kind: 'boat', text: 'Escape by boat from the marina pier', x: -300, z: 30, r: 10 },
      { kind: 'goto', text: 'Ride the boat to the far buoy', x: -380, z: 90, r: 16 },
    ],
  },
];

export function currentJob(G) {
  return JOBS[G.state.jobIndex] || null;
}

export function stageOf(G) {
  const job = currentJob(G);
  if (!job) return null;
  return job.stages[G.state.jobStage] || null;
}

export function startJob(G, index) {
  const s = G.state;
  s.jobIndex = index;
  s.jobStage = 0;
  s.jobActive = true;
  s.freeRoam = false;
  s.jobTimer = 0;
  s.jobKills = 0;
  clearThugs(G);
  const job = JOBS[index];
  G.say(job.giver, job.intro);
  G.setToast('JOB ' + (index + 1) + '/10 · ' + job.title);
  advanceStageSetup(G);
}

function advanceStageSetup(G) {
  const stage = stageOf(G);
  if (!stage) return;
  const s = G.state;
  s.jobKills = 0;
  s.jobKillsNeed = stage.thugs || 0;
  if (stage.kind === 'fight' && stage.thugs) {
    spawnThugs(G, stage.x, stage.z, stage.thugs);
    G.say('sana', 'Eyes out — ' + stage.thugs + ' Vultures holding that ground, Milo.');
  }
  if (stage.kind === 'timed') s.jobTimer = stage.seconds;
  if (stage.kind === 'heat') {
    const need = stage.text.includes('3 stars') ? 3 : 2;
    addHeat(G, need, 'The job needs heat');
  }
  if (stage.kind === 'steal' && stage.carDef) {
    const exists = G.cars.some((c) => c.defId === stage.carDef && c.parked && !c.removed && dist2(c.x, c.z, stage.x, stage.z) < 30);
    if (!exists) {
      // Park the target car on the open roadside just outside the target block.
      const roadZ = stage.z + (stage.z > 0 ? -24 : 24);
      spawnCar(G, stage.carDef, stage.x, roadZ, 0.4, { parked: true, color: stage.carDef === 'meridian' ? 0xc22e3a : 0xe8a33d });
    }
  }
}

export function completeStage(G) {
  const s = G.state;
  const job = currentJob(G);
  if (!job) return;
  s.jobStage += 1;
  if (G.audio) G.audio.stage();
  if (s.jobStage >= job.stages.length) {
    completeJob(G);
    return;
  }
  const stage = stageOf(G);
  G.setToast('STAGE ' + s.jobStage + '/' + job.stages.length + ' — ' + stage.text);
  advanceStageSetup(G);
}

export function completeJob(G) {
  const s = G.state;
  const job = currentJob(G);
  if (!job) return;
  s.cash += job.payout;
  s.respect += job.respect;
  s.jobsDone += 1;
  s.jobActive = false;
  clearThugs(G);
  // Unlocks: SMG after job 1, shotgun after job 2, rifle after job 3.
  const unlocks = [null, 2, 3, 4];
  const u = unlocks[s.jobsDone];
  if (u !== undefined && u !== null && s.weapons[u]) {
    s.weapons[u].locked = false;
    G.setToast('Unlocked: ' + s.weapons[u].name + '!');
  }
  s.armour = Math.min(100, s.armour + 25);
  if (G.audio) G.audio.cash();
  if (G.onJobComplete) G.onJobComplete(job);
}

export function updateMissions(G, dt) {
  const s = G.state;
  if (!s.jobActive) return;
  const stage = stageOf(G);
  if (!stage) return;
  const p = s.player;
  if (stage.kind === 'timed') {
    s.jobTimer -= dt;
    if (s.jobTimer <= 0) {
      G.setToast('Too slow — the window closed. The stage resets.');
      G.say('celia', 'Again, Milo. Faster this time.');
      s.jobStage = 0;
      advanceStageSetup(G);
      return;
    }
  }
  if (stage.kind === 'waitTide') {
    if (isLowTide(s.tidePhase)) completeStage(G);
    return;
  }
  if (stage.kind === 'heat') {
    const need = stage.text.includes('3 stars') ? 3 : 2;
    if (s.wanted >= need) completeStage(G);
    return;
  }
  if (stage.kind === 'lose') {
    if (s.wanted === 0) {
      if (stage.x === 0 && stage.z === 0) { completeStage(G); return; }
      if (dist2(p.x, p.z, stage.x, stage.z) < stage.r) completeStage(G);
    }
    return;
  }
  if (stage.kind === 'fight') {
    if (s.jobKills >= s.jobKillsNeed && s.jobKillsNeed > 0) completeStage(G);
    return;
  }
  if (stage.kind === 'collect') {
    if (dist2(p.x, p.z, stage.x, stage.z) < stage.r) {
      s.cash += 500;
      G.setToast('Stash grabbed. +$500 on the spot.');
      completeStage(G);
    }
    return;
  }
  if (stage.kind === 'steal') {
    const car = playerCar(G);
    if (car && car.defId === stage.carDef) completeStage(G);
    else if (dist2(p.x, p.z, stage.x, stage.z) < stage.r) {
      G.setPrompt('E — STEAL THE ' + (stage.carDef || '').toUpperCase());
    }
    return;
  }
  if (stage.kind === 'boat') {
    if (dist2(p.x, p.z, stage.x, stage.z) < stage.r) {
      G.setToast('Boat away! Ride for the far buoy.');
      // The boat leg: teleport the player onto the water run — the escape boat
      // is the marker; reaching the buoy finishes the finale.
      s.player.x = -330; s.player.z = 50;
      completeStage(G);
    }
    return;
  }
  // goto / timed: reach the marker.
  if (dist2(p.x, p.z, stage.x, stage.z) < stage.r) completeStage(G);
}

export function jobProgressText(G) {
  const job = currentJob(G);
  if (!job) return 'All 10 jobs done — Cala Verde is yours.';
  const stage = stageOf(G);
  if (!stage) return job.title;
  return stage.text;
}
