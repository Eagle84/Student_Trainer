/**
 * HTML sanitizer for every innerHTML sink that renders database- or
 * bank-sourced content.
 *
 * Why this exists: question text, answer options, and explanations legitimately
 * contain a tiny set of formatting/math markup (`<span class="math-frac">`,
 * `<strong>`, `<span dir="ltr">`). They cannot simply be escaped or the math
 * renders as literal tags. But some of that content — the rows in
 * `attempt_errors` — is insertable by any anonymous client (the anon key is
 * public), so it is untrusted. Sanitizing on render keeps the legitimate markup
 * and strips scripts, event handlers, and every other injection vector.
 *
 * DOMPurify (Cure53) is loaded as a global by index.html with an SRI hash.
 * If it is ever missing (blocked CDN, CSP failure) we FAIL CLOSED: escape the
 * string so it renders as inert text rather than as raw, unsanitized HTML.
 */

/** Allowlist: only formatting and math/direction markup survives. */
const CONFIG = {
  ALLOWED_TAGS: ['span', 'strong', 'em', 'b', 'i', 'br', 'sub', 'sup'],
  ALLOWED_ATTR: ['class', 'dir'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A run of arithmetic: two or more operands joined by operators.
 *
 * Requires an operator, so a lone number — "20 ליטר", a date, a grade — is left
 * alone. Operands may carry a short Latin prefix so "x1=2, x2=-2" is caught as
 * ONE run: split into two, the comma between them is a neutral character and
 * the bidi algorithm is free to move it.
 *
 * Hebrew letters are outside A-Za-z, so "ל-60%" cannot start a run: the hyphen
 * has no operand before it.
 */
// An operand never ENDS on a dot or comma, so the full stop that closes a
// sentence stays in the sentence: "9×9=81." must not pull the period into the
// isolate. A leading sign is part of the operand, so "x1=2, x2=-2" is one run
// rather than two with a loose comma between them for the bidi algorithm to
// move.
// Brackets belong to the operand they wrap, so "(2×3)/(3×4)" is one run. Left
// outside, each bracketed group isolated separately and the parentheses and
// the divide between them stayed bare — free for the bidi algorithm to move.
const OPERAND = String.raw`\(*[A-Za-z]{0,2}[-+]?(?:\d[\d.,]*\d|\d)%?\)*`;
const MATH_RUN = new RegExp(`${OPERAND}(?:\\s*[-+×÷*/=^(),]\\s*${OPERAND})+`, 'g');

/** Every arithmetic run in a plain string, as [start, end) pairs. Pure. */
export function mathRuns(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(MATH_RUN)) {
    out.push([m.index, m.index + m[0].length]);
  }
  return out;
}

/** True if this node already sits inside something bidi-isolated. */
function alreadyIsolated(node) {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (el.dir === 'ltr' || el.hasAttribute?.('dir')) return true;
    const cls = el.className || '';
    if (typeof cls === 'string' && /\bmath-(inline|frac|expr)\b|\blang-ltr\b/.test(cls)) return true;
  }
  return false;
}

/**
 * Wraps bare arithmetic in `.math-inline`, which is `direction: ltr;
 * unicode-bidi: isolate`.
 *
 * Without it, an LTR run inside an RTL paragraph is laid out right-to-left:
 * "5^9" displays as "9^5" and "4 + 5 = 9" as "9 = 5 + 4". The student is shown
 * a different expression than the one being scored, and is marked wrong for the
 * answer the app itself calls correct.
 *
 * Done here, at the single sink every bank row, generated question and stored
 * error already passes through, rather than at the dozens of places that
 * compose the strings. That matters for two reasons the alternatives cannot
 * reach: 56 of the first thousand bank rows carry bare math and could only be
 * corrected by a data migration, and the same text is COPIED into
 * attempt_errors when a student gets one wrong — so a migration would still
 * leave every past mistake displaying backwards. Fixing it on render repairs
 * the history too, and cannot be bypassed by a generator that forgets.
 */
function isolateMath(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!/\d/.test(n.nodeValue) || alreadyIsolated(n)) continue;
    const runs = mathRuns(n.nodeValue);
    if (runs.length) targets.push([n, runs]);
  }

  for (const [node, runs] of targets) {
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();
    let at = 0;
    for (const [start, end] of runs) {
      if (start > at) frag.appendChild(document.createTextNode(text.slice(at, start)));
      const span = document.createElement('span');
      span.className = 'math-inline';
      span.textContent = text.slice(start, end);
      frag.appendChild(span);
      at = end;
    }
    if (at < text.length) frag.appendChild(document.createTextNode(text.slice(at)));
    node.parentNode.replaceChild(frag, node);
  }
}

/** Returns HTML safe to assign to innerHTML, with its math bidi-isolated. */
export function sanitize(html) {
  const purifier = typeof window !== 'undefined' ? window.DOMPurify : undefined;
  if (!purifier || typeof purifier.sanitize !== 'function') {
    // Fail closed — never emit unsanitized markup.
    return escapeHtml(html);
  }
  const clean = purifier.sanitize(String(html ?? ''), CONFIG);
  if (typeof document === 'undefined') return clean;
  // Parsed, not regexed: the string is already sanitized, so this walks a real
  // tree and can tell text from markup instead of guessing at angle brackets.
  const tpl = document.createElement('template');
  tpl.innerHTML = clean;
  isolateMath(tpl.content);
  return tpl.innerHTML;
}
