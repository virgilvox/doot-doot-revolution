<template>
  <div class="dots" aria-hidden="true"></div>
  <div class="shell">
    <nav v-if="showNav" class="nav webnav">
      <div class="brand" @click="go('title')"><span class="mk" v-html="brandMark"></span>DOOT DOOT REVOLUTION<span class="dot">.</span></div>
      <div class="tabs">
        <button v-for="(t, i) in tabs" :key="t.name" class="tab" :class="{ on: route.name === t.name, kfocus: navFocus === i }" @click="go(t.name)">{{ t.label }}</button>
      </div>
    </nav>
    <main class="shell-main">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>
    <Toast />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { arrowSVG } from '@doot-games/noteskin';
import Toast from './components/Toast.vue';
import { useInput } from './composables/useInput.js';
import { bus } from './game/singletons.js';
import { navFocus } from './game/navFocus.js';

const router = useRouter();
const route = useRoute();
onMounted(() => {
  useInput();
  bus.on('game:end', () => router.push({ name: 'results' }));
});
const brandMark = arrowSVG('up');
const tabs = [
  { name: 'select', label: 'Play' },
  { name: 'add', label: 'Add Song' },
  { name: 'library', label: 'Library' },
  { name: 'settings', label: 'Settings' },
  { name: 'pads', label: 'Pads' }
];
const showNav = computed(() => route.name !== 'title' && route.name !== 'game');
const go = (name) => { if (route.name !== name) router.push({ name }); };
</script>
