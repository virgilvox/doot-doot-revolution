<template>
  <canvas ref="cv" class="shader-bg"></canvas>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, ref } from 'vue';
import { createBackground } from '@doot-games/render';

// A generative fragment-shader backdrop (see @doot-games/render's background). The
// caller places it behind the notefield; mood/seed pick the look (derived from the
// song so each track has its own evolving vibe), and it morphs continuously.
const props = defineProps({ mood: String, seed: [String, Number], brightness: { type: Number, default: 0.58 } });
const cv = ref(null);
let bg = null;

onMounted(() => {
  bg = createBackground(cv.value, { brightness: props.brightness });
  if (!bg.ok) return;
  bg.compose(props.seed != null ? props.seed : 'doot', props.mood);
  bg.resize();
  bg.start();
});
watch(() => [props.mood, props.seed], () => { if (bg && bg.ok) bg.compose(props.seed != null ? props.seed : 'doot', props.mood); });
onBeforeUnmount(() => { if (bg) bg.dispose(); bg = null; });
</script>

<style scoped>
.shader-bg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
</style>
