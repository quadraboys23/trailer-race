// npm run capture -- <filter> [key=value ...]
//
// Runs scripted scenarios against the real game in headless Chromium at
// 390x844 portrait and writes, per scenario:
//   captures/<milestone>/<name>.png   contact sheet of frames
//   captures/<milestone>/<name>.json  summary metrics + per-step state trace
//
// <filter> picks scenarios in scripts/scenarios/ whose file name starts with it
// ("m2", "m2-hitch", or a full name). No filter runs them all. Extra key=value
// pairs are added to every scenario's URL params, e.g. `hitchLoose=0.7`.
//
// The game runs in capture mode (`?capture=1`): its loop sleeps and this script
// steps it one fixed 1/60s frame at a time, so a capture is deterministic.
//
// Scenario module shape (default export):
//   milestone   'm2'
//   name        'hitch-loose-1'
//   title       one line for the sheet header
//   params      URL query params, e.g. { hitchLoose: 1 }
//   duration    seconds of game time to run
//   frames      [seconds...] when to screenshot, or { every: seconds, from?, to? }
//   input       [{ t, ...action }] actions, applied at the first frame >= t:
//                 { touch: [{ id, x, y }] }   the full set of fingers now down,
//                                             CSS px; [] lifts them all. A finger
//                                             given as { id, wx, wy } is in world
//                                             metres, converted through the camera.
//                 { keyDown: 'ArrowLeft' } / { keyUp: 'ArrowLeft' } / { press: 'z' }
//                 { click: '#overview' }       DOM click on a selector
//                 { call: 'name', args: [] }   window.__trailer.<name>(...args)
//   drive(state) optional closed-loop driver, called every `driveEvery` frames
//               (default 2) with the latest state; returns an action or a list
//               of actions (same shapes as `input`, without `t`), or nothing.
//               This is how a scripted player steers a camera-following car.
//   label(state) optional, extra text under each frame from its state
//   analyse(trace, config)  optional, returns the summary object

import { readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCEN_DIR = path.join(ROOT, 'scripts/scenarios');
const VIEW = { width: 390, height: 844 };
const FPS = 60;

const argv = process.argv.slice(2);
const filter = argv.find((a) => !a.includes('=')) ?? '';
const extraParams = Object.fromEntries(argv.filter((a) => a.includes('=')).map((a) => a.split('=')));

const files = (await readdir(SCEN_DIR)).filter((f) => f.endsWith('.mjs') && !f.startsWith('_') && f.startsWith(filter)).sort();
if (!files.length) {
  console.error(`no scenarios in scripts/scenarios/ match "${filter}"`);
  process.exit(1);
}

// A private dev server on a spare port, so it never fights `npm run dev` on 5180.
const server = await createServer({
  root: ROOT,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 5199, strictPort: false },
});
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await chromium.launch();
let failures = 0;
try {
  for (const file of files) {
    const scen = (await import(pathToFileURL(path.join(SCEN_DIR, file)).href)).default;
    try {
      await runScenario(scen);
    } catch (err) {
      failures += 1;
      console.error(`✗ ${file}: ${err.stack ?? err}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failures ? 1 : 0);

async function runScenario(scen) {
  const params = new URLSearchParams({ ...stringify(scen.params ?? {}), ...extraParams, capture: '1' });
  const url = `${base}?${params}`;

  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  const cdp = await context.newCDPSession(page);

  await page.goto(url);
  await page.waitForFunction(() => typeof window.__trailer?.advance === 'function', null, { timeout: 15000 });
  // Step until the scene exists and has produced a first state.
  const warm = await page.waitForFunction(
    () => window.__trailer.advance(1)[0] ?? false,
    null,
    { timeout: 15000, polling: 50 }
  );
  const first = await warm.jsonValue();

  const config = await page.evaluate(() => ({ ...window.__trailer.cfg }));
  const totalFrames = Math.round(scen.duration * FPS);
  const shotFrames = new Set(frameList(scen.frames, scen.duration).map((s) => Math.round(s * FPS)));
  const actions = [...(scen.input ?? [])].sort((a, b) => a.t - b.t);
  const touchesDown = new Map();

  // All times (input, frames, duration) are on the scene's own clock, which
  // already ran the warm-up frames above.
  const trace = [first];
  const shots = [];
  let frame = Math.round(first.t * FPS);
  const driveEvery = scen.driveEvery ?? 2;
  while (frame < totalFrames) {
    // Apply every action due at this frame.
    while (actions.length && Math.round(actions[0].t * FPS) <= frame) {
      await applyAction(page, cdp, actions.shift(), touchesDown);
    }
    if (scen.drive) {
      const out = scen.drive(trace[trace.length - 1]);
      for (const a of [out ?? []].flat()) await applyAction(page, cdp, a, touchesDown);
    }
    // Advance to the next action, screenshot, drive tick, or the end — whichever is first.
    let next = totalFrames;
    if (scen.drive) next = Math.min(next, frame + driveEvery);
    if (actions.length) next = Math.min(next, Math.max(frame + 1, Math.round(actions[0].t * FPS)));
    for (const f of shotFrames) if (f > frame && f < next) next = f;
    const states = await page.evaluate((n) => window.__trailer.advance(n), next - frame);
    trace.push(...states);
    frame = next;
    if (shotFrames.has(frame)) {
      // Phaser renders during step, so the canvas already shows this frame.
      const png = await page.screenshot({ type: 'png' });
      const state = trace[trace.length - 1];
      shots.push({ frame, t: state.t, png: png.toString('base64'), label: scen.label?.(state) ?? '' });
    }
  }

  await context.close();

  const summary = scen.analyse ? scen.analyse(trace, config) : {};
  const outDir = path.join(ROOT, 'captures', scen.milestone);
  await mkdir(outDir, { recursive: true });
  const stem = path.join(outDir, scen.name);

  const sheet = await contactSheet(scen, url.replace(base, '/'), summary, shots);
  await writeFile(`${stem}.png`, sheet);
  await writeFile(
    `${stem}.json`,
    JSON.stringify(
      {
        milestone: scen.milestone,
        name: scen.name,
        title: scen.title,
        url: url.replace(base, '/'),
        viewport: VIEW,
        capturedAt: new Date().toISOString(),
        consoleErrors,
        config,
        summary,
        frames: shots.map(({ frame, t, label }) => ({ frame, t, label })),
        // Every physics frame; numbers rounded so the file stays readable in a diff.
        trace: trace.map(round),
      },
      null,
      1
    )
  );
  const verdict = consoleErrors.length ? ` (${consoleErrors.length} console errors)` : '';
  console.log(`✓ captures/${scen.milestone}/${scen.name}.{png,json}${verdict}`);
  console.log(`  ${JSON.stringify(summary)}`);
}

async function applyAction(page, cdp, a, touchesDown) {
  if (a.touch) {
    const fingers = [];
    for (const p of a.touch) {
      if (p.wx === undefined) fingers.push(p);
      else {
        const sp = await page.evaluate(([x, y]) => window.__trailer.scene.toScreen(x, y), [p.wx, p.wy]);
        // A real finger can't leave the screen.
        fingers.push({ id: p.id, x: Math.min(VIEW.width - 1, Math.max(1, sp.x)), y: Math.min(VIEW.height - 1, Math.max(1, sp.y)) });
      }
    }
    const next = new Map(fingers.map((p, i) => [p.id ?? i, p]));
    const points = (m) => [...m.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y }));
    const ended = [...touchesDown.keys()].filter((id) => !next.has(id));
    const started = [...next.keys()].filter((id) => !touchesDown.has(id));
    const moved = [...next.keys()].filter((id) => touchesDown.has(id));
    if (ended.length) {
      // Chromium's CDP releases exactly the fingers a touchEnd lists (checked:
      // a touchMove with fewer fingers releases nothing).
      const lifted = new Map(ended.map((id) => [id, touchesDown.get(id)]));
      for (const id of ended) touchesDown.delete(id);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: points(lifted) });
    }
    const changed = moved.filter((id) => {
      const o = touchesDown.get(id), n = next.get(id);
      return o.x !== n.x || o.y !== n.y;
    });
    if (changed.length) {
      for (const id of moved) touchesDown.set(id, next.get(id));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(touchesDown) });
    }
    if (started.length) {
      for (const id of started) touchesDown.set(id, next.get(id));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(touchesDown) });
    }
  } else if (a.keyDown) {
    await page.keyboard.down(a.keyDown);
  } else if (a.keyUp) {
    await page.keyboard.up(a.keyUp);
  } else if (a.press) {
    await page.keyboard.press(a.press);
  } else if (a.click) {
    await page.click(a.click);
  } else if (a.call) {
    await page.evaluate(({ name, args }) => window.__trailer[name](...args), { name: a.call, args: a.args ?? [] });
  } else {
    throw new Error(`unknown input action ${JSON.stringify(a)}`);
  }
}

function frameList(spec, duration) {
  if (Array.isArray(spec)) return spec;
  const { every = 1, from = every, to = duration } = spec ?? {};
  const out = [];
  for (let s = from; s <= to + 1e-9; s += every) out.push(+s.toFixed(4));
  return out;
}

async function contactSheet(scen, url, summary, shots) {
  const COLS = 6;
  const W = Math.round(VIEW.width / 2);
  const H = Math.round(VIEW.height / 2);
  const page = await browser.newPage({ viewport: { width: COLS * (W + 8) + 8, height: 400 } });
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const cells = shots
    .map(
      (s) => `<figure><img src="data:image/png;base64,${s.png}" width="${W}" height="${H}">
      <figcaption>t=${s.t.toFixed(2)}s${s.label ? '<br>' + esc(s.label).replace(/\n/g, '<br>') : ''}</figcaption></figure>`
    )
    .join('');
  await page.setContent(`<!doctype html><style>
    body{margin:0;padding:8px;background:#101317;color:#c8d0da;font:12px/1.35 ui-monospace,Menlo,monospace}
    h1{font-size:15px;margin:0 0 2px} p{margin:0 0 6px;color:#8b95a3;word-break:break-all}
    pre{margin:0 0 8px;white-space:pre-wrap;color:#e6c46a}
    main{display:grid;grid-template-columns:repeat(${COLS},${W}px);gap:8px}
    figure{margin:0} img{display:block;border:1px solid #333a44}
    figcaption{padding-top:2px;font-size:11px}
  </style><h1>${esc(scen.milestone.toUpperCase())} · ${esc(scen.name)} — ${esc(scen.title ?? '')}</h1>
  <p>${esc(url)}</p><pre>${esc(JSON.stringify(summary, null, 1))}</pre><main>${cells}</main>`);
  const png = await page.screenshot({ type: 'png', fullPage: true });
  await page.close();
  return png;
}

function stringify(o) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v)]));
}

function round(v) {
  if (typeof v === 'number') return Math.round(v * 1000) / 1000;
  if (Array.isArray(v)) return v.map(round);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)]));
  return v;
}
