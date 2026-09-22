import Phaser from 'phaser';
import { Physics, RAPIER, PX_PER_M, mToPx } from '../physics.js';

// M1 scaffold: proves Phaser renders, Rapier's WASM loaded and the fixed step runs.
// The box and walls below are throwaway — M2 replaces them with the track and truck.

const FIELD_W_M = 540 / PX_PER_M;
const FIELD_H_M = 960 / PX_PER_M;
const BOX_M = 1.6;

export default class PlayScene extends Phaser.Scene {
  constructor() {
    super('play');
  }

  create() {
    this.physics2 = new Physics();
    const world = this.physics2.world;

    // Four static walls around the visible field.
    const wall = (x, y, hw, hh) => {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y));
      world.createCollider(RAPIER.ColliderDesc.cuboid(hw, hh).setRestitution(1).setFriction(0), body);
    };
    const t = 1;
    wall(FIELD_W_M / 2, -t, FIELD_W_M / 2, t);
    wall(FIELD_W_M / 2, FIELD_H_M + t, FIELD_W_M / 2, t);
    wall(-t, FIELD_H_M / 2, t, FIELD_H_M / 2);
    wall(FIELD_W_M + t, FIELD_H_M / 2, t, FIELD_H_M / 2);

    // One dynamic box, launched diagonally. If it moves, the whole chain works.
    this.boxBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(FIELD_W_M / 2, FIELD_H_M / 2)
        .setLinvel(9, 13)
        .setAngvel(1.5)
        .setLinearDamping(0)
        .setAngularDamping(0)
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(BOX_M / 2, BOX_M / 2).setRestitution(1).setFriction(0).setDensity(1),
      this.boxBody
    );

    this.boxGfx = this.add.rectangle(0, 0, mToPx(BOX_M), mToPx(BOX_M), 0xe8503a).setOrigin(0.5);

    this.add
      .text(270, 60, 'TRAILER RACE\nM1 scaffold', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#7f8a99',
        align: 'center',
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(270, 880, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#7f8a99',
        align: 'center',
      })
      .setOrigin(0.5);

    // Touch check: a tap kicks the box toward the pointer, so the phone's input path is proven too.
    this.input.on('pointerdown', (p) => {
      const to = this.boxBody.translation();
      const dx = p.worldX / PX_PER_M - to.x;
      const dy = p.worldY / PX_PER_M - to.y;
      const len = Math.hypot(dx, dy) || 1;
      this.boxBody.applyImpulse({ x: (dx / len) * 6, y: (dy / len) * 6 }, true);
      this.taps = (this.taps ?? 0) + 1;
    });
  }

  update(_time, delta) {
    this.physics2.step(delta);

    const p = this.boxBody.translation();
    this.boxGfx.setPosition(mToPx(p.x), mToPx(p.y));
    this.boxGfx.setRotation(this.boxBody.rotation());

    this.statusText.setText(
      `rapier ok · ${Math.round(this.game.loop.actualFps)} fps · taps ${this.taps ?? 0}\ntap to kick the box`
    );
  }
}
