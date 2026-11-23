// Cars and boats: low-poly meshes built from boxes, physics-lite driving state,
// the garage catalogue, paint and upgrades. A car is a mesh group plus a state
// record kept in G.cars; the player's car is the one G.state.player.carId names.
import { CAR_DEFS, clamp } from './config.js';

const THREE = window.THREE;

export function carDef(id) {
  return CAR_DEFS.find((c) => c.id === id) || CAR_DEFS[0];
}

export function makeCarMesh(def, color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a20 });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x9fd8e8, shininess: 120, specular: 0xffffff });
  const body = new THREE.Mesh(new THREE.BoxGeometry(def.width, 0.85, def.length), bodyMat);
  body.position.y = 0.75; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(def.width * 0.82, 0.7, def.length * 0.45), glassMat);
  cabin.position.set(0, 1.5, -def.length * 0.08); cabin.castShadow = true; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(def.width * 0.86, 0.12, def.length * 0.42), bodyMat);
  roof.position.set(0, 1.9, -def.length * 0.08); g.add(roof);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
  const wheels = [];
  for (const [wx, wz] of [[-def.width / 2, def.length * 0.32], [def.width / 2, def.length * 0.32], [-def.width / 2, -def.length * 0.32], [def.width / 2, -def.length * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz);
    g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.1), lightMat);
    hl.position.set(s * def.width * 0.3, 0.85, def.length / 2 + 0.03); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2a3a }));
    tl.position.set(s * def.width * 0.3, 0.85, -def.length / 2 - 0.03); g.add(tl);
  }
  g.userData.wheels = wheels;
  g.userData.bodyMat = bodyMat;
  return g;
}

export function makePoliceMesh() {
  const def = carDef('interceptor');
  const g = makeCarMesh(def, 0x1c2733);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a });
  const barMat2 = new THREE.MeshBasicMaterial({ color: 0x2a6aff });
  const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.5), barMat);
  bar1.position.set(-0.45, 2.05, -0.15); g.add(bar1);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.5), barMat2);
  bar2.position.set(0.45, 2.05, -0.15); g.add(bar2);
  g.userData.lightBar = [bar1, bar2];
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(def.width + 0.02, 0.3, def.length * 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  stripe.position.y = 1.18; g.add(stripe);
  return g;
}

export function spawnCar(G, defId, x, z, yaw, opts = {}) {
  const def = carDef(defId);
  const color = opts.color !== undefined ? opts.color : def.color;
  const mesh = opts.police ? makePoliceMesh() : makeCarMesh(def, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = yaw;
  G.scene.add(mesh);
  const car = {
    id: 'car' + (++G.carSeq),
    defId, def, mesh, x, z, yaw,
    speed: 0,
    steer: 0,
    condition: opts.condition !== undefined ? opts.condition : 100,
    parked: !!opts.parked,
    traffic: !!opts.traffic,
    police: !!opts.police,
    driver: opts.driver || null,
    color,
    engineLevel: opts.engineLevel || 0,
    armourLevel: opts.armourLevel || 0,
    route: opts.route || null,
    routeIndex: 0,
    wait: 0,
    hornUntil: 0,
    removed: false,
  };
  G.cars.push(car);
  return car;
}

export function removeCar(G, car) {
  if (car.mesh) G.scene.remove(car.mesh);
  car.removed = true;
  G.cars = G.cars.filter((c) => c !== car);
}

// Arcade driving: accelerate toward a top speed, steer harder at low speed,
// grip pulls velocity toward the heading, handbrake slides the tail.
export function driveCar(G, car, dt, throttle, steerInput, handbrake) {
  const boost = 1 + car.engineLevel * 0.12;
  const top = car.def.topSpeed * boost;
  if (throttle > 0) car.speed += car.def.accel * boost * dt * throttle;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= car.def.accel * 1.6 * dt;
    else car.speed = Math.max(car.speed - car.def.accel * 0.5 * dt, -top * 0.35);
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = clamp(car.speed, -top * 0.35, top);
  const steerRate = car.def.grip * 0.16 * clamp(1 - Math.abs(car.speed) / (top * 1.6), 0.35, 1);
  const targetSteer = steerInput * (car.speed >= 0 ? 1 : -1);
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  car.yaw += car.steer * steerRate * dt * clamp(Math.abs(car.speed) / 8, 0, 1) * Math.sign(car.speed || 1);
  const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
  const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
  return { x: nx, z: nz };
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.yaw;
  const spin = car.speed * 0.9;
  for (const w of car.mesh.userData.wheels || []) w.rotation.x += spin * 0.016;
  if (car.mesh.userData.wheels) {
    car.mesh.userData.wheels[0].rotation.y = car.steer * 0.4;
    car.mesh.userData.wheels[1].rotation.y = car.steer * 0.4;
  }
}

export function damageCar(G, car, amount) {
  car.condition = clamp(car.condition - amount, 0, 100);
  if (car.condition <= 0 && car === playerCar(G)) {
    // The player's wreck: handled by the wasted flow in main.js via state.
    G.state.health = Math.min(G.state.health, 20);
  }
}

export function playerCar(G) {
  const id = G.state.player.carId;
  if (!id) return null;
  return G.cars.find((c) => c.id === id) || null;
}

export function paintCar(G, car, color) {
  car.color = color;
  if (car.mesh && car.mesh.userData.bodyMat) car.mesh.userData.bodyMat.color.setHex(color);
}

export const PAINTS = [
  { name: 'Dock Blue', color: 0x4a7fa5 },
  { name: 'Vermilion', color: 0xc22e3a },
  { name: 'Sunset Gold', color: 0xe8a33d },
  { name: 'Palm Green', color: 0x3d8a5a },
  { name: 'Midnight', color: 0x22222e },
  { name: 'Pearl', color: 0xe8e4da },
  { name: 'Bubblegum', color: 0xff8ab0 },
  { name: 'Sea Glass', color: 0x5ee6ff },
];
