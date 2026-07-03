<template>
  <svg viewBox="0 0 168 168" v-html="markup" aria-hidden="true"></svg>
</template>

<script setup>
import { computed } from 'vue';
import { radarSVG } from '@doot-games/radar';
const props = defineProps({ radar: Object });
const markup = computed(() => radarSVG(props.radar || {}));
</script>
