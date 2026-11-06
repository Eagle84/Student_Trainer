/**
 * Curriculum-gap generators: topics from the Ministry of Education syllabus
 * that the original grade tables did not cover.
 *
 * Kept apart from math.js and math-primary.js so the three files stay a
 * readable size. Merged into mathGenerators by grade, so a grade's pool is the
 * union of whatever the three modules declare for it.
 *
 * Same contract: (level) => { topic, text, options[4], correctVal, exp, diagram? }
 */
import { frac, inline, rand } from '../mathfmt.js';
import { byLevel } from '../levels.js';

function fourOptions(correct, candidates, spare) {
  const correctStr = String(correct);
  const seen = new Set([correctStr]);
  const out = [correctStr];
  for (const c of candidates) {
    if (out.length === 4) break;
    const v = String(c);
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  for (let i = 0; out.length < 4; i++) {
    if (i > 60) throw new Error(`fourOptions exhausted for "${correctStr}"`);
    const v = String(spare(i));
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
const pick = items => items[rand(0, items.length - 1)];
const near = n => i => n + (i % 2 === 0 ? i + 1 : -(i + 1));
const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const round2 = n => Math.round(n * 100) / 100;

// --- grade 4 -----------------------------------------------------------

const DIV_RULES = {
  2: 'מספר מתחלק ב-2 אם ספרת היחידות שלו זוגית.',
  3: 'מספר מתחלק ב-3 אם סכום ספרותיו מתחלק ב-3.',
  5: 'מספר מתחלק ב-5 אם ספרת היחידות שלו היא 0 או 5.',
  10: 'מספר מתחלק ב-10 אם ספרת היחידות שלו היא 0.'
};

/**
 * סימני חלוקה — which of four numbers divides exactly.
 *
 * Asked this way, not as "does n divide by d?". A yes/no question has two
 * answers and the engine wants four, and the previous version padded the two
 * with trailing spaces to make up the count: the student was shown "כן", "כן ",
 * "לא", "לא " — two pairs that look identical and one of each scored wrong.
 * Picking the divisible number out of four tests the same rule four times over.
 */
function divisibility(level) {
  const d = pick(level <= 2 ? [2, 5, 10] : [2, 3, 5, 10]);
  const cap = byLevel(level, [99, 199, 499, 999, 9999]);

  const answer = rand(Math.ceil(20 / d), Math.floor(cap / d)) * d;
  const wrong = new Set();
  // Near misses, so the student has to apply the rule rather than eyeball size.
  for (let guard = 0; wrong.size < 3 && guard < 200; guard++) {
    const candidate = answer + rand(1, d - 1) * (rand(0, 1) ? 1 : -1) + rand(0, 4) * d;
    if (candidate > 0 && candidate % d !== 0) wrong.add(candidate);
  }
  // d === 2 leaves only odd numbers nearby; widen if the near misses ran out.
  for (let i = 1; wrong.size < 3; i++) {
    const candidate = answer + i * 2 + 1;
    if (candidate % d !== 0) wrong.add(candidate);
  }

  return {
    topic: 'סימני חלוקה',
    text: `איזה מהמספרים הבאים מתחלק ב-${inline(String(d))} ללא שארית?`,
    options: fourOptions(answer, [...wrong], i => String(answer + (i + 1) * d + 1)),
    correctVal: String(answer),
    exp: `${DIV_RULES[d]} ${answer} מקיים את התנאי; השאר משאירים שארית.`
  };
}

/**
 * ראשוניים ופריקים — pick the odd one out of four numbers.
 *
 * Not "is n prime or composite?": that has two answers, and the engine wants
 * four. The old version padded the two with trailing spaces, so the student saw
 * "ראשוני", "ראשוני ", "פריק", "פריק " — visually two pairs, one of each
 * scored wrong. Choosing among four numbers exercises the same test four times.
 */
function primesComposites(level) {
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
  const findPrime = pick([true, false]);
  const cap = byLevel(level, [20, 30, 50, 50, 50]);
  const pool = primes.filter(p => p <= cap && p > 2);

  const composites = [];
  for (let n = 4; n <= cap; n++) if (!primes.includes(n)) composites.push(n);

  // One of a kind, three of the other.
  const answer = findPrime ? pick(pool) : pick(composites);
  const others = [];
  const from = findPrime ? composites : pool;
  const seen = new Set([answer]);
  for (let guard = 0; others.length < 3 && guard < 400; guard++) {
    const c = pick(from);
    if (seen.has(c)) continue;
    seen.add(c);
    others.push(c);
  }

  const factor = findPrime ? null : [2, 3, 5, 7].find(f => answer % f === 0) || answer;
  return {
    topic: 'ראשוניים ופריקים',
    text: `איזה מהמספרים הבאים הוא ${findPrime ? 'ראשוני' : 'פריק'}?`,
    options: fourOptions(answer, others, i => String(cap + i + 1)),
    correctVal: String(answer),
    exp: findPrime
      ? `${answer} מתחלק רק ב-1 ובעצמו, ולכן הוא ראשוני. לשאר יש מחלק נוסף.`
      : `${answer} מתחלק ב-${factor} (${answer} ÷ ${factor} = ${answer / factor}), ולכן יש לו מחלק נוסף והוא פריק. השאר ראשוניים.`
  };
}

function expandReduce(level) {
  const num = rand(1, 6);
  const den = rand(num + 1, 12);
  const k = rand(2, byLevel(level, [3, 4, 5, 8, 10]));
  const reduce = level >= 3 && pick([true, false]);

  if (reduce) {
    const bigNum = num * k;
    const bigDen = den * k;
    const g = gcd(bigNum, bigDen);
    const rn = bigNum / g;
    const rd = bigDen / g;
    return {
      topic: 'הרחבה וצמצום שברים',
      text: `צמצם את השבר ${frac(bigNum, bigDen)} עד הסוף.`,
      options: fourOptions(frac(rn, rd), [frac(bigNum, bigDen), frac(rn * 2, rd * 2), frac(rd, rn)],
        i => frac(rn, rd + i + 1)),
      correctVal: frac(rn, rd),
      exp: `מחלקים מונה ומכנה ב-${g}: ${bigNum} ÷ ${g} = ${rn} ו-${bigDen} ÷ ${g} = ${rd}.`,
      diagram: { shape: 'fractionBar', bars: [{ num: rn, den: rd, label: `${rn}/${rd}` }] }
    };
  }
  return {
    topic: 'הרחבה וצמצום שברים',
    text: `הרחב את השבר ${frac(num, den)} כך שהמכנה יהיה ${inline(String(den * k))}.`,
    options: fourOptions(frac(num * k, den * k), [frac(num, den * k), frac(num + k, den * k), frac(num * k, den)],
      i => frac(num * k + i + 1, den * k)),
    correctVal: frac(num * k, den * k),
    exp: `כדי להגיע מ-${den} ל-${den * k} הכפלנו ב-${k}, ולכן גם המונה מוכפל ב-${k}: ${num} × ${k} = ${num * k}.`
  };
}

const QUAD_FACTS = [
  ['מקבילית', 'שני זוגות צלעות מקבילות'],
  ['טרפז', 'זוג אחד בלבד של צלעות מקבילות'],
  ['מעוין', 'ארבע צלעות שוות'],
  ['דלתון', 'שני זוגות צלעות סמוכות שוות']
];

function quadrilaterals(level) {
  const [name, fact] = pick(level <= 2 ? QUAD_FACTS.slice(0, 2) : QUAD_FACTS);
  const askName = pick([true, false]);
  if (askName) {
    return {
      topic: 'חקר מרובעים',
      text: `לאיזה מרובע יש ${fact}?`,
      options: fourOptions(name, QUAD_FACTS.map(q => q[0]).filter(n => n !== name), i => `מרובע ${i + 5}`),
      correctVal: name,
      exp: `${name} מוגדר בדיוק לפי התכונה הזאת: ${fact}.`
    };
  }
  return {
    topic: 'חקר מרובעים',
    text: `מהי התכונה המייחדת של ${inline(name)}?`,
    options: fourOptions(fact, QUAD_FACTS.map(q => q[1]).filter(f => f !== fact), i => `תכונה ${i + 5}`),
    correctVal: fact,
    exp: `${name} מזוהה לפי ${fact}.`
  };
}

// --- grade 5 -----------------------------------------------------------

function decimalOps(level) {
  const op = pick(level <= 2 ? ['+', '−'] : ['+', '−', '×', '÷']);
  const dp = byLevel(level, [1, 1, 2, 2, 2]);
  const scale = 10 ** dp;
  const a = round2(rand(10, byLevel(level, [50, 90, 200, 500, 900])) / scale * 10) ;
  const b = round2(rand(10, 90) / scale * 10);

  if (op === '+' || op === '−') {
    const x = Math.max(a, b);
    const y = Math.min(a, b);
    const correct = round2(op === '+' ? x + y : x - y);
    return {
      topic: 'ארבע פעולות בעשרוניים',
      text: inline(`${x} ${op} ${y} = ?`),
      // The classic slip is aligning by the right edge instead of the point.
      options: fourOptions(correct, [round2(correct * 10), round2(correct / 10), round2(correct + 0.1)],
        i => round2(correct + (i + 1) / 10)),
      correctVal: String(correct),
      exp: `מיישרים לפי הנקודה העשרונית ומחשבים: ${x} ${op} ${y} = ${correct}.`
    };
  }
  if (op === '×') {
    const whole = rand(2, 9);
    const correct = round2(a * whole);
    return {
      topic: 'ארבע פעולות בעשרוניים',
      text: inline(`${a} × ${whole} = ?`),
      options: fourOptions(correct, [round2(correct * 10), round2(correct / 10), round2(a + whole)],
        i => round2(correct + i + 1)),
      correctVal: String(correct),
      exp: `כופלים בלי הנקודה ואז מחזירים אותה: ${a} × ${whole} = ${correct}. מספר הספרות אחרי הנקודה נשמר.`
    };
  }
  const whole = rand(2, 9);
  const correct = round2(a);
  const dividend = round2(a * whole);
  return {
    topic: 'ארבע פעולות בעשרוניים',
    text: inline(`${dividend} ÷ ${whole} = ?`),
    options: fourOptions(correct, [round2(correct * 10), round2(correct / 10), round2(dividend - whole)],
      i => round2(correct + (i + 1) / 10)),
    correctVal: String(correct),
    exp: `${whole} × ${correct} = ${dividend}, ולכן התוצאה היא ${correct}.`
  };
}

function triangleTypes(level) {
  const byAngle = pick([true, false]);
  if (byAngle || level <= 2) {
    const kinds = [
      { name: 'ישר זווית', angles: [90, 60, 30] },
      { name: 'חד זוויות', angles: [70, 60, 50] },
      { name: 'קהה זוויות', angles: [120, 40, 20] }
    ];
    const k = pick(kinds);
    return {
      topic: 'חקר משולשים',
      text: `משולש שזוויותיו ${inline(k.angles.join('°, ') + '°')} נקרא משולש...`,
      options: fourOptions(k.name, kinds.map(x => x.name).filter(n => n !== k.name), i => `סוג ${i + 4}`),
      correctVal: k.name,
      exp: `הזווית הגדולה ביותר היא ${Math.max(...k.angles)}°, ולכן המשולש ${k.name}.`,
      diagram: { shape: 'rightTriangle', a: k.angles[1] + '°', b: k.angles[0] + '°', c: k.angles[2] + '°' }
    };
  }
  const kinds = [
    { name: 'שווה צלעות', sides: [6, 6, 6] },
    { name: 'שווה שוקיים', sides: [7, 7, 4] },
    { name: 'שונה צלעות', sides: [5, 6, 7] }
  ];
  const k = pick(kinds);
  return {
    topic: 'חקר משולשים',
    text: `משולש שצלעותיו ${inline(k.sides.join(', '))} נקרא משולש...`,
    options: fourOptions(k.name, kinds.map(x => x.name).filter(n => n !== k.name), i => `סוג ${i + 4}`),
    correctVal: k.name,
    exp: `${k.name}: ${k.name === 'שווה צלעות' ? 'כל שלוש הצלעות שוות' : k.name === 'שווה שוקיים' ? 'שתי צלעות שוות' : 'אין שתי צלעות שוות'}.`
  };
}

function boxSurfaceVolume(level) {
  const a = rand(2, byLevel(level, [5, 6, 8, 10, 12]));
  const b = rand(2, byLevel(level, [5, 6, 8, 10, 12]));
  const c = rand(2, byLevel(level, [5, 6, 8, 10, 12]));
  const volume = a * b * c;
  const surface = 2 * (a * b + a * c + b * c);
  const askVolume = pick([true, false]);
  const correct = askVolume ? volume : surface;
  const other = askVolume ? surface : volume;
  return {
    topic: 'קובייה ותיבה',
    text: `תיבה במידות ${inline(`${a} × ${b} × ${c}`)} ס"מ. מה ${askVolume ? 'נפחה' : 'שטח הפנים שלה'}?`,
    options: fourOptions(correct, [other, a + b + c, correct * 2], near(correct)),
    correctVal: String(correct),
    exp: askVolume
      ? `נפח = אורך × רוחב × גובה = ${a} × ${b} × ${c} = ${volume} סמ"ק.`
      : `שטח פנים = סכום שש הפאות = 2(${a}×${b} + ${a}×${c} + ${b}×${c}) = ${surface} סמ"ר.`,
    diagram: { shape: 'box', a, b, c }
  };
}

// --- grade 6 -----------------------------------------------------------

function scaleRatio(level) {
  const scale = pick(level <= 2 ? [100, 1000] : [50, 100, 250, 1000, 10000]);
  const onMap = rand(2, byLevel(level, [8, 12, 20, 40, 60]));
  const realCm = onMap * scale;
  const askReal = pick([true, false]);

  if (askReal) {
    const meters = round2(realCm / 100);
    return {
      topic: 'קנה מידה',
      text: `במפה בקנה מידה ${inline(`1:${scale}`)}, קטע באורך ${inline(`${onMap} ס"מ`)} מייצג מרחק אמיתי של...`,
      options: fourOptions(`${meters} מטר`, [`${onMap * scale} מטר`, `${round2(onMap / scale)} מטר`, `${round2(meters / 10)} מטר`],
        i => `${round2(meters + i + 1)} מטר`),
      correctVal: `${meters} מטר`,
      exp: `כל ס"מ במפה הוא ${scale} ס"מ במציאות. ${onMap} × ${scale} = ${realCm} ס"מ, שהם ${meters} מטר.`
    };
  }
  return {
    topic: 'קנה מידה',
    text: `בקנה מידה ${inline(`1:${scale}`)}, מרחק אמיתי של ${inline(`${realCm} ס"מ`)} מיוצג במפה באורך...`,
    options: fourOptions(`${onMap} ס"מ`, [`${realCm * scale} ס"מ`, `${round2(onMap * 10)} ס"מ`, `${scale} ס"מ`],
      i => `${onMap + i + 1} ס"מ`),
    correctVal: `${onMap} ס"מ`,
    exp: `מחלקים בקנה המידה: ${realCm} ÷ ${scale} = ${onMap} ס"מ.`
  };
}

function circle(level) {
  const r = rand(2, byLevel(level, [5, 7, 10, 15, 20]));
  const kind = pick(level <= 2 ? ['diameter', 'circumference'] : ['diameter', 'circumference', 'area']);
  if (kind === 'diameter') {
    return {
      topic: 'המעגל והעיגול',
      text: `רדיוס המעגל הוא ${inline(`${r} ס"מ`)}. מה אורך הקוטר?`,
      options: fourOptions(2 * r, [r, r * r, r + 2], near(2 * r)),
      correctVal: String(2 * r),
      exp: `הקוטר הוא פי שניים מהרדיוס: ${r} × 2 = ${2 * r} ס"מ.`
    };
  }
  if (kind === 'circumference') {
    const correct = round2(2 * Math.PI * r);
    return {
      topic: 'המעגל והעיגול',
      text: `רדיוס המעגל ${inline(`${r} ס"מ`)}. מה היקפו? ${inline('(π ≈ 3.14)')}`,
      options: fourOptions(correct, [round2(Math.PI * r * r), round2(Math.PI * r), round2(2 * r)],
        i => round2(correct + i + 1)),
      correctVal: String(correct),
      exp: `${inline(`היקף = 2πr = 2 × 3.14 × ${r} = ${correct}`)} ס"מ.`
    };
  }
  const correct = round2(Math.PI * r * r);
  return {
    topic: 'המעגל והעיגול',
    text: `רדיוס העיגול ${inline(`${r} ס"מ`)}. מה שטחו? ${inline('(π ≈ 3.14)')}`,
    options: fourOptions(correct, [round2(2 * Math.PI * r), round2(Math.PI * 2 * r * r), round2(r * r)],
      i => round2(correct + i + 1)),
    correctVal: String(correct),
    exp: `שטח = πr² = 3.14 × ${r}² = 3.14 × ${r * r} = ${correct} סמ"ר.`
  };
}

function solids(level) {
  const facts = [
    ['גליל', 'שני בסיסי עיגול ומעטפת מעוגלת'],
    ['פירמידה', 'בסיס מצולע וכל הפאות נפגשות בקודקוד אחד'],
    ['קובייה', 'שש פאות ריבועיות שוות'],
    ['חרוט', 'בסיס עיגול אחד וקודקוד אחד']
  ];
  const [name, fact] = pick(level <= 2 ? facts.slice(0, 3) : facts);
  const askName = pick([true, false]);
  if (askName) {
    return {
      topic: 'גליל ופירמידה',
      text: `לאיזה גוף יש ${fact}?`,
      options: fourOptions(name, facts.map(f => f[0]).filter(n => n !== name), i => `גוף ${i + 5}`),
      correctVal: name,
      exp: `${name} מזוהה לפי ${fact}.`
    };
  }
  return {
    topic: 'גליל ופירמידה',
    text: `מה מאפיין את ${inline(name)}?`,
    options: fourOptions(fact, facts.map(f => f[1]).filter(f2 => f2 !== fact), i => `מאפיין ${i + 5}`),
    correctVal: fact,
    exp: `${name}: ${fact}.`
  };
}

function statisticsCharts(level) {
  const n = byLevel(level, [3, 3, 4, 5, 5]);
  const values = Array.from({ length: n }, () => rand(2, 20));
  const labels = ['א', 'ב', 'ג', 'ד', 'ה'].slice(0, n);
  const kind = pick(level <= 2 ? ['max', 'total'] : ['max', 'total', 'mean', 'diff']);
  const total = values.reduce((s, v) => s + v, 0);
  const maxIdx = values.indexOf(Math.max(...values));

  if (kind === 'max') {
    const correct = labels[maxIdx];
    return {
      topic: 'סטטיסטיקה ודיאגרמות',
      text: 'לפי התרשים, לאיזו קבוצה הערך הגבוה ביותר?',
      options: fourOptions(correct, labels.filter(l => l !== correct), i => `קבוצה ${i + 6}`),
      correctVal: correct,
      exp: `העמודה הגבוהה ביותר היא של ${correct}, עם ${Math.max(...values)}.`,
      diagram: { shape: 'barChart', values, labels }
    };
  }
  if (kind === 'total') {
    return {
      topic: 'סטטיסטיקה ודיאגרמות',
      text: 'לפי התרשים, מה הסכום הכולל של כל הקבוצות?',
      options: fourOptions(total, [Math.max(...values), total - values[0], Math.round(total / n)], near(total)),
      correctVal: String(total),
      exp: `מחברים את כל העמודות: ${values.join(' + ')} = ${total}.`,
      diagram: { shape: 'barChart', values, labels }
    };
  }
  if (kind === 'mean') {
    const mean = round2(total / n);
    return {
      topic: 'סטטיסטיקה ודיאגרמות',
      text: 'לפי התרשים, מה הממוצע של הערכים?',
      options: fourOptions(mean, [total, Math.max(...values), round2(total / (n + 1))], i => round2(mean + i + 1)),
      correctVal: String(mean),
      exp: `ממוצע = סכום ÷ כמות = ${total} ÷ ${n} = ${mean}.`,
      diagram: { shape: 'barChart', values, labels, mean }
    };
  }
  const minIdx = values.indexOf(Math.min(...values));
  const diff = values[maxIdx] - values[minIdx];
  return {
    topic: 'סטטיסטיקה ודיאגרמות',
    text: 'לפי התרשים, מה ההפרש בין הערך הגבוה לנמוך ביותר?',
    options: fourOptions(diff, [values[maxIdx], values[minIdx], total], near(diff)),
    correctVal: String(diff),
    exp: `הגבוה ${values[maxIdx]}, הנמוך ${values[minIdx]}, וההפרש ${diff}.`,
    diagram: { shape: 'barChart', values, labels }
  };
}

function rateOfChange(level) {
  const rate = rand(2, byLevel(level, [6, 10, 15, 25, 40]));
  const time = rand(2, 9);
  const start = level >= 3 ? rand(5, 50) : 0;
  const correct = start + rate * time;
  return {
    topic: 'השתנות וקצב',
    text: start === 0
      ? `ברז ממלא ${inline(`${rate} ליטר`)} בכל דקה. כמה ליטר יהיו אחרי ${inline(`${time} דקות`)}?`
      : `במיכל כבר יש ${inline(`${start} ליטר`)}, וברז מוסיף ${inline(`${rate} ליטר`)} בכל דקה. כמה יהיו אחרי ${inline(`${time} דקות`)}?`,
    options: fourOptions(correct, [rate * time, start + rate, correct - start], near(correct)),
    correctVal: String(correct),
    exp: start === 0
      ? `קצב קבוע: ${rate} × ${time} = ${correct} ליטר.`
      : `מתחילים מ-${start} ומוסיפים ${rate} כל דקה: ${start} + ${rate} × ${time} = ${correct} ליטר.`,
    diagram: { shape: 'numberLine', from: 0, to: correct, step: Math.max(1, Math.round(correct / 4)), points: [{ at: start, label: 'התחלה' }, { at: correct, label: '?', on: true }] }
  };
}

// --- grade 7 -----------------------------------------------------------

function algebraicExpressions(level) {
  const a = rand(2, byLevel(level, [4, 6, 9, 12, 15]));
  const b = rand(1, byLevel(level, [5, 9, 15, 25, 40]));
  const x = rand(2, byLevel(level, [5, 7, 10, 12, 15]));
  const kind = level >= 3 ? pick(['substitute', 'simplify']) : 'substitute';

  if (kind === 'simplify') {
    const c = rand(2, 9);
    const correct = `${a + c}x${b >= 0 ? ' + ' : ' − '}${Math.abs(b)}`;
    return {
      topic: 'ביטויים אלגבריים',
      text: `כנס איברים דומים: ${inline(`${a}x + ${b} + ${c}x`)}`,
      options: fourOptions(correct, [`${a + c + b}x`, `${a * c}x + ${b}`, `${a + c}x`],
        i => `${a + c + i + 1}x + ${b}`),
      correctVal: correct,
      exp: `מכנסים רק איברים מאותו סוג: ${a}x ועוד ${c}x זה ${a + c}x. המספר ${b} נשאר בנפרד — אי אפשר לחבר אותו ל-x.`
    };
  }
  const correct = a * x + b;
  return {
    topic: 'ביטויים אלגבריים',
    text: `הצב ${inline(`x = ${x}`)} בביטוי ${inline(`${a}x + ${b}`)}`,
    options: fourOptions(correct, [a + x + b, a * (x + b), correct - b], near(correct)),
    correctVal: String(correct),
    exp: `${a}x פירושו ${a} כפול x: ${a} × ${x} = ${a * x}, ועוד ${b} — סך הכול ${correct}.`
  };
}

function coordinateSystem(level) {
  const x = rand(-byLevel(level, [4, 5, 6, 8, 10]), byLevel(level, [4, 5, 6, 8, 10]));
  const y = rand(-byLevel(level, [4, 5, 6, 8, 10]), byLevel(level, [4, 5, 6, 8, 10]));
  if (x === 0 || y === 0) return coordinateSystem(level);
  const quadrant = x > 0 ? (y > 0 ? 'הראשון' : 'הרביעי') : (y > 0 ? 'השני' : 'השלישי');
  const askQuadrant = level >= 3 && pick([true, false]);

  if (askQuadrant) {
    return {
      topic: 'מערכת צירים ופונקציות',
      text: `באיזה רביע נמצאת הנקודה ${inline(`(${x}, ${y})`)}?`,
      options: fourOptions(quadrant, ['הראשון', 'השני', 'השלישי', 'הרביעי'].filter(q => q !== quadrant), i => `רביע ${i + 5}`),
      correctVal: quadrant,
      exp: `x ${x > 0 ? 'חיובי' : 'שלילי'} ו-y ${y > 0 ? 'חיובי' : 'שלילי'}, ולכן הרביע ${quadrant}.`,
      diagram: { shape: 'coordPlane', range: 10, points: [{ x, y, label: `(${x},${y})`, on: true }] }
    };
  }
  const m = rand(1, byLevel(level, [2, 3, 4, 5, 6]));
  const b = rand(-5, 5);
  const yOut = m * x + b;
  return {
    topic: 'מערכת צירים ופונקציות',
    text: `בפונקציה ${inline(`y = ${m}x ${b >= 0 ? '+' : '−'} ${Math.abs(b)}`)}, מה ערך ${inline('y')} כאשר ${inline(`x = ${x}`)}?`,
    options: fourOptions(yOut, [m + x + b, m * (x + b), yOut - b], near(yOut)),
    correctVal: String(yOut),
    exp: `מציבים: ${m} × ${x} = ${m * x}, ו${b >= 0 ? 'ועוד' : 'פחות'} ${Math.abs(b)} נותן ${yOut}.`
  };
}

const ANGLE_PAIRS = [
  ['זוויות צמודות', 180, 'שתי זוויות צמודות משלימות יחד ל-180°'],
  ['זוויות קודקודיות', 0, 'זוויות קודקודיות שוות זו לזו'],
  ['זוויות מתאימות', 0, 'בין ישרים מקבילים, זוויות מתאימות שוות'],
  ['זוויות מתחלפות', 0, 'בין ישרים מקבילים, זוויות מתחלפות שוות']
];

function anglePairs(level) {
  const [name, sum, rule] = pick(level <= 2 ? ANGLE_PAIRS.slice(0, 2) : ANGLE_PAIRS);
  const given = rand(20, 160);
  const correct = sum === 180 ? 180 - given : given;
  return {
    topic: 'זוויות בין מקבילים',
    text: `${name}: אחת מהן ${inline(`${given}°`)}. מה גודל השנייה?`,
    options: fourOptions(`${correct}°`, [`${180 - correct}°`, `${90 - given > 0 ? 90 - given : given + 90}°`, `${360 - given}°`],
      i => `${correct + i + 1}°`),
    correctVal: `${correct}°`,
    exp: `${rule}, ולכן התשובה ${correct}°.`
  };
}

// --- grade 8 -----------------------------------------------------------

function inequalities(level) {
  const a = rand(2, byLevel(level, [3, 5, 8, 10, 12]));
  const b = rand(1, byLevel(level, [8, 15, 25, 40, 60]));
  const negative = level >= 4 && pick([true, false]);
  const coef = negative ? -a : a;
  const x = rand(2, 12);
  const c = coef * x + b;
  // Multiplying or dividing by a negative flips the sign — the whole point.
  const sign = negative ? '>' : '<';
  const correct = `x ${sign} ${x}`;
  return {
    topic: 'אי-שוויונות',
    text: `פתור: ${inline(`${coef}x ${b >= 0 ? '+' : '−'} ${Math.abs(b)} ${negative ? '<' : '<'} ${c}`)}`,
    options: fourOptions(correct, [`x ${negative ? '<' : '>'} ${x}`, `x ${sign} ${-x}`, `x = ${x}`],
      i => `x ${sign} ${x + i + 1}`),
    correctVal: correct,
    exp: negative
      ? `מחסרים ${b} ומחלקים ב-${coef}. חילוק במספר <strong>שלילי הופך את סימן האי-שוויון</strong>, ולכן ${correct}.`
      : `מחסרים ${b} ומחלקים ב-${coef} — מספר חיובי, ולכן הסימן נשמר: ${correct}.`,
    diagram: { shape: 'numberLine', from: x - 5, to: x + 5, step: 2, points: [{ at: x, label: String(x), on: true }] }
  };
}

const CONGRUENCE = [
  ['צ.צ.צ', 'שלוש צלעות שוות'],
  ['צ.ז.צ', 'שתי צלעות והזווית שביניהן'],
  ['ז.צ.ז', 'שתי זוויות והצלע שביניהן']
];

function congruence(level) {
  const [name, desc] = pick(CONGRUENCE);
  const askName = pick([true, false]);
  if (askName) {
    return {
      topic: 'חפיפת משולשים',
      text: `לפי איזה משפט חפיפה מוכיחים כאשר נתונות ${inline(desc)}?`,
      options: fourOptions(name, CONGRUENCE.map(c => c[0]).filter(n => n !== name), i => `משפט ${i + 4}`),
      correctVal: name,
      exp: `${desc} — זה בדיוק משפט ${name}.`
    };
  }
  return {
    topic: 'חפיפת משולשים',
    text: `מה נדרש לפי משפט החפיפה ${inline(name)}?`,
    options: fourOptions(desc, CONGRUENCE.map(c => c[1]).filter(d => d !== desc), i => `נתון ${i + 4}`),
    correctVal: desc,
    exp: `משפט ${name} דורש ${desc}.`
  };
}

function isosceles(level) {
  const apex = rand(20, 100);
  const base = (180 - apex) / 2;
  if (!Number.isInteger(base)) return isosceles(level);
  const askBase = pick([true, false]);
  const correct = askBase ? base : apex;
  return {
    topic: 'משולש שווה שוקיים',
    text: askBase
      ? `במשולש שווה שוקיים זווית הראש היא ${inline(`${apex}°`)}. מה גודל כל אחת מזוויות הבסיס?`
      : `במשולש שווה שוקיים זווית בסיס אחת היא ${inline(`${base}°`)}. מה גודל זווית הראש?`,
    options: fourOptions(`${correct}°`, [`${180 - correct}°`, `${correct * 2}°`, `${90 - correct > 0 ? 90 - correct : correct + 45}°`],
      i => `${correct + i + 1}°`),
    correctVal: `${correct}°`,
    exp: askBase
      ? `זוויות הבסיס שוות. (180 − ${apex}) ÷ 2 = ${base}°.`
      : `שתי זוויות הבסיס שוות ${base}°, ולכן הראש הוא 180 − 2×${base} = ${apex}°.`,
    diagram: { shape: 'rightTriangle', a: `${base}°`, b: `${apex}°`, c: `${base}°` }
  };
}

// --- grade 9 -----------------------------------------------------------

function shortMultiplication(level) {
  const a = rand(1, byLevel(level, [3, 5, 7, 9, 12]));
  const b = rand(1, byLevel(level, [4, 6, 9, 12, 15]));
  const kind = pick(level <= 2 ? ['plus'] : ['plus', 'minus', 'diff']);

  if (kind === 'diff') {
    const correct = `x² − ${b * b}`;
    return {
      topic: 'נוסחאות הכפל המקוצר',
      text: `פתח: ${inline(`(x − ${b})(x + ${b})`)}`,
      options: fourOptions(correct, [`x² + ${b * b}`, `x² − ${2 * b}x − ${b * b}`, `x² − ${b}`],
        i => `x² − ${b * b + i + 1}`),
      correctVal: correct,
      exp: `זו נוסחת הפרש ריבועים: האיברים האמצעיים ${inline(`+${b}x`)} ו-${inline(`−${b}x`)} מתבטלים, ונשאר ${correct}.`
    };
  }
  const sign = kind === 'plus' ? 1 : -1;
  const mid = 2 * a * b * sign;
  const correct = `${a * a}x² ${mid >= 0 ? '+' : '−'} ${Math.abs(mid)}x + ${b * b}`;
  return {
    topic: 'נוסחאות הכפל המקוצר',
    text: `פתח: ${inline(`(${a}x ${sign > 0 ? '+' : '−'} ${b})²`)}`,
    // Forgetting the middle term is the classic error.
    options: fourOptions(correct, [`${a * a}x² + ${b * b}`, `${a * a}x² ${mid >= 0 ? '+' : '−'} ${Math.abs(mid)}x − ${b * b}`, `${a}x² + ${b}`],
      i => `${a * a}x² ${mid >= 0 ? '+' : '−'} ${Math.abs(mid) + i + 1}x + ${b * b}`),
    correctVal: correct,
    exp: `${inline('(A ± B)² = A² ± 2AB + B²')}. כאן A = ${a}x ו-B = ${b}, ולכן האיבר האמצעי הוא 2 × ${a} × ${b} = ${Math.abs(mid)}.`
  };
}

function rootLaws(level) {
  const kind = pick(level <= 2 ? ['simplify'] : ['simplify', 'multiply']);
  if (kind === 'multiply') {
    const a = pick([2, 3, 5, 6, 7]);
    const b = pick([2, 3, 5, 6, 7]);
    const correct = a * b === Math.round(Math.sqrt(a * b)) ** 2 ? String(Math.sqrt(a * b)) : `√${a * b}`;
    return {
      topic: 'חוקי שורשים',
      text: `פשט: ${inline(`√${a} × √${b}`)}`,
      options: fourOptions(correct, [`√${a + b}`, `${a * b}`, `√${a} + √${b}`], i => `√${a * b + i + 1}`),
      correctVal: correct,
      exp: `כפל שורשים: ${inline('√a × √b = √(ab)')}. כאן ${a} × ${b} = ${a * b}, ולכן ${correct}.`
    };
  }
  const outside = rand(2, byLevel(level, [3, 4, 5, 6, 8]));
  const inside = pick([2, 3, 5, 6, 7, 10]);
  const n = outside * outside * inside;
  const correct = `${outside}√${inside}`;
  return {
    topic: 'חוקי שורשים',
    text: `פשט את השורש: ${inline(`√${n}`)}`,
    options: fourOptions(correct, [`${outside * inside}`, `√${n}`, `${inside}√${outside}`], i => `${outside + i + 1}√${inside}`),
    correctVal: correct,
    exp: `${n} = ${outside * outside} × ${inside}, ו-${outside * outside} הוא ריבוע שלם. לכן ${inline(`√${n} = ${outside}√${inside}`)}.`
  };
}

function monotonicity(level) {
  const a = pick([1, 2, -1, -2]);
  const h = rand(-4, 4);
  const rising = a > 0;
  const askSide = pick(['left', 'right']);
  const correct = askSide === 'right'
    ? (rising ? 'עולה' : 'יורדת')
    : (rising ? 'יורדת' : 'עולה');
  return {
    topic: 'תחומי עלייה וירידה',
    text: `הפרבולה ${inline(`y = ${a}(x ${h >= 0 ? '−' : '+'} ${Math.abs(h)})²`)} — האם היא עולה או יורדת ${askSide === 'right' ? 'מימין' : 'משמאל'} לקדקוד?`,
    options: fourOptions(correct, ['עולה', 'יורדת', 'קבועה'].filter(c => c !== correct), i => `מצב ${i + 4}`),
    correctVal: correct,
    exp: `a ${rising ? 'חיובי' : 'שלילי'}, ולכן הפרבולה פותחת ${rising ? 'למעלה' : 'למטה'}. ${rising ? 'משמאל לקדקוד היא יורדת ומימין עולה' : 'משמאל לקדקוד היא עולה ומימין יורדת'}.`,
    diagram: { shape: 'coordPlane', range: 6, parabola: { a, b: -2 * a * h, c: a * h * h }, points: [{ x: h, y: 0, label: 'קדקוד', on: true }] }
  };
}

function thales(level) {
  const k = rand(2, byLevel(level, [3, 4, 5, 6, 8]));
  const a = rand(2, 9);
  const b = rand(2, 9);
  const correct = b * k;
  return {
    topic: 'משפט תאלס',
    text: `ישר מקביל לצלע במשולש חותך את הצלעות. ${inline(`AD = ${a}`)}, ${inline(`DB = ${a * (k - 1)}`)}, ${inline(`AE = ${b}`)}. מה אורך ${inline('AC')}?`,
    options: fourOptions(correct, [b + a, b * (k - 1), Math.round(b / k) || 1], near(correct)),
    correctVal: String(correct),
    exp: `לפי תאלס היחסים שווים: ${inline('AD/AB = AE/AC')}. כאן ${inline(`AB = ${a * k}`)}, והיחס הוא ${inline(`1:${k}`)}, ולכן ${inline(`AC = ${b} × ${k} = ${correct}`)}.`
  };
}

function basicTrig(level) {
  const triples = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]];
  const [opp, adj, hyp] = pick(level <= 2 ? triples.slice(0, 2) : triples);
  const fn = pick(['sin', 'cos', 'tan']);
  const value = fn === 'sin' ? opp / hyp : fn === 'cos' ? adj / hyp : opp / adj;
  const correct = frac(fn === 'sin' ? opp : fn === 'cos' ? adj : opp, fn === 'tan' ? adj : hyp);
  const label = { sin: 'הניצב שמול חלקי היתר', cos: 'הניצב שליד חלקי היתר', tan: 'הניצב שמול חלקי הניצב שליד' };
  return {
    topic: 'טריגונומטריה בסיסית',
    text: `במשולש ישר זווית הניצבים ${inline(String(opp))} ו-${inline(String(adj))} והיתר ${inline(String(hyp))}. מה ${inline(fn + ' α')}, כאשר הניצב ${opp} נמצא מול הזווית α?`,
    options: fourOptions(correct, [frac(adj, hyp), frac(opp, adj), frac(hyp, opp)], i => frac(opp, hyp + i + 1)),
    correctVal: correct,
    exp: `${fn} הוא ${label[fn]} — כאן ${correct}, שהוא בערך ${round2(value)}.`,
    diagram: { shape: 'rightTriangle', a: opp, b: adj, c: hyp, angle: 'α' }
  };
}

// --- grades 10-12 ------------------------------------------------------
// These carry minTrack, the lowest יח"ל track in which the topic is taught, so
// quiz.js never shows a 3-unit student material from a higher track.

function atTrack(units, generate) {
  generate.minTrack = units;
  return generate;
}

const midpoint = atTrack(3, level => {
  const r = byLevel(level, [6, 8, 10, 14, 20]);
  const x1 = rand(-r, r), y1 = rand(-r, r), x2 = rand(-r, r), y2 = rand(-r, r);
  if ((x1 + x2) % 2 !== 0 || (y1 + y2) % 2 !== 0) return midpoint(level);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return {
    topic: 'אמצע קטע',
    text: `מהו אמצע הקטע שקצותיו ${inline(`(${x1}, ${y1})`)} ו-${inline(`(${x2}, ${y2})`)}?`,
    options: fourOptions(`(${mx}, ${my})`,
      [`(${x2 - x1}, ${y2 - y1})`, `(${my}, ${mx})`, `(${mx + 1}, ${my})`],
      i => `(${mx + i + 1}, ${my})`),
    correctVal: `(${mx}, ${my})`,
    exp: `אמצע קטע הוא ממוצע השיעורים בנפרד: ((${x1}+${x2})/2, (${y1}+${y2})/2) = (${mx}, ${my}).`,
    diagram: { shape: 'coordPlane', range: r + 2, points: [{ x: x1, y: y1, label: 'A' }, { x: x2, y: y2, label: 'B' }, { x: mx, y: my, label: 'M', on: true }] }
  };
});

const quadraticInequality = atTrack(4, level => {
  const r1 = rand(-6, 3);
  const r2 = r1 + rand(1, byLevel(level, [3, 4, 5, 7, 9]));
  const greater = pick([true, false]);
  const b = -(r1 + r2), c = r1 * r2;
  const correct = greater ? `x < ${r1} או x > ${r2}` : `${r1} < x < ${r2}`;
  return {
    topic: 'אי-שוויון ריבועי',
    text: `פתור: ${inline(`x² ${b >= 0 ? '+' : '−'} ${Math.abs(b)}x ${c >= 0 ? '+' : '−'} ${Math.abs(c)} ${greater ? '>' : '<'} 0`)}`,
    options: fourOptions(correct,
      [greater ? `${r1} < x < ${r2}` : `x < ${r1} או x > ${r2}`, `x > ${r2}`, `x < ${r1}`],
      i => `x > ${r2 + i + 1}`),
    correctVal: correct,
    exp: `השורשים הם ${r1} ו-${r2}. הפרבולה פותחת למעלה, ולכן היא ${greater ? 'חיובית מחוץ לשורשים' : 'שלילית בין השורשים'} — ${correct}.`,
    diagram: { shape: 'coordPlane', range: 10, parabola: { a: 1, b, c }, points: [{ x: r1, y: 0, label: String(r1) }, { x: r2, y: 0, label: String(r2), on: true }] }
  };
});

const circleTheorems = atTrack(4, level => {
  const facts = [
    ['זווית היקפית הנשענת על קוטר', '90°'],
    ['זווית מרכזית ביחס להיקפית על אותה קשת', 'כפולה'],
    ['הזווית בין משיק לרדיוס בנקודת ההשקה', '90°'],
    ['שני משיקים לאותו מעגל מנקודה אחת', 'שווים באורכם']
  ];
  const [claim, answer] = pick(level <= 2 ? facts.slice(0, 2) : facts);
  return {
    topic: 'משפטי המעגל',
    text: `השלם: ${inline(claim)} היא/הם...`,
    options: fourOptions(answer, facts.map(f => f[1]).filter(a => a !== answer), i => `תכונה ${i + 5}`),
    correctVal: answer,
    exp: `${claim} — ${answer}. זהו אחד ממשפטי המעגל הבסיסיים.`
  };
});

const sineCosineRule = atTrack(4, level => {
  const useSine = pick([true, false]);
  if (useSine) {
    const a = rand(5, byLevel(level, [10, 14, 20, 30, 40]));
    const A = pick([30, 45, 60]);
    const B = pick([30, 45, 60].filter(x => x !== A));
    const b = round2(a * Math.sin(B * Math.PI / 180) / Math.sin(A * Math.PI / 180));
    return {
      topic: 'משפטי הסינוס והקוסינוס',
      text: `במשולש: ${inline(`a = ${a}`)}, ${inline(`∠A = ${A}°`)}, ${inline(`∠B = ${B}°`)}. מה אורך ${inline('b')}?`,
      options: fourOptions(b, [round2(a * A / B), round2(a + B - A), round2(a / 2)], i => round2(b + i + 1)),
      correctVal: String(b),
      exp: `משפט הסינוסים: ${inline('a/sinA = b/sinB')}. לכן ${inline(`b = ${a} × sin${B}° / sin${A}° ≈ ${b}`)}.`
    };
  }
  const a = rand(4, byLevel(level, [8, 10, 12, 15, 20]));
  const b = rand(4, byLevel(level, [8, 10, 12, 15, 20]));
  const C = pick([60, 90, 120]);
  const c = round2(Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(C * Math.PI / 180)));
  return {
    topic: 'משפטי הסינוס והקוסינוס',
    text: `במשולש: ${inline(`a = ${a}`)}, ${inline(`b = ${b}`)}, ${inline(`∠C = ${C}°`)}. מה אורך ${inline('c')}?`,
    options: fourOptions(c, [round2(a + b), round2(Math.sqrt(a * a + b * b)), round2(Math.abs(a - b))],
      i => round2(c + i + 1)),
    correctVal: String(c),
    exp: `משפט הקוסינוסים: ${inline('c² = a² + b² − 2ab·cosC')}. כאן ${inline(`c ≈ ${c}`)}.${C === 90 ? ' שים לב שכאשר C=90° האיבר האחרון מתאפס וזה פיתגורס.' : ''}`
  };
});

const functionInvestigation = atTrack(4, level => {
  const a = pick([1, 2, -1]);
  const root = rand(1, byLevel(level, [3, 4, 5, 6, 8]));
  const correct = `x = ${root}`;
  return {
    topic: 'חקירת פונקציה',
    text: `לפונקציה ${inline(`f(x) = ${a === 1 ? '' : a === -1 ? '−' : a}x² ${-2 * a * root >= 0 ? '+' : '−'} ${Math.abs(2 * a * root)}x`)} — היכן נקודת הקיצון?`,
    options: fourOptions(correct, [`x = ${-root}`, `x = ${2 * root}`, `x = 0`], i => `x = ${root + i + 1}`),
    correctVal: correct,
    exp: `גוזרים: ${inline(`f'(x) = ${2 * a}x ${-2 * a * root >= 0 ? '+' : '−'} ${Math.abs(2 * a * root)}`)}. מאפסים ומקבלים ${inline(correct)}.`
  };
});

const combinatorics = atTrack(3, level => {
  const n = rand(4, byLevel(level, [5, 6, 7, 8, 9]));
  const kind = pick(level <= 2 ? ['factorial'] : ['factorial', 'choose']);
  const fact = m => (m <= 1 ? 1 : m * fact(m - 1));
  if (kind === 'factorial') {
    const correct = fact(n);
    return {
      topic: 'קומבינטוריקה',
      text: `בכמה סדרים שונים אפשר לסדר ${inline(String(n))} ספרים שונים על מדף?`,
      options: fourOptions(correct, [n * n, fact(n - 1), n * (n - 1)], near(correct)),
      correctVal: String(correct),
      exp: `לספר הראשון ${n} אפשרויות, לשני ${n - 1}, וכן הלאה. סך הכול ${n}! = ${correct}.`
    };
  }
  const k = rand(2, n - 1);
  const correct = fact(n) / (fact(k) * fact(n - k));
  return {
    topic: 'קומבינטוריקה',
    text: `בכמה דרכים אפשר לבחור ${inline(String(k))} תלמידים מתוך ${inline(String(n))}, כאשר הסדר אינו חשוב?`,
    options: fourOptions(correct, [fact(n) / fact(n - k), n * k, fact(k)], near(correct)),
    correctVal: String(correct),
    exp: `זהו צירוף: ${inline(`C(${n},${k}) = ${n}! / (${k}!·${n - k}!) = ${correct}`)}. הסדר אינו חשוב, ולכן מחלקים ב-${k}!.`
  };
});

const conditionalProbability = atTrack(4, level => {
  const total = pick([20, 25, 40, 50]);
  const a = Math.round(total * pick([0.4, 0.5, 0.6]));
  const both = Math.round(a * pick([0.4, 0.5]));
  const correct = round2(both / a);
  return {
    topic: 'הסתברות מותנית',
    text: `מתוך ${inline(String(total))} תלמידים, ${inline(String(a))} לומדים מתמטיקה, ומתוכם ${inline(String(both))} לומדים גם פיזיקה. נבחר תלמיד הלומד מתמטיקה — מה ההסתברות שהוא לומד גם פיזיקה?`,
    options: fourOptions(correct, [round2(both / total), round2(a / total), round2(a / both)],
      i => round2(correct + (i + 1) / 10)),
    correctVal: String(correct),
    exp: `הידיעה שהוא לומד מתמטיקה מצמצמת את מרחב האפשרויות ל-${a}. לכן ${inline(`P = ${both}/${a} = ${correct}`)} — ולא חלקי ${total}.`
  };
});

const bernoulli = atTrack(4, level => {
  const n = rand(3, byLevel(level, [4, 5, 6, 7, 8]));
  const k = rand(1, n - 1);
  const p = pick([0.5, 0.5, 0.4, 0.3]);
  const fact = m => (m <= 1 ? 1 : m * fact(m - 1));
  const c = fact(n) / (fact(k) * fact(n - k));
  const correct = round2(c * p ** k * (1 - p) ** (n - k));
  return {
    topic: 'נוסחת ברנולי',
    text: `ניסוי חוזר ${inline(String(n))} פעמים, וההסתברות להצלחה בכל פעם היא ${inline(String(p))}. מה ההסתברות לבדיוק ${inline(String(k))} הצלחות?`,
    options: fourOptions(correct, [round2(p ** k), round2(c * p ** k), round2(k / n)],
      i => round2(correct + (i + 1) / 20)),
    correctVal: String(correct),
    exp: `ברנולי: ${inline(`C(${n},${k})·p^${k}·(1−p)^${n - k}`)} = ${c} × ${round2(p ** k)} × ${round2((1 - p) ** (n - k))} ≈ ${correct}.`
  };
});

const extremumProblems = atTrack(4, level => {
  const perimeter = pick([20, 24, 32, 40, 60]);
  const side = perimeter / 4;
  const area = side * side;
  return {
    topic: 'בעיות קיצון',
    text: `למלבן היקף ${inline(String(perimeter))}. מה השטח המרבי שאפשר לקבל?`,
    options: fourOptions(area, [perimeter, round2(perimeter * perimeter), round2(area / 2)], near(area)),
    correctVal: String(area),
    exp: `מסמנים צלע x, והשנייה ${perimeter / 2}−x. השטח הוא ${inline(`x(${perimeter / 2}−x)`)}, פרבולה שקדקודה ב-x=${side}. השטח המרבי מתקבל בריבוע: ${side}×${side} = ${area}.`
  };
});

const vectors = atTrack(5, level => {
  const r = byLevel(level, [5, 6, 8, 10, 12]);
  const x1 = rand(-r, r), y1 = rand(-r, r), x2 = rand(-r, r), y2 = rand(-r, r);
  const kind = pick(['add', 'dot']);
  if (kind === 'dot') {
    const correct = x1 * x2 + y1 * y2;
    return {
      topic: 'וקטורים',
      text: `נתונים ${inline(`u = (${x1}, ${y1})`)} ו-${inline(`v = (${x2}, ${y2})`)}. מה המכפלה הסקלרית ${inline('u·v')}?`,
      options: fourOptions(correct, [x1 * x2 - y1 * y2, (x1 + x2) * (y1 + y2), x1 + y1 + x2 + y2], near(correct)),
      correctVal: String(correct),
      exp: `מכפלה סקלרית: ${inline(`${x1}×${x2} + ${y1}×${y2} = ${correct}`)}. התוצאה היא מספר, לא וקטור.`
    };
  }
  const correct = `(${x1 + x2}, ${y1 + y2})`;
  return {
    topic: 'וקטורים',
    text: `נתונים ${inline(`u = (${x1}, ${y1})`)} ו-${inline(`v = (${x2}, ${y2})`)}. מהו ${inline('u + v')}?`,
    options: fourOptions(correct, [`(${x1 - x2}, ${y1 - y2})`, `(${x1 * x2}, ${y1 * y2})`, `${x1 + x2 + y1 + y2}`],
      i => `(${x1 + x2 + i + 1}, ${y1 + y2})`),
    correctVal: correct,
    exp: `מחברים רכיב־רכיב: (${x1}+${x2}, ${y1}+${y2}) = ${correct}.`,
    diagram: { shape: 'coordPlane', range: r * 2, points: [{ x: x1, y: y1, label: 'u' }, { x: x2, y: y2, label: 'v' }, { x: x1 + x2, y: y1 + y2, label: 'u+v', on: true }] }
  };
});

const complexNumbers = atTrack(5, level => {
  const a = rand(-6, 6), b = rand(1, 6), c = rand(-6, 6), d = rand(1, 6);
  const kind = pick(level <= 2 ? ['add'] : ['add', 'multiply']);
  if (kind === 'multiply') {
    const re = a * c - b * d;
    const im = a * d + b * c;
    const correct = `${re} ${im >= 0 ? '+' : '−'} ${Math.abs(im)}i`;
    return {
      topic: 'מספרים מרוכבים',
      text: `חשב: ${inline(`(${a} + ${b}i)(${c} + ${d}i)`)}`,
      options: fourOptions(correct, [`${a * c} + ${b * d}i`, `${a * c + b * d} + ${im}i`, `${re} ${im >= 0 ? '−' : '+'} ${Math.abs(im)}i`],
        i => `${re + i + 1} ${im >= 0 ? '+' : '−'} ${Math.abs(im)}i`),
      correctVal: correct,
      exp: `פותחים סוגריים וזוכרים ש-${inline('i² = −1')}: החלק הממשי ${a}×${c} − ${b}×${d} = ${re}, והמדומה ${a}×${d} + ${b}×${c} = ${im}.`
    };
  }
  const correct = `${a + c} ${b + d >= 0 ? '+' : '−'} ${Math.abs(b + d)}i`;
  return {
    topic: 'מספרים מרוכבים',
    text: `חשב: ${inline(`(${a} + ${b}i) + (${c} + ${d}i)`)}`,
    options: fourOptions(correct, [`${a + c + b + d}`, `${a * c} + ${b * d}i`, `${a - c} + ${b - d}i`],
      i => `${a + c + i + 1} + ${b + d}i`),
    correctVal: correct,
    exp: `מחברים ממשי עם ממשי ומדומה עם מדומה: (${a}+${c}) + (${b}+${d})i = ${correct}.`
  };
});

const normalDistribution = atTrack(3, level => {
  const mean = pick([50, 70, 100, 160]);
  const sd = pick([5, 10, 15]);
  const kind = pick(['within1', 'within2', 'above']);
  const map = { within1: ['68%', 1], within2: ['95%', 2], above: ['16%', 1] };
  const [correct, k] = map[kind];
  const lo = mean - k * sd, hi = mean + k * sd;
  return {
    topic: 'התפלגות נורמלית',
    text: kind === 'above'
      ? `בהתפלגות נורמלית עם ממוצע ${inline(String(mean))} וסטיית תקן ${inline(String(sd))}, איזה אחוז מהנתונים גדול מ-${inline(String(hi))}?`
      : `בהתפלגות נורמלית עם ממוצע ${inline(String(mean))} וסטיית תקן ${inline(String(sd))}, איזה אחוז מהנתונים נמצא בין ${inline(String(lo))} ל-${inline(String(hi))}?`,
    options: fourOptions(correct, ['68%', '95%', '99.7%', '16%'].filter(v => v !== correct), i => `${50 + i}%`),
    correctVal: correct,
    exp: kind === 'above'
      ? `68% נמצאים בתוך סטיית תקן אחת, ולכן 32% מחוצה לה — חצי מזה מעל, כלומר 16%.`
      : `כלל 68–95–99.7: בתוך ${k} סטיות תקן נמצאים ${correct} מהנתונים.`
  };
});

export const curriculumGenerators = {
  '4': [divisibility, primesComposites, expandReduce, quadrilaterals],
  '5': [decimalOps, triangleTypes, boxSurfaceVolume],
  '6': [scaleRatio, circle, solids, statisticsCharts, rateOfChange],
  '7': [algebraicExpressions, coordinateSystem, anglePairs],
  '8': [inequalities, congruence, isosceles],
  '9': [shortMultiplication, rootLaws, monotonicity, thales, basicTrig],
  '10': [midpoint, quadraticInequality, circleTheorems, sineCosineRule, functionInvestigation],
  '11': [combinatorics, conditionalProbability, bernoulli],
  '12': [extremumProblems, vectors, complexNumbers, normalDistribution]
};
