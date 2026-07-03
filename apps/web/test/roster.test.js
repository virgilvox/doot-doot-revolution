import { makePlayers, playerForDevice, standings, PLAYER_COLORS, MAX_PLAYERS } from '../src/game/roster.js';

test('makePlayers tags index, color and label, and caps at four', () => {
  const p = makePlayers([{ device: 'keyboard', difficulty: 'basic' }, { device: 'keyboard2', difficulty: 'expert' }]);
  expect(p.length).toBe(2);
  expect(p[0]).toMatchObject({ index: 0, device: 'keyboard', difficulty: 'basic', label: 'P1' });
  expect(p[0].color).toBe(PLAYER_COLORS[0]);
  expect(p[1].label).toBe('P2');
  expect(makePlayers(new Array(9).fill({ device: 'keyboard', difficulty: 'basic' })).length).toBe(MAX_PLAYERS);
});

test('playerForDevice matches the exact device, then an "all" wildcard', () => {
  const players = [{ device: 'keyboard' }, { device: 'pad:aa' }];
  expect(playerForDevice(players, 'keyboard')).toBe(0);
  expect(playerForDevice(players, 'pad:aa')).toBe(1);
  expect(playerForDevice(players, 'pad:zz')).toBe(-1);
  const solo = [{ device: 'all' }];
  expect(playerForDevice(solo, 'keyboard')).toBe(0); // single-player: any device drives the one player
  expect(playerForDevice(solo, 'pad:xx')).toBe(0);
});

test('standings ranks by score and flags a single winner', () => {
  const s = standings([{ label: 'P1', score: 100 }, { label: 'P2', score: 300 }, { label: 'P3', score: 200 }]);
  expect(s.map((x) => x.label)).toEqual(['P2', 'P3', 'P1']);
  expect(s[0].rank).toBe(1); expect(s[0].winner).toBe(true);
  expect(s[1].rank).toBe(2); expect(s[1].winner).toBe(false);
});

test('a full tie has no winner', () => {
  const s = standings([{ label: 'P1', score: 100 }, { label: 'P2', score: 100 }]);
  expect(s.every((x) => x.rank === 1)).toBe(true);
  expect(s.some((x) => x.winner)).toBe(false);
});
