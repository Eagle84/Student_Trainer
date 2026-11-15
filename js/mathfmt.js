/**
 * Math formatting helpers and RNG utilities.
 * Pure: no DOM, no network, no globals. Safe to import from Node.
 */

/** Renders a stacked fraction using the .math-frac styles in css/styles.css. */
export function frac(top, bottom) {
  return `<span class="math-frac"><span class="top">${top}</span><span class="bottom">${bottom}</span></span>`;
}

/** Renders an inline monospace LTR math expression inside RTL text. */
export function inline(text) {
  return `<span class="math-inline">${text}</span>`;
}

/**
 * Wraps a multi-part expression (fractions joined by operators) so the whole
 * thing reads LEFT-TO-RIGHT as one unit inside RTL prose.
 *
 * Without this the parts flow right-to-left, so a non-commutative expression
 * like "a ÷ b" displays as "b ÷ a" — the student sees a different problem than
 * the one being scored. Each fraction is already bidi-isolated internally; this
 * isolates their ORDER too.
 */
export function expr(html) {
  return `<span class="math-expr">${html}</span>`;
}

/** Random integer in [min, max], both inclusive. */
export function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Fisher-Yates. Returns a new array; the input is never mutated. */
export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
