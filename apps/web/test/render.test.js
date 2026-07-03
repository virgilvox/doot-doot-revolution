import { test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import NoteField from '../src/components/NoteField.vue';
import GrooveRadar from '../src/components/GrooveRadar.vue';
import SongWheel from '../src/components/SongWheel.vue';

const chart = { bpm: 150, offset: 0, notes: [{ t: 0.2, lane: 0, dur: 0, quant: 4 }, { t: 0.4, lane: 1, dur: 0.5, quant: 8 }] };

test('NoteField mounts a canvas and renders a frame without throwing', () => {
  const w = mount(NoteField);
  expect(w.find('canvas').exists()).toBe(true);
  expect(() => w.vm.render(0.3, chart, { speed: 2.4 })).not.toThrow();
  w.unmount();
});

test('GrooveRadar renders an svg polygon from a radar', () => {
  const w = mount(GrooveRadar, { props: { radar: { stream: 0.8, voltage: 0.5, air: 0.3, freeze: 0.2, chaos: 0.6 } } });
  expect(w.find('svg').exists()).toBe(true);
  expect(w.html()).toContain('polygon');
});

test('SongWheel renders one card per song', () => {
  const songs = [
    { id: 'a', title: 'Alpha', artist: 'X', bpm: 120 },
    { id: 'b', title: 'Beta', artist: 'Y', bpm: 140 },
    { id: 'c', title: 'Gamma', artist: 'Z', bpm: 160 }
  ];
  const w = mount(SongWheel, { props: { songs, sel: 0 } });
  expect(w.findAll('.card').length).toBe(3);
  expect(w.html()).toContain('Alpha');
});
