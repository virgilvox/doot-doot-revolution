// APP BOOT. Construct the platform singletons, wire the nav and screens, seed the
// demo songs, and start. This file is the only place the pieces meet; each
// package stays unaware of the others and of the DOM router.

import { createBus, createSettings } from '@doot-games/core';
import { createEngine } from '@doot-games/engine';
import { createInput } from '@doot-games/input';
import { createLibrary } from '@doot-games/library';
import { createNotefield } from '@doot-games/notefield';
import { generate as charterGenerate } from '@doot-games/charter';
import { analyze, estimateTempo } from '@doot-games/analysis';
import { arrowSVG, LANE_DIRS } from '@doot-games/noteskin';
import { mountCss } from '@doot-games/ui';

import { $, $$, on, toast } from './dom.js';
import { makeDemos } from './demos.js';
import { createSelect } from './screens/select.js';
import { createAdd } from './screens/add.js';
import { createMenus } from './screens/menus.js';
import { createSession } from './screens/game.js';

const SCREENS = ['title', 'select', 'diff', 'add', 'game', 'results', 'settings', 'library', 'gamepad'];

function boot() {
  mountCss(document);

  const bus = createBus();
  const settings = createSettings({ defaults: { speed: 2.4, offsetMs: 0, volMaster: 0.9, volMusic: 0.85, volSfx: 0.7, reducedMotion: false } });
  const engine = createEngine();
  engine.setVolumes({ master: settings.get('volMaster'), music: settings.get('volMusic'), sfx: settings.get('volSfx') });
  const input = createInput();
  const library = createLibrary();
  const notefield = createNotefield($('#field'), { recFrac: 0.18 }); notefield.observe();

  const App = { screen: 'title', songs: [], sel: 0, diff: 'expert', song: null, draft: null, lastPlay: null, demoSongs: [] };

  const router = {
    show(name) {
      App.screen = name;
      SCREENS.forEach((n) => { const s = document.getElementById('s-' + n); if (s) s.classList.toggle('active', n === name); });
      $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.goto === name));
      if (name !== 'game' && session) session.stop();
      window.scrollTo(0, 0); bus.emit('screen', name);
    }
  };

  function serialize(s) { const c = Object.assign({}, s); delete c._analysis; delete c._tempo; delete c.buffer; return c; }
  async function ensureAnalysis(song) {
    if (song._analysis) return;
    let buf = song.buffer; if (!buf) { buf = await engine.decode(await song.audio.arrayBuffer()); song.buffer = buf; }
    const an = analyze(buf); let tp;
    if (song.bpm) tp = { bpm: song.bpm, offset: song.offset || 0, fps: an.sr / an.hop };
    else { tp = estimateTempo(an); song.bpm = tp.bpm; song.offset = tp.offset; }
    song._analysis = an; song._tempo = tp; if (!song.duration) song.duration = buf.duration;
  }
  async function ensureChart(song, diff) {
    if (song.charts && song.charts[diff]) return song.charts[diff];
    await ensureAnalysis(song);
    const laneBias = song._engine === 'quick' ? 'none' : 'drum';
    const ch = charterGenerate(song._analysis, song._tempo, { difficulty: diff, laneBias, engine: song._engine || 'drum', engineUsed: (song._engine === 'quick' ? 'quick (onset+tempo)' : 'drum-aware'), seed: song.title });
    song.charts = song.charts || {}; song.charts[diff] = ch;
    if (song.source !== 'demo' && song.audio) library.put(serialize(song)).catch(() => {});
    return ch;
  }
  function play(song, chart) { App.lastPlay = { song, chart }; router.show('game'); session.start(song, chart).catch((err) => { console.error(err); toast('Could not start: ' + err.message); router.show('select'); }); }

  const ctx = { bus, engine, settings, input, library, notefield, App, router, play, ensureAnalysis, ensureChart, serialize };
  const select = createSelect(ctx); ctx.select = select;
  const add = createAdd(ctx);
  const menus = createMenus(ctx);
  const session = createSession(ctx); ctx.session = session;

  // bridge input events onto the app bus for the menu screens
  input.on('down', (d) => bus.emit('input:down', d));
  input.on('up', (d) => bus.emit('input:up', d));
  input.on('start', () => bus.emit('input:start'));
  input.on('back', () => bus.emit('input:back'));
  input.on('bound', (d) => bus.emit('input:bound', d));

  // brand mark and title arrows from the shared noteskin
  const mk = arrowSVG('up').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const bm = $('#brandMark'); if (bm) bm.outerHTML = '<svg class="mk" viewBox="0 0 512 512" aria-hidden="true">' + mk + '</svg>';
  $('#titleArrows').innerHTML = LANE_DIRS.map((d) => `<div class="a">${arrowSVG(d)}</div>`).join('');

  $$('[data-goto]').forEach((b) => on(b, 'click', () => router.show(b.dataset.goto)));
  bus.on('input:back', () => { if (App.screen === 'game') { session.stop(); router.show('select'); } else if (App.screen === 'select') { router.show('title'); } else if (App.screen !== 'title') { router.show('select'); } });
  bus.on('input:start', () => { if (App.screen === 'title') router.show('select'); });
  bus.on('game:end', ({ results, song, chart }) => menus.showResults(results, song, chart));
  bus.on('screen', (n) => { if (n === 'select') select.refresh(); else if (n === 'library') menus.library.refresh(); else if (n === 'settings') menus.settings.build(); else if (n === 'game') notefield.resize(); });

  select.setup(); add.setup(); menus.setup();
  on($('#gpRestart'), 'click', () => session.restart());
  on($('#gpQuit'), 'click', () => { session.stop(); router.show('select'); });
  on($('#resRetry'), 'click', () => { if (App.lastPlay) play(App.lastPlay.song, App.lastPlay.chart); });

  document.body.classList.toggle('reduce', settings.get('reducedMotion'));
  App.demoSongs = makeDemos(engine);
  select.refresh();
  router.show('title');

  const wake = () => { engine.resume(); window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); };
  window.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake);
  input.attach(window);

  // one persistent loop samples gamepads for every screen
  (function idle() { input.poll(); requestAnimationFrame(idle); })();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
