import Phaser from 'phaser';
import { Physics, PX_PER_M, mToPx } from '../physics.js';
import { cfg, syncUrl } from '../config.js';
import { TRACK, TRACK_BOUNDS, PERIMETER, sampleLine, segmentAt, project } from '../track.js';
import { Rig, TRUCK, TRAILER } from '../rig.js';
import { Car, CAR } from '../car.js';

const COL = {
  asphalt: 0x3a3f47,
  infield: 0x2f3a2c,
  line: 0x6d7683,
  truck: 0x4a78c4,
  cab: 0x2f5596,
  deck: 0x8a6a42,
  deckEdge: 0xb08a55,
  ramp: 0xd8a441,
  headboard: 0xc25a3a,
  drawbar: 0x555b64,
  car: 0xd8433a,
  carGlass: 0x5a2420,
  brakeLight: 0xff2a1a,
  tailLight: 0x6a1f1a,
};

export default class PlayScene extends Phaser.Scene {
  constructor() {
    super('play');
  }

  create() {
    this.physics2 = new Physics();
    this.rig = new Rig(this.physics2.world);
    this.car = new Car(this.physics2.world);
    this.carProgress = 0; // metres along the racing line, unwrapped
    this.carLastS = project(this.car.pose().x, this.car.pose().y).s;
    this.contactFrames = 0; // physics steps the car spent touching the truck or headboard
    this.simTime = 0; // seconds of physics stepped since the scene started
    window.__trailer = { ...window.__trailer, scene: this };
    // Harness/debug hooks, called by capture scenarios as { call: 'parkCar' } etc.
    window.__trailer.parkCar = () => this.car.park();
    window.__trailer.placeCar = (opts) => this.car.place(opts);

    this.drawTrack();

    this.rigGfx = this.add.graphics().setDepth(10);
    this.carGfx = this.add.graphics().setDepth(20);

    this.overview = false;
    this.peakYaw = 0;
    this.cameras.main.setBackgroundColor(COL.infield);

    this.hud = this.add
      .text(12, 12, '', { fontFamily: 'monospace', fontSize: '18px', color: '#c8d0da' })
      .setScrollFactor(0)
      .setDepth(100);

    // The HUD gets its own unzoomed camera; otherwise the overview zoom shrinks
    // it to an unreadable smudge. Each camera ignores the other's objects.
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height).setName('ui');
    this.uiCam.ignore(this.children.list.filter((o) => o !== this.hud));
    this.cameras.main.ignore(this.hud);

    // Overview is the button top-right or the Z key. Deliberately NOT a tap on
    // the play area: that becomes the steering input in M3.
    this.overviewBtn = document.getElementById('overview');
    this.overviewBtn?.addEventListener('click', () => {
      this.toggleOverview();
      // Drop focus, or the next Space (the brake, from M3) would click it again.
      this.overviewBtn.blur();
    });
    this.input.keyboard?.on('keydown-Z', () => this.toggleOverview());

    this.setupControls();

    this.applyCamera();
  }

  toggleOverview() {
    this.overview = !this.overview;
    this.overviewBtn?.setAttribute('aria-pressed', String(this.overview));
    this.applyCamera();
  }

  applyCamera() {
    const cam = this.cameras.main;
    if (this.overview) {
      const zx = this.scale.width / (mToPx(TRACK_BOUNDS.halfW) * 2 + 40);
      const zy = this.scale.height / (mToPx(TRACK_BOUNDS.halfH) * 2 + 40);
      cam.setZoom(Math.min(zx, zy));
      cam.centerOn(0, 0);
    } else {
      cam.setZoom(1);
    }
  }

  /**
   * Touch: the first finger down steers (drag-to-point); any other finger held
   * anywhere brakes. Mouse drag steers too. Keyboard: arrows steer, space
   * brakes, T toggles distance throttle (debug).
   */
  setupControls() {
    this.input.addPointer(1); // two touch pointers: steer + brake
    this.steerPointerId = null;
    this.input.on('pointerdown', (p) => {
      if (this.steerPointerId === null) this.steerPointerId = p.id;
    });
    const release = (p) => {
      if (p.id === this.steerPointerId) this.steerPointerId = null;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    const kb = this.input.keyboard;
    this.keys = kb?.addKeys({ left: 'LEFT', right: 'RIGHT', brake: 'SPACE' });
    kb?.on('keydown-T', () => {
      cfg.distanceThrottle = !cfg.distanceThrottle;
      syncUrl();
    });
  }

  /** Controls for this step, from whatever is held right now. */
  readControls() {
    const down = this.input.manager.pointers.filter((p) => p.isDown);
    const steer = down.find((p) => p.id === this.steerPointerId);
    let target = null;
    if (steer) {
      const w = this.cameras.main.getWorldPoint(steer.x, steer.y);
      target = { x: w.x / PX_PER_M, y: w.y / PX_PER_M };
    }
    const k = this.keys;
    const steerAxis = (k?.right.isDown ? 1 : 0) - (k?.left.isDown ? 1 : 0);
    const brake = down.some((p) => p.id !== this.steerPointerId) || !!k?.brake.isDown;
    this.controls = { target, steerAxis, brake };
    return this.controls;
  }

  /** World metres -> CSS pixels in the page, for the capture harness's synthetic touches. */
  toScreen(xm, ym) {
    const cam = this.cameras.main;
    const gx = (mToPx(xm) - cam.worldView.x) * cam.zoom + cam.x;
    const gy = (mToPx(ym) - cam.worldView.y) * cam.zoom + cam.y;
    const r = this.game.canvas.getBoundingClientRect();
    return { x: r.left + (gx * r.width) / this.scale.width, y: r.top + (gy * r.height) / this.scale.height };
  }

  /** Solid bodies the car can hit. Deck is a sensor and doesn't count. */
  carTouchingRig() {
    const w = this.physics2.world;
    let touching = false;
    for (const other of [this.rig.truckCollider, this.rig.headboardCollider]) {
      w.contactPair(this.car.collider, other, (manifold) => {
        if (manifold.numContacts() > 0) touching = true;
      });
    }
    return touching;
  }

  /** Asphalt is drawn once: outer polygon filled, then the infield punched back out. */
  drawTrack() {
    const g = this.add.graphics().setDepth(0);
    const half = TRACK.width / 2;
    const STEP = 1.5; // metres between samples

    const outer = [];
    const inner = [];
    for (let s = 0; s < PERIMETER; s += STEP) {
      const p = sampleLine(s);
      const rx = -Math.sin(p.angle);
      const ry = Math.cos(p.angle);
      outer.push(new Phaser.Math.Vector2(mToPx(p.x + rx * half), mToPx(p.y + ry * half)));
      inner.push(new Phaser.Math.Vector2(mToPx(p.x - rx * half), mToPx(p.y - ry * half)));
    }

    g.fillStyle(COL.asphalt, 1);
    g.fillPoints(outer, true);
    g.fillStyle(COL.infield, 1);
    g.fillPoints(inner, true);

    // Dashed racing line down the middle.
    g.lineStyle(2, COL.line, 0.5);
    for (let s = 0; s < PERIMETER; s += 8) {
      const a = sampleLine(s);
      const b = sampleLine(s + 4);
      g.lineBetween(mToPx(a.x), mToPx(a.y), mToPx(b.x), mToPx(b.y));
    }
  }

  update(_time, delta) {
    const ctl = this.readControls();
    this.physics2.step(delta, (dt) => {
      this.rig.step(dt);
      this.car.step(dt, ctl);
      this.simTime += dt;
    }, () => this.afterStep());
    this.drawRig();
    this.drawCar();

    const cam = this.cameras.main;
    // Follow the car; with the car parked (rig-only captures), follow the truck.
    const f = this.car.parked ? this.rig.truck.translation() : this.car.pose();
    if (!this.overview) cam.centerOn(mToPx(f.x), mToPx(f.y));

    const tp = this.rig.pose();
    const yaw = Phaser.Math.RadToDeg(
      Phaser.Math.Angle.Wrap(tp.angle - this.rig.truck.rotation())
    );
    // Slowly-decaying peak: makes a swing legible at a glance on the phone.
    this.peakYaw = Math.max(Math.abs(yaw), this.peakYaw * 0.995);
    this.hud.setText(
      [
        `${Math.round(this.game.loop.actualFps)} fps  ${cfg.distanceThrottle ? 'DISTANCE throttle' : 'auto throttle'}`,
        `speed   ${this.car.speed().toFixed(1)} m/s  (trailer ${cfg.trailerSpeed.toFixed(1)})`,
        `brake   ${this.car.braking ? 'ON' : '-'}${this.car.sliding ? '   SLIDING' : ''}`,
        `lap     ${(this.carProgress / PERIMETER).toFixed(2)}`,
        `hitch   ${yaw.toFixed(1)}deg  peak ${this.peakYaw.toFixed(1)}  loose ${cfg.hitchLoose.toFixed(2)}`,
      ].join('\n')
    );
  }

  /** Bookkeeping after each physics step: lap progress and rig contacts. */
  afterStep() {
    const cp = this.car.pose();
    const s = project(cp.x, cp.y).s;
    let ds = s - this.carLastS;
    if (ds > PERIMETER / 2) ds -= PERIMETER;
    if (ds < -PERIMETER / 2) ds += PERIMETER;
    this.carProgress += ds;
    this.carLastS = s;
    if (this.carTouchingRig()) this.contactFrames += 1;
  }

  /** Plain-number snapshot of everything the HUD shows, for `npm run capture`. */
  getState() {
    const tr = this.rig.truck.translation();
    const tp = this.rig.pose();
    const yaw = Phaser.Math.Angle.Wrap(tp.angle - this.rig.truck.rotation());
    return {
      t: +this.simTime.toFixed(4),
      overview: this.overview,
      lap: this.rig.s / PERIMETER,
      segment: segmentAt(this.rig.s),
      truck: { x: tr.x, y: tr.y, angle: this.rig.truck.rotation() },
      trailer: { x: tp.x, y: tp.y, angle: tp.angle },
      hitchYawDeg: Phaser.Math.RadToDeg(yaw),
      peakYawDeg: this.peakYaw,
      car: this.carState(),
    };
  }

  carState() {
    const cp = this.car.pose();
    const v = this.car.body.linvel();
    const pr = project(cp.x, cp.y);
    const c = this.controls ?? {};
    return {
      x: cp.x,
      y: cp.y,
      angle: cp.angle,
      angvel: this.car.body.angvel(),
      speed: this.car.speed(),
      vx: v.x,
      vy: v.y,
      targetSpeed: this.car.targetSpeed,
      braking: this.car.braking,
      sliding: this.car.sliding,
      laps: this.carProgress / PERIMETER,
      trackOffset: pr.offset,
      onAsphalt: Math.abs(pr.offset) <= TRACK.width / 2 - CAR.wid / 2,
      contactFrames: this.contactFrames,
      steerTarget: c.target ?? null,
      steerAxis: c.steerAxis ?? 0,
      distanceThrottle: cfg.distanceThrottle,
    };
  }

  drawCar() {
    const g = this.carGfx;
    g.clear();
    const p = this.car.pose();
    const hl = CAR.len / 2;
    const hw = CAR.wid / 2;
    g.save();
    g.translateCanvas(mToPx(p.x), mToPx(p.y));
    g.rotateCanvas(p.angle);
    const rect = (x0, y0, x1, y1, c) => {
      g.fillStyle(c, 1);
      g.fillRect(mToPx(x0), mToPx(y0), mToPx(x1 - x0), mToPx(y1 - y0));
    };
    rect(-hl, -hw, hl, hw, COL.car);
    rect(0.2, -hw + 0.2, 1.1, hw - 0.2, COL.carGlass); // windscreen
    // Tail lights, bright and oversized while braking so it reads on a phone.
    const lit = this.car.braking;
    const tl = lit ? 0.5 : 0.25;
    rect(-hl - (lit ? 0.2 : 0), -hw, -hl + tl, -hw + 0.5, lit ? COL.brakeLight : COL.tailLight);
    rect(-hl - (lit ? 0.2 : 0), hw - 0.5, -hl + tl, hw, lit ? COL.brakeLight : COL.tailLight);
    g.restore();
  }

  drawRig() {
    const g = this.rigGfx;
    g.clear();

    const box = (body, lx, ly, hw, hh, colour, alpha = 1) => {
      const t = body.translation();
      const a = body.rotation();
      const cx = mToPx(t.x + lx * Math.cos(a) - ly * Math.sin(a));
      const cy = mToPx(t.y + lx * Math.sin(a) + ly * Math.cos(a));
      g.save();
      g.translateCanvas(cx, cy);
      g.rotateCanvas(a);
      g.fillStyle(colour, alpha);
      g.fillRect(-mToPx(hw), -mToPx(hh), mToPx(hw * 2), mToPx(hh * 2));
      g.restore();
    };

    // Drawbar from the hitch to the deck.
    const tr = this.rig.truck.translation();
    const ta = this.rig.truck.rotation();
    const hx = mToPx(tr.x + TRUCK.hitchX * Math.cos(ta));
    const hy = mToPx(tr.y + TRUCK.hitchX * Math.sin(ta));
    const dp = this.rig.trailer.translation();
    const da = this.rig.trailer.rotation();
    g.lineStyle(5, COL.drawbar, 1);
    g.lineBetween(
      hx,
      hy,
      mToPx(dp.x + TRAILER.drawbarX * Math.cos(da)),
      mToPx(dp.y + TRAILER.drawbarX * Math.sin(da))
    );

    // Deck (sensor — drawn, but nothing to bump into on the sides).
    box(this.rig.trailer, 0, 0, TRAILER.deckHalfLen, TRAILER.deckHalfWid, COL.deck);
    // Rear ramp edge: the only way on.
    box(this.rig.trailer, -TRAILER.deckHalfLen + 0.25, 0, 0.25, TRAILER.deckHalfWid, COL.ramp);
    // Solid headboard.
    box(this.rig.trailer, TRAILER.headboardX, 0, TRAILER.headboardHalf, TRAILER.deckHalfWid, COL.headboard);

    // Truck.
    box(this.rig.truck, 0, 0, TRUCK.len / 2, TRUCK.wid / 2, COL.truck);
    box(this.rig.truck, 0.9, 0, 1.1, TRUCK.wid / 2 - 0.15, COL.cab);
  }
}
