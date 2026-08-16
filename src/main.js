import * as THREE from 'three';
import { AudioEngine } from './audio.js';
import { World } from './world.js';
import { Player } from './player.js';
import { WeaponSystem, WEAPONS } from './weapons.js';
import { EnemyManager } from './enemies.js';
import { HUD } from './hud.js';

class Input {
  constructor(canvas) {
    this.down = new Set();
    this.edge = new Set();
    this.fireHeld = false;
    this.adsHeld = false;
    this.fireEdge = false;
    this.dx = 0;
    this.dy = 0;
    this.locked = false;

    window.addEventListener('keydown', (e) => {
      if (e.code.startsWith('Key') || ['Space', 'ShiftLeft', 'KeyC'].includes(e.code)) {
        if (!this.down.has(e.code)) this.edge.add(e.code);
        this.down.add(e.code);
      }
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.fireHeld = false; this.adsHeld = false; });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.fireHeld = true; this.fireEdge = true; }
      if (e.button === 2) this.adsHeld = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.adsHeld = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.dx += e.movementX; this.dy += e.movementY; }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  held(c) { return this.down.has(c); }
  pressed(c) { if (this.edge.has(c)) { this.edge.delete(c); return true; } return false; }
  moveForward() { return this.held('KeyW'); }
  moveBack() { return this.held('KeyS'); }
  moveLeft() { return this.held('KeyA'); }
  moveRight() { return this.held('KeyD'); }
  jump() { return this.held('Space'); }
  sprint() { return this.held('ShiftLeft') || this.held('ShiftRight'); }
  crouch() { return this.held('KeyC'); }
  ads() { return this.adsHeld; }
  reload() { return this.pressed('KeyR'); }
  holdingFire() { return this.fireHeld; }
  firedEdge() { const e = this.fireEdge; this.fireEdge = false; return e; }
  endFrame() { this.dx = 0; this.dy = 0; }
}

function segmentSphere(segA, segB, center, r) {
  const d = segB.clone().sub(segA);
  const a = d.dot(d);
  if (a < 1e-8) return null;
  const f = segA.clone().sub(center);
  const b = 2 * f.dot(d);
  const c = f.dot(f) - r * r;
  let disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  disc = Math.sqrt(disc);
  const t1 = (-b - disc) / (2 * a);
  if (t1 >= 0 && t1 <= 1) {
    return { t: t1, point: segA.clone().addScaledVector(d, t1) };
  }
  return null;
}

function makeHitTester(world, enemies) {
  return (a, b) => {
    const w = world.raycastSegment(a, b);
    let bestT = w ? w.t : Infinity;
    let best = w
      ? { kind: 'world', point: w.point, normal: w.normal, mesh: w.mesh, penetrable: !!w.mesh.userData.penetrable }
      : null;
    for (const tg of enemies.getHitTargets()) {
      const hb = segmentSphere(a, b, tg.bodyCenter, tg.bodyR);
      const hh = segmentSphere(a, b, tg.headCenter, tg.headR);
      let ht = null;
      let head = false;
      if (hb && hh) {
        if (hh.t < hb.t) { ht = hh; head = true; } else { ht = hb; }
      } else if (hb) {
        ht = hb;
      } else if (hh) {
        ht = hh; head = true;
      }
      if (ht && ht.t < bestT) {
        bestT = ht.t;
        best = { kind: 'enemy', enemy: tg.enemy, head, point: ht.point };
      }
    }
    return best;
  };
}

const main = () => {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1014);
  scene.fog = new THREE.FogExp2(0x0b1014, 0.011);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.rotation.order = 'YXZ';

  scene.add(new THREE.HemisphereLight(0xbfd4c0, 0x30382c, 0.75));
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.1);
  sun.position.set(60, 80, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.far = 200;
  scene.add(sun);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const audio = new AudioEngine();
  const world = new World(scene);
  const player = new Player(camera, audio);
  const input = new Input(canvas);

  let started = false;
  let paused = false;
  let deadShown = false;

  const hud = new HUD();
  const onEvent = (name, data) => {
    if (name === 'hit') {
      hud.hitmarker(false);
      audio.hitmarker();
    } else if (name === 'kill') {
      hud.hitmarker(true);
      audio.hitmarker();
      hud.killfeed(data.head ? 'HEADSHOT — HOSTILE DOWN' : 'HOSTILE DOWN');
    } else if (name === 'playerHit') {
      hud.damage(data.amount);
    }
  };

  const enemies = new EnemyManager({ scene, player, world, audio, onEvent: (name, data) => {
    if (name === 'wave') {
      hud.banner(`WAVE ${data}`);
    } else if (name === 'intermission') {
      hud.banner(`WAVE ${data} CLEARED`);
      player.heal(30);
    } else if (name === 'enemyKilled') {
      // handled via weapon kill events
    }
  }});

  const weapons = new WeaponSystem({
    camera, player, scene, audio, world,
    hitTester: makeHitTester(world, enemies),
    onEvent,
  });

  window.__jgg = { enemies, player, weapons, world, camera };

  const startGame = () => {
    audio.init();
    audio.resume();
    started = true;
    paused = false;
    deadShown = false;
    hud.hideStart();
    hud.hideDeath();
    hud.hidePause();
    player.reset();
    weapons.switchTo(2);
    WEAPONS.forEach((w, i) => { weapons.ammo[i].mag = w.mag; weapons.ammo[i].reserve = w.reserve; });
    enemies.reset();
    enemies.startWave();
    hud.banner('WAVE 1', 2.0);
    requestLock();
  };

  const requestLock = () => {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  };

  const respawn = () => {
    player.reset();
    deadShown = false;
    hud.hideDeath();
    hud.banner('REDEPLOYED', 1.6);
    requestLock();
  };

  hud.start(startGame);
  hud.resume(() => { paused = false; hud.hidePause(); requestLock(); });
  hud.respawn(respawn);

  document.addEventListener('pointerlockchange', () => {
    if (!started) return;
    if (!document.pointerLockElement) {
      if (player.dead) return;
      paused = true;
      hud.showPause();
    }
  });

  const clock = new THREE.Clock();

  const loop = () => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    const time = clock.elapsedTime;

    if (!started || paused) {
      renderer.render(scene, camera);
      return;
    }

    if (input.locked && !player.dead) {
      const sens = 0.0021 * (camera.fov / 75);
      player.yaw -= input.dx * sens;
      player.pitch -= input.dy * sens;
      player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch));
    }

    if (input.pressed('Digit1')) weapons.switchTo(0);
    if (input.pressed('Digit2')) weapons.switchTo(1);
    if (input.pressed('Digit3')) weapons.switchTo(2);
    if (input.pressed('Digit4')) weapons.switchTo(3);

    player.update(dt, input);
    weapons.update(dt, input);
    enemies.update(dt, time);
    world.update(dt, time);

    const drops = world.collectPickups(player.pos);
    for (const kind of drops) {
      audio.pickup();
      if (kind === 'health') player.heal(40);
      else player.armorUp(40);
    }

    if (player.dead && !deadShown) {
      deadShown = true;
      hud.showDeath(enemies.kills, enemies.wave);
      document.exitPointerLock();
    }

    hud.update(dt, {
      spread: weapons.spread(),
      health: player.health,
      maxHealth: player.maxHealth,
      armor: player.armor,
      mag: weapons.ammo[weapons.index].mag,
      reserve: weapons.ammo[weapons.index].reserve,
      weaponName: weapons.current().name,
      reloading: weapons.reloading,
      kills: enemies.kills,
      wave: enemies.wave,
      aliveEnemies: enemies.alive,
      playerPos: player.pos,
      playerYaw: player.yaw,
      enemies: enemies.enemies.map((e) => ({ x: e.group.position.x, z: e.group.position.z, alive: e.alive })),
    });

    input.endFrame();
    renderer.render(scene, camera);
  };

  loop();
};

main();
