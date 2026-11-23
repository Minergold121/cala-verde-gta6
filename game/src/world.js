// Cala Verde itself: the ground, sea, beach, roads, buildings, palms, pier,
// ferris wheel, casino, docks, causeway and stash island, plus the tide that
// opens and closes the causeway. All geometry is procedural boxes, cylinders
// and cones; window light comes from a canvas texture painted in code.
import { CITY, DISTRICTS, TIDE, clamp, mulberry } from './config.js';

const THREE = window.THREE;

function windowTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 14) {
    for (let x = 6; x < 58; x += 13) {
      g.fillStyle = ((x * 7 + y * 3) % 5 === 0) ? lit : 'rgba(20,18,30,0.9)';
      g.fillRect(x, y, 8, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[3];
}

export function isRoad(x, z) {
  const rx = Math.abs(((x + CITY.half) % CITY.roadStep + CITY.roadStep) % CITY.roadStep - CITY.roadStep / 2);
  const rz = Math.abs(((z + CITY.half) % CITY.roadStep + CITY.roadStep) % CITY.roadStep - CITY.roadStep / 2);
  return rx > CITY.roadStep / 2 - 5 || rz > CITY.roadStep / 2 - 5;
}

export function nearestRoadPoint(x, z) {
  const snap = (v) => Math.round((v + CITY.half) / CITY.roadStep) * CITY.roadStep - CITY.half;
  const xs = snap(x); const zs = snap(z);
  return Math.abs(x - xs) < Math.abs(z - zs) ? { x: xs, z } : { x, z: zs };
}

export function buildCity(G) {
  const scene = G.scene;
  const colliders = [];
  const rng = mulberry(20261123);
  const group = new THREE.Group();
  group.name = 'cala-verde-city';
  scene.add(group);

  // Ground: city slab, sand beach, sea plane.
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x6e6a63 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 80, CITY.half * 2 + 80), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); ground.receiveShadow = true;
  group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(70, CITY.half * 2 + 80), new THREE.MeshLambertMaterial({ color: 0xd9b47e }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-CITY.half - 20, 0.06, 0);
  group.add(sand);
  const seaMat = new THREE.MeshPhongMaterial({ color: 0x1d6f8e, shininess: 90, specular: 0xff9a5a, transparent: true, opacity: 0.92 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(320, CITY.half * 2 + 420), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(-CITY.half - 160, 0.35, 0);
  group.add(sea);
  G.sea = sea;

  // Roads: dark strips on the grid, with pale centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2c2c34 });
  for (let i = -4; i <= 4; i += 1) {
    const c = i * CITY.roadStep;
    const h = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 80, 10), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.12, c); group.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(10, CITY.half * 2 + 80), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.12, 0); group.add(v);
  }
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c98a });
  for (let i = -4; i <= 4; i += 1) {
    for (let j = -220; j <= 220; j += 24) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.7), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(j, 0.14, i * CITY.roadStep); group.add(d);
    }
  }

  // Buildings: one box per block cell, taller downtown and on the strip.
  const texWarm = windowTexture('#7a5a52', '#ffd98a');
  const texCool = windowTexture('#5a6278', '#bfe6ff');
  const texPale = windowTexture('#8a7a68', '#ffe9b0');
  const texDark = windowTexture('#3f4456', '#ffd27a');
  const mats = [texWarm, texCool, texPale, texDark].map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const blockCenters = [];
  for (let gx = -3; gx <= 3; gx += 1) {
    for (let gz = -3; gz <= 3; gz += 1) {
      const cx = gx * CITY.roadStep + CITY.roadStep / 2 - CITY.roadStep;
      const cz = gz * CITY.roadStep + CITY.roadStep / 2 - CITY.roadStep;
      blockCenters.push({ x: cx, z: cz });
    }
  }
  let bi = 0;
  for (const cell of blockCenters) {
    // Celia's Quarter keeps one open lot: the garage lot at (30, 30), where
    // the garage box and Milo's loaner stand instead of a tower.
    if (cell.x === 30 && cell.z === 30) continue;
    const downtown = Math.abs(cell.x) < 70 && Math.abs(cell.z) < 70;
    const strip = cell.z > 120;
    const h = downtown ? 26 + rng() * 34 : strip ? 18 + rng() * 22 : 8 + rng() * 16;
    const w = 22 + rng() * 14; const d = 22 + rng() * 14;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[bi % mats.length]);
    mesh.position.set(cell.x, h / 2, cell.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push({ x0: cell.x - w / 2, x1: cell.x + w / 2, z0: cell.z - d / 2, z1: cell.z + d / 2 });
    // Rooftop box / water tank dressing.
    const top = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshLambertMaterial({ color: 0x554a44 }));
    top.position.set(cell.x + w / 4, h + 1.5, cell.z - d / 4); group.add(top);
    bi += 1;
  }

  // Palms along the beachfront avenue and the marina walk.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8a4a });
  function palm(x, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 7 * s, 6), trunkMat);
    trunk.position.y = 3.5 * s; trunk.castShadow = true; g.add(trunk);
    for (let k = 0; k < 6; k += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7 * s, 4.5 * s, 4), leafMat);
      const a = (k / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.6 * s, 7 * s, Math.sin(a) * 1.6 * s);
      leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    group.add(g);
  }
  for (let z = -220; z <= 220; z += 28) { palm(-212, z, 1); palm(-186, z + 14, 0.9); }
  for (let x = -210; x <= -130; x += 30) { palm(x, 226, 1); palm(x + 15, -226, 0.9); }

  // Marina pier + moored boats.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(90, 1, 8), pierMat);
  pier.position.set(-285, 0.8, 30); group.add(pier);
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
  const boatMat2 = new THREE.MeshLambertMaterial({ color: 0x2e6f8e });
  function boat(x, z, mat, s) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9 * s, 1.6 * s, 3 * s), mat);
    hull.position.y = 0.6 * s; g.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3 * s, 1.6 * s, 2.4 * s), new THREE.MeshLambertMaterial({ color: 0x223344 }));
    cab.position.set(-0.5 * s, 2 * s, 0); g.add(cab);
    g.position.set(x, 0, z); group.add(g);
    return g;
  }
  G.marinaBoats = [boat(-292, 8, boatMat, 1), boat(-296, 52, boatMat2, 1.1), boat(-288, -18, boatMat, 0.9)];
  G.escapeBoat = boat(-300, 30, new THREE.MeshLambertMaterial({ color: 0xffd27a }), 1.3);
  G.escapeBoat.position.y = 0.2;

  // Ferris wheel on the pier head — the skyline landmark.
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.7, 6, 28), new THREE.MeshLambertMaterial({ color: 0xff8ab0 }));
  wheel.add(rim);
  for (let k = 0; k < 8; k += 1) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 32, 5), new THREE.MeshLambertMaterial({ color: 0xffe9b0 }));
    spoke.rotation.z = (k / 8) * Math.PI; wheel.add(spoke);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshLambertMaterial({ color: [0xff4d6d, 0x5ee6ff, 0xffd27a, 0x7dff9a][k % 4] }));
    const a = (k / 8) * Math.PI * 2;
    cab.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0); wheel.add(cab);
  }
  wheel.position.set(-262, 20, 120);
  group.add(wheel);
  G.ferris = wheel;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(3, 20, 3), new THREE.MeshLambertMaterial({ color: 0x554a44 }));
  legs.position.set(-262, 10, 120); group.add(legs);

  // Casino: wide lit block on the strip, with a glowing sign slab.
  const casino = new THREE.Mesh(new THREE.BoxGeometry(46, 20, 30), new THREE.MeshLambertMaterial({ color: 0x8a2e4a }));
  casino.position.set(-30, 10, 180); casino.castShadow = true; group.add(casino);
  colliders.push({ x0: -53, x1: -7, z0: 165, z1: 195 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(30, 5, 1), new THREE.MeshBasicMaterial({ color: 0xffd23d }));
  sign.position.set(-30, 22, 164); group.add(sign);
  G.casinoPos = { x: -30, z: 150 };

  // Docks: crates + cranes on the east-side quay.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xa8793d });
  const crateMat2 = new THREE.MeshLambertMaterial({ color: 0x4a6b7a });
  for (let i = 0; i < 26; i += 1) {
    const s = 3 + rng() * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), i % 2 ? crateMat : crateMat2);
    const x = 60 + rng() * 130; const z = -200 + rng() * 110;
    m.position.set(x, s / 2, z); m.rotation.y = rng() * 0.6; m.castShadow = true;
    group.add(m);
    colliders.push({ x0: x - s / 2, x1: x + s / 2, z0: z - s / 2, z1: z + s / 2 });
  }
  for (const cx of [90, 170]) {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(2, 34, 2), new THREE.MeshLambertMaterial({ color: 0xd8a03a }));
    mast.position.set(cx, 17, -190); group.add(mast);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(26, 2, 2), new THREE.MeshLambertMaterial({ color: 0xd8a03a }));
    arm.position.set(cx + 6, 32, -190); group.add(arm);
  }

  // Hillside villas: pale boxes with pools on the east rise.
  const villaMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc8 });
  for (let i = 0; i < 10; i += 1) {
    const x = 150 + (i % 3) * 32; const z = -180 + Math.floor(i / 3) * 90;
    const v = new THREE.Mesh(new THREE.BoxGeometry(20, 7 + rng() * 4, 16), villaMat);
    v.position.set(x, 5 + i * 0.4, z); v.castShadow = true; group.add(v);
    colliders.push({ x0: x - 10, x1: x + 10, z0: z - 8, z1: z + 8 });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshPhongMaterial({ color: 0x3fb8d8, shininess: 80 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x + 14, 0.15, z); group.add(pool);
  }

  // Causeway + stash island (west of the marina). The causeway is a sandbar
  // that only clears the water at low tide; the island holds the stash hut.
  const causeMat = new THREE.MeshLambertMaterial({ color: 0xd9b47e });
  const causeway = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 10), causeMat);
  causeway.position.set(CITY.islandX + 40, -0.4, CITY.islandZ);
  group.add(causeway);
  G.causeway = causeway;
  const island = new THREE.Mesh(new THREE.CylinderGeometry(26, 30, 3, 20), new THREE.MeshLambertMaterial({ color: 0xc9a06a }));
  island.position.set(CITY.islandX, 0.4, CITY.islandZ); group.add(island);
  const hut = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 7), new THREE.MeshLambertMaterial({ color: 0x7a4a3a }));
  hut.position.set(CITY.islandX, 4, CITY.islandZ); hut.castShadow = true; group.add(hut);
  colliders.push({ x0: CITY.islandX - 4, x1: CITY.islandX + 4, z0: CITY.islandZ - 3.5, z1: CITY.islandZ + 3.5 });
  const stash = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshBasicMaterial({ color: 0xffd23d }));
  stash.position.set(CITY.islandX + 8, 2.4, CITY.islandZ + 4); group.add(stash);
  G.stashMesh = stash;
  // Beached boats that sit on the mud at low tide.
  G.mudBoats = [boat(-268, -60, boatMat2, 0.9), boat(-276, -84, boatMat, 0.8)];
  for (const b of G.mudBoats) b.position.y = -0.6;

  // Street lamps: warm glow posts at intersections.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333340 });
  for (let i = -3; i <= 3; i += 1) {
    for (let j = -3; j <= 3; j += 1) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 7, 5), poleMat);
      pole.position.set(i * CITY.roadStep + 6, 3.5, j * CITY.roadStep + 6); group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), lampMat);
      bulb.position.set(i * CITY.roadStep + 6, 7.2, j * CITY.roadStep + 6); group.add(bulb);
    }
  }

  // Garage + shop markers: Celia's garage in her quarter.
  G.garagePos = { x: 30, z: 30 };
  const garageBox = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 14), new THREE.MeshLambertMaterial({ color: 0x3a5a8a }));
  garageBox.position.set(30, 4, 44); group.add(garageBox);
  colliders.push({ x0: 20, x1: 40, z0: 37, z1: 51 });

  G.colliders = colliders;
  G.cityGroup = group;
  return G;
}

export function tideLevel(phase) {
  // -1 at low tide, +1 at high tide. Low tide centres on TIDE.lowAt.
  return -Math.cos((phase - TIDE.lowAt) * Math.PI * 2);
}

export function isLowTide(phase) {
  return tideLevel(phase) < -0.45;
}

export function secondsToLowTide(phase, period) {
  const p = TIDE.lowAt;
  let d = (p - phase) % 1; if (d < 0) d += 1;
  return d * period;
}

export function secondsLowTideLeft(phase, period) {
  // How long the current low window has left, if we are in it.
  const level = tideLevel(phase);
  if (level >= -0.45) return 0;
  const p = phase;
  // Walk forward in small steps to the window's end.
  for (let t = 0.001; t < 0.5; t += 0.001) {
    if (tideLevel((p + t) % 1) >= -0.45) return t * period;
  }
  return 0;
}

// Move the water, the causeway and the beached boats with the tide.
export function updateTideVisuals(G, phase) {
  const level = tideLevel(phase);
  const low = isLowTide(phase);
  if (G.sea) G.sea.position.y = 0.35 + (level + 1) * 0.55;
  if (G.causeway) {
    G.causeway.position.y = low ? 0.7 : -0.9;
    G.causeway.visible = true;
  }
  if (G.mudBoats) for (const b of G.mudBoats) b.position.y = low ? 0.4 : -0.9;
  if (G.marinaBoats) for (const b of G.marinaBoats) b.position.y = 0.2 + (level + 1) * 0.25;
  if (G.ferris) G.ferris.rotation.z += 0.0012;
  return low;
}

export function collideCircle(G, x, z, r) {
  let nx = x; let nz = z;
  for (const c of G.colliders) {
    if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) {
      const pushL = x + r - c.x0; const pushR = c.x1 - (x - r);
      const pushT = z + r - c.z0; const pushB = c.z1 - (z - r);
      const m = Math.min(pushL, pushR, pushT, pushB);
      if (m === pushL) nx = c.x0 - r;
      else if (m === pushR) nx = c.x1 + r;
      else if (m === pushT) nz = c.z0 - r;
      else nz = c.z1 + r;
    }
  }
  nx = clamp(nx, -CITY.half - 8, CITY.half + 8);
  nz = clamp(nz, -CITY.half - 8, CITY.half + 8);
  // The sea blocks walking/driving except on the causeway strip at low tide.
  return { x: nx, z: nz };
}

export function onLand(x, z, lowTide) {
  if (x > -CITY.half - 4) return true;
  if (lowTide && Math.abs(z - CITY.islandZ) < 7 && x > CITY.islandX - 30) return true;
  if (x > CITY.islandX - 28 && x < CITY.islandX + 28 && Math.abs(z - CITY.islandZ) < 28) return true;
  return false;
}
