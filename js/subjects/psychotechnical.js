/**
 * Psychotechnical test preparation (הכנה לפסיכוטכני).
 *
 * Same generator contract as every other subject:
 *   (level) => { topic, text, options[4], correctVal, exp, diagram?, optionDiagrams? }
 *
 * Gradeless, like פסיכומטרי: army placement, driving-instructor screening and
 * employer batteries are sat at whatever age the candidate happens to be, so a
 * school year is the wrong key. The registry stores it under NO_GRADE.
 *
 * What makes this subject different from every other one in the app: several of
 * its item types cannot be written in words. A shape series, a rotation and a
 * Raven matrix are pictures, and the ANSWERS are pictures too. Those generators
 * return `optionDiagrams` — a map from option string to a visual spec — which
 * ui.js renders inside each option. The option strings stay plain ("צורה א"),
 * so scoring, the error log and the weak-topic analysis are unchanged.
 */
import { inline, rand } from '../mathfmt.js';
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

/**
 * Labels for picture answers.
 *
 * Four fixed Hebrew letters rather than the figure's description, because the
 * label must NOT give the rule away — an option reading "ריבוע מסובב 90°" turns
 * a spatial item into a reading item.
 */
const TAGS = ['צורה א', 'צורה ב', 'צורה ג', 'צורה ד'];

/**
 * Builds a picture-answer question from the correct figure and three distractors.
 *
 * The correct figure is placed at a random one of the four tags before the map
 * is built, so the answer is not always first. quiz.js shuffles the option list
 * afterwards as well; both are safe because the map is keyed by the tag.
 */
function figureAnswers(correctSpec, wrongSpecs) {
  const at = rand(0, 3);
  const specs = [];
  let w = 0;
  for (let i = 0; i < 4; i++) specs.push(i === at ? correctSpec : wrongSpecs[w++]);

  const optionDiagrams = {};
  TAGS.forEach((tag, i) => { optionDiagrams[tag] = { shape: 'figureOne', figure: specs[i] }; });
  return { options: [...TAGS], correctVal: TAGS[at], optionDiagrams };
}

// --- shapes and space --------------------------------------------------

const SHAPE_NAMES = {
  square: 'ריבוע', circle: 'עיגול', triangle: 'משולש', diamond: 'מעוין', arrow: 'חץ'
};

/**
 * סדרות צורות — a row of figures advancing by one rule, with one cell blank.
 *
 * Exactly one property changes per item. Two changing properties make the item
 * ambiguous far more often than it makes it hard, which is the single most
 * common flaw in home-made practice material.
 */
function shapeSeries(level) {
  const shape = pick(['square', 'circle', 'triangle', 'diamond']);
  const length = byLevel(level, [4, 4, 5, 5, 5]);
  const rule = pick(level <= 2 ? ['dots', 'fill'] : ['dots', 'fill', 'rotate']);

  const items = [];
  for (let i = 0; i < length; i++) {
    if (rule === 'dots') items.push({ shape, dots: (i % 4) + 1 });
    else if (rule === 'fill') items.push({ shape, fill: i % 2 === 0, dots: 0 });
    else items.push({ shape: 'arrow', rotate: (i * 90) % 360 });
  }

  // The blank is the last cell at the easy levels — "continue the series" — and
  // an interior one higher up, where the rule has to be read in both directions.
  const missing = level <= 3 ? length - 1 : rand(1, length - 2);
  const answer = items[missing];

  let wrong;
  let why;
  if (rule === 'dots') {
    const n = answer.dots;
    wrong = [{ shape, dots: (n % 4) + 1 }, { shape, dots: n === 1 ? 4 : n - 1 }, { shape, dots: n, fill: true }];
    why = `בכל צעד נוספת נקודה אחת, ואחרי ארבע חוזרים לאחת. במקום החסר צריכה להיות ${n === 1 ? 'נקודה אחת' : `${n} נקודות`}.`;
  } else if (rule === 'fill') {
    wrong = [{ shape, fill: !answer.fill }, { shape: shape === 'circle' ? 'square' : 'circle', fill: answer.fill },
      { shape, fill: !answer.fill, dots: 1 }];
    why = `הצורה מתחלפת מלא־ריק־מלא לסירוגין, ולכן במקום החסר היא ${answer.fill ? 'מלאה' : 'ריקה'}.`;
  } else {
    wrong = [{ shape: 'arrow', rotate: (answer.rotate + 90) % 360 },
      { shape: 'arrow', rotate: (answer.rotate + 180) % 360 },
      { shape: 'arrow', rotate: (answer.rotate + 270) % 360 }];
    why = `החץ מסתובב ${inline('90°')} עם כיוון השעון בכל צעד. במקום החסר הוא בזווית ${inline(`${answer.rotate}°`)}.`;
  }

  const shown = items.map((it, i) => (i === missing ? null : it));
  return {
    topic: 'סדרות צורות',
    text: 'איזו צורה משלימה את הסדרה?',
    diagram: { shape: 'figureRow', items: shown, missing },
    ...figureAnswers(answer, wrong),
    exp: why
  };
}

/** מטריצות (רייבן) — a 3x3 grid whose last cell is missing. */
function shapeMatrix(level) {
  const shapes = ['square', 'circle', 'triangle'];
  // Rows share a shape, columns share a dot count — two independent rules, one
  // per axis, which is the actual Raven construction.
  const items = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) items.push({ shape: shapes[r], dots: c + 1 });
  }
  const missing = level <= 3 ? 8 : rand(0, 8);
  const answer = items[missing];
  const shown = items.map((it, i) => (i === missing ? null : it));

  const otherShape = shapes[(shapes.indexOf(answer.shape) + 1) % 3];
  const wrong = [
    { shape: otherShape, dots: answer.dots },
    { shape: answer.shape, dots: (answer.dots % 3) + 1 },
    { shape: otherShape, dots: (answer.dots % 3) + 1 }
  ];

  return {
    topic: 'מטריצות צורות',
    text: 'איזו צורה משלימה את המטריצה?',
    diagram: { shape: 'figureMatrix', items: shown, cols: 3, missing },
    ...figureAnswers(answer, wrong),
    exp: `בכל שורה אותה צורה, ובכל עמודה אותו מספר נקודות. התא החסר נמצא בשורה של ה${SHAPE_NAMES[answer.shape]} ובעמודה של ${answer.dots === 1 ? 'נקודה אחת' : `${answer.dots} נקודות`}.`
  };
}

/** תפיסה מרחבית — rotating one figure by a stated angle. */
function rotation(level) {
  const turn = pick(level <= 2 ? [90, 180] : [90, 180, 270]);
  const start = pick([0, 90, 180, 270]);
  const answer = { shape: 'arrow', rotate: (start + turn) % 360 };
  const wrong = [
    { shape: 'arrow', rotate: (start - turn + 360) % 360 },
    { shape: 'arrow', rotate: start },
    { shape: 'arrow', rotate: (start + turn + 90) % 360 }
  ];
  return {
    topic: 'תפיסה מרחבית — סיבוב',
    text: `לפניך חץ. איך הוא ייראה אחרי סיבוב של ${inline(`${turn}°`)} עם כיוון השעון?`,
    diagram: { shape: 'figureOne', figure: { shape: 'arrow', rotate: start }, caption: 'המצב ההתחלתי' },
    ...figureAnswers(answer, wrong),
    exp: `מוסיפים ${turn} לזווית ההתחלה ${inline(`${start}°`)} ומקבלים ${inline(`${(start + turn) % 360}°`)}. סיבוב נגד כיוון השעון היה נותן ${inline(`${(start - turn + 360) % 360}°`)} — זו הטעות הנפוצה.`
  };
}

/**
 * קיפול קובייה — which face ends up opposite which, on the standard cross net.
 *
 * On this net the opposite pairs are fixed: the vertical strip is 1-3-5-6 in
 * order, so 1 faces 5 and 3 faces 6, and the two side faces (2 and 4) face each
 * other. The item asks the pair rather than the assembled cube, because the
 * pair is what a folding question actually tests.
 */
const NET_OPPOSITES = { 1: 5, 5: 1, 3: 6, 6: 3, 2: 4, 4: 2 };

function cubeFolding(level) {
  const face = rand(1, 6);
  const answer = NET_OPPOSITES[face];
  const marks = ['1', '2', '3', '4', '5', '6'];
  const others = [1, 2, 3, 4, 5, 6].filter(f => f !== face && f !== answer);
  return {
    topic: 'קיפול קובייה',
    text: `מקפלים את הפריסה לקובייה. איזו פאה תהיה מנוגדת לפאה ${face}?`,
    diagram: { shape: 'cubeNet', marks, caption: 'פריסת הקובייה' },
    options: fourOptions(answer, others, near(answer)),
    correctVal: String(answer),
    exp: `בפריסת הצלב הזו הרצועה האנכית היא 1‑3‑5‑6, ולכן 1 מול 5 ו‑3 מול 6; שתי הפאות שבצדדים, 2 ו‑4, מנוגדות זו לזו. פאה ${face} מנוגדת לפאה ${answer}.${level >= 4 ? ' טריק: פאות שנוגעות זו בזו בפריסה לעולם אינן מנוגדות.' : ''}`
  };
}

// --- numerical ---------------------------------------------------------

/** סדרות מספרים — arithmetic, geometric, and second-difference at level 5. */
function numberSeries(level) {
  const kind = byLevel(level, ['add', 'add', 'mul', 'mul', 'quad']);
  const terms = [];
  let answer;

  if (kind === 'add') {
    const start = rand(2, 15);
    const step = rand(2, 9);
    for (let i = 0; i < 5; i++) terms.push(start + i * step);
    answer = start + 5 * step;
    return {
      topic: 'סדרות מספרים',
      text: `השלם את הסדרה: ${inline(`${terms.join(', ')}, ?`)}`,
      options: fourOptions(answer, [answer + step, answer - step, terms[4] + step + 1], near(answer)),
      correctVal: String(answer),
      exp: `ההפרש קבוע: ${step}. האיבר הבא הוא ${terms[4]} + ${step} = ${answer}.`
    };
  }

  if (kind === 'mul') {
    const start = rand(2, 5);
    const ratio = rand(2, 3);
    for (let i = 0; i < 4; i++) terms.push(start * ratio ** i);
    answer = start * ratio ** 4;
    return {
      topic: 'סדרות מספרים',
      text: `השלם את הסדרה: ${inline(`${terms.join(', ')}, ?`)}`,
      options: fourOptions(answer, [answer + ratio, terms[3] + ratio, answer * ratio], near(answer)),
      correctVal: String(answer),
      exp: `כל איבר גדול פי ${ratio} מקודמו. האיבר הבא הוא ${terms[3]} × ${ratio} = ${answer}.`
    };
  }

  // Second difference: the differences themselves grow by a constant.
  const start = rand(1, 6);
  const d0 = rand(2, 5);
  const inc = rand(1, 3);
  let value = start;
  let diff = d0;
  for (let i = 0; i < 5; i++) { terms.push(value); value += diff; diff += inc; }
  answer = value;
  return {
    topic: 'סדרות מספרים',
    text: `השלם את הסדרה: ${inline(`${terms.join(', ')}, ?`)}`,
    options: fourOptions(answer, [answer + inc, terms[4] + d0, answer - inc], near(answer)),
    correctVal: String(answer),
    exp: `ההפרשים אינם קבועים אלא גדלים ב-${inc} בכל צעד: ${terms.slice(1).map((t, i) => t - terms[i]).join(', ')}. ההפרש הבא הוא ${diff - inc}, ולכן ${terms[4]} + ${diff - inc} = ${answer}.`
  };
}

/** חשבון יישומי — the arithmetic these batteries actually ask for. */
function appliedArithmetic(level) {
  const kind = pick(level <= 2 ? ['percent', 'unit'] : ['percent', 'unit', 'ratio', 'time']);

  if (kind === 'percent') {
    const price = rand(2, byLevel(level, [8, 12, 20, 30, 40])) * 25;
    const off = pick([10, 15, 20, 25, 30]);
    const answer = Math.round(price * (100 - off) / 100);
    return {
      topic: 'חשבון יישומי',
      text: `מוצר עולה ${price} ש"ח וניתנת עליו הנחה של ${off}%. כמה ישולם?`,
      options: fourOptions(answer, [Math.round(price * off / 100), price - off, answer + off], near(answer)),
      correctVal: String(answer),
      exp: `ההנחה היא ${Math.round(price * off / 100)} ש"ח, ולכן המחיר הוא ${price} − ${Math.round(price * off / 100)} = ${answer} ש"ח. אפשר גם ישירות: ${price} × ${(100 - off) / 100}.`
    };
  }

  if (kind === 'unit') {
    const packs = rand(3, 9);
    const perPack = rand(6, 12);
    const total = packs * perPack;
    return {
      topic: 'חשבון יישומי',
      text: `במחסן ${packs} ארגזים ובכל ארגז ${perPack} פריטים. כמה פריטים יש בסך הכול?`,
      options: fourOptions(total, [packs + perPack, total - perPack, total + packs], near(total)),
      correctVal: String(total),
      exp: `${packs} × ${perPack} = ${total}.`
    };
  }

  if (kind === 'ratio') {
    // Reduced to lowest terms: an item that prints "ביחס 4:6" teaches the
    // student that an unreduced ratio is normal, which no published test does.
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    let part = rand(2, 6);
    let other = rand(2, 6) + part;
    const d = gcd(other, part);
    part /= d;
    other /= d;
    const unit = rand(3, 9);
    const total = (part + other) * unit;
    const answer = part * unit;
    return {
      topic: 'חשבון יישומי',
      text: `סכום של ${total} ש"ח מתחלק בין שני עובדים ביחס ${inline(`${part}:${other}`)}. כמה יקבל הראשון?`,
      options: fourOptions(answer, [other * unit, total - answer - unit, Math.round(total / 2)], near(answer)),
      correctVal: String(answer),
      exp: `סך היחס הוא ${part} + ${other} = ${part + other} חלקים, וכל חלק שווה ${total} ÷ ${part + other} = ${unit} ש"ח. הראשון מקבל ${part} × ${unit} = ${answer} ש"ח.`
    };
  }

  const speed = rand(4, 12) * 5;
  const hours = rand(2, 6);
  const answer = speed * hours;
  return {
    topic: 'חשבון יישומי',
    text: `רכב נוסע במהירות קבועה של ${speed} קמ"ש במשך ${hours} שעות. כמה ק"מ עבר?`,
    options: fourOptions(answer, [speed + hours, Math.round(speed / hours), answer - speed], near(answer)),
    correctVal: String(answer),
    exp: `דרך = מהירות × זמן: ${speed} × ${hours} = ${answer} ק"מ.`
  };
}

/** קריאת טבלאות ותרשימים — reading a value off a chart, not computing it. */
function chartReading(level) {
  const labels = ['ינואר', 'פברואר', 'מרץ', 'אפריל'];
  const values = labels.map(() => rand(2, byLevel(level, [8, 10, 14, 18, 20])) * 5);
  const kind = pick(level <= 2 ? ['max', 'value'] : ['max', 'value', 'diff', 'sum']);

  if (kind === 'value') {
    const i = rand(0, 3);
    return {
      topic: 'קריאת טבלאות ותרשימים',
      text: `לפי התרשים, מה הערך בחודש ${labels[i]}?`,
      diagram: { shape: 'barChart', values, labels },
      options: fourOptions(values[i], values.filter((_, j) => j !== i), near(values[i])),
      correctVal: String(values[i]),
      exp: `העמודה של ${labels[i]} מגיעה ל-${values[i]}.`
    };
  }

  if (kind === 'max') {
    const best = values.indexOf(Math.max(...values));
    return {
      topic: 'קריאת טבלאות ותרשימים',
      text: 'באיזה חודש נרשם הערך הגבוה ביותר?',
      diagram: { shape: 'barChart', values, labels },
      options: fourOptions(labels[best], labels.filter((_, j) => j !== best), i => `חודש ${i + 5}`),
      correctVal: labels[best],
      exp: `${labels[best]} עם ${values[best]} — הגבוה מכולם.`
    };
  }

  if (kind === 'diff') {
    const hi = values.indexOf(Math.max(...values));
    const lo = values.indexOf(Math.min(...values));
    const answer = values[hi] - values[lo];
    return {
      topic: 'קריאת טבלאות ותרשימים',
      text: 'מה ההפרש בין החודש הגבוה ביותר לנמוך ביותר?',
      diagram: { shape: 'barChart', values, labels },
      options: fourOptions(answer, [values[hi], values[lo], answer + 5], near(answer)),
      correctVal: String(answer),
      exp: `${values[hi]} − ${values[lo]} = ${answer}.`
    };
  }

  const total = values.reduce((a, b) => a + b, 0);
  return {
    topic: 'קריאת טבלאות ותרשימים',
    text: 'מה סך כל הערכים בתרשים?',
    diagram: { shape: 'barChart', values, labels },
    options: fourOptions(total, [total - values[0], Math.round(total / 4), total + 10], near(total)),
    correctVal: String(total),
    exp: `${values.join(' + ')} = ${total}.`
  };
}

// --- verbal and logical ------------------------------------------------

const CATEGORIES = [
  ['פטיש', ['מברג', 'מסור', 'מפתח ברגים'], 'עגבנייה', 'שלושת האחרים כלי עבודה; עגבנייה היא ירק.'],
  ['כינור', ['חליל', 'תוף', 'גיטרה'], 'מחשב', 'שלושת האחרים כלי נגינה.'],
  ['נמלה', ['דבורה', 'זבוב', 'יתוש'], 'עכביש', 'לשלושת האחרים שש רגליים — הם חרקים; לעכביש שמונה.'],
  ['ריבוע', ['משולש', 'מעגל', 'מעוין'], 'קובייה', 'שלושת האחרים צורות מישוריות; קובייה היא גוף תלת־ממדי.'],
  ['רופא', ['אחות', 'פרמדיק', 'רוקח'], 'טייס', 'שלושת האחרים עוסקים ברפואה.']
];

/** יוצא דופן — the classic odd-one-out. */
function oddOneOut(level) {
  const pool = level <= 2 ? CATEGORIES.slice(0, 3) : CATEGORIES;
  const [head, rest, odd, why] = pick(pool);
  return {
    topic: 'יוצא דופן',
    text: `איזו מילה אינה שייכת לקבוצה: ${[head, ...rest, odd].join(', ')}?`,
    options: fourOptions(odd, [head, ...rest], i => `מילה ${i + 5}`),
    correctVal: odd,
    exp: why
  };
}

const RELATIONS = [
  ['רופא', 'חולה', 'מורה', 'תלמיד', ['מנהל', 'ספר', 'כיתה'], 'מי מטפל במי: רופא מטפל בחולה כמו שמורה מלמד תלמיד.'],
  ['ציפור', 'קן', 'דבורה', 'כוורת', ['דבש', 'פרח', 'נמלה'], 'מי גר במה.'],
  ['סכין', 'לחתוך', 'עט', 'לכתוב', ['נייר', 'דיו', 'ספר'], 'כלי והפעולה שעושים בו.'],
  ['רגל', 'נעל', 'יד', 'כפפה', ['אצבע', 'שרוול', 'טבעת'], 'איבר והבגד שמכסה אותו.'],
  ['מים', 'צמא', 'אוכל', 'רעב', ['בישול', 'מזון', 'שובע'], 'מה מרווה איזה מחסור.']
];

/** יחסים והיסקים — verbal analogy. */
function analogy(level) {
  const pool = level <= 2 ? RELATIONS.slice(0, 3) : RELATIONS;
  const [a, b, c, correct, wrong, why] = pick(pool);
  return {
    topic: 'יחסים והיסקים',
    text: `${a} : ${b} כמו ${c} : ?`,
    options: fourOptions(correct, wrong, i => `אפשרות ${i + 5}`),
    correctVal: correct,
    exp: `היחס הוא ${why}`
  };
}

/**
 * הסקה לוגית — a syllogism whose only valid conclusion is the transitive one.
 *
 * The distractors are the two classic invalid moves (converting the premise and
 * negating it), because those are exactly what a candidate under time pressure
 * reaches for.
 */
const SYLLOGISMS = [
  ['כל הרופאים הם אקדמאים', 'כל האקדמאים למדו בקורס כתיבה',
    'כל הרופאים למדו בקורס כתיבה',
    ['כל מי שלמד בקורס כתיבה הוא רופא', 'אף אקדמאי אינו רופא', 'חלק מהרופאים לא למדו בקורס כתיבה']],
  ['כל הכלבים הם יונקים', 'כל היונקים נושמים אוויר',
    'כל הכלבים נושמים אוויר',
    ['כל מי שנושם אוויר הוא כלב', 'חלק מהיונקים אינם נושמים אוויר', 'אף כלב אינו יונק']],
  ['כל המהנדסים בארגון עברו הכשרה', 'כל מי שעבר הכשרה קיבל אישור',
    'כל המהנדסים בארגון קיבלו אישור',
    ['כל מי שקיבל אישור הוא מהנדס', 'חלק מהמהנדסים לא קיבלו אישור', 'רק מהנדסים עברו הכשרה']]
];

function logicalInference(level) {
  const [p1, p2, correct, wrong] = pick(SYLLOGISMS);
  const hint = level >= 4
    ? ' שים לב: "כל א׳ הם ב׳" אינו אומר "כל ב׳ הם א׳" — היפוך הוא ההיסק הפסול הנפוץ ביותר.'
    : '';
  return {
    topic: 'הסקה לוגית',
    text: `נתון: ${p1}. וגם: ${p2}. איזו מסקנה נובעת בהכרח?`,
    options: fourOptions(correct, wrong, i => `מסקנה ${i + 5}`),
    correctVal: correct,
    exp: `היסק טרנזיטיבי: ההנחה הראשונה מכניסה את כולם לקבוצה השנייה, והשנייה מכניסה את הקבוצה הזו לשלישית — ולכן ${correct}.${hint}`
  };
}

/**
 * הבנת הוראות — following a compound instruction exactly.
 *
 * This is the type most candidates lose points on despite finding it "easy":
 * the instruction is trivial and the failure is reading it too fast. The
 * distractors are the results of dropping one clause.
 */
function instructions(level) {
  const start = rand(10, 40);
  const add = rand(3, 12);
  const mul = rand(2, 4);
  const sub = rand(2, 9);

  if (level <= 2) {
    const answer = (start + add) * mul;
    return {
      topic: 'הבנת הוראות',
      text: `קח את המספר ${start}, הוסף לו ${add}, ואת התוצאה הכפל ב-${mul}. מה קיבלת?`,
      options: fourOptions(answer, [start + add * mul, start * mul + add, start + add + mul], near(answer)),
      correctVal: String(answer),
      exp: `קודם החיבור: ${start} + ${add} = ${start + add}. אחר כך הכפל: ${start + add} × ${mul} = ${answer}. מי שהכפיל קודם קיבל ${start + add * mul}.`
    };
  }

  const answer = (start + add) * mul - sub;
  return {
    topic: 'הבנת הוראות',
    text: `קח את המספר ${start}, הוסף לו ${add}, הכפל את התוצאה ב-${mul}, ולבסוף החסר ${sub}. מה קיבלת?`,
    options: fourOptions(answer, [(start + add) * mul, start + add * mul - sub, (start + add - sub) * mul],
      near(answer)),
    correctVal: String(answer),
    exp: `לפי הסדר: ${start} + ${add} = ${start + add}; ${start + add} × ${mul} = ${(start + add) * mul}; ופחות ${sub} = ${answer}. הטעות השכיחה היא לשכוח את הצעד האחרון ולסמן ${(start + add) * mul}.`
  };
}

// --- attention and accuracy --------------------------------------------

/**
 * זריזות ודיוק — comparing two strings character by character.
 *
 * The real test measures speed on trivially easy items. The app cannot time a
 * single question, so difficulty is carried by string length and by how subtle
 * the difference is: at the top level the two characters differ by shape rather
 * than by value (0/O, 1/l), which is what the item type is really about.
 */
function accuracy(level) {
  const len = byLevel(level, [5, 6, 7, 8, 9]);
  const alphabet = level >= 4 ? '0123456789OlI' : '0123456789';
  let base = '';
  for (let i = 0; i < len; i++) base += alphabet[rand(0, alphabet.length - 1)];

  const at = rand(0, len - 1);
  const confusions = { 0: 'O', O: '0', 1: 'l', l: '1', I: '1' };
  const swap = level >= 4 && confusions[base[at]]
    ? confusions[base[at]]
    : String((Number(base[at]) + rand(1, 8)) % 10);
  const changed = base.slice(0, at) + swap + base.slice(at + 1);

  const same = rand(0, 1) === 0;
  const right = same ? base : changed;
  const en = t => `<span dir="ltr" class="lang-ltr">${t}</span>`;
  return {
    topic: 'זריזות ודיוק',
    text: `האם שתי המחרוזות זהות? ${en(base)} · ${en(right)}`,
    options: ['זהות', 'שונות בתו אחד', 'שונות בשני תווים', 'לא ניתן לקבוע'],
    correctVal: same ? 'זהות' : 'שונות בתו אחד',
    exp: same
      ? 'שתי המחרוזות זהות תו־אחר־תו.'
      : `התו במקום ${at + 1} שונה: ${base[at]} מול ${swap}.${level >= 4 ? ' בבחינה האמיתית ההבדל הוא כמעט תמיד בין תווים דומים בצורתם, ולכן חייבים לסרוק ולא "להביט".' : ''}`
  };
}

/**
 * זיכרון עבודה — holding a short list and answering about its order.
 *
 * The list is on screen while the question is asked, so this measures ordered
 * retrieval rather than memorisation. A genuine memory item needs the list to
 * disappear, which needs a timed screen the quiz engine does not have; that is
 * covered in the lesson instead, with a rehearsal technique to practise.
 */
const WORD_POOL = ['שולחן', 'מנורה', 'תפוח', 'מפתח', 'ספר', 'כיסא', 'חלון', 'עיפרון', 'שעון', 'תיק'];

function workingMemory(level) {
  const n = byLevel(level, [4, 5, 5, 6, 6]);
  const words = [];
  const pool = [...WORD_POOL];
  for (let i = 0; i < n; i++) words.push(pool.splice(rand(0, pool.length - 1), 1)[0]);

  const at = rand(0, n - 1);
  const fromEnd = level >= 3 && rand(0, 1) === 0;
  const index = fromEnd ? n - at : at + 1;
  const answer = words[at];
  return {
    topic: 'זיכרון עבודה',
    text: `לפניך הרשימה: ${words.join(', ')}. איזו מילה נמצאת במקום ה-${index} ${fromEnd ? 'מהסוף' : 'מההתחלה'}?`,
    options: fourOptions(answer, words.filter(w => w !== answer), i => WORD_POOL[i % WORD_POOL.length]),
    correctVal: answer,
    exp: `סופרים ${fromEnd ? 'מהסוף' : 'מההתחלה'}: ${fromEnd ? [...words].reverse().join(', ') : words.join(', ')} — המקום ה-${index} הוא "${answer}".`
  };
}

const ALL = [
  shapeSeries, shapeMatrix, rotation, cubeFolding,
  numberSeries, appliedArithmetic, chartReading,
  oddOneOut, analogy, logicalInference, instructions,
  accuracy, workingMemory
];

// Keyed by NO_GRADE (13) from the registry. The literal avoids a circular
// import — subjects/index.js already imports this module.
export const psychotechnicalGenerators = { '13': ALL };
