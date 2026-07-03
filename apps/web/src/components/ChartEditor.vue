<template>
  <div ref="host" class="ed-host"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { createEditor } from '@doot-games/editor';

const props = defineProps({ charts: Object, difficulty: String, audioBuffer: Object, audioContext: Object });
const emit = defineEmits(['change']);
const host = ref(null);
let ed = null;

onMounted(() => {
  ed = createEditor(host.value, {
    charts: props.charts, difficulty: props.difficulty,
    audioBuffer: props.audioBuffer, audioContext: props.audioContext,
    onChange: (c) => emit('change', c)
  });
});
onBeforeUnmount(() => { if (ed) ed.destroy(); });
defineExpose({ getCharts: () => (ed ? ed.getCharts() : props.charts) });
</script>

<style scoped>
.ed-host { height: 100%; min-height: 0; }
</style>
