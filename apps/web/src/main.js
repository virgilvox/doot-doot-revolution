import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { mountCss, mountFonts } from '@doot-games/ui';
import App from './App.vue';
import { router } from './router/index.js';
import './styles/app.css';

// The arcade candy stylesheet and web fonts come from the shared ui package, so
// the Vue app looks identical to the packages' own components.
mountFonts(document);
mountCss(document);

createApp(App).use(createPinia()).use(router).mount('#app');
