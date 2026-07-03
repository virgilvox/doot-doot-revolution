import { ref } from 'vue';

// Which top-nav tab the controller focus is on, or -1 for none. The Select screen
// sets this so a gamepad can move off the wheel onto the nav and reach every
// screen; App.vue reads it to draw the focus ring.
export const navFocus = ref(-1);
