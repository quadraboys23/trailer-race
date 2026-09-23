import Phaser from 'phaser';
import { initRapier } from './physics.js';
import { cfg } from './config.js';
import PlayScene from './scenes/PlayScene.js';

// Portrait design resolution. Phaser FITs it to whatever the phone gives us.
const WIDTH = 540;
const HEIGHT = 960;

async function boot() {
  await initRapier();

  const game = new Phaser.Game({
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

  // Debug handle: lets a console (or a browser-automation check) read the live
  // config and scene without a panel. Harmless, and the debug panel lands in M5.
  window.__trailer = { game, cfg };
}

boot().catch((err) => {
  document.getElementById('game').innerHTML =
    `<pre style="color:#e8503a;padding:16px;white-space:pre-wrap">boot failed:\n${err?.stack ?? err}</pre>`;
});
