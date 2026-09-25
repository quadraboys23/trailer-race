import Phaser from 'phaser';
import { Physics, PX_PER_M, mToPx } from '../physics.js';
import { cfg } from '../config.js';
import { TRACK, TRACK_BOUNDS, PERIMETER, sampleLine, segmentAt } from '../track.js';
import { Rig, TRUCK, TRAILER, stiffnessForLooseness } from '../rig.js';

const VIEW_W = 540;
const VIEW_H = 960;

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
};

export default class PlayScene extends Phaser.Scene {
  constructor() {
    super('play');
  }

  create() {
    this.physics2 = new Physics();
    this.rig = new Rig(this.physics2.world);
    this.simTime = 0; // seconds of physics stepped since the scene started
    if (window.__trailer) window.__trailer.scene = this;
    else window.__trailer = { scene: this };

    this.drawTrack();

    this.rigGfx = this.add.graphics().setDepth(10);

    this.overview = false;
    this.peakYaw = 0;
    this.cameras.main.setBackgroundColor(COL.infield);

    this.hud = this.add
      .text(12, 12, '', { fontFamily: 'monospace', fontSize: '18px', color: '#c8d0da' })
      .setScrollFactor(0)
      .setDepth(100);

    // The HUD gets its own unzoomed camera; otherwise the overview zoom shrinks
    // it to an unreadable smudge. Each camera ignores the other's objects.
    this.uiCam = this.cameras.add(0, 0, VIEW_W, VIEW_H).setName('ui');
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
      const zx = VIEW_W / (mToPx(TRACK_BOUNDS.halfW) * 2 + 40);
      const zy = VIEW_H / (mToPx(TRACK_BOUNDS.halfH) * 2 + 40);
      cam.setZoom(Math.min(zx, zy));
      cam.centerOn(0, 0);
    } else {
      cam.setZoom(1);
    }
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
    this.physics2.step(delta, (dt) => {
      this.rig.step(dt);
      this.simTime += dt;
    });
    this.drawRig();

    const cam = this.cameras.main;
    const t = this.rig.truck.translation();
    if (!this.overview) cam.centerOn(mToPx(t.x), mToPx(t.y));

    const tp = this.rig.pose();
    const yaw = Phaser.Math.RadToDeg(
      Phaser.Math.Angle.Wrap(tp.angle - this.rig.truck.rotation())
    );
    // Slowly-decaying peak: makes a swing legible at a glance on the phone.
    this.peakYaw = Math.max(Math.abs(yaw), this.peakYaw * 0.995);
    this.hud.setText(
      [
        `${Math.round(this.game.loop.actualFps)} fps`,
        `trailer speed ${cfg.trailerSpeed.toFixed(1)} m/s`,
        `hitch loose   ${cfg.hitchLoose.toFixed(2)}`,
        `tyre stiff    ${Math.round(stiffnessForLooseness(cfg.hitchLoose))} N/rad`,
        `hitch yaw     ${yaw.toFixed(1)}deg`,
        `peak yaw      ${this.peakYaw.toFixed(1)}deg`,
        `lap           ${(this.rig.s / PERIMETER).toFixed(2)}`,
      ].join('\n')
    );
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
    };
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
