import * as THREE from 'three';

const TIERS = [
  { hp: 80, speed: 3.1, damage: 9, accuracy: 0.42, gun: 'pistol', style: 'kurta' },
  { hp: 130, speed: 3.6, damage: 12, accuracy: 0.52, gun: 'rifle', style: 'kurta' },
  { hp: 200, speed: 3.9, damage: 16, accuracy: 0.62, gun: 'rifle', style: 'officer' },
  { hp: 300, speed: 4.2, damage: 22, accuracy: 0.72, gun: 'rifle', style: 'khaki' },
];

const SKIN = [0xd2a679, 0xc18b5e, 0xa8744f, 0x8a5a36, 0x9c6b46, 0x6d4226];
const KURTA = [0xff9933, 0x008c5a, 0xc2185b, 0xe6b33a, 0x55a7e0, 0x8e24aa];
const LUNGI = [0xffd54f, 0xff8a65, 0xf2e8cf, 0x26a69a, 0xff7043];
const TURBAN = [0xffd700, 0xff5722, 0xe91e63, 0xfff8e1, 0x00bcd4, 0x8e24aa, 0x9ccc65, 0xff3d00];
const OFFICER = 0x800000;
const KHAKI = 0x9e9d24;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class EnemyManager {
  constructor({ scene, player, world, audio, onEvent }) {
    this.scene = scene;
    this.player = player;
    this.world = world;
    this.audio = audio;
    this.onEvent = onEvent || (() => {});
    this.enemies = [];
    this.wave = 0;
    this.kills = 0;
    this.alive = 0;
    this._wavePending = 0;
    this._banner = 0;
    this._dir = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this.targets = [];
    this.starting = true;
  }

  reset() {
    for (const e of this.enemies) this.scene.remove(e.group);
    this.enemies = [];
    this.wave = 0;
    this.kills = 0;
    this.alive = 0;
    this._wavePending = 0;
    this.starting = true;
  }

  _spawnPoint() {
    const pos = this.player.pos;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 55 + Math.random() * 25;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const dx = x - pos.x, dz = z - pos.z;
      if (dx * dx + dz * dz > 35 * 35) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(55, 0, 0);
  }

  startWave() {
    this.wave++;
    const count = 3 + this.wave;
    const tierCap = Math.min(TIERS.length - 1, Math.floor((this.wave - 1) / 2));
    for (let i = 0; i < count; i++) {
      const tier = Math.max(0, Math.round((Math.random() * 1.5 - 0.5) + Math.min(tierCap, 1 + Math.floor(i / 3))));
      this._spawn(tier);
    }
    this.onEvent('wave', this.wave);
  }

  _limb(parent, len, thick, mat, px, py, pz) {
    const p = new THREE.Group();
    p.position.set(px, py, pz);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(thick, len, thick), mat);
    seg.position.y = -len / 2;
    p.add(seg);
    parent.add(p);
    return p;
  }

  _spawn(tier) {
    const t = TIERS[Math.min(TIERS.length - 1, tier)];
    const g = new THREE.Group();

    const cloth = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.05 });
    const skin = () => new THREE.MeshStandardMaterial({ color: pick(SKIN), roughness: 0.8, metalness: 0 });
    const metal = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.8 });

    const skinMat = skin();
    const bodyMat = cloth(t.style === 'kurta' ? pick(KURTA) : t.style === 'officer' ? OFFICER : KHAKI);
    const lungiMat = cloth(t.style === 'officer' ? OFFICER : t.style === 'khaki' ? KHAKI : pick(LUNGI));
    const turbanMat = cloth(t.style === 'khaki' ? 0x8d8a5a : pick(TURBAN));
    const flashMats = [bodyMat, lungiMat, turbanMat, skinMat];

    // legs (hip pivot)
    const hipY = 0.95;
    const legL = this._limb(g, 0.48, 0.14, lungiMat, -0.14, hipY, 0);
    const legR = this._limb(g, 0.48, 0.14, lungiMat, 0.14, hipY, 0);
    const kneeL = new THREE.Group(); kneeL.position.set(0, -0.48, 0); legL.add(kneeL);
    const kneeR = new THREE.Group(); kneeR.position.set(0, -0.48, 0); legR.add(kneeR);
    const calfL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.13), lungiMat); calfL.position.y = -0.22; kneeL.add(calfL);
    const calfR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.13), lungiMat); calfR.position.y = -0.22; kneeR.add(calfR);
    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.22), skinMat); footL.position.set(0, -0.44, 0.04); kneeL.add(footL);
    const footR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.22), skinMat); footR.position.set(0, -0.44, 0.04); kneeR.add(footR);

    // torso (kurta)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.62, 0.34), bodyMat);
    torso.position.y = 1.28;
    g.add(torso);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.36), cloth(0x2f2a22));
    belt.position.y = 0.99;
    g.add(belt);

    // arms (shoulder pivot) — upper arm in kurta cloth, forearms bare skin
    const shY = 1.54;
    const armL = this._limb(g, 0.32, 0.12, bodyMat, -0.36, shY, 0);
    const armR = this._limb(g, 0.32, 0.12, bodyMat, 0.36, shY, 0);
    const elbL = new THREE.Group(); elbL.position.set(0, -0.32, 0); armL.add(elbL);
    const elbR = new THREE.Group(); elbR.position.set(0, -0.32, 0); armR.add(elbR);
    const foreL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.11), skinMat); foreL.position.y = -0.13; elbL.add(foreL);
    const foreR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.11), skinMat); foreR.position.y = -0.13; elbR.add(foreR);
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skinMat); handL.position.set(0, -0.27, 0); elbL.add(handL);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skinMat); handR.position.set(0, -0.27, 0); elbR.add(handR);

    // neck + head
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), skinMat);
    neck.position.y = 1.63;
    g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skinMat);
    head.position.y = 1.72;
    head.scale.set(1, 1.12, 1);
    g.add(head);

    // turban (or khaki cap for tier 4)
    let headwear;
    if (t.style === 'khaki') {
      headwear = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.12, 12), turbanMat);
      cap.position.y = 0;
      headwear.add(cap);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.16), turbanMat);
      brim.position.set(0, -0.04, 0.1);
      headwear.add(brim);
    } else {
      headwear = new THREE.Group();
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.16, 12), turbanMat);
      wrap.position.y = 0;
      headwear.add(wrap);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), turbanMat);
      knot.position.y = 0.11;
      headwear.add(knot);
    }
    headwear.position.y = 1.86;
    g.add(headwear);

    // gun held forward at chest height
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.6), metal(t.gun === 'pistol' ? 0x2b2f36 : 0x1d2126));
    gun.position.set(0.3, 1.34, 0.12);
    gun.rotation.x = 0.06;
    g.add(gun);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), metal(0x15171a));
    mag.position.set(0.3, 1.26, 0.12);
    g.add(mag);

    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });

    const pos = this._spawnPoint();
    g.position.set(pos.x, 0, pos.z);
    this.scene.add(g);

    const enemy = {
      group: g,
      tier,
      hp: t.hp, maxHp: t.hp,
      speed: t.speed * (0.9 + Math.random() * 0.3),
      damage: t.damage,
      accuracy: t.accuracy,
      gun: t.gun,
      yaw: Math.atan2(this.player.pos.x - pos.x, this.player.pos.z - pos.z),
      alive: true,
      attackCd: 1.2 + Math.random() * 1.5,
      burstCount: 0,
      burstT: 0,
      hitFlash: 0,
      falling: 0,
      removed: false,
      bobT: Math.random() * 6,
      stepT: Math.random() * 6,
      aimBlend: 0,
      gunKick: 0,
      vel: new THREE.Vector3(),
      bodyCenter: new THREE.Vector3(),
      headCenter: new THREE.Vector3(),
      bodyMat,
      flashMats,
      legs: [legL, legR],
      knees: [kneeL, kneeR],
      arms: [armL, armR],
      elbows: [elbL, elbR],
      gunMesh: gun,
      hbSprite: this._makeHealthBar(),
    };
    enemy.hbSprite.position.set(0, 2.15, 0);
    g.add(enemy.hbSprite);
    enemy.damage = (amount, dir) => this.damage(enemy, amount, dir);
    this.enemies.push(enemy);
    this.alive++;
    return enemy;
  }

  _makeHealthBar() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 8;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.scale.set(1.1, 0.14, 1);
    s.frustumCulled = false;
    return s;
  }

  _drawHealthBar(e) {
    const tex = e.hbSprite.material.map;
    const img = tex.source.data;
    const ctx = img.getContext ? img.getContext('2d') : null;
    if (!ctx) return;
    const w = img.width, h = img.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(10,12,10,0.8)';
    ctx.fillRect(0, 0, w, h);
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = pct > 0.5 ? '#5ee26a' : pct > 0.25 ? '#ffb454' : '#ff5544';
    ctx.fillRect(2, 2, (w - 4) * pct, h - 4);
    tex.needsUpdate = true;
  }

  getHitTargets() {
    return this.targets;
  }

  damage(enemy, amount, dir) {
    if (!enemy.alive) return;
    enemy.hp -= amount;
    enemy.hitFlash = 0.12;
    enemy.vel.addScaledVector(dir, 4);
    this._drawHealthBar(enemy);
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      this._die(enemy);
    }
  }

  _die(enemy) {
    enemy.alive = false;
    enemy.falling = 0;
    this.alive--;
    this.kills++;
    this._drawHealthBar(enemy);
    if (Math.random() < 0.3) {
      this.world.addPickup(enemy.group.position.x, enemy.group.position.z, Math.random() < 0.5 ? 'health' : 'armor');
    }
    this.onEvent('enemyKilled', enemy);
  }

  _LOS(from, to) {
    const d = to.clone().sub(from);
    const dist = d.length();
    if (dist < 1e-5) return true;
    const hit = this.world.raycastSegment(from, to);
    return !hit || hit.t > dist - 0.4;
  }

  _pose(e, dt, dist) {
    const speed = Math.hypot(e.vel.x, e.vel.z);
    const moving = speed > 0.6;
    if (moving) e.stepT += dt * (3.4 + speed * 0.9);

    const swing = Math.sin(e.stepT);
    const legAmp = moving ? Math.min(0.75, 0.35 + speed * 0.13) : 0;
    const armAmp = moving ? Math.min(0.5, 0.2 + speed * 0.1) : 0;

    // walking legs
    const legL = e.legs[0], legR = e.legs[1];
    legL.rotation.x = swing * legAmp;
    legR.rotation.x = -swing * legAmp;
    e.knees[0].rotation.x = -0.95 * Math.max(0, swing);
    e.knees[1].rotation.x = -0.95 * Math.max(0, -swing);

    // body bob
    e.group.position.y = moving ? Math.abs(swing) * 0.04 : 0;

    // arms: hold-gun stance, oscillate while moving
    const aim = Math.min(1, e.aimBlend + 0.1);
    const armL = e.arms[0], armR = e.arms[1];
    const R = armAmp * (1 - aim * 0.6);
    armR.rotation.x = -1.32 + swing * R * 0.5 - e.gunKick * 0.14;
    armL.rotation.x = -1.18 - swing * R * 0.5 - e.gunKick * 0.1;
    armL.rotation.y = 0.3;
    armL.rotation.z = -0.35;
    e.elbows[0].rotation.x = -0.45;
    e.elbows[1].rotation.x = -0.35;

    // gun recoil kick
    e.gunKick = Math.max(0, e.gunKick - dt * 6);
    e.gunMesh.position.z = 0.12 - e.gunKick * 0.06;
    e.gunMesh.rotation.x = 0.06 + e.gunKick * 0.05;
  }

  update(dt, time) {
    if (this._wavePending > 0) {
      this._wavePending -= dt;
      if (this._wavePending <= 0) this.startWave();
    }

    const pe = this.player.camera.position;
    this.targets.length = 0;

    for (const e of this.enemies) {
      if (e.removed) continue;
      e.bobT += dt;

      if (!e.alive) {
        e.falling += dt;
        e.group.rotation.x = Math.min(Math.PI / 2, e.falling * 3.2);
        e.group.position.y = -e.falling * 0.2;
        if (e.falling > 1.8) {
          this.scene.remove(e.group);
          e.removed = true;
        }
        continue;
      }

      const ex = e.group.position.x, ez = e.group.position.z;
      e.bodyCenter.set(ex, 1.25, ez);
      e.headCenter.set(ex, 1.72, ez);
      this.targets.push({
        bodyCenter: e.bodyCenter,
        bodyR: 0.42,
        headCenter: e.headCenter,
        headR: 0.22,
        enemy: e,
      });

      const dx = pe.x - ex, dz = pe.z - ez;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const targetYaw = Math.atan2(dx, dz);
      let dy = targetYaw - e.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      e.yaw += dy * Math.min(1, dt * 6);
      e.group.rotation.y = e.yaw;

      e.hitFlash = Math.max(0, e.hitFlash - dt);
      const hex = e.hitFlash > 0 ? 0x661111 : 0x000000;
      for (const m of e.flashMats) m.emissive.setHex(hex);

      this._fwd.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));

      if (dist > 7) {
        const blocked = this.world.raycastSegment(
          new THREE.Vector3(ex, 0.5, ez),
          new THREE.Vector3(ex + this._fwd.x * 0.8, 0.5, ez + this._fwd.z * 0.8)
        );
        if (blocked) e.yaw += 1.4 * dt * 8;
        const k = Math.min(1, dt * 5);
        e.vel.x += (this._fwd.x * e.speed - e.vel.x) * k;
        e.vel.z += (this._fwd.z * e.speed - e.vel.z) * k;
      } else {
        e.vel.multiplyScalar(Math.max(0, 1 - dt * 3));
      }

      e.group.position.x += e.vel.x * dt;
      e.group.position.z += e.vel.z * dt;

      e.attackCd -= dt;
      const shooting = e.burstCount > 0;
      if (shooting) {
        e.burstT -= dt;
        if (e.burstT <= 0) {
          this._enemyShoot(e, pe, dist);
          e.burstCount--;
          e.burstT = 0.15;
        }
      } else if (dist < 38 && e.attackCd <= 0 && this._LOS(e.group.position.clone().setY(1.5), pe)) {
        e.burstCount = 3 + e.tier;
        e.burstT = 0;
      }

      e.aimBlend += ((shooting || dist < 14) ? 1 : 0.4 - e.aimBlend) * Math.min(1, dt * 5);
      this._pose(e, dt, dist);
    }

    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i];
      if (a.removed || !a.alive) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
        if (b.removed || !b.alive) continue;
        const dx = a.group.position.x - b.group.position.x;
        const dz = a.group.position.z - b.group.position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 1.21 || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = ((1.1 - d) / 2) * dt * 3;
        const nx = dx / d, nz = dz / d;
        a.group.position.x += nx * push;
        a.group.position.z += nz * push;
        b.group.position.x -= nx * push;
        b.group.position.z -= nz * push;
      }
    }

    if (this.alive <= 0 && !this._wavePending && this._banner <= 0) {
      this._wavePending = 2.4;
      this._banner = 2.4;
      this.onEvent('intermission', this.wave);
    }
    this._banner = Math.max(0, this._banner - dt);
  }

  _enemyShoot(e, playerEye, dist) {
    const muzzle = new THREE.Vector3(e.group.position.x, 1.35, e.group.position.z);
    const toPlayer = playerEye.clone().sub(muzzle).normalize();
    const missDir = new THREE.Vector3(toPlayer.x + (Math.random() - 0.5), toPlayer.y + (Math.random() - 0.5), toPlayer.z + (Math.random() - 0.5)).normalize();

    this.audio.gunshot({ type: e.gun, distant: true, power: 0.6 });
    this.world.addMuzzleFlash(muzzle, 0.4);
    e.gunKick = 1;

    const hit = Math.random() < e.accuracy;
    const dir = hit ? toPlayer : missDir;
    const endPoint = muzzle.clone().addScaledVector(dir, 60);
    this.world.addTracer(muzzle, endPoint, 0xff6644);

    if (hit) {
      this.player.damage(e.damage);
      this.onEvent('playerHit', { amount: e.damage, dir });
    }
  }
}
