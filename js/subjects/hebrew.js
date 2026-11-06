/**
 * Hebrew question generators, keyed by grade, aligned to the Israeli curriculum
 * (morphology/שורש, agreement, synonyms & antonyms, idioms, parts of speech).
 *
 * Content policy: words, roots, and grammar rules are common knowledge — not
 * copyrightable. Nothing here is copied from any question paper.
 *
 * Contract: a function taking a difficulty level (1-5) and returning
 *   { topic, text, options: string[4], correctVal, exp, difficulty?: 1|2|3 }
 * Each generator function carries a `.difficulty` property. Pure: no DOM/net.
 */
import { rand, shuffle } from '../mathfmt.js';
import { byLevel, clampLevel } from '../levels.js';

function tag(fn, difficulty) {
  fn.difficulty = difficulty;
  return fn;
}

/** [word, root] */
const ROOTS = [
  ['מכתב', 'כ.ת.ב'], ['ספרייה', 'ס.פ.ר'], ['משמרת', 'ש.מ.ר'], ['תלמיד', 'ל.מ.ד'],
  ['מזכיר', 'ז.כ.ר'], ['מטבח', 'ט.ב.ח'], ['משחק', 'ש.ח.ק'], ['מלמד', 'ל.מ.ד'],
  ['חשבון', 'ח.ש.ב'], ['מגדל', 'ג.ד.ל'], ['תפילה', 'פ.ל.ל'], ['מסלול', 'ס.ל.ל'],
  ['מכונית', 'כ.ו.ן'], ['מדריך', 'ד.ר.ך'], ['מנהל', 'נ.ה.ל'], ['שומר', 'ש.מ.ר'],
  ['כותב', 'כ.ת.ב'], ['לומד', 'ל.מ.ד'], ['זוכר', 'ז.כ.ר'], ['נזכר', 'ז.כ.ר'],
  ['מספר', 'ס.פ.ר'], ['סיפור', 'ס.פ.ר'], ['מגרש', 'ג.ר.ש'], ['תמונה', 'ת.מ.נ'],
  ['מטוס', 'ט.ו.ס'], ['מקרר', 'ק.ר.ר'], ['מברשת', 'ב.ר.ש'], ['מחשב', 'ח.ש.ב'],
  ['פותח', 'פ.ת.ח'], ['סוגר', 'ס.ג.ר'],
  ['מכבסה', 'כ.ב.ס'], ['מסעדה', 'ס.ע.ד'], ['מרפאה', 'ר.פ.א'], ['מספרה', 'ס.פ.ר'],
  ['כתיבה', 'כ.ת.ב'], ['שמירה', 'ש.מ.ר'], ['למידה', 'ל.מ.ד'], ['קריאה', 'ק.ר.א'],
  ['הסבר', 'ס.ב.ר'], ['הכנסה', 'כ.נ.ס'], ['הדלקה', 'ד.ל.ק'], ['הרגשה', 'ר.ג.ש'],
  ['התלבשות', 'ל.ב.ש'], ['התרגשות', 'ר.ג.ש'], ['השתמשות', 'ש.מ.ש'],
  ['מלבן', 'ל.ב.ן'], ['משולש', 'ש.ל.ש'], ['מרובע', 'ר.ב.ע'], ['מעגל', 'ע.ג.ל'],
  ['מדחום', 'ח.מ.ם'], ['מגהץ', 'ג.ה.ץ'], ['מסננת', 'ס.נ.ן'], ['מנורה', 'נ.ו.ר'],
  ['ילדות', 'י.ל.ד'], ['אהבה', 'א.ה.ב'], ['שאלה', 'ש.א.ל'], ['תשובה', 'ש.ו.ב'],
  ['מחלה', 'ח.ל.ה'], ['בריאות', 'ב.ר.א'], ['חכמה', 'ח.כ.ם'], ['עבודה', 'ע.ב.ד']
];

/**
 * [singular, plural]
 *
 * Irregular plurals are the point — Hebrew nouns that take the "wrong" ending
 * for their gender (שולחן/שולחנות, שנה/שנים) are exactly what a student gets
 * wrong, so the list is weighted towards them rather than to -ים/-ות regulars.
 */
const PLURALS = [
  ['שולחן', 'שולחנות'], ['כיסא', 'כיסאות'], ['ילד', 'ילדים'], ['מורה', 'מורים'],
  ['חלון', 'חלונות'], ['ספר', 'ספרים'], ['עיר', 'ערים'], ['אישה', 'נשים'],
  ['בית', 'בתים'], ['שנה', 'שנים'], ['מקום', 'מקומות'], ['דרך', 'דרכים'],
  ['יום', 'ימים'], ['לילה', 'לילות'], ['עץ', 'עצים'], ['פרי', 'פירות'],
  ['אב', 'אבות'], ['בן', 'בנים'], ['בת', 'בנות'], ['איש', 'אנשים'],
  ['ראש', 'ראשים'], ['עין', 'עיניים'], ['יד', 'ידיים'], ['רגל', 'רגליים'],
  ['כלב', 'כלבים'], ['חתול', 'חתולים'], ['מים', 'מים'], ['קיר', 'קירות'],
  ['דלת', 'דלתות'], ['שדה', 'שדות'],
  ['אוזן', 'אוזניים'], ['שן', 'שיניים'], ['כתף', 'כתפיים'], ['אצבע', 'אצבעות'],
  ['ציפור', 'ציפורים'], ['פרח', 'פרחים'], ['גן', 'גנים'], ['רחוב', 'רחובות'],
  ['מכונית', 'מכוניות'], ['אופניים', 'אופניים'], ['תמונה', 'תמונות'],
  ['מחשב', 'מחשבים'], ['מכתב', 'מכתבים'], ['עיפרון', 'עפרונות'],
  ['מחברת', 'מחברות'], ['תלמיד', 'תלמידים'], ['תלמידה', 'תלמידות'],
  ['חבר', 'חברים'], ['חברה', 'חברות'], ['משפחה', 'משפחות'],
  ['אח', 'אחים'], ['אחות', 'אחיות'], ['סבא', 'סבים'], ['סבתא', 'סבתות'],
  ['שעה', 'שעות'], ['חודש', 'חודשים'], ['שבוע', 'שבועות'],
  ['קול', 'קולות'], ['שם', 'שמות'], ['מספר', 'מספרים'],
  ['כוס', 'כוסות'], ['צלחת', 'צלחות'], ['סכין', 'סכינים'],
  ['בגד', 'בגדים'], ['נעל', 'נעליים'], ['חולצה', 'חולצות']
];

/**
 * [word, synonym, three distractors]
 *
 * Length matters here, not just correctness: this list IS the topic's question
 * pool. At twelve entries a second quiz in one sitting had nothing new to ask,
 * which is what the repetition complaint was about at grades 4-5.
 *
 * Authored easiest-first, because slice() takes the head for levels 1-2 and the
 * tail for 4-5.
 */
const SYNONYMS = [
  ['שמחה', 'אושר', ['עצב', 'כעס', 'פחד']],
  ['גדול', 'עצום', ['זעיר', 'צר', 'קצר']],
  ['מהיר', 'זריז', ['איטי', 'כבד', 'עייף']],
  ['יפה', 'נאה', ['מכוער', 'ישן', 'רגיל']],
  ['חכם', 'נבון', ['טיפש', 'עקשן', 'ביישן']],
  ['קשה', 'מסובך', ['פשוט', 'קל', 'ברור']],
  ['בית', 'משכן', ['רחוב', 'גינה', 'חצר']],
  ['דרך', 'נתיב', ['גשר', 'מנהרה', 'צומת']],
  ['פחד', 'אימה', ['ביטחון', 'רוגע', 'שמחה']],
  ['חבר', 'רֵע', ['אויב', 'זר', 'שכן']],
  ['התחיל', 'פתח', ['סיים', 'הפסיק', 'גמר']],
  ['אמר', 'הכריז', ['שתק', 'לחש', 'שמע']],
  ['קטן', 'זעיר', ['ענק', 'רחב', 'גבוה']],
  ['עייף', 'תשוש', ['ערני', 'זריז', 'שמח']],
  ['כועס', 'זועם', ['רגוע', 'מרוצה', 'עצוב']],
  ['שקט', 'דומם', ['רועש', 'סוער', 'עליז']],
  ['רץ', 'דהר', ['הלך', 'עמד', 'זחל']],
  ['הביט', 'צפה', ['שמע', 'דיבר', 'נגע']],
  ['גילה', 'מצא', ['הסתיר', 'איבד', 'חיפש']],
  ['שאל', 'בירר', ['ענה', 'סיפר', 'הסביר']],
  ['בנה', 'הקים', ['הרס', 'שבר', 'תיקן']],
  ['ניקה', 'צחצח', ['לכלך', 'הרטיב', 'סידר']],
  ['אכל', 'סעד', ['שתה', 'בישל', 'הגיש']],
  ['שמר', 'הגן', ['תקף', 'זנח', 'איבד']],
  ['למד', 'רכש ידע', ['לימד', 'שכח', 'שאל']],
  ['עזר', 'סייע', ['הפריע', 'התעלם', 'ביקש']],
  ['סיפור', 'מעשה', ['שיר', 'מאמר', 'מכתב']],
  ['שדה', 'מרעה', ['יער', 'הר', 'נחל']],
  ['ילד', 'נער', ['מבוגר', 'זקן', 'תינוק']],
  ['כסף', 'ממון', ['זהב', 'אבן', 'נייר']],
  ['אורח', 'מבקר', ['מארח', 'שכן', 'זר']],
  ['עצוב', 'נכה רוח', ['עליז', 'רגוע', 'נרגש']],
  ['אמיץ', 'נועז', ['פחדן', 'זהיר', 'שקט']],
  ['נדיב', 'רחב לב', ['קמצן', 'עשיר', 'חסכן']],
  ['מפורסם', 'נודע', ['אלמוני', 'צנוע', 'חדש']],
  ['קדום', 'עתיק', ['חדש', 'מודרני', 'טרי']],
  ['מדויק', 'מוקפד', ['משוער', 'מקורב', 'רשלני']],
  ['חיוני', 'הכרחי', ['מיותר', 'נוח', 'אפשרי']],
  ['ניכר', 'בולט', ['נסתר', 'זעיר', 'עמום']],
  ['התנגד', 'סירב', ['הסכים', 'תמך', 'שתק']]
];

/** [word, antonym, three distractors]. Same reasoning as SYNONYMS above. */
const ANTONYMS = [
  ['גדול', 'קטן', ['ארוך', 'רחב', 'כבד']],
  ['חם', 'קר', ['רטוב', 'יבש', 'חמים']],
  ['שמח', 'עצוב', ['כועס', 'רגוע', 'עייף']],
  ['מהיר', 'איטי', ['חזק', 'קל', 'זריז']],
  ['פתוח', 'סגור', ['נעול', 'שבור', 'ריק']],
  ['מלא', 'ריק', ['כבד', 'קטן', 'רחב']],
  ['אור', 'חושך', ['צל', 'ערפל', 'שקיעה']],
  ['גבוה', 'נמוך', ['רחב', 'ארוך', 'עמוק']],
  ['עשיר', 'עני', ['חכם', 'נדיב', 'קמצן']],
  ['התחיל', 'סיים', ['המשיך', 'עצר', 'פתח']],
  ['עלה', 'ירד', ['נפל', 'קפץ', 'זז']],
  ['אהב', 'שנא', ['רצה', 'חשב', 'הרגיש']],
  ['ארוך', 'קצר', ['רחב', 'גבוה', 'דק']],
  ['רחב', 'צר', ['ארוך', 'עמוק', 'שטוח']],
  ['כבד', 'קל', ['גדול', 'חזק', 'רך']],
  ['חדש', 'ישן', ['נקי', 'שלם', 'יפה']],
  ['נקי', 'מלוכלך', ['רטוב', 'חדש', 'מסודר']],
  ['רטוב', 'יבש', ['קר', 'חלק', 'עמוק']],
  ['קרוב', 'רחוק', ['גבוה', 'צדדי', 'פנימי']],
  ['לפני', 'אחרי', ['בתוך', 'מעל', 'ליד']],
  ['מעל', 'מתחת', ['לפני', 'בתוך', 'ליד']],
  ['נכנס', 'יצא', ['עבר', 'נשאר', 'חזר']],
  ['קם', 'התיישב', ['הלך', 'נשכב', 'עמד']],
  ['הוסיף', 'הפחית', ['שינה', 'החליף', 'סידר']],
  ['זכר', 'שכח', ['ידע', 'חשב', 'הבין']],
  ['הצליח', 'נכשל', ['ניסה', 'ויתר', 'התאמץ']],
  ['שאל', 'ענה', ['סיפר', 'שתק', 'הקשיב']],
  ['קיבל', 'נתן', ['ביקש', 'שלח', 'לקח']],
  ['רעש', 'שקט', ['מוזיקה', 'קול', 'לחש']],
  ['אמת', 'שקר', ['סוד', 'טעות', 'ספק']],
  ['חוזק', 'חולשה', ['גובה', 'מהירות', 'עייפות']],
  ['רווח', 'הפסד', ['עלות', 'מחיר', 'חיסכון']],
  ['ברור', 'מעורפל', ['פשוט', 'קצר', 'רועש']],
  ['צפוי', 'מפתיע', ['רגיל', 'מוכר', 'קבוע']],
  ['מותר', 'אסור', ['חובה', 'רצוי', 'אפשרי']],
  ['זמני', 'קבוע', ['קצר', 'חדש', 'נדיר']],
  ['נדיר', 'שכיח', ['יקר', 'קטן', 'מיוחד']],
  ['ענק', 'זעיר', ['בינוני', 'כבד', 'רחב']],
  ['הסכים', 'התנגד', ['שתק', 'היסס', 'שקל']],
  ['גלוי', 'נסתר', ['פתוח', 'ברור', 'חופשי']]
];

/** [sentence with ___, correct, three distractors, explanation] */
const GRAMMAR = [
  ['הילדים ___ לבית הספר בכל בוקר.', 'הולכים', ['הולך', 'הולכת', 'ללכת'],
   'הנושא "הילדים" הוא רבים זכר, ולכן הפועל ברבים זכר: הולכים.'],
  ['הספר ___ על השולחן.', 'מונח', ['מונחת', 'מונחים', 'מונחות'],
   'הנושא "הספר" הוא יחיד זכר: מונח.'],
  ['המורות ___ את השיעור אתמול.', 'לימדו', ['לימד', 'לימדה', 'ילמדו'],
   'הנושא "המורות" הוא רבות נקבה בזמן עבר: לימדו.'],
  ['אני ___ לחנות מחר.', 'אלך', ['הלכתי', 'הולך', 'ילך'],
   'המילה "מחר" מחייבת עתיד בגוף ראשון יחיד: אלך.'],
  ['הכלבים ___ בחצר.', 'רצים', ['רץ', 'רצה', 'רצות'],
   'הנושא "הכלבים" הוא רבים זכר: רצים.'],
  ['הילדה ___ ספר מעניין.', 'קוראת', ['קורא', 'קוראים', 'קוראות'],
   'הנושא "הילדה" הוא יחידה נקבה: קוראת.'],
  ['אתמול אנחנו ___ סרט טוב.', 'ראינו', ['רואים', 'נראה', 'ראיתי'],
   'הנושא "אנחנו" בזמן עבר: ראינו.'],
  ['הפרחים ___ באביב.', 'פורחים', ['פורח', 'פורחת', 'פורחות'],
   'הנושא "הפרחים" הוא רבים זכר: פורחים.'],
  ['היא ___ בבית מחר בבוקר.', 'תהיה', ['הייתה', 'תהיו', 'יהיה'],
   'גוף שלישי יחידה בעתיד: תהיה.'],
  ['התלמידות ___ את המבחן בהצלחה.', 'עברו', ['עבר', 'עברה', 'יעברו'],
   'הנושא "התלמידות" רבות נקבה בעבר: עברו.']
];

/** [idiom, meaning, three distractors] — ניבים וביטויים. */
const IDIOMS = [
  ['יצא מגדרו', 'התרגש מאוד', ['יצא מהבית', 'כעס וברח', 'סיים עבודה']],
  ['שם לב', 'הבחין', ['שכח', 'ישן', 'הלך']],
  ['אחז את השור בקרניו', 'התמודד באומץ', ['ברח מהבעיה', 'נחפז', 'התעצל']],
  ['טמן ראשו בחול', 'התעלם מהבעיה', ['פתר את הבעיה', 'נלחם', 'ברח']],
  ['עלה על גדותיו', 'גאה מאוד', ['התייבש', 'קפא', 'נעלם']],
  ['שבר את הראש', 'חשב קשה', ['נפצע', 'ישן', 'ויתר']],
  ['נפל לו האסימון', 'הבין לפתע', ['איבד כסף', 'התבלבל', 'נרדם']],
  ['יד ביד', 'בשיתוף פעולה', ['בנפרד', 'בכעס', 'במהירות']],
  ['בין הפטיש לסדן', 'במצב קשה בין שתי אפשרויות', ['במקום נוח', 'בבית מלאכה', 'בשמחה']],
  ['מצא חן בעיניו', 'מצא לו נעים', ['הרגיז אותו', 'הפחיד אותו', 'שעמם אותו']]
];

/** [word, part-of-speech, distractors] — חלקי הדיבר. */
const POS = [
  ['רץ', 'פועל', ['שם עצם', 'שם תואר', 'מילת יחס']],
  ['יפה', 'שם תואר', ['פועל', 'שם עצם', 'מילת קישור']],
  ['שולחן', 'שם עצם', ['פועל', 'שם תואר', 'מילת יחס']],
  ['מהר', 'תואר הפועל', ['שם עצם', 'פועל', 'שם תואר']],
  ['כתב', 'פועל', ['שם עצם', 'שם תואר', 'מילת יחס']],
  ['גדול', 'שם תואר', ['פועל', 'שם עצם', 'מילת קישור']],
  ['ילד', 'שם עצם', ['פועל', 'שם תואר', 'תואר הפועל']],
  ['על', 'מילת יחס', ['שם עצם', 'פועל', 'שם תואר']]
];

/** Picks n distinct values from list (by `pick`), excluding `exclude`. */
/**
 * The slice of a word list appropriate to `level`: levels 1-2 draw from the
 * easier head, 3 from the whole list, 4-5 from the harder tail. The lists are
 * authored roughly easiest-first, so slicing shifts difficulty without keeping
 * parallel lists. Lists shorter than four entries are returned whole, since
 * halving them would leave too few distinct distractors.
 */
function slice(list, level) {
  if (level == null || list.length < 4) return list;
  const half = Math.ceil(list.length / 2);
  const head = list.slice(0, half);
  const tail = list.slice(half);
  return byLevel(level, [head, head, list, tail, tail]);
}

function distinctValues(list, pick, exclude, n) {
  const pool = [...new Set(list.map(pick))].filter(value => value !== exclude);
  return shuffle(pool).slice(0, n);
}

const rootGenerator = tag(level => {
  const pool = slice(ROOTS, level);
  const [word, root] = pool[rand(0, pool.length - 1)];
  const distractors = distinctValues(ROOTS, pair => pair[1], root, 3);
  return {
    topic: 'שורשים',
    text: `מהו השורש של המילה <strong>${word}</strong>?`,
    options: [root, ...distractors],
    correctVal: root,
    exp: `המילה <strong>${word}</strong> נגזרת מהשורש ${root}.`
  };
}, 2);

const pluralGenerator = tag(level => {
  const pool = slice(PLURALS, level);
  const [singular, plural] = pool[rand(0, pool.length - 1)];
  const distractors = distinctValues(PLURALS, pair => pair[1], plural, 3);
  return {
    topic: 'יחיד ורבים',
    text: `מהי צורת הרבים של המילה <strong>${singular}</strong>?`,
    options: [plural, ...distractors],
    correctVal: plural,
    exp: `צורת הרבים של <strong>${singular}</strong> היא <strong>${plural}</strong>.`
  };
}, 1);

const synonymGenerator = tag(level => {
  const pool = slice(SYNONYMS, level);
  const [word, synonym, wrong] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'מילים נרדפות',
    text: `איזו מילה היא נרדפת למילה <strong>${word}</strong>?`,
    options: [synonym, ...wrong],
    correctVal: synonym,
    exp: `<strong>${synonym}</strong> היא מילה נרדפת ל<strong>${word}</strong>.`
  };
}, 1);

const antonymGenerator = tag(level => {
  const pool = slice(ANTONYMS, level);
  const [word, antonym, wrong] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'ניגודים',
    text: `מהי המילה ההפוכה במשמעותה למילה <strong>${word}</strong>?`,
    options: [antonym, ...wrong],
    correctVal: antonym,
    exp: `ההפך של <strong>${word}</strong> הוא <strong>${antonym}</strong>.`
  };
}, 1);

const grammarGenerator = tag(level => {
  const pool = slice(GRAMMAR, level);
  const [sentence, answer, wrong, explanation] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'התאמה דקדוקית',
    text: `השלם את המילה החסרה: <br>${sentence}`,
    options: [answer, ...wrong],
    correctVal: answer,
    exp: explanation
  };
}, 2);

const idiomGenerator = tag(level => {
  const pool = slice(IDIOMS, level);
  const [idiom, meaning, wrong] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'ניבים וביטויים',
    text: `מה פירוש הביטוי <strong>${idiom}</strong>?`,
    options: [meaning, ...wrong],
    correctVal: meaning,
    exp: `הביטוי "${idiom}" פירושו ${meaning}.`
  };
}, 3);

const posGenerator = tag(level => {
  const pool = slice(POS, level);
  const [word, pos, wrong] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'חלקי הדיבר',
    text: `לאיזה חלק דיבר שייכת המילה <strong>${word}</strong>?`,
    options: [pos, ...wrong],
    correctVal: pos,
    exp: `המילה <strong>${word}</strong> היא ${pos}.`
  };
}, 2);

// --- exam formats: cloze, multi-select, passage -------------------------
// These return the `parts` shape from js/qtypes.js instead of a single correct
// index. Every sentence and passage is written for this app and assembled from
// slots, so one frame yields many distinct items.

const NAMES = ['דנה', 'יונתן', 'מאיה', 'עומר', 'נועה', 'איתי', 'שירה', 'עמית'];
const PLACES = ['הספרייה', 'הפארק', 'השוק', 'החוף', 'המוזיאון'];
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

function one(list) {
  return list[rand(0, list.length - 1)];
}

/** Builds a part whose options are shuffled, tracking where the answer landed. */
function choicePart(prompt, answer, wrong) {
  const options = shuffle([answer, ...wrong]);
  return { prompt, options, correct: options.indexOf(answer) };
}

/**
 * Builds a choose-all-that-apply part.
 *
 * Throws if no genuinely wrong option survives. A multi-select whose options
 * are all correct scores full marks for ticking everything, which tests
 * nothing — callers must supply real distractors rather than let that through.
 */
function multiPart(right, wrong) {
  const distinctWrong = [...new Set(wrong)].filter(w => !right.includes(w));
  if (distinctWrong.length === 0) {
    throw new Error(`multiPart: no wrong options for [${right.join(', ')}]`);
  }
  const options = shuffle([...new Set(right), ...distinctWrong]);
  return {
    options,
    correct: options.reduce((acc, o, i) => (right.includes(o) ? [...acc, i] : acc), [])
  };
}

/**
 * Plausible but wrong plural forms for a word, excluding any that happen to be
 * the real plural. Hebrew plurals split by gender, so mechanically appending
 * one suffix produces the wrong form for roughly half the nouns — which is
 * exactly the mistake worth testing, as long as it is not accidentally right.
 */
function wrongPlurals(singular, plural, howMany) {
  return [`${singular}ים`, `${singular}ות`, singular, `${singular}יים`]
    .filter(form => form !== plural)
    .slice(0, howMany);
}

/** A sentence with two gaps — number agreement and a preposition. */
const clozeGenerator = tag(level => {
  const name = one(NAMES);
  const place = one(PLACES);
  const day = one(DAYS);
  const pairs = slice(PLURALS, level);
  const [singular, plural] = pairs[rand(0, pairs.length - 1)];

  const parts = [
    choicePart('מילת היחס', 'אל', ['על', 'עם', 'בין']),
    choicePart('צורת הרבים', plural, wrongPlurals(singular, plural, 3))
  ];

  return {
    kind: 'cloze',
    topic: 'השלמת משפט',
    text: `השלם את החסרים: ${name} הולכת ___ ${place} בכל יום ${day} ולוקחת שני ___ .`,
    parts,
    exp: `לכיוון מקום משתמשים במילת היחס "אל". צורת הרבים של <strong>${singular}</strong> היא <strong>${plural}</strong>.`
  };
}, 3);

/** Choose every option that fits. */
const multiSelectGenerator = tag(level => {
  const hard = level != null && clampLevel(level) >= 4;

  if (hard) {
    // Every word sharing one root, mixed with words from other roots.
    const target = ROOTS[rand(0, ROOTS.length - 1)][1];
    const right = ROOTS.filter(p => p[1] === target).map(p => p[0]);
    const wrong = shuffle(ROOTS.filter(p => p[1] !== target)).slice(0, 4).map(p => p[0]);
    if (right.length >= 2) {
      return {
        kind: 'multi',
        topic: 'שורשים',
        text: `סמן את כל המילים הנגזרות מהשורש ${target}:`,
        parts: [multiPart(right, wrong.slice(0, 3))],
        exp: `המילים ${right.join(', ')} נגזרות מהשורש ${target}.`
      };
    }
  }

  const pairs = shuffle(slice(PLURALS, level)).slice(0, 3);
  const right = pairs.map(p => p[1]);
  // Distractors are wrong pluralisations of the SAME words, so the question
  // tests the rule rather than recognition of an unrelated word. Each word
  // contributes only forms that are not actually the right answer for it, and
  // flatMap over all three guarantees the list cannot come out empty.
  const wrong = pairs.flatMap(p => wrongPlurals(p[0], p[1], 1));
  return {
    kind: 'multi',
    topic: 'רבים',
    text: `סמן את כל צורות הרבים הנכונות של: ${pairs.map(p => p[0]).join(', ')}`,
    parts: [multiPart(right, wrong)],
    exp: `הצורות הנכונות הן ${right.join(', ')}. השאר הן הטיה שגויה.`
  };
}, 3);

/** A short original passage followed by linked questions. */
const passageGenerator = tag(level => {
  const name = one(NAMES);
  const place = one(PLACES);
  const day = one(DAYS);
  const hour = rand(3, 9);
  const count = rand(2, 6);

  const passage =
    `${name} יוצאת מהבית בשעה ${hour} בבוקר והולכת ${place ? 'אל ' + place : ''} בכל יום ${day}. ` +
    `בדרך היא קונה ${count} תפוחים. הדרך קצרה, ולכן היא אף פעם לא מאחרת.`;

  const parts = [
    choicePart('לאן היא הולכת?', place, shuffle(PLACES.filter(p => p !== place)).slice(0, 3)),
    choicePart('באיזה יום?', day, shuffle(DAYS.filter(d => d !== day)).slice(0, 3))
  ];
  if (level != null && clampLevel(level) >= 4) {
    parts.push(choicePart('כמה תפוחים היא קונה?', String(count),
      [String(count + 1), String(count - 1), String(count + 3)]));
  }

  return {
    kind: 'passage',
    topic: 'הבנת הנקרא',
    passage,
    text: `קרא את הקטע על ${name} וענה על השאלות:`,
    parts,
    exp: `כל התשובות מופיעות ישירות בקטע: ${place}, יום ${day}, ${count} תפוחים.`
  };
}, 3);


// --- morphology and syntax --------------------------------------------
//
// The ministry's junior-high לשון syllabus is built on בניין, שם הפועל, שם
// פעולה, משקל and סמיכות in morphology, and on נושא ונשוא, סוגי משפטים and
// מילות קישור in syntax. The app had שורש and התאמה דקדוקית and nothing else
// from either list, so a student could finish every Hebrew quiz here without
// meeting the year's actual material.

/**
 * Exactly four distinct options, the correct one among them.
 *
 * `preferred` are the distractors that teach — the specific wrong answer a
 * student reaches for. `pool` only makes the count up when two preferred
 * distractors turn out to be the same word.
 */
function fourOptions(correct, preferred, pool = []) {
  const out = [correct];
  for (const candidate of [...preferred, ...pool]) {
    if (out.length === 4) break;
    if (candidate && !out.includes(candidate)) out.push(candidate);
  }
  return shuffle(out);
}

/** The seven בניינים, each with verbs that sit in it. */
const BINYANIM = {
  'פָּעַל': ['כתב', 'שמר', 'למד', 'קרא', 'אכל', 'גדל'],
  'נִפְעַל': ['נכתב', 'נשמר', 'נכנס', 'נשבר', 'נמצא', 'נזכר'],
  'פִּעֵל': ['סיפר', 'לימד', 'שילם', 'ביקש', 'דיבר', 'תיקן'],
  'פֻּעַל': ['סופר', 'לומד', 'שולם', 'בוקש', 'תוקן', 'גודל'],
  'הִפְעִיל': ['הכתיב', 'הלביש', 'הסביר', 'הדליק', 'הכניס', 'הרגיש'],
  'הֻפְעַל': ['הוכתב', 'הולבש', 'הוסבר', 'הודלק', 'הוכנס', 'הורגש'],
  'הִתְפַּעֵל': ['התלבש', 'התרגש', 'הסתדר', 'התכתב', 'התארגן', 'הצטלם']
};

const BINYAN_NAMES = Object.keys(BINYANIM);

/**
 * Which בניין a verb sits in.
 *
 * The distractors are always other real בניין names, so the question is decided
 * by recognising the pattern rather than by ruling out a word that is not a
 * בניין at all.
 */
const binyanGenerator = tag(level => {
  // The passive בניינים — פֻּעַל, הֻפְעַל — are the ones students confuse with
  // their active partners, so the level slice reaches them only at 3 and above.
  const names = byLevel(clampLevel(level == null ? 3 : level), [
    ['פָּעַל', 'פִּעֵל', 'הִפְעִיל'],
    ['פָּעַל', 'פִּעֵל', 'הִפְעִיל', 'הִתְפַּעֵל'],
    BINYAN_NAMES,
    BINYAN_NAMES,
    BINYAN_NAMES
  ]);
  const binyan = one(names);
  const verb = one(BINYANIM[binyan]);
  return {
    topic: 'בניינים',
    text: `באיזה בניין הפועל "${verb}"?`,
    options: fourOptions(binyan, shuffle(BINYAN_NAMES.filter(b => b !== binyan))),
    correctVal: binyan,
    exp: `"${verb}" בבניין ${binyan}.`
  };
});

/**
 * Active against passive.
 *
 * The pairing is the fact worth knowing: פִּעֵל is undone by פֻּעַל and הִפְעִיל
 * by הֻפְעַל, which is why the passive of a פִּעֵל verb is never a הֻפְעַל form.
 */
const VOICE_PAIRS = [
  ['סיפר', 'סופר', 'פִּעֵל', 'פֻּעַל'],
  ['לימד', 'לומד', 'פִּעֵל', 'פֻּעַל'],
  ['שילם', 'שולם', 'פִּעֵל', 'פֻּעַל'],
  ['תיקן', 'תוקן', 'פִּעֵל', 'פֻּעַל'],
  ['הכתיב', 'הוכתב', 'הִפְעִיל', 'הֻפְעַל'],
  ['הלביש', 'הולבש', 'הִפְעִיל', 'הֻפְעַל'],
  ['הסביר', 'הוסבר', 'הִפְעִיל', 'הֻפְעַל'],
  ['הדליק', 'הודלק', 'הִפְעִיל', 'הֻפְעַל']
];

const voiceGenerator = tag(level => {
  const pool = slice(VOICE_PAIRS, level);
  const [active, passive, activeBinyan, passiveBinyan] = pool[rand(0, pool.length - 1)];
  const askPassive = rand(0, 1) === 0;
  const answer = askPassive ? passive : active;
  const given = askPassive ? active : passive;
  const column = askPassive ? 1 : 0;
  return {
    topic: 'סביל ופעיל',
    text: askPassive
      ? `מהי הצורה הסבילה של "${active}"?`
      : `מהי הצורה הפעילה של "${passive}"?`,
    options: fourOptions(answer, distinctValues(VOICE_PAIRS, row => row[column], answer, 3)),
    correctVal: answer,
    exp: `"${given}" בבניין ${askPassive ? activeBinyan : passiveBinyan}, והצורה המקבילה היא "${answer}" בבניין ${askPassive ? passiveBinyan : activeBinyan}.`
  };
}, 3);

/**
 * שם הפועל — the infinitive.
 *
 * Stored rather than derived, because the ל prefix carries a vowel change that
 * depends on the בניין: לכתוב but לספר, and לְהִתְלַבֵּש with a whole syllable added.
 */
const INFINITIVES = [
  ['כתב', 'לכתוב'], ['שמר', 'לשמור'], ['למד', 'ללמוד'], ['קרא', 'לקרוא'],
  ['אכל', 'לאכול'], ['סגר', 'לסגור'], ['פתח', 'לפתוח'], ['בדק', 'לבדוק'],
  ['זכר', 'לזכור'], ['גמר', 'לגמור'], ['רקד', 'לרקוד'], ['צחק', 'לצחוק'],
  ['סיפר', 'לספר'], ['לימד', 'ללמד'], ['דיבר', 'לדבר'], ['ביקש', 'לבקש'],
  ['שילם', 'לשלם'], ['תיקן', 'לתקן'], ['סידר', 'לסדר'], ['ניקה', 'לנקות'],
  ['הסביר', 'להסביר'], ['הכניס', 'להכניס'], ['הדליק', 'להדליק'],
  ['הרגיש', 'להרגיש'], ['הזמין', 'להזמין'], ['הכין', 'להכין'],
  ['החליט', 'להחליט'], ['הבטיח', 'להבטיח'],
  ['התלבש', 'להתלבש'], ['התרגש', 'להתרגש'], ['הסתדר', 'להסתדר'],
  ['השתמש', 'להשתמש'], ['התארגן', 'להתארגן'], ['הצטלם', 'להצטלם'],
  ['נכנס', 'להיכנס'], ['נשמר', 'להישמר'], ['נשאר', 'להישאר'],
  ['נפגש', 'להיפגש'], ['נזכר', 'להיזכר'],
  // The hard tail: a root letter is lost or the vowel shifts, so the infinitive
  // cannot be guessed from the past-tense form.
  ['ישב', 'לשבת'], ['הלך', 'ללכת'], ['נתן', 'לתת'], ['ידע', 'לדעת'],
  ['יצא', 'לצאת'], ['ירד', 'לרדת'], ['לקח', 'לקחת'], ['נגע', 'לגעת']
];

const infinitiveGenerator = tag(level => {
  // ישב/לשבת, הלך/ללכת and נתן/לתת lose a root letter, so they are the hard
  // tail rather than the easy head.
  const pool = slice(INFINITIVES, level);
  const [verb, infinitive] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'שם הפועל',
    text: `מהו שם הפועל של "${verb}"?`,
    options: fourOptions(infinitive, distinctValues(INFINITIVES, pair => pair[1], infinitive, 3)),
    correctVal: infinitive,
    exp: `שם הפועל של "${verb}" הוא "${infinitive}".`
  };
}, 2);

/** שם פעולה — the verbal noun, and the noun pattern that goes with each בניין. */
const ACTION_NOUNS = [
  ['סיפר', 'סיפור'], ['לימד', 'לימוד'], ['שילם', 'שילום'], ['ביקש', 'בקשה'],
  ['הסביר', 'הסבר'], ['הכניס', 'הכנסה'], ['הדליק', 'הדלקה'], ['הרגיש', 'הרגשה'],
  ['התלבש', 'התלבשות'], ['התרגש', 'התרגשות'], ['הסתדר', 'הסתדרות'],
  ['כתב', 'כתיבה'], ['שמר', 'שמירה'], ['למד', 'למידה'], ['אכל', 'אכילה']
];

const actionNounGenerator = tag(level => {
  const pool = slice(ACTION_NOUNS, level);
  const [verb, noun] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'שם פעולה',
    text: `מהו שם הפעולה של "${verb}"?`,
    options: fourOptions(noun, distinctValues(ACTION_NOUNS, pair => pair[1], noun, 3)),
    correctVal: noun,
    exp: `שם הפעולה של "${verb}" הוא "${noun}".`
  };
}, 3);

/**
 * סמיכות — the construct state.
 *
 * Two things get tested, because two things go wrong. Which word is the נסמך
 * (the first one, the one whose form changes), and where the ה' הידיעה goes: on
 * the SECOND word, so "בית הספר" and never "הבית ספר".
 */
const CONSTRUCTS = [
  ['בית ספר', 'בית', 'ספר', 'בית הספר'],
  ['עוגת שוקולד', 'עוגת', 'שוקולד', 'עוגת השוקולד'],
  ['ספר תורה', 'ספר', 'תורה', 'ספר התורה'],
  ['חדר אוכל', 'חדר', 'אוכל', 'חדר האוכל'],
  ['שולחן כתיבה', 'שולחן', 'כתיבה', 'שולחן הכתיבה'],
  ['תיק גב', 'תיק', 'גב', 'תיק הגב'],
  ['מגרש חנייה', 'מגרש', 'חנייה', 'מגרש החנייה'],
  ['כלב שמירה', 'כלב', 'שמירה', 'כלב השמירה']
];

const constructGenerator = tag(level => {
  const pool = slice(CONSTRUCTS, level);
  const [phrase, head, tail, definite] = pool[rand(0, pool.length - 1)];
  if (level != null && clampLevel(level) >= 4) {
    // The definiteness question. The wrong answers are the three ways it is
    // actually written wrong, not invented strings.
    return {
      topic: 'סמיכות',
      text: `מהי צורת היידוע הנכונה של הצירוף "${phrase}"?`,
      options: shuffle([definite, `ה${head} ${tail}`, `ה${head} ה${tail}`, `${head} ${tail}`]),
      correctVal: definite,
      exp: `בסמיכות ה' הידיעה באה לפני המילה השנייה בלבד: "${definite}".`
    };
  }
  const askHead = rand(0, 1) === 0;
  const answer = askHead ? head : tail;
  return {
    topic: 'סמיכות',
    text: askHead
      ? `מהו הנסמך בצירוף "${phrase}"?`
      : `מהו הסומך בצירוף "${phrase}"?`,
    options: fourOptions(answer, [askHead ? tail : head],
      distinctValues(CONSTRUCTS, row => row[askHead ? 1 : 2], answer, 3)),
    correctVal: answer,
    exp: askHead
      ? `הנסמך הוא המילה הראשונה, "${head}" — היא זו שצורתה משתנה.`
      : `הסומך הוא המילה השנייה, "${tail}".`
  };
}, 4);

/**
 * נושא ונשוא — subject and predicate.
 *
 * The sentences are stored whole rather than assembled, because the answer
 * depends on the whole sentence: a nominal sentence has no verb to point at, and
 * a generated frame would keep producing the same trivial two-word case.
 */
const CLAUSES = [
  ['הילד קרא ספר בערב.', 'הילד', 'קרא'],
  ['המורה הסבירה את השיעור.', 'המורה', 'הסבירה'],
  ['החתול השחור ישן על הספה.', 'החתול השחור', 'ישן'],
  ['שני חברים שלי נסעו לחיפה.', 'שני חברים שלי', 'נסעו'],
  ['הגשם החזק הפסיק בבוקר.', 'הגשם החזק', 'הפסיק'],
  ['התלמידים החדשים הגיעו מאוחר.', 'התלמידים החדשים', 'הגיעו'],
  ['אחותי הקטנה מציירת כל היום.', 'אחותי הקטנה', 'מציירת'],
  ['הרכבת לתל אביב יצאה בזמן.', 'הרכבת לתל אביב', 'יצאה']
];

const clauseGenerator = tag(level => {
  const pool = slice(CLAUSES, level);
  const [sentence, subject, predicate] = pool[rand(0, pool.length - 1)];
  const askSubject = rand(0, 1) === 0;
  const answer = askSubject ? subject : predicate;
  const column = askSubject ? 1 : 2;
  return {
    topic: 'נושא ונשוא',
    text: `${sentence} — מהו ה${askSubject ? 'נושא' : 'נשוא'} במשפט?`,
    options: fourOptions(answer, [askSubject ? predicate : subject],
      distinctValues(CLAUSES, row => row[column], answer, 3)),
    correctVal: answer,
    exp: askSubject
      ? `הנושא הוא מי שמבצע את הפעולה: "${subject}".`
      : `הנשוא הוא הפועל שמספר מה קרה: "${predicate}".`
  };
}, 3);

/**
 * מילות קישור and the logical relation each one marks.
 *
 * The relation is the answer, not the word — a student who knows "אולם" is a
 * connective still has to know it marks contrast and not cause.
 */
const CONNECTIVES = [
  ['לא יצאנו לטיול ___ ירד גשם כבד.', 'מפני ש', 'סיבה'],
  ['התאמצנו מאוד, ___ לא הצלחנו.', 'אולם', 'ניגוד'],
  ['נצא לדרך ___ השמש תשקע.', 'לפני ש', 'זמן'],
  ['הוא למד קשה, ___ קיבל ציון גבוה.', 'ולכן', 'תוצאה'],
  ['נבוא לבקר ___ יהיה לנו זמן.', 'אם', 'תנאי'],
  ['היא אוהבת גם מתמטיקה ___ גם ספרות.', 'וגם', 'הוספה'],
  ['הוא המשיך לרוץ ___ שהיה עייף.', 'אף על פי', 'ויתור'],
  ['נשארנו בבית ___ לצאת לטיול.', 'במקום', 'תחלופה']
];

const connectiveGenerator = tag(level => {
  const pool = slice(CONNECTIVES, level);
  const [frame, word, relation] = pool[rand(0, pool.length - 1)];
  if (level != null && clampLevel(level) >= 4) {
    return {
      topic: 'מילות קישור',
      text: `"${frame.replace('___', word)}" — איזה קשר לוגי מביעה המילה "${word}"?`,
      options: fourOptions(relation, distinctValues(CONNECTIVES, row => row[2], relation, 3)),
      correctVal: relation,
      exp: `"${word}" מציינת ${relation}.`
    };
  }
  return {
    topic: 'מילות קישור',
    text: `בחר את מילת הקישור המתאימה: ${frame}`,
    options: fourOptions(word, distinctValues(CONNECTIVES, row => row[1], word, 3)),
    correctVal: word,
    // Not "..., ולכן X" — one of the answers IS "ולכן", and the sentence read
    // "ולכן ולכן".
    exp: `הקשר הלוגי כאן הוא ${relation}, והמילה המתאימה היא "${word}".`
  };
}, 3);

/**
 * תקינות לשונית — the correctness questions.
 *
 * These are the specific errors that are common in speech and wrong in writing.
 * Each entry is [wrong, right, why], and the question shows the wrong form
 * because recognising it is the skill.
 */
const CORRECTNESS = [
  ['שתי בנים', 'שני בנים', 'שני לזכר, שתי לנקבה.'],
  ['עשרים ואחד ילדות', 'עשרים ואחת ילדות', 'המספר מתאים למין שם העצם — ילדות הן נקבה.'],
  ['אני מתלבט את השאלה', 'אני מתלבט בשאלה', 'הפועל "התלבט" נשלט במילת היחס ב-.'],
  ['הכי טוב ביותר', 'הטוב ביותר', 'אין לצרף "הכי" ו"ביותר" יחד — די באחד מהם.'],
  ['בגלל ש', 'מפני ש', '"בגלל" בא לפני שם עצם, לא לפני פסוקית.'],
  ['אחד ההסברים הטובים ביותר שהיו', 'אחד ההסברים הטובים ביותר שהיה', 'הנשוא מתאים ל"אחד" ביחיד.'],
  ['אף אחד לא בא, אבל כולם באו', 'אף אחד לא בא', 'שלילה כפולה סותרת את עצמה במשפט אחד.'],
  ['הוא נמצא בתוך הבית פנימה', 'הוא נמצא בתוך הבית', 'כפל לשון מיותר — "בתוך" כבר אומר פנימה.']
];

const correctnessGenerator = tag(level => {
  const pool = slice(CORRECTNESS, level);
  const [wrong, right, why] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'תקינות לשונית',
    text: `מהי הצורה התקנית של "${wrong}"?`,
    options: fourOptions(right, [wrong], distinctValues(CORRECTNESS, row => row[1], right, 3)),
    correctVal: right,
    exp: why
  };
}, 4);

/** משקלים — the noun patterns and what each one tends to mean. */
const MISHKALIM = [
  ['מִקְטָל', ['מכתב', 'מחשב', 'מקרר'], 'מציין לרוב מכשיר או כלי'],
  ['קַטָּל', ['נגר', 'זגג', 'סבל'], 'מציין לרוב בעל מקצוע'],
  ['קְטִילָה', ['כתיבה', 'שמירה', 'אכילה'], 'מציין לרוב פעולה'],
  ['מַקְטֵלָה', ['מכבסה', 'מסגרייה', 'מנפחה'], 'מציין לרוב מקום עבודה'],
  ['קַטֶּלֶת', ['אדמת', 'שפעת', 'כלבת'], 'מציין לרוב מחלה']
];

const mishkalGenerator = tag(level => {
  const [pattern, words, meaning] = one(MISHKALIM);
  const askMeaning = level != null && clampLevel(level) >= 4;
  if (askMeaning) {
    return {
      topic: 'משקלים',
      text: `מה מציין בדרך כלל משקל ${pattern} (למשל "${one(words)}")?`,
      options: fourOptions(meaning, distinctValues(MISHKALIM, row => row[2], meaning, 3)),
      correctVal: meaning,
      exp: `משקל ${pattern} ${meaning}.`
    };
  }
  const word = one(words);
  return {
    topic: 'משקלים',
    text: `באיזה משקל המילה "${word}"?`,
    options: fourOptions(pattern, distinctValues(MISHKALIM, row => row[0], pattern, 3)),
    correctVal: pattern,
    exp: `"${word}" במשקל ${pattern}, ש${meaning}.`
  };
}, 4);

/**
 * הלחמים — blended words.
 *
 * A modern-Hebrew word-formation topic on the syllabus, and the one students
 * enjoy: every answer is a word they already use without knowing it was built.
 */
const BLENDS = [
  ['רמזור', 'רמז', 'אור'],
  ['קולנוע', 'קול', 'נוע'],
  ['מדחום', 'מודד', 'חום'],
  ['ראינוע', 'ראייה', 'נוע'],
  ['חידק', 'חי', 'דק'],
  ['שמרטף', 'שומר', 'טף'],
  ['מגלשה', 'גולש', 'שם'],
  ['כדורגל', 'כדור', 'רגל']
];

const blendGenerator = tag(level => {
  const pool = slice(BLENDS, level);
  const [blend, first, second] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'הלחמים',
    text: `מאיזה שתי מילים הורכבה המילה "${blend}"?`,
    options: fourOptions(`${first} + ${second}`,
      distinctValues(BLENDS, row => `${row[1]} + ${row[2]}`, `${first} + ${second}`, 3)),
    correctVal: `${first} + ${second}`,
    exp: `"${blend}" היא הֶלְחֵם של "${first}" ו"${second}".`
  };
}, 3);

/**
 * סוגי משפטים — sentence types.
 *
 * The nominal sentence is the one worth teaching: Hebrew forms it with no verb
 * at all, which is exactly why a student looking for the נשוא cannot find one.
 */
const SENTENCE_TYPES = [
  ['הילד קרא ספר.', 'משפט פועלי', 'יש בו פועל — "קרא".'],
  ['הילד חכם מאוד.', 'משפט שמני', 'אין בו פועל; הנשוא הוא שם התואר "חכם".'],
  ['אבא שלי רופא.', 'משפט שמני', 'אין בו פועל; הנשוא הוא שם העצם "רופא".'],
  ['התלמידים למדו בשקט.', 'משפט פועלי', 'יש בו פועל — "למדו".'],
  ['הים כאן שקט.', 'משפט שמני', 'אין בו פועל; הנשוא הוא "שקט".'],
  ['השמש זרחה בבוקר.', 'משפט פועלי', 'יש בו פועל — "זרחה".'],
  ['אין לי זמן.', 'משפט שמני', 'משפט ייחוד עם "אין" — אין בו פועל.'],
  ['היא רצה מהר.', 'משפט פועלי', 'יש בו פועל — "רצה".']
];

const sentenceTypeGenerator = tag(level => {
  const pool = slice(SENTENCE_TYPES, level);
  const [sentence, type, why] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'סוגי משפטים',
    text: `"${sentence}" — מאיזה סוג המשפט?`,
    options: shuffle([type, type === 'משפט שמני' ? 'משפט פועלי' : 'משפט שמני',
      'משפט איחוי', 'משפט מורכב']),
    correctVal: type,
    exp: why
  };
}, 3);

export const hebrewGenerators = {
  '4':  [pluralGenerator, synonymGenerator, antonymGenerator, infinitiveGenerator],
  '5':  [pluralGenerator, synonymGenerator, antonymGenerator, rootGenerator,
         infinitiveGenerator],
  '6':  [rootGenerator, pluralGenerator, synonymGenerator, grammarGenerator, posGenerator,
         clozeGenerator, infinitiveGenerator, connectiveGenerator],
  '7':  [rootGenerator, synonymGenerator, antonymGenerator, grammarGenerator, posGenerator,
         clozeGenerator, multiSelectGenerator, binyanGenerator, infinitiveGenerator,
         constructGenerator, clauseGenerator, connectiveGenerator],
  '8':  [rootGenerator, synonymGenerator, grammarGenerator, posGenerator, idiomGenerator,
         clozeGenerator, multiSelectGenerator, passageGenerator, binyanGenerator,
         constructGenerator, clauseGenerator, connectiveGenerator, actionNounGenerator,
         sentenceTypeGenerator, blendGenerator],
  '9':  [rootGenerator, grammarGenerator, idiomGenerator, posGenerator,
         clozeGenerator, multiSelectGenerator, passageGenerator, binyanGenerator,
         voiceGenerator, constructGenerator, clauseGenerator, actionNounGenerator,
         sentenceTypeGenerator, blendGenerator, correctnessGenerator, connectiveGenerator],
  '10': [rootGenerator, grammarGenerator, idiomGenerator,
         clozeGenerator, multiSelectGenerator, passageGenerator, binyanGenerator,
         voiceGenerator, constructGenerator, clauseGenerator, actionNounGenerator,
         mishkalGenerator, correctnessGenerator, sentenceTypeGenerator, connectiveGenerator],
  '11': [rootGenerator, grammarGenerator, idiomGenerator,
         clozeGenerator, multiSelectGenerator, passageGenerator, binyanGenerator,
         voiceGenerator, constructGenerator, clauseGenerator, actionNounGenerator,
         mishkalGenerator, correctnessGenerator, blendGenerator, connectiveGenerator],
  '12': [rootGenerator, grammarGenerator, idiomGenerator,
         clozeGenerator, multiSelectGenerator, passageGenerator, binyanGenerator,
         voiceGenerator, constructGenerator, clauseGenerator, mishkalGenerator,
         correctnessGenerator, sentenceTypeGenerator, actionNounGenerator, connectiveGenerator]
};
