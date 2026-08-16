import * as THREE from 'three';

export const WEAPONS = [
  {
    id: 'pistol', name: 'Pistol', type: 'pistol', fireMode: 'semi', auto: false,
    rof: 4.5, damage: 34, mag: 12, reserve: 72, reload: 1.2,
    velocity: 430, range: 520, spread: 0.004, recoilPitch: 0.011, recoilYaw: 0.0035,
    bloom: 0.05, bloomDecay: 1.2, pen: 1, zoom: 1.2, gunPos: [0.3, -0.34, -0.48],
  },
  {
    id: 'smg', name: 'SMG', type: 'smg', fireMode: 'auto', auto: true,
    rof: 11, damage: 18, mag: 30, reserve: 120, reload: 1.9,
    velocity: 400, range: 460, spread: 0.011, recoilPitch: 0.008, recoilYaw: 0.004,
    bloom: 0.15, bloomDecay: 1.6, pen: 1, zoom: 1.2, gunPos: [0.32, -0.3, -0.55],
  },
  {
    id: 'rifle', name: 'Assault Rifle', type: 'rifle', fireMode: 'auto', auto: true,
    rof: 9, damage: 27, mag: 30, reserve: 90, reload: 2.1,
    velocity: 520, range: 660, spread: 0.007, recoilPitch: 0.016, recoilYaw: 0.005,
    bloom: 0.12, bloomDecay: 1.4, pen: 2, zoom: 1.45, gunPos: [0.34, -0.3, -0.6],
  },
  {
    id: 'sniper', name: 'Sniper', type: 'sniper', fireMode: 'semi', auto: false,
    rof: 0.9, damage: 120, mag: 5, reserve: 20, reload: 2.8,
    velocity: 950, range: 1000, spread: 0.0012, recoilPitch: 0.06, recoilYaw: 0.014,
    bloom: 0.03, bloomDecay: 0.9, pen: 3, zoom: 5, gunPos: [0.34, -0.28, -0.62],
  },
];

const BASE_FOV = 75;
const SUBSTEP = 0.004;

const GRIPS = {
  pistol: [0.0, -0.06, 0.0],
  smg: [0.0, -0.05, -0.16],
  rifle: [0.0, -0.05, -0.16],
  sniper: [0.0, -0.04, -0.12],
};

export class WeaponSystem {
  constructor({ camera, player, scene, audio, world, hitTester, onEvent }) {
    this.camera = camera;
    this.player = player;
    this.scene = scene;
    this.audio = audio;
    this.world = world;
    this.hitTester = hitTester;
    this.onEvent = onEvent || (() => {});

    this.index = 2;
    this.ammo = WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve }));
    this.cooldown = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.reloadNeed = 0;
    this.bloom = 0;
    this.ads = 0;
    this.adsTarget = 0;
    this.gunKick = 0;
    this.gunDown = 0;
    this.bullets = [];
    this.fireCooldown = 0;
    this._dir = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._prev = new THREE.Vector3();

    this.rig = new THREE.Group();
    this.rig.position.fromArray(WEAPONS[this.index].gunPos);
    this.muzzle = new THREE.Object3D();
    this.rig.add(this.muzzle);
    this.camera.add(this.rig);

    this.muzzleLight = new THREE.PointLight(0xffd8a0, 0, 7, 1.6);
    this.muzzle.add(this.muzzleLight);

    this._weaponMesh = null;
    this.animT = 0;
    this._buildRig(WEAPONS[this.index]);
  }

  current() {
    return WEAPONS[this.index];
  }

  spread() {
    const w = this.current();
    let s = w.spread * (1 + this.bloom * 2.4);
    if (this.ads > 0.5) s *= 0.35;
    if (this.player.moving) s *= 1.45;
    if (!this.player.onGround) s *= 2;
    if (this.player.crouching) s *= 0.8;
    return s;
  }

  switchTo(i) {
    if (i === this.index || i < 0 || i >= WEAPONS.length) return;
    this.index = i;
    this.reloading = false;
    this.bloom = 0;
    this.cooldown = 0;
    this.rig.position.fromArray(WEAPONS[i].gunPos);
    this._buildRig(WEAPONS[i]);
  }

  _buildRig(w) {
    if (this._weaponMesh) {
      this.rig.remove(this._weaponMesh);
      this._weaponMesh.traverse((o) => {
        if (o.isMesh) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
      });
      this._weaponMesh = null;
    }
    const g = new THREE.Group();
    const metal = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.8, roughness: 0.35 });
    const dark = metal(0x23262b);
    const gunmetal = metal(0x3a4048);

    if (w.id === 'pistol') {
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.22), dark);
      slide.position.set(0, 0.02, -0.1);
      g.add(slide);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.05), dark);
      grip.position.set(0, -0.05, 0.02);
      grip.rotation.x = 0.25;
      g.add(grip);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), gunmetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.28);
      g.add(barrel);
      this.muzzle.position.set(0, 0.02, -0.32);
    } else if (w.id === 'smg') {
      const rec = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.34), dark);
      rec.position.set(0, 0.02, -0.17);
      g.add(rec);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.18, 8), gunmetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.44);
      g.add(barrel);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.09, 0.05), dark);
      mag.position.set(0, -0.05, -0.14);
      mag.rotation.x = 0.18;
      g.add(mag);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), dark);
      stock.position.set(0, -0.01, 0.12);
      g.add(stock);
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.03), dark);
      sight.position.set(0, 0.055, -0.14);
      g.add(sight);
      this.muzzle.position.set(0, 0.02, -0.53);
    } else if (w.id === 'rifle') {
      const rec = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.4), dark);
      rec.position.set(0, 0.02, -0.2);
      g.add(rec);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.26, 8), gunmetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.54);
      g.add(barrel);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.1, 0.06), dark);
      mag.position.set(0, -0.055, -0.14);
      mag.rotation.x = 0.15;
      g.add(mag);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.16), dark);
      stock.position.set(0, -0.01, 0.14);
      g.add(stock);
      const carry = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.1), dark);
      carry.position.set(0, 0.055, -0.1);
      g.add(carry);
      this.muzzle.position.set(0, 0.02, -0.68);
    } else {
      const rec = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.42), dark);
      rec.position.set(0, 0.02, -0.2);
      g.add(rec);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.42, 8), gunmetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.62);
      g.add(barrel);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10), dark);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.055, -0.2);
      g.add(scope);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.05, 0.08), dark);
      mag.position.set(0, -0.045, -0.1);
      g.add(mag);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.2), dark);
      stock.position.set(0, -0.01, 0.16);
      g.add(stock);
      this.muzzle.position.set(0, 0.02, -0.84);
    }

    // FPS hands + arms reaching from the bottom of the screen to the grip
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc68642, roughness: 0.85, metalness: 0 });
    const grip = new THREE.Vector3(...GRIPS[w.id]);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skinMat);
    handR.position.copy(grip).add(new THREE.Vector3(0.01, 0, 0.03));
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skinMat);
    handL.position.copy(grip).add(new THREE.Vector3(-0.01, 0, -0.04));
    g.add(handR, handL);
    g.add(this._armBox(new THREE.Vector3(0.3, -0.52, 0.38), handR.position, skinMat));
    g.add(this._armBox(new THREE.Vector3(-0.28, -0.54, 0.52), handL.position, skinMat));

    this._weaponMesh = g;
    this.rig.add(g);
  }

  _armBox(a, b, mat) {
    const dir = b.clone().sub(a);
    const len = dir.length() || 1;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.075, len, 0.075), mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return mesh;
  }

  startReload() {
    const w = this.current();
    const a = this.ammo[this.index];
    if (this.reloading || a.mag >= w.mag || a.reserve <= 0) return;
    this.reloading = true;
    this.reloadNeed = Math.min(w.mag - a.mag, a.reserve);
    this.reloadT = w.reload;
    this.audio.reload();
    this.onEvent('reloadStart', w);
  }

  _finishReload() {
    const a = this.ammo[this.index];
    a.mag += this.reloadNeed;
    a.reserve -= this.reloadNeed;
    this.reloading = false;
    this.onEvent('reloadEnd', this.current());
  }

  fire() {
    const w = this.current();
    const a = this.ammo[this.index];
    if (this.reloading || this.cooldown > 0) return;
    if (a.mag <= 0) {
      this.audio.empty();
      this.startReload();
      return;
    }
    a.mag--;
    this.cooldown = 1 / w.rof;

    this.audio.gunshot({ type: w.type, power: w.type === 'sniper' ? 1.3 : 1 });
    this.player.addRecoil(w.recoilPitch, (Math.random() - 0.5) * 2 * w.recoilYaw);
    this.bloom = Math.min(1, this.bloom + w.bloom);
    this.gunKick = Math.min(0.14, this.gunKick + 0.05);

    this.muzzleLight.intensity = 9;

    const muzzlePos = new THREE.Vector3();
    this.muzzle.getWorldPosition(muzzlePos);
    this.world.addMuzzleFlash(muzzlePos, w.type === 'sniper' ? 1.6 : 0.85);

    const fwd = this._aimDir(w);
    this._fwd.copy(fwd);

    const shellDir = new THREE.Vector3(1, 0.3, 0.5).applyQuaternion(this.camera.quaternion);
    this.world.addShell(muzzlePos, shellDir);

    const bullet = {
      pos: muzzlePos.clone(),
      vel: fwd.clone().multiplyScalar(w.velocity),
      damage: w.damage,
      pen: w.pen,
      range: w.range,
      travel: 0,
      age: 0,
      alive: true,
      tracer: this._makeTracer(),
    };
    this.bullets.push(bullet);
    this.onEvent('shot', { weapon: w });
  }

  _aimDir(w) {
    const s = this.spread();
    this._dir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this._dir.x += (Math.random() - 0.5) * 2 * s;
    this._dir.y += (Math.random() - 0.5) * 2 * s;
    this._dir.z += (Math.random() - 0.5) * 2 * s;
    this._dir.normalize();
    return this._dir;
  }

  _makeTracer() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.9 }));
    l.frustumCulled = false;
    this.scene.add(l);
    return l;
  }

  _freeTracer(l) {
    this.scene.remove(l);
    l.geometry.dispose();
    l.material.dispose();
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let remaining = dt;
      while (remaining > 0 && b.alive) {
        const h = Math.min(SUBSTEP, remaining);
        remaining -= h;
        this._prev.copy(b.pos);
        b.vel.y -= 9.81 * h;
        b.pos.addScaledVector(b.vel, h);
        b.travel += b.vel.length() * h;
        b.age += h;

        const hit = this.hitTester(this._prev, b.pos);
        if (hit) {
          if (hit.kind === 'enemy') {
            const dmg = b.damage * (hit.head ? 2 : 1);
            const aliveBefore = hit.enemy.alive;
            hit.enemy.damage(dmg, this._fwd);
            this.world.addMuzzleFlash(hit.point, 0.35);
            this.onEvent('hit', { head: hit.head });
            if (aliveBefore && !hit.enemy.alive) this.onEvent('kill', { enemy: hit.enemy, head: hit.head });
            b.alive = false;
          } else if (hit.penetrable && b.pen > 0) {
            b.pen--;
            b.damage *= 0.75;
            const d = b.vel.clone().normalize();
            b.pos.copy(hit.point).addScaledVector(d, 0.07);
            this.world.addDecal(hit.point, hit.normal, 0.3);
            this.onEvent('pierce', {});
          } else {
            this.world.addDecal(hit.point, hit.normal);
            this.world.addMuzzleFlash(hit.point, 0.3);
            b.alive = false;
          }
        }
        if (b.travel > b.range || b.age > 3) b.alive = false;
      }
      if (!b.alive) {
        this._freeTracer(b.tracer);
        this.bullets.splice(i, 1);
      } else {
        const attr = b.tracer.geometry.attributes.position;
        attr.setXYZ(0, this._prev.x, this._prev.y, this._prev.z);
        attr.setXYZ(1, b.pos.x, b.pos.y, b.pos.z);
        attr.needsUpdate = true;
      }
    }
  }

  update(dt, input) {
    this.cooldown -= dt;
    this.fireCooldown -= dt;

    if (this.reloading) {
      this.reloadT -= dt;
      this.gunDown = Math.min(0.35, this.gunDown + dt * 2);
      if (this.reloadT <= 0) {
        this._finishReload();
        this.gunDown = 0;
      }
    } else {
      this.gunDown = Math.max(0, this.gunDown - dt * 4);
    }

    this.gunKick += (0 - this.gunKick) * Math.min(1, dt * 14);
    this.animT += dt;

    const swayScale = (1 - this.ads * 0.85) * (this.player.moving ? 1 : 0);
    const swayX = Math.sin(this.animT * 5) * 0.013 * swayScale;
    const swayY = Math.abs(Math.sin(this.animT * 8)) * 0.011 * swayScale;
    const swayZ = Math.sin(this.animT * 9) * 0.009 * swayScale;

    const gp = WEAPONS[this.index].gunPos;
    this.rig.position.set(gp[0] + swayX, gp[1] - this.gunDown + swayY, gp[2] + this.gunKick + swayZ);
    this.rig.rotation.z = swayX * 0.9;
    this.rig.rotation.x = swayY * 0.7;

    this.bloom = Math.max(0, this.bloom - this.current().bloomDecay * dt);
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 120);

    this.adsTarget = input.ads() && !this.reloading ? 1 : 0;
    this.ads += (this.adsTarget - this.ads) * Math.min(1, dt * 10);

    const w = this.current();
    const zoomedFov = BASE_FOV / w.zoom;
    const fov = BASE_FOV + (zoomedFov - BASE_FOV) * this.ads;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

    if (this.reloading) return;

    const auto = w.auto;
    const fireHeld = input.holdingFire();
    const fireEdge = input.firedEdge();
    if (auto ? fireHeld : fireEdge) this.fire();

    if (input.reload()) this.startReload();

    this.updateBullets(dt);
  }
}
