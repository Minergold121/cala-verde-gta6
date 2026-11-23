// Boot and the one loop: Cala Verde in 3D. Input is read every frame, the
// world advances in real time, the chase camera follows Milo, and the HUD
// refreshes. ?shot=chase|foot|tide|garage stages a real frame for screenshots.
import { TIDE, freshState, fmtCash, clamp } from './config.js';
import { createRenderer, updateChaseCamera, updateMarker, hideMarker } from './render.js';
import { buildCity, updateTideVisuals, districtAt } from './world.js';
import { spawnTraffic, spawnParkedCars, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians, scarePedestrians } from './pedestrians.js';
import { updatePolice, addHeat, buildHeli, updateHeli } from './police.js';
import { updateThugs, fireWeapon, updateTracers, damagePlayer, clearThugs } from './combat.js';
import { buildPlayerMesh, updatePlayer, tryCarjack, nearestCar, exitCar } from './player.js';
import { startJob, updateMissions, stageOf, currentJob, completeJob } from './missions.js';
import { createAudio } from './audio.js';
import { readSave, saveGame, applySave, clearSave, saveSummary } from './save.js';
import { createInput } from './input.js';
import { updateHUD, buildCrewCards, say, openGarage, closeGarage, bindGarageTabs, drawFace } from './hud.js';
import { stageShot } from './shots.js';
import { SPEAKERS, RADIO } from './config.js';
import { spawnCar, playerCar } from './vehicles.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const G = {
  state: freshState(),
  scene: null, camera: null, renderer: null,
  cars: [], peds: [], thugs: [], roadblocks: [],
  dispatchLog: [], policeSeq: 0, carSeq: 0,
  audio: null, lowTide: false, focusPoint: { x: -150, z: 30 },
  lastShot: 0, tracerUntil: 0, tracerFrom: null, muzzleUntil: 0,
  heli: null, marker: null, sea: null, causeway: null,
  playerMesh: null, ferris: null, clouds: [],
  saveTimer: 0, frameCount: 0,
};
G.state.seed = seed;
window.__cv = G;

G.audio = createAudio();
G.audio.setStation(0);

// Toast / prompt / dialogue helpers the modules call through G.
G.setToast = (text) => { G.state.toast = text; G.state.toastUntil = G.state.time + 4; };
G.setPrompt = (text) => { G.state.prompt = text; };
G.say = (speaker, line) => say(G, speaker, line);

const rendererApi = createRenderer(G);
buildCity(G);
buildPlayerMesh(G);
buildHeli(G);
spawnTraffic(G, 14);
spawnParkedCars(G);
spawnPedestrians(G, 24);
// Milo's own loaner waits by the garage, parked and unlocked.
spawnCar(G, 'dockside', 30, 12, Math.PI / 2, { color: 0x4a7fa5, parked: true });

const input = createInput(G);
buildCrewCards();
bindGarageTabs(G);
drawFace(document.getElementById('portrait'), 'celia');

// ---- Overlays and buttons. ----
const hudEl = document.getElementById('hud');
const startEl = document.getElementById('start-screen');
const pauseEl = document.getElementById('pause-menu');
const completeEl = document.getElementById('complete-screen');
const wastedEl = document.getElementById('wasted-screen');
const savedData = readSave();
document.getElementById('save-info').textContent = saveSummary(savedData);

function showOnly(overlay) {
  for (const o of [startEl, pauseEl, completeEl, wastedEl]) o.classList.remove('on');
  if (overlay) overlay.classList.add('on');
  hudEl.classList.toggle('on', overlay !== startEl && G.state.mode !== 'title');
}

function beginPlay() {
  G.state.mode = 'play';
  showOnly(null);
  hudEl.classList.add('on');
  G.audio.start();
  if (!G.state.jobActive && G.state.jobsDone < 10 && G.state.jobIndex < 10) {
    startJob(G, G.state.jobIndex);
  }
  updateHUD(G);
}

document.getElementById('btn-new').addEventListener('click', () => {
  clearSave();
  const keepSeed = G.state.seed;
  G.state = freshState();
  G.state.seed = keepSeed;
  G.state.player.x = -150; G.state.player.z = 30;
  if (G.playerMesh) G.playerMesh.visible = true;
  beginPlay();
});
document.getElementById('btn-continue').addEventListener('click', () => {
  if (savedData) applySave(G, savedData);
  if (G.playerMesh) G.playerMesh.visible = true;
  beginPlay();
});
document.getElementById('btn-resume').addEventListener('click', () => {
  G.state.mode = 'play';
  showOnly(null);
  hudEl.classList.add('on');
});
document.getElementById('btn-garage2').addEventListener('click', () => {
  pauseEl.classList.remove('on');
  openGarage(G);
});
document.getElementById('btn-save-quit').addEventListener('click', () => {
  saveGame(G);
  G.state.mode = 'title';
  showOnly(startEl);
  hudEl.classList.remove('on');
  document.getElementById('save-info').textContent = saveSummary(readSave());
});
document.getElementById('btn-retry').addEventListener('click', () => {
  const s = G.state;
  s.health = 100; s.armour = 25; s.wanted = 0; s.unseen = 0;
  s.cash = Math.max(0, s.cash - 500);
  s.player.x = -190; s.player.z = 40; s.player.carId = null; s.player.onFoot = true;
  if (G.playerMesh) G.playerMesh.visible = true;
  clearThugs(G);
  s.mode = 'play';
  showOnly(null);
  hudEl.classList.add('on');
  G.say('celia', 'Up you get, Milo. The Verde doesn\u2019t wait for anyone — least of all you.');
  if (s.jobActive) startJob(G, s.jobIndex);
});
document.getElementById('btn-next-job').addEventListener('click', () => {
  completeEl.classList.remove('on');
  const s = G.state;
  if (s.jobIndex + 1 < 10) startJob(G, s.jobIndex + 1);
  else { s.freeRoam = true; }
  s.mode = 'play';
  hudEl.classList.add('on');
});
document.getElementById('btn-free-roam').addEventListener('click', () => {
  completeEl.classList.remove('on');
  G.state.mode = 'play';
  G.state.freeRoam = true;
  hudEl.classList.add('on');
});

G.onJobComplete = (job) => {
  saveGame(G);
  const s = G.state;
  document.getElementById('complete-title').textContent = 'JOB COMPLETE · ' + job.title;
  document.getElementById('complete-stats').innerHTML =
    'Payout: <b>' + fmtCash(job.payout) + '</b><br>Respect: <b>+' + job.respect + '</b> · Rank: <b>' + s.respect + ' respect</b><br>' +
    'Cash now: <b>' + fmtCash(s.cash) + '</b> · Jobs done: <b>' + s.jobsDone + '/10</b><br>' +
    (s.jobsDone < 10 ? 'Next up: <b>' + (currentJob(G) ? '' : '') + 'JOB ' + (s.jobIndex + 2) + '/10</b>' : 'Every job done. Cala Verde is yours, Milo.');
  G.state.mode = 'complete';
  showOnly(completeEl);
  hudEl.classList.remove('on');
  G.say('celia', 'Clean work, Milo. ' + fmtCash(job.payout) + ' — and that\u2019s only the beginning.');
};

G.onWasted = () => {
  showOnly(wastedEl);
  hudEl.classList.remove('on');
  if (G.audio) G.audio.crash();
};

// Crew abilities: Q swap plates, Z quick fix, X eyes out.
function useCrew(index) {
  const s = G.state;
  if (s.crewCooldown[index] > s.time) { G.setToast('Crew is busy — a moment, Milo.'); return; }
  s.crewCooldown[index] = s.time + 45;
  if (index === 0) {
    s.wanted = Math.max(0, s.wanted - 2);
    s.unseen = 0;
    G.say('june', 'Plates swapped. Half the city just forgot your face.');
    G.setToast('SWAP PLATES — wanted level down.');
  } else if (index === 1) {
    const car = playerCar(G);
    if (car) car.condition = 100;
    s.armour = Math.min(100, s.armour + 25);
    G.say('tomas', 'Patched, torqued, good as new. Try not to bend her again.');
    G.setToast('QUICK FIX — car repaired.');
  } else {
    s.eyesOutUntil = s.time + 20;
    G.say('sana', 'Eyes out — I\u2019ve marked every unit and every stash on your map.');
    G.setToast('EYES OUT — police and thugs marked on the minimap.');
  }
  if (G.audio) G.audio.click();
}

function handlePressed(pressed) {
  const s = G.state;
  if (s.mode !== 'play') return;
  for (const code of pressed) {
    if (code === 'KeyE') tryCarjack(G);
    else if (code === 'KeyR') {
      s.radio = (s.radio + 1) % RADIO.length;
      G.audio.setStation(s.radio);
      G.setToast('Radio: ' + RADIO[s.radio].name + ' — ' + RADIO[s.radio].show);
    }
    else if (code === 'KeyG') {
      const nearGarage = Math.hypot(s.player.x - 30, s.player.z - 30) < 30;
      if (nearGarage) openGarage(G);
      else G.setToast('The garage is in Celia\u2019s Quarter — green square on the map.');
    }
    else if (code === 'KeyM') {
      if (s.jobActive) G.setToast('JOB ' + (s.jobIndex + 1) + '/10 · ' + currentJob(G).title + ' — stage ' + (s.jobStage + 1));
      else if (s.jobsDone < 10) startJob(G, s.jobIndex);
      else G.setToast('All 10 jobs done. Free roam, legend.');
    }
    else if (code === 'KeyP' || code === 'Escape') {
      s.mode = 'pause';
      document.getElementById('pause-info').textContent = 'Job ' + (s.jobIndex + 1) + '/10 · ' + fmtCash(s.cash) + ' · ' + s.respect + ' respect · ' + districtAt(s.player.x, s.player.z).name + '. The tide keeps its own clock.';
      showOnly(pauseEl);
      hudEl.classList.remove('on');
    }
    else if (code === 'Digit1') s.weaponIndex = 0;
    else if (code === 'Digit2') s.weaponIndex = 1;
    else if (code === 'Digit3') s.weaponIndex = 2;
    else if (code === 'Digit4') s.weaponIndex = 3;
    else if (code === 'Digit5') s.weaponIndex = 4;
    else if (code === 'KeyQ') useCrew(0);
    else if (code === 'KeyZ') useCrew(1);
    else if (code === 'KeyX') useCrew(2);
    else if (code === 'KeyH') { if (G.audio) G.audio.honk(); }
  }
  // Weapon select only if unlocked.
  if (s.weapons[s.weaponIndex] && s.weapons[s.weaponIndex].locked) {
    G.setToast(s.weapons[s.weaponIndex].name + ' is locked — earn it or buy it at the shop.');
    s.weaponIndex = 1;
  }
}

function updatePrompts() {
  const s = G.state;
  if (s.mode !== 'play') { s.prompt = ''; return; }
  const stage = stageOf(G);
  if (stage && stage.kind === 'steal' && s.player.onFoot) {
    // Prompt handled by missions; keep a generic one near the target car.
    const car = nearestCar(G, 5);
    if (car) { s.prompt = 'E — STEAL THE ' + car.def.name.toUpperCase(); return; }
  }
  if (s.player.onFoot) {
    const car = nearestCar(G, 4.2);
    if (car) { s.prompt = car.parked ? 'E — TAKE THE ' + car.def.name.toUpperCase() : 'E — CARJACK THE ' + car.def.name.toUpperCase(); return; }
    if (Math.hypot(s.player.x - 30, s.player.z - 30) < 26) { s.prompt = 'G — CELIA\u2019S GARAGE & WEAPON SHOP'; return; }
  } else {
    s.prompt = 'E — GET OUT · SPACE — HANDBRAKE';
    return;
  }
  s.prompt = '';
}

// ---- The loop. ----
let last = performance.now();
let shotReadyAt = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const s = G.state;
  G.frameCount += 1;

  if (s.mode === 'title') {
    // Slow establishing orbit over the golden-hour city behind the title.
    const t = now / 1000 * 0.05;
    G.camera.position.set(-60 + Math.sin(t) * 190, 58, 20 + Math.cos(t) * 190);
    G.camera.lookAt(-40, 6, 0);
    if (G.sky) G.sky.position.copy(G.camera.position);
    rendererApi.renderFrame();
    if (shotName && G.frameCount > 30 && !window.__shotReady) window.__shotReady = true;
    return;
  }
  if (s.mode === 'pause' || s.mode === 'garage' || s.mode === 'complete' || s.mode === 'wasted') {
    if (s.mode === 'pause') {
      const pressed = input.takePressed();
      if (pressed.has('KeyP') || pressed.has('Escape')) {
        s.mode = 'play';
        showOnly(null);
        hudEl.classList.add('on');
      }
    }
    rendererApi.renderFrame();
    return;
  }

  // Staged screenshots: hold the composed frame still — the heli, camera and
  // HUD settle, but no car drives into a roadblock while the shot is taken.
  if (G.shotFreeze) {
    updateHeli(G, 0.016);
    updateChaseCamera(G, 0.016);
    updateHUD(G);
    rendererApi.renderFrame();
    if (G.frameCount > 40 && !window.__shotReady) window.__shotReady = true;
    return;
  }

  s.time += dt;
  s.clockMin += dt * 0.55;
  if (s.clockMin >= 24 * 60) { s.clockMin -= 24 * 60; s.day += 1; }
  s.tidePhase = (s.tidePhase + dt / TIDE.period) % 1;
  G.lowTide = updateTideVisuals(G, s.tidePhase);
  for (const cl of G.clouds) { cl.position.x += dt * 1.2; if (cl.position.x > 420) cl.position.x = -420; }

  const pressed = input.takePressed();
  const inp = input.poll();
  if (shotName === 'chase') inp.forward = true;
  handlePressed(pressed);

  updatePlayer(G, dt, inp);
  if (inp.shoot || input.mouseDown) fireWeapon(G);
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updatePolice(G, dt);
  updateThugs(G, dt);
  updateMissions(G, dt);
  updateTracers(G, dt);
  updatePrompts();

  // Standing drifts with behaviour in each district.
  const d = districtAt(s.player.x, s.player.z);
  if (s.wanted > 0) s.standing[d.name] = clamp((s.standing[d.name] || 50) - dt * 0.4, 5, 100);
  else if (s.jobActive) s.standing[d.name] = clamp((s.standing[d.name] || 50) + dt * 0.25, 5, 100);

  // Objective marker.
  const stage = stageOf(G);
  if (s.jobActive && stage && stage.x !== undefined && !(stage.kind === 'lose' && stage.x === 0) && stage.kind !== 'heat') {
    updateMarker(G, dt, stage);
  } else if (!s.jobActive && s.jobsDone < 10) {
    updateMarker(G, dt, { x: 30, z: 30 });
  } else {
    hideMarker(G);
  }

  updateChaseCamera(G, dt);
  updateHUD(G);
  rendererApi.renderFrame();

  // Autosave while playing.
  G.saveTimer += dt;
  if (G.saveTimer > 25) { G.saveTimer = 0; saveGame(G); }

  if (shotName) {
    shotReadyAt += dt;
    if (shotReadyAt > 2.6 && !window.__shotReady) {
      window.__shotReady = true;
      window.__shotSettled = true;
    }
  }
  void damagePlayer; void completeJob; void exitCar; void scarePedestrians; void addHeat;
}

if (shotName) {
  stageShot(G, shotName);
  G.state.mode = 'play';
  hudEl.classList.add('on');
  startEl.classList.remove('on');
  G.audio.start();
}

requestAnimationFrame(frame);
