// Pedestrians: sidewalk walkers who stroll the blocks, chat in place, and
// flee when shots are fired or a car screams past. Built from the same
// low-poly person kit as Milo, in many shirt colours.
import { CITY, clamp, mulberry } from './config.js';
import { collideCircle } from './world.js';

const THREE = window.THREE;

export function makePersonMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirtMat);
  torso.position.y = 1.18; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.42), skinMat);
  head.position.y = 1.78; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), new THREE.MeshLambertMaterial({ color: 0x241a12 }));
  hair.position.y = 2.04; g.add(hair);
  const legGeo = new THREE.BoxGeometry(0.24, 0.62, 0.26);
  const legL = new THREE.Mesh(legGeo, pantsMat); legL.position.set(-0.16, 0.31, 0); g.add(legL);
  const legR = new THREE.Mesh(legGeo, pantsMat); legR.position.set(0.16, 0.31, 0); g.add(legR);
  const armGeo = new THREE.BoxGeometry(0.18, 0.6, 0.2);
  const armL = new THREE.Mesh(armGeo, shirtMat); armL.position.set(-0.42, 1.2, 0); g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirtMat); armR.position.set(0.42, 1.2, 0); g.add(armR);
  g.userData.legL = legL; g.userData.legR = legR; g.userData.armL = armL; g.userData.armR = armR;
  return g;
}

export function spawnPedestrians(G, count) {
  const rng = mulberry(4242);
  const shirts = [0xff8ab0, 0x5ee6ff, 0xffd27a, 0x7dff9a, 0xe8e4da, 0xb08aff, 0xff6a4a, 0x4a7fa5];
  const skins = [0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf2d0a8, 0x6b4423];
  G.peds = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = makePersonMesh(shirts[i % shirts.length], 0x2e3440, skins[i % skins.length]);
    const gx = (Math.floor(rng() * 7) - 3) * CITY.roadStep;
    const gz = (Math.floor(rng() * 7) - 3) * CITY.roadStep;
    const x = gx + 8 + rng() * 40; const z = gz + 8 + rng() * 40;
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    G.peds.push({
      mesh, x, z, yaw: rng() * Math.PI * 2,
      speed: 1.4 + rng() * 1.2,
      targetX: gx + rng() * 50, targetZ: gz + rng() * 50,
      flee: 0, phase: rng() * 6,
    });
  }
}

export function scarePedestrians(G, x, z, radius) {
  for (const ped of G.peds) {
    if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.flee = 4 + Math.random() * 3;
  }
}

export function updatePedestrians(G, dt) {
  const p = G.state.player;
  const playerCarSpeed = p.carId ? (G.cars.find((c) => c.id === p.carId) || { speed: 0 }).speed : 0;
  for (const ped of G.peds) {
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.x - p.x, ped.z - p.z);
      ped.yaw = away;
      ped.x += Math.sin(away) * 5.2 * dt;
      ped.z += Math.cos(away) * 5.2 * dt;
    } else {
      const dx = ped.targetX - ped.x; const dz = ped.targetZ - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) {
        ped.targetX = clamp(ped.x + (Math.random() - 0.5) * 90, -230, 230);
        ped.targetZ = clamp(ped.z + (Math.random() - 0.5) * 90, -230, 230);
      } else {
        const want = Math.atan2(dx, dz);
        ped.yaw += clamp(want - ped.yaw, -2.4 * dt, 2.4 * dt);
        ped.x += Math.sin(ped.yaw) * ped.speed * dt;
        ped.z += Math.cos(ped.yaw) * ped.speed * dt;
      }
      // A speeding car nearby sends them running.
      if (Math.abs(playerCarSpeed) > 14 && Math.hypot(ped.x - p.x, ped.z - p.z) < 10) ped.flee = 3;
    }
    const hit = collideCircle(G, ped.x, ped.z, 0.5);
    ped.x = hit.x; ped.z = hit.z;
    ped.phase += dt * (ped.flee > 0 ? 11 : 5);
    const swing = Math.sin(ped.phase) * 0.55;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    ped.mesh.userData.armL.rotation.x = -swing * 0.7;
    ped.mesh.userData.armR.rotation.x = swing * 0.7;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.yaw;
  }
}
