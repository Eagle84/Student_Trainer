/**
 * Schematic geometry diagrams for math questions.
 *
 * Pure: returns an SVG STRING built only from the generator's numbers (no user
 * input), so it is safe to inject as innerHTML. Colours come from CSS classes,
 * so both themes and RTL just work. Diagrams are schematic, not to scale — the
 * labelled numbers carry the information, exactly like a textbook sketch.
 *
 * A generator adds `diagram: { shape, ... }` to its output; renderDiagram turns
 * that into SVG. An unknown or missing shape yields '' (no diagram shown).
 */

import { renderVisual, visualShapes } from './visuals.js';

function frame(inner, w, h) {
  return `<svg viewBox="0 0 ${w} ${h}" class="dgm" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${inner}</svg>`;
}

function label(x, y, text) {
  return `<text x="${x}" y="${y}" class="dgm-label" text-anchor="middle" dominant-baseline="middle">${text}</text>`;
}

/** Rectangle — used for both area and perimeter questions. */
function rectangle({ w, h }) {
  const inner =
    `<rect x="46" y="30" width="168" height="92" rx="2" class="dgm-shape"/>` +
    label(130, 140, `${w} ס"מ`) +
    label(26, 76, `${h} ס"מ`);
  return frame(inner, 260, 158);
}

/** Triangle with a base and the height to it (dashed, right-angle marked). */
function triangle({ base, height }) {
  const inner =
    `<polygon points="82,28 30,126 226,126" class="dgm-shape"/>` +
    `<line x1="82" y1="28" x2="82" y2="126" class="dgm-dash"/>` +
    `<path d="M70 126 L70 114 L82 114" class="dgm-right"/>` +
    label(128, 150, `בסיס = ${base} ס"מ`) +
    label(54, 78, `גובה = ${height}`);
  return frame(inner, 260, 166);
}

/** Triangle with two known angles and the third unknown. */
function angleTriangle({ a, b }) {
  const inner =
    `<polygon points="132,26 30,132 234,132" class="dgm-shape"/>` +
    label(66, 120, `${a}°`) +
    label(198, 120, `${b}°`) +
    label(132, 58, '?');
  return frame(inner, 264, 150);
}

/** Cuboid (box) for volume questions, with three edge labels. */
function box({ a, b, c }) {
  const inner =
    // back face (edges only) then connectors then front face on top
    `<rect x="70" y="24" width="130" height="86" class="dgm-edge"/>` +
    `<line x1="40" y1="54" x2="70" y2="24" class="dgm-edge"/>` +
    `<line x1="170" y1="54" x2="200" y2="24" class="dgm-edge"/>` +
    `<line x1="170" y1="140" x2="200" y2="110" class="dgm-edge"/>` +
    `<line x1="40" y1="140" x2="70" y2="110" class="dgm-edge"/>` +
    `<rect x="40" y="54" width="130" height="86" class="dgm-shape"/>` +
    label(105, 154, `${a} ס"מ`) +
    label(22, 97, `${b} ס"מ`) +
    label(200, 46, `${c} ס"מ`);
  return frame(inner, 240, 168);
}

const SHAPES = { rectangle, triangle, angleTriangle, box };

/**
 * Returns an SVG string for the spec, or '' when there is nothing to draw.
 *
 * Shapes this module does not know are handed to js/visuals.js. That module was
 * written for lesson cards, but a clock, a ruler, a number line or a pie chart
 * illustrates a QUESTION just as well — and the alternative was maintaining two
 * near-identical clocks. This module keeps the four geometry shapes because
 * they have their own dimensioning conventions and their own tests.
 */
export function renderDiagram(spec) {
  if (!spec) return '';
  if (SHAPES[spec.shape]) return SHAPES[spec.shape](spec);
  return renderVisual(spec);
}

/** Every shape renderDiagram can draw — the geometry set plus every lesson
 *  visual. Lesson content is validated against this, not against either half. */
export function diagramShapes() {
  return [...Object.keys(SHAPES), ...visualShapes()];
}

/**
 * Derives a diagram spec for a BANK geometry question from its topic and the
 * numbers in its text. Generated questions carry their own diagram; bank rows
 * do not, so this reconstructs one from the known question formats. Returns
 * null when the topic is not geometry or the numbers don't line up (then no
 * diagram is shown — a safe degrade).
 */
export function diagramFromBank(topic, text) {
  const nums = (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number);
  switch (topic) {
    case 'גיאומטריה - שטח משולש':
      return nums.length >= 2 ? { shape: 'triangle', base: nums[0], height: nums[1] } : null;
    case 'גיאומטריה - שטח':
    case 'היקף מלבן':
      return nums.length >= 2 ? { shape: 'rectangle', w: nums[0], h: nums[1] } : null;
    case 'זוויות במשולש':
      return nums.length >= 2 ? { shape: 'angleTriangle', a: nums[0], b: nums[1] } : null;
    case 'נפח תיבה':
      return nums.length >= 3 ? { shape: 'box', a: nums[0], b: nums[1], c: nums[2] } : null;
    default:
      return null;
  }
}
