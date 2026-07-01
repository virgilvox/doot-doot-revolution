// Song Select: the framed console with a hero panel (banner, facts, groove radar,
// difficulty pills, DANCE) beside an arc wheel of songs. The hero repaints on
// select. Screen code only, wiring the wheel and the packages together.

import { DIFFS, nominalRadar } from '@doot-games/charter';
import { AXES, drawRadar } from '@doot-games/radar';
import { escapeHtml, DIFF_VAR } from '@doot-games/ui';
import { $, on, toast, fmtTime, covGrad } from '../dom.js';

const ENG_LABEL = { quick: 'Quick', drum: 'Drum-Aware', stem: 'Stem-Split' };

export function createSelect(ctx) {
  const { App, bus, library, router, ensureChart, play } = ctx;
  const WIN = 6, K = 5.2, SPREAD = 52;
  let board, cards = [];

  function setup() {
    board = $('#wheel');
    on(board, 'wheel', (e) => { if (App.screen !== 'select') return; e.preventDefault(); step(e.deltaY > 0 ? 1 : -1); }, { passive: false });
    on($('#danceBtn'), 'click', dance);
    on($('#modsBtn'), 'click', () => toast('Speed and mods: coming soon'));
    bus.on('input:down', ({ lane }) => { if (App.screen !== 'select') return; if (lane === 2) step(-1); else if (lane === 1) step(1); });
    bus.on('input:start', () => { if (App.screen === 'select') dance(); });
    library.onChange(() => { if (App.screen === 'select') refresh(); });
  }

  async function refresh() {
    let libs = [];
    try { libs = (await library.list()) || []; } catch (e) { libs = []; }
    App.songs = [...(App.demoSongs || []), ...libs].filter(Boolean);
    if (App.sel >= App.songs.length) App.sel = 0;
    build();
    const tf = $('#titleFoot'); if (tf) tf.textContent = '/songs · ' + App.songs.length + ' loaded';
  }

  function focus(song) {
    let i = App.songs.findIndex((s) => s.id === song.id);
    if (i < 0) { App.songs = [song, ...App.songs]; i = 0; build(); }
    App.sel = Math.max(0, i); layout(); hero(); router.show('select');
  }

  function build() {
    [...board.querySelectorAll('.card')].forEach((c) => c.remove()); cards = [];
    App.songs.forEach((s, i) => {
      const b = document.createElement('button'); b.className = 'card'; b.type = 'button';
      b.innerHTML = `<div class="cv" style="background:${covGrad(i)}">${(s.title || '?')[0].toUpperCase()}</div>` +
        `<div class="ci"><div class="t">${escapeHtml(s.title)}</div><div class="a">${escapeHtml(s.artist || '')}</div></div>` +
        `<div class="cb">${Math.round(s.bpm || 0) || '—'}</div>`;
      on(b, 'click', () => { if (i === App.sel) dance(); else selectAt(i); });
      board.appendChild(b); cards.push(b);
    });
    layout(); hero();
    const c = $('#selCount'); if (c) c.textContent = App.songs.length;
  }
  function step(d) { selectAt(App.sel + d); }
  function selectAt(i) { const n = App.songs.length; if (!n) return; App.sel = ((i % n) + n) % n; layout(); hero(); }
  function layout() {
    const n = cards.length;
    cards.forEach((c, i) => {
      let o = i - App.sel; if (o > n / 2) o -= n; if (o < -n / 2) o += n; const ao = Math.abs(o);
      if (ao > WIN) { c.style.display = 'none'; return; } c.style.display = '';
      const tx = 22 + K * o * o, ty = o * SPREAD, sc = Math.max(.66, 1 - ao * .05), op = Math.max(.18, 1 - ao * .14);
      c.style.transform = `translate(${tx}px, calc(-50% + ${ty}px)) scale(${sc})`; c.style.opacity = op; c.style.zIndex = 60 - ao * 4;
      c.classList.toggle('sel', o === 0); c.setAttribute('aria-current', o === 0 ? 'true' : 'false');
    });
  }
  function hero() {
    const s = App.songs[App.sel]; if (!s) return;
    $('#selTitle').textContent = s.title || 'Untitled';
    $('#selArtist').textContent = (s.artist || 'Unknown') + (s.genre ? (' · ' + s.genre) : '');
    $('#selBigL').textContent = (s.title || '?')[0].toUpperCase();
    $('#selBpm').textContent = Math.round(s.bpm || 0) || '—';
    $('#selLen').textContent = s.duration ? fmtTime(s.duration) : '—';
    $('#selSrc').textContent = s.source || 'file';
    $('#selBanner').style.background = covGrad(App.sel);
    if (!(App.diff in DIFFS)) App.diff = 'expert';
    pills(s); paintRadar(s);
  }
  function pills(s) {
    const box = $('#diffs'); box.innerHTML = '';
    Object.keys(DIFFS).forEach((df) => {
      const D = DIFFS[df], made = s.charts && s.charts[df], foot = made ? made.foot : D.foot;
      const el = document.createElement('div'); el.className = 'diff' + (df === App.diff ? ' pick' : ''); el.dataset.df = df;
      el.innerHTML = `<div class="nm" style="background:var(${DIFF_VAR[df]})">${D.name}</div><div class="ft">${foot}</div>`;
      on(el, 'click', () => { App.diff = df; [...box.children].forEach((c) => c.classList.toggle('pick', c === el)); paintRadar(s); });
      box.appendChild(el);
    });
  }
  function paintRadar(s) {
    const made = s.charts && s.charts[App.diff], radar = (made && made.radar) || nominalRadar(App.diff);
    drawRadar($('#selRadar'), radar);
    $('#selLegend').innerHTML = AXES.map(([k, label]) => `<div><span>${label}</span><span class="v">${Math.round((radar[k] || 0) * 200)}</span></div>`).join('');
    $('#selEngine').textContent = made ? (ENG_LABEL[made.engine] || 'Drum-Aware') : (ENG_LABEL[s._engine] || '—');
  }
  async function dance() {
    const s = App.songs[App.sel]; if (!s) return; const df = App.diff;
    $('#danceBtn').textContent = '…';
    try { const ch = await ensureChart(s, df); play(s, ch); } catch (e) { toast('Could not start: ' + e.message); } finally { $('#danceBtn').textContent = 'DANCE'; }
  }
  return { setup, refresh, hero, focus };
}
