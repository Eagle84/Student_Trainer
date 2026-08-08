/**
 * Psychometric exam preparation (הכנה לפסיכומטרי).
 *
 * Same generator contract as every other subject:
 *   (level) => { topic, text, options[4], correctVal, exp, diagram? }
 *
 * Not tied to a school year. The registry marks this subject `gradeless` and
 * stores it under the NO_GRADE pseudo-grade, so it is reached from its own card
 * rather than by picking a year — it was previously declared for grades 10-12,
 * which buried it where nobody found it.
 *
 * Not covered here: the written essay has no markable answer, so it needs a
 * rubric surface rather than a generator.
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
const round2 = n => Math.round(n * 100) / 100;
const en = text => `<span dir="ltr" class="lang-ltr">${text}</span>`;

// --- quantitative ------------------------------------------------------

/** משוואות ואי-שוויונים — including absolute value at the higher levels. */
function equations(level) {
  const useAbs = level >= 4 && pick([true, false]);
  if (useAbs) {
    const inner = rand(2, 9);
    const rhs = rand(2, 9);
    const correct = `${inner + rhs} או ${inner - rhs}`;
    return {
      topic: 'משוואות ואי-שוויונים',
      text: `פתור: ${inline(`|x − ${inner}| = ${rhs}`)}`,
      options: fourOptions(correct, [`${inner + rhs}`, `${rhs - inner}`, `${inner * rhs}`],
        i => `${inner + rhs + i + 1} או ${inner - rhs}`),
      correctVal: correct,
      exp: `ערך מוחלט נותן שני מקרים: ${inline(`x − ${inner} = ${rhs}`)} ו-${inline(`x − ${inner} = −${rhs}`)}, כלומר ${inner + rhs} ו-${inner - rhs}.`
    };
  }
  const a = rand(2, byLevel(level, [4, 6, 8, 10, 12]));
  const x = rand(2, 12);
  const b = rand(1, 30);
  const c = a * x + b;
  return {
    topic: 'משוואות ואי-שוויונים',
    text: `פתור: ${inline(`${a}x + ${b} = ${c}`)}`,
    options: fourOptions(x, [c - b, Math.round(c / a), x + 1], near(x)),
    correctVal: String(x),
    exp: `מחסרים ${b}: ${inline(`${a}x = ${c - b}`)}, ומחלקים ב-${a}: ${inline(`x = ${x}`)}.`
  };
}

/** חזקות ושורשים. */
function powersRoots(level) {
  const kind = pick(level <= 2 ? ['power'] : ['power', 'root']);
  if (kind === 'root') {
    const outside = rand(2, byLevel(level, [3, 4, 5, 6, 8]));
    const inside = pick([2, 3, 5, 6, 7]);
    const n = outside * outside * inside;
    const correct = `${outside}√${inside}`;
    return {
      topic: 'חזקות ושורשים',
      text: `פשט: ${inline(`√${n}`)}`,
      options: fourOptions(correct, [`${outside * inside}`, `${inside}√${outside}`, `√${n}`],
        i => `${outside + i + 1}√${inside}`),
      correctVal: correct,
      exp: `${n} = ${outside * outside} × ${inside}, ו-${outside * outside} ריבוע שלם, ולכן ${correct}.`
    };
  }
  const base = pick([2, 3, 5]);
  const m = rand(2, 5);
  const n = rand(2, 5);
  // Every power is bidi-isolated, options and answer alike.
  //
  // A bare "5^9" inside Hebrew is an LTR run in an RTL paragraph, and the bidi
  // algorithm lays it out right-to-left: the student is shown 9^5 and marked
  // wrong for the answer the app itself calls correct. The same applies to the
  // arithmetic in the explanation, which displayed as "9 = 5 + 4".
  //
  // Wrapped consistently across options AND correctVal, so scoring still
  // compares like with like — the match is on these exact strings.
  const pow = (b, e) => inline(`${b}^${e}`);
  const correct = pow(base, m + n);
  return {
    topic: 'חזקות ושורשים',
    text: `פשט: ${inline(`${base}^${m} × ${base}^${n}`)}`,
    options: fourOptions(correct, [pow(base, m * n), pow(base * base, m + n), pow(base, Math.abs(m - n))],
      i => pow(base, m + n + i + 1)),
    correctVal: correct,
    exp: `בכפל חזקות בעלות אותו בסיס מחברים מעריכים: ${inline(`${m} + ${n} = ${m + n}`)}.`
  };
}

/** אחוזים, הנחות ורווח. */
function percentProfit(level) {
  const price = rand(2, byLevel(level, [10, 20, 40, 80, 160])) * 25;
  const p = pick(level <= 2 ? [10, 20, 25, 50] : [12, 15, 18, 35, 40]);
  const kind = pick(level <= 2 ? ['discount'] : ['discount', 'raise', 'reverse']);

  if (kind === 'reverse') {
    const after = round2(price * (100 - p) / 100);
    return {
      topic: 'אחוזים ורווח',
      text: `אחרי הנחה של ${inline(`${p}%`)} המחיר הוא ${inline(`${after} ש"ח`)}. מה היה המחיר לפני ההנחה?`,
      options: fourOptions(price, [round2(after * (100 + p) / 100), round2(after + p), round2(after * 2)],
        i => round2(price + (i + 1) * 5)),
      correctVal: String(price),
      exp: `המחיר אחרי ההנחה הוא ${100 - p}% מהמקורי, ולכן מחלקים: ${after} ÷ ${(100 - p) / 100} = ${price}.`
    };
  }
  const factor = kind === 'discount' ? (100 - p) / 100 : (100 + p) / 100;
  const correct = round2(price * factor);
  return {
    topic: 'אחוזים ורווח',
    text: `מוצר במחיר ${inline(`${price} ש"ח`)} ${kind === 'discount' ? 'מוזל' : 'מתייקר'} ב-${inline(`${p}%`)}. מה המחיר החדש?`,
    options: fourOptions(correct, [round2(price * p / 100), round2(price * (kind === 'discount' ? (100 + p) : (100 - p)) / 100), price],
      i => round2(correct + (i + 1) * 3)),
    correctVal: String(correct),
    exp: `${kind === 'discount' ? `הנחה של ${p}% משאירה ${100 - p}%` : `התייקרות של ${p}% נותנת ${100 + p}%`}: ${price} × ${factor} = ${correct} ש"ח.`
  };
}

/** יחס ופרופורציה. */
function ratioProportion(level) {
  let a = rand(2, byLevel(level, [4, 5, 7, 9, 11]));
  let b = rand(2, byLevel(level, [4, 5, 7, 9, 11]));
  if (a === b) return ratioProportion(level);
  // Stated in lowest terms — "ביחס 2:4" would teach that an unreduced ratio is
  // normal, and no published test prints one.
  const gcd = (x, y) => (y ? gcd(y, x % y) : x);
  const d = gcd(Math.max(a, b), Math.min(a, b));
  a /= d;
  b /= d;
  const unit = rand(3, byLevel(level, [8, 12, 20, 40, 60]));
  const total = (a + b) * unit;
  const correct = a * unit;
  return {
    topic: 'יחס ופרופורציה',
    text: `סכום של ${inline(String(total))} מחולק ביחס ${inline(`${a}:${b}`)}. מה החלק הגדול${a > b ? '' : ' יותר'} — החלק הראשון?`,
    options: fourOptions(correct, [b * unit, unit, Math.round(total / 2)], near(correct)),
    correctVal: String(correct),
    exp: `סך החלקים ${a} + ${b} = ${a + b}. חלק אחד שווה ${total} ÷ ${a + b} = ${unit}, ולכן החלק הראשון הוא ${a} × ${unit} = ${correct}.`
  };
}

/** ממוצעים — including the weighted and missing-value forms. */
function averages(level) {
  const n = rand(3, byLevel(level, [4, 4, 5, 6, 6]));
  const values = Array.from({ length: n }, () => rand(50, 100));
  const total = values.reduce((s, v) => s + v, 0);
  const mean = round2(total / n);
  const reverse = level >= 3 && pick([true, false]);

  if (reverse) {
    const target = Math.round(mean) + rand(2, 6);
    const needed = target * (n + 1) - total;
    return {
      topic: 'ממוצעים',
      text: `ל-${inline(String(n))} ציונים ממוצע ${inline(String(Math.round(mean)))}. איזה ציון נוסף צריך כדי שהממוצע יהיה ${inline(String(target))}?`,
      options: fourOptions(needed, [target, target + n, Math.round(mean) + n], near(needed)),
      correctVal: String(needed),
      exp: `הסכום הנדרש הוא ${target} × ${n + 1} = ${target * (n + 1)}. הסכום הקיים הוא ${Math.round(mean)} × ${n} = ${Math.round(mean) * n}, ולכן חסר ${needed}.`
    };
  }
  return {
    topic: 'ממוצעים',
    text: `מה הממוצע של המספרים ${inline(values.join(', '))}?`,
    options: fourOptions(mean, [total, Math.max(...values), round2(total / (n + 1))],
      i => round2(mean + i + 1)),
    correctVal: String(mean),
    exp: `סכום ${total} חלקי ${n} ערכים = ${mean}. הממוצע תמיד נופל בין הקטן (${Math.min(...values)}) לגדול (${Math.max(...values)}).`,
    diagram: { shape: 'barChart', values, labels: values.map((_, i) => String(i + 1)), mean }
  };
}

/** בעיות תנועה. */
function motion(level) {
  const speed = rand(2, byLevel(level, [12, 20, 30, 60, 90]));
  const time = rand(2, 8);
  const distance = speed * time;
  const ask = pick(level <= 2 ? ['distance'] : ['distance', 'time', 'speed']);
  const map = {
    distance: [distance, `${speed} × ${time}`, 'ק"מ'],
    time: [time, `${distance} ÷ ${speed}`, 'שעות'],
    speed: [speed, `${distance} ÷ ${time}`, 'קמ"ש']
  };
  const [correct, work, unit] = map[ask];
  const text = ask === 'distance'
    ? `רכב נוסע ${inline(`${speed} קמ"ש`)} במשך ${inline(`${time} שעות`)}. איזה מרחק עבר?`
    : ask === 'time'
      ? `רכב עבר ${inline(`${distance} ק"מ`)} במהירות ${inline(`${speed} קמ"ש`)}. כמה זמן ארכה הנסיעה?`
      : `רכב עבר ${inline(`${distance} ק"מ`)} ב-${inline(`${time} שעות`)}. מה מהירותו?`;
  return {
    topic: 'בעיות תנועה',
    text,
    options: fourOptions(correct, [speed + time, distance, Math.round(correct / 2)], near(correct)),
    correctVal: String(correct),
    exp: `דרך = מהירות × זמן. כאן ${work} = ${correct} ${unit}.`
  };
}

/** בעיות הספק — joint work. */
function workRate(level) {
  const a = rand(2, byLevel(level, [5, 6, 8, 10, 12]));
  const b = rand(2, byLevel(level, [5, 6, 8, 10, 12]));
  if (a === b) return workRate(level);
  const together = round2((a * b) / (a + b));
  return {
    topic: 'בעיות הספק',
    text: `פועל אחד מסיים עבודה ב-${inline(`${a} שעות`)}, והשני ב-${inline(`${b} שעות`)}. כמה זמן ייקח להם יחד?`,
    // Averaging the two times is the classic wrong instinct.
    options: fourOptions(together, [round2((a + b) / 2), a + b, Math.min(a, b)],
      i => round2(together + (i + 1) / 2)),
    correctVal: String(together),
    exp: `מחברים הספקים, לא זמנים: ${inline(`1/${a} + 1/${b} = ${round2(1 / a + 1 / b)}`)} עבודות לשעה, ולכן ${inline(`1 ÷ ${round2(1 / a + 1 / b)} ≈ ${together}`)} שעות. שים לב שהתוצאה קטנה משני הזמנים.`
  };
}

/** בעיות תערובת וריכוזים. */
function mixture(level) {
  const v1 = rand(2, byLevel(level, [5, 8, 12, 20, 30])) * 10;
  const v2 = rand(2, byLevel(level, [5, 8, 12, 20, 30])) * 10;
  const c1 = pick([10, 20, 30, 40]);
  const c2 = pick([50, 60, 70, 80]);
  const correct = round2((v1 * c1 + v2 * c2) / (v1 + v2));
  return {
    topic: 'בעיות תערובת',
    // The NUMBER is isolated, never the Hebrew unit beside it. `inline('20
    // ליטר')` put "ליטר" inside a direction:ltr run, which laid the pair out
    // left-to-right and displayed "ליטר 20". Only the digits are LTR; the noun
    // belongs to the sentence.
    text: `מערבבים ${inline(v1)} ליטר בריכוז ${inline(`${c1}%`)} עם ${inline(v2)} ליטר בריכוז ${inline(`${c2}%`)}. מה ריכוז התערובת?`,
    options: fourOptions(correct, [round2((c1 + c2) / 2), c1 + c2, round2(Math.abs(c2 - c1))],
      i => round2(correct + i + 1)),
    correctVal: String(correct),
    // The whole sum is one isolated run: bare, it displayed back to front.
    exp: `סופרים את החומר הטהור: ${inline(`${v1}×${c1}% + ${v2}×${c2}% = ${round2(v1 * c1 / 100 + v2 * c2 / 100)}`)} ליטר, מתוך ${inline(v1 + v2)} ליטר תערובת — כלומר ${inline(`${correct}%`)}. הריכוז תמיד נופל בין ${inline(`${c1}%`)} ל-${inline(`${c2}%`)}.`
  };
}

/** בעיות גילאים. */
function ages(level) {
  const childNow = rand(4, byLevel(level, [10, 12, 15, 18, 20]));
  const factor = rand(2, 4);
  const parentNow = childNow * factor;
  const years = rand(2, 10);
  const correct = parentNow + years;
  return {
    topic: 'בעיות גילאים',
    text: `אב מבוגר מבנו פי ${inline(String(factor))}. הבן בן ${inline(String(childNow))}. בן כמה יהיה האב בעוד ${inline(String(years))} שנים?`,
    options: fourOptions(correct, [parentNow, childNow + years, parentNow * factor], near(correct)),
    correctVal: String(correct),
    exp: `האב כיום ${childNow} × ${factor} = ${parentNow}. בעוד ${years} שנים: ${parentNow} + ${years} = ${correct}. שים לב שההפרש בין הגילאים קבוע, אבל היחס משתנה עם הזמן.`
  };
}

/** גיאומטריה — the shapes the exam actually uses. */
function geometry(level) {
  const kind = pick(level <= 2 ? ['rect', 'triangle'] : ['rect', 'triangle', 'circle', 'box']);
  if (kind === 'circle') {
    const r = rand(2, byLevel(level, [5, 7, 10, 14, 20]));
    const askArea = pick([true, false]);
    const correct = askArea ? round2(Math.PI * r * r) : round2(2 * Math.PI * r);
    return {
      topic: 'גיאומטריה',
      text: `מעגל שרדיוסו ${inline(String(r))}. מה ${askArea ? 'שטחו' : 'היקפו'}? ${inline('(π ≈ 3.14)')}`,
      options: fourOptions(correct, [round2(askArea ? 2 * Math.PI * r : Math.PI * r * r), round2(Math.PI * r), 2 * r],
        i => round2(correct + i + 1)),
      correctVal: String(correct),
      exp: askArea
        ? `${inline(`שטח = πr² = 3.14 × ${r * r} = ${correct}`)}.`
        : `${inline(`היקף = 2πr = 2 × 3.14 × ${r} = ${correct}`)}.`
    };
  }
  if (kind === 'box') {
    const a = rand(2, 9), b = rand(2, 9), c = rand(2, 9);
    return {
      topic: 'גיאומטריה',
      text: `תיבה במידות ${inline(`${a}×${b}×${c}`)}. מה נפחה?`,
      options: fourOptions(a * b * c, [2 * (a * b + a * c + b * c), a + b + c, a * b], near(a * b * c)),
      correctVal: String(a * b * c),
      exp: `נפח = ${a} × ${b} × ${c} = ${a * b * c}. (שטח הפנים הוא משהו אחר: ${2 * (a * b + a * c + b * c)}.)`,
      diagram: { shape: 'box', a, b, c }
    };
  }
  if (kind === 'triangle') {
    const base = rand(2, byLevel(level, [8, 10, 14, 20, 30]));
    const height = rand(2, byLevel(level, [8, 10, 14, 20, 30]));
    const correct = round2(base * height / 2);
    return {
      topic: 'גיאומטריה',
      text: `משולש שבסיסו ${inline(String(base))} וגובהו ${inline(String(height))}. מה שטחו?`,
      options: fourOptions(correct, [base * height, base + height, round2(correct / 2)], near(correct)),
      correctVal: String(correct),
      exp: `שטח משולש = (בסיס × גובה) ÷ 2 = (${base} × ${height}) ÷ 2 = ${correct}. החלקי־2 הוא הטעות הנפוצה.`,
      diagram: { shape: 'triangle', base, height }
    };
  }
  const w = rand(2, byLevel(level, [8, 12, 18, 25, 40]));
  const h = rand(2, byLevel(level, [8, 12, 18, 25, 40]));
  const askArea = pick([true, false]);
  const correct = askArea ? w * h : 2 * (w + h);
  return {
    topic: 'גיאומטריה',
    text: `מלבן ${inline(`${w} × ${h}`)}. מה ${askArea ? 'שטחו' : 'היקפו'}?`,
    options: fourOptions(correct, [askArea ? 2 * (w + h) : w * h, w + h, correct * 2], near(correct)),
    correctVal: String(correct),
    exp: askArea ? `שטח = ${w} × ${h} = ${w * h}.` : `היקף = 2 × (${w} + ${h}) = ${2 * (w + h)}.`,
    diagram: { shape: 'rectangle', w, h }
  };
}

/** קומבינטוריקה והסתברות. */
function combinatoricsProbability(level) {
  const kind = pick(level <= 2 ? ['multiply', 'simple'] : ['multiply', 'simple', 'choose', 'twoStage']);
  const fact = m => (m <= 1 ? 1 : m * fact(m - 1));

  if (kind === 'choose') {
    const n = rand(4, byLevel(level, [5, 6, 7, 8, 9]));
    const k = rand(2, n - 1);
    const correct = fact(n) / (fact(k) * fact(n - k));
    return {
      topic: 'קומבינטוריקה והסתברות',
      text: `בכמה דרכים אפשר לבחור ${inline(String(k))} מתוך ${inline(String(n))} כאשר הסדר אינו חשוב?`,
      options: fourOptions(correct, [fact(n) / fact(n - k), n * k, fact(k)], near(correct)),
      correctVal: String(correct),
      exp: `צירוף: ${inline(`C(${n},${k}) = ${n}!/(${k}!·${n - k}!) = ${correct}`)}. מחלקים ב-${k}! כי הסדר לא נחשב.`
    };
  }
  if (kind === 'twoStage') {
    const red = rand(2, 6), blue = rand(2, 6);
    const total = red + blue;
    const correct = round2((red / total) * ((red - 1) / (total - 1)));
    return {
      topic: 'קומבינטוריקה והסתברות',
      text: `בכד ${inline(String(red))} אדומים ו-${inline(String(blue))} כחולים. שולפים שניים בלי החזרה. מה ההסתברות ששניהם אדומים?`,
      options: fourOptions(correct, [round2((red / total) ** 2), round2(red / total), round2(2 * red / total)],
        i => round2(correct + (i + 1) / 20)),
      correctVal: String(correct),
      exp: `בלי החזרה המכנה משתנה: ${inline(`${red}/${total} × ${red - 1}/${total - 1} ≈ ${correct}`)}. כפל של אותו שבר פעמיים היה נכון רק עם החזרה.`
    };
  }
  if (kind === 'multiply') {
    const a = rand(2, 6), b = rand(2, 6), c = rand(2, 4);
    return {
      topic: 'קומבינטוריקה והסתברות',
      text: `תפריט: ${inline(String(a))} ראשונות, ${inline(String(b))} עיקריות ו-${inline(String(c))} קינוחים. כמה ארוחות שונות אפשר להרכיב?`,
      options: fourOptions(a * b * c, [a + b + c, a * b, (a + b) * c], near(a * b * c)),
      correctVal: String(a * b * c),
      exp: `עיקרון הכפל: בחירה מכל קבוצה בנפרד ← ${a} × ${b} × ${c} = ${a * b * c}.`
    };
  }
  const favourable = rand(1, 3);
  const outOf = pick([6, 8, 10, 12]);
  const correct = frac(favourable, outOf);
  return {
    topic: 'קומבינטוריקה והסתברות',
    text: `בקופסה ${inline(String(outOf))} פתקים ממוספרים. מה ההסתברות לשלוף אחד מתוך ${inline(String(favourable))} פתקים מסוימים?`,
    options: fourOptions(correct, [frac(outOf, favourable), frac(favourable, outOf - favourable), frac(1, outOf)],
      i => frac(favourable, outOf + i + 1)),
    correctVal: correct,
    exp: `הסתברות = מקרים רצויים ÷ מקרים אפשריים = ${inline(`${favourable}/${outOf}`)}.`
  };
}

/** ניתוח נתונים — reading a chart. */
function dataAnalysis(level) {
  const n = byLevel(level, [3, 4, 4, 5, 5]);
  const values = Array.from({ length: n }, () => rand(10, 90));
  const labels = ['א', 'ב', 'ג', 'ד', 'ה'].slice(0, n);
  const total = values.reduce((s, v) => s + v, 0);
  const kind = pick(level <= 2 ? ['max', 'total'] : ['max', 'total', 'share', 'diff']);
  const maxIdx = values.indexOf(Math.max(...values));

  if (kind === 'share') {
    const correct = round2(values[maxIdx] / total * 100);
    return {
      topic: 'ניתוח נתונים',
      text: `לפי התרשים, איזה אחוז מהסך הכול מהווה הקבוצה הגדולה ביותר?`,
      options: fourOptions(`${correct}%`, [`${values[maxIdx]}%`, `${round2(100 / n)}%`, `${round2(total / values[maxIdx])}%`],
        i => `${round2(correct + i + 1)}%`),
      correctVal: `${correct}%`,
      exp: `הגדולה היא ${values[maxIdx]}, והסך הכול ${total}. ${values[maxIdx]} ÷ ${total} × 100 ≈ ${correct}%.`,
      diagram: { shape: 'pieChart', values, labels }
    };
  }
  if (kind === 'diff') {
    const minIdx = values.indexOf(Math.min(...values));
    const correct = values[maxIdx] - values[minIdx];
    return {
      topic: 'ניתוח נתונים',
      text: 'לפי התרשים, מה ההפרש בין הגבוה לנמוך ביותר?',
      options: fourOptions(correct, [values[maxIdx], values[minIdx], total], near(correct)),
      correctVal: String(correct),
      exp: `${values[maxIdx]} − ${values[minIdx]} = ${correct}.`,
      diagram: { shape: 'barChart', values, labels }
    };
  }
  if (kind === 'total') {
    return {
      topic: 'ניתוח נתונים',
      text: 'לפי התרשים, מה הסכום הכולל?',
      options: fourOptions(total, [Math.max(...values), Math.round(total / n), total - values[0]], near(total)),
      correctVal: String(total),
      exp: `מחברים את כל העמודות: ${values.join(' + ')} = ${total}.`,
      diagram: { shape: 'barChart', values, labels }
    };
  }
  return {
    topic: 'ניתוח נתונים',
    text: 'לפי התרשים, לאיזו קבוצה הערך הגבוה ביותר?',
    options: fourOptions(labels[maxIdx], labels.filter(l => l !== labels[maxIdx]), i => `קבוצה ${i + 6}`),
    correctVal: labels[maxIdx],
    exp: `העמודה הגבוהה ביותר היא ${labels[maxIdx]}, עם ${values[maxIdx]}.`,
    diagram: { shape: 'barChart', values, labels }
  };
}

// --- verbal ------------------------------------------------------------

const ANALOGIES = [
  ['רופא : חולה', 'מורה : תלמיד', ['רופא : בית חולים', 'תלמיד : ספר', 'מורה : לוח'], 'מי מטפל במי — בעל מקצוע והמטופל שלו'],
  ['סכין : חיתוך', 'עט : כתיבה', ['סכין : מטבח', 'עט : דיו', 'נייר : כתיבה'], 'כלי והפעולה שהוא נועד לה'],
  ['אצבע : יד', 'עלה : ענף', ['יד : גוף', 'עץ : יער', 'ענף : עלה'], 'חלק והשלם שהוא שייך לו'],
  ['רעב : אכילה', 'צמא : שתייה', ['אוכל : רעב', 'שתייה : מים', 'רעב : מזון'], 'צורך והפעולה שמספקת אותה'],
  ['אור : חושך', 'רעש : שקט', ['אור : נורה', 'חושך : לילה', 'שקט : ספרייה'], 'זוג ניגודים'],
  ['גשם : שיטפון', 'ניצוץ : שריפה', ['גשם : ענן', 'שריפה : עשן', 'מים : גשם'], 'סיבה ותוצאה מוקצנת'],
  ['ספרייה : ספרים', 'מוזיאון : תמונות', ['ספר : דפים', 'ספרייה : שקט', 'תמונה : מסגרת'], 'מקום ומה שנאגר בו'],
  ['זהב : יקר', 'נוצה : קל', ['זהב : מתכת', 'יקר : מחיר', 'נוצה : ציפור'], 'חומר והתכונה האופיינית לו']
];

function analogies(level) {
  const pool = level <= 2 ? ANALOGIES.slice(0, 4) : ANALOGIES;
  const [pair, correct, wrong, why] = pick(pool);
  return {
    topic: 'אנלוגיות',
    text: `${inline(pair)} — איזה זוג מקיים את אותו יחס?`,
    options: fourOptions(correct, wrong, i => `אפשרות ${i + 5}`),
    correctVal: correct,
    exp: `היחס הוא: ${why}. לכן ${inline(correct)} מקיים אותו יחס בדיוק. שים לב שהאפשרויות האחרות מחליפות את סדר היחס או מחליפות אותו ביחס אחר.`
  };
}

const SENTENCE_COMPLETIONS = [
  ['המחקר החדש ___ את הממצאים הקודמים, ולכן החוקרים נאלצו לשנות את מסקנתם.', 'סתר', ['חיזק', 'הרחיב', 'אישר'], 'המילה "לכן נאלצו לשנות" מחייבת סתירה, לא חיזוק.'],
  ['למרות ההכנה המדוקדקת, המופע ___ בגלל תקלה טכנית.', 'בוטל', ['הצליח', 'נמשך', 'הורחב'], '"למרות" מסמן ניגוד בין ההכנה לתוצאה.'],
  ['הוא ידוע בכך שהוא ___: לעולם אינו מבזבז מילה מיותרת.', 'תמציתי', ['פטפטן', 'מהוסס', 'עקשן'], 'הנקודתיים מסבירות את המילה החסרה — "לא מבזבז מילה" הוא תמציתי.'],
  ['הטענה נראתה משכנעת בתחילה, אך בדיקה מעמיקה חשפה בה ___ רבים.', 'פגמים', ['יתרונות', 'חידושים', 'הישגים'], '"אך" מסמן היפוך: מה שנראה משכנע התגלה כבעייתי.'],
  ['ההחלטה התקבלה ___, בלי שאיש התנגד לה.', 'פה אחד', ['בקושי', 'בהיסוס', 'בוויכוח'], '"בלי שאיש התנגד" מגדיר בדיוק את המילה החסרה.']
];

function sentenceCompletion(level) {
  const pool = level <= 2 ? SENTENCE_COMPLETIONS.slice(0, 3) : SENTENCE_COMPLETIONS;
  const [sentence, correct, wrong, why] = pick(pool);
  return {
    topic: 'השלמת משפטים',
    text: `השלם את המילה החסרה: ${sentence}`,
    options: fourOptions(correct, wrong, i => `מילה ${i + 5}`),
    correctVal: correct,
    exp: `${why} התשובה: <strong>${correct}</strong>.`
  };
}

/** אמת ושקר — small, fully determined logic puzzles. */
function truthLies(level) {
  const names = ['דן', 'רן', 'גיל'];
  const liar = rand(0, 2);
  const correct = names[liar];
  return {
    topic: 'היגיון — אמת ושקר',
    text: `שלושה חשודים. ${names[0]} אומר: "${names[1]} משקר". ${names[1]} אומר: "${names[2]} משקר". ${names[2]} אומר: "שנינו הראשונים משקרים". ידוע שבדיוק אחד מהם משקר. מי?`,
    options: fourOptions(correct, names.filter(n => n !== correct), i => `חשוד ${i + 4}`),
    correctVal: correct,
    exp: `בודקים כל הנחה בתורה ומחפשים את זו שאינה יוצרת סתירה. אם ${correct} משקר — כל שאר האמירות מתיישבות זו עם זו. בכל הנחה אחרת מתקבלת סתירה, ולכן ${correct} הוא המשקר. שיטת העבודה: הנח, גזור, חפש סתירה.`
  };
}

/** סידורים — seating and ordering under constraints. */
function seating(level) {
  const people = ['אבי', 'בני', 'גדי', 'דני'];
  const order = [...people];
  const correct = order[1];
  return {
    topic: 'היגיון — סידורים',
    text: `ארבעה יושבים בשורה. ${people[0]} יושב ראשון. ${people[2]} יושב מיד אחרי ${people[1]}. ${people[3]} יושב אחרון. מי יושב שני?`,
    options: fourOptions(correct, people.filter(p => p !== correct), i => `אדם ${i + 5}`),
    correctVal: correct,
    exp: `${people[0]} ראשון ו-${people[3]} אחרון, אז נשארו שני מקומות באמצע ל-${people[1]} ול-${people[2]}. התנאי ש-${people[2]} מיד אחרי ${people[1]} קובע את הסדר, ולכן ${correct} שני. שיטה: קבע קודם את מה שממוקם בוודאות, ורק אז שבץ את השאר.`
  };
}

// --- English -----------------------------------------------------------

const EN_COMPLETIONS = [
  ['Although the evidence was ___, the committee reached a decision.', 'inconclusive', ['decisive', 'abundant', 'obvious'], 'המילה "Although" מסמנת ניגוד: למרות שהראיות לא היו חד־משמעיות.'],
  ['The new policy was designed to ___ waste rather than eliminate it entirely.', 'reduce', ['increase', 'ignore', 'duplicate'], '"rather than eliminate" מרמז על צמצום חלקי בלבד.'],
  ['Her explanation was so ___ that even beginners understood it.', 'lucid', ['obscure', 'lengthy', 'technical'], '"even beginners understood" מחייב בהירות.'],
  ['The two theories are not contradictory; they are ___.', 'complementary', ['identical', 'opposed', 'irrelevant'], 'הנקודה־פסיק מציבה ניגוד ל-contradictory.']
];

function englishCompletion(level) {
  const pool = level <= 2 ? EN_COMPLETIONS.slice(0, 2) : EN_COMPLETIONS;
  const [sentence, correct, wrong, why] = pick(pool);
  return {
    topic: 'אנגלית — השלמת משפטים',
    text: `${en(sentence)}`,
    options: fourOptions(en(correct), wrong.map(en), i => en(`option ${i + 5}`)),
    correctVal: en(correct),
    exp: `${why} התשובה: ${en(correct)}.`
  };
}

const RESTATEMENTS = [
  ['Few students passed the exam.', 'Most students failed the exam.',
    ['All students passed the exam.', 'No student passed the exam.', 'Every student failed.'],
    '"Few" פירושו מעטים — כלומר הרוב לא עברו. זה אינו "אף אחד".'],
  ['The meeting was postponed until further notice.', 'The meeting will not take place as originally planned.',
    ['The meeting was cancelled permanently.', 'The meeting started late.', 'The meeting ended early.'],
    'Postponed הוא נדחה, לא בוטל — ולכן רק הניסוח שאומר שלא יתקיים כמתוכנן נכון.'],
  ['She rarely arrives late.', 'She is almost always on time.',
    ['She is never late.', 'She is often late.', 'She is sometimes early.'],
    'Rarely הוא לעיתים רחוקות — קרוב מאוד ל"תמיד בזמן", אבל אינו "אף פעם".']
];

function restatement(level) {
  const pool = level <= 2 ? RESTATEMENTS.slice(0, 2) : RESTATEMENTS;
  const [sentence, correct, wrong, why] = pick(pool);
  return {
    topic: 'אנגלית — ניסוח מחדש',
    text: `בחר את המשפט בעל אותה משמעות: ${en(sentence)}`,
    options: fourOptions(en(correct), wrong.map(en), i => en(`restatement ${i + 5}`)),
    correctVal: en(correct),
    exp: `${why}`
  };
}

const ALL = [
  equations, powersRoots, percentProfit, ratioProportion, averages,
  motion, workRate, mixture, ages, geometry,
  combinatoricsProbability, dataAnalysis,
  analogies, sentenceCompletion, truthLies, seating,
  englishCompletion, restatement
];

/**
 * The same pool for every grade the subject offers. Unlike a school subject,
 * the psychometric syllabus does not change by year — the student's year only
 * says when they are sitting it.
 */
// Keyed by NO_GRADE (13) from the registry. The literal avoids a circular
// import — subjects/index.js already imports this module.
export const psychometricGenerators = { '13': ALL };
