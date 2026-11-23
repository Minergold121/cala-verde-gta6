// Milo on foot and behind the wheel: walking, entering and exiting cars,
// carjacking with a short struggle, and the player mesh that the camera
// follows. Driving physics live in vehicles.js; collisions here.
import { CITY, clamp, dist2 } from './config.js';
import { collideCircle, onLand } from './world.js';
import { makePersonMesh } from './pedestrians.js';
import { driveCar, playerCar, syncCarMesh, damageCar, paintCar } from './vehicles.js';
import { addHeat } from './police.js';
import { scarePedestrians } from './pedestrians.js';

const THREE = window.THREE;

export function buildPlayerMesh(G) {
  const mesh = makePersonMesh(0xff9a3d, 0x2e3440, 0xe8b98a);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
  cap.position.y = 2.12; mesh.add(cap);
  G.scene.add(mesh);
  G.playerMesh = mesh;
  return mesh;
}

export function nearestCar(G, maxDist) {
  const p = G.state.player;
  let best = null; let bestD = maxDist;
  for (const car of G.cars) {
    if (car.removed || car.police) continue;
    const d = dist2(car.x, car.z, p.x, p.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

export function enterCar(G, car) {
  const s = G.state;
  s.player.carId = car.id;
  s.player.onFoot = false;
  s.player.speed = 0;
  car.parked = false;
  car.traffic = false;
  if (G.playerMesh) G.playerMesh.visible = false;
  if (car.defId === s.garageCar) paintCar(G, car, s.paint);
  G.setToast('Driving the ' + car.def.name + '.');
}

export function exitCar(G) {
  const s = G.state;
  const car = playerCar(G);
  if (!car) return;
  const side = car.yaw + Math.PI / 2;
  s.player.x = car.x + Math.sin(side) * 2.6;
  s.player.z = car.z + Math.cos(side) * 2.6;
  s.player.yaw = car.yaw;
  s.player.carId = null;
  s.player.onFoot = true;
  if (G.playerMesh) G.playerMesh.visible = true;
}

export function tryCarjack(G) {
  const s = G.state;
  const p = s.player;
  if (!p.onFoot) { exitCar(G); return; }
  const car = nearestCar(G, 4.2);
  if (!car) return;
  if (p.stealTarget === car && p.stealTimer > 0) return;
  if (car.traffic || !car.parked) {
    // Moving or occupied car: a short struggle, then it is yours.
    p.stealTarget = car;
    p.stealTimer = 0.9;
    G.setToast('Taking the car… hold on.');
    if (G.audio) G.audio.carjack();
    return;
  }
  s.carsStolen += 1;
  addHeat(G, Math.max(s.wanted, 1), 'Car stolen');
  enterCar(G, car);
}

export function updatePlayer(G, dt, input) {
  const s = G.state;
  const p = s.player;
  // Carjacking struggle counts down, then the car is yours.
  if (p.stealTimer > 0) {
    p.stealTimer -= dt;
    if (p.stealTimer <= 0 && p.stealTarget && !p.stealTarget.removed) {
      const car = p.stealTarget;
      p.stealTarget = null;
      s.carsStolen += 1;
      addHeat(G, Math.max(s.wanted, 2), 'Carjacked');
      scarePedestrians(G, p.x, p.z, 25);
      enterCar(G, car);
    }
    return;
  }
  if (p.onFoot) {
    const fwd = input.forward; const strafe = input.strafe;
    const yaw = s.camYaw;
    const mx = Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
    const mz = Math.cos(yaw) * fwd - Math.sin(yaw) * strafe;
    const len = Math.hypot(mx, mz);
    const speed = input.run ? 7.5 : 4.6;
    if (len > 0.01) {
      const nx = p.x + (mx / len) * speed * dt;
      const nz = p.z + (mz / len) * speed * dt;
      const low = G.lowTide || false;
      if (onLand(nx, nz, low)) {
        const hit = collideCircle(G, nx, nz, 0.5);
        p.x = hit.x; p.z = hit.z;
      }
      p.yaw = Math.atan2(mx, mz);
      p.walkPhase += dt * 9;
    } else {
      p.walkPhase += dt * 1.5;
    }
    p.speed = len > 0.01 ? speed : 0;
    if (G.playerMesh) {
      G.playerMesh.position.set(p.x, 0, p.z);
      G.playerMesh.rotation.y = p.yaw;
      const swing = Math.sin(p.walkPhase) * (len > 0.01 ? 0.6 : 0.05);
      G.playerMesh.userData.legL.rotation.x = swing;
      G.playerMesh.userData.legR.rotation.x = -swing;
      G.playerMesh.userData.armL.rotation.x = -swing * 0.7;
      G.playerMesh.userData.armR.rotation.x = swing * 0.7;
    }
    G.focusPoint = { x: p.x, z: p.z };
    return;
  }
  // Driving.
  const car = playerCar(G);
  if (!car) { p.onFoot = true; return; }
  const throttle = input.forward ? 1 : input.back ? -1 : 0;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const before = { x: car.x, z: car.z };
  const next = driveCar(G, car, dt, throttle, steer, input.handbrake);
  // Collisions with buildings: stop, take damage, bounce a little.
  const hit = collideCircle(G, next.x, next.z, 1.9);
  const collided = Math.abs(hit.x - next.x) > 0.01 || Math.abs(hit.z - next.z) > 0.01;
  if (collided) {
    if (Math.abs(car.speed) > 12) {
      damageCar(G, car, Math.abs(car.speed) * 0.5);
      if (G.audio) G.audio.crash();
      addHeat(G, Math.max(s.wanted, 1), 'Crash');
      scarePedestrians(G, car.x, car.z, 26);
    }
    car.speed *= -0.25;
    car.x = before.x; car.z = before.z;
  } else {
    const low = G.lowTide || false;
    if (onLand(next.x, next.z, low)) { car.x = next.x; car.z = next.z; }
    else { car.speed *= 0.4; }
  }
  // Car-vs-car shoves.
  for (const other of G.cars) {
    if (other === car || other.removed) continue;
    const d = dist2(car.x, car.z, other.x, other.z);
    if (d < 3.6 && d > 0.01) {
      const push = (3.6 - d) * 0.6;
      const a = Math.atan2(car.x - other.x, car.z - other.z);
      car.x += Math.sin(a) * push; car.z += Math.cos(a) * push;
      if (Math.abs(car.speed) > 10) {
        damageCar(G, car, 3);
        damageCar(G, other, 4);
        if (G.audio) G.audio.crash();
      }
      car.speed *= 0.7;
    }
  }
  p.x = car.x; p.z = car.z; p.yaw = car.yaw; p.speed = Math.abs(car.speed);
  G.focusPoint = { x: car.x, z: car.z };
  syncCarMesh(car);
  if (G.audio) G.audio.engine(Math.abs(car.speed), throttle !== 0);
  void CITY; void clamp;
}
