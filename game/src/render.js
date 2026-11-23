// The three.js stage: renderer, golden-hour lighting, sky, chase camera and
// the objective marker. World dressing lives in world.js; cars in vehicles.js.
import { CITY, clamp, lerp } from './config.js';

const THREE = window.THREE;

export function createRenderer(G) {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.SRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf2a06a, 180, 620);
  G.scene = scene;
  G.renderer = renderer;

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(-170, 26, 60);
  G.camera = camera;

  // Golden-hour sky: a big gradient dome, sun low in the west over the sea.
  const skyGeo = new THREE.SphereGeometry(900, 24, 14);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x3a2a6e) },
      mid: { value: new THREE.Color(0xf27a5a) },
      low: { value: new THREE.Color(0xffc46a) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low; void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  G.sky = sky;

  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x3a2a44, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36a, 1.6);
  sun.position.set(-320, 120, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 700;
  scene.add(sun);
  G.sun = sun;
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(26, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  sunBall.position.set(-700, 90, 40);
  scene.add(sunBall);

  // Clouds: flat warm slabs drifting slowly.
  G.clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffc9a8, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 9; i += 1) {
    const cl = new THREE.Mesh(new THREE.BoxGeometry(60 + i * 7, 3, 14), cloudMat);
    cl.position.set(-300 + i * 70, 120 + (i % 3) * 26, -260 + i * 55);
    scene.add(cl);
    G.clouds.push(cl);
  }

  // Objective marker: a spinning gold diamond + a light pillar, always visible.
  const marker = new THREE.Group();
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(2.2), new THREE.MeshBasicMaterial({ color: 0xffd23d }));
  diamond.position.y = 9; marker.add(diamond);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 26, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  pillar.position.y = 13; marker.add(pillar);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.35, 6, 26), new THREE.MeshBasicMaterial({ color: 0xffd23d }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.4; marker.add(ring);
  marker.visible = false;
  scene.add(marker);
  G.marker = marker;
  G.markerDiamond = diamond;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function renderFrame() {
    renderer.render(scene, camera);
  }

  return { renderFrame, renderer, scene, camera };
}

// Low chase camera: behind the car or the walker, dragged around by the mouse.
export function updateChaseCamera(G, dt) {
  const cam = G.camera;
  const p = G.state.player;
  const focus = G.focusPoint || { x: p.x, z: p.z };
  let targetYaw = p.yaw;
  if (p.onFoot) targetYaw = G.state.camYaw;
  // The camera looks from behind the direction of travel.
  const behind = targetYaw + Math.PI;
  const dist = p.onFoot ? 9 : 13;
  const height = p.onFoot ? 4.2 : 5.2;
  const desiredX = focus.x + Math.sin(behind) * dist;
  const desiredZ = focus.z + Math.cos(behind) * dist;
  const k = 1 - Math.pow(0.0001, dt);
  cam.position.x = lerp(cam.position.x, desiredX, k);
  cam.position.z = lerp(cam.position.z, desiredZ, k);
  cam.position.y = lerp(cam.position.y, height + (p.onFoot ? 0 : 0.6), k);
  // Keep the camera out of the sea floor and inside the world.
  cam.position.x = clamp(cam.position.x, -CITY.half - 60, CITY.half + 40);
  cam.position.z = clamp(cam.position.z, -CITY.half - 40, CITY.half + 40);
  cam.lookAt(focus.x, 2.2, focus.z);
  if (G.sky) { G.sky.position.copy(cam.position); }
  if (G.sun) {
    G.sun.position.set(cam.position.x - 320, 120, cam.position.z + 60);
    G.sun.target.position.set(focus.x, 0, focus.z);
    G.sun.target.updateMatrixWorld();
  }
}

export function updateMarker(G, dt, target) {
  if (!target || !G.marker) return;
  G.marker.visible = true;
  G.marker.position.set(target.x, 0, target.z);
  G.markerDiamond.rotation.y += dt * 2.4;
  G.markerDiamond.position.y = 9 + Math.sin(G.state.time * 3) * 0.7;
}

export function hideMarker(G) {
  if (G.marker) G.marker.visible = false;
}
