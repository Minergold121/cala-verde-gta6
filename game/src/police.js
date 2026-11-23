// CVPD dispatch: named units with distances and tactics, pursuit cars that
// ram and PIT, roadblocks at high heat, and Air One — the helicopter with a
// visible spotlight cone from 3 stars up. Wanted stars decay when the player
// breaks line of sight.
import { clamp, dist2 } from './config.js';
import { spawnCar, syncCarMesh, damageCar } from './vehicles.js';
import { scarePedestrians } from './pedestrians.js';

const THREE = window.THREE;

const UNIT_NAMES = ['PELICAN-11', 'GECKO-25', 'HERON-07', 'MARLIN-33', 'COBRA-19', 'TURTLE-42', 'FALCON-08', 'RAY-51'];
const TACTICS = ['RAMMING', 'SPOTLIGHT', 'ROADBLOCK', 'INTERCEPTOR', 'PIT MOVE', 'PURSUE'];

export function wantedFor(stars) {
  return clamp(stars, 0, 5);
}

export function addHeat(G, stars, reason) {
  const s = G.state;
  if (s.wanted < stars) {
    s.wanted = stars;
    s.unseen = 0;
    if (G.audio) G.audio.sirenBurst();
    if (reason) G.setToast(reason + ' — CVPD dispatch rolling.');
  }
}

function spawnUnit(G, name, x, z) {
  const car = spawnCar(G, 'interceptor', x, z, 0, { police: true });
  car.unitName = name;
  car.tactic = TACTICS[Math.floor(Math.random() * TACTICS.length)];
  car.ramCooldown = 0;
  return car;
}

export function ensurePolice(G) {
  const s = G.state;
  const want = s.wanted === 0 ? 0 : Math.min(2 + s.wanted, 6);
  const units = G.cars.filter((c) => c.police && !c.removed);
  if (units.length < want) {
    const name = UNIT_NAMES[G.policeSeq % UNIT_NAMES.length];
    G.policeSeq += 1;
    const a = Math.random() * Math.PI * 2;
    const x = s.player.x + Math.sin(a) * 90;
    const z = s.player.z + Math.cos(a) * 90;
    const car = spawnUnit(G, name, clamp(x, -230, 230), clamp(z, -230, 230));
    car.tactic = s.wanted >= 4 ? 'ROADBLOCK' : s.wanted >= 3 ? 'RAMMING' : 'PURSUE';
    G.dispatchLog.unshift(name + ' rolling, ' + Math.round(dist2(car.x, car.z, s.player.x, s.player.z)) + ' m out');
    G.dispatchLog = G.dispatchLog.slice(0, 4);
  } else if (units.length > want) {
    const extra = units[units.length - 1];
    removePoliceCar(G, extra);
  }
}

export function removePoliceCar(G, car) {
  if (car.mesh) G.scene.remove(car.mesh);
  car.removed = true;
  G.cars = G.cars.filter((c) => c !== car);
}

export function dispatchList(G) {
  const s = G.state;
  return G.cars.filter((c) => c.police && !c.removed).map((c) => ({
    name: c.unitName || 'CVPD-??',
    dist: Math.round(dist2(c.x, c.z, s.player.x, s.player.z)),
    tactic: c.tactic || 'PURSUE',
  }));
}

// Roadblocks: two police cars parked across the road ahead of the player.
export function updateRoadblocks(G, dt) {
  const s = G.state;
  if (s.wanted < 3) {
    for (const rb of G.roadblocks) { if (rb.mesh) G.scene.remove(rb.mesh); }
    G.roadblocks = [];
    return;
  }
  if (G.roadblocks.length === 0 && s.player.carId) {
    const car = G.cars.find((c) => c.id === s.player.carId);
    if (car) {
      const ahead = 55;
      const bx = car.x + Math.sin(car.yaw) * ahead;
      const bz = car.z + Math.cos(car.yaw) * ahead;
      for (const side of [-1, 1]) {
        const mesh = spawnCar(G, 'interceptor', bx + Math.cos(car.yaw) * side * 3, bz - Math.sin(car.yaw) * side * 3, car.yaw + Math.PI / 2, { police: true });
        mesh.unitName = 'ROADBLOCK';
        mesh.tactic = 'ROADBLOCK';
        mesh.parked = true;
        G.roadblocks.push(mesh);
      }
      G.setToast('CVPD ROADBLOCK AHEAD — ram it or go around.');
      if (G.audio) G.audio.sirenBurst();
    }
  }
  for (const rb of G.roadblocks) {
    if (rb.mesh && rb.mesh.userData.lightBar) {
      const on = Math.floor(G.state.time * 6) % 2 === 0;
      rb.mesh.userData.lightBar[0].material.color.setHex(on ? 0xff2a3a : 0x550000);
      rb.mesh.userData.lightBar[1].material.color.setHex(on ? 0x000055 : 0x2a6aff);
    }
  }
}

export function buildHeli(G) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x223344 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 5.2), bodyMat);
  body.castShadow = true; g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 1.8), new THREE.MeshPhongMaterial({ color: 0x9fd8e8, shininess: 100 }));
  glass.position.set(0, 0.4, 1.8); g.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.6), new THREE.MeshLambertMaterial({ color: 0x1a1a20 }));
  rotor.position.y = 1.2; g.add(rotor);
  g.userData.rotor = rotor;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), bodyMat);
  tail.position.set(0, 0.3, -4.2); g.add(tail);
  // Spotlight cone: a translucent cone from the belly to the ground.
  const coneGeo = new THREE.ConeGeometry(7, 20, 18, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = -10;
  g.add(cone);
  const spot = new THREE.SpotLight(0xfff6c8, 2.2, 90, 0.32, 0.4, 1);
  spot.position.set(0, -1, 0);
  g.add(spot);
  g.userData.spot = spot;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(6.5, 20), new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.35, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  g.add(pool);
  g.userData.pool = pool;
  g.visible = false;
  G.scene.add(g);
  G.heli = g;
  return g;
}

export function updateHeli(G, dt) {
  const s = G.state;
  if (!G.heli) buildHeli(G);
  const heli = G.heli;
  const show = s.wanted >= 3;
  heli.visible = show;
  if (!show) { G.heliSnapped = false; return; }
  if (!G.heliSnapped) {
    heli.position.set(s.player.x + 14, 20, s.player.z - 8);
    G.heliSnapped = true;
  }
  const t = s.time * 0.45;
  const tx = s.player.x + Math.sin(t) * 16;
  const tz = s.player.z + Math.cos(t) * 16;
  heli.position.x += (tx - heli.position.x) * Math.min(1, dt * 1.4);
  heli.position.z += (tz - heli.position.z) * Math.min(1, dt * 1.4);
  heli.position.y = 20 + Math.sin(s.time * 0.8) * 1.5;
  heli.rotation.y = Math.atan2(s.player.x - heli.position.x, s.player.z - heli.position.z);
  heli.userData.rotor.rotation.y += dt * 22;
  heli.userData.spot.target.position.set(s.player.x, 0, s.player.z);
  heli.userData.spot.target.updateMatrixWorld();
  heli.userData.pool.position.set(0, -heli.position.y + 0.3, 0);
  heli.userData.pool.position.x = s.player.x - heli.position.x;
  heli.userData.pool.position.z = s.player.z - heli.position.z;
}

export function updatePolice(G, dt) {
  const s = G.state;
  ensurePolice(G);
  updateRoadblocks(G, dt);
  updateHeli(G, dt);
  const playerCar = G.cars.find((c) => c.id === s.player.carId);
  let anyNear = false;
  for (const car of G.cars) {
    if (!car.police || car.removed || car.parked) continue;
    const dx = s.player.x - car.x; const dz = s.player.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d < 70) anyNear = true;
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const aggression = 0.9 + s.wanted * 0.35;
    car.yaw += clamp(dy, -2.6 * aggression * dt, 2.6 * aggression * dt);
    const cruise = Math.min(30 + s.wanted * 4, 50);
    car.speed += ((playerCar ? cruise : 26) - car.speed) * Math.min(1, dt * 1.1);
    if (car.ramCooldown > 0) car.ramCooldown -= dt;
    const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
    const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
    car.x = nx; car.z = nz;
    // Ram / PIT: contact shoves the player's car and damages it.
    if (d < 4.6 && playerCar && car.ramCooldown <= 0) {
      car.ramCooldown = 1.1;
      const push = 9 + s.wanted * 2;
      playerCar.x += Math.sin(car.yaw) * push * dt * 8;
      playerCar.z += Math.cos(car.yaw) * push * dt * 8;
      playerCar.speed *= 0.55;
      damageCar(G, playerCar, 6 + s.wanted * 2);
      if (G.audio) G.audio.crash();
      G.setToast(car.unitName + ' — PIT! Hold the wheel, Milo.');
      scarePedestrians(G, s.player.x, s.player.z, 30);
    }
    if (car.mesh && car.mesh.userData.lightBar) {
      const on = Math.floor(G.state.time * 6) % 2 === 0;
      car.mesh.userData.lightBar[0].material.color.setHex(on ? 0xff2a3a : 0x550000);
      car.mesh.userData.lightBar[1].material.color.setHex(on ? 0x000055 : 0x2a6aff);
    }
    syncCarMesh(car);
  }
  // Lose the heat: no unit near and no helicopter eyes on you.
  if (s.wanted > 0) {
    if (!anyNear && s.wanted < 3) s.unseen += dt;
    else if (!anyNear && s.wanted >= 3) s.unseen += dt * 0.4;
    else s.unseen = 0;
    if (s.unseen > 7) {
      s.wanted = Math.max(0, s.wanted - 1);
      s.unseen = 0;
      if (s.wanted === 0) G.setToast('You lost them. The Verde breathes again.');
      else G.setToast('Heat cooling — ' + s.wanted + ' stars. Stay out of sight.');
    }
  }
}
