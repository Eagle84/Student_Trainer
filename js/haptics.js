/**
 * A short buzz when an answer is right.
 *
 * Its own module, tiny as it is, because it is the only place in the app that
 * touches hardware and it has three things to get right that are easy to get
 * wrong at a call site: the API does not exist everywhere, it throws in some
 * embeddings, and a student must be able to turn it off.
 *
 * WHERE IT WORKS. `navigator.vibrate` is Android — Chrome, Firefox, Samsung
 * Internet. **iPhone and iPad do not support it at all**, in any browser,
 * including Chrome on iOS: every iOS browser runs on WebKit, which has never
 * shipped the Vibration API. There is no polyfill, because the capability is
 * simply not exposed to a web page there. On those devices this is silently a
 * no-op, and that is the whole story — nothing to fix, nothing to detect
 * beyond the feature check below.
 *
 * Desktop reports no support either, so nothing happens there.
 */

/**
 * Twenty milliseconds: a tick, not a buzz.
 *
 * Long enough to feel through a hand holding the phone, short enough that a
 * ספרינט answering thirty questions in a minute is thirty taps rather than a
 * minute of rattling. Anything past about 50ms stops reading as feedback and
 * starts reading as an alert.
 */
const CORRECT_MS = 20;

/** Off means off: the preference is read on every call, not cached at boot. */
let enabled = true;

export function setHapticsEnabled(on) {
  enabled = Boolean(on);
}

export function hapticsEnabled() {
  return enabled;
}

/** True when this device can actually vibrate. */
export function hapticsSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Buzzes for a correct answer. Never throws.
 *
 * Silently does nothing when unsupported, switched off, or when the browser
 * refuses — some embeddings expose `vibrate` and then reject the call, and a
 * quiz must not break because a phone declined to buzz.
 */
export function vibrateCorrect() {
  if (!enabled || !hapticsSupported()) return false;
  try {
    // Returns false when the browser ignores the request, e.g. with no prior
    // user gesture. Answering IS a tap, so that path is not expected here.
    return navigator.vibrate(CORRECT_MS) !== false;
  } catch {
    return false;
  }
}

export { CORRECT_MS };
