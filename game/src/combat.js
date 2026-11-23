// Combat: weapon fire from the camera's aim, Vulture thugs who hold ground
// and shoot back during fight stages, muzzle flashes, tracers and damage.
// Fists work at arm's length; guns raycast against thugs and police cars.
import { clamp, dist2 } from './config.js';
import { makePersonMesh } from './pedestrians.js';
import { scarePedestrians } from './pedestrians.js';
import { addHeat } from './police.js';

const THREE = window.THREE;

export function spawnThugs(G, x, z, count) {
  G.thugs = G.thugs || [];
  for (let i = 0; i < count; i += 1) {
    const mesh = makePersonMesh(0x2a2a33, 0x1c1c22, 0xe8b98a);
    const tx = x + (Math.random() - 0.5) * 22;
    const tz = z + (Math.random() - 0.5) * 22;
    mesh.position.set(tx, 0, tz);
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.4, 0.4), new THREE.MeshLambertMaterial({ color: 0xc22e3a }));
    vest.position.y = 1.25; mesh.add(vest);
    G.scene.add(mesh);
    G.thugs.push({ mesh, x: tx, z: tz, yaw: 0, health: 70, shootTimer: 1 + Math.random() * 2, dead: false, phase: Math.random() * 6 });
  }
  return G.thugs;
}

export function clearThugs(G) {
  for (const t of G.thugs || []) if (t.mesh) G.scene.remove(t.mesh);
  G.thugs = [];
}

export function updateThugs(G, dt) {
  const s = G.state;
  for (const t of G.thugs || []) {
    if (t.dead) continue;
    const d = dist2(t.x, t.z, s.player.x, s.player.z);
    t.yaw = Math.atan2(s.player.x - t.x, s.player.z - t.z);
    // Strafe a little, hold the ground; shoot when the player is in range.
    if (d > 10 && d < 45) {
      t.x += Math.sin(t.yaw) * 2.2 * dt;
      t.z += Math.cos(t.yaw) * 2.2 * dt;
    }
    t.shootTimer -= dt;
    if (t.shootTimer <= 0 && d < 42) {
      t.shootTimer = 1.6 + Math.random() * 1.4;
      if (Math.random() < 0.55) {
        damagePlayer(G, 4 + Math.floor(Math.random() * 5));
        if (G.audio) G.audio.gunshot(0.4);
        G.tracerFrom = { x: t.x, z: t.z };
        G.tracerUntil = s.time + 0.08;
      }
    }
    t.phase += dt * 5;
    t.mesh.userData.legL.rotation.x = Math.sin(t.phase) * 0.4;
    t.mesh.userData.legR.rotation.x = -Math.sin(t.phase) * 0.4;
    t.mesh.position.set(t.x, 0, t.z);
    t.mesh.rotation.y = t.yaw;
  }
}

export function damagePlayer(G, amount) {
  const s = G.state;
  let left = amount;
  if (s.armour > 0) {
    const absorbed = Math.min(s.armour, left);
    s.armour -= absorbed; left -= absorbed;
  }
  s.health = clamp(s.health - left, 0, 100);
  if (s.health <= 0 && s.mode === 'play') {
    s.mode = 'wasted';
    if (G.onWasted) G.onWasted();
  }
}

export function currentWeapon(G) {
  return G.state.weapons[G.state.weaponIndex];
}

export function fireWeapon(G) {
  const s = G.state;
  const w = currentWeapon(G);
  if (!w || w.locked) return;
  const now = s.time;
  if (G.lastShot && now - G.lastShot < w.rate) return;
  G.lastShot = now;
  if (w.ammo !== Infinity) {
    if (w.ammo <= 0) { G.setToast(w.name + ' is dry — visit the weapon shop.'); return; }
    w.ammo -= 1;
  }
  s.shotsFired += 1;
  scarePedestrians(G, s.player.x, s.player.z, 40);
  if (G.audio) G.audio.gunshot(w.id === 'shotgun' ? 1 : 0.7);
  addHeat(G, Math.max(s.wanted, 1), 'Shots fired');
  // Aim from the camera through the centre of the screen.
  const cam = G.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  const origin = cam.position.clone();
  let best = null; let bestD = w.range;
  for (const t of G.thugs || []) {
    if (t.dead) continue;
    const to = new THREE.Vector3(t.x - origin.x, 1.4 - origin.y, t.z - origin.z);
    const along = to.dot(dir);
    if (along < 0 || along > bestD) continue;
    const perp = to.clone().addScaledVector(dir, -along).length();
    if (perp < 1.6) { best = t; bestD = along; }
  }
  G.muzzleUntil = now + 0.06;
  if (best) {
    const pellets = w.id === 'shotgun' ? 4 : 1;
    best.health -= w.damage * pellets;
    G.tracerUntil = now + 0.08;
    if (best.health <= 0) {
      best.dead = true;
      best.mesh.visible = false;
      s.thugsDown += 1;
      s.jobKills += 1;
      s.cash += 120;
      s.respect += 6;
      G.setToast('Vulture down. +$120.');
      if (G.audio) G.audio.cash();
    }
  }
}

export function updateTracers(G, dt) {
  if (!G.tracerLine) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    G.tracerLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.9 }));
    G.tracerLine.visible = false;
    G.scene.add(G.tracerLine);
  }
  const s = G.state;
  if (G.tracerUntil && s.time < G.tracerUntil && G.tracerFrom) {
    const pos = G.tracerLine.geometry.attributes.position;
    pos.setXYZ(0, G.tracerFrom.x, 1.6, G.tracerFrom.z);
    pos.setXYZ(1, s.player.x, 1.4, s.player.z);
    pos.needsUpdate = true;
    G.tracerLine.visible = true;
  } else {
    G.tracerLine.visible = false;
  }
  void dt;
}
