import { test, expect } from 'vitest';
import { useNavigation } from '../src/composables/useNavigation.js';
import { bus } from '../src/game/singletons.js';

test('only the top focus scope receives nav events, and pop restores the previous', () => {
  const nav = useNavigation();
  const a = { moves: [], confirms: 0 };
  const b = { moves: [], cancels: 0 };
  const popA = nav.pushScope({ move: (d) => a.moves.push(d), confirm: () => a.confirms++ });

  bus.emit('move', { dir: 'up' });
  bus.emit('confirm');
  expect(a.moves).toEqual(['up']);
  expect(a.confirms).toBe(1);

  const popB = nav.pushScope({ move: (d) => b.moves.push(d), cancel: () => b.cancels++ });
  bus.emit('move', { dir: 'down' });
  bus.emit('cancel');
  expect(b.moves).toEqual(['down']);
  expect(b.cancels).toBe(1);
  expect(a.moves).toEqual(['up']); // scope A did not receive events while B was on top

  popB();
  bus.emit('move', { dir: 'left' });
  expect(a.moves).toEqual(['up', 'left']);
  popA();
});
