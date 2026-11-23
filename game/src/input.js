// Keyboard + mouse: held movement keys, one-shot action presses, mouse-drag
// camera orbit, and click-to-shoot. Presses are queued and taken once per
// frame so nothing between frames is lost or counted twice.
export function createInput(G) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let lastX = 0;
  let dragging = false;

  const input = {
    forward: false, back: false, left: false, right: false,
    strafe: 0, run: false, handbrake: false, shoot: false,
  };

  window.addEventListener('keydown', (event) => {
    // A focused button must never swallow game keys: blur it and play on.
    if (event.target && event.target.tagName === 'BUTTON') event.target.blur();
    if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) return;
    if (!pressed.has(event.code)) pressed.add(event.code);
    keys.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { keys.delete(event.code); });
  window.addEventListener('blur', () => { keys.clear(); });
  window.addEventListener('mousedown', (event) => {
    if (event.target && event.target.closest && event.target.closest('.overlay, .btn, .tabs, .swatch')) return;
    mouseDown = true; lastX = event.clientX; dragging = true;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; dragging = false; input.shoot = false; });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    lastX = event.clientX;
    G.state.camYaw -= dx * 0.005;
  });
  window.addEventListener('wheel', (event) => {
    G.state.camPitch = Math.max(0.12, Math.min(0.9, G.state.camPitch + Math.sign(event.deltaY) * 0.05));
  }, { passive: true });

  function poll() {
    input.forward = keys.has('KeyW') || keys.has('ArrowUp');
    input.back = keys.has('KeyS') || keys.has('ArrowDown');
    input.left = keys.has('KeyA') || keys.has('ArrowLeft');
    input.right = keys.has('KeyD') || keys.has('ArrowRight');
    input.strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    input.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.handbrake = keys.has('Space');
    input.shoot = keys.has('KeyF');
    return input;
  }

  function wasPressed(code) {
    if (pressed.has(code)) { pressed.delete(code); return true; }
    return false;
  }

  function takePressed() {
    const out = new Set(pressed);
    pressed.clear();
    return out;
  }

  return { poll, wasPressed, takePressed, keys, get mouseDown() { return mouseDown; } };
}
