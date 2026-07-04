<template>
  <div class="view-fill title-wrap">
    <div class="frame title-frame">
      <div class="scn t-scn">
        <div class="rays" aria-hidden="true"></div>
        <div class="t-inner">
          <div class="t-mark" v-html="mark" aria-hidden="true"></div>
          <h1 class="logo"><span class="l1">DOOT</span><span class="l2">DOOT</span><span class="l3">REVOLUTION</span></h1>
          <div class="t-arrows" aria-hidden="true"><div class="a" v-for="(a, i) in arrows" :key="i" v-html="a"></div></div>
          <button class="press" @click="start">PRESS START</button>
        </div>
        <div class="t-foot"><span class="tf-src">v2.0 &middot; open source <GithubLink :size="28" /></span><span>{{ foot }}</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { go } from '../game/screen.js';
import { arrowSVG, LANE_DIRS } from '@doot-games/render';
import { useScope } from '../composables/useNavigation.js';
import GithubLink from '../components/GithubLink.vue';
import { DOOT_LOGO } from '../game/logo.js';

const mark = DOOT_LOGO;
const arrows = LANE_DIRS.map((d) => arrowSVG(d));
const foot = '/songs · ready';
const start = () => go('select');

// controller/keyboard: confirm starts, so the mouse is optional here too
useScope({ confirm: start, cancel: () => {} });
</script>

<style scoped>
.title-wrap { display: grid; place-items: center; padding: clamp(10px, 2vw, 22px); }
/* keep the 16:9 attract frame inside the viewport on any aspect ratio */
.title-frame { width: min(100%, calc((100dvh - 44px) * 1.777)); max-height: 100%; }
.tf-src { display: inline-flex; align-items: center; gap: 7px; }
.t-mark { width: clamp(60px, 9vw, 92px); height: clamp(60px, 9vw, 92px); margin: 0 auto clamp(6px, 1.4vh, 14px); filter: drop-shadow(0 5px 0 rgba(34, 32, 63, .25)); }
</style>
