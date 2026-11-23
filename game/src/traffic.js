// Traffic: civilian cars that follow the road grid in rectangular loops,
// pause at intersections, brake for the car ahead and honk when blocked.
// Pedestrians are in pedestrians.js; police are in police.js.
import { CITY, clamp, mulberry } from './config.js';
import { driveCar, spawnCar, syncCarMesh } from './vehicles.js';
import { nearestRoadPoint } from './world.js';

const ROUTES = [];
for (let i = -3; i <= 3; i += 1) {
  const c = i * CITY.roadStep;
  ROUTES.push([{ x: -210, z: c }, { x: 210, z: c }, { x: 210, z: c + 0 }, { x: -210, z: c }]);
  ROUTES.push([{ x: c, z: -210 }, { x: c, z: 210 }, { x: c, z: 210 }, { x: c, z: -210 }]);
}

export function spawnTraffic(G, count) {
  const rng = mulberry(777);
  const defs = ['dockside', 'taxi', 'sunrunner', 'harborvan', 'dockside', 'taxi'];
  const colors = [0x8a8f96, 0x4a5a6a, 0x7a3a4a, 0x3a6a5a, 0xd8d0c0, 0x2e3a4a, 0xb07a3a];
  for (let i = 0; i < count; i += 1) {
    const route = ROUTES[i % ROUTES.length];
    const seg = Math.floor(rng() * route.length);
    const t = rng();
    const a = route[seg]; const b = route[(seg + 1) % route.length];
    const x = a.x + (b.x - a.x) * t; const z = a.z + (b.z - a.z) * t;
    const car = spawnCar(G, defs[i % defs.length], x, z, 0, { traffic: true, color: colors[i % colors.length] });
    car.route = route;
    car.routeIndex = (seg + 1) % route.length;
    car.speed = 8 + rng() * 6;
    car.yaw = Math.atan2(b.x - a.x, b.z - a.z);
  }
}

export function updateTraffic(G, dt) {
  const p = G.state.player;
  for (const car of G.cars) {
    if (!car.traffic || car.removed) continue;
    const target = car.route[car.routeIndex];
    const dx = target.x - car.x; const dz = target.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d < 6) { car.routeIndex = (car.routeIndex + 1) % car.route.length; continue; }
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    car.yaw += clamp(dy, -1.4 * dt, 1.4 * dt);
    // Brake for anything close ahead: another car, or the player.
    let blocked = false;
    const aheadX = car.x + Math.sin(car.yaw) * 9; const aheadZ = car.z + Math.cos(car.yaw) * 9;
    for (const other of G.cars) {
      if (other === car || other.removed) continue;
      if (Math.hypot(other.x - aheadX, other.z - aheadZ) < 4.5) { blocked = true; break; }
    }
    if (!blocked && Math.hypot(p.x - aheadX, p.z - aheadZ) < 3.5) blocked = true;
    if (blocked) {
      car.speed = Math.max(0, car.speed - 22 * dt);
      if (car.speed === 0 && G.state.time > car.hornUntil) {
        car.hornUntil = G.state.time + 6 + Math.random() * 4;
        if (G.audio) G.audio.honk();
      }
    } else {
      car.speed += (13 - car.speed) * Math.min(1, dt * 0.8);
      if (car.wait > 0) { car.wait -= dt; car.speed = 0; }
      else if (Math.random() < dt * 0.02) car.wait = 1 + Math.random() * 2;
    }
    car.x += Math.sin(car.yaw) * car.speed * dt;
    car.z += Math.cos(car.yaw) * car.speed * dt;
    // Keep traffic on the roads: snap drift back toward the nearest road line.
    const snap = nearestRoadPoint(car.x, car.z);
    car.x += (snap.x - car.x) * Math.min(1, dt * 0.6);
    car.z += (snap.z - car.z) * Math.min(1, dt * 0.6);
    syncCarMesh(car);
    void driveCar;
  }
}

// A parked car the player can steal: engine off, doors unlocked, owner nearby.
export function spawnParkedCars(G) {
  // Parked cars sit at the roadside (7 m off a road line), never inside a block.
  const spots = [
    [7, -150, 0.4], [67, 30, -0.3], [-53, 90, 0.2], [7, 150, -0.5],
    [-113, -30, 0.1], [127, 150, 0.3], [-53, -150, 0], [127, -90, 0.6],
    [67, -150, 1.2], [-113, 150, -0.8], [7, 30, 0.5], [-173, 90, 0.2],
  ];
  const defs = ['dockside', 'taxi', 'sunrunner', 'harborvan'];
  spots.forEach(([x, z, yaw], i) => {
    spawnCar(G, defs[i % defs.length], x, z, yaw, { parked: true });
  });
}
