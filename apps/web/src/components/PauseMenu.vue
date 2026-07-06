<template>
  <div class="pause-ov" role="dialog" aria-modal="true" aria-label="Paused">
    <div class="pause-card panel">
      <h2 class="pause-t">Paused</h2>
      <p class="pause-s">The game paused when the window lost focus.</p>
      <div class="pause-acts">
        <button ref="resumeBtn" class="btn green lg" @click="$emit('resume')">Resume</button>
        <button class="btn white" @click="$emit('quit')">Quit</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
defineEmits(['resume', 'quit']);
// focus the primary action so a keyboard player sees where they are; the count-in is also
// reachable through the view's confirm handler (Enter)
const resumeBtn = ref(null);
onMounted(() => resumeBtn.value && resumeBtn.value.focus());
</script>

<style scoped>
.pause-ov { position: absolute; inset: 0; z-index: 30; display: grid; place-items: center; background: rgba(9, 8, 24, .62); backdrop-filter: blur(2px); }
.pause-card { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; max-width: min(420px, 88%); }
.pause-t { font-family: var(--fd); font-weight: 800; font-size: clamp(28px, 5vw, 42px); color: var(--ink); }
.pause-s { font-family: var(--fu); font-size: 14px; color: var(--ink); opacity: .8; margin: 0; }
.pause-acts { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
</style>
