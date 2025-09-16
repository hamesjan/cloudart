import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { OrbitControls } from './orbit_ctrls.js';

const hud = document.getElementById('hud');
const help = document.getElementById('help');
const btnView = document.getElementById('toggleView');
const btnHUD  = document.getElementById('toggleHUD');

// --- Renderer / Scene ---
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2b4a);

const smokeGroup = new THREE.Group();
scene.add(smokeGroup);

// Lighting
scene.add(new THREE.HemisphereLight(0xbbeeff, 0x0a0f16, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(20, 30, 10);
scene.add(sun);

// --- World: ground + reference boxes ---
const ground = new THREE.GridHelper(4000, 200, 0x3ac7ff, 0x154e7a);
ground.position.y = -5;
scene.add(ground);

const refGroup = new THREE.Group();
scene.add(refGroup);
for (let i = 0; i < 60; i++) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(4, THREE.MathUtils.randFloat(4,14), 4),
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, metalness:0.1, roughness:0.6 })
  );
  const r = THREE.MathUtils.randFloat(40, 400);
  const a = Math.random() * Math.PI * 2;
  m.position.set(Math.cos(a)*r, m.geometry.parameters.height/2 - 5, Math.sin(a)*r);
  refGroup.add(m);
}

// --- Ship (cone + wings) ---
const ship = new THREE.Group();
{
  const hull = new THREE.Mesh(
    new THREE.ConeGeometry(0.8, 2.8, 6),
    new THREE.MeshStandardMaterial({
      color: 0x8bf6ff, metalness:0.2, roughness:0.3, emissive:0x1c7ea3, emissiveIntensity:0.25
    })
  );
  hull.rotation.z = Math.PI;
  hull.position.y = 0.25;
  ship.add(hull);

  const wings = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.08, 0.3),
    new THREE.MeshStandardMaterial({
      color: 0xff9bd4, metalness:0.2, roughness:0.45, emissive:0x8a2a60, emissiveIntensity:0.15
    })
  );
  wings.position.set(0, 0, -0.2);
  ship.add(wings);
}
ship.position.set(0, 4, 0);
scene.add(ship);

// --- Cameras ---
const chaseCam = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 2000);
chaseCam.position.set(0, 6, 8);
chaseCam.lookAt(ship.position);

// Ground spectator camera (fixed world position, orbit around the ship)
const groundCam = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 2000);
// groundCam.position.set(0, 18, 60);
groundCam.position.set(0, ground.position.y + 10, 80);
// groundCam.lookAt(ship.position);

const controls = new OrbitControls(groundCam, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableZoom = true;
controls.target.copy(ship.position);
// Keep it feeling like a ground camera
controls.minDistance = 8;
controls.maxDistance = 220;
controls.minPolarAngle = 0.05;             // can look slightly up from ground
controls.maxPolarAngle = Math.PI / 2.05;   // don't flip above the plane

let useChaseCam = true;

// --- Chase camera updater ---
function updateChaseCam() {
  const behind = new THREE.Vector3(0, 1.2, 5.2); // positive Z = behind
  const target = ship.localToWorld(behind.clone());
  chaseCam.position.lerp(target, 0.15);
  chaseCam.lookAt(ship.position);
}

// --- Input ---
const keys = new Set();
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'c') toggleView();
  if (k === 'h') toggleHUD();
});
addEventListener('keyup',   e => keys.delete(e.key.toLowerCase()));

let padIndex = null;
function getPad(){
  const pads = navigator.getGamepads?.() || [];
  if (padIndex == null) {
    for (let i = 0; i < pads.length; i++) if (pads[i]) { padIndex = i; break; }
  }
  return padIndex != null ? pads[padIndex] : null;
}

const DEADZONE = 0.12;
let centerX = -0.22, centerY = -0.38;
let calibFrames = 0, calibrated = false;

function axisWithDeadzone(v, center, dz = DEADZONE){
  const d = v - center;
  if (Math.abs(d) < dz) return 0;
  return (Math.abs(d)-dz)/(1-dz) * Math.sign(d);
}

// --- Flight state ---
let throttle = 0.45;
const throttleMin = 0.15, throttleMax = 1.5, throttleAccel = 0.8;

let pitch = 0, yaw = 0, roll = 0;
const pitchRate = 1.8, yawRate = 1.6, rollRate = 2.2;
const autoLevel = 0.9, maxBank = 0.75;
const cruiseSpeed = 35;

// --- Loop ---
let last = performance.now();

function loop(now){
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, (now-last)/1000); last = now;

  let iPitch=0, iRoll=0, iYaw=0, tUp=false, tDown=false;

  const pad = getPad();
  if (pad){
    const ax0 = pad.axes[0] ?? 0;
    const ax1 = pad.axes[1] ?? 0;

    const nearCenter = Math.hypot(ax0-centerX, ax1-centerY) < 0.20;
    if (!calibrated && nearCenter && calibFrames < 60) {
      centerX = (centerX*calibFrames + ax0) / (calibFrames+1);
      centerY = (centerY*calibFrames + ax1) / (calibFrames+1);
      calibFrames++;
      if (calibFrames >= 60) calibrated = true;
    }

    const stickX = axisWithDeadzone(ax0, centerX);
    const stickY = axisWithDeadzone(ax1, centerY);

    iRoll  = -stickX;
    iPitch = -stickY;

    const lb = !!pad.buttons[4]?.pressed;
    const rb = !!pad.buttons[5]?.pressed;
    const ltAxis = (pad.axes[2] ?? 0) > 0.35;
    const rtAxis = (pad.axes[5] ?? 0) > 0.35;
    iYaw = (rb || rtAxis ? 1:0) - (lb || ltAxis ? 1:0);

    tUp   = !!pad.buttons[0]?.pressed;
    tDown = !!pad.buttons[1]?.pressed;
  }

  if (keys.size){
    if (keys.has('w') || keys.has('arrowup'))    iPitch += 1;
    if (keys.has('s') || keys.has('arrowdown'))  iPitch -= 1;
    if (keys.has('a') || keys.has('arrowleft'))  iRoll  += 1;
    if (keys.has('d') || keys.has('arrowright')) iRoll  -= 1;
    if (keys.has('q')) iYaw -= 1;
    if (keys.has('e')) iYaw += 1;
    if (keys.has(' ')) tUp = true;
    if (keys.has('shift')) tDown = true;
  }

  if (tUp)   throttle = Math.min(throttleMax, throttle + throttleAccel*dt);
  if (tDown) throttle = Math.max(throttleMin, throttle - throttleAccel*dt);

  pitch = THREE.MathUtils.clamp(pitch + iPitch*pitchRate*dt, -0.9, 0.9);
  roll  = THREE.MathUtils.clamp(roll  + iRoll*rollRate*dt,  -maxBank, maxBank);
  yaw   = yaw + (iYaw*yawRate + roll*0.6)*dt;

  roll  *= (1.0 - Math.min(autoLevel*dt, 0.12));
  pitch *= (1.0 - 0.40*dt);

  ship.rotation.set(pitch, yaw, roll);

  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(ship.quaternion).normalize();
  const v = cruiseSpeed * throttle;
  ship.position.addScaledVector(fwd, v*dt);

  ship.position.y = Math.max(ship.position.y, -3.0);

  const smokeGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.6 });

  const puff = new THREE.Mesh(smokeGeo, smokeMat);
  puff.position.copy(ship.position);

  // move puff slightly backward (so it appears at the engine)
  const back = new THREE.Vector3(0,0,1).applyQuaternion(ship.quaternion).multiplyScalar(2);
  puff.position.add(back);

  puff.userData = { life: 1.0 }; // track fade
  smokeGroup.add(puff);

  // --- Update smoke particles ---
  for (let i = smokeGroup.children.length - 1; i >= 0; i--) {
    const puff = smokeGroup.children[i];
    puff.userData.life -= dt * 0.1;          // fade speed
    // puff.scale.multiplyScalar(1.01);         // grow slightly
    puff.material.opacity = puff.userData.life;
    if (puff.userData.life <= 0) {
      smokeGroup.remove(puff);
    }
  }



  // --- Render with active camera ---
  if (useChaseCam) {
  updateChaseCam();                   // follow behind plane
  renderer.render(scene, chaseCam);
  } else {
    groundCam.lookAt(ship.position);    // only rotate to face ship
    renderer.render(scene, groundCam);
  }
  const padState = pad ? 'GAMEPAD' : 'KEYBOARD';
  hud.textContent =
`${padState}  THR ${(throttle*100|0)}%  SPD ${v.toFixed(1)}
Pitch ${rad2deg(pitch)}°  Roll ${rad2deg(roll)}°  Yaw ${rad2deg(yaw % (Math.PI*2))}°
View: ${useChaseCam ? 'CHASE' : 'GROUND'}   DZ ${DEADZONE}
Center (${centerX.toFixed(2)}, ${centerY.toFixed(2)})`;
}
requestAnimationFrame(loop);

function rad2deg(r){ return (r*180/Math.PI).toFixed(0); }

// --- UI actions ---
function toggleView(){
  useChaseCam = !useChaseCam;
  btnView.textContent = `View: ${useChaseCam ? 'Chase' : 'Ground'}`;
  btnView.setAttribute('aria-pressed', String(useChaseCam));
}
function toggleHUD(){
  const show = hud.style.display !== 'none';
  const next = !show;
  hud.style.display  = next ? '' : 'none';
  help.style.display = next ? '' : 'none';
  btnHUD.textContent = `HUD: ${next ? 'On' : 'Off'}`;
  btnHUD.setAttribute('aria-pressed', String(next));
}
btnView.addEventListener('click', toggleView);
btnHUD.addEventListener('click', toggleHUD);

// --- Resize ---
addEventListener('resize', ()=>{
  chaseCam.aspect = innerWidth/innerHeight;
  chaseCam.updateProjectionMatrix();
  groundCam.aspect = innerWidth/innerHeight;
  groundCam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
