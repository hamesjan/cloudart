// state logic
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { OrbitControls } from './orbit_ctrls.js';
import { GLTFLoader } from './GLTFLoader.js';

const welcome   = document.getElementById('welcome');
const game      = document.getElementById('game');
const gameover  = document.getElementById('gameover');
const playBtn   = document.getElementById('playBtn');
const restartBtn= document.getElementById('restartBtn');
const finalMsg  = document.getElementById('finalMsg');
const playerNameInput = document.getElementById('playerName');

let playerName = "";
let gameStarted = false;
let gameOver = false;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}


playBtn.addEventListener('click', () => {
  playerName = playerNameInput.value || "Pilot";
  startGame();
});
restartBtn.addEventListener('click', () => {
  location.reload(); // simplest reset: reload page
});


function startGame() {
  showScreen('game');
  gameStarted = true;
  initThreeScene();
}

function endGame() {
  gameOver = true;
  showScreen('gameover');
  finalMsg.textContent = `${playerName}, you crashed!`;
}



// game logic
function initThreeScene() {


const hud = document.getElementById('hud');
const help = document.getElementById('help');
const btnView = document.getElementById('toggleView');
const btnHUD  = document.getElementById('toggleHUD');

// --- Renderer / Scene ---
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById("game").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x498dd1);



// Lighting
scene.add(new THREE.HemisphereLight(0xbbeeff, 0x0a0f16, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(20, 30, 10);
scene.add(sun);

// --- World: ground ---
const loader = new THREE.TextureLoader();
const grassTex = loader.load("assets/pixel_grass_color.png");
const grassNormal = loader.load("assets/pixel_grass_normal.png");
const grassDisp = loader.load("assets/grass_height.png");

grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassNormal.wrapS = grassNormal.wrapT = THREE.RepeatWrapping;
grassDisp.wrapS = grassDisp.wrapT = THREE.RepeatWrapping;

grassTex.repeat.set(100, 100);
grassNormal.repeat.set(100, 100);

const groundGeo = new THREE.PlaneGeometry(4000, 4000, 512, 512);
const groundMat = new THREE.MeshStandardMaterial({
  map: grassTex,
  normalMap: grassNormal,
  displacementMap: grassDisp,
  displacementScale: 20,
  roughness: 0.6,
  color: 0xdddddd,   // brighte
  emissive: 0x333333,         // subtle self-light
emissiveIntensity: 0.5
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -20;
scene.add(ground);

// buildings

const refGroup = new THREE.Group();
scene.add(refGroup);
for (let i = 0; i < 60; i++) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(4, THREE.MathUtils.randFloat(4,25), 4),
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, metalness:0.1, roughness:0.6 })
  );
  const r = THREE.MathUtils.randFloat(40, 400);
  const a = Math.random() * Math.PI * 2;
  m.position.set(Math.cos(a)*r, m.geometry.parameters.height/2 - 5, Math.sin(a)*r);
  refGroup.add(m);
}

// sun

const sunGeo = new THREE.SphereGeometry(20, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
const sunMesh = new THREE.Mesh(sunGeo, sunMat);

// put it far in the sky
sunMesh.position.set(500, 800, -1000);
scene.add(sunMesh);


// --- Ship (cone + wings) ---
const ship = new THREE.Group();  // keep group for compatibility
let mixer;
const gltfLoader = new GLTFLoader();
gltfLoader.load("assets/airplane.glb", (gltf) => {
  const airplane = gltf.scene;
  airplane.scale.set(2, 2, 2);
  airplane.rotation.y = Math.PI;

  ship.add(airplane);

  // --- animations ---
  if (gltf.animations && gltf.animations.length) {
    mixer = new THREE.AnimationMixer(airplane);
    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.play();
    });
  }
});

// Position the ship in the world
ship.position.set(0, 0, 0);
scene.add(ship);

// --- Balloons (two circles behind plane) ---
const balloons = new THREE.Group();

function makeBalloon(offsetZ){
  const geo = new THREE.SphereGeometry(1, 16, 16); // radius 3.5
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff4d6d,
    emissive: 0x771122,
    emissiveIntensity: 0.4,
    roughness: 0.5,
    metalness: 0.1
  });
  const balloon = new THREE.Mesh(geo, mat);

  // Place balloon directly behind plane, centered on X
  balloon.position.set(0, -2.0, offsetZ);
  return balloon;
}

// Two balloons, one further back than the other
balloons.add(makeBalloon(12));
balloons.add(makeBalloon(16));

ship.add(balloons);



// Darts

const darts = [];  // active darts
const dartSpeed = 500;      // bullet speed (was 80)
const dartRange = 2000;     // 2 km range
const dartGravity = -0.5;   // very small drop (or set to 0 for laser-like)


function fireDart(){
  // Bigger, black dart
  const geo = new THREE.BoxGeometry(0.6, 0.6, 8.0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x000000, metalness:0.3, roughness:0.5 });
  const dart = new THREE.Mesh(geo, mat);

  // Nose offset in front of the plane (world space)
  const noseOffset = new THREE.Vector3(0, 0, -8); 
  const noseWorld = noseOffset.clone().applyMatrix4(ship.matrixWorld);
  dart.position.copy(noseWorld);

  // Orientation matches plane’s facing
  dart.quaternion.copy(ship.quaternion);

  // Forward direction (nose of plane in world space)
  const forward = new THREE.Vector3(0,0,-1).applyQuaternion(ship.quaternion).normalize();

  dart.userData = {
    vel: forward.multiplyScalar(500), // much faster bullet speed
    traveled: 0
  };

  scene.add(dart);
  darts.push(dart);
}



// --- Flight state ---
let speed = 0;                // plane is stopped
let isAirborne = false;     
let airborneTimer = 0;    // counts seconds in air


const accel = 15;              // how quickly throttle turns into forward accel
const drag = 0.02;             // slows plane if throttle low

const takeoffSpeed = 40;       // speed threshold for liftoff


 const idle = 0.2;              // what it drifts toward (0 = full off, 0.2 = cruise idle)
  const decayRate = 0.6;         // how fast it drifts back per second
  

// const ship = new THREE.Group();
// {
//   const hull = new THREE.Mesh(
//     new THREE.ConeGeometry(0.8, 2.8, 6),
//     new THREE.MeshStandardMaterial({
//       color: 0x8bf6ff, metalness:0.2, roughness:0.3, emissive:0x1c7ea3, emissiveIntensity:0.25
//     })
//   );
//   hull.rotation.z = Math.PI;
//   hull.position.y = 0.25;
//   ship.add(hull);

//   const wings = new THREE.Mesh(
//     new THREE.BoxGeometry(3.0, 0.08, 0.3),
//     new THREE.MeshStandardMaterial({
//       color: 0xff9bd4, metalness:0.2, roughness:0.45, emissive:0x8a2a60, emissiveIntensity:0.15
//     })
//   );
//   wings.position.set(0, 0, -0.2);
//   ship.add(wings);
// }
// ship.position.set(0, 10, 0);
// scene.add(ship);

// --- Cameras ---
const chaseCam = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 2000);
chaseCam.position.set(0, 6, 8);
chaseCam.lookAt(ship.position);

const groundCam = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 2000);
groundCam.position.set(0, ground.position.y + 20, 80);

const controls = new OrbitControls(groundCam, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableZoom = true;
controls.target.copy(ship.position);
controls.minDistance = 8;
controls.maxDistance = 220;
controls.minPolarAngle = 0.05;
controls.maxPolarAngle = Math.PI / 2.05;

let useChaseCam = true;

// --- Chase camera updater ---
function updateChaseCam() {
  const behind = new THREE.Vector3(0, 10.0, 30);
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
  if (k === 'l') fireDart();
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
const throttleMin = 0.0, throttleMax = 5.0, throttleAccel = 0.8;

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

  speed += (throttle * accel - drag * speed) * dt;
  if (speed < 0) speed = 0;

    if (!isAirborne) {
    ship.position.y = 0;

    // Require enough speed and a pull-up command
    if (speed > takeoffSpeed && iPitch > 0) {
      isAirborne = true;
    airborneTimer = 0;   // reset timer at liftoff
        }
  } else {
    ship.position.y = Math.max(ship.position.y, 0);
    if (airborneTimer < 5.0){
      airborneTimer += dt;   // accumulate time in air
    }
  }



  if (isAirborne) {
    // --- In the air: full flight controls ---
    pitch = THREE.MathUtils.clamp(pitch + iPitch * pitchRate * dt, -0.9, 0.9);
    roll  = THREE.MathUtils.clamp(roll  + iRoll  * rollRate  * dt, -maxBank, maxBank);
    yaw   = yaw + (iYaw * yawRate + roll * 0.6) * dt;

    // auto-leveling
    roll  *= (1.0 - Math.min(autoLevel * dt, 0.12));
    pitch *= (1.0 - 0.40 * dt);

    ship.rotation.set(pitch, yaw, roll);

  } else {
    // --- On the ground: lock pitch/roll, but allow yaw steering ---
    pitch = 0;
    roll  = 0;
    yaw   = yaw + (iYaw * yawRate * dt);

    ship.rotation.set(0, yaw, 0);
  }

  if (throttle > idle) {
    throttle = Math.max(idle, throttle - decayRate * dt);
    } else if (throttle < idle) {
      if (isAirborne){
              throttle = Math.min(idle, throttle + decayRate * dt);
      }
    }

  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(ship.quaternion).normalize();
  const v = cruiseSpeed * throttle;
  ship.position.addScaledVector(fwd, speed*dt);

  ship.position.y = Math.max(ship.position.y, -3.0);

  // --- Update darts ---
  for (let i = darts.length - 1; i >= 0; i--) {
    const d = darts[i];
    const dtVel = d.userData.vel.clone().multiplyScalar(dt);

    // apply gravity
    d.userData.vel.y += dartGravity * dt;

    // move dart
    d.position.add(dtVel);

    // track distance
    d.userData.traveled += dtVel.length();
    if (d.userData.traveled > dartRange) {
      scene.remove(d);
      darts.splice(i,1);
    }
  }


  // --- Spin propeller ---

  if (mixer) mixer.update(dt);
  // --- Render ---
  if (useChaseCam) {
    updateChaseCam();
    renderer.render(scene, chaseCam);
  } else {
    groundCam.lookAt(ship.position);
    renderer.render(scene, groundCam);
  }

  const padState = pad ? 'GAMEPAD' : 'KEYBOARD';
  hud.textContent =
`${padState}  THR ${(throttle*100|0)}%  SPD ${speed.toFixed(1)}
Pitch ${rad2deg(pitch)}°  Roll ${rad2deg(roll)}°  Yaw ${rad2deg(yaw % (Math.PI*2))}°
View: ${useChaseCam ? 'CHASE' : 'GROUND'}   DZ ${DEADZONE}
Center (${centerX.toFixed(2)}, ${centerY.toFixed(2)})`;

if (isAirborne && airborneTimer > 2.0 && ship.position.y <= 0.1) {
  endGame();
  return;
}

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

}