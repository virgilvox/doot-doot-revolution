// useFocusPause: when the window loses focus, stop the sound and freeze the run, so a
// song does not keep playing to an empty room while the player is in another app or tab.
// Suspending the shared AudioContext silences everything (music, previews, hits) and
// freezes the song clock; session.pause halts the render/judge loop so it does not
// simulate against a frozen clock. Regaining focus resumes both in sync. The whole
// behavior is gated on the pauseOnBlur setting, and we only ever resume a suspend we
// caused, so toggling the setting off mid-pause still lets focus restore the audio.

import { engine } from '../game/singletons.js';
import { settings } from '../game/settings.js';
import { session } from './useSession.js';

let wired = false;

export function useFocusPause() {
  if (wired || typeof window === 'undefined') return;
  wired = true;

  let suspended = false;

  const suspend = () => {
    if (suspended || !settings.pauseOnBlur || !engine.ctx) return;
    suspended = true;
    session.pause();
    engine.suspend();
  };
  const restore = () => {
    if (!suspended) return;
    suspended = false;
    engine.resume();
    session.resume();
  };

  // window blur/focus catches switching to another application while the tab is still
  // visible; visibilitychange catches tab switches and minimizing. The suspended guard
  // dedupes the overlap between the two.
  window.addEventListener('blur', suspend);
  window.addEventListener('focus', restore);
  document.addEventListener('visibilitychange', () => (document.hidden ? suspend() : restore()));
}
