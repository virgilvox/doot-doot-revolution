import { createRouter, createWebHashHistory } from 'vue-router';

// Hash history so one build runs as a static site and inside Electron without a
// server catch-all. The app opens on the Title (attract) screen.
const routes = [
  { path: '/', redirect: '/title' },
  { path: '/title', name: 'title', component: () => import('../views/TitleView.vue') },
  { path: '/select', name: 'select', component: () => import('../views/SelectView.vue') },
  { path: '/game', name: 'game', component: () => import('../views/GameView.vue') },
  { path: '/results', name: 'results', component: () => import('../views/ResultsView.vue') },
  { path: '/add', name: 'add', component: () => import('../views/AddView.vue') },
  { path: '/library', name: 'library', component: () => import('../views/LibraryView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
  { path: '/pads', name: 'pads', component: () => import('../views/PadsView.vue') }
];

export const router = createRouter({ history: createWebHashHistory(), routes });
