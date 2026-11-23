// Cala Verde tuning: every number, name and colour the other modules share.
// The city is a 480 x 480 metre grid. West (negative x) is the sea, the beach
// and the marina; east is the hillside villas. Roads run on a 60 m grid.
export const CITY = { half: 240, roadStep: 60, seaX: -250, islandX: -330, islandZ: -40 };

export const TIDE = { period: 150, lowAt: 0.5, windowHalf: 0.16 };

export const DISTRICTS = [
  { name: 'Marina Verde', x0: -240, x1: -120, z0: -240, z1: 40, color: '#5ee6ff' },
  { name: 'Beachfront', x0: -240, x1: -120, z0: 40, z1: 240, color: '#ffd27a' },
  { name: 'Old Town', x0: -120, x1: 0, z0: -240, z1: -60, color: '#ffb3c8' },
  { name: 'Downtown Cala', x0: -120, x1: 0, z0: -60, z1: 120, color: '#8ef0ff' },
  { name: 'Casino Strip', x0: -120, x1: 0, z0: 120, z1: 240, color: '#ff9a3d' },
  { name: 'The Docks', x0: 0, x1: 120, z0: -240, z1: -60, color: '#b8c4d8' },
  { name: 'Celia\u2019s Quarter', x0: 0, x1: 120, z0: -60, z1: 120, color: '#7dff9a' },
  { name: 'Villa Hills', x0: 120, x1: 240, z0: -240, z1: 240, color: '#e6b8ff' },
];

export const RANKS = ['HUSTLER', 'DRIVER', 'SHOT CALLER', 'KING OF THE VERDE', 'LEGEND OF CALA VERDE'];
export function rankFor(respect) {
  if (respect >= 900) return 4;
  if (respect >= 550) return 3;
  if (respect >= 280) return 2;
  if (respect >= 90) return 1;
  return 0;
}

export const CREW = [
  { id: 'june', name: 'JUNE PARK', ability: 'SWAP PLATES', key: 'Q', desc: 'Drops 2 wanted stars', hue: 190, hair: '#1c1c22' },
  { id: 'tomas', name: 'TOMAS REYES', ability: 'QUICK FIX', key: 'Z', desc: 'Repairs the car fully', hue: 28, hair: '#3a2415' },
  { id: 'sana', name: 'SANA MIR', ability: 'EYES OUT', key: 'X', desc: 'Marks police & stash on map', hue: 300, hair: '#141414' },
];

export const SPEAKERS = {
  celia: { name: 'AUNT CELIA', hue: 265, hair: '#d8d8e0', note: 'Fixer. Never raises her voice. Never repeats herself.' },
  milo: { name: 'MILO FERREIRA', hue: 32, hair: '#241a12', note: 'Wheelman. Docks kid, fast hands, faster car.' },
  june: { name: 'JUNE PARK', hue: 190, hair: '#1c1c22', note: 'Driver. Calm at 160 km/h.' },
  tomas: { name: 'TOMAS REYES', hue: 28, hair: '#3a2415', note: 'Mechanic. Can fix anything but his own luck.' },
  sana: { name: 'SANA MIR', hue: 300, hair: '#141414', note: 'Lookout. Sees the roadblock before it sees you.' },
  dante: { name: 'DANTE KROLL', hue: 350, hair: '#e8e0d0', note: 'Vultures boss. Owns the night docks.' },
  dispatch: { name: 'CVPD DISPATCH', hue: 210, hair: '#223344', note: 'Cala Verde Police Department.' },
};

export const WEAPON_DEFS = [
  { id: 'fists', name: 'FISTS', damage: 18, range: 3.2, rate: 0.38, ammo: Infinity, price: 0, lockedAt: 0 },
  { id: 'pistol', name: 'PISTOL', damage: 26, range: 55, rate: 0.26, ammo: 60, price: 400, lockedAt: 0 },
  { id: 'smg', name: 'SMG', damage: 15, range: 48, rate: 0.09, ammo: 120, price: 1500, lockedAt: 1 },
  { id: 'shotgun', name: 'SHOTGUN', damage: 16, range: 26, rate: 0.8, ammo: 24, price: 2200, lockedAt: 2 },
  { id: 'rifle', name: 'RIFLE', damage: 42, range: 80, rate: 0.16, ammo: 48, price: 3200, lockedAt: 3 },
];

export const CAR_DEFS = [
  { id: 'dockside', name: 'Dockside Sedan', price: 0, topSpeed: 34, accel: 22, grip: 7.2, color: 0x4a7fa5, length: 4.4, width: 1.9, desc: 'Celia\u2019s loaner. Honest, slow, dented.' },
  { id: 'meridian', name: 'Meridian GT', price: 18000, topSpeed: 52, accel: 34, grip: 9.4, color: 0xc22e3a, length: 4.2, width: 1.85, desc: 'Casino valet prize. The car every Vulture wants.' },
  { id: 'sunrunner', name: 'Sunrunner Coupe', price: 9500, topSpeed: 44, accel: 28, grip: 8.4, color: 0xe8a33d, length: 4.1, width: 1.8, desc: 'Beachfront cruiser with a loud heart.' },
  { id: 'harborvan', name: 'Harbor Van', price: 6000, topSpeed: 30, accel: 18, grip: 6.4, color: 0x6b7a6f, length: 4.9, width: 2.0, desc: 'Slow, armoured, swallows a whole stash.' },
  { id: 'taxi', name: 'Verde Cab', price: 0, topSpeed: 36, accel: 24, grip: 7.6, color: 0xe8c832, length: 4.3, width: 1.85, desc: 'City cab. Nobody looks twice.' },
  { id: 'interceptor', name: 'CVPD Interceptor', price: 0, topSpeed: 48, accel: 32, grip: 9.0, color: 0x223344, length: 4.5, width: 1.9, desc: 'Police pursuit unit. Not for sale.' },
];

export const RADIO = [
  { name: 'Verde FM 98.1', show: 'Sunset Drive', base: 220, pattern: [0, 3, 7, 10, 7, 3, 5, 7] },
  { name: 'Tide 101', show: 'Low Water Blues', base: 165, pattern: [0, 2, 4, 7, 4, 2, -2, 0] },
];

export const SAVE_KEY = 'cala-verde-save-v1';

// A fresh run. Shot staging (shots.js) overwrites fields of this object.
export function freshState() {
  return {
    mode: 'title',
    time: 0,
    day: 1,
    clockMin: 18 * 60 + 40,
    tidePhase: 0.18,
    cash: 2400,
    wanted: 0,
    heat: 0,
    unseen: 0,
    health: 100,
    armour: 0,
    respect: 0,
    jobsDone: 0,
    jobIndex: 0,
    jobStage: 0,
    jobActive: false,
    jobTimer: 0,
    jobKills: 0,
    jobKillsNeed: 0,
    freeRoam: false,
    carsStolen: 0,
    shotsFired: 0,
    thugsDown: 0,
    radio: 0,
    radioOn: true,
    weaponIndex: 1,
    weapons: WEAPON_DEFS.map((w, i) => ({ ...w, ammo: w.ammo, locked: i > 1 })),
    ownedCars: ['dockside'],
    garageCar: 'dockside',
    paint: 0x4a7fa5,
    engineLevel: 0,
    armourLevel: 0,
    standing: Object.fromEntries(DISTRICTS.map((d) => [d.name, 50])),
    crewCooldown: [0, 0, 0],
    eyesOutUntil: 0,
    dialogueUntil: 0,
    dialogueSpeaker: 'celia',
    dialogueLine: 'Milo, the docks made you fast. Now make me rich.',
    prompt: '',
    toast: '',
    toastUntil: 0,
    player: { x: -150, z: 30, yaw: Math.PI / 2, speed: 0, onFoot: true, carId: null, walkPhase: 0, stealTimer: 0, stealTarget: null },
    camYaw: Math.PI / 2,
    camPitch: 0.32,
    seed: 1,
  };
}

export function fmtCash(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function fmtClock(min) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }

// Deterministic tiny RNG so a seed always stages the same city dressing.
export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
