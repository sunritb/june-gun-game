import * as THREE from 'three';
import { UP } from './world.js';

export class Player {
  constructor(camera, audio) {
    this.camera = camera;
    this.audio = audio;
    this.pos = new THREE.Vector3(-14, 1.7, 12);
    this.vel = new THREE.Vector3();
    this.yaw = -0.86;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.eye = 1.7;
    this.eyeTarget = 1.7;
    this.onGround = true;
    this.crouching = false;
    this.shake = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 50;
    this.dead = false;
    this.moving = false;
    this.grounded = true;
    this._f = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this._bobPhase = 0;
    this._bobBlend = 0;
    this._prevBobSin = 0;
  }

  reset() {
    this.pos.set(-14, this.eye, 12);
    this.vel.set(0, 0, 0);
    this.yaw = -0.86;
    this.pitch = 0;
    this.health = this.maxHealth;
    this.armor = 50;
    this.dead = false;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.shake = 0;
  }

  addRecoil(pitch, yaw) {
    this.recoilPitch += pitch;
    this.recoilYaw += yaw;
  }

  damage(amount) {
    if (this.dead) return;
    const absorbed = Math.min(this.armor, amount * 0.5);
    this.armor -= absorbed;
    this.health -= Math.round(amount - absorbed);
    this.shake = Math.min(1, this.shake + 0.5);
    this.audio.hurt();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  armorUp(amount) {
    this.armor = Math.min(100, this.armor + amount);
  }

  update(dt, input, step = 1) {
    this.moving = false;
    if (this.dead) {
      this.vel.multiplyScalar(0.85);
      this.pos.addScaledVector(this.vel, dt);
      this._applyCamera(dt);
      return;
    }

    this.crouching = input.crouch();
    this.eyeTarget = this.crouching ? 1.1 : 1.7;
    this.eye += (this.eyeTarget - this.eye) * Math.min(1, dt * 10);

    const sprint = input.sprint() && !this.crouching && input.moveForward();
    let speed = sprint ? 10.5 : this.crouching ? 3.2 : 7.2;

    this._f.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._r.copy(this._f).cross(UP);

    this._wish.set(0, 0, 0);
    if (input.moveForward()) this._wish.add(this._f);
    if (input.moveBack()) this._wish.sub(this._f);
    if (input.moveRight()) this._wish.add(this._r);
    if (input.moveLeft()) this._wish.sub(this._r);
    if (this._wish.lengthSq() > 0) {
      this._wish.normalize().multiplyScalar(speed);
      this.moving = true;
    }

    const accel = this.onGround ? 40 : 8;
    const k = Math.min(1, accel * dt);
    this.vel.x += (this._wish.x - this.vel.x) * k;
    this.vel.z += (this._wish.z - this.vel.z) * k;

    if (this.onGround && input.jump()) {
      this.vel.y = 7.2;
      this.onGround = false;
    }

    this.vel.y -= 20 * dt;
    this.pos.addScaledVector(this.vel, dt * step);

    if (this.pos.y <= this.eye) {
      this.pos.y = this.eye;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);

    // footsteps + head bob (synced so each footfall lands on a bob swing)
    const bobbing = this.onGround && this.moving;
    if (bobbing) this._bobPhase += dt * (sprint ? 11 : 7.5);
    this._bobBlend += ((bobbing ? 1 : 0) - this._bobBlend) * Math.min(1, dt * 8);
    const bobSin = Math.sin(this._bobPhase);
    if (bobbing && this._prevBobSin <= 0 && bobSin > 0) {
      this.audio.footstep(sprint ? 0.42 : 0.32);
    }
    this._prevBobSin = bobSin;

    this._applyCamera(dt);
  }

  _applyCamera(dt) {
    const recover = 1 - Math.min(1, dt * 12);
    this.recoilPitch *= recover;
    this.recoilYaw *= recover;

    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.05 : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.05 : 0;

    this.camera.position.set(this.pos.x, this.eye, this.pos.z);
    const bb = this._bobBlend;
    this.camera.position.y += Math.sin(this._bobPhase) * 0.035 * bb;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw + this.recoilYaw + sx;
    this.camera.rotation.x = this.pitch + this.recoilPitch + sy + Math.sin(this._bobPhase) * 0.008 * bb;
  }
}
