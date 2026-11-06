/**
 * Schematic visuals for lesson cards.
 *
 * Same contract as js/diagrams.js: pure functions returning an SVG STRING,
 * built only from the lesson author's own numbers, so it is safe to inject as
 * innerHTML. Colours come from CSS classes, so both themes and RTL just work.
 *
 * CSP: the page runs under `style-src 'self'` with no 'unsafe-inline', so an
 * SVG assembled as markup MUST NOT carry a style="" attribute. Everything here
 * uses presentation attributes (x, width, stroke-dasharray) and classes only.
 * tests/visuals.test.js enforces that.
 *
 * A `highlight` field marks the part a lesson step is talking about; the step
 * re-renders the visual with a different highlight rather than mutating it, so
 * these stay pure and there is no DOM state to keep in sync.
 */

function frame(inner, w, h, label) {
  const aria = label
    ? `role="img" aria-label="${esc(label)}"`
    : 'aria-hidden="true"';
  return `<svg viewBox="0 0 ${w} ${h}" class="vz" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" ${aria}>${inner}</svg>`;
}

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function text(x, y, value, cls = 'vz-label') {
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="middle" dominant-baseline="middle">${esc(value)}</text>`;
}

/**
 * One or more fraction bars, stacked. Each bar is `den` equal cells with the
 * first `num` shaded — the picture that makes "you cannot add unlike parts"
 * obvious before any rule is stated.
 *
 * highlight: index of the bar to outline, or -1 for none.
 */
function fractionBar({ bars = [], highlight = -1 }) {
  const W = 300;
  const barW = 210;
  const x0 = 66;
  const rowH = 46;
  const cellH = 32;

  const rows = bars.map((bar, i) => {
    const den = Math.max(1, Number(bar.den) || 1);
    const num = Math.max(0, Math.min(den, Number(bar.num) || 0));
    const y = 16 + i * rowH;
    const cellW = barW / den;

    let cells = '';
    for (let c = 0; c < den; c++) {
      const cls = c < num ? 'vz-cell on' : 'vz-cell';
      cells += `<rect x="${round(x0 + c * cellW)}" y="${y}" width="${round(cellW)}" height="${cellH}" class="${cls}"/>`;
    }
    const ring = i === highlight
      ? `<rect x="${x0 - 3}" y="${y - 3}" width="${barW + 6}" height="${cellH + 6}" rx="4" class="vz-ring"/>`
      : '';
    const caption = `<text x="${x0 - 12}" y="${y + cellH / 2}" class="vz-label" text-anchor="end" dominant-baseline="middle">${esc(bar.label ?? `${num}/${den}`)}</text>`;
    return cells + ring + caption;
  }).join('');

  return frame(rows, W, 16 + bars.length * rowH,
    bars.map(b => `${b.num} מתוך ${b.den}`).join(', '));
}

function round(n) {
  return Math.round(n * 100) / 100;
}

/**
 * A 10x10 grid with `percent` squares filled. One percent is literally one
 * square, which is the whole point: "אחוז" means "מתוך מאה" and the grid says
 * so without a sentence.
 */
function percentGrid({ percent = 0, caption = '' }) {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const cell = 22;
  const gap = 2;
  const size = 10 * (cell + gap);

  let cells = '';
  for (let i = 0; i < 100; i++) {
    const row = Math.floor(i / 10);
    const col = i % 10;
    const cls = i < p ? 'vz-cell on' : 'vz-cell';
    cells += `<rect x="${col * (cell + gap)}" y="${row * (cell + gap)}" width="${cell}" height="${cell}" rx="2" class="${cls}"/>`;
  }
  const label = caption
    ? text(size / 2, size + 20, caption)
    : text(size / 2, size + 20, `${p} מתוך 100`);

  return frame(cells + label, size, size + 34, `${p} אחוז מתוך מאה`);
}

/**
 * A balance scale. An equation is a claim that two sides weigh the same, and
 * every legal move is one you make to BOTH pans — this is that idea as a
 * picture. `tilt` shows what happens when you only touch one side.
 */
function balance({ left = '', right = '', tilt = 0 }) {
  const W = 300;
  const H = 170;
  const cx = W / 2;
  const drop = Math.max(-14, Math.min(14, Number(tilt) || 0));

  const beamY = 52;
  const leftY = beamY + drop;
  const rightY = beamY - drop;
  const panW = 96;

  const inner =
    `<line x1="${cx - 96}" y1="${leftY}" x2="${cx + 96}" y2="${rightY}" class="vz-beam"/>` +
    `<circle cx="${cx}" cy="${beamY}" r="6" class="vz-pivot"/>` +
    `<polygon points="${cx},${beamY} ${cx - 26},${H - 22} ${cx + 26},${H - 22}" class="vz-stand"/>` +
    `<line x1="${cx - 132}" y1="${H - 22}" x2="${cx + 132}" y2="${H - 22}" class="vz-ground"/>` +
    // pans
    `<line x1="${cx - 96}" y1="${leftY}" x2="${cx - 96}" y2="${leftY + 26}" class="vz-line"/>` +
    `<rect x="${cx - 96 - panW / 2}" y="${leftY + 26}" width="${panW}" height="34" rx="6" class="vz-pan"/>` +
    text(cx - 96, leftY + 43, left, 'vz-pan-text') +
    `<line x1="${cx + 96}" y1="${rightY}" x2="${cx + 96}" y2="${rightY + 26}" class="vz-line"/>` +
    `<rect x="${cx + 96 - panW / 2}" y="${rightY + 26}" width="${panW}" height="34" rx="6" class="vz-pan"/>` +
    text(cx + 96, rightY + 43, right, 'vz-pan-text');

  return frame(inner, W, H, `מאזניים: ${left} מול ${right}`);
}

/**
 * A past/now timeline for English tense. `highlight` is 'past' or 'now'.
 * The verb form sits on the point in time it describes, which is the single
 * idea a tense lesson has to land.
 */
function verbTimeline({ past = '', now = '', highlight = '' }) {
  const W = 320;
  const H = 130;
  const y = 62;
  const pastX = 74;
  const nowX = 246;

  const dot = (x, on) => `<circle cx="${x}" cy="${y}" r="${on ? 11 : 8}" class="vz-node${on ? ' on' : ''}"/>`;

  const inner =
    `<line x1="30" y1="${y}" x2="${W - 30}" y2="${y}" class="vz-line"/>` +
    `<polygon points="${W - 30},${y} ${W - 42},${y - 6} ${W - 42},${y + 6}" class="vz-arrow"/>` +
    dot(pastX, highlight === 'past') +
    dot(nowX, highlight === 'now') +
    text(pastX, y - 30, 'PAST', 'vz-tag') +
    text(nowX, y - 30, 'NOW', 'vz-tag') +
    text(pastX, y + 32, past, 'vz-word') +
    text(nowX, y + 32, now, 'vz-word');

  return frame(inner, W, H, `ציר זמן: ${past} בעבר, ${now} בהווה`);
}

/**
 * A Hebrew root with the words built from it radiating out. `highlight` is the
 * index of the word a step is discussing.
 */
function rootTree({ root = '', words = [], highlight = -1 }) {
  const W = 320;
  const H = 190;
  const cx = W / 2;
  const cy = 44;

  const shown = words.slice(0, 4);
  const slotW = W / (shown.length || 1);

  let spokes = '';
  shown.forEach((word, i) => {
    const x = slotW * (i + 0.5);
    const yTop = 116;
    const on = i === highlight;
    spokes +=
      `<line x1="${cx}" y1="${cy + 22}" x2="${round(x)}" y2="${yTop - 4}" class="vz-line"/>` +
      `<rect x="${round(x - slotW / 2 + 8)}" y="${yTop}" width="${round(slotW - 16)}" height="34" rx="8" class="vz-node-box${on ? ' on' : ''}"/>` +
      text(round(x), yTop + 17, word, 'vz-word');
  });

  const inner =
    `<rect x="${cx - 58}" y="${cy - 22}" width="116" height="44" rx="10" class="vz-root"/>` +
    text(cx, cy, root, 'vz-root-text') +
    spokes;

  return frame(inner, W, H, `השורש ${root} והמילים הנגזרות ממנו`);
}

/**
 * A number line. The one visual that keeps earning its keep: negatives, order,
 * decimals, absolute value and inequalities are all "where does it sit".
 *
 * points: [{ at, label, on }] — `on` marks the one being discussed.
 */
function numberLine({ from = 0, to = 10, step = 1, points = [], caption = '' }) {
  const W = 320;
  const H = caption ? 110 : 86;
  const pad = 26;
  const y = 46;
  const span = (Number(to) - Number(from)) || 1;
  const x = v => pad + ((Number(v) - Number(from)) / span) * (W - pad * 2);

  let ticks = '';
  // Guard the loop: a step of zero or a reversed range would spin forever.
  const stepSize = Math.abs(Number(step)) || 1;
  const count = Math.min(40, Math.floor(span / stepSize));
  for (let i = 0; i <= count; i++) {
    const value = Number(from) + i * stepSize;
    const at = round(x(value));
    ticks += `<line x1="${at}" y1="${y - 6}" x2="${at}" y2="${y + 6}" class="vz-line"/>`
      + text(at, y + 20, String(round(value)), 'vz-tick');
  }

  const dots = points.map(p => {
    const at = round(x(p.at));
    return `<circle cx="${at}" cy="${y}" r="${p.on ? 9 : 6}" class="vz-node${p.on ? ' on' : ''}"/>`
      + (p.label ? text(at, y - 20, p.label, 'vz-word') : '');
  }).join('');

  const inner =
    `<line x1="${pad - 12}" y1="${y}" x2="${W - pad + 12}" y2="${y}" class="vz-axis"/>` +
    `<polygon points="${W - pad + 12},${y} ${W - pad},${y - 5} ${W - pad},${y + 5}" class="vz-arrow"/>` +
    `<polygon points="${pad - 12},${y} ${pad},${y - 5} ${pad},${y + 5}" class="vz-arrow"/>` +
    ticks + dots + (caption ? text(W / 2, H - 12, caption) : '');

  return frame(inner, W, H, caption || `ציר מספרים מ-${from} עד ${to}`);
}

/**
 * A coordinate plane carrying any of: points, a straight line, a parabola, a
 * circle. One builder rather than four because they share the axes, the scale
 * and the clipping — and a lesson often wants two of them at once.
 */
function coordPlane({ range = 6, points = [], line = null, parabola = null, circle: circleSpec = null, caption = '' }) {
  const W = 300;
  const H = caption ? 322 : 300;
  const pad = 14;
  const size = W - pad * 2;
  const r = Math.abs(Number(range)) || 6;
  const cx = pad + size / 2;
  const cy = pad + size / 2;
  const unit = size / (2 * r);
  const px = v => cx + Number(v) * unit;
  const py = v => cy - Number(v) * unit;

  let grid = '';
  for (let i = -r; i <= r; i++) {
    grid += `<line x1="${round(px(i))}" y1="${pad}" x2="${round(px(i))}" y2="${pad + size}" class="vz-grid"/>`
      + `<line x1="${pad}" y1="${round(py(i))}" x2="${pad + size}" y2="${round(py(i))}" class="vz-grid"/>`;
  }
  const axes =
    `<line x1="${pad}" y1="${round(cy)}" x2="${pad + size}" y2="${round(cy)}" class="vz-axis"/>` +
    `<line x1="${round(cx)}" y1="${pad}" x2="${round(cx)}" y2="${pad + size}" class="vz-axis"/>`;

  // Curves are sampled and clipped to the visible box rather than solved for
  // their intercepts — sampling handles every shape with one code path.
  const inside = v => v >= -r - 0.001 && v <= r + 0.001;
  const sample = f => {
    const runs = [];
    let run = [];
    for (let i = 0; i <= 240; i++) {
      const xv = -r + (i / 240) * 2 * r;
      const yv = f(xv);
      if (Number.isFinite(yv) && inside(yv)) run.push(`${round(px(xv))},${round(py(yv))}`);
      else if (run.length) { runs.push(run); run = []; }
    }
    if (run.length) runs.push(run);
    return runs.filter(p => p.length > 1)
      .map(p => `<polyline points="${p.join(' ')}" class="vz-curve"/>`).join('');
  };

  let curves = '';
  if (line) curves += sample(xv => Number(line.m) * xv + Number(line.b));
  if (parabola) curves += sample(xv => Number(parabola.a) * xv * xv + Number(parabola.b ?? 0) * xv + Number(parabola.c ?? 0));
  if (circleSpec) {
    curves += `<circle cx="${round(px(circleSpec.cx ?? 0))}" cy="${round(py(circleSpec.cy ?? 0))}" r="${round(Math.abs(Number(circleSpec.r)) * unit)}" class="vz-curve vz-nofill"/>`;
  }

  const dots = points.map(p =>
    `<circle cx="${round(px(p.x))}" cy="${round(py(p.y))}" r="${p.on ? 7 : 5}" class="vz-node${p.on ? ' on' : ''}"/>`
    + (p.label ? text(round(px(p.x)), round(py(p.y)) - 15, p.label, 'vz-word') : '')).join('');

  return frame(grid + axes + curves + dots + (caption ? text(W / 2, H - 10, caption) : ''),
    W, H, caption || 'מערכת צירים');
}

/** Right triangle with its legs and hypotenuse labelled — Pythagoras and trig. */
function rightTriangle({ a = 3, b = 4, c = '', angle = '', caption = '' }) {
  const W = 300;
  const H = 200;
  const x0 = 56;
  const y0 = 150;
  const w = 172;
  const h = 108;

  const inner =
    `<polygon points="${x0},${y0} ${x0 + w},${y0} ${x0},${y0 - h}" class="vz-shape"/>` +
    `<path d="M${x0} ${y0 - 14} L${x0 + 14} ${y0 - 14} L${x0 + 14} ${y0}" class="vz-right"/>` +
    text(x0 + w / 2, y0 + 22, String(a)) +
    text(x0 - 22, y0 - h / 2, String(b)) +
    text(x0 + w / 2 + 16, y0 - h / 2 - 10, String(c)) +
    (angle ? text(x0 + w - 34, y0 - 16, String(angle), 'vz-tag') : '') +
    (caption ? text(W / 2, H - 10, caption) : '');

  return frame(inner, W, H, caption || `משולש ישר זווית עם ניצבים ${a} ו-${b}`);
}

/** Trapezoid with both parallel sides and the height. */
function trapezoid({ a = 6, b = 10, h = 4, caption = '' }) {
  const W = 280;
  const H = 190;
  const inner =
    `<polygon points="80,40 200,40 236,132 44,132" class="vz-shape"/>` +
    `<line x1="140" y1="40" x2="140" y2="132" class="vz-dash"/>` +
    `<path d="M128 132 L128 120 L140 120" class="vz-right"/>` +
    text(140, 26, `בסיס עליון = ${a}`) +
    text(140, 152, `בסיס תחתון = ${b}`) +
    text(160, 86, `גובה = ${h}`) +
    (caption ? text(W / 2, H - 8, caption) : '');
  return frame(inner, W, H, `טרפז עם בסיסים ${a} ו-${b} וגובה ${h}`);
}

/** A rows x cols dot array — multiplication seen as area rather than as a
 *  string to memorise. Capped so a large product stays legible. */
function arrayGrid({ rows = 3, cols = 4, caption = '' }) {
  const rn = Math.max(1, Math.min(12, Math.round(Number(rows)) || 1));
  const cn = Math.max(1, Math.min(12, Math.round(Number(cols)) || 1));
  const cell = 22;
  const gap = 4;
  const w = cn * (cell + gap);
  const h = rn * (cell + gap);

  let cells = '';
  for (let r = 0; r < rn; r++) {
    for (let c = 0; c < cn; c++) {
      cells += `<rect x="${c * (cell + gap)}" y="${r * (cell + gap)}" width="${cell}" height="${cell}" rx="4" class="vz-cell on"/>`;
    }
  }
  const label = caption || `${rn} שורות × ${cn} עמודות = ${rn * cn}`;
  return frame(cells + text(w / 2, h + 18, label), w, h + 30, label);
}

/** A rectangle split in two — the distributive law as one area, counted twice. */
function splitRect({ width = 3, partA = 10, partB = 4, caption = '' }) {
  const W = 300;
  const H = 160;
  const total = Number(partA) + Number(partB) || 1;
  const boxW = 220;
  const aW = round((Number(partA) / total) * boxW);
  const x0 = 46;
  const y0 = 34;
  const h = 74;

  const inner =
    `<rect x="${x0}" y="${y0}" width="${aW}" height="${h}" class="vz-shape"/>` +
    `<rect x="${x0 + aW}" y="${y0}" width="${round(boxW - aW)}" height="${h}" class="vz-shape vz-shape-alt"/>` +
    text(x0 + aW / 2, y0 - 14, String(partA)) +
    text(x0 + aW + (boxW - aW) / 2, y0 - 14, String(partB)) +
    text(x0 - 20, y0 + h / 2, String(width)) +
    text(x0 + aW / 2, y0 + h / 2, `${width}×${partA}`, 'vz-word') +
    text(x0 + aW + (boxW - aW) / 2, y0 + h / 2, `${width}×${partB}`, 'vz-word') +
    text(W / 2, H - 14, caption || `${width} × (${partA} + ${partB})`);

  return frame(inner, W, H, `מלבן מחולק: ${width} כפול ${partA} ועוד ${partB}`);
}

/** A small bar chart, optionally with the mean drawn across it. */
function barChart({ values = [], labels = [], mean = null, caption = '' }) {
  const W = 300;
  const H = 190;
  const pad = 24;
  const baseY = 132;
  const maxH = 96;
  const top = Math.max(1, ...values.map(Number));
  const slot = (W - pad * 2) / (values.length || 1);
  const barW = Math.min(38, slot * 0.62);

  const bars = values.map((v, i) => {
    const h = round((Number(v) / top) * maxH);
    const x = round(pad + slot * i + (slot - barW) / 2);
    return `<rect x="${x}" y="${round(baseY - h)}" width="${round(barW)}" height="${h}" rx="3" class="vz-cell on"/>`
      + text(round(x + barW / 2), baseY - h - 12, String(v), 'vz-tick')
      + text(round(x + barW / 2), baseY + 16, String(labels[i] ?? ''), 'vz-tick');
  }).join('');

  const meanLine = mean == null ? '' :
    `<line x1="${pad - 6}" y1="${round(baseY - (Number(mean) / top) * maxH)}" x2="${W - pad + 6}" y2="${round(baseY - (Number(mean) / top) * maxH)}" class="vz-dash"/>`
    + text(W - pad - 18, round(baseY - (Number(mean) / top) * maxH) - 12, `ממוצע ${mean}`, 'vz-tag');

  const inner =
    `<line x1="${pad - 6}" y1="${baseY}" x2="${W - pad + 6}" y2="${baseY}" class="vz-axis"/>` +
    bars + meanLine + (caption ? text(W / 2, H - 8, caption) : '');
  return frame(inner, W, H, caption || 'תרשים עמודות');
}

/** Successive terms of a sequence with the step between them written on the
 *  arrow — what makes arithmetic and geometric sequences tell themselves apart. */
function sequenceDots({ terms = [], step = '', caption = '' }) {
  const W = 320;
  const H = 130;
  const shown = terms.slice(0, 5);
  const slot = W / (shown.length || 1);
  const y = 56;

  let inner = '';
  shown.forEach((term, i) => {
    const x = round(slot * (i + 0.5));
    inner += `<circle cx="${x}" cy="${y}" r="20" class="vz-node on"/>`
      + text(x, y, String(term), 'vz-word')
      + text(x, y + 34, `a${i + 1}`, 'vz-tick');
    if (i < shown.length - 1) {
      const nx = round(slot * (i + 1.5));
      inner += `<path d="M${x + 22} ${y - 8} Q ${(x + nx) / 2} ${y - 34} ${nx - 22} ${y - 8}" class="vz-curve vz-nofill"/>`
        + text(round((x + nx) / 2), y - 34, String(step), 'vz-tag');
    }
  });
  if (caption) inner += text(W / 2, H - 10, caption);
  return frame(inner, W, H, caption || `סדרה: ${shown.join(', ')}`);
}

/**
 * A pie chart from raw values. Statistics questions talk about "what share of
 * the whole" far more often than about counts, and a ring says that faster than
 * a column does.
 */
function pieChart({ values = [], labels = [], caption = '' }) {
  const W = 300;
  const H = caption ? 240 : 220;
  const cx = 110;
  const cy = 106;
  const r = 88;
  const total = values.reduce((sum, v) => sum + Math.abs(Number(v) || 0), 0) || 1;

  let angle = -Math.PI / 2; // start at twelve o'clock
  let slices = '';
  let legend = '';
  values.forEach((value, i) => {
    const share = Math.abs(Number(value) || 0) / total;
    const sweep = share * Math.PI * 2;
    const end = angle + sweep;
    const x1 = round(cx + r * Math.cos(angle));
    const y1 = round(cy + r * Math.sin(angle));
    const x2 = round(cx + r * Math.cos(end));
    const y2 = round(cy + r * Math.sin(end));
    // A slice larger than half a turn needs the large-arc flag, or the browser
    // draws the short way round and the chart silently loses the majority.
    const large = sweep > Math.PI ? 1 : 0;
    slices += share >= 0.999
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" class="vz-slice vz-slice-${i % 5}"/>`
      : `<path d="M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" class="vz-slice vz-slice-${i % 5}"/>`;

    const ly = 30 + i * 24;
    legend += `<rect x="216" y="${ly - 9}" width="14" height="14" rx="3" class="vz-slice vz-slice-${i % 5}"/>`
      + `<text x="236" y="${ly}" class="vz-tick" text-anchor="start" dominant-baseline="middle">${esc(labels[i] ?? value)} ${Math.round(share * 100)}%</text>`;
    angle = end;
  });

  return frame(slices + legend + (caption ? text(W / 2, H - 10, caption) : ''),
    W, H, caption || 'תרשים עוגה');
}

/** An analogue clock — telling the time is a measurement topic in its own right. */
function clock({ hour = 3, minute = 0, caption = '' }) {
  const size = 200;
  const c = size / 2;
  const r = 86;
  const h = ((Number(hour) % 12) + Number(minute) / 60) * 30; // degrees
  const m = Number(minute) * 6;
  const hand = (deg, len, cls) => {
    const rad = (deg - 90) * Math.PI / 180;
    return `<line x1="${c}" y1="${c}" x2="${round(c + len * Math.cos(rad))}" y2="${round(c + len * Math.sin(rad))}" class="${cls}"/>`;
  };

  let marks = '';
  for (let i = 0; i < 12; i++) {
    const rad = (i * 30 - 90) * Math.PI / 180;
    marks += text(round(c + (r - 16) * Math.cos(rad)), round(c + (r - 16) * Math.sin(rad)),
      String(i === 0 ? 12 : i), 'vz-tick');
  }

  const inner =
    `<circle cx="${c}" cy="${c}" r="${r}" class="vz-dial"/>` +
    marks +
    hand(h, 46, 'vz-hand-hour') +
    hand(m, 68, 'vz-hand-min') +
    `<circle cx="${c}" cy="${c}" r="5" class="vz-pivot"/>` +
    (caption ? text(c, size - 6, caption) : '');

  return frame(inner, size, size, caption || `השעה ${hour}:${String(minute).padStart(2, '0')}`);
}

/**
 * A ruler with a measured segment on it. Length measurement is taught before
 * arithmetic on lengths, and "where does the object start on the ruler" is the
 * whole difficulty.
 */
function ruler({ from = 0, to = 5, units = 10, label = '', caption = '' }) {
  const W = 320;
  const pad = 16;
  // Clamped: past ~40 units the ticks are closer together than a pixel, so the
  // extra markup buys nothing and a careless caller could emit thousands of
  // lines into the page.
  const span = Math.max(1, Math.min(40, Math.round(Number(units)) || 1));
  const step = (W - pad * 2) / span;
  const y = 40;

  let ticks = '';
  for (let i = 0; i <= span; i++) {
    const x = round(pad + i * step);
    const tall = i % 5 === 0;
    ticks += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + (tall ? 18 : 10)}" class="vz-line"/>`;
    if (tall) ticks += text(x, y + 32, String(i), 'vz-tick');
  }

  const x1 = round(pad + Number(from) * step);
  const x2 = round(pad + Number(to) * step);
  const inner =
    `<rect x="${pad}" y="${y}" width="${round(span * step)}" height="34" class="vz-dial"/>` +
    ticks +
    `<line x1="${x1}" y1="${y - 14}" x2="${x2}" y2="${y - 14}" class="vz-measure"/>` +
    `<line x1="${x1}" y1="${y - 20}" x2="${x1}" y2="${y - 8}" class="vz-measure"/>` +
    `<line x1="${x2}" y1="${y - 20}" x2="${x2}" y2="${y - 8}" class="vz-measure"/>` +
    text(round((x1 + x2) / 2), y - 28, label || `${Number(to) - Number(from)} יח׳`) +
    (caption ? text(W / 2, y + 56, caption) : '');

  return frame(inner, W, y + (caption ? 68 : 44), caption || `מדידה מ-${from} עד ${to}`);
}

// --- abstract figures (psychotechnical reasoning) ----------------------

/**
 * One abstract figure, drawn inside a cell of the given size.
 *
 * Psychotechnical shape items are built from a tiny vocabulary — an outline, a
 * rotation, whether it is filled, and how many dots sit inside it — because the
 * whole point is that the rule is inferable. A richer vocabulary would make the
 * items pretty and unsolvable.
 *
 * `rotate` is applied with a transform attribute rather than a style, per the
 * CSP note at the top of this file.
 */
function figureGlyph({ shape = 'square', rotate = 0, fill = false, dots = 0 }, cx, cy, size) {
  const r = size / 2;
  const cls = `vz-fig${fill ? ' vz-fig-on' : ''}`;
  let body;
  if (shape === 'circle') {
    body = `<circle cx="${cx}" cy="${cy}" r="${round(r)}" class="${cls}"/>`;
  } else if (shape === 'triangle') {
    body = `<polygon points="${round(cx)},${round(cy - r)} ${round(cx + r)},${round(cy + r)} ${round(cx - r)},${round(cy + r)}" class="${cls}"/>`;
  } else if (shape === 'arrow') {
    body = `<polygon points="${round(cx - r)},${round(cy - r / 3)} ${round(cx + r / 4)},${round(cy - r / 3)} ${round(cx + r / 4)},${round(cy - r)} ${round(cx + r)},${round(cy)} ${round(cx + r / 4)},${round(cy + r)} ${round(cx + r / 4)},${round(cy + r / 3)} ${round(cx - r)},${round(cy + r / 3)}" class="${cls}"/>`;
  } else if (shape === 'diamond') {
    body = `<polygon points="${round(cx)},${round(cy - r)} ${round(cx + r)},${round(cy)} ${round(cx)},${round(cy + r)} ${round(cx - r)},${round(cy)}" class="${cls}"/>`;
  } else if (shape === 'blank') {
    body = '';
  } else {
    body = `<rect x="${round(cx - r)}" y="${round(cy - r)}" width="${round(size)}" height="${round(size)}" class="${cls}"/>`;
  }

  // Dots are laid out on a fixed ring so the same count always looks the same —
  // a count the student has to re-read on every cell is noise, not a rule.
  let marks = '';
  const n = Math.max(0, Math.min(4, Math.round(Number(dots) || 0)));
  const spots = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < n; i++) {
    marks += `<circle cx="${round(cx + spots[i][0] * r * 0.42)}" cy="${round(cy + spots[i][1] * r * 0.42)}" r="${round(size * 0.07)}" class="vz-fig-dot"/>`;
  }

  const turn = Number(rotate) || 0;
  const inner = body + marks;
  return turn ? `<g transform="rotate(${turn} ${round(cx)} ${round(cy)})">${inner}</g>` : inner;
}

/** A cell outline plus its figure, or a "?" when the cell is the missing one. */
function figureCell(spec, x, y, size, missing) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const box = `<rect x="${round(x)}" y="${round(y)}" width="${round(size)}" height="${round(size)}" class="vz-fcell${missing ? ' vz-fcell-missing' : ''}"/>`;
  return box + (missing ? text(round(cx), round(cy), '?', 'vz-qmark') : figureGlyph(spec || {}, cx, cy, size * 0.56));
}

/**
 * A left-to-right series of figures with one cell replaced by "?".
 *
 * Laid out LTR on purpose even though the page is RTL: a sequence is read in
 * the direction the rule advances, and every published psychotechnical test
 * prints these left to right. Flipping them for Hebrew would invert the rule.
 */
function figureRow({ items = [], missing = -1, caption = '' }) {
  const size = 56;
  const gap = 12;
  const pad = 10;
  const n = Math.max(1, items.length);
  const W = pad * 2 + n * size + (n - 1) * gap;

  let inner = '';
  for (let i = 0; i < n; i++) {
    inner += figureCell(items[i], pad + i * (size + gap), pad, size, i === missing);
  }
  if (caption) inner += text(W / 2, pad + size + 20, caption);

  return frame(inner, W, pad * 2 + size + (caption ? 26 : 0), caption || 'סדרת צורות');
}

/**
 * A 3x3 (or n x m) matrix of figures with the last cell missing — the Raven
 * layout. `items` is row-major; `missing` is an index into it.
 */
function figureMatrix({ items = [], cols = 3, missing = -1, caption = '' }) {
  const size = 52;
  const gap = 10;
  const pad = 10;
  const c = Math.max(1, Math.round(Number(cols)) || 1);
  const rows = Math.max(1, Math.ceil(items.length / c));
  const W = pad * 2 + c * size + (c - 1) * gap;
  const H = pad * 2 + rows * size + (rows - 1) * gap;

  let inner = '';
  for (let i = 0; i < rows * c; i++) {
    const x = pad + (i % c) * (size + gap);
    const y = pad + Math.floor(i / c) * (size + gap);
    inner += figureCell(items[i], x, y, size, i === missing);
  }
  if (caption) inner += text(W / 2, H + 14, caption);

  return frame(inner, W, H + (caption ? 24 : 0), caption || 'מטריצת צורות');
}

/**
 * A single figure on its own — used for answer options.
 *
 * The glyph goes in a nested `figure` field rather than being spread across the
 * top level, because the top-level `shape` key is what renderVisual dispatches
 * on: a glyph spec of {shape:'arrow'} spread here would replace 'figureOne' and
 * dispatch to a builder that does not exist.
 */
function figureOne({ figure = {}, caption = '' }) {
  const size = 56;
  const pad = 8;
  const W = size + pad * 2;
  const inner = figureCell(figure, pad, pad, size, false) +
    (caption ? text(W / 2, size + pad + 16, caption) : '');
  return frame(inner, W, size + pad * 2 + (caption ? 22 : 0), caption || 'צורה');
}

/**
 * A cube net — six faces in the standard cross layout, each optionally marked.
 *
 * Folding items ask which solid a flat net produces, so the net has to be
 * drawn; describing it in words is the question the picture is meant to replace.
 */
function cubeNet({ marks = [], caption = '' }) {
  const s = 42;
  const pad = 10;
  // Cross layout: column 1 holds the vertical strip, with one face either side.
  const cells = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [1, 3]];
  const W = pad * 2 + 3 * s;
  const H = pad * 2 + 4 * s;

  let inner = '';
  cells.forEach(([col, row], i) => {
    const x = pad + col * s;
    const y = pad + row * s;
    inner += `<rect x="${x}" y="${y}" width="${s}" height="${s}" class="vz-fcell"/>`;
    const mark = marks[i];
    if (mark) inner += text(x + s / 2, y + s / 2, mark, 'vz-face');
  });
  if (caption) inner += text(W / 2, H + 14, caption);

  return frame(inner, W, H + (caption ? 24 : 0), caption || 'פריסת קובייה');
}

const SHAPES = {
  fractionBar, percentGrid, balance, verbTimeline, rootTree,
  numberLine, coordPlane, rightTriangle, trapezoid, arrayGrid, splitRect, barChart, sequenceDots,
  pieChart, clock, ruler,
  figureRow, figureMatrix, figureOne, cubeNet
};

/** Returns an SVG string for the spec, or '' when there is nothing to draw. */
export function renderVisual(spec) {
  if (!spec || !SHAPES[spec.shape]) return '';
  return SHAPES[spec.shape](spec);
}

/** The shapes this module can draw. Used by tests and by lesson validation. */
export function visualShapes() {
  return Object.keys(SHAPES);
}
