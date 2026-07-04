<template>
  <div class="dots" aria-hidden="true"></div>
  <div class="shell">
    <nav v-if="showNav" class="nav webnav">
      <div class="brand" @click="go('title')"><span class="mk" v-html="brandMark"></span>DOOT DOOT REVOLUTION<span class="dot">.</span></div>
      <div class="tabs">
        <button v-for="(t, i) in tabs" :key="t.name" class="tab" :class="{ on: screen === t.name, kfocus: navFocus === i }" @click="go(t.name)">{{ t.label }}</button>
        <DownloadModal />
        <GithubLink />
      </div>
    </nav>
    <main class="shell-main">
      <component :is="view" />
    </main>
    <Toast />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { DOOT_LOGO } from './game/logo.js';
import Toast from './components/Toast.vue';
import GithubLink from './components/GithubLink.vue';
import DownloadModal from './components/DownloadModal.vue';
import TitleView from './views/TitleView.vue';
import SelectView from './views/SelectView.vue';
import GameView from './views/GameView.vue';
import ResultsView from './views/ResultsView.vue';
import AddView from './views/AddView.vue';
import LibraryView from './views/LibraryView.vue';
import SettingsView from './views/SettingsView.vue';
import PadsView from './views/PadsView.vue';
import PlayerSetup from './views/PlayerSetup.vue';
import { useInput } from './composables/useInput.js';
import { bus } from './game/bus.js';
import { navFocus } from './game/navFocus.js';
import { screen, go } from './game/screen.js';

// Screens are swapped by state, not routed by URL. Imported directly (the app is
// small) so a switch is instant, which matters for starting a game.
const VIEWS = { title: TitleView, select: SelectView, players: PlayerSetup, game: GameView, results: ResultsView, add: AddView, library: LibraryView, settings: SettingsView, pads: PadsView };
const view = computed(() => VIEWS[screen.value] || TitleView);

onMounted(() => {
  useInput();
  bus.on('game:end', () => go('results'));
});
const brandMark = DOOT_LOGO;
const tabs = [
  { name: 'select', label: 'Play' },
  { name: 'add', label: 'Add Song' },
  { name: 'library', label: 'Library' },
  { name: 'settings', label: 'Settings' },
  { name: 'pads', label: 'Pads' }
];
const showNav = computed(() => screen.value !== 'title' && screen.value !== 'game');
</script>
