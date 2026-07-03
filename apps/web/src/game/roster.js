// roster: the multiplayer line-up for one match. Each player has an input device, a
// difficulty, and a color; the session builds a Judge and a chart per player and routes
// each device's input to its player. Pure: no DOM, no Judge or chart creation (the
// session owns those), so it is easy to unit-test.

import { tokens } from '../styles/tokens.js';

export const PLAYER_COLORS = [tokens.player.p1, tokens.player.p2, tokens.player.p3, tokens.player.p4];
export const MAX_PLAYERS = PLAYER_COLORS.length;

// configs: [{ device, difficulty }] -> players tagged with index, color and label (capped
// at four). device is 'keyboard' | 'keyboard2' | 'pad:<key>' | 'all' (single-player).
export function makePlayers(configs) {
  return (configs || []).slice(0, MAX_PLAYERS).map((c, i) => ({
    index: i, device: c.device, difficulty: c.difficulty, color: PLAYER_COLORS[i], label: 'P' + (i + 1)
  }));
}

// which player a device drives: an exact device match, else an 'all' wildcard player (the
// single-player case, where any device controls the one player), else -1.
export function playerForDevice(players, device) {
  let wild = -1;
  for (let i = 0; i < players.length; i++) { const d = players[i].device; if (d === device) return i; if (d === 'all') wild = i; }
  return wild;
}

// rank players by score (desc), tagging rank and a winner flag. A full tie has no winner.
export function standings(players) {
  const sorted = players.map((p) => ({ ...p })).sort((a, b) => (b.score || 0) - (a.score || 0));
  let rank = 0, prev = null;
  sorted.forEach((p, i) => { const sc = p.score || 0; if (prev === null || sc !== prev) rank = i + 1; p.rank = rank; prev = sc; });
  const topCount = sorted.filter((p) => p.rank === 1).length;
  sorted.forEach((p) => { p.winner = p.rank === 1 && topCount < sorted.length; });
  return sorted;
}
