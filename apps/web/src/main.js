import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './game/settings.js';
import './styles/design.css';
import './styles/app.css';

// No router: screens are swapped by state (see game/screen.js), so there are no
// URLs to keep in sync and the browser history stays out of the game. The arcade
// candy design system is a normal Vite-processed stylesheet (design.css); app.css
// adds the shell layout on top.
createApp(App).use(createPinia()).mount('#app');
