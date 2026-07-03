<template>
  <div id="toast" :class="{ show: toastState.show }">{{ toastState.msg }}</div>
</template>
<script setup>
import { toastState } from '../game/toast.js';
</script>
