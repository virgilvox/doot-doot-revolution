// The lighter screens: difficulty, results, settings, library, and gamepad. Each
// is thin DOM wiring over the packages. Grouped here to keep the app small.

import { DIFFS } from '@doot-games/charter';
import { arrowSVG, LANE_DIRS } from '@doot-games/noteskin';
import { escapeHtml, DIFF_VAR } from '@doot-games/ui';
import { $, $$, on, toast, fmtTime, covGrad } from '../dom.js';

export function createMenus(ctx) {
  const { App, engine, settings, input, library, router, bus, ensureChart, play } = ctx;

  // ---- difficulty ----
  const difficulty = {
    setup() { on($('#startPlay'), 'click', diffStart); },
    open(song) { App.song = song; App.diff = null; $('#diffSong').textContent = song.title || 'Difficulty'; diffBuild(); $('#startPlay').disabled = true; $('#diffHint').textContent = 'select a difficulty above'; router.show('diff'); }
  };
  function diffBuild() {
    const grid = $('#diffGrid'); grid.innerHTML = '';
    Object.keys(DIFFS).forEach((df) => {
      const D = DIFFS[df], made = App.song.charts && App.song.charts[df], foot = made ? made.foot : D.foot, lit = Math.min(5, Math.ceil(foot / 3));
      let m = ''; for (let i = 0; i < 5; i++) m += `<i class="${i < lit ? 'on' : ''}" style="${i < lit ? 'background:var(' + DIFF_VAR[df] + ')' : ''}"></i>`;
      const b = document.createElement('button'); b.className = 'dcard'; b.type = 'button'; b.dataset.df = df;
      b.innerHTML = `<span class="nm" style="background:var(${DIFF_VAR[df]})">${D.name}</span><span class="ft" style="color:var(${DIFF_VAR[df]})">${foot}</span>` +
        `<span class="dmeter">${m}</span><span class="meta">${made ? (made.count + ' notes · ' + made.engineUsed) : 'generates on start'}</span>`;
      on(b, 'click', () => { App.diff = df; $$('.dcard', grid).forEach((x) => x.classList.toggle('sel', x === b)); $('#startPlay').disabled = false; $('#diffHint').textContent = D.name + ' · foot ' + foot; });
      grid.appendChild(b);
    });
  }
  async function diffStart() { if (!App.diff) return; const s = App.song, df = App.diff; $('#diffHint').textContent = 'generating chart…'; $('#startPlay').disabled = true; const ch = await ensureChart(s, df); $('#startPlay').disabled = false; play(s, ch); }
  function openDifficulty(song) { ctx.select.focus(song); }

  // ---- results ----
  function showResults(results, song, chart) {
    $('#resTitle').textContent = (song.title || '') + ' · ' + ((DIFFS[chart.difficulty] || {}).name || '');
    $('#resGrade').textContent = results.grade;
    $('#resCombo').textContent = results.fullCombo ? 'FULL COMBO' : (results.maxCombo + ' MAX COMBO');
    const rows = [['Marvelous', results.counts.marvelous, '--teal'], ['Perfect', results.counts.perfect, '--blue'], ['Great', results.counts.great, '--green'], ['Good', results.counts.good, '--purple'], ['Boo', results.counts.boo, '--orange'], ['Miss', results.counts.miss, '--red']];
    const tot = results.total || 1;
    $('#resJudges').innerHTML = rows.map(([n, c, col]) => `<div class="jrow"><span class="jn">${n}</span><span class="jbar"><i style="width:${Math.round(c / tot * 100)}%;background:var(${col})"></i></span><span class="jc">${c}</span></div>`).join('');
    router.show('results');
  }

  // ---- settings ----
  const spec = [
    { t: 'Scroll speed', d: 'How fast arrows travel. Higher is faster.', kind: 'range', key: 'speed', min: 1, max: 5, step: 0.1, fmt: (v) => Number(v).toFixed(1) + 'x' },
    { t: 'Judge offset', d: 'Nudge timing if hits feel early or late.', kind: 'range', key: 'offsetMs', min: -100, max: 100, step: 1, fmt: (v) => (v > 0 ? '+' : '') + Math.round(v) + ' ms' },
    { t: 'Master volume', d: '', kind: 'vol', key: 'volMaster' },
    { t: 'Music volume', d: '', kind: 'vol', key: 'volMusic' },
    { t: 'SFX volume', d: 'Loudness of the hit tick.', kind: 'vol', key: 'volSfx' },
    { t: 'Reduced motion', d: 'Calmer menus. Gameplay still animates.', kind: 'toggle', key: 'reducedMotion' }
  ];
  function applyVolumes() { engine.setVolumes({ master: settings.get('volMaster'), music: settings.get('volMusic'), sfx: settings.get('volSfx') }); }
  const settingsScreen = {
    setup() {},
    build() {
      const box = $('#setRows'); box.innerHTML = '';
      spec.forEach((s) => {
        const row = document.createElement('div'); row.className = 'row'; let control;
        if (s.kind === 'toggle') { const v = settings.get(s.key); control = `<span class="sw-toggle${v ? ' on' : ''}" role="switch" aria-checked="${v}"></span>`; }
        else { const isVol = s.kind === 'vol', min = isVol ? 0 : s.min, max = isVol ? 100 : s.max, step = isVol ? 1 : s.step, raw = isVol ? Math.round(settings.get(s.key) * 100) : settings.get(s.key); control = `<input type="range" min="${min}" max="${max}" step="${step}" value="${raw}" data-vol="${isVol ? 1 : 0}"><span class="rv"></span>`; }
        row.innerHTML = `<div class="rl"><div class="t">${s.t}</div>${s.d ? `<div class="d">${s.d}</div>` : ''}</div><div class="rc">${control}</div>`;
        box.appendChild(row);
        if (s.kind !== 'toggle') { const rv = $('.rv', row), inp = $('input', row); const upd = () => { const val = Number(inp.value); rv.textContent = inp.dataset.vol === '1' ? val + '%' : s.fmt(val); }; upd(); on(inp, 'input', () => { const val = Number(inp.value); if (inp.dataset.vol === '1') { settings.set(s.key, val / 100); applyVolumes(); } else settings.set(s.key, val); upd(); }); }
        else { const sw = $('.sw-toggle', row); on(sw, 'click', () => { const v = !settings.get(s.key); settings.set(s.key, v); sw.classList.toggle('on', v); sw.setAttribute('aria-checked', v); if (s.key === 'reducedMotion') document.body.classList.toggle('reduce', v); }); }
      });
      const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<div class="rl"><div class="t">Reset</div><div class="d">Restore default settings.</div></div><div class="rc"><button class="btn white sm" id="setReset">Reset all</button></div>`; box.appendChild(r);
      on($('#setReset'), 'click', () => { settings.reset(); applyVolumes(); document.body.classList.toggle('reduce', settings.get('reducedMotion')); settingsScreen.build(); toast('Settings reset'); });
    }
  };

  // ---- library ----
  const libraryScreen = {
    setup() {
      if (!library.canFolder) { $('#chooseFolder').disabled = true; $('#storeDesc').textContent = 'Songs live in this browser (IndexedDB). Folder sync needs a Chromium-based browser; use the .ddr backup to move a library between machines.'; }
      on($('#chooseFolder'), 'click', async () => { try { const nm = await library.chooseFolder(); toast('Folder: ' + nm); $('#exportFolder').disabled = false; $('#importFolder').disabled = false; $('#storeDesc').textContent = 'Folder "' + nm + '" linked. Export writes songs there; Import reads them back.'; } catch (e) { if (e && e.message === 'unsupported') toast('Not supported here'); } });
      on($('#exportFolder'), 'click', async () => { try { const n = await library.exportToFolder(); toast(n + ' song' + (n === 1 ? '' : 's') + ' written'); } catch (e) { toast('Export failed'); } });
      on($('#importFolder'), 'click', async () => { try { const n = await library.importFromFolder(); toast(n + ' imported'); libraryScreen.refresh(); } catch (e) { toast('Import failed'); } });
      on($('#exportFile'), 'click', async () => { const blob = await library.exportFile(); download('doot-library.ddr', blob); toast('Downloaded backup'); });
      on($('#importFileBtn'), 'click', () => $('#importFile').click());
      on($('#importFile'), 'change', async (e) => { const f = e.target.files[0]; if (!f) return; try { const n = await library.importFile(f); toast('Restored ' + n + ' song' + (n === 1 ? '' : 's')); libraryScreen.refresh(); } catch (err) { toast('Not a valid .ddr file'); } e.target.value = ''; });
    },
    async refresh() {
      let libs = []; try { libs = (await library.list()) || []; } catch (e) {}
      libs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      $('#libCount').textContent = '· ' + libs.length; const box = $('#libList');
      if (!libs.length) { box.innerHTML = '<div style="font-family:var(--fu);color:#7d7aa0;font-weight:600">No saved songs yet. Add one from the Add Song tab. The demo tracks are always available on the Play screen.</div>'; return; }
      box.innerHTML = '';
      libs.forEach((s, i) => {
        const it = document.createElement('div'); it.className = 'lib-item';
        it.innerHTML = `<div class="cv" style="background:${covGrad(i + 1)}">${(s.title || '?')[0].toUpperCase()}</div>` +
          `<div class="li"><div class="t">${escapeHtml(s.title)}</div><div class="d">${escapeHtml(s.artist || '')} · ${Math.round(s.bpm || 0)} BPM · ${Object.keys(s.charts || {}).length} charts · ${s.duration ? fmtTime(s.duration) : '—'}</div></div>` +
          `<button class="btn sm play">Play</button><button class="btn white sm del">Delete</button>`;
        on($('.play', it), 'click', () => openDifficulty(s));
        on($('.del', it), 'click', async () => { await library.remove(s.id); toast('Deleted'); libraryScreen.refresh(); });
        box.appendChild(it);
      });
    }
  };

  // ---- gamepad ----
  const gamepad = {
    timer: 0,
    setup() {
      const sw = $('#gpEnable'); sw.classList.toggle('on', input.padEnabled()); sw.setAttribute('role', 'switch');
      on(sw, 'click', () => { const v = !input.padEnabled(); input.setPadEnabled(v); sw.classList.toggle('on', v); });
      bus.on('input:bound', () => gamepad.build());
      bus.on('screen', (n) => { clearInterval(gamepad.timer); if (n === 'gamepad') { gamepad.build(); gamepad.timer = setInterval(gamepad.detect, 500); gamepad.detect(); } else input.cancelListen(); });
    },
    detect() { const gp = input.connectedPad(); $('#gpDetect').textContent = gp ? ('Connected: ' + gp.id) : 'None detected — press a button on a controller to wake it.'; },
    build() {
      const grid = $('#bindGrid'); if (!grid) return; grid.innerHTML = '';
      for (let l = 0; l < 4; l++) {
        const cell = document.createElement('div'); cell.className = 'bind';
        cell.innerHTML = `<div class="ar">${arrowSVG(LANE_DIRS[l])}</div><div style="font-family:var(--fd);font-weight:800;font-size:13px;margin-bottom:6px">${input.LANE_NAMES[l]}</div><div style="font-family:var(--fu);font-size:11px;color:#7d7aa0;margin-bottom:8px">${escapeHtml(input.describe(l))}</div><button class="bindbtn" data-lane="${l}">Bind</button>`;
        grid.appendChild(cell);
      }
      $$('.bindbtn', grid).forEach((b) => on(b, 'click', () => { $$('.bindbtn', grid).forEach((x) => x.classList.remove('listening')); b.classList.add('listening'); b.textContent = 'press key / button…'; input.listen(+b.dataset.lane); }));
    }
  };

  function setup() { difficulty.setup(); settingsScreen.setup(); libraryScreen.setup(); gamepad.setup(); }
  return { setup, difficulty, showResults, settings: settingsScreen, library: libraryScreen, gamepad, openDifficulty, applyVolumes };
}

function download(name, blob) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500); }
