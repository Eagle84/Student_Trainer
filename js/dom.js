/**
 * The two DOM primitives shared by every rendering module.
 *
 * They were private to ui.js until the lesson screens needed them too.
 * Duplicating them would have been the start of two element builders drifting
 * apart, so they live here and both ui.js and ui-lesson.js import them.
 */

/** document.getElementById, shortened — every screen looks elements up by id. */
export const $ = id => document.getElementById(id);

/**
 * Builds an element from options and children.
 *
 * `text` uses textContent, never innerHTML: anything a student typed reaches
 * the page through this function, and there is no path here that parses markup.
 * Falsy children are skipped so callers can inline conditionals.
 */
export function el(tag, opts = {}, ...kids) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.dir) node.dir = opts.dir;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  for (const kid of kids) if (kid) node.appendChild(kid);
  return node;
}
