/**
 * Math question generators for the lower primary grades (1-3).
 *
 * Split from math.js because that file already carries grades 4-12 and is the
 * largest module in the project. Same contract exactly:
 *   (level) => { topic, text, options: string[4], correctVal, exp, diagram? }
 *
 * These grades differ from the rest in one way worth stating: the numbers are
 * small enough that plausible distractors are scarce, so several generators
 * build their wrong answers from the specific mistakes a child actually makes
 * (forgetting the carry, counting the endpoints of a ruler, reading the hour
 * hand as the minute hand) rather than from arithmetic offsets.
 */
import { frac, inline, rand } from '../mathfmt.js';
import { byLevel } from '../levels.js';

/** Four distinct options: the answer plus the first three usable distractors. */
function fourOptions(correct, candidates, spare) {
  const correctStr = String(correct);
  const seen = new Set([correctStr]);
  const out = [correctStr];
  for (const candidate of candidates) {
    if (out.length === 4) break;
    const value = String(candidate);
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  for (let i = 0; out.length < 4; i++) {
    if (i > 60) throw new Error(`fourOptions exhausted for "${correctStr}"`);
    const value = String(spare(i));
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

const pick = items => items[rand(0, items.length - 1)];
const near = n => i => n + (i % 2 === 0 ? i + 1 : -(i + 1));

// --- grade 1 -----------------------------------------------------------

/** המספרים עד 20 — order, before/after, comparison. */
function numbersTo20(level) {
  const max = byLevel(level, [10, 12, 16, 20, 20]);
  const n = rand(2, max - 1);
  const kind = level >= 3 ? pick(['after', 'before', 'between', 'bigger']) : pick(['after', 'before']);

  if (kind === 'between') {
    const correct = n;
    return {
      topic: 'המספרים עד 20',
      text: `איזה מספר נמצא בין ${inline(String(n - 1))} לבין ${inline(String(n + 1))}?`,
      options: fourOptions(correct, [n + 1, n - 1, n + 2], near(correct)),
      correctVal: String(correct),
      exp: `בין ${n - 1} ל-${n + 1} נמצא ${n}. אפשר לספור: ${n - 1}, ${n}, ${n + 1}.`,
      diagram: { shape: 'numberLine', from: Math.max(0, n - 4), to: n + 4, step: 1, points: [{ at: n, label: '?', on: true }] }
    };
  }
  if (kind === 'bigger') {
    const other = rand(2, max);
    const correct = Math.max(n, other);
    if (n === other) return numbersTo20(level);
    return {
      topic: 'המספרים עד 20',
      text: `איזה מספר גדול יותר: ${inline(String(n))} או ${inline(String(other))}?`,
      options: fourOptions(correct, [Math.min(n, other), correct + 1, correct - 1], near(correct)),
      correctVal: String(correct),
      exp: `על ציר המספרים ${correct} נמצא ימינה יותר, ולכן הוא הגדול.`,
      diagram: { shape: 'numberLine', from: 0, to: max, step: 2, points: [{ at: n, label: String(n) }, { at: other, label: String(other), on: true }] }
    };
  }

  const after = kind === 'after';
  const correct = after ? n + 1 : n - 1;
  return {
    topic: 'המספרים עד 20',
    text: `איזה מספר בא ${after ? 'אחרי' : 'לפני'} ${inline(String(n))}?`,
    options: fourOptions(correct, [after ? n - 1 : n + 1, n, correct + 1], near(correct)),
    correctVal: String(correct),
    exp: `${after ? 'אחרי' : 'לפני'} ${n} בא ${correct} — צעד אחד ${after ? 'ימינה' : 'שמאלה'} על ציר המספרים.`,
    diagram: { shape: 'numberLine', from: Math.max(0, n - 4), to: n + 4, step: 1, points: [{ at: n, label: String(n) }, { at: correct, label: '?', on: true }] }
  };
}

/** חיבור וחיסור עד 20 — with the crossing-ten step from level 3. */
function addSubTo20(level) {
  const cross = level >= 3;
  const add = pick([true, false]);

  if (add) {
    const a = cross ? rand(5, 9) : rand(1, 5);
    const b = cross ? rand(10 - a + 1, 9) : rand(1, 10 - a);
    const correct = a + b;
    return {
      topic: 'חיבור וחיסור עד 20',
      text: `${inline(`${a} + ${b} = ?`)}`,
      options: fourOptions(correct, [correct + 1, correct - 1, a + b + 10], near(correct)),
      correctVal: String(correct),
      exp: correct > 10
        ? `משלימים ל-10 קודם: ${a} ועוד ${10 - a} זה 10, ונשארו עוד ${b - (10 - a)} — יחד ${correct}.`
        : `סופרים ${b} צעדים קדימה מ-${a} ומגיעים ל-${correct}.`,
      diagram: { shape: 'numberLine', from: 0, to: 20, step: 5, points: [{ at: a, label: String(a) }, { at: correct, label: '?', on: true }] }
    };
  }

  const correctVal = cross ? rand(4, 9) : rand(1, 5);
  const b = cross ? rand(10 - correctVal + 1, 9) : rand(1, 5);
  const total = correctVal + b;
  return {
    topic: 'חיבור וחיסור עד 20',
    text: `${inline(`${total} − ${b} = ?`)}`,
    options: fourOptions(correctVal, [correctVal + 1, correctVal - 1, total + b], near(correctVal)),
    correctVal: String(correctVal),
    exp: `יורדים ${b} צעדים מ-${total} ומגיעים ל-${correctVal}. בדיקה: ${correctVal} + ${b} = ${total}.`,
    diagram: { shape: 'numberLine', from: 0, to: 20, step: 5, points: [{ at: total, label: String(total) }, { at: correctVal, label: '?', on: true }] }
  };
}

/** המספרים עד 100 — tens and units. */
function numbersTo100(level) {
  const tens = rand(1, byLevel(level, [4, 6, 9, 9, 9]));
  const units = rand(0, 9);
  const correct = tens * 10 + units;
  const askReverse = level >= 3 && pick([true, false]);

  if (askReverse) {
    return {
      topic: 'המספרים עד 100',
      text: `כמה עשרות יש במספר ${inline(String(correct))}?`,
      options: fourOptions(tens, [units, tens + 1, correct], near(tens)),
      correctVal: String(tens),
      exp: `${correct} מורכב מ-${tens} עשרות ועוד ${units} יחידות, ולכן יש בו ${tens} עשרות.`
    };
  }
  return {
    topic: 'המספרים עד 100',
    text: `איזה מספר בנוי מ-${inline(String(tens))} עשרות ו-${inline(String(units))} יחידות?`,
    // The classic mistake is writing the digits in the order they were said.
    options: fourOptions(correct, [units * 10 + tens, correct + 10, correct - 10], near(correct)),
    correctVal: String(correct),
    exp: `${tens} עשרות הן ${tens * 10}, ועוד ${units} יחידות — יחד ${correct}.`
  };
}

const SHAPES_1 = [
  { name: 'משולש', sides: 3, corners: 3 },
  { name: 'ריבוע', sides: 4, corners: 4 },
  { name: 'מלבן', sides: 4, corners: 4 },
  { name: 'מחומש', sides: 5, corners: 5 },
  { name: 'משושה', sides: 6, corners: 6 }
];

/** צורות בסיסיות — sides and corners. */
function basicShapes(level) {
  const pool = level <= 2 ? SHAPES_1.slice(0, 3) : SHAPES_1;
  const shape = pick(pool);
  const askCorners = level >= 3 && pick([true, false]);
  const correct = askCorners ? shape.corners : shape.sides;
  return {
    topic: 'צורות בסיסיות',
    text: `כמה ${askCorners ? 'קודקודים (פינות)' : 'צלעות'} יש ל${shape.name}?`,
    options: fourOptions(correct, [correct + 1, correct - 1, correct + 2], near(correct)),
    correctVal: String(correct),
    exp: `ל${shape.name} יש ${shape.sides} צלעות ו-${shape.corners} קודקודים — תמיד מספר שווה של שניהם.`
  };
}

/** מדידת אורך וזמן — reading a clock, on the hour and half hour. */
function lengthAndTime(level) {
  const useMinutes = level >= 3;
  const hour = rand(1, 12);
  const minute = useMinutes ? pick([0, 15, 30, 45]) : 0;
  const label = m => (m === 0 ? 'בדיוק' : m === 15 ? 'ורבע' : m === 30 ? 'וחצי' : 'ורבע ל-');
  const correct = minute === 45 ? `${hour === 12 ? 1 : hour + 1}:00 פחות רבע` : `${hour}:${String(minute).padStart(2, '0')}`;
  const wrongHour = hour === 12 ? 1 : hour + 1;

  return {
    topic: 'מדידת אורך וזמן',
    text: 'איזו שעה מראה השעון?',
    options: fourOptions(
      correct,
      [`${wrongHour}:${String(minute).padStart(2, '0')}`,
        `${hour}:${String((minute + 30) % 60).padStart(2, '0')}`,
        `${minute === 0 ? 12 : minute}:${String(hour).padStart(2, '0')}`],
      i => `${(hour + i + 2) % 12 + 1}:${String(minute).padStart(2, '0')}`
    ),
    correctVal: String(correct),
    exp: `המחוג הקצר מצביע על ${hour}, והמחוג הארוך מראה ${minute} דקות — כלומר ${hour} ${label(minute)}.`,
    diagram: { shape: 'clock', hour, minute }
  };
}

// --- grade 2 -----------------------------------------------------------

/** חיבור וחיסור עד 100, with regrouping from level 3. */
function addSubTo100(level) {
  const [lo, hi] = byLevel(level, [[10, 40], [10, 60], [20, 80], [30, 95], [40, 99]]);
  const add = pick([true, false]);
  const a = rand(lo, hi);

  if (add) {
    const b = rand(5, Math.max(6, 99 - a));
    const correct = a + b;
    return {
      topic: 'חיבור וחיסור עד 100',
      text: inline(`${a} + ${b} = ?`),
      // Losing the carry is exactly a ten short.
      options: fourOptions(correct, [correct - 10, correct + 10, correct - 1], near(correct)),
      correctVal: String(correct),
      exp: `מחברים יחידות ואז עשרות: ${a} + ${b} = ${correct}.`
    };
  }
  const b = rand(5, a - 1);
  const correct = a - b;
  return {
    topic: 'חיבור וחיסור עד 100',
    text: inline(`${a} − ${b} = ?`),
    options: fourOptions(correct, [correct + 10, correct - 10, b - correct], near(correct)),
    correctVal: String(correct),
    exp: `${a} פחות ${b} זה ${correct}. בדיקה בחיבור: ${correct} + ${b} = ${a}.`
  };
}

/** מבוא לכפל וחילוק — multiplication as equal groups, and its inverse. */
function introMulDiv(level) {
  const maxFactor = byLevel(level, [5, 6, 8, 10, 10]);
  const rows = rand(2, maxFactor);
  const cols = rand(2, maxFactor);
  const product = rows * cols;
  const divide = level >= 3 && pick([true, false]);

  if (divide) {
    return {
      topic: 'מבוא לכפל וחילוק',
      text: `${inline(`${product} ÷ ${rows} = ?`)} — מחלקים ${product} לקבוצות שוות של ${rows}.`,
      options: fourOptions(cols, [rows, cols + 1, product - rows], near(cols)),
      correctVal: String(cols),
      exp: `${rows} נכנס ב-${product} בדיוק ${cols} פעמים, כי ${cols} × ${rows} = ${product}.`,
      diagram: { shape: 'arrayGrid', rows, cols }
    };
  }
  return {
    topic: 'מבוא לכפל וחילוק',
    text: `${inline(`${rows} × ${cols} = ?`)} — ${rows} קבוצות של ${cols}.`,
    // Adding instead of multiplying is the mistake this age makes most.
    options: fourOptions(product, [rows + cols, product + cols, product - cols], near(product)),
    correctVal: String(product),
    exp: `${rows} קבוצות של ${cols} הן ${product} — אפשר לספור את המשבצות בציור.`,
    diagram: { shape: 'arrayGrid', rows, cols }
  };
}

/** המספרים עד 1000 — place value in three digits. */
function numbersTo1000(level) {
  const h = rand(1, 9);
  const t = rand(0, 9);
  const u = rand(0, 9);
  const correct = h * 100 + t * 10 + u;
  const askDigit = level >= 3;

  if (askDigit) {
    const place = pick(['מאות', 'עשרות', 'יחידות']);
    const answer = place === 'מאות' ? h : place === 'עשרות' ? t : u;
    return {
      topic: 'המספרים עד 1000',
      text: `מהי ספרת ה${place} במספר ${inline(String(correct))}?`,
      options: fourOptions(answer, [h, t, u].filter(d => d !== answer), near(answer)),
      correctVal: String(answer),
      exp: `${correct} = ${h} מאות + ${t} עשרות + ${u} יחידות, ולכן ספרת ה${place} היא ${answer}.`
    };
  }
  return {
    topic: 'המספרים עד 1000',
    text: `איזה מספר בנוי מ-${inline(String(h))} מאות, ${inline(String(t))} עשרות ו-${inline(String(u))} יחידות?`,
    options: fourOptions(correct, [u * 100 + t * 10 + h, correct + 100, correct - 10], near(correct)),
    correctVal: String(correct),
    exp: `${h * 100} + ${t * 10} + ${u} = ${correct}.`
  };
}

const QUADS = [
  { name: 'ריבוע', axes: 4 },
  { name: 'מלבן', axes: 2 },
  { name: 'מעוין', axes: 2 },
  { name: 'טרפז שווה שוקיים', axes: 1 }
];

/** מרובעים וסימטריה — sides, and axes of symmetry. */
function quadsSymmetry(level) {
  if (level >= 3) {
    const q = pick(QUADS);
    return {
      topic: 'מרובעים וסימטריה',
      text: `כמה צירי סימטריה יש ל${q.name}?`,
      options: fourOptions(q.axes, [q.axes + 1, q.axes + 2, 0], near(q.axes)),
      correctVal: String(q.axes),
      exp: `ל${q.name} יש ${q.axes} ציר${q.axes === 1 ? '' : 'י'} סימטריה — קווים שמקפלים לאורכם והצורה מתאימה לעצמה.`
    };
  }
  const w = rand(2, 8);
  const h = rand(2, 8);
  return {
    topic: 'מרובעים וסימטריה',
    text: 'כמה צלעות יש למרובע?',
    options: fourOptions(4, [3, 5, 6], near(4)),
    correctVal: '4',
    exp: 'מרובע הוא צורה עם ארבע צלעות וארבעה קודקודים — ריבוע, מלבן ומעוין הם כולם מרובעים.',
    diagram: { shape: 'rectangle', w, h }
  };
}

/** סרגל ושעון — reading a ruler, and the clock again with finer minutes. */
function rulerAndClock(level) {
  const useClock = pick([true, false]);
  if (useClock) {
    const hour = rand(1, 12);
    const minute = pick(level >= 3 ? [5, 10, 20, 25, 35, 40, 50, 55] : [0, 15, 30, 45]);
    const correct = `${hour}:${String(minute).padStart(2, '0')}`;
    return {
      topic: 'סרגל ושעון',
      text: 'איזו שעה מראה השעון?',
      options: fourOptions(correct,
        [`${hour === 12 ? 1 : hour + 1}:${String(minute).padStart(2, '0')}`,
          `${hour}:${String((minute + 5) % 60).padStart(2, '0')}`,
          `${hour}:${String((60 - minute) % 60).padStart(2, '0')}`],
        i => `${(hour + i) % 12 + 1}:${String(minute).padStart(2, '0')}`),
      correctVal: correct,
      exp: `המחוג הקצר על ${hour}, והארוך על ${minute} דקות. כל מספר בשעון הוא 5 דקות.`,
      diagram: { shape: 'clock', hour, minute }
    };
  }

  const from = rand(0, 4);
  const length = rand(2, byLevel(level, [4, 5, 6, 8, 9]));
  const to = from + length;
  return {
    topic: 'סרגל ושעון',
    text: `העיפרון מונח על הסרגל מ-${inline(String(from))} עד ${inline(String(to))}. מה אורכו בסנטימטרים?`,
    // Counting the marks instead of the gaps gives one too many.
    options: fourOptions(length, [length + 1, to, from], near(length)),
    correctVal: String(length),
    exp: `האורך הוא ההפרש: ${to} − ${from} = ${length} ס"מ. סופרים את הרווחים, לא את הקווים.`,
    diagram: { shape: 'ruler', from, to, units: 10, label: '?' }
  };
}

// --- grade 3 -----------------------------------------------------------

/** ארבע פעולות עד 10000. */
function fourOpsTo10000(level) {
  const op = pick(level >= 3 ? ['+', '−', '×', '÷'] : ['+', '−']);
  if (op === '+' || op === '−') {
    const [lo, hi] = byLevel(level, [[100, 500], [200, 900], [300, 2000], [500, 5000], [1000, 9000]]);
    const a = rand(lo, hi);
    const b = rand(lo, Math.min(hi, op === '−' ? a - 1 : hi));
    const correct = op === '+' ? a + b : a - b;
    return {
      topic: 'ארבע פעולות עד 10000',
      text: inline(`${a} ${op} ${b} = ?`),
      options: fourOptions(correct, [correct + 100, correct - 100, correct + 10], near(correct)),
      correctVal: String(correct),
      exp: `מחשבים במאונך, ספרה מול ספרה: ${a} ${op} ${b} = ${correct}.`
    };
  }
  if (op === '×') {
    const a = rand(11, byLevel(level, [20, 30, 60, 99, 99]));
    const b = rand(2, 9);
    const correct = a * b;
    return {
      topic: 'ארבע פעולות עד 10000',
      text: inline(`${a} × ${b} = ?`),
      options: fourOptions(correct, [correct + b, correct - b, a + b], near(correct)),
      correctVal: String(correct),
      exp: `מפרקים: ${a} × ${b} = ${Math.floor(a / 10) * 10} × ${b} + ${a % 10} × ${b} = ${Math.floor(a / 10) * 10 * b} + ${(a % 10) * b} = ${correct}.`
    };
  }
  const divisor = rand(2, 9);
  const correct = rand(11, byLevel(level, [20, 40, 80, 200, 500]));
  const dividend = divisor * correct;
  return {
    topic: 'ארבע פעולות עד 10000',
    text: inline(`${dividend} ÷ ${divisor} = ?`),
    options: fourOptions(correct, [correct + 1, correct - 1, dividend - divisor], near(correct)),
    correctVal: String(correct),
    exp: `${divisor} × ${correct} = ${dividend}, ולכן ${dividend} ÷ ${divisor} = ${correct}.`
  };
}

/** חילוק עם שארית. */
function divisionRemainder(level) {
  const divisor = rand(2, byLevel(level, [5, 6, 8, 9, 9]));
  const quotient = rand(2, byLevel(level, [6, 9, 15, 40, 90]));
  const remainder = rand(1, divisor - 1);
  const dividend = divisor * quotient + remainder;
  const askRemainder = pick([true, false]);
  const correct = askRemainder ? remainder : quotient;

  return {
    topic: 'חילוק עם שארית',
    text: `${inline(`${dividend} ÷ ${divisor}`)} — ${askRemainder ? 'מה השארית?' : 'מה המנה (התוצאה השלמה)?'}`,
    options: fourOptions(correct, [askRemainder ? quotient : remainder, correct + 1, correct - 1], near(correct)),
    correctVal: String(correct),
    exp: `${divisor} × ${quotient} = ${divisor * quotient}, ונשארו עוד ${remainder}. לכן ${dividend} ÷ ${divisor} = ${quotient} ושארית ${remainder}. השארית תמיד קטנה מ-${divisor}.`
  };
}

/** אומדן ועיגול. */
function rounding(level) {
  const place = byLevel(level, [10, 10, 100, 100, 1000]);
  const placeName = place === 10 ? 'עשרת' : place === 100 ? 'מאה' : 'אלף';
  const n = rand(place, place * 9 + place - 1);
  const correct = Math.round(n / place) * place;
  const down = Math.floor(n / place) * place;
  const up = down + place;

  return {
    topic: 'אומדן ועיגול',
    text: `עגל את המספר ${inline(String(n))} ל${placeName} הקרובה.`,
    options: fourOptions(correct, [correct === down ? up : down, correct + place, correct - place], near(correct)),
    correctVal: String(correct),
    exp: `${n} נמצא בין ${down} ל-${up}. מסתכלים על הספרה הבאה: אם היא 5 ומעלה מעגלים למעלה, אחרת למטה. לכן ${correct}.`,
    diagram: { shape: 'numberLine', from: down, to: up, step: place / 2, points: [{ at: n, label: String(n), on: true }] }
  };
}

/** מבוא לשברים — part of a whole. */
function introFractions(level) {
  const den = pick(level <= 2 ? [2, 3, 4] : [2, 3, 4, 5, 6, 8]);
  const num = rand(1, den - 1);
  const askName = level <= 2;

  if (askName) {
    const names = { 2: 'חצי', 3: 'שליש', 4: 'רבע' };
    const correct = names[den];
    return {
      topic: 'מבוא לשברים',
      text: `עוגה חולקה ל-${inline(String(den))} חלקים שווים. איך נקרא כל חלק?`,
      options: fourOptions(correct, Object.values(names).filter(v => v !== correct), i => `חלק ${i + 5}`),
      correctVal: correct,
      exp: `חלוקה ל-${den} חלקים שווים נותנת ${correct} — כותבים אותו ${inline(`1/${den}`)}.`,
      diagram: { shape: 'fractionBar', bars: [{ num: 1, den, label: `1/${den}` }] }
    };
  }

  const correct = `${num}/${den}`;
  return {
    topic: 'מבוא לשברים',
    text: `צורה חולקה ל-${inline(String(den))} חלקים שווים, ו-${inline(String(num))} מהם צבועים. איזה שבר צבוע?`,
    options: fourOptions(frac(num, den),
      [frac(den, num), frac(num, den + 1), frac(num + 1, den)],
      i => frac(num, den + i + 2)),
    correctVal: frac(num, den),
    exp: `המכנה ${den} אומר לכמה חלקים חילקנו, והמונה ${num} כמה נצבעו — לכן ${inline(correct)}.`,
    diagram: { shape: 'fractionBar', bars: [{ num, den, label: correct }] }
  };
}

/** זוויות וישרים. */
function anglesAndLines(level) {
  if (level >= 3 && pick([true, false])) {
    const kind = pick([
      { deg: rand(10, 80), name: 'חדה' },
      { deg: 90, name: 'ישרה' },
      { deg: rand(100, 170), name: 'קהה' }
    ]);
    return {
      topic: 'זוויות וישרים',
      text: `זווית שגודלה ${inline(`${kind.deg}°`)} נקראת זווית...`,
      options: fourOptions(kind.name, ['חדה', 'ישרה', 'קהה'].filter(n => n !== kind.name), i => `סוג ${i + 4}`),
      correctVal: kind.name,
      exp: `זווית חדה קטנה מ-90°, ישרה היא בדיוק 90°, וקהה גדולה מ-90°. ${kind.deg}° היא ${kind.name}.`
    };
  }
  const parallel = pick([true, false]);
  const correct = parallel ? 'מקבילים' : 'מאונכים';
  return {
    topic: 'זוויות וישרים',
    text: parallel
      ? 'שני ישרים שלעולם אינם נפגשים, ותמיד באותו מרחק זה מזה, נקראים...'
      : 'שני ישרים שנפגשים ויוצרים זווית של 90° נקראים...',
    options: fourOptions(correct, ['מקבילים', 'מאונכים', 'חופפים'].filter(n => n !== correct), i => `סוג ${i + 4}`),
    correctVal: correct,
    exp: parallel
      ? 'ישרים מקבילים שומרים מרחק קבוע ולעולם לא נחתכים — כמו שתי מסילות רכבת.'
      : 'ישרים מאונכים נחתכים בזווית ישרה של 90° — כמו הפינה של דף.'
  };
}

/** היקף ושטח מלבן. */
function perimeterArea(level) {
  const w = rand(2, byLevel(level, [6, 8, 12, 20, 30]));
  const h = rand(2, byLevel(level, [6, 8, 12, 20, 30]));
  const askArea = level >= 3 ? pick([true, false]) : false;
  const area = w * h;
  const perimeter = 2 * (w + h);
  const correct = askArea ? area : perimeter;
  const other = askArea ? perimeter : area;

  return {
    topic: 'היקף ושטח מלבן',
    text: `מלבן שאורכו ${inline(`${w} ס"מ`)} ורוחבו ${inline(`${h} ס"מ`)}. מה ${askArea ? 'שטחו' : 'היקפו'}?`,
    // The other quantity is the distractor that actually tempts.
    options: fourOptions(correct, [other, w + h, correct + w], near(correct)),
    correctVal: String(correct),
    exp: askArea
      ? `שטח = אורך × רוחב = ${w} × ${h} = ${area} סמ"ר.`
      : `היקף = 2 × (אורך + רוחב) = 2 × (${w} + ${h}) = ${perimeter} ס"מ.`,
    diagram: { shape: 'rectangle', w, h }
  };
}

export const primaryGenerators = {
  '1': [numbersTo20, addSubTo20, numbersTo100, basicShapes, lengthAndTime],
  '2': [addSubTo100, introMulDiv, numbersTo1000, quadsSymmetry, rulerAndClock],
  '3': [fourOpsTo10000, divisionRemainder, rounding, introFractions, anglesAndLines, perimeterArea]
};
