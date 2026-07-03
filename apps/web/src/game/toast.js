import { reactive } from 'vue';

// A single global toast. The #toast styling lives in the ui stylesheet.
export const toastState = reactive({ msg: '', show: false });
let timer;
export function toast(msg) { toastState.msg = msg; toastState.show = true; clearTimeout(timer); timer = setTimeout(() => { toastState.show = false; }, 1600); }
