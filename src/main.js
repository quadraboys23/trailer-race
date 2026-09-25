import Phaser from 'phaser';
import { initRapier, FIXED_DT } from './physics.js';
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
  window.__trailer = { ...window.__trailer, game, cfg };

  // Capture mode (`?capture=1`, used by `npm run capture`): the real-time loop
  // is put to sleep and the harness steps the game one fixed frame at a time,
  // so every capture of the same script is identical regardless of how fast
  // headless Chromium happens to render.
  if (new URLSearchParams(window.location.search).get('capture') === '1') {
    // Phaser starts its loop just AFTER emitting 'ready', so sleeping there is
    // undone at once. Sleep after the first real step instead, and re-assert it
    // on every advance in case a visibility change woke the loop.
    game.events.once('poststep', () => {
      game.loop.sleep();
      let t = game.loop.time;
      const frameMs = 1000 * FIXED_DT;
      window.__trailer.advance = (frames) => {
        if (game.loop.running) game.loop.sleep();
        const states = [];
        for (let i = 0; i < frames; i++) {
          t += frameMs;
          game.step(t, frameMs);
          const scene = window.__trailer.scene;
          if (scene?.getState) states.push(scene.getState());
        }
        return states;
      };
    });
  }
}

boot().catch((err) => {
  document.getElementById('game').innerHTML =
    `<pre style="color:#e8503a;padding:16px;white-space:pre-wrap">boot failed:\n${err?.stack ?? err}</pre>`;
});
