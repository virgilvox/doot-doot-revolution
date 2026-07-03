<template>
  <canvas ref="cv" class="nf-canvas"></canvas>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { createNotefield } from '@doot-games/notefield';

const props = defineProps({ recFrac: { type: Number, default: 0.16 } });
const cv = ref(null);
let nf = null;

onMounted(() => { nf = createNotefield(cv.value, { recFrac: props.recFrac }); nf.observe(); });
onBeforeUnmount(() => { if (nf) nf.disconnect(); });

// expose the imperative surface the session drives each frame
defineExpose({
  render: (t, chart, opts) => nf && nf.render(t, chart, opts),
  hit: (lane, judgment, t) => nf && nf.hit(lane, judgment, t),
  blast: (lane, color, t) => nf && nf.blast(lane, color, t),
  setReducedMotion: (v) => nf && nf.setReducedMotion(v),
  resize: () => nf && nf.resize(),
  geom: () => nf && nf.geom()
});
</script>

<style scoped>
.nf-canvas { display: block; width: 100%; height: 100%; }
</style>
