/**
 * Math question generators, keyed by grade.
 *
 * Each generator takes a difficulty level and returns:
 *   (level) => { topic, text, options: string[4], correctVal: string, exp: string }
 *
 * `level` is 1-5 and scales the question WITHIN its topic — operand size, step
 * count, and how close the distractors sit to the correct answer. A generator
 * declares its ranges once as a five-tier table and reads the matching tier
 * with byLevel(). See js/levels.js for what each level means.
 *
 * Generators for grades 10-12 carry a minTrack marker set by atTrack(): the
 * lowest יחידות לימוד track in which that topic is taught. quiz.js filters on
 * it so a 3 יח"ל student is never shown calculus.
 *
 * `text`, the option strings, and `exp` may contain HTML produced by frac()
 * and inline(). Pure: no DOM, no network.
 */
import { frac, inline, expr, rand } from '../mathfmt.js';
import { byLevel } from '../levels.js';
import { primaryGenerators } from './math-primary.js';
import { curriculumGenerators } from './math-curriculum.js';

/**
 * Builds four distinct option strings: `correct` first, then the first three
 * distinct entries of `candidates`, topped up from `spare(i)` if candidates
 * collided with each other or with the answer.
 *
 * Several generators derive distractors by arithmetic offset, and for some
 * random inputs those offsets coincide — a 4x4 rectangle has area 16 and
 * perimeter 16, and (a/10)*b always equals a*(b/10). Without this, the quiz
 * would show the same choice twice. `spare` supplies domain-appropriate
 * fallbacks so a fraction question never falls back to a bare integer.
 *
 * Widening the operand ranges per level makes collisions likelier, not rarer,
 * so every generator below routes through this rather than a raw array.
 */
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
    if (i > 50) throw new Error(`fourOptions: spare() exhausted for "${correctStr}"`);
    const value = String(spare(i));
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

/**
 * Marks a generator as belonging to `units` יחידות לימוד and above.
 *
 * Set as a property on the function rather than wrapping it in an object so
 * the registry contract stays "grade -> array of generator functions" and the
 * other subjects need no changes.
 */
function atTrack(units, generate) {
  generate.minTrack = units;
  return generate;
}

/** Greatest common divisor, for reducing generated fractions. */
function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

/** Renders a fraction in lowest terms, collapsing to an integer when exact. */
function reduced(num, den) {
  const g = gcd(num, den);
  const n = num / g;
  const d = den / g;
  return d === 1 ? String(n) : frac(n, d);
}

/** Signs a coefficient for display inside an expression: 5 -> "+ 5". */
function signed(value) {
  return value < 0 ? `- ${Math.abs(value)}` : `+ ${value}`;
}

/** Picks a random element. */
function pick(items) {
  return items[rand(0, items.length - 1)];
}

/**
 * Renders a coefficient in front of a variable, omitting a bare 1 or -1.
 * "1x²" reads as a mistake to a student even though it is correct.
 */
function coef(value, variable) {
  if (value === 1) return variable;
  if (value === -1) return `-${variable}`;
  return `${value}${variable}`;
}

/**
 * Appends a signed constant to an expression, omitting it when it is zero.
 * Includes its own leading space so "2x" + 0 renders as "2x", not "2x ".
 */
function signedConst(value) {
  return value === 0 ? '' : ` ${signed(value)}`;
}

/** Signs a term that carries a variable: -1 with 'y' -> "- y", 3 -> "+ 3y". */
function signedCoef(value, variable) {
  const magnitude = Math.abs(value) === 1 ? variable : `${Math.abs(value)}${variable}`;
  return `${value < 0 ? '-' : '+'} ${magnitude}`;
}

/** Renders a multiplier in front of a function call: 1 -> "", -1 -> "-". */
function mul(value) {
  if (value === 1) return '';
  if (value === -1) return '-';
  return `${value}·`;
}

/**
 * Pushes a coefficient away from 0 and +/-1.
 *
 * Chain-rule questions exist to test the inner derivative, so a coefficient of
 * 1 makes the question pointless AND makes the "forgot the chain rule"
 * distractor identical to the answer.
 */
function nonUnit(value, fallback) {
  return Math.abs(value) < 2 ? fallback : value;
}

export const mathGenerators = {
  // Grades 1-3 live in their own module; see math-primary.js.
  ...primaryGenerators,
  '4': [
    // חיבור וחיסור — grows from two small terms to four large ones.
    level => {
      const [lo, hi] = byLevel(level, [[2, 20], [10, 60], [20, 200], [100, 900], [500, 5000]]);
      const terms = byLevel(level, [2, 2, 3, 3, 4]);
      const values = Array.from({ length: terms }, () => rand(lo, hi));
      // Signs after the first term: all additions until level 3.
      const signs = values.map((_, i) => (i === 0 || level < 3 ? 1 : pick([1, -1])));
      const correct = values.reduce((sum, v, i) => sum + v * signs[i], 0);
      const expr = values
        .map((v, i) => (i === 0 ? String(v) : `${signs[i] > 0 ? '+' : '-'} ${v}`))
        .join(' ');
      return {
        topic: 'חיבור וחיסור',
        text: `חשב את התוצאה: <br>${inline(expr)}`,
        options: fourOptions(
          correct,
          [correct + 10, correct - values[values.length - 1], correct + values[0]],
          i => correct + (i + 2) * 3
        ),
        correctVal: String(correct),
        exp: `מחשבים משמאל לימין לפי סדר הופעת הפעולות: ${inline(`${expr} = ${correct}`)}.`
      };
    },

    // לוח הכפל — single-digit table up to two-digit x one-digit.
    level => {
      const [aLo, aHi] = byLevel(level, [[2, 5], [3, 9], [4, 12], [6, 20], [12, 40]]);
      const [bLo, bHi] = byLevel(level, [[2, 5], [3, 9], [3, 9], [4, 9], [5, 12]]);
      const a = rand(aLo, aHi);
      const b = rand(bLo, bHi);
      const correct = a * b;
      return {
        topic: 'לוח הכפל',
        text: `מהי התוצאה של: <br>${inline(`${a} × ${b}`)}`,
        options: fourOptions(
          correct,
          [correct + a, correct - b, a + b],
          i => correct + (i + 1) * 2
        ),
        correctVal: String(correct),
        exp: `כפל: ${inline(`${a} × ${b} = ${correct}`)}.`
      };
    },

    // חילוק — always exact, but the divisor and quotient grow.
    level => {
      const [dLo, dHi] = byLevel(level, [[2, 4], [2, 6], [3, 9], [4, 12], [6, 15]]);
      const [qLo, qHi] = byLevel(level, [[2, 5], [3, 9], [4, 12], [6, 20], [10, 40]]);
      const divisor = rand(dLo, dHi);
      const correct = rand(qLo, qHi);
      const dividend = divisor * correct;
      return {
        topic: 'חילוק',
        text: `חשב את התוצאה: <br>${inline(`${dividend} ÷ ${divisor}`)}`,
        options: fourOptions(
          correct,
          [correct + 1, correct - 1, dividend - divisor],
          i => correct + (i + 2) * 2
        ),
        correctVal: String(correct),
        exp: `מחפשים כמה פעמים ${divisor} נכנס ב-${dividend}: ${inline(`${divisor} × ${correct} = ${dividend}`)}.`
      };
    },

    // בעיות מילוליות — one operation, then two.
    level => {
      const price = rand(...byLevel(level, [[2, 6], [3, 9], [4, 15], [7, 25], [12, 40]]));
      const qty = rand(...byLevel(level, [[2, 4], [2, 6], [3, 8], [4, 12], [6, 20]]));
      const total = price * qty;
      const twoStep = level >= 3;
      // rand starts at 1 so the change is always strictly positive — "how much
      // change did she get?" with the answer 0 is a badly posed question.
      const paid = twoStep ? Math.ceil(total / 10) * 10 + rand(1, 20) : 0;
      const correct = twoStep ? paid - total : total;
      return {
        topic: 'בעיות מילוליות',
        text: twoStep
          ? `דנה קנתה ${qty} מחברות במחיר ${price} שקלים כל אחת, ושילמה בשטר של ${paid} שקלים. כמה עודף קיבלה?`
          : `דנה קנתה ${qty} מחברות במחיר ${price} שקלים כל אחת. כמה שילמה בסך הכל?`,
        options: fourOptions(
          correct,
          [correct + price, correct - qty, price + qty],
          i => correct + (i + 2) * 3
        ),
        correctVal: String(correct),
        exp: twoStep
          ? `תחילה מחיר הקנייה: ${inline(`${qty} × ${price} = ${total}`)}. העודף הוא ${inline(`${paid} - ${total} = ${correct}`)} שקלים.`
          : `מכפילים כמות במחיר: ${inline(`${qty} × ${price} = ${correct}`)} שקלים.`
      };
    },

    // היקף מלבן — the geometry entry point before area at grade 5.
    level => {
      const [lo, hi] = byLevel(level, [[2, 8], [3, 12], [4, 20], [8, 40], [15, 90]]);
      const w = rand(lo, hi);
      const h = rand(lo, hi);
      const correct = 2 * (w + h);
      return {
        topic: 'היקף מלבן',
        text: `מהו היקפו של מלבן שאורכו ${w} ס"מ ורוחבו ${h} ס"מ?`,
        options: fourOptions(
          correct,
          [w * h, w + h, correct + 2],
          i => correct + (i + 2) * 2
        ),
        correctVal: String(correct),
        exp: `היקף מלבן הוא סכום כל צלעותיו: ${inline(`2 × (${w} + ${h}) = ${correct}`)} ס"מ.`,
        diagram: { shape: 'rectangle', w, h }
      };
    }
  ],

  '5': [
    // סדר פעולות חשבון — one precedence rule, then brackets too.
    level => {
      const [lo, hi] = byLevel(level, [[2, 5], [2, 9], [3, 12], [4, 15], [6, 20]]);
      const a = rand(lo, hi);
      const b = rand(lo, hi);
      const c = rand(...byLevel(level, [[5, 20], [10, 50], [10, 80], [20, 150], [50, 400]]));
      const brackets = level >= 4;
      const correct = brackets ? (c + a) * b : c + a * b;
      const expr = brackets ? `(${c} + ${a}) × ${b}` : `${c} + ${a} × ${b}`;
      return {
        topic: 'סדר פעולות חשבון',
        text: `פתור את התרגיל הבא: <br>${inline(expr)}`,
        options: fourOptions(
          correct,
          [brackets ? c + a * b : (c + a) * b, correct + 10, correct - b],
          i => correct + 15 + i * 5
        ),
        correctVal: String(correct),
        exp: brackets
          ? `סוגריים קודמים לכל: ${inline(`${c} + ${a} = ${c + a}`)}, ואז ${inline(`${c + a} × ${b} = ${correct}`)}.`
          : `כפל קודם לחיבור. תחילה ${inline(`${a} × ${b} = ${a * b}`)}, ואז מוסיפים ${c}. התשובה: ${correct}.`
      };
    },

    // שטח מלבן — whole sides, then a decimal side at the top levels.
    level => {
      const [lo, hi] = byLevel(level, [[2, 6], [3, 10], [4, 14], [6, 25], [10, 45]]);
      const w = rand(lo, hi);
      const h = rand(lo, hi);
      const half = level >= 4 && rand(0, 1) === 1;
      const height = half ? h + 0.5 : h;
      const area = Number((w * height).toFixed(2));
      return {
        topic: 'גיאומטריה - שטח',
        text: `מהו שטחו של מלבן שאורכו ${w} ס"מ ורוחבו ${height} ס"מ?`,
        options: fourOptions(
          area,
          [Number((area * 2).toFixed(2)), w + height, Number((2 * (w + height)).toFixed(2))],
          i => Number((area + 3 + i * 2).toFixed(2))
        ),
        correctVal: String(area),
        exp: `שטח מלבן שווה לאורך כפול רוחב: ${inline(`${w} × ${height} = ${area}`)} סמ"ר.`,
        diagram: { shape: 'rectangle', w, h: height }
      };
    },

    // שברים — common denominator, then unlike denominators.
    level => {
      const unlike = level >= 3;
      const den1 = rand(...byLevel(level, [[3, 6], [4, 9], [3, 8], [4, 10], [5, 12]]));
      const den2 = unlike ? den1 + rand(1, 3) : den1;
      const num1 = rand(1, den1 - 1);
      const num2 = rand(1, den2 - 1);
      const common = den1 * den2;
      const sumNum = num1 * den2 + num2 * den1;
      const correct = unlike ? reduced(sumNum, common) : reduced(num1 + num2, den1);
      return {
        topic: unlike ? 'חיבור שברים - מכנים שונים' : 'חיבור שברים פשוטים',
        text: `חשב את התוצאה: <br>${expr(`${frac(num1, den1)} + ${frac(num2, den2)}`)}`,
        options: fourOptions(
          correct,
          [
            frac(num1 + num2, unlike ? den1 + den2 : den1 * 2),
            frac(num1 * num2, common),
            frac(sumNum + 1, common)
          ],
          i => frac(num1 + num2 + i + 1, common)
        ),
        correctVal: correct,
        exp: unlike
          ? `מרחיבים למכנה משותף ${common}: ${expr(`${frac(num1 * den2, common)} + ${frac(num2 * den1, common)}`)} = ${reduced(sumNum, common)}.`
          : `במכנה משותף מחברים את המונים בלבד: ${inline(`${num1}+${num2}=${num1 + num2}`)}.`
      };
    },

    // מספרים עשרוניים — one decimal place, then two, then subtraction.
    level => {
      const places = byLevel(level, [1, 1, 2, 2, 2]);
      const scale = 10 ** places;
      const [lo, hi] = byLevel(level, [[11, 60], [10, 99], [100, 999], [100, 9999], [1000, 99999]]);
      const a = rand(lo, hi) / scale;
      const b = rand(lo, hi) / scale;
      const subtract = level >= 4 && a > b;
      const correct = Number((subtract ? a - b : a + b).toFixed(places));
      return {
        topic: 'מספרים עשרוניים',
        text: `מהי התוצאה של: <br>${inline(`${a} ${subtract ? '-' : '+'} ${b}`)}`,
        options: fourOptions(
          correct,
          [
            Number((correct + 1).toFixed(places)),
            Number((correct - 0.2).toFixed(places)),
            Number((subtract ? a + b : a - b).toFixed(places))
          ],
          i => Number((correct + (i + 1) * 0.3).toFixed(places))
        ),
        correctVal: String(correct),
        exp: `מיישרים את הנקודה העשרונית ומחשבים לפי המקומות. התוצאה היא ${correct}.`
      };
    },

    // ממוצע — three clean values, then five awkward ones.
    level => {
      const count = byLevel(level, [3, 3, 3, 4, 5]);
      const step = byLevel(level, [10, 10, 5, 1, 1]);
      const values = Array.from({ length: count }, () => rand(6, 19) * step);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / count;
      const correct = Number.isInteger(avg) ? String(avg) : avg.toFixed(2);
      return {
        topic: 'חקר נתונים - ממוצע',
        text: `מהו הממוצע של הציונים הבאים: ${values.join(', ')}?`,
        options: fourOptions(
          correct,
          [String(sum), String(values[0]), (avg + 5).toFixed(Number.isInteger(avg) ? 0 : 2)],
          i => (avg + (i + 1) * 1.5).toFixed(Number.isInteger(avg) ? 0 : 2)
        ),
        correctVal: correct,
        exp: `ממוצע הוא סכום המספרים חלקי כמותם: ${inline(`${sum} ÷ ${count} = ${correct}`)}.`
      };
    }
  ],

  '6': [
    // שברים - כפל וחילוק
    level => {
      const divide = level >= 3;
      const [lo, hi] = byLevel(level, [[2, 5], [2, 7], [2, 9], [3, 12], [4, 15]]);
      const n1 = rand(1, lo + 1);
      const d1 = rand(lo, hi);
      const n2 = rand(1, lo + 1);
      const d2 = rand(lo, hi);
      const num = divide ? n1 * d2 : n1 * n2;
      const den = divide ? d1 * n2 : d1 * d2;
      const correct = reduced(num, den);
      return {
        topic: divide ? 'שברים - חילוק' : 'שברים - כפל',
        text: `חשב את התוצאה: <br>${expr(`${frac(n1, d1)} ${divide ? '÷' : '×'} ${frac(n2, d2)}`)}`,
        options: fourOptions(
          correct,
          [
            divide ? reduced(n1 * n2, d1 * d2) : reduced(n1 * d2, d1 * n2),
            frac(n1 + n2, d1 + d2),
            reduced(num + 1, den)
          ],
          i => reduced(num + i + 2, den)
        ),
        correctVal: correct,
        exp: divide
          ? `חילוק בשבר הוא כפל בהופכי: ${expr(`${frac(n1, d1)} × ${frac(d2, n2)}`)} = ${correct}.`
          : `בכפל שברים כופלים מונה במונה ומכנה במכנה: ${inline(`(${n1}×${n2})/(${d1}×${d2})`)} = ${correct}.`
      };
    },

    // אחוזים — round percentages, then discounts and increases.
    level => {
      const percent = byLevel(level, [
        pick([25, 50]), pick([10, 20, 25, 50]), pick([5, 15, 20, 40]),
        pick([12, 18, 35, 65]), pick([7, 13, 17, 23])
      ]);
      const total = rand(...byLevel(level, [[2, 8], [2, 12], [3, 20], [4, 40], [5, 80]])) * 50;
      const part = (percent / 100) * total;
      const discount = level >= 3;
      const correct = Number((discount ? total - part : part).toFixed(2));
      return {
        topic: 'אחוזים',
        text: discount
          ? `בחנות מוצר שמחירו ${total} שקלים נמכר בהנחה של ${percent}%. כמה ישלם הקונה?`
          : `כמה הם ${percent}% מתוך ${total}?`,
        options: fourOptions(
          correct,
          [
            Number(part.toFixed(2)),
            Number((total + part).toFixed(2)),
            Number((correct + total / 10).toFixed(2))
          ],
          i => Number((correct + (i + 2) * 7).toFixed(2))
        ),
        correctVal: String(correct),
        exp: discount
          ? `הנחה של ${percent}% משאירה ${100 - percent}% מהמחיר: ${inline(`${(100 - percent) / 100} × ${total} = ${correct}`)} שקלים.`
          : `${percent}% הם ${frac(percent, 100)} מהשלם: ${inline(`${percent / 100} × ${total} = ${correct}`)}.`
      };
    },

    // שטח משולש
    level => {
      const [lo, hi] = byLevel(level, [[2, 8], [4, 12], [6, 16], [7, 25], [11, 45]]);
      const base = rand(lo, hi) * 2; // keeps the halving exact at low levels
      const height = rand(lo, hi);
      const area = (base * height) / 2;
      return {
        topic: 'גיאומטריה - שטח משולש',
        text: `מהו שטחו של משולש שאורך בסיסו ${base} ס"מ והגובה אליו ${height} ס"מ?`,
        options: fourOptions(
          area,
          [base * height, base + height, area + 4],
          i => area + (i + 2) * 3
        ),
        correctVal: String(area),
        exp: `שטח משולש הוא (בסיס × גובה) חלקי 2: ${inline(`(${base}×${height})÷2 = ${area}`)} סמ"ר.`,
        diagram: { shape: 'triangle', base, height }
      };
    },

    // יחס ופרופורציה
    level => {
      const unit = rand(...byLevel(level, [[2, 6], [3, 10], [4, 14], [5, 22], [7, 35]]));
      const qty1 = rand(2, byLevel(level, [3, 4, 5, 7, 9]));
      const qty2 = qty1 + rand(2, byLevel(level, [3, 4, 6, 9, 14]));
      const total1 = unit * qty1;
      const correct = unit * qty2;
      return {
        topic: 'בעיות מילוליות - יחס',
        text: `עבור ${qty1} מחברות שילמנו ${total1} שקלים. כמה נשלם עבור ${qty2} מחברות באותו המחיר?`,
        options: fourOptions(
          correct,
          [total1 + qty2, correct - unit, total1 + unit * (qty2 - qty1)],
          i => correct + (i + 2) * 4
        ),
        correctVal: String(correct),
        exp: `מחיר מחברת אחת: ${inline(`${total1} ÷ ${qty1} = ${unit}`)}. עבור ${qty2} מחברות: ${inline(`${unit} × ${qty2} = ${correct}`)} שקלים.`
      };
    },

    // דרך, מהירות וזמן
    level => {
      const speed = rand(...byLevel(level, [[10, 20], [30, 60], [50, 100], [45, 110], [55, 125]]));
      const time = byLevel(level, [rand(2, 3), rand(2, 5), rand(2, 6), rand(2, 7), rand(2, 9)]);
      const findTime = level >= 4;
      const distance = speed * time;
      const correct = findTime ? time : distance;
      return {
        topic: 'בעיות מילוליות - דרך ומהירות',
        text: findTime
          ? `מכונית עברה ${distance} ק"מ במהירות קבועה של ${speed} קמ"ש. כמה שעות ארכה הנסיעה?`
          : `מכונית נסעה במהירות קבועה של ${speed} קמ"ש במשך ${time} שעות. מהו המרחק שעברה?`,
        options: fourOptions(
          correct,
          [correct + 1, findTime ? distance : speed + time, correct + (findTime ? 2 : 20)],
          i => correct + (i + 2) * (findTime ? 1 : 15)
        ),
        correctVal: String(correct),
        exp: findTime
          ? `זמן שווה דרך חלקי מהירות: ${inline(`${distance} ÷ ${speed} = ${correct}`)} שעות.`
          : `דרך שווה מהירות כפול זמן: ${inline(`${speed} × ${time} = ${correct}`)} ק"מ.`
      };
    }
  ],

  '7': [
    // סדר פעולות עם חזקות
    level => {
      const base = rand(...byLevel(level, [[2, 3], [2, 4], [2, 5], [2, 6], [3, 8]]));
      const power = byLevel(level, [2, 2, 2, 3, 3]);
      const a = rand(2, byLevel(level, [4, 6, 9, 12, 15]));
      const c = rand(...byLevel(level, [[2, 10], [5, 25], [10, 50], [15, 80], [20, 150]]));
      const correct = base ** power + a * c;
      return {
        topic: 'סדר פעולות וחזקות',
        text: `חשב את ערך הביטוי: <br>${inline(`${base}^${power} + ${a} × ${c}`)}`,
        options: fourOptions(
          correct,
          [base * power + a * c, (base ** power + a) * c, correct - a],
          i => correct + (i + 2) * 5
        ),
        correctVal: String(correct),
        exp: `חזקה קודמת לכפל, וכפל קודם לחיבור: ${inline(`${base}^${power} = ${base ** power}`)}, ${inline(`${a}×${c} = ${a * c}`)}, ובסך הכל ${correct}.`
      };
    },

    // מספרים מכוונים
    level => {
      const [lo, hi] = byLevel(level, [[-9, -1], [-15, -1], [-25, -2], [-60, -3], [-150, -5]]);
      const n1 = rand(lo, hi);
      const n2 = rand(lo, hi);
      const multiply = level >= 4;
      const correct = multiply ? n1 * n2 : n1 - n2;
      return {
        topic: 'מספרים מכוונים',
        text: `חשב: <br>${inline(`(${n1}) ${multiply ? '×' : '-'} (${n2})`)}`,
        options: fourOptions(
          correct,
          [-correct, n1 + n2, Math.abs(n1) + Math.abs(n2)],
          i => correct + (i + 1) * 3
        ),
        correctVal: String(correct),
        exp: multiply
          ? `מכפלת שני מספרים שליליים היא חיובית: ${inline(`(${n1}) × (${n2}) = ${correct}`)}.`
          : `חיסור מספר שלילי שקול לחיבור נגדיו: ${inline(`${n1} + ${Math.abs(n2)} = ${correct}`)}.`
      };
    },

    // ביטויים אלגבריים וחוק הפילוג
    level => {
      const a = rand(2, byLevel(level, [3, 5, 8, 12, 20]));
      const b = rand(1, byLevel(level, [4, 7, 10, 15, 25]));
      const c = rand(2, byLevel(level, [3, 5, 7, 10, 14]));
      const expanded = `${a * c}x ${signed(b * c)}`;
      return {
        topic: 'חוק הפילוג',
        text: `פתח את הסוגריים: <br>${inline(`${c}(${a}x + ${b})`)}`,
        options: fourOptions(
          expanded,
          [`${a * c}x + ${b}`, `${a + c}x + ${b * c}`, `${a * c}x + ${b + c}`],
          i => `${a * c + i + 1}x + ${b * c}`
        ),
        correctVal: expanded,
        exp: `מכפילים כל איבר בסוגריים ב-${c}: ${inline(`${c}×${a}x = ${a * c}x`)} וגם ${inline(`${c}×${b} = ${b * c}`)}.`
      };
    },

    // משוואה בנעלם אחד
    level => {
      const x = rand(...byLevel(level, [[1, 5], [2, 9], [2, 12], [-9, 9], [-20, 20]]));
      const a = rand(2, byLevel(level, [3, 5, 8, 12, 15]));
      const b = rand(...byLevel(level, [[1, 10], [2, 20], [5, 40], [-30, 30], [-60, 60]]));
      const bothSides = level >= 4;
      const d = bothSides ? rand(1, a - 1) : 0;
      const c = a * x + b;
      const text = bothSides
        ? `${coef(a, 'x')}${signedConst(b)} = ${coef(d, 'x')}${signedConst(c - d * x)}`
        : `${coef(a, 'x')}${signedConst(b)} = ${c}`;
      const correct = `x = ${x}`;
      return {
        topic: 'משוואה בנעלם אחד',
        text: `פתור את המשוואה: <br>${inline(text)}`,
        options: fourOptions(
          correct,
          [`x = ${x + 1}`, `x = ${x - 1}`, `x = ${-x}`],
          i => `x = ${x + i + 2}`
        ),
        correctVal: correct,
        exp: bothSides
          ? `מעבירים נעלמים לאגף אחד ומספרים לשני, ומקבלים ${inline(`${coef(a - d, 'x')} = ${(a - d) * x}`)}, כלומר ${inline(`x = ${x}`)}.`
          : `מחסרים ${b} משני האגפים: ${inline(`${a}x = ${c - b}`)}, ומחלקים ב-${a}: ${inline(`x = ${x}`)}.`
      };
    },

    // שורש ריבועי
    level => {
      const root = rand(...byLevel(level, [[2, 6], [3, 10], [4, 15], [6, 25], [10, 40]]));
      const square = root * root;
      const correct = String(root);
      return {
        topic: 'שורש ריבועי',
        text: `חשב: <br>${inline(`√${square}`)}`,
        options: fourOptions(
          correct,
          [String(square / 2), String(root + 1), String(root * 2)],
          i => String(root + i + 2)
        ),
        correctVal: correct,
        exp: `מחפשים מספר שהעלאתו בריבוע נותנת ${square}: ${inline(`${root}² = ${square}`)}.`
      };
    },

    // זוויות במשולש
    level => {
      const a = rand(...byLevel(level, [[40, 70], [30, 80], [25, 85], [20, 95], [15, 110]]));
      const b = rand(20, Math.max(25, 175 - a - 20));
      const c = 180 - a - b;
      const correct = `${c}°`;
      return {
        topic: 'זוויות במשולש',
        text: `במשולש נתונות שתי זוויות: ${a}° ו-${b}°. מהו גודלה של הזווית השלישית?`,
        options: fourOptions(
          correct,
          [`${c + 10}°`, `${Math.abs(c - 10)}°`, `${180 - a}°`],
          i => `${c + (i + 2) * 5}°`
        ),
        correctVal: correct,
        exp: `סכום הזוויות במשולש הוא 180°: ${inline(`180 - ${a} - ${b} = ${c}`)}.`,
        diagram: { shape: 'angleTriangle', a, b }
      };
    },

    // נפח תיבה
    level => {
      const [lo, hi] = byLevel(level, [[2, 5], [2, 8], [3, 11], [4, 16], [6, 24]]);
      const a = rand(lo, hi);
      const b = rand(lo, hi);
      const c = rand(lo, hi);
      const correct = a * b * c;
      return {
        topic: 'נפח תיבה',
        text: `מהו נפחה של תיבה שמידותיה ${a} ס"מ, ${b} ס"מ ו-${c} ס"מ?`,
        options: fourOptions(
          correct,
          [a + b + c, 2 * (a * b + b * c + a * c), correct + 10],
          i => correct + (i + 2) * 6
        ),
        correctVal: String(correct),
        exp: `נפח תיבה הוא מכפלת שלוש מידותיה: ${inline(`${a} × ${b} × ${c} = ${correct}`)} סמ"ק.`,
        diagram: { shape: 'box', a, b, c }
      };
    }
  ],

  '8': [
    // מערכת משוואות בשני נעלמים
    level => {
      const x = rand(...byLevel(level, [[1, 4], [1, 6], [-6, 8], [-10, 10], [-15, 15]]));
      const y = rand(...byLevel(level, [[1, 4], [1, 6], [-6, 8], [-10, 10], [-15, 15]]));
      const a = rand(1, byLevel(level, [2, 3, 5, 8, 12]));
      const b = rand(1, byLevel(level, [2, 3, 5, 8, 12]));
      const c = rand(1, byLevel(level, [2, 3, 5, 8, 12]));
      const d = -rand(1, byLevel(level, [2, 3, 5, 8, 12]));
      const e1 = a * x + b * y;
      const e2 = c * x + d * y;
      const correct = `x = ${x}, y = ${y}`;
      return {
        topic: 'מערכת משוואות בשני נעלמים',
        text: `פתור את המערכת: <br>${inline(`${coef(a, 'x')} ${signedCoef(b, 'y')} = ${e1}`)}<br>${inline(`${coef(c, 'x')} ${signedCoef(d, 'y')} = ${e2}`)}`,
        options: fourOptions(
          correct,
          [`x = ${y}, y = ${x}`, `x = ${x + 1}, y = ${y - 1}`, `x = ${-x}, y = ${-y}`],
          i => `x = ${x + i + 2}, y = ${y}`
        ),
        correctVal: correct,
        exp: `בשיטת ההצבה או החיבור מקבלים ${inline(`x = ${x}`)} ואז ${inline(`y = ${y}`)}. הצבה בשתי המשוואות מאמתת את הפתרון.`
      };
    },

    // פונקציה קווית
    level => {
      const m = rand(...byLevel(level, [[1, 3], [2, 5], [-5, 5], [-8, 8], [-12, 12]])) || 2;
      const n = byLevel(level, [0, 0, rand(-5, 5), rand(-12, 12), rand(-25, 25)]);
      const x = rand(1, byLevel(level, [3, 4, 6, 9, 14]));
      const y = m * x + n;
      const askY = level >= 3;
      const correct = askY ? String(y) : String(m);
      return {
        topic: 'פונקציה קווית',
        text: askY
          ? `נתונה הפונקציה ${inline(`y = ${coef(m, 'x')}${signedConst(n)}`)}. מהו ערך ${inline('y')} כאשר ${inline(`x = ${x}`)}?`
          : `מהו שיפוע הישר העובר בנקודות (0,0) ו-(${x},${y})?`,
        options: fourOptions(
          correct,
          askY ? [String(m * x), String(y + m), String(m + x + n)] : [String(-m), frac(1, m), String(m + 1)],
          i => String(Number(correct) + (i + 2) * 2)
        ),
        correctVal: correct,
        exp: askY
          ? `מציבים ${inline(`x = ${x}`)}: ${inline(`${m}×${x} ${signed(n)} = ${y}`)}.`
          : `שיפוע הוא היחס בין הפרש ה-y להפרש ה-x: ${inline(`(${y}-0)/(${x}-0) = ${m}`)}.`
      };
    },

    // ערך מוחלט
    level => {
      const inner = rand(...byLevel(level, [[-9, -1], [-20, -1], [-40, 40], [-80, 80], [-200, 200]]));
      const add = rand(...byLevel(level, [[1, 5], [1, 10], [-15, 15], [-30, 30], [-60, 60]]));
      const correct = Math.abs(inner) + add;
      return {
        topic: 'ערך מוחלט',
        text: `חשב את ערך הביטוי: <br>${inline(`|${inner}|${signedConst(add)}`)}`,
        options: fourOptions(
          correct,
          [inner + add, -Math.abs(inner) + add, Math.abs(inner + add)],
          i => correct + (i + 1) * 4
        ),
        correctVal: String(correct),
        exp: `ערך מוחלט מחזיר את המרחק מהאפס, תמיד אי-שלילי: ${inline(`|${inner}| = ${Math.abs(inner)}`)}, ולכן התוצאה ${correct}.`
      };
    },

    // משפט פיתגורס
    level => {
      const triples = byLevel(level, [
        [[3, 4, 5]],
        [[3, 4, 5], [6, 8, 10]],
        [[3, 4, 5], [6, 8, 10], [5, 12, 13]],
        [[5, 12, 13], [8, 15, 17], [9, 12, 15]],
        [[7, 24, 25], [20, 21, 29], [12, 35, 37]]
      ]);
      const t = pick(triples);
      const findLeg = level >= 4;
      const correct = findLeg ? String(t[1]) : String(t[2]);
      return {
        topic: 'משפט פיתגורס',
        text: findLeg
          ? `במשולש ישר זווית אורך היתר ${t[2]} ס"מ ואורך ניצב אחד ${t[0]} ס"מ. מהו אורך הניצב השני?`
          : `במשולש ישר זווית אורכי הניצבים הם ${t[0]} ס"מ ו-${t[1]} ס"מ. מהו אורך היתר?`,
        options: fourOptions(
          correct,
          [String(t[2] + t[0]), String(t[0] + t[1]), String(Math.abs(t[2] - t[0]))],
          i => String(Number(correct) + i + 1)
        ),
        correctVal: correct,
        exp: findLeg
          ? `לפי פיתגורס ${inline('a² = c² - b²')}: ${inline(`${t[2]}² - ${t[0]}² = ${t[1] * t[1]}`)}, ולכן הניצב הוא ${t[1]}.`
          : `לפי פיתגורס ${inline('a² + b² = c²')}: ${inline(`${t[0]}² + ${t[1]}² = ${t[2]}²`)}, ולכן היתר הוא ${t[2]}.`
      };
    },

    // דמיון משולשים
    level => {
      const ratio = rand(2, byLevel(level, [2, 3, 4, 5, 7]));
      const side = rand(...byLevel(level, [[2, 5], [3, 8], [4, 12], [5, 18], [7, 30]]));
      const correct = side * ratio;
      const other = rand(2, 9);
      return {
        topic: 'דמיון משולשים',
        text: `שני משולשים דומים. צלע במשולש הקטן היא ${side} ס"מ, והצלע המתאימה לה במשולש הגדול היא ${side * ratio} ס"מ. אם צלע נוספת במשולש הקטן היא ${other} ס"מ, מה אורך הצלע המתאימה לה?`,
        options: fourOptions(
          other * ratio,
          [other + ratio, other * ratio + side, Math.round(other / ratio)],
          i => other * ratio + (i + 1) * 2
        ),
        correctVal: String(other * ratio),
        exp: `יחס הדמיון הוא ${inline(`${side * ratio} ÷ ${side} = ${ratio}`)}. לכן הצלע המתאימה היא ${inline(`${other} × ${ratio} = ${other * ratio}`)} ס"מ.`
      };
    },

    // אחוזי שינוי
    level => {
      const start = rand(...byLevel(level, [[2, 6], [2, 10], [3, 20], [4, 40], [6, 90]])) * 50;
      const percent = byLevel(level, [50, pick([10, 20, 50]), pick([15, 25, 40]), pick([12, 35, 60]), pick([8, 17, 44])]);
      const correct = Number((start * (1 + percent / 100)).toFixed(2));
      return {
        topic: 'אחוזי שינוי',
        text: `מחיר מוצר הוא ${start} שקלים והוא התייקר ב-${percent}%. מהו המחיר החדש?`,
        options: fourOptions(
          correct,
          [
            Number((start * (percent / 100)).toFixed(2)),
            Number((start * (1 - percent / 100)).toFixed(2)),
            start + percent
          ],
          i => Number((correct + (i + 2) * 9).toFixed(2))
        ),
        correctVal: String(correct),
        exp: `התייקרות של ${percent}% היא כפל ב-${1 + percent / 100}: ${inline(`${start} × ${1 + percent / 100} = ${correct}`)} שקלים.`
      };
    }
  ],

  '9': [
    // חוקי חזקות
    level => {
      const base = rand(2, byLevel(level, [3, 4, 6, 9, 12]));
      const p1 = rand(2, byLevel(level, [3, 4, 6, 8, 11]));
      const p2 = rand(1, byLevel(level, [2, 3, 5, 7, 9]));
      const divide = level >= 3 && p1 > p2;
      const power = divide ? p1 - p2 : p1 + p2;
      const correct = `${base}^${power}`;
      return {
        topic: 'חוקי חזקות',
        text: `פשט את הביטוי: <br>${inline(`${base}^${p1} ${divide ? '÷' : '×'} ${base}^${p2}`)}`,
        options: fourOptions(
          correct,
          [`${base}^${divide ? p1 + p2 : p1 - p2}`, `${base}^${p1 * p2}`, `${base * base}^${power}`],
          i => `${base}^${power + i + 1}`
        ),
        correctVal: correct,
        exp: divide
          ? `בחילוק חזקות בעלות אותו בסיס מחסרים את המעריכים: ${inline(`${p1} - ${p2} = ${power}`)}.`
          : `בכפל חזקות בעלות אותו בסיס מחברים את המעריכים: ${inline(`${p1} + ${p2} = ${power}`)}.`
      };
    },

    // טכניקה אלגברית - פירוק לגורמים
    level => {
      const r1 = rand(...byLevel(level, [[1, 3], [1, 5], [-6, 6], [-10, 10], [-15, 15]])) || 2;
      const r2 = rand(...byLevel(level, [[1, 3], [1, 5], [-6, 6], [-10, 10], [-15, 15]])) || 3;
      const b = -(r1 + r2);
      const c = r1 * r2;
      // A factor whose root is 0 is just "x". Rendering it as "(x + 0)" would
      // show the student an unsimplified factorisation, and roots can cancel
      // inside the distractors even though r1 and r2 are themselves non-zero.
      const factor = root => (root === 0 ? 'x' : `(x ${signed(-root)})`);
      const correct = `${factor(r1)}${factor(r2)}`;
      return {
        topic: 'טכניקה אלגברית - פירוק לגורמים',
        text: `פרק לגורמים: <br>${inline(`x²${b === 0 ? '' : ` ${signedCoef(b, 'x')}`}${signedConst(c)}`)}`,
        options: fourOptions(
          correct,
          [
            `${factor(-r1)}${factor(-r2)}`,
            `${factor(r1)}${factor(-r2)}`,
            `${factor(r1 + r2)}${factor(-1)}`
          ],
          i => `${factor(r1 + i + 1)}${factor(r2)}`
        ),
        correctVal: correct,
        exp: `מחפשים שני מספרים שמכפלתם ${c} וסכומם ${-b}: אלה ${r1} ו-${r2}. לכן הפירוק הוא ${correct}.`
      };
    },

    // משוואה ריבועית
    level => {
      const x1 = rand(...byLevel(level, [[1, 3], [1, 5], [1, 7], [-8, 8], [-14, 14]])) || 2;
      const x2 = rand(...byLevel(level, [[-3, -1], [-5, -1], [-7, -1], [-8, 8], [-14, 14]])) || -3;
      const b = -(x1 + x2);
      const c = x1 * x2;
      const correct = `x₁=${x1}, x₂=${x2}`;
      return {
        topic: 'משוואות ריבועיות',
        text: `מצא את פתרונות המשוואה: <br>${inline(`x²${b === 0 ? '' : ` ${signedCoef(b, 'x')}`}${signedConst(c)} = 0`)}`,
        options: fourOptions(
          correct,
          [`x₁=${-x1}, x₂=${-x2}`, `x₁=${x1 + 1}, x₂=${x2 - 1}`, `x₁=${x2}, x₂=${x2}`],
          i => `x₁=${x1 + i + 2}, x₂=${x2}`
        ),
        correctVal: correct,
        exp: `לפי הטרינום המשוואה שקולה ל-${inline(`(x ${signed(-x1)})(x ${signed(-x2)}) = 0`)}, ולכן הפתרונות הם ${x1} ו-${x2}.`
      };
    },

    // פונקציה ריבועית - קדקוד
    level => {
      const a = byLevel(level, [1, 1, rand(1, 3), rand(-3, 3) || 2, rand(-5, 5) || 2]);
      // A zero vertex coordinate would render the standard form with a "+ 0x"
      // or "+ 0" term, which reads as an unsimplified expression.
      const xv = rand(...byLevel(level, [[1, 3], [-4, 4], [-6, 6], [-9, 9], [-14, 14]])) || 2;
      const rawYv = rand(...byLevel(level, [[1, 5], [-8, 8], [-15, 15], [-30, 30], [-60, 60]])) || 3;
      const b = -2 * a * xv;
      // The free term is a·xv² + yv, which can land on 0 for some combinations
      // and would render as a trailing "+ 0". Shifting the vertex height keeps
      // the question valid and the expression clean.
      const yv = a * xv * xv + rawYv === 0 ? rawYv + 1 : rawYv;
      const c = a * xv * xv + yv;
      const correct = `(${xv}, ${yv})`;
      return {
        topic: 'פונקציה ריבועית - קדקוד',
        text: `מהו קדקוד הפרבולה ${inline(`y = ${coef(a, 'x²')} ${signedCoef(b, 'x')}${signedConst(c)}`)}?`,
        options: fourOptions(
          correct,
          [`(${-xv}, ${yv})`, `(${yv}, ${xv})`, `(${xv}, ${-yv})`],
          i => `(${xv + i + 1}, ${yv})`
        ),
        correctVal: correct,
        exp: `שיעור ה-x של הקדקוד הוא ${inline(`-b/2a = ${xv}`)}. הצבה נותנת ${inline(`y = ${yv}`)}.`
      };
    },

    // הסתברות
    level => {
      const total = rand(...byLevel(level, [[4, 8], [6, 12], [10, 20], [12, 30], [15, 50]]));
      const target = rand(1, Math.max(2, Math.floor(total / 2)));
      const complement = level >= 4;
      const favourable = complement ? total - target : target;
      const correct = reduced(favourable, total);
      return {
        topic: 'הסתברות',
        text: complement
          ? `בכד ${total} כדורים, מתוכם ${target} אדומים והשאר לבנים. מהי ההסתברות להוציא כדור שאינו אדום?`
          : `בכד ${total} כדורים, מתוכם ${target} אדומים והשאר לבנים. מהי ההסתברות להוציא כדור אדום?`,
        options: fourOptions(
          correct,
          [reduced(total - favourable, total), frac(1, target), frac(favourable, total + target)],
          i => frac(favourable + i + 1, total + i + 2)
        ),
        correctVal: correct,
        exp: `הסתברות היא מספר התוצאות הרצויות חלקי סך התוצאות: ${frac(favourable, total)} = ${correct}.`
      };
    },

    // מרובעים
    level => {
      const [lo, hi] = byLevel(level, [[3, 8], [4, 12], [5, 16], [7, 24], [10, 40]]);
      const a = rand(lo, hi);
      const b = rand(lo, hi) + a; // keeps the trapezoid bases distinct
      const h = rand(lo, hi);
      const correct = ((a + b) / 2) * h;
      return {
        topic: 'שטח טרפז',
        text: `מהו שטחו של טרפז שאורכי בסיסיו ${a} ס"מ ו-${b} ס"מ וגובהו ${h} ס"מ?`,
        options: fourOptions(
          correct,
          [(a + b) * h, a * b, correct + h],
          i => correct + (i + 2) * 3
        ),
        correctVal: String(correct),
        exp: `שטח טרפז הוא סכום הבסיסים כפול הגובה חלקי 2: ${inline(`((${a}+${b})÷2)×${h} = ${correct}`)} סמ"ר.`
      };
    }
  ],

  '10': [
    // --- 3 יח"ל ומעלה ---
    atTrack(3, level => {
      const [lo, hi] = byLevel(level, [[3, 6], [3, 9], [4, 12], [5, 18], [7, 30]]);
      const a = rand(lo, hi);
      const b = rand(lo, hi);
      const sq = a * a + b * b;
      const dist = Math.sqrt(sq);
      const isInt = Number.isInteger(dist);
      const correct = isInt ? String(dist) : `√${sq}`;
      return {
        topic: 'גיאומטריה אנליטית - מרחק',
        text: `מהו המרחק בין הראשית (0,0) לנקודה (${a},${b})?`,
        options: fourOptions(
          correct,
          [String(a + b), `√${sq + 5}`, isInt ? String(dist + 1) : `√${sq - 2}`],
          i => `√${sq + (i + 2) * 3}`
        ),
        correctVal: correct,
        exp: `לפי נוסחת המרחק: ${inline(`d² = ${a}² + ${b}² = ${sq}`)}, ולכן המרחק הוא ${correct}.`
      };
    }),

    atTrack(3, level => {
      const angles = byLevel(level, [[30, 45], [30, 45, 60], [30, 45, 60], [30, 45, 60], [30, 45, 60]]);
      const angle = pick(angles);
      const table = {
        30: { sin: frac(1, 2), cos: `${frac('√3', 2)}`, tan: frac('√3', 3) },
        45: { sin: frac('√2', 2), cos: frac('√2', 2), tan: '1' },
        60: { sin: frac('√3', 2), cos: frac(1, 2), tan: '√3' }
      };
      const fn = byLevel(level, ['sin', 'sin', pick(['sin', 'cos']), pick(['sin', 'cos', 'tan']), pick(['sin', 'cos', 'tan'])]);
      const names = { sin: 'sin', cos: 'cos', tan: 'tan' };
      const correct = table[angle][fn];
      const others = Object.values(table[angle]).filter(v => v !== correct);
      return {
        topic: 'טריגונומטריה במשולש ישר זווית',
        text: `מהו ערכו של ${inline(`${names[fn]}(${angle}°)`)}?`,
        options: fourOptions(
          correct,
          [...others, frac(1, 3)],
          i => frac(i + 2, 5)
        ),
        correctVal: correct,
        exp: `זהו אחד מערכי הזוויות המיוחדות: ${inline(`${names[fn]}(${angle}°)`)} = ${correct}.`
      };
    }),

    atTrack(3, level => {
      const a1 = rand(...byLevel(level, [[1, 5], [1, 9], [-8, 12], [-20, 25], [-40, 50]]));
      const d = rand(...byLevel(level, [[2, 4], [2, 7], [-9, 9], [-15, 15], [-25, 25]])) || 3;
      const n = rand(...byLevel(level, [[3, 6], [4, 10], [5, 15], [8, 30], [12, 60]]));
      const correct = a1 + (n - 1) * d;
      return {
        topic: 'סדרה חשבונית',
        text: `בסדרה חשבונית האיבר הראשון הוא ${a1} והפרש הסדרה ${d}. מהו האיבר ה-${n}?`,
        options: fourOptions(
          correct,
          [a1 + n * d, a1 * n, correct - d],
          i => correct + (i + 2) * Math.abs(d || 1)
        ),
        correctVal: String(correct),
        exp: `לפי הנוסחה ${inline('aₙ = a₁ + (n-1)d')}: ${inline(`${a1} + ${n - 1}×${d} = ${correct}`)}.`
      };
    }),

    // --- 4 יח"ל ומעלה ---
    atTrack(4, level => {
      const m = rand(...byLevel(level, [[1, 3], [1, 5], [-5, 5], [-9, 9], [-14, 14]])) || 2;
      const n = rand(...byLevel(level, [[0, 4], [-6, 6], [-12, 12], [-25, 25], [-50, 50]]));
      const correct = `y = ${coef(m, 'x')}${signedConst(n)}`;
      return {
        topic: 'גיאומטריה אנליטית - משוואת ישר',
        text: `מהי משוואת הישר ששיפועו ${m} והחותך את ציר ה-${inline('y')} בנקודה (0,${n})?`,
        options: fourOptions(
          correct,
          [
            `y = ${coef(n, 'x')}${signedConst(m)}`,
            `y = ${coef(-m, 'x')}${signedConst(n)}`,
            `y = ${coef(m, 'x')}${signedConst(-n)}`
          ],
          i => `y = ${coef(m + i + 1, 'x')}${signedConst(n)}`
        ),
        correctVal: correct,
        exp: `בצורה ${inline('y = mx + n')} השיפוע הוא ${m} והחיתוך עם ציר ה-y הוא ${n}.`
      };
    }),

    // --- 5 יח"ל בלבד ---
    atTrack(5, level => {
      const r = rand(...byLevel(level, [[2, 4], [2, 6], [3, 9], [4, 12], [5, 20]]));
      // A zero centre coordinate would render as "(x + 0)²", which reads as an
      // unfinished expression rather than as a circle centred on an axis.
      const a = rand(...byLevel(level, [[1, 3], [-5, 5], [-9, 9], [-15, 15], [-30, 30]])) || 2;
      const b = rand(...byLevel(level, [[1, 3], [-5, 5], [-9, 9], [-15, 15], [-30, 30]])) || 3;
      const correct = `(x ${signed(-a)})² + (y ${signed(-b)})² = ${r * r}`;
      return {
        topic: 'משוואת מעגל',
        text: `מהי משוואת המעגל שמרכזו (${a},${b}) ורדיוסו ${r}?`,
        options: fourOptions(
          correct,
          [
            `(x ${signed(a)})² + (y ${signed(b)})² = ${r * r}`,
            `(x ${signed(-a)})² + (y ${signed(-b)})² = ${r}`,
            `(x ${signed(-b)})² + (y ${signed(-a)})² = ${r * r}`
          ],
          i => `(x ${signed(-a)})² + (y ${signed(-b)})² = ${r * r + i + 1}`
        ),
        correctVal: correct,
        exp: `משוואת מעגל היא ${inline('(x-a)² + (y-b)² = R²')}. כאן ${inline(`R² = ${r}² = ${r * r}`)}.`
      };
    })
  ],

  '11': [
    // --- 3 יח"ל ומעלה ---
    atTrack(3, level => {
      const start = rand(...byLevel(level, [[2, 5], [2, 9], [3, 15], [4, 30], [5, 60]])) * 100;
      const percent = byLevel(level, [10, pick([5, 10, 20]), pick([4, 8, 15]), pick([3, 7, 12]), pick([2, 6, 11])]);
      const years = rand(...byLevel(level, [[2, 2], [2, 3], [2, 4], [3, 6], [4, 9]]));
      const growth = level >= 4 ? pick([1, -1]) : 1;
      const rate = 1 + (growth * percent) / 100;
      const correct = Number((start * rate ** years).toFixed(2));
      return {
        topic: 'גדילה ודעיכה',
        text: growth > 0
          ? `סכום של ${start} שקלים מושקע בריבית שנתית של ${percent}%. מה יהיה הסכום לאחר ${years} שנים?`
          : `ערכו של מוצר ${start} שקלים ויורד ב-${percent}% מדי שנה. מה יהיה ערכו לאחר ${years} שנים?`,
        options: fourOptions(
          correct,
          [
            Number((start * (1 + (growth * percent * years) / 100)).toFixed(2)),
            Number((start * rate).toFixed(2)),
            Number((start * rate ** (years + 1)).toFixed(2))
          ],
          i => Number((correct + (i + 2) * 25).toFixed(2))
        ),
        correctVal: String(correct),
        exp: `זהו תהליך מעריכי: ${inline(`${start} × ${rate}^${years} = ${correct}`)} שקלים.`
      };
    }),

    // --- 4 יח"ל ומעלה ---
    atTrack(4, level => {
      const n = rand(...byLevel(level, [[2, 3], [2, 4], [3, 6], [3, 8], [4, 11]]));
      const a = rand(...byLevel(level, [[2, 4], [2, 6], [-8, 9], [-15, 15], [-25, 25]])) || 3;
      const correct = `f'(x) = ${coef(a * n, `x^${n - 1}`)}`;
      return {
        topic: 'חשבון דיפרנציאלי - נגזרת',
        text: `מהי הנגזרת של הפונקציה: <br>${inline(`f(x) = ${coef(a, `x^${n}`)}`)}`,
        options: fourOptions(
          correct,
          [
            `f'(x) = ${coef(a, `x^${n - 1}`)}`,
            `f'(x) = ${coef(a * n, `x^${n}`)}`,
            `f'(x) = ${coef(n, `x^${n - 1}`)}`
          ],
          i => `f'(x) = ${coef(a * n + i + 1, `x^${n - 1}`)}`
        ),
        correctVal: correct,
        exp: `לפי כלל הגזירה לפולינום כופלים את המקדם במעריך (${inline(`${a}×${n} = ${a * n}`)}) ומורידים 1 מהמעריך.`
      };
    }),

    atTrack(4, level => {
      const a1 = rand(...byLevel(level, [[1, 3], [1, 5], [2, 8], [-9, 9], [-15, 15]])) || 2;
      const q = rand(...byLevel(level, [[2, 2], [2, 3], [2, 4], [-4, 4], [-6, 6]]));
      const ratio = q === 0 || q === 1 ? 2 : q;
      const n = rand(...byLevel(level, [[3, 4], [3, 5], [4, 6], [4, 8], [5, 10]]));
      const correct = a1 * ratio ** (n - 1);
      return {
        topic: 'סדרה הנדסית',
        text: `בסדרה הנדסית האיבר הראשון הוא ${a1} ומנת הסדרה ${ratio}. מהו האיבר ה-${n}?`,
        options: fourOptions(
          correct,
          [a1 * ratio ** n, a1 * ratio * n, a1 + (n - 1) * ratio],
          i => correct + (i + 2) * Math.abs(a1 || 1)
        ),
        correctVal: String(correct),
        exp: `לפי הנוסחה ${inline('aₙ = a₁·q^(n-1)')}: ${inline(`${a1} × ${ratio}^${n - 1} = ${correct}`)}.`
      };
    }),

    // --- 5 יח"ל בלבד ---
    atTrack(5, level => {
      const base = rand(2, byLevel(level, [3, 4, 5, 8, 12]));
      const power = rand(2, byLevel(level, [3, 4, 5, 6, 8]));
      const result = base ** power;
      const correct = String(power);
      return {
        topic: 'לוגריתמים',
        text: `חשב: <br>${inline(`log₍${base}₎(${result})`)}`,
        options: fourOptions(
          correct,
          [String(result / base), String(base), String(power + 1)],
          i => String(power + i + 2)
        ),
        correctVal: correct,
        exp: `לוגריתם שואל לאיזו חזקה יש להעלות את הבסיס: ${inline(`${base}^${power} = ${result}`)}, ולכן התשובה ${power}.`
      };
    })
  ],

  '12': [
    // --- 3 יח"ל ומעלה ---
    atTrack(3, level => {
      const total = rand(...byLevel(level, [[4, 8], [6, 12], [8, 20], [10, 30], [12, 50]]));
      const good = rand(2, Math.max(3, total - 2));
      const draws = byLevel(level, [1, 1, 2, 2, 2]);
      const correct = draws === 1
        ? reduced(good, total)
        : reduced(good * (good - 1), total * (total - 1));
      return {
        topic: 'הסתברות',
        text: draws === 1
          ? `בקופסה ${total} פתקים, ${good} מהם זוכים. מהי ההסתברות למשוך פתק זוכה?`
          : `בקופסה ${total} פתקים, ${good} מהם זוכים. מושכים שני פתקים ללא החזרה. מהי ההסתברות ששניהם זוכים?`,
        options: fourOptions(
          correct,
          [
            reduced(good * good, total * total),
            reduced(total - good, total),
            reduced(good, total * 2)
          ],
          i => frac(good + i + 1, total + i + 2)
        ),
        correctVal: correct,
        exp: draws === 1
          ? `הסתברות היא היחס בין התוצאות הרצויות לכלל התוצאות: ${correct}.`
          : `ללא החזרה, ההסתברות היא ${expr(`${frac(good, total)} × ${frac(good - 1, total - 1)}`)} = ${correct}.`
      };
    }),

    // --- 4 יח"ל ומעלה ---
    atTrack(4, level => {
      const a = rand(...byLevel(level, [[2, 4], [2, 6], [2, 9], [-9, 12], [-15, 20]])) || 3;
      const upper = rand(...byLevel(level, [[2, 3], [2, 4], [2, 5], [2, 6], [3, 8]]));
      // ∫₀^u a·x² dx = a·u³/3. Rendered through reduced() rather than as a
      // number: when a is not a multiple of 3 the exact value is a fraction,
      // and String(32/3) would show the student a 17-digit decimal.
      const numerator = a * upper ** 3;
      const correct = reduced(numerator, 3);
      return {
        topic: 'אינטגרלים',
        text: `חשב את האינטגרל המסוים: <br>${inline(`∫ (מ-0 עד ${upper}) ${coef(a, 'x²')} dx`)}`,
        options: fourOptions(
          correct,
          [String(numerator), reduced(a * upper ** 2, 2), reduced(numerator + 3, 3)],
          i => reduced(numerator + (i + 2) * 3, 3)
        ),
        correctVal: correct,
        exp: `הפונקציה הקדומה היא ${inline(`(${a}/3)x³`)}. הצבת הגבול העליון נותנת ${inline(`(${a}/3)×${upper ** 3}`)} = ${correct}, והגבול התחתון תורם 0.`
      };
    }),

    // --- 5 יח"ל בלבד ---
    atTrack(5, level => {
      const a = nonUnit(rand(...byLevel(level, [[2, 3], [2, 5], [2, 7], [-7, 9], [-12, 15]])), 2);
      const inner = coef(a, 'x');
      const correct = `f'(x) = ${mul(a)}cos(${inner})`;
      return {
        topic: 'נגזרת פונקציה טריגונומטרית',
        text: `מהי הנגזרת של: <br>${inline(`f(x) = sin(${inner})`)}`,
        options: fourOptions(
          correct,
          [`f'(x) = cos(${inner})`, `f'(x) = ${mul(a)}sin(${inner})`, `f'(x) = ${mul(-a)}cos(${inner})`],
          i => `f'(x) = ${mul(a + i + 1)}cos(${inner})`
        ),
        correctVal: correct,
        exp: `לפי כלל השרשרת, נגזרת ${inline('sin(u)')} היא ${inline("cos(u)·u'")}. כאן ${inline(`u = ${inner}`)} ולכן ${inline(`u' = ${a}`)}.`
      };
    }),

    atTrack(5, level => {
      const a = nonUnit(rand(...byLevel(level, [[2, 3], [2, 4], [2, 6], [-6, 8], [-10, 12]])), 3);
      const inner = coef(a, 'x');
      const correct = `f'(x) = ${mul(a)}e^(${inner})`;
      return {
        topic: 'נגזרת פונקציה מעריכית',
        text: `מהי הנגזרת של: <br>${inline(`f(x) = e^(${inner})`)}`,
        options: fourOptions(
          correct,
          [`f'(x) = e^(${inner})`, `f'(x) = ${coef(a, 'x')}·e^(${inner})`, `f'(x) = e^(${inner})/${a}`],
          i => `f'(x) = ${mul(a + i + 1)}e^(${inner})`
        ),
        correctVal: correct,
        exp: `נגזרת ${inline('e^u')} היא ${inline("e^u·u'")}. כאן ${inline(`u = ${inner}`)}, ולכן הנגזרת היא ${inline(`${mul(a)}e^(${inner})`)}.`
      };
    })
  ]
};

// Curriculum-gap topics are APPENDED to the grades that already exist, not
// spread into the literal above — spreading would replace grades 4-6 wholesale
// and silently delete every generator declared for them here.
for (const [grade, generators] of Object.entries(curriculumGenerators)) {
  mathGenerators[grade] = [...(mathGenerators[grade] || []), ...generators];
}
