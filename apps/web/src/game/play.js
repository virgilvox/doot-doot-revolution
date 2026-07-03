import { ref } from 'vue';

// The song and chart chosen to play, handed from the difficulty modal to the
// game view across the route change.
export const pendingPlay = ref(null);
export function setPlay(song, chart) { pendingPlay.value = { song, chart }; }
// Perpetual (endless) mode: carry the run config instead of a fixed song/chart.
export function setEndless(config) { pendingPlay.value = { endless: true, config }; }
// Local multiplayer: one song, several players, each with a device, difficulty, and chart.
// players: [{ device, difficulty, chart }].
export function setMatch(song, players) { pendingPlay.value = { match: true, song, players }; }
