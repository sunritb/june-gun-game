const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      crosshair: $('crosshair'),
      dot: $('crosshair').querySelector('.dot'),
      bars: Array.from($('crosshair').querySelectorAll('.bar')),
      hitmarker: $('hitmarker'),
      damage: $('damage'),
      minimap: $('minimap'),
      minimapCtx: $('minimap').getContext('2d'),
      kills: $('killsVal'),
      wave: $('waveVal'),
      enemiesLeft: $('enemiesLeft'),
      healthFill: $('healthFill'),
      healthVal: $('healthVal'),
      armorFill: $('armorFill'),
      armorVal: $('armorVal'),
      mag: $('magVal'),
      res: $('resVal'),
      weaponName: $('weaponName'),
      reloadHint: $('reloadHint'),
      killfeed: $('killfeed'),
      banner: $('banner'),
      overlayStart: $('overlayStart'),
      overlayDeath: $('overlayDeath'),
      overlayPause: $('overlayPause'),
      deathStats: $('deathStats'),
      btnStart: $('btnStart'),
      btnResume: $('btnResume'),
      btnRespawn: $('btnRespawn'),
    };
    this.hitmarkerT = 0;
    this.hitmarkerKill = false;
    this.damageFlash = 0;
    this._barGap = 6;
    this._bannerTimer = 0;
  }

  start(fn) { this.el.btnStart.addEventListener('click', fn); }
  resume(fn) { this.el.btnResume.addEventListener('click', fn); }
  respawn(fn) { this.el.btnRespawn.addEventListener('click', fn); }

  showStart() { this.el.overlayStart.classList.remove('hidden'); }
  hideStart() { this.el.overlayStart.classList.add('hidden'); }
  showPause() { this.el.overlayPause.classList.remove('hidden'); }
  hidePause() { this.el.overlayPause.classList.add('hidden'); }
  showDeath(kills, wave) {
    this.el.deathStats.textContent = `${kills} KILLS · WAVE ${wave}`;
    this.el.overlayDeath.classList.remove('hidden');
  }
  hideDeath() { this.el.overlayDeath.classList.add('hidden'); }

  hitmarker(kill = false) {
    this.hitmarkerT = 0.13;
    this.hitmarkerKill = kill;
  }

  damage(amount) {
    this.damageFlash = Math.min(1, this.damageFlash + Math.min(0.9, amount / 40));
  }

  banner(text, dur = 2.4) {
    this.el.banner.textContent = text;
    this.el.banner.classList.remove('show');
    void this.el.banner.offsetWidth;
    this.el.banner.classList.add('show');
    this._bannerTimer = dur;
  }

  killfeed(text) {
    const d = document.createElement('div');
    d.className = 'entry';
    d.textContent = text;
    this.el.killfeed.appendChild(d);
    setTimeout(() => d.remove(), 3000);
    while (this.el.killfeed.children.length > 4) this.el.killfeed.firstChild.remove();
  }

  update(dt, s) {
    this.hitmarkerT -= dt;
    this.el.hitmarker.style.opacity = this.hitmarkerT > 0 ? (this.hitmarkerT / 0.13) : '0';
    this.el.hitmarker.classList.toggle('kill', this.hitmarkerKill);

    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.4);
    this.el.damage.style.opacity = this.damageFlash * 0.9;

    const gap = 6 + s.spread * 1600;
    const off = Math.round(gap);
    this.el.bars[0].style.transform = `translateX(${-off}px)`;
    this.el.bars[1].style.transform = `translateX(${off}px)`;
    this.el.bars[2].style.transform = `translateY(${-off}px)`;
    this.el.bars[3].style.transform = `translateY(${off}px)`;
    this.el.crosshair.classList.toggle('damaged', this.damageFlash > 0.15);

    this.el.healthFill.style.width = `${(s.health / s.maxHealth) * 100}%`;
    this.el.healthVal.textContent = Math.ceil(s.health);
    this.el.armorFill.style.width = `${(s.armor / 100) * 100}%`;
    this.el.armorVal.textContent = Math.ceil(s.armor);

    this.el.mag.textContent = s.mag;
    this.el.mag.classList.toggle('low', s.mag <= 5);
    this.el.mag.classList.toggle('empty', s.mag <= 0);
    this.el.res.textContent = `/ ${s.reserve}`;
    this.el.weaponName.textContent = s.weaponName;
    this.el.reloadHint.classList.toggle('hidden', !s.reloading);

    this.el.kills.textContent = s.kills;
    this.el.wave.textContent = s.wave;
    this.el.enemiesLeft.textContent = s.aliveEnemies;

    this._minimap(s);
  }

  _minimap(s) {
    const ctx = this.el.minimapCtx;
    const size = 156;
    const scale = size / 220;
    const px = s.playerPos.x * scale + size / 2;
    const pz = s.playerPos.z * scale + size / 2;

    ctx.fillStyle = '#0d130b';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(126,231,135,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 220; i += 22) {
      const v = i * scale;
      ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(size, v); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(126,231,135,0.5)';
    ctx.strokeRect(0, 0, size, size);

    for (const e of s.enemies) {
      const ex = e.x * scale + size / 2;
      const ez = e.z * scale + size / 2;
      ctx.fillStyle = e.alive ? '#ff5544' : 'rgba(255,85,68,0.25)';
      ctx.beginPath(); ctx.arc(ex, ez, 3, 0, 7); ctx.fill();
    }

    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-s.playerYaw);
    ctx.fillStyle = '#7ee787';
    ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(4, 5); ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(size / 2, size / 2, 30, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(size / 2, size / 2, 60, 0, 7); ctx.stroke();
  }
}
