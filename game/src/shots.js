// Screenshot staging behind ?shot=chase|foot|tide|garage (with &seed=N).
// Each shot sets the REAL game state — a car, wanted stars, police, a
// helicopter, a mission stage, a tide phase — then the normal loop renders
// it, so every screenshot is a genuine frame of the game, reproducible
// from the same seed. The loop keeps running; the shot is taken after the
// scene settles.
import { CITY, fmtCash } from './config.js';
import { spawnCar, paintCar } from './vehicles.js';
import { spawnThugs } from './combat.js';
import { startJob } from './missions.js';
import { openGarage } from './hud.js';
import { isLowTide } from './world.js';

function placeChase(G) {
  const s = G.state;
  s.cash = 86250;
  s.respect = 340;
  s.wanted = 3;
  s.health = 82;
  s.armour = 45;
  s.weapons[2].locked = false;
  s.weapons[2].ammo = 96;
  s.weapons[3].locked = false;
  s.weapons[3].ammo = 18;
  s.weaponIndex = 2;
  s.clockMin = 18 * 60 + 40;
  // Player mid-chase on the beachfront avenue, low behind the car.
  const car = spawnCar(G, 'meridian', -170, 60, Math.PI / 2, { color: 0xc22e3a });
  car.speed = 30;
  s.player.carId = car.id;
  s.player.onFoot = false;
  s.player.x = car.x; s.player.z = car.z; s.player.yaw = car.yaw;
  s.camYaw = Math.PI / 2;
  if (G.playerMesh) G.playerMesh.visible = false;
  // Police flanking the player car — visible behind it, never in its lane.
  const p1 = spawnCar(G, 'interceptor', -176, 53, Math.PI / 2, { police: true });
  p1.unitName = 'PELICAN-11'; p1.tactic = 'RAMMING'; p1.speed = 28;
  const p2 = spawnCar(G, 'interceptor', -175, 67, Math.PI / 2, { police: true });
  p2.unitName = 'GECKO-25'; p2.tactic = 'SPOTLIGHT'; p2.speed = 26;
  const p3 = spawnCar(G, 'interceptor', -179, 57, Math.PI / 2, { police: true });
  p3.unitName = 'AIR-1'; p3.tactic = 'ROADBLOCK'; p3.speed = 24;
  G.policeSeq = 3;
  // Traffic ahead on the avenue and a pedestrian on the sidewalk.
  spawnCar(G, 'taxi', -115, 66, Math.PI / 2, { parked: true, color: 0xe8c832 });
  if (G.peds && G.peds[0]) { G.peds[0].x = -140; G.peds[0].z = 76; G.peds[0].flee = 0; }
  startJob(G, 7);
  s.jobStage = 3;
  G.say('dante', 'The boat sails in two minutes, Milo — and the whole CVPD is between you and it.');
  G.setToast('GOLDEN HOUR — lose the manhunt before Dante\u2019s boat sails.');
  void fmtCash;
}

export function stageShot(G, name) {
  const s = G.state;
  s.mode = 'play';
  G.shotFreeze = true;
  document.getElementById('hud').classList.add('on');
  document.getElementById('start-screen').classList.remove('on');
  if (name === 'foot') {
    // On foot in Old Town with crew dialogue, mission panel live.
    s.player.x = -60; s.player.z = -140; s.player.onFoot = true; s.player.carId = null;
    s.camYaw = 0.6;
    s.cash = 12480;
    s.respect = 120;
    s.clockMin = 18 * 60 + 22;
    if (G.playerMesh) { G.playerMesh.visible = true; }
    spawnThugs(G, -52, -128, 2);
    startJob(G, 3);
    G.say('june', 'Vultures took the marked car, Milo. Sana has eyes on the street — take it back.');
    G.setToast('MARKED MERIDIAN — repossess the Vulture car.');
    return;
  }
  if (name === 'tide') {
    // Low tide: causeway exposed, stash island ahead, gauge at the window.
    s.tidePhase = 0.5;
    s.player.x = -238; s.player.z = CITY.islandZ; s.player.onFoot = false;
    const car = spawnCar(G, 'sunrunner', -238, CITY.islandZ, -Math.PI / 2, { color: 0xe8a33d });
    car.speed = 12;
    s.player.carId = car.id;
    s.player.yaw = car.yaw;
    if (G.playerMesh) G.playerMesh.visible = false;
    s.cash = 21400;
    s.respect = 210;
    s.clockMin = 17 * 60 + 55;
    startJob(G, 2);
    G.say('sana', 'Low tide, Milo — the causeway is open. The stash island is right there. Go, go, go!');
    G.setToast('LOW TIDE — the causeway is open!');
    return;
  }
  if (name === 'garage') {
    // Garage overlay over the 3D street, car + upgrades + cash + respect.
    s.player.x = 30; s.player.z = 12; s.player.onFoot = true; s.player.carId = null;
    s.camYaw = 2.6;
    s.cash = 18450;
    s.respect = 310;
    s.ownedCars = ['dockside', 'meridian', 'sunrunner'];
    s.engineLevel = 2; s.armourLevel = 1;
    if (G.playerMesh) G.playerMesh.visible = true;
    spawnCar(G, 'meridian', 30, 12, Math.PI / 2, { color: 0xc22e3a, engineLevel: 2, armourLevel: 1 });
    startJob(G, 4);
    G.say('tomas', 'Engine tune two, armour one — she\u2019ll eat the roadblock for breakfast, Milo.');
    // Open the garage a beat after the first frame so the 3D scene is behind it.
    setTimeout(() => { if (G.state.mode === 'play') openGarage(G); }, 350);
    return;
  }
  // Default: the cover chase.
  placeChase(G);
  void isLowTide;
}
