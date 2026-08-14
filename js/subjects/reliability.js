/**
 * Integrity / reliability test preparation (מבחני אמינות).
 *
 * Gradeless, like the other two prep subjects — these are sat before a job, not
 * in a school year.
 *
 * **What this subject is, and deliberately is not.**
 *
 * A real reliability questionnaire has no right answers. It scores a candidate
 * on admission, attitude and consistency scales, and it detects a candidate who
 * is "answering well" rather than answering honestly. Reproducing that here
 * would be both dishonest (the app cannot score a real instrument) and useless
 * (it would teach students to fake, which is exactly what the lie scale is
 * built to catch).
 *
 * So this subject drills what a candidate can legitimately prepare:
 *   1. **מה נמדד** — what each scale actually measures, so the questionnaire
 *      stops being a black box.
 *   2. **שיפוט מצבי** — workplace judgement items, which DO have a defensible
 *      best answer and which employers score as situational judgement.
 *   3. **עקביות** — spotting that two items are the same question rephrased,
 *      the single mechanical skill the consistency scale rewards.
 *   4. **מלכודות** — recognising a lie-scale item, an absolute claim, and the
 *      other shapes that flag a response set.
 *
 * The lesson side (js/lessons/reliability.js) makes this framing explicit to
 * the student rather than leaving them to infer it.
 *
 * Generator contract is unchanged: (level) => { topic, text, options[4],
 * correctVal, exp }.
 */
import { rand } from '../mathfmt.js';
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

// --- what the test measures --------------------------------------------

const SCALES = [
  ['סולם ההודאה',
    'עד כמה המועמד מודה בעצמו בהתנהגויות בעייתיות בעבר',
    ['עד כמה המועמד מהיר בפתרון בעיות', 'עד כמה המועמד מתאים לתפקיד מבחינה מקצועית',
      'כמה שנות ניסיון יש למועמד'],
    'סולם ההודאה שואל ישירות על התנהגות בעבר — גניבה, שימוש בסמים, הפרת נהלים. הוא אינו בודק יכולת או ניסיון.'],
  ['סולם העמדות',
    'עד כמה המועמד מצדיק או מגנה התנהגות לא ישרה של אחרים',
    ['עד כמה המועמד אוהב את עבודתו', 'כמה כסף המועמד מבקש', 'עד כמה המועמד זריז'],
    'סולם העמדות מציג טענות כמו "כולם לוקחים משהו מהעבודה" ובודק אם המועמד מסכים איתן — הצדקה של אחרים נמצאה כמנבאת התנהגות עצמית.'],
  ['סולם העקביות',
    'עד כמה המועמד עונה אותו דבר על שאלות שהן אותה שאלה בניסוח אחר',
    ['עד כמה המועמד עונה מהר', 'כמה שאלות המועמד השאיר ריקות', 'עד כמה התשובות מנוסחות יפה'],
    'אותה שאלה מופיעה כמה פעמים בניסוחים שונים ובמרחק זה מזו. פערים גדולים ביניהן מסמנים שהמועמד לא ענה על מה שנשאל.'],
  ['סולם הרצייה החברתית',
    'עד כמה המועמד מציג את עצמו כמושלם באופן לא סביר',
    ['עד כמה המועמד חברותי', 'כמה חברים יש למועמד בעבודה', 'עד כמה המועמד מנומס בראיון'],
    'סולם הרצייה (או "סולם השקר") כולל היגדים שכמעט כל אדם היה מודה בהם. מי שמכחיש את כולם נמצא מציג תמונה מושלמת מדי, וזה עצמו ממצא.']
];

function whatIsMeasured(level) {
  const pool = level <= 2 ? SCALES.slice(0, 2) : SCALES;
  const [name, correct, wrong, why] = pick(pool);
  return {
    topic: 'מה נמדד במבחן אמינות',
    text: `מה בודק ${name}?`,
    options: fourOptions(correct, wrong, i => `אפשרות ${i + 5}`),
    correctVal: correct,
    exp: why
  };
}

const FACTS = [
  ['האם יש "תשובה נכונה" בשאלון אמינות?',
    'לא — השאלון בונה פרופיל, ואין ציון של נכון או שגוי לפריט בודד',
    ['כן, לכל שאלה יש תשובה אחת נכונה', 'כן, אבל רק בחלק המילולי', 'רק בשאלות על עבר תעסוקתי'],
    'שאלון אמינות אינו מבחן ידע. כל פריט תורם לפרופיל, והפרופיל כולו הוא מה שמדווח למעסיק.'],
  ['מה קורה כשמועמד עונה על כל השאלות בצורה "מושלמת"?',
    'סולם הרצייה מסמן את השאלון כמנסה להציג תמונה טובה מדי',
    ['השאלון מקבל ציון גבוה במיוחד', 'המועמד מתקבל אוטומטית', 'לא קורה דבר — זו תוצאה תקינה'],
    'היגדים כמו "מעולם לא איחרתי לשום דבר בחיי" נכונים כמעט לאף אחד. שלילה גורפת שלהם היא בדיוק מה שהסולם מחפש.'],
  ['מה כדאי לעשות כששאלה נראית מוכרת ממקום אחר בשאלון?',
    'לענות עליה כפי שענית על הקודמת — זו אותה שאלה בניסוח אחר',
    ['לענות הפוך כדי לא להיראות משכפל', 'לדלג עליה', 'לענות באמצע הסולם כדי להתחמק'],
    'זהו סולם העקביות. אותה שאלה חוזרת בכוונה, והתשובות אמורות להתאים.'],
  ['האם מותר להשאיר פריטים ללא מענה?',
    'עדיף לא — פריטים ריקים רבים מדי פוסלים את השאלון כבלתי ניתן לפירוש',
    ['כן, זה משפר את הציון', 'כן, אין לזה משמעות', 'רק בשאלות אישיות'],
    'שאלון עם אחוז דילוגים גבוה אינו ניתן לניקוד, והתוצאה נרשמת כלא־תקפה — גרוע יותר מפרופיל בינוני.'],
  ['מה המשמעות של מגבלת הזמן בשאלון אמינות?',
    'היא מכוונת לתשובה ספונטנית — התלבטות ארוכה מייצרת תשובות "מתוכננות" ולא עקביות',
    ['מי שמסיים מהר יותר מקבל ציון גבוה', 'הזמן אינו מוגבל בשאלוני אמינות', 'הזמן נמדד רק בחלק המספרי'],
    'הזמן אינו נמדד כהישג. הוא קיים כדי שהתשובה תהיה התגובה הראשונה, וזו גם הסיבה שתשובה ספונטנית יוצאת עקבית יותר.']
];

function howItWorks(level) {
  const pool = level <= 2 ? FACTS.slice(0, 3) : FACTS;
  const [question, correct, wrong, why] = pick(pool);
  return {
    topic: 'איך עובד שאלון אמינות',
    text: question,
    options: fourOptions(correct, wrong, i => `אפשרות ${i + 5}`),
    correctVal: correct,
    exp: why
  };
}

// --- situational judgement ---------------------------------------------

/**
 * שיפוט מצבי — workplace scenarios with a defensible best action.
 *
 * These DO have a best answer, and employers score them as such: each has one
 * option that reports or corrects through the proper channel, and three that
 * cover it up, ignore it, or take it into the responder's own hands.
 */
const SCENARIOS = [
  ['בסוף המשמרת אתה מגלה שבקופה יש 200 ש"ח יותר מהרשום.',
    'לדווח למנהל המשמרת ולתעד את הפער',
    ['להשאיר את הכסף בקופה בלי לומר דבר', 'לקחת את העודף ולהחזיר אותו מחר',
      'לרשום סכום שיתאים כדי שהקופה תסתדר'],
    'עודף בקופה הוא תקלה בדיוק כמו חוסר. דיווח מיידי מגן גם על הקופה וגם עליך; "תיקון" הרישום הוא זיוף.'],
  ['חבר לצוות מבקש ממך להעביר כרטיס נוכחות עבורו כי הוא יאחר ברבע שעה.',
    'לסרב בנימוס ולהסביר שזה דיווח כוזב',
    ['להעביר — זה רק רבע שעה', 'להעביר ולבקש ממנו טובה בחזרה',
      'להעביר ולדווח על כך רק אם ישאלו'],
    'העברת כרטיס עבור אחר היא דיווח כוזב על שעות, ללא קשר לגודל הפער. סירוב אינו הלשנה — הוא סירוב להשתתף.'],
  ['אתה רואה עובד ותיק לוקח ציוד משרדי הביתה בקביעות.',
    'לפנות לממונה ולדווח על מה שראית',
    ['לא להתערב — הוא ותיק ממני', 'לומר לו שראית ולהשאיר את זה בינינו',
      'לקחת גם, כדי לא להיות פראייר'],
    'ותק אינו היתר. שתיקה הופכת אותך לשותף, ו"גם אני" הוא בדיוק המנגנון שהעמדות שבשאלון מנסות לזהות.'],
  ['נגרמה טעות בהזמנת לקוח, והיא באשמתך.',
    'לדווח מיד ולהציע כיצד לתקן',
    ['לחכות ולראות אם הלקוח בכלל ישים לב', 'להסביר שהמערכת אשמה',
      'לתקן בשקט בלי לעדכן איש'],
    'דיווח עצמי מוקדם מצמצם את הנזק ומעיד על אחריות. תיקון בשקט הוא הסתרה, גם כשהכוונה טובה.'],
  ['מנהל מבקש ממך לרשום תאריך אחר על מסמך "כדי שיסתדר עם הדוח".',
    'לסרב ולבקש הנחיה בכתב מהממונה עליו',
    ['לעשות כבקשתו — הוא המנהל', 'לעשות ולציין זאת לעצמך ביומן',
      'לסרב ולא לומר דבר לאיש'],
    'הוראה מגורם בכיר אינה הופכת רישום כוזב לחוקי. בקשת הנחיה בכתב מעבירה את ההחלטה לגורם המוסמך ומגנה עליך.'],
  ['גילית שנוהל הבטיחות שאתה אמור לבצע מאט את העבודה, וכולם מדלגים עליו.',
    'לבצע את הנוהל ולהעלות את הקושי לדיון מסודר',
    ['לדלג כמו כולם — זה הנוהג במקום', 'לדלג ולבצע רק כשיש ביקורת',
      'לבצע ולא לומר לאיש שיש בעיה'],
    '"כולם עושים" אינו שיקול. ביצוע הנוהל לצד העלאת הבעיה הוא התשובה היחידה שגם שומרת על הכלל וגם מטפלת בסיבה.']
];

function situational(level) {
  const pool = level <= 2 ? SCENARIOS.slice(0, 3) : SCENARIOS;
  const [scene, correct, wrong, why] = pick(pool);
  return {
    topic: 'שיפוט מצבי',
    text: `${scene} מה הפעולה הנכונה?`,
    options: fourOptions(correct, wrong, i => `אפשרות ${i + 5}`),
    correctVal: correct,
    exp: why
  };
}

// --- consistency and traps ---------------------------------------------

/**
 * עקביות בתשובות — recognising two items that are the same question.
 *
 * The skill is mechanical and teachable: strip the wording and ask what
 * behaviour is being reported. The distractors are items on a NEARBY topic,
 * which is what makes the real thing hard.
 */
const PAIRS = [
  ['לפעמים אני מאחר לעבודה.', 'קרה שהגעתי אחרי שעת ההתחלה.',
    ['אני אוהב את העבודה שלי.', 'אני מעדיף לעבוד לבד.', 'אני קם מוקדם בבוקר.'],
    'שני ההיגדים מדווחים על אותה התנהגות — איחור — בניסוח אחר. "אני קם מוקדם" קרוב בנושא אבל אינו אותו דיווח.'],
  ['מעולם לא לקחתי דבר ממקום עבודה בלי רשות.', 'לא הוצאתי מהעבודה חפץ שאינו שלי.',
    ['אני שומר על סדר בשולחן שלי.', 'אני מקפיד להחזיר ציוד שהושאל לי.', 'אני נותן אמון בעמיתים.'],
    'שניהם שוללים את אותה פעולה. "מחזיר ציוד שהושאל" הוא נושא שכן, אך אינו אותה שאלה.'],
  ['אני מתעצבן בקלות על עמיתים.', 'קורה שאני מרים את הקול בעבודה.',
    ['אני עובד טוב בצוות.', 'אני מעדיף משימות ברורות.', 'אני מקבל ביקורת בקלות.'],
    'שניהם מדווחים על ביטויי כעס בעבודה. "עובד טוב בצוות" הוא הערכה עצמית כללית, לא אותו דיווח התנהגותי.'],
  ['יצא לי לספר סיפור לא מדויק כדי להימנע מבעיה.', 'קרה שלא אמרתי את כל האמת בעבודה.',
    ['אני מדבר בגלוי עם המנהל שלי.', 'אני זוכר פרטים היטב.', 'אני מדייק במסמכים שאני ממלא.'],
    'שני ההיגדים מודים באותה התנהגות. השאר עוסקים בתקשורת או בזיכרון — לא באי־אמירת אמת.']
];

function consistency(level) {
  const pool = level <= 2 ? PAIRS.slice(0, 2) : PAIRS;
  const [first, twin, wrong, why] = pick(pool);
  return {
    topic: 'עקביות בתשובות',
    text: `בשאלון הופיע ההיגד: "${first}" איזה מההיגדים הבאים שואל למעשה את אותה שאלה, ולכן התשובה עליו צריכה להתאים?`,
    options: fourOptions(twin, wrong, i => `היגד ${i + 5}`),
    correctVal: twin,
    exp: why
  };
}

/** מלכודות בשאלון — spotting the item shapes that flag a response set. */
const TRAPS = [
  ['מעולם לא כעסתי על אף אדם בחיי.', 'היגד רצייה חברתית — כמעט אף אדם אינו יכול לאשר אותו בכנות',
    ['היגד לגיטימי שבודק שליטה עצמית', 'היגד על יחסים בצוות', 'היגד על ניסיון תעסוקתי'],
    'היגדים מוחלטים ("מעולם", "אף פעם", "כל") כמעט תמיד שייכים לסולם הרצייה. אישור גורף שלהם הוא מה שמסמן ניסיון להציג תמונה מושלמת.'],
  ['תמיד אני עומד בכל לוח זמנים, ללא יוצא מן הכלל.', 'היגד מוחלט — הניסוח עצמו הוא הסימן',
    ['היגד על ארגון אישי', 'היגד על עומס בעבודה', 'היגד על יחס לממונים'],
    'המילה "תמיד ... ללא יוצא מן הכלל" הופכת היגד סביר לטענה שאי אפשר לעמוד בה. הסולם מחפש בדיוק את מי שמאשר אותה.'],
  ['רוב האנשים לוקחים משהו קטן מהעבודה מדי פעם.', 'היגד עמדות — הוא בודק אם אתה מנרמל התנהגות לא ישרה',
    ['היגד שבודק ידע על נהלים', 'היגד על שביעות רצון מהעבודה', 'היגד רצייה חברתית'],
    'הפריט אינו שואל מה אתה עושה אלא מה לדעתך אחרים עושים. הסכמה עם נרמול כזה נמצאה מנבאת התנהגות אישית.'],
  ['קרה לי לאחר לפגישה.', 'היגד הודאה רגיל — סביר, ואישור שלו אינו פוגע',
    ['היגד מוחלט שכדאי לשלול', 'היגד עמדות', 'היגד שנועד להכשיל'],
    'לא כל היגד הוא מלכודת. הודאה בדבר סביר היא בדיוק מה שמייצר פרופיל אמין; שלילה גורפת של הכול היא הבעיה.']
];

function trapItems(level) {
  const pool = level <= 2 ? TRAPS.slice(0, 2) : TRAPS;
  const [item, correct, wrong, why] = pick(pool);
  const hint = level >= 4 ? ' בבחינה עצמה אין זמן לניתוח — לכן מזהים את הצורה, לא את התוכן.' : '';
  return {
    topic: 'מלכודות בשאלון',
    text: `בשאלון מופיע ההיגד: "${item}" מה מאפיין אותו?`,
    options: fourOptions(correct, wrong, i => `אפשרות ${i + 5}`),
    correctVal: correct,
    exp: `${why}${hint}`
  };
}

/**
 * אמינות בעבודה — the concepts an employer's report actually names, so a
 * student who receives one can read it.
 */
const TERMS = [
  ['פרופיל אמינות', 'תיאור של המועמד על פני כמה סולמות, ולא ציון בודד',
    ['ציון מספרי אחד בין 0 ל-100', 'רשימת העבירות של המועמד', 'המלצה של מעסיק קודם'],
    'הדוח למעסיק מציג כמה צירים במקביל. "ציון אמינות" יחיד הוא פשטנות שאינה קיימת בכלים המקצועיים.'],
  ['תוקף חיצוני', 'המידה שבה תוצאת המבחן מנבאת התנהגות בפועל בעבודה',
    ['אורך המבחן', 'מספר המועמדים שנבחנו', 'אם המבחן נערך בעברית'],
    'תוקף הוא השאלה אם המבחן מנבא את מה שהוא מתיימר לנבא — לא כמה הוא ארוך או נעים.'],
  ['מהימנות המבחן', 'המידה שבה אותו מועמד יקבל תוצאה דומה גם בהעברה חוזרת',
    ['כמה המבחן קשה', 'כמה זמן לוקח לסיים אותו', 'האם המבחן ממוחשב'],
    'מהימנות היא יציבות התוצאה. מבחן שנותן תוצאה אחרת בכל פעם אינו מודד דבר — וזו בדיוק הסיבה שסולם העקביות חשוב.']
];

function terminology(level) {
  const pool = level <= 2 ? TERMS.slice(0, 2) : TERMS;
  const [term, correct, wrong, why] = pick(pool);
  return {
    topic: 'מושגים בשאלוני אמינות',
    text: `מה פירוש המושג "${term}"?`,
    options: fourOptions(correct, wrong, i => `הגדרה ${i + 5}`),
    correctVal: correct,
    exp: why
  };
}

/**
 * חשבון קופה ומלאי — the arithmetic that appears alongside the questionnaire in
 * retail and cash-handling screening. Numeric, so it scales cleanly by level.
 */
function cashHandling(level) {
  const kind = pick(['change', 'shortage']);
  if (kind === 'change') {
    const total = rand(3, byLevel(level, [8, 12, 20, 30, 40])) * 7;
    const paid = Math.ceil(total / 50) * 50;
    const answer = paid - total;
    return {
      topic: 'חשבון קופה ומלאי',
      text: `קנייה בסך ${total} ש"ח שולמה בשטר של ${paid} ש"ח. כמה עודף יש להחזיר?`,
      options: fourOptions(answer, [total, paid, answer + 10], i => String(answer + (i + 1) * 3)),
      correctVal: String(answer),
      exp: `${paid} − ${total} = ${answer} ש"ח.`
    };
  }
  const expected = rand(10, byLevel(level, [20, 30, 50, 70, 90])) * 10;
  const gap = rand(1, 9) * 5;
  const actual = expected - gap;
  return {
    topic: 'חשבון קופה ומלאי',
    text: `בקופה אמורים להיות ${expected} ש"ח ונספרו ${actual} ש"ח. מה גודל החוסר?`,
    options: fourOptions(gap, [expected - actual + 5, actual, expected], i => String(gap + (i + 1) * 5)),
    correctVal: String(gap),
    exp: `${expected} − ${actual} = ${gap} ש"ח חסרים. כל פער — חוסר או עודף — מדווח, ולא "מסתדר" ברישום.`
  };
}

const ALL = [
  whatIsMeasured, howItWorks, situational, consistency, trapItems, terminology, cashHandling
];

// Keyed by NO_GRADE (13) from the registry. The literal avoids a circular
// import — subjects/index.js already imports this module.
export const reliabilityGenerators = { '13': ALL };
