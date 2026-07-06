// useFocusPause: when the window is not the player's focused, visible window, stop the
// sound and freeze the run, so a song does not keep playing to an empty room while the
// player is in another app, tab, or the macOS Mission Control / Spaces overview.
// Suspending the shared AudioContext silences everything (music, previews, hits) and
// freezes the song clock; session.pause halts the render/judge loop so it does not
// simulate against a frozen clock. Being truly focused again resumes both in sync.
//
// The events lie. macOS fires a stray focus while Mission Control is open and when you
// click a different window from the overview, so trusting a focus event to mean "we are
// back" would resume audio into the background. So every event just re-reads the real
// state: keep playing only when the document is both visible and actually holds focus
// (document.hasFocus()). Any spurious focus that arrives without real focus re-suspends.
//
// Gated on the pauseOnBlur setting. We only ever suspend a context we can see, and only
// resume a suspend we caused, so toggling the setting off still restores the audio.

import { engine } from '../game/singletons.js';
import { settings } from '../game/settings.js';
import { session } from './useSession.js';

let wired = false;

export function useFocusPause() {
  if (wired || typeof window === 'undefined') return;
  wired = true;

  let suspended = false;

  const focused = () => document.visibilityState !== 'hidden' && document.hasFocus();

  const suspend = () => {
    if (suspended || !engine.ctx) return;
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

  // Recompute from the real focus/visibility state on every event, rather than trusting
  // the event's direction. This self-corrects through the focus churn macOS emits during
  // Mission Control, Spaces, and cross-window clicks.
  const sync = () => { if (settings.pauseOnBlur && !focused()) suspend(); else restore(); };

  window.addEventListener('blur', sync);
  window.addEventListener('focus', sync);
  window.addEventListener('pageshow', sync);
  window.addEventListener('pagehide', sync);
  document.addEventListener('visibilitychange', sync);
}
