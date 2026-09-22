import Phaser from 'phaser';
import { initRapier } from './physics.js';
import PlayScene from './scenes/PlayScene.js';

// Portrait design resolution. Phaser FITs it to whatever the phone gives us.
const WIDTH = 540;
const HEIGHT = 960;

async function boot() {
  await initRapier();

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#2f3a2c',
    width: WIDTH,
    height: HEIGHT,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Rapier owns all physics. Phaser's own engines stay off.
    physics: undefined,
    scene: [PlayScene],
  });
}

boot().catch((err) => {
  document.getElementById('game').innerHTML =
    `<pre style="color:#e8503a;padding:16px;white-space:pre-wrap">boot failed:\n${err?.stack ?? err}</pre>`;
});
