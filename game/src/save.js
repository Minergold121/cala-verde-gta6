// Save and continue: one localStorage slot holding cash, progress, garage,
// weapons, respect and position. Continue restores it; New Game wipes it.
import { SAVE_KEY, WEAPON_DEFS } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveGame(G) {
  const s = G.state;
  const data = {
    cash: s.cash,
    respect: s.respect,
    jobsDone: s.jobsDone,
    jobIndex: s.jobIndex,
    jobStage: 0,
    wanted: 0,
    health: s.health,
    armour: s.armour,
    radio: s.radio,
    weaponIndex: s.weaponIndex,
    weapons: s.weapons.map((w) => ({ id: w.id, ammo: w.ammo, locked: w.locked })),
    ownedCars: s.ownedCars,
    garageCar: s.garageCar,
    paint: s.paint,
    engineLevel: s.engineLevel,
    armourLevel: s.armourLevel,
    standing: s.standing,
    carsStolen: s.carsStolen,
    player: { x: s.player.x, z: s.player.z, yaw: s.player.yaw },
    clockMin: s.clockMin,
    day: s.day,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Private windows: the save lasts this visit only.
  }
  return data;
}

export function applySave(G, data) {
  const s = G.state;
  s.cash = data.cash;
  s.respect = data.respect;
  s.jobsDone = data.jobsDone;
  s.jobIndex = Math.min(data.jobIndex, 9);
  s.jobStage = 0;
  s.wanted = 0;
  s.health = data.health;
  s.armour = data.armour;
  s.radio = data.radio || 0;
  s.weaponIndex = data.weaponIndex || 1;
  s.weapons = WEAPON_DEFS.map((w) => {
    const saved = (data.weapons || []).find((x) => x.id === w.id);
    return { ...w, ammo: saved ? saved.ammo : w.ammo, locked: saved ? saved.locked : w.id !== 'fists' && w.id !== 'pistol' };
  });
  s.ownedCars = data.ownedCars || ['dockside'];
  s.garageCar = data.garageCar || 'dockside';
  s.paint = data.paint !== undefined ? data.paint : 0x4a7fa5;
  s.engineLevel = data.engineLevel || 0;
  s.armourLevel = data.armourLevel || 0;
  s.standing = data.standing || s.standing;
  s.carsStolen = data.carsStolen || 0;
  s.clockMin = data.clockMin || s.clockMin;
  s.day = data.day || 1;
  if (data.player) {
    s.player.x = data.player.x;
    s.player.z = data.player.z;
    s.player.yaw = data.player.yaw;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function saveSummary(data) {
  if (!data) return 'No save yet — a fresh tide in Cala Verde.';
  const when = new Date(data.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return 'Save: ' + when + ' · $' + Math.round(data.cash).toLocaleString('en-US') + ' · ' + data.jobsDone + '/10 jobs · ' + data.ownedCars.length + ' cars in the garage.';
}
