/**
 * מדעים, grades 1-6.
 *
 * Built from the Ministry מפרט תכנים supplied for each grade (extracted to
 * docs/science-source-outline.md), which organises the subject as תחום תוכן
 * (content domain) → נושא מרכזי (central topic).
 *
 * **Topics here are finer than the curriculum's.** "אנרגיה (פיזיקה)" is a
 * domain heading covering a year of teaching; a ten-question drill cannot be
 * built on it, and a weak-topic chip reading "אנרגיה" tells a child nothing
 * about what to practise. So each central topic is split into the things a
 * question can actually be about, and those are what the registry sees.
 *
 * **Science is recall and classification, not computation.** Every other
 * subject here generates by varying numbers; that does not work when the
 * content is "which of these is a conductor". These generators vary the ITEM
 * and the framing over hand-written fact tables, so a topic's question pool is
 * the size of its table rather than unbounded. That is a real constraint: see
 * the note on pool size at the foot of this file.
 */
import { rand } from '../mathfmt.js';

/** One random member of a list. */
function pick(list) {
  return list[rand(0, list.length - 1)];
}

/** Shuffles a copy. */
function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A four-option question from one correct answer and a pool of wrong ones.
 *
 * Distractors are drawn from the same fact table as the answer, so every wrong
 * option is a real member of the domain rather than a filler string. An option
 * nobody would consider measures nothing.
 */
function fourFrom(correct, wrongPool) {
  // Deduped, because the fact tables legitimately repeat a value: several
  // animals share a habitat and several devices share a power source. Drawing
  // straight from the column would then offer "יער" twice, which is not a
  // distractor — it is a question with two identical answers, one of which is
  // right.
  const wrong = shuffled([...new Set(wrongPool)].filter(w => w !== correct)).slice(0, 3);
  return shuffled([correct, ...wrong]);
}

// --- fact tables -------------------------------------------------------
// Kept as data rather than baked into the generators, so a topic can be
// widened by adding rows and the question shapes stay untouched.

const LIVING = [
  'כלב', 'עץ אלון', 'דג', 'פרפר', 'שושנה', 'חתול', 'ציפור', 'פטרייה',
  'נמלה', 'סוס', 'דקל', 'צב', 'דבורה', 'עכביש', 'קקטוס', 'צפרדע',
  'אצה', 'חילזון', 'עכבר', 'תולעת'
];
const NON_LIVING = [
  'אבן', 'שולחן', 'מים', 'ענן', 'מכונית', 'כדור', 'מספריים', 'חול',
  'מפתח', 'בלון', 'ספר', 'כפית', 'זכוכית', 'ברזל', 'נעל', 'מטריה',
  'מחברת', 'סיר', 'חבל', 'מסמר'
];

const NEEDS = ['מים', 'אוויר', 'מזון', 'אור השמש', 'טמפרטורה מתאימה', 'מקום מחיה'];
const NOT_NEEDS = [
  'טלוויזיה', 'כסף', 'צעצועים', 'מוזיקה', 'מחשב', 'בגדים יפים',
  'טלפון', 'ממתקים'
];

const HABITATS = [
  { animal: 'דג זהב', home: 'מים מתוקים' },
  { animal: 'גמל', home: 'מדבר' },
  { animal: 'דוב הקוטב', home: 'אזור קר וקרחוני' },
  { animal: 'קוף', home: 'יער' },
  { animal: 'דולפין', home: 'ים' },
  { animal: 'ינשוף', home: 'יער' },
  { animal: 'פינגווין', home: 'אזור קר וקרחוני' },
  { animal: 'עקרב', home: 'מדבר' },
  { animal: 'צפרדע', home: 'מים מתוקים' },
  { animal: 'כריש', home: 'ים' },
  { animal: 'שועל', home: 'שדה פתוח' },
  { animal: 'ארנבת', home: 'שדה פתוח' }
];

const STATES = [
  { item: 'קרח', state: 'מוצק' },
  { item: 'מים', state: 'נוזל' },
  { item: 'אדי מים', state: 'גז' },
  { item: 'אבן', state: 'מוצק' },
  { item: 'שמן', state: 'נוזל' },
  { item: 'אוויר', state: 'גז' },
  { item: 'עץ', state: 'מוצק' },
  { item: 'חלב', state: 'נוזל' },
  { item: 'חמצן', state: 'גז' },
  { item: 'ברזל', state: 'מוצק' },
  { item: 'מיץ', state: 'נוזל' },
  { item: 'הליום', state: 'גז' }
];
const ALL_STATES = ['מוצק', 'נוזל', 'גז'];

const ENERGY_SOURCES = [
  { thing: 'פנס', source: 'סוללה' },
  { thing: 'טחנת רוח', source: 'רוח' },
  { thing: 'לוח סולארי', source: 'השמש' },
  { thing: 'מכונית', source: 'דלק' },
  { thing: 'גוף האדם', source: 'מזון' },
  { thing: 'שעון קיר', source: 'סוללה' },
  { thing: 'מפרשית', source: 'רוח' },
  { thing: 'צמח', source: 'השמש' },
  { thing: 'תנור בישול', source: 'גז' },
  { thing: 'מקרר', source: 'חשמל' },
  { thing: 'נורה בבית', source: 'חשמל' },
  { thing: 'סירת מנוע', source: 'דלק' }
];

const ANIMAL_GROUPS = [
  { animal: 'כלב', group: 'יונק' }, { animal: 'סוס', group: 'יונק' },
  { animal: 'עטלף', group: 'יונק' }, { animal: 'דולפין', group: 'יונק' },
  { animal: 'פיל', group: 'יונק' }, { animal: 'עכבר', group: 'יונק' },
  { animal: 'יונה', group: 'עוף' }, { animal: 'נשר', group: 'עוף' },
  { animal: 'תרנגולת', group: 'עוף' }, { animal: 'ברווז', group: 'עוף' },
  { animal: 'פינגווין', group: 'עוף' }, { animal: 'ינשוף', group: 'עוף' },
  { animal: 'כריש', group: 'דג' }, { animal: 'סלמון', group: 'דג' },
  { animal: 'דג זהב', group: 'דג' }, { animal: 'טונה', group: 'דג' },
  { animal: 'נחש', group: 'זוחל' }, { animal: 'צב', group: 'זוחל' },
  { animal: 'לטאה', group: 'זוחל' }, { animal: 'תנין', group: 'זוחל' }
];

/** What actually distinguishes each group, for the explanation. */
const GROUP_MARK = {
  'יונק': 'יונקים מניקים את צאצאיהם ונושמים אוויר בריאות.',
  'עוף': 'עופות מכוסים נוצות ומטילים ביצים.',
  'דג': 'דגים חיים במים ונושמים דרך זימים.',
  'זוחל': 'זוחלים מכוסים קשקשים ומטילים ביצים ביבשה.'
};

const MADE_BY_PEOPLE = [
  'כיסא', 'גשר', 'מטוס', 'בקבוק', 'מחשב', 'כביש',
  'חלון', 'אופניים', 'מטרייה', 'עיפרון', 'סירה', 'בית'
];
const NATURAL = [
  'הר', 'נהר', 'עץ', 'ענן', 'צדף', 'שמש',
  'ים', 'סלע', 'גשם', 'ירח', 'חול', 'קשת בענן'
];

// --- generators --------------------------------------------------------

/**
 * חי או דומם.
 *
 * Asked as "which of these is alive", not "is a dog alive". The engine requires
 * four options, and a yes/no question cannot supply them — but the reshaping is
 * an improvement anyway: picking the living thing out of four forces the same
 * judgement three extra times.
 */
function livingOrNot() {
  const wantLiving = rand(0, 1) === 0;
  const correct = wantLiving ? pick(LIVING) : pick(NON_LIVING);
  const pool = wantLiving ? NON_LIVING : LIVING;
  return {
    topic: 'חי ודומם',
    text: wantLiving ? 'איזה מהבאים הוא יצור חי?' : 'איזה מהבאים הוא דומם?',
    options: fourFrom(correct, pool),
    correctVal: correct,
    exp: wantLiving
      ? `${correct} הוא יצור חי — הוא גדל, ניזון ומתרבה. האחרים אינם עושים אף אחד מאלה.`
      : `${correct} הוא דומם: אינו גדל מעצמו, אינו ניזון ואינו מתרבה. האחרים הם יצורים חיים.`
  };
}

/** מה יצור חי צריך כדי לחיות. */
function livingNeeds() {
  const correct = pick(NEEDS);
  return {
    topic: 'צרכי יצורים חיים',
    text: 'מה מכל אלה יצור חי חייב כדי להישאר בחיים?',
    options: fourFrom(correct, NOT_NEEDS),
    correctVal: correct,
    exp: `${correct} הוא צורך בסיסי של כל יצור חי. הדברים האחרים נעימים או שימושיים, אך אפשר לחיות בלעדיהם.`
  };
}

/** בית הגידול של בעל חיים. */
function habitat() {
  const row = pick(HABITATS);
  return {
    topic: 'בתי גידול',
    text: `היכן חי ${row.animal} בדרך כלל?`,
    options: fourFrom(row.home, HABITATS.map(h => h.home)),
    correctVal: row.home,
    exp: `${row.animal} מותאם לחיים ב${row.home} — הגוף שלו בנוי בדיוק לתנאים שם.`
  };
}

/** מצבי צבירה. */
function stateOfMatter() {
  const state = pick(ALL_STATES);
  const matching = STATES.filter(r => r.state === state);
  const row = pick(matching);
  const others = STATES.filter(r => r.state !== state).map(r => r.item);
  return {
    topic: 'מצבי צבירה',
    text: `איזה מהחומרים האלה נמצא במצב ${state} בטמפרטורת החדר?`,
    options: fourFrom(row.item, others),
    correctVal: row.item,
    exp: state === 'מוצק'
      ? `${row.item} שומר על צורתו ועל נפחו, ולכן הוא מוצק.`
      : state === 'נוזל'
        ? `${row.item} שומר על נפחו אך לוקח את צורת הכלי — זה נוזל.`
        : `${row.item} מתפשט וממלא כל חלל שנתון לו — זה גז.`
  };
}

/**
 * קבוצות בעלי חיים — part of מערכות ותהליכים ביצורים חיים, which the outline
 * puts in grade 1.
 *
 * Asked both ways round: name the group of an animal, and pick an animal from a
 * named group. The two directions are genuinely different for a child — the
 * first is recall, the second is search — and together they roughly double what
 * one table can produce.
 */
function animalGroup() {
  const row = pick(ANIMAL_GROUPS);
  const groups = [...new Set(ANIMAL_GROUPS.map(a => a.group))];
  if (rand(0, 1) === 0) {
    return {
      topic: 'קבוצות בעלי חיים',
      text: `לאיזו קבוצה שייך ${row.animal}?`,
      options: fourFrom(row.group, groups),
      correctVal: row.group,
      exp: `${row.animal} הוא ${row.group}. ${GROUP_MARK[row.group]}`
    };
  }
  const others = ANIMAL_GROUPS.filter(a => a.group !== row.group).map(a => a.animal);
  return {
    topic: 'קבוצות בעלי חיים',
    text: `איזה מבעלי החיים האלה הוא ${row.group}?`,
    options: fourFrom(row.animal, others),
    correctVal: row.animal,
    exp: `${row.animal} הוא ${row.group}. ${GROUP_MARK[row.group]}`
  };
}

/** מקורות אנרגיה. */
function energySource() {
  const row = pick(ENERGY_SOURCES);
  return {
    topic: 'מקורות אנרגיה',
    text: `מהו מקור האנרגיה של ${row.thing}?`,
    options: fourFrom(row.source, ENERGY_SOURCES.map(e => e.source)),
    correctVal: row.source,
    exp: `${row.thing} פועל בזכות ${row.source}. בלי מקור אנרגיה שום דבר לא פועל מעצמו.`
  };
}

/** טבעי או מעשה ידי אדם — the technology domain's entry point. */
function naturalOrMade() {
  const wantMade = rand(0, 1) === 0;
  const correct = wantMade ? pick(MADE_BY_PEOPLE) : pick(NATURAL);
  const pool = wantMade ? NATURAL : MADE_BY_PEOPLE;
  return {
    topic: 'עולם מעשה ידי אדם',
    text: wantMade ? 'איזה מהבאים הוא מעשה ידי אדם?' : 'איזה מהבאים קיים בטבע?',
    options: fourFrom(correct, pool),
    correctVal: correct,
    exp: wantMade
      ? `${correct} תוכנן ויוצר בידי אדם כדי לפתור בעיה או למלא צורך. האחרים קיימים בטבע.`
      : `${correct} קיים בטבע בלי שאדם ייצר אותו. האחרים הם מעשה ידי אדם.`
  };
}

/**
 * Grades 1-6.
 *
 * The curriculum introduces חומרים in grade 2 and אנרגיה in grade 1, and both
 * recur every year afterwards at increasing depth. These pools follow that
 * shape rather than giving every grade the same set: the classification topics
 * start at grade 1, מצבי צבירה joins at 2 with חומרים, and everything stays
 * available above, because a topic the curriculum revisits is one a student can
 * still be weak at.
 */
const G1 = [livingOrNot, livingNeeds, habitat, animalGroup, energySource, naturalOrMade];
const G2 = [...G1, stateOfMatter];

export const scienceGenerators = {
  '1': G1,
  '2': G2,
  '3': G2,
  '4': G2,
  '5': G2,
  '6': G2
};

/**
 * Pool size, stated honestly.
 *
 * These generators vary an item over a fact table, so each topic can produce
 * about as many distinct questions as its table has rows — an order of
 * magnitude smaller than a maths generator, which varies numbers freely. With
 * the tables above a long quiz WILL repeat within a sitting.
 *
 * That is why this ships as a foundation rather than a finished subject: the
 * fix is more rows and more topics per grade, following the outline in
 * docs/science-source-outline.md, not a different question shape. The tables
 * are separated from the generators precisely so that widening is additive.
 */
