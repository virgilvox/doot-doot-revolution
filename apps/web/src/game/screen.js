import { ref } from 'vue';

// Which screen is showing. Navigation is application state, not a URL: this is a
// client-only game, so there are no route URLs to keep in sync and a stray browser
// Back never yanks the player out of a song. Views read `screen` and call `go`.
export const screen = ref('title');
export const go = (name) => { if (screen.value !== name) screen.value = name; };
