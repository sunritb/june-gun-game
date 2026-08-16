import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

function tex(size, fn) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  fn(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function decalTexture() {
  return tex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(10,10,10,0.9)');
    g.addColorStop(0.35, 'rgba(25,22,18,0.85)');
    g.addColorStop(0.65, 'rgba(40,35,28,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(s / 2 + (Math.random() - 0.5) * 22, s / 2 + (Math.random() - 0.5) * 22, 3 + Math.random() * 5, 0, 7);
      ctx.fill();
    }
  });
}

function flashTexture() {
  return tex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,240,1)');
    g.addColorStop(0.25, 'rgba(255,214,140,0.95)');
    g.addColorStop(0.55, 'rgba(255,150,50,0.45)');
    g.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

function pickupTexture(color) {
  return tex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2 - 2);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

function rangoliTexture() {
  const colors = ['#ff9933', '#f2f0e8', '#138808', '#ff5722', '#e91e63', '#ffd54f'];
  return tex(256, (ctx, s) => {
    const cx = s / 2, cy = s / 2;
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      for (let r = 1; r <= 4; r++) {
        const pr = r * 24;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr, 8, 0, 7);
        ctx.fillStyle = colors[(i + r) % colors.length];
        ctx.fill();
      }
    }
    for (let r = 2; r <= 5; r++) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 24 + 6, 0, 7);
      ctx.strokeStyle = colors[r % colors.length];
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, 7);
    ctx.fillStyle = colors[0];
    ctx.fill();
  });
}

const FLAG_COLORS = [0xff9933, 0xf2f0e8, 0x138808, 0xe91e63, 0xff5722, 0xffd54f, 0x00bcd4, 0x8e24aa, 0xe53935];
const BUNTING_STRINGS = [
  { a: [-42, -9], b: [42, -9] },
  { a: [-42, 9], b: [42, 9] },
  { a: [-9, -42], b: [-9, 42] },
  { a: [9, -42], b: [9, 42] },
  { a: [-48, 32], b: [48, -32] },
  { a: [-34, -42], b: [34, 42] },
  { a: [-26, -16], b: [26, 16] },
];

export class World {
  constructor(scene) {
    this.scene = scene;
    this.collidables = [];
    this._raycaster = new THREE.Raycaster();
    this._tmpV = new THREE.Vector3();
    this.decalTex = decalTexture();
    this.flashTex = flashTexture();

    this.decals = [];
    this.shells = [];
    this.tracers = [];
    this.pickups = [];
    this._flashLines = [];
    this.bunting = [];

    this._build();
  }

  _mat(color, { rough = 0.9, metal = 0.0, em = null } = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    if (em) m.emissive = new THREE.Color(em);
    return m;
  }

  _addBox(x, y, z, w, h, d, mat, { penetrable = false, rotY = 0 } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.userData.penetrable = penetrable;
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    this.collidables.push(m);
    return m;
  }

  _build() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      this._mat(0x3b4230, { rough: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(220, 44, 0x4c5540, 0x333a26);
    grid.position.y = 0.03;
    this.scene.add(grid);

    const concrete = this._mat(0x6b7064, { rough: 0.85 });
    const wood = this._mat(0x8a6b3f, { rough: 0.8 });
    const metal = this._mat(0x4a4f55, { rough: 0.35, metal: 0.7 });

    const wall = 110;
    this._addBox(0, 4, -wall, 220, 8, 2, concrete);
    this._addBox(0, 4, wall, 220, 8, 2, concrete);
    this._addBox(-wall, 4, 0, 2, 8, 220, concrete);
    this._addBox(wall, 4, 0, 2, 8, 220, concrete);

    this._addBox(-10, 2, 0, 8, 4, 2, concrete);  // central divider, left half
    this._addBox(10, 2, 0, 8, 4, 2, concrete);   // central divider, right half (gap in middle)
    this._addBox(-30, 1.5, -20, 6, 3, 6, wood, { penetrable: true });
    this._addBox(-30, 3, -20, 6, 3, 6, wood, { penetrable: true, rotY: 0.5 });
    this._addBox(32, 1.5, 25, 8, 3, 8, wood, { penetrable: true });
    this._addBox(32, 3, 25, 8, 3, 8, wood, { penetrable: true, rotY: 0.4 });
    this._addBox(-45, 1.5, 40, 7, 3, 7, wood, { penetrable: true });
    this._addBox(48, 1.5, -38, 7, 3, 7, metal);
    this._addBox(-50, 1.5, -55, 9, 3, 9, wood, { penetrable: true });
    this._addBox(58, 1.5, 55, 9, 3, 9, metal);

    this._addBox(-5, 1, 35, 3, 2, 3, metal);
    this._addBox(12, 1, 38, 3, 2, 3, metal);
    this._addBox(-15, 1, -42, 4, 2, 4, wood, { penetrable: true });
    this._addBox(20, 1, -48, 4, 2, 4, wood, { penetrable: true });

    const lowWalls = [
      [-40, -10, 14, 1.4, 4],
      [40, -10, 14, 1.4, 4],
      [-30, 50, 14, 1.4, 4],
      [35, 40, 16, 1.4, 5],
      [8, -60, 18, 1.4, 5],
    ];
    for (const [x, z, w, h, d] of lowWalls) {
      this._addBox(x, h / 2, z, w, h, d, concrete);
    }

    this._buildFestive();
  }

  _buildFestive() {
    // central rangoli ground art
    const rangoli = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.MeshBasicMaterial({ map: rangoliTexture(), transparent: true, depthWrite: false })
    );
    rangoli.rotation.x = -Math.PI / 2;
    rangoli.position.set(0, 0.03, 0);
    this.scene.add(rangoli);

    // bunting: poles + sagging strings of triangle flags
    const flagShape = new THREE.Shape();
    flagShape.moveTo(-0.26, 0);
    flagShape.lineTo(0.26, 0);
    flagShape.lineTo(0, -0.34);
    flagShape.closePath();
    const flagGeo = new THREE.ShapeGeometry(flagShape);

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.4, metalness: 0.8 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x6a5400, roughness: 0.35, metalness: 0.9 });

    for (const s of BUNTING_STRINGS) {
      const h = 6.5;
      for (const [px, pz] of [s.a, s.b]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, h, 8), poleMat);
        pole.position.set(px, h / 2, pz);
        pole.castShadow = true;
        this.scene.add(pole);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), capMat);
        cap.position.set(px, h, pz);
        this.scene.add(cap);
      }

      const mid = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s.a[0], h, s.a[1]),
        new THREE.Vector3(mid[0], h + 2.4, mid[1]),
        new THREE.Vector3(s.b[0], h, s.b[1]),
      ]);
      const len = curve.getLength();
      const n = Math.max(2, Math.round(len / 1.6));
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const p = curve.getPointAt(t);
        const tg = curve.getTangentAt(t);
        const mat = new THREE.MeshBasicMaterial({ color: FLAG_COLORS[(i * 7 + Math.floor(t * n)) % FLAG_COLORS.length], side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, mat);
        flag.position.copy(p);
        flag.position.y -= 0.02;
        const dl = Math.hypot(tg.x, tg.z) || 1;
        flag.rotation.y = Math.atan2(-tg.z / dl, tg.x / dl);
        flag.userData.phase = i * 1.7 + (s.a[0] + s.a[1]) * 0.3;
        flag.userData.base = p.y;
        this.scene.add(flag);
        this.bunting.push(flag);
      }
    }
  }

  raycastSegment(a, b) {
    const d = this._tmpV.copy(b).sub(a);
    const len = d.length();
    if (len < 1e-6) return null;
    d.divideScalar(len);
    this._raycaster.set(a, d);
    this._raycaster.far = len;
    const hits = this._raycaster.intersectObjects(this.collidables, false);
    if (!hits.length) return null;
    const h = hits[0];
    return { t: h.distance, point: h.point, normal: h.face ? h.face.normal.clone() : new THREE.Vector3(0, 1, 0), mesh: h.object };
  }

  addDecal(point, normal, scale = 0.4) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.decalTex, transparent: true, depthWrite: false, opacity: 1 })
    );
    s.position.copy(point).addScaledVector(normal, 0.02);
    s.scale.set(scale, scale, 1);
    s.frustumCulled = false;
    this.scene.add(s);
    this.decals.push({ sprite: s, life: 14 });
    while (this.decals.length > 55) {
      this.scene.remove(this.decals.shift().sprite);
    }
  }

  addMuzzleFlash(position, scale = 0.9) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1 })
    );
    s.position.copy(position);
    s.scale.set(scale, scale, 1);
    s.frustumCulled = false;
    this.scene.add(s);
    this._flashLines.push({ sprite: s, life: 0.045 });
  }

  addShell(pos, dir) {
    const g = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8a33c, metalness: 0.9, roughness: 0.3 })
    );
    g.position.copy(pos);
    g.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    g.userData.vel = new THREE.Vector3(dir.x * 2.2, 2.6 + Math.random() * 1.2, dir.z * 2.2);
    g.userData.life = 3.2;
    this.scene.add(g);
    this.shells.push(g);
    while (this.shells.length > 26) this.scene.remove(this.shells.shift());
  }

  addTracer(a, b, color = 0xfff2a8) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(
      g,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    l.frustumCulled = false;
    this.scene.add(l);
    this.tracers.push({ line: l, life: 0.12 });
    while (this.tracers.length > 48) this.scene.remove(this.tracers.shift().line);
  }

  addPickup(x, z, kind) {
    const color = kind === 'health' ? 'rgba(60,220,90,0.9)' : 'rgba(90,160,255,0.9)';
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: pickupTexture(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    s.position.set(x, 1.1, z);
    s.scale.set(0.9, 0.9, 1);
    s.frustumCulled = false;
    this.scene.add(s);
    this.pickups.push({ sprite: s, kind, t: 0, life: 20 });
  }

  update(dt, time) {
    for (const f of this.bunting) {
      f.rotation.z = Math.sin(time * 4.5 + f.userData.phase) * 0.09;
      f.position.y = f.userData.base + Math.abs(Math.sin(time * 3.2 + f.userData.phase)) * 0.06;
    }
    for (let i = this._flashLines.length - 1; i >= 0; i--) {
      const f = this._flashLines[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.sprite);
        f.sprite.material.dispose();
        this._flashLines.splice(i, 1);
      } else {
        f.sprite.material.opacity = f.life / 0.045;
      }
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.scene.remove(d.sprite);
        d.sprite.material.dispose();
        this.decals.splice(i, 1);
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    const grav = 18;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.userData.vel.y -= grav * dt;
      s.position.addScaledVector(s.userData.vel, dt);
      s.rotation.x += dt * 14;
      s.rotation.z += dt * 11;
      s.userData.life -= dt;
      if (s.userData.life <= 0 || s.position.y < 0.05) {
        if (s.position.y < 0.05) s.position.y = 0.025;
        s.userData.life -= dt;
        if (s.userData.life < 0) {
          this.scene.remove(s);
          s.geometry.dispose();
          s.material.dispose();
          this.shells.splice(i, 1);
        }
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t += dt;
      p.life -= dt;
      p.sprite.position.y = 1.1 + Math.sin(p.t * 3) * 0.12;
      if (p.life <= 0) {
        this.scene.remove(p.sprite);
        p.sprite.material.dispose();
        this.pickups.splice(i, 1);
      }
    }
  }

  collectPickups(playerPos) {
    const collected = [];
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      const dx = p.sprite.position.x - playerPos.x;
      const dz = p.sprite.position.z - playerPos.z;
      if (dx * dx + dz * dz < 1.6) {
        collected.push(p.kind);
        this.scene.remove(p.sprite);
        p.sprite.material.dispose();
        this.pickups.splice(i, 1);
      }
    }
    return collected;
  }
}

export { UP };
