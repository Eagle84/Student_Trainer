/**
 * תכנות — coding, grades 1-12.
 *
 * **The subject changes character three times over that range**, so it is not
 * one topic list scaled by difficulty. Grades 1-3 have no syntax at all: what
 * happens first, how many times a thing repeats, what a rule does. Grades 4-6
 * read pseudo-code in Hebrew keywords. Grade 7 up reads real syntax. A single
 * "coding" pool across all twelve would be meaningless at both ends.
 *
 * **Every snippet is bidi-isolated at the source.** Code is left-to-right,
 * Hebrew is right-to-left, and an unisolated `x = 5` inside a Hebrew sentence
 * is laid out backwards — the same defect that displayed 5^9 as 9^5 across the
 * whole app. `sanitize()` isolates arithmetic runs, not code, so `code()` below
 * wraps every snippet in the same span the English subject uses.
 *
 * Anything longer than a fragment is a BLOCK, one statement to a line. Three
 * statements crushed onto one line is not how code is ever written, and it puts
 * the part being asked about at the far end of a long line in the middle of a
 * Hebrew sentence. See codeBlock() below.
 */
import { rand } from '../mathfmt.js';

/** An inline code fragment, isolated left-to-right. Never interpolate code raw. */
const code = text => `<span dir="ltr" class="lang-ltr">${text}</span>`;

/**
 * A multi-line code block.
 *
 * Real code is written one statement to a line, and squeezing three statements
 * onto one — `let a = 9; let b = 8; console.log(a * b);` — is both ugly and
 * unlike anything a student will ever read. It also puts the thing being asked
 * about at the far end of a long line, in the middle of a Hebrew sentence.
 *
 * Built from <br> inside a bidi-isolated span rather than <pre>, because
 * sanitize() allows span and br and does not allow pre — and every one of these
 * strings passes through sanitize() before it reaches the page. Indentation
 * therefore cannot come from leading spaces, which HTML would collapse; the
 * .code-block rule sets white-space so it survives.
 */
const codeBlock = lines =>
  `<span dir="ltr" class="code-block">${lines.join('<br>')}</span>`;

function pick(list) {
  return list[rand(0, list.length - 1)];
}

function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Four distinct options. Deduped for the same reason as in science.js. */
function fourFrom(correct, wrongPool) {
  const wrong = shuffled([...new Set(wrongPool.map(String))].filter(w => w !== String(correct)))
    .slice(0, 3);
  return shuffled([String(correct), ...wrong]);
}

/** Wrong numbers that are near-misses rather than noise. */
function nearMisses(n, extra = []) {
  return [n + 1, n - 1, n * 2, Math.max(0, n - 2), n + 3, ...extra]
    .map(String)
    .filter(v => v !== String(n));
}

// --- grades 1-3: sequencing and repetition, no syntax ------------------

const MORNING = ['לקום מהמיטה', 'לצחצח שיניים', 'להתלבש', 'לאכול ארוחת בוקר', 'לצאת מהבית'];
const RECIPE = ['לשבור את הביצה', 'לערבב', 'לחמם את המחבת', 'לשפוך למחבת', 'להגיש'];

/** מה קורה קודם — order matters, which is the first idea in programming. */
function sequenceOrder() {
  const list = pick([MORNING, RECIPE]);
  const i = rand(0, list.length - 2);
  const correct = list[i];
  return {
    topic: 'סדר פעולות',
    text: `בהוראות האלה, איזו פעולה צריכה לקרות מיד לפני "${list[i + 1]}"?`,
    options: fourFrom(correct, list),
    correctVal: correct,
    exp: `הסדר הוא: ${list.join(' ← ')}. לפני "${list[i + 1]}" בא "${correct}". מחשב מבצע הוראות לפי הסדר שנכתב, ולא לפי מה שהגיוני.`
  };
}

/** כמה פעמים — a loop, counted, before the word "loop" exists. */
function repeatCount() {
  const times = rand(2, 8);
  const action = pick(['לקפוץ', 'למחוא כף', 'להסתובב', 'לצעוד קדימה']);
  return {
    topic: 'חזרות',
    text: `ההוראה אומרת: "${action} ${times} פעמים". כמה פעמים תתבצע הפעולה?`,
    options: fourFrom(times, nearMisses(times)),
    correctVal: String(times),
    exp: `${times} פעמים בדיוק. מחשב סופר בדיוק כמה שנאמר לו — לא פחות ולא יותר.`
  };
}

/** תנאי בעברית — a condition, before syntax. */
function simpleCondition() {
  const n = rand(1, 20);
  const limit = rand(5, 15);
  const isBigger = n > limit;
  const correct = isBigger ? 'גדול' : 'קטן';
  return {
    topic: 'תנאים',
    text: `הכלל אומר: אם המספר גדול מ-${limit}, כתוב "גדול"; אחרת כתוב "קטן". מה ייכתב עבור ${n}?`,
    options: fourFrom(correct, ['גדול', 'קטן', 'שווה', 'שום דבר']),
    correctVal: correct,
    exp: isBigger
      ? `${n} גדול מ-${limit}, ולכן התנאי מתקיים והתשובה היא "גדול".`
      : `${n} אינו גדול מ-${limit}, ולכן התנאי לא מתקיים והולכים ל"אחרת": "קטן".`
  };
}

// --- grades 4-6: pseudo-code -------------------------------------------

/** ערך של משתנה אחרי כמה שלבים. */
function variableValue() {
  const start = rand(1, 10);
  const add = rand(1, 9);
  const mul = rand(2, 3);
  const shape = rand(0, 1);
  const result = shape === 0 ? (start + add) * mul : start * mul + add;
  const lines = shape === 0
    ? [`x = ${start} + ${add}`, `x = x * ${mul}`]
    : [`x = ${start} * ${mul}`, `x = x + ${add}`];
  const trap = shape === 0 ? start + add * mul : (start + add) * mul;
  return {
    topic: 'משתנים',
    text: `מה יהיה הערך של x בסוף?${codeBlock(lines)}`,
    options: fourFrom(result, nearMisses(result, [trap])),
    correctVal: String(result),
    exp: shape === 0
      ? `קודם ${start} + ${add} = ${start + add}, ואז כפול ${mul} זה ${result}. הפעולות מתבצעות לפי הסדר שנכתב, שורה אחר שורה.`
      : `קודם ${start} × ${mul} = ${start * mul}, ואז ועוד ${add} זה ${result}.`
  };
}

/** כמה פעמים ירוץ הלולאה. */
function loopIterations() {
  const from = rand(1, 5);
  const to = from + rand(2, 8);
  const count = to - from + 1;
  return {
    topic: 'לולאות',
    text: `כמה פעמים תרוץ הלולאה? ${code(`for i = ${from} to ${to}`)}`,
    // The off-by-one is the whole point, so count-1 and count+1 are always
    // offered. `to` and `from` are the other two real errors — reading the
    // bound as the answer — but they can coincide with the off-by-ones, and
    // fourFrom dedupes, so the list is topped up to guarantee four options.
    options: fourFrom(count, [count - 1, count + 1, to, from, count + 2, count + 3]
      .filter(v => v > 0).map(String)),
    correctVal: String(count),
    exp: `מ-${from} עד ${to} כולל שני הקצוות: ${to} − ${from} + 1 = ${count}. ה"+1" הוא המקום שבו טועים כמעט תמיד — גם ${from} וגם ${to} נספרים.`
  };
}

// --- grades 7-12: real syntax ------------------------------------------

/** מה יודפס — reading code and predicting output. */
function predictOutput() {
  const a = rand(2, 9);
  const b = rand(2, 9);
  const op = pick(['+', '-', '*']);
  const value = op === '+' ? a + b : op === '-' ? a - b : a * b;
  return {
    topic: 'קריאת קוד',
    text: `מה יודפס?${codeBlock([`let a = ${a};`, `let b = ${b};`, `console.log(a ${op} b);`])}`,
    options: fourFrom(value, nearMisses(value, [a, b, Number(`${a}${b}`)])),
    correctVal: String(value),
    exp: `${a} ${op} ${b} = ${value}. הפקודה מדפיסה את התוצאה של הביטוי, לא את הביטוי עצמו.`
  };
}

/** אינדקס במערך — zero-based indexing, the classic trap. */
function arrayIndex() {
  const items = shuffled(['"a"', '"b"', '"c"', '"d"', '"e"']).slice(0, 4);
  const idx = rand(0, items.length - 1);
  const correct = items[idx];
  return {
    topic: 'מערכים',
    text: `מה הערך?${codeBlock([`const arr = [${items.join(', ')}];`, `arr[${idx}]`])}`,
    options: fourFrom(correct, [...items, 'undefined']),
    correctVal: correct,
    exp: `מערכים מתחילים מאינדקס 0, ולכן ${code(`arr[${idx}]`)} הוא האיבר ה-${idx + 1} ברשימה: ${correct}. זו הטעות הנפוצה ביותר בקריאת מערכים.`
  };
}

/** איתור הבאג — four near-identical lines, one wrong. */
function spotTheBug() {
  const n = rand(3, 9);
  const correct = code(`if (x === ${n})`);
  return {
    topic: 'איתור שגיאות',
    text: `איזו שורה בודקת נכון האם x שווה ל-${n}?`,
    options: [correct, code(`if (x = ${n})`), code(`if (x == = ${n})`), code(`if (x =:= ${n})`)],
    correctVal: correct,
    exp: `${code('===')} משווה. ${code('=')} לבדו מַשְׁמִיץ ערך — הוא קובע ש-x יהיה ${n} במקום לבדוק, וזו טעות שהתוכנית לא תתלונן עליה.`
  };
}

// --- grades 10-12: how algorithms behave ------------------------------
//
// Standard computer-science material — complexity, search, sorting — written
// here from scratch for a school-age reader. The topics themselves belong to
// nobody; the wording, the numbers and the explanations are this project's.

/**
 * חיפוש בינארי — the halving, asked as a count.
 *
 * Numeric rather than definitional: "how many steps to find one item among
 * 1000" makes the student feel log₂ rather than recite it.
 */
function binarySearchSteps() {
  const power = rand(3, 10);
  const size = 2 ** power;
  return {
    topic: 'חיפוש בינארי',
    text: `ברשימה ממוינת של ${size} איברים, כמה בדיקות לכל היותר דרושות בחיפוש בינארי?`,
    options: fourFrom(power, [power + 1, power - 1, size / 2, power * 2].map(String)),
    correctVal: String(power),
    exp: `כל בדיקה מוחקת חצי מהרשימה: ${size} ← ${size / 2} ← ${size / 4} ← ... עד איבר אחד. מספר ההחצאות הוא ${power}, כי ${2}^${power} = ${size}. חיפוש רגיל היה דורש עד ${size} בדיקות.`
  };
}

/** סיבוכיות — matching an algorithm to its order of growth. */
const COMPLEXITY = [
  { what: 'חיפוש בינארי ברשימה ממוינת', big: 'O(log n)' },
  { what: 'מעבר על כל איברי הרשימה פעם אחת', big: 'O(n)' },
  { what: 'השוואת כל זוג איברים ברשימה', big: 'O(n²)' },
  { what: 'גישה לאיבר לפי אינדקס במערך', big: 'O(1)' },
  { what: 'מיון מיזוג (merge sort)', big: 'O(n log n)' },
  { what: 'מיון בועות (bubble sort) במקרה הגרוע', big: 'O(n²)' }
];

function complexityMatch() {
  const row = pick(COMPLEXITY);
  return {
    topic: 'סיבוכיות',
    text: `מהי סיבוכיות הזמן של ${row.what}?`,
    options: fourFrom(row.big, COMPLEXITY.map(c => c.big)),
    correctVal: row.big,
    exp: `${row.what} הוא ${code(row.big)}. סיבוכיות אינה מודדת שניות אלא איך זמן הריצה גדל כשהקלט גדל — ${code('O(1)')} לא משתנה כלל, ${code('O(n²)')} מתפוצץ.`
  };
}

/** מה קורה כשהקלט גדל — the practical consequence of the order of growth. */
function growthEffect() {
  const factor = pick([2, 3, 10]);
  const row = pick([
    { big: 'O(n)', times: factor, why: 'זמן הריצה גדל באותו יחס כמו הקלט' },
    { big: 'O(n²)', times: factor * factor, why: 'זמן הריצה גדל כריבוע היחס' }
  ]);
  return {
    topic: 'סיבוכיות',
    text: `אלגוריתם בסיבוכיות ${code(row.big)} רץ על קלט שגדל פי ${factor}. פי כמה יגדל זמן הריצה בקירוב?`,
    // Both real confusions are always offered — mistaking O(n²) for linear
    // growth and the reverse — then topped up, because at factor 2 the squared
    // and doubled values coincide and fourFrom dedupes them to one.
    options: fourFrom(row.times, [factor, factor * factor, factor * 2, factor + 1,
      factor * factor * factor, factor * factor + factor].map(String)),
    correctVal: String(row.times),
    exp: `${row.why}, ולכן פי ${row.times}. זו הסיבה שסיבוכיות חשובה יותר ממהירות המחשב: מחשב מהיר פי שניים לא יציל אלגוריתם ${code('O(n²)')} מקלט גדול.`
  };
}

const G1 = [sequenceOrder, repeatCount, simpleCondition];
const G4 = [...G1, variableValue, loopIterations];
const G7 = [variableValue, loopIterations, predictOutput, arrayIndex, spotTheBug];
// Grades 10-12 keep everything from 7 and add how algorithms behave at scale.
// Nothing is dropped: a student who cannot read a loop cannot reason about its
// complexity, so the earlier topics stay available to be weak at.
const G10 = [...G7, binarySearchSteps, complexityMatch, growthEffect];

export const codingGenerators = {
  '1': G1, '2': G1, '3': G1,
  '4': G4, '5': G4, '6': G4,
  '7': G7, '8': G7, '9': G7,
  '10': G10, '11': G10, '12': G10
};
