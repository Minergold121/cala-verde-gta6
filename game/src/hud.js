// Every HUD panel: mission + tide + dispatch, circular minimap, cash and
// stars, weapon slots, crew cards, dialogue portraits, speedometer, radio,
// prompts and toasts — plus the garage / weapon-shop panel and its buying.
import { CITY, DISTRICTS, CREW, SPEAKERS, RADIO, RANKS, rankFor, fmtCash, fmtClock, fmtTime, clamp, dist2 } from './config.js';
import { districtAt, isLowTide, secondsToLowTide, secondsLowTideLeft, tideLevel } from './world.js';
import { dispatchList } from './police.js';
import { currentJob, stageOf } from './missions.js';
import { CAR_DEFS, WEAPON_DEFS } from './config.js';
import { PAINTS, carDef, spawnCar, paintCar, playerCar } from './vehicles.js';
import { saveGame } from './save.js';
import { TIDE } from './config.js';

function el(id) { return document.getElementById(id); }

// ---- Portraits: a drawn face per speaker, distinct hair, colour and kit. ----
export function drawFace(canvas, speakerKey) {
  const sp = SPEAKERS[speakerKey] || SPEAKERS.milo;
  const g = canvas.getContext('2d');
  const W = canvas.width; const H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'hsl(' + sp.hue + ', 45%, 26%)';
  g.fillRect(0, 0, W, H);
  // Shoulders.
  g.fillStyle = 'hsl(' + sp.hue + ', 35%, 34%)';
  g.beginPath(); g.ellipse(W / 2, H + 18, 46, 40, 0, 0, Math.PI * 2); g.fill();
  // Face.
  g.fillStyle = '#e8b98a';
  g.beginPath(); g.ellipse(W / 2, H * 0.46, 30, 36, 0, 0, Math.PI * 2); g.fill();
  // Hair.
  g.fillStyle = sp.hair;
  g.beginPath(); g.ellipse(W / 2, H * 0.28, 31, 18, 0, Math.PI, Math.PI * 2); g.fill();
  if (speakerKey === 'celia') {
    g.beginPath(); g.arc(W / 2, H * 0.16, 11, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd27a'; g.lineWidth = 3;
    g.beginPath(); g.arc(W / 2 - 12, H * 0.46, 9, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(W / 2 + 12, H * 0.46, 9, 0, Math.PI * 2); g.stroke();
  }
  if (speakerKey === 'milo') {
    g.fillStyle = '#1c2733';
    g.fillRect(W / 2 - 32, H * 0.20, 64, 10);
    g.fillRect(W / 2 - 32, H * 0.20, 64, 4);
  }
  if (speakerKey === 'dante') {
    g.strokeStyle = '#7a2e3a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(W / 2 - 14, H * 0.52); g.lineTo(W / 2 - 4, H * 0.62); g.stroke();
    g.fillStyle = '#111';
    g.fillRect(W / 2 - 26, H * 0.40, 52, 9);
  }
  if (speakerKey === 'dispatch') {
    g.fillStyle = '#223344';
    g.fillRect(W / 2 - 30, H * 0.22, 60, 12);
    g.fillStyle = '#ffd23d';
    g.beginPath(); g.arc(W / 2, H * 0.28, 5, 0, Math.PI * 2); g.fill();
  }
  // Eyes + smile.
  g.fillStyle = '#241a12';
  g.beginPath(); g.arc(W / 2 - 11, H * 0.46, 3.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(W / 2 + 11, H * 0.46, 3.4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7a4a2e'; g.lineWidth = 3;
  g.beginPath(); g.arc(W / 2, H * 0.58, 11, 0.25, Math.PI - 0.25); g.stroke();
  if (speakerKey === 'tomas') {
    g.fillStyle = 'rgba(58,36,21,0.85)';
    g.beginPath(); g.ellipse(W / 2, H * 0.66, 22, 12, 0, 0, Math.PI); g.fill();
  }
  if (speakerKey === 'sana') {
    g.fillStyle = '#5a2e6a';
    g.beginPath(); g.ellipse(W / 2, H * 0.30, 34, 16, 0, Math.PI, Math.PI * 2); g.fill();
  }
  if (speakerKey === 'june') {
    g.fillStyle = '#111';
    g.fillRect(W / 2 - 26, H * 0.42, 52, 8);
  }
}

export function say(G, speakerKey, line) {
  const s = G.state;
  s.dialogueSpeaker = speakerKey;
  s.dialogueLine = line;
  s.dialogueUntil = s.time + 9;
  const sp = SPEAKERS[speakerKey] || SPEAKERS.milo;
  el('speaker-name').textContent = sp.name;
  el('dialogue-line').textContent = line;
  drawFace(el('portrait'), speakerKey);
}

// ---- Minimap: north-up, player-centred, roads + sea + markers. ----
export function drawMinimap(G) {
  const canvas = el('minimap');
  const g = canvas.getContext('2d');
  const W = canvas.width; const H = canvas.height;
  const s = G.state;
  const scale = W / 260; // 260 m across the circle.
  const toMap = (x, z) => [W / 2 + (x - s.player.x) * scale, H / 2 + (z - s.player.z) * scale];
  g.clearRect(0, 0, W, H);
  g.save();
  g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#16242e'; g.fillRect(0, 0, W, H);
  // Sea on the west.
  const [seaX] = toMap(-CITY.half, 0);
  g.fillStyle = '#1d6f8e'; g.fillRect(0, 0, Math.max(0, seaX), H);
  // District tints.
  for (const d of DISTRICTS) {
    const [x0, z0] = toMap(d.x0, d.z0);
    const [x1, z1] = toMap(d.x1, d.z1);
    g.fillStyle = d.color + '22';
    g.fillRect(Math.min(x0, x1), Math.min(z0, z1), Math.abs(x1 - x0), Math.abs(z1 - z0));
  }
  // Roads.
  g.strokeStyle = '#7a8a9a'; g.lineWidth = 5;
  for (let i = -4; i <= 4; i += 1) {
    const [x] = toMap(i * CITY.roadStep, 0);
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    const [, z] = toMap(0, i * CITY.roadStep);
    g.beginPath(); g.moveTo(0, z); g.lineTo(W, z); g.stroke();
  }
  // Causeway + island.
  const [ix, iz] = toMap(CITY.islandX, CITY.islandZ);
  g.strokeStyle = '#d9b47e'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(...toMap(-CITY.half, CITY.islandZ)); g.lineTo(ix, iz); g.stroke();
  g.fillStyle = '#c9a06a';
  g.beginPath(); g.arc(ix, iz, 11, 0, Math.PI * 2); g.fill();
  // Garage.
  const [gx, gz] = toMap(30, 30);
  g.fillStyle = '#7dff9a'; g.fillRect(gx - 4, gz - 4, 8, 8);
  // Thugs.
  if (s.eyesOutUntil > s.time) {
    for (const t of G.thugs || []) {
      if (t.dead) continue;
      const [tx, tz] = toMap(t.x, t.z);
      g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(tx, tz, 4, 0, Math.PI * 2); g.fill();
    }
  }
  // Police.
  for (const car of G.cars) {
    if (!car.police || car.removed) continue;
    const [cx, cz] = toMap(car.x, car.z);
    g.fillStyle = '#ff2a3a';
    g.beginPath(); g.arc(cx, cz, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(cx, cz, 1.6, 0, Math.PI * 2); g.fill();
  }
  // Objective marker.
  const stage = stageOf(G);
  if (s.jobActive && stage && stage.x !== undefined && !(stage.kind === 'lose' && stage.x === 0)) {
    const [mx, mz] = toMap(stage.x, stage.z);
    g.fillStyle = '#ffd23d';
    g.beginPath(); g.moveTo(mx, mz - 7); g.lineTo(mx + 6, mz); g.lineTo(mx, mz + 7); g.lineTo(mx - 6, mz); g.closePath(); g.fill();
  }
  // Player arrow.
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-s.player.yaw);
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
  g.restore();
  g.restore();
  // Ring.
  g.strokeStyle = 'rgba(255,210,122,0.9)'; g.lineWidth = 3;
  g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); g.stroke();
}

// ---- Crew cards (built once, refreshed for cooldowns). ----
export function buildCrewCards() {
  const wrap = el('crew-cards');
  wrap.innerHTML = '';
  CREW.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'crew-card';
    card.id = 'crew-' + c.id;
    const cv = document.createElement('canvas');
    cv.width = 68; cv.height = 68;
    drawFace(cv, c.id);
    const txt = document.createElement('div');
    txt.innerHTML = '<div class="cname">' + c.name + '</div><div class="cability">' + c.ability + '</div><div class="ckey">[' + c.key + '] ' + c.desc + '</div>';
    card.appendChild(cv);
    card.appendChild(txt);
    wrap.appendChild(card);
  });
}

export function refreshCrew(G) {
  CREW.forEach((c, i) => {
    const card = el('crew-' + c.id);
    if (!card) return;
    card.classList.toggle('ready', G.state.crewCooldown[i] <= G.state.time);
  });
}

// ---- The whole HUD, refreshed every frame (cheap DOM writes only on change). ----
const cache = {};
function setText(id, value) {
  if (cache[id] !== value) { cache[id] = value; const n = el(id); if (n) n.textContent = value; }
}
function setHtml(id, value) {
  if (cache[id] !== value) { cache[id] = value; const n = el(id); if (n) n.innerHTML = value; }
}

export function updateHUD(G) {
  const s = G.state;
  const job = currentJob(G);
  const stage = stageOf(G);
  if (job && s.jobActive) {
    setText('job-title', 'JOB ' + (s.jobIndex + 1) + '/10 · ' + job.title);
    setText('job-sub', (SPEAKERS[job.giver] ? SPEAKERS[job.giver].name : 'CALA VERDE') + ' · CALA VERDE');
    setText('stage-label', 'STAGE ' + (s.jobStage + 1) + '/' + job.stages.length);
    const bar = el('stage-bar');
    if (bar) bar.style.width = Math.round(((s.jobStage + 1) / job.stages.length) * 100) + '%';
    setHtml('next-objective', 'NEXT: <b>' + (stage ? stage.text : '') + '</b>');
    let distTxt = '▸ follow the gold marker';
    if (stage && stage.x !== undefined && !(stage.kind === 'lose' && stage.x === 0)) {
      distTxt = '▸ ' + Math.round(dist2(s.player.x, s.player.z, stage.x, stage.z)) + ' m · follow the gold marker';
    }
    if (stage && stage.kind === 'timed') distTxt = '▸ ' + fmtTime(s.jobTimer) + ' left — drive!';
    if (stage && stage.kind === 'fight') distTxt = '▸ Vultures down: ' + s.jobKills + '/' + s.jobKillsNeed;
    if (stage && stage.kind === 'lose') distTxt = '▸ stay out of sight until the heat dies';
    setText('objective-dist', distTxt);
  } else if (s.jobsDone >= 10) {
    setText('job-title', 'CALA VERDE · ALL JOBS DONE');
    setText('job-sub', 'KING OF THE VERDE');
    setText('stage-label', '10/10');
    setHtml('next-objective', 'NEXT: <b>Free roam — the city is yours.</b>');
    setText('objective-dist', '▸ press M for the job list');
  } else {
    setText('job-title', 'FREE ROAM · CALA VERDE');
    setText('job-sub', 'PRESS M TO START JOB ' + (s.jobIndex + 1));
    setText('stage-label', s.jobsDone + '/10 DONE');
    setHtml('next-objective', 'NEXT: <b>' + job.title + ' — press M.</b>');
    setText('objective-dist', '▸ garage marker: green square on the map');
  }
  // Tide gauge.
  const low = isLowTide(s.tidePhase);
  const gauge = el('tide-gauge');
  if (gauge) {
    const level = (tideLevel(s.tidePhase) + 1) / 2;
    gauge.style.width = Math.round(level * 100) + '%';
    gauge.style.background = low ? 'linear-gradient(90deg,#e8b400,#ffd27a)' : 'linear-gradient(90deg,#1e90b8,#5ee6ff)';
  }
  if (low) {
    setText('tide-countdown', 'LOW TIDE NOW · ' + fmtTime(secondsLowTideLeft(s.tidePhase, TIDE.period)) + ' LEFT');
    setText('tide-note', 'CAUSEWAY OPEN — cross to the stash island now!');
  } else {
    setText('tide-countdown', 'LOW TIDE IN ' + fmtTime(secondsToLowTide(s.tidePhase, TIDE.period)));
    setText('tide-note', 'Causeway to the stash island opens at low tide.');
  }
  // Dispatch.
  const units = dispatchList(G);
  setText('dispatch-count', '· ' + units.length + ' UNIT' + (units.length === 1 ? '' : 'S'));
  el('dispatch-empty').style.display = units.length ? 'none' : 'block';
  const chipClass = (t) => t === 'RAMMING' || t === 'PIT MOVE' ? 'red' : t === 'SPOTLIGHT' ? 'blue' : t === 'ROADBLOCK' ? 'yellow' : 'green';
  setHtml('dispatch-list', units.map((u) => '<div class="unit"><span class="uname">' + u.name + '</span><span class="udist">' + u.dist + ' m</span><span class="chip ' + chipClass(u.tactic) + '">' + u.tactic + '</span></div>').join(''));
  // Top-right.
  setText('cash', fmtCash(s.cash));
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += '<span class="' + (i < s.wanted ? 'lit' : 'dim') + '">★</span>';
  setHtml('stars', stars);
  setText('clock-line', fmtClock(s.clockMin) + ' · GOLDEN HOUR · DAY ' + s.day);
  setText('rank-line', 'JOBS DONE ' + s.jobsDone + '/10 · CARS STOLEN ' + s.carsStolen + ' · ' + RANKS[rankFor(s.respect)]);
  // Minimap + district + vitals.
  drawMinimap(G);
  const d = districtAt(s.player.x, s.player.z);
  setText('district-name', d.name);
  const standing = s.standing[d.name] || 50;
  const sb = el('standing-bar');
  if (sb) sb.style.width = standing + '%';
  setText('standing-val', String(Math.round(standing)));
  const hb = el('health-bar');
  if (hb) { hb.style.width = s.health + '%'; hb.style.background = s.health > 40 ? '#37d67a' : '#e83a3a'; }
  setText('health-val', String(Math.round(s.health)));
  const ab = el('armour-bar');
  if (ab) ab.style.width = s.armour + '%';
  setText('armour-val', String(Math.round(s.armour)));
  setText('respect-rank', 'RANK: ' + RANKS[rankFor(s.respect)] + ' · ' + s.respect + ' RESPECT');
  // Weapons.
  setHtml('weapon-slots', s.weapons.map((w, i) => {
    const cls = 'wslot' + (i === s.weaponIndex ? ' active' : '') + (w.locked ? ' locked' : '');
    const ammo = w.locked ? 'LOCKED' : w.ammo === Infinity ? '∞' : String(w.ammo);
    return '<div class="' + cls + '"><span><span class="wkey">' + (i + 1) + '</span>' + w.name + '</span><span class="wammo">' + ammo + '</span></div>';
  }).join(''));
  refreshCrew(G);
  // Speedo + vehicle.
  const car = playerCar(G);
  const kmh = car ? Math.round(Math.abs(car.speed) * 3.6) : Math.round(s.player.speed * 3.6);
  setText('speed-num', String(kmh));
  setText('vehicle-name', car ? (car.def.name.toUpperCase() + (car.police ? ' · CVPD' : '')) : 'ON FOOT · MILO FERREIRA');
  const cb = el('condition-bar');
  if (cb) { cb.style.width = (car ? car.condition : 100) + '%'; cb.style.background = car && car.condition < 35 ? '#e83a3a' : '#37d67a'; }
  const gear = !car ? 'GEAR N' : car.speed > 26 ? 'GEAR 5' : car.speed > 18 ? 'GEAR 4' : car.speed > 10 ? 'GEAR 3' : car.speed > 3 ? 'GEAR 2' : car.speed < -0.5 ? 'GEAR R' : 'GEAR 1';
  const station = RADIO[s.radio];
  setText('gear-line', gear + ' · ' + station.name);
  setHtml('radio-line', '♪ <b>' + station.name + '</b> — ' + station.show);
  // Prompt + toast.
  const prompt = el('prompt');
  if (s.prompt) { prompt.style.display = 'block'; if (prompt.textContent !== s.prompt) prompt.textContent = s.prompt; }
  else prompt.style.display = 'none';
  const toast = el('toast');
  if (s.toast && s.time < s.toastUntil) { if (toast.textContent !== s.toast) toast.textContent = s.toast; toast.style.display = 'block'; }
  else toast.style.display = 'none';
  el('crosshair').style.display = (!s.player.onFoot || s.weapons[s.weaponIndex].id !== 'fists') && s.mode === 'play' ? 'block' : 'none';
  const flash = document.getElementById('wanted-flash');
  if (flash) flash.style.borderColor = s.wanted >= 3 ? 'rgba(255,40,60,' + (0.25 + 0.2 * Math.sin(s.time * 5)) + ')' : 'rgba(255,40,60,0)';
  const status = el('status');
  if (status && s.jobActive && stage) status.textContent = 'Job ' + (s.jobIndex + 1) + ': ' + stage.text + '. Wanted ' + s.wanted + ' stars.';
}

// ---- Garage & weapon shop. ----
let garageTab = 'cars';

export function openGarage(G) {
  G.state.mode = 'garage';
  el('garage-panel').classList.add('on');
  renderGarage(G);
}

export function closeGarage(G) {
  el('garage-panel').classList.remove('on');
  if (G.state.mode === 'garage') G.state.mode = 'play';
}

export function renderGarage(G) {
  const s = G.state;
  el('garage-cash').textContent = fmtCash(s.cash);
  const list = el('garage-list');
  document.querySelectorAll('#garage-panel .tabs button').forEach((b) => b.classList.toggle('sel', b.dataset.tab === garageTab));
  if (garageTab === 'cars') {
    list.innerHTML = CAR_DEFS.filter((c) => c.id !== 'interceptor').map((c) => {
      const owned = s.ownedCars.includes(c.id);
      const active = s.garageCar === c.id;
      const btn = owned ? (active ? '<span style="color:#7dff9a;font-weight:800">YOUR RIDE</span>' : '<button class="btn small" data-buy="drive:' + c.id + '">DRIVE IT</button>')
        : '<button class="btn small" data-buy="car:' + c.id + '">' + (c.price ? 'BUY ' + fmtCash(c.price) : 'TAKE') + '</button>';
      return '<div class="garage-row"><div><div class="gname">' + c.name + (active ? ' ★' : '') + '</div><div class="gdesc">' + c.desc + ' · top ' + Math.round(c.topSpeed * 3.6) + ' km/h</div></div>' + btn + '</div>';
    }).join('') + '<p class="fine">Bought cars wait outside the garage, painted your colour. Steal any car on the street with E.</p>';
  } else if (garageTab === 'upgrades') {
    const engCost = 1200 * (s.engineLevel + 1);
    const armCost = 900 * (s.armourLevel + 1);
    list.innerHTML =
      '<div class="garage-row"><div><div class="gname">Engine tune — level ' + s.engineLevel + '/5</div><div class="gdesc">More top speed and acceleration on your garage car.</div></div><button class="btn small" data-buy="engine">' + (s.engineLevel >= 5 ? 'MAXED' : 'BUY ' + fmtCash(engCost)) + '</button></div>' +
      '<div class="garage-row"><div><div class="gname">Armour plating — level ' + s.armourLevel + '/5</div><div class="gdesc">Your garage car takes hits; you gain 25 armour per job.</div></div><button class="btn small" data-buy="armour">' + (s.armourLevel >= 5 ? 'MAXED' : 'BUY ' + fmtCash(armCost)) + '</button></div>' +
      '<div class="garage-row"><div><div class="gname">Repair current car</div><div class="gdesc">Back to 100% condition, plus 25 armour for Milo.</div></div><button class="btn small" data-buy="repair">BUY $250</button></div>';
  } else if (garageTab === 'paint') {
    list.innerHTML = '<p style="font-size:14px">Pick a paint for your garage car:</p><div>' + PAINTS.map((p) => '<span class="swatch" data-paint="' + p.color + '" title="' + p.name + '" style="background:#' + p.color.toString(16).padStart(6, '0') + '"></span>').join('') + '</div><p class="fine">Paint applies to the car you drive out of the garage.</p>';
  } else {
    list.innerHTML = WEAPON_DEFS.map((w, i) => {
      const owned = !s.weapons[i].locked;
      const btn = w.id === 'fists' ? '<span style="color:#7dff9a;font-weight:800">ALWAYS READY</span>'
        : owned ? '<button class="btn small" data-buy="ammo:' + w.id + '">AMMO +60 · $150</button>'
        : '<button class="btn small" data-buy="weapon:' + w.id + '">BUY ' + fmtCash(w.price) + '</button>';
      return '<div class="garage-row"><div><div class="gname">' + w.name + (owned ? '' : ' · LOCKED IN SHOP') + '</div><div class="gdesc">' + (owned ? 'Ammo: ' + (s.weapons[i].ammo === Infinity ? '∞' : s.weapons[i].ammo) + ' · damage ' + w.damage : 'Unlocks after job ' + w.lockedAt + ' — or buy it here now.') + '</div></div>' + btn + '</div>';
    }).join('') + '<p class="fine">Buying a weapon here unlocks its slot (1–5) immediately.</p>';
  }
  list.querySelectorAll('[data-buy]').forEach((b) => {
    b.addEventListener('click', () => garageBuy(G, b.dataset.buy));
  });
  list.querySelectorAll('[data-paint]').forEach((sw) => {
    sw.addEventListener('click', () => {
      s.paint = Number(sw.dataset.paint);
      const car = playerCar(G);
      if (car) paintCar(G, car, s.paint);
      G.setToast('Painted. Fresh coat, fresh start.');
      if (G.audio) G.audio.click();
      renderGarage(G);
    });
  });
}

function garageBuy(G, what) {
  const s = G.state;
  const [kind, id] = what.split(':');
  const spend = (amount) => {
    if (s.cash < amount) { G.setToast('Not enough cash — do a job first.'); return false; }
    s.cash -= amount; return true;
  };
  if (kind === 'car') {
    const def = carDef(id);
    if (!spend(def.price)) return;
    s.ownedCars.push(id);
    s.garageCar = id;
    s.paint = def.color;
    const car = spawnCar(G, id, 30, 12, Math.PI / 2, { color: def.color, engineLevel: s.engineLevel, armourLevel: s.armourLevel });
    if (G.audio) G.audio.cash();
    G.setToast(def.name + ' is yours — it waits outside the garage.');
  } else if (kind === 'drive') {
    s.garageCar = id;
    const def = carDef(id);
    s.paint = def.color;
    spawnCar(G, id, 30, 12, Math.PI / 2, { color: def.color, engineLevel: s.engineLevel, armourLevel: s.armourLevel });
    G.setToast(def.name + ' waits outside. Go take it.');
  } else if (kind === 'engine') {
    if (s.engineLevel >= 5) return;
    if (!spend(1200 * (s.engineLevel + 1))) return;
    s.engineLevel += 1;
    G.setToast('Engine tune level ' + s.engineLevel + '. Feel that?');
  } else if (kind === 'armour') {
    if (s.armourLevel >= 5) return;
    if (!spend(900 * (s.armourLevel + 1))) return;
    s.armourLevel += 1;
    s.armour = Math.min(100, s.armour + 25);
    G.setToast('Armour plating level ' + s.armourLevel + '.');
  } else if (kind === 'repair') {
    if (!spend(250)) return;
    const car = playerCar(G);
    if (car) car.condition = 100;
    s.armour = Math.min(100, s.armour + 25);
    s.health = Math.min(100, s.health + 25);
    G.setToast('Patched up. Good as new, nearly.');
  } else if (kind === 'weapon') {
    const w = WEAPON_DEFS.find((x) => x.id === id);
    const idx = WEAPON_DEFS.indexOf(w);
    if (!spend(w.price)) return;
    s.weapons[idx].locked = false;
    s.weapons[idx].ammo = w.ammo;
    G.setToast(w.name + ' unlocked — slot ' + (idx + 1) + '.');
  } else if (kind === 'ammo') {
    if (!spend(150)) return;
    const idx = WEAPON_DEFS.findIndex((x) => x.id === id);
    s.weapons[idx].ammo += 60;
    G.setToast('+60 ammo for the ' + WEAPON_DEFS[idx].name + '.');
  }
  saveGame(G);
  renderGarage(G);
}

export function bindGarageTabs(G) {
  document.querySelectorAll('#garage-panel .tabs button').forEach((b) => {
    b.addEventListener('click', () => { garageTab = b.dataset.tab; renderGarage(G); if (G.audio) G.audio.click(); });
  });
  el('btn-close-garage').addEventListener('click', () => closeGarage(G));
}
