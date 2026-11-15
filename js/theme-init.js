/**
 * Runs before paint (classic script in <head>) so the saved theme is applied
 * with no flash of the wrong colours. Kept tiny and dependency-free; the rest
 * of the theme logic lives in the app modules. CSP-safe: external 'self'
 * script, not inline.
 */
(function () {
  try {
    var saved = localStorage.getItem('student_trainer_theme');
    if (saved !== 'dark' && saved !== 'light') {
      saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', saved);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  // Device class: phone / tablet / desktop. Set from viewport width, but a
  // touch (coarse) pointer downgrades a wide screen to 'tablet' so touch layouts
  // and larger targets apply. Kept in sync on resize/rotate.
  function detectDevice() {
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var dev = w >= 1024 ? 'desktop' : (w >= 640 ? 'tablet' : 'phone');
    if (dev === 'desktop' && coarse) dev = 'tablet';
    document.documentElement.setAttribute('data-device', dev);
  }
  try {
    detectDevice();
    window.addEventListener('resize', detectDevice);
  } catch (e) { /* ignore */ }
})();
