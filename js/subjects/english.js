/**
 * English question generators, keyed by grade, aligned to the Israeli
 * curriculum bands (elementary / junior-high / high-school topics: vocabulary,
 * grammar, prepositions, verb forms, comparatives, reading).
 *
 * Content policy: vocabulary, translations, and grammar rules are common
 * knowledge — no one holds copyright over "dog = כלב" or "good at". Nothing
 * here is copied from any question paper; the parameterised frames just
 * multiply common language facts into many distinct items.
 *
 * Contract: a function taking a difficulty level (1-5) and returning
 *   { topic, text, options: string[4], correctVal: string, exp: string }
 *
 * Level scales three things: which slice of a word list is drawn from, which
 * direction the question runs (recognising a foreign word is easier than
 * producing one), and how close the distractors sit. The lists are authored
 * roughly easiest-first, so slicing them shifts difficulty without keeping
 * parallel lists.
 *
 * Generators still carry a `.difficulty` property, so a quiz that requests no
 * particular level behaves exactly as before. Pure: no DOM, network.
 */
import { rand, shuffle } from '../mathfmt.js';
import { byLevel, clampLevel } from '../levels.js';

/** Tags a generator function with its difficulty band and returns it. */
function tag(fn, difficulty) {
  fn.difficulty = difficulty;
  return fn;
}

/** Wraps English text so it renders LTR inside the RTL page. */
function en(text) {
  return `<span dir="ltr" class="lang-ltr">${text}</span>`;
}

const VOCAB = {
  basic: [
    ['dog', 'כלב'], ['cat', 'חתול'], ['house', 'בית'], ['water', 'מים'],
    ['book', 'ספר'], ['friend', 'חבר'], ['school', 'בית ספר'], ['tree', 'עץ'],
    ['bread', 'לחם'], ['night', 'לילה'], ['window', 'חלון'], ['river', 'נהר'],
    ['sun', 'שמש'], ['moon', 'ירח'], ['hand', 'יד'], ['head', 'ראש'],
    ['door', 'דלת'], ['table', 'שולחן'], ['chair', 'כיסא'], ['milk', 'חלב'],
    ['apple', 'תפוח'], ['bird', 'ציפור'], ['fish', 'דג'], ['car', 'מכונית'],
    ['road', 'כביש'], ['city', 'עיר'], ['flower', 'פרח'], ['rain', 'גשם'],
    ['snow', 'שלג'], ['fire', 'אש'], ['boy', 'ילד'], ['girl', 'ילדה'],
    ['man', 'איש'], ['woman', 'אישה'], ['hour', 'שעה'], ['day', 'יום'],
    ['week', 'שבוע'], ['year', 'שנה'], ['money', 'כסף'], ['food', 'אוכל']
  ],
  intermediate: [
    ['journey', 'מסע'], ['courage', 'אומץ'], ['silence', 'שקט'], ['weather', 'מזג אוויר'],
    ['decision', 'החלטה'], ['neighbour', 'שכן'], ['knowledge', 'ידע'], ['question', 'שאלה'],
    ['message', 'הודעה'], ['freedom', 'חופש'], ['machine', 'מכונה'], ['distance', 'מרחק'],
    ['memory', 'זיכרון'], ['language', 'שפה'], ['nature', 'טבע'], ['science', 'מדע'],
    ['history', 'היסטוריה'], ['future', 'עתיד'], ['reason', 'סיבה'], ['answer', 'תשובה'],
    ['effort', 'מאמץ'], ['success', 'הצלחה'], ['failure', 'כישלון'], ['danger', 'סכנה'],
    ['health', 'בריאות'], ['wealth', 'עושר'], ['travel', 'לנסוע'], ['believe', 'להאמין'],
    ['explain', 'להסביר'], ['imagine', 'לדמיין'], ['improve', 'לשפר'], ['discover', 'לגלות']
  ],
  advanced: [
    ['reluctant', 'מהסס'], ['abundant', 'שופע'], ['deliberate', 'מכוון'], ['inevitable', 'בלתי נמנע'],
    ['ambiguous', 'דו-משמעי'], ['persuade', 'לשכנע'], ['diminish', 'להפחית'], ['thorough', 'יסודי'],
    ['sufficient', 'מספיק'], ['tolerate', 'לסבול'], ['restore', 'לשקם'], ['genuine', 'אמיתי'],
    ['profound', 'עמוק'], ['fragile', 'שביר'], ['reliable', 'אמין'], ['sincere', 'כן'],
    ['obstacle', 'מכשול'], ['fortunate', 'בר מזל'], ['hostile', 'עוין'], ['vivid', 'חי'],
    ['scarce', 'נדיר'], ['coherent', 'קוהרנטי'], ['prevail', 'לגבור'], ['emphasise', 'להדגיש'],
    ['acknowledge', 'להכיר בכך'], ['contradict', 'לסתור'], ['anticipate', 'לצפות'], ['reinforce', 'לחזק'],
    ['inherent', 'טבוע'], ['subtle', 'עדין'], ['diverse', 'מגוון'], ['adequate', 'הולם']
  ]
};

/** [word, opposite] — antonyms are common-knowledge language facts. */
const ANTONYMS = [
  ['big', 'small'], ['hot', 'cold'], ['fast', 'slow'], ['happy', 'sad'],
  ['open', 'closed'], ['full', 'empty'], ['light', 'dark'], ['high', 'low'],
  ['early', 'late'], ['strong', 'weak'], ['easy', 'hard'], ['clean', 'dirty'],
  ['rich', 'poor'], ['young', 'old'], ['near', 'far'], ['wet', 'dry'],
  ['loud', 'quiet'], ['brave', 'afraid'], ['ancient', 'modern'], ['generous', 'selfish'],
  ['increase', 'decrease'], ['accept', 'reject'], ['arrive', 'depart'], ['expand', 'shrink']
];

/**
 * Irregular verbs: [base, past, past participle].
 *
 * The third form was added for the perfect tenses and the passive. Everything
 * that existed before destructures the first two or indexes [1], so it does not
 * see the extra element — which is why the list was extended rather than
 * duplicated.
 */
const IRREGULAR = [
  ['go', 'went', 'gone'], ['eat', 'ate', 'eaten'], ['write', 'wrote', 'written'],
  ['take', 'took', 'taken'], ['see', 'saw', 'seen'], ['buy', 'bought', 'bought'],
  ['bring', 'brought', 'brought'], ['teach', 'taught', 'taught'],
  ['begin', 'began', 'begun'], ['choose', 'chose', 'chosen'],
  ['drive', 'drove', 'driven'], ['speak', 'spoke', 'spoken'],
  ['break', 'broke', 'broken'], ['catch', 'caught', 'caught'],
  ['come', 'came', 'come'], ['do', 'did', 'done'],
  ['drink', 'drank', 'drunk'], ['fall', 'fell', 'fallen'],
  ['feel', 'felt', 'felt'], ['find', 'found', 'found'],
  ['give', 'gave', 'given'], ['grow', 'grew', 'grown'],
  ['know', 'knew', 'known'], ['leave', 'left', 'left'],
  ['make', 'made', 'made'], ['meet', 'met', 'met'],
  ['run', 'ran', 'run'], ['sing', 'sang', 'sung'],
  ['sit', 'sat', 'sat'], ['sleep', 'slept', 'slept'],
  ['swim', 'swam', 'swum'], ['think', 'thought', 'thought']
];

/** Irregular plurals: [singular, plural]. */
const PLURALS = [
  ['child', 'children'], ['man', 'men'], ['woman', 'women'], ['foot', 'feet'],
  ['tooth', 'teeth'], ['mouse', 'mice'], ['person', 'people'], ['goose', 'geese'],
  ['leaf', 'leaves'], ['knife', 'knives'], ['life', 'lives'], ['wolf', 'wolves'],
  ['city', 'cities'], ['baby', 'babies'], ['party', 'parties'], ['sheep', 'sheep']
];

const PREPOSITIONS = [
  ['She is good ___ mathematics.', 'at', ['in', 'on', 'for'], 'הצירוף "good at" קבוע.'],
  ['We arrived ___ the airport at noon.', 'at', ['to', 'in', 'on'], 'עם מקום מסוים כמו airport משתמשים ב-at.'],
  ['The book is ___ the table.', 'on', ['in', 'at', 'under'], 'משטח אופקי — on.'],
  ['He has lived here ___ 2019.', 'since', ['for', 'from', 'during'], 'since מציין נקודת התחלה בזמן.'],
  ['They waited ___ two hours.', 'for', ['since', 'during', 'from'], 'for מציין משך זמן.'],
  ['I am interested ___ history.', 'in', ['on', 'at', 'about'], 'הצירוף הקבוע הוא "interested in".'],
  ['She is afraid ___ spiders.', 'of', ['from', 'about', 'for'], 'הצירוף הקבוע הוא "afraid of".'],
  ['We depend ___ each other.', 'on', ['of', 'from', 'at'], 'הצירוף הקבוע הוא "depend on".'],
  ['He is married ___ a doctor.', 'to', ['with', 'at', 'of'], 'הצירוף הקבוע הוא "married to".'],
  ['They are proud ___ their team.', 'of', ['about', 'for', 'with'], 'הצירוף הקבוע הוא "proud of".'],
  ['The train goes ___ Tel Aviv to Haifa.', 'from', ['at', 'since', 'of'], 'from מציין נקודת מוצא.'],
  ['Put the milk ___ the fridge.', 'in', ['on', 'at', 'to'], 'בתוך מרחב סגור — in.']
];

/** [adjective, comparative, superlative]. */
const ADJECTIVES = [
  ['big', 'bigger', 'biggest'], ['small', 'smaller', 'smallest'],
  ['fast', 'faster', 'fastest'], ['slow', 'slower', 'slowest'],
  ['happy', 'happier', 'happiest'], ['easy', 'easier', 'easiest'],
  ['tall', 'taller', 'tallest'], ['strong', 'stronger', 'strongest'],
  ['good', 'better', 'best'], ['bad', 'worse', 'worst'],
  ['hot', 'hotter', 'hottest'], ['cold', 'colder', 'coldest']
];

/** Present-simple third-person agreement: subject + verb slots multiply out. */
const PS_SUBJECTS = [
  ['He', true], ['She', true], ['It', true], ['My father', true], ['The teacher', true],
  ['The dog', true], ['My friend', true], ['I', false], ['You', false], ['We', false],
  ['They', false], ['My friends', false], ['The children', false]
];
const PS_VERBS = [
  ['play', 'plays'], ['read', 'reads'], ['eat', 'eats'], ['run', 'runs'],
  ['watch', 'watches'], ['go', 'goes'], ['study', 'studies'], ['like', 'likes'],
  ['work', 'works'], ['sleep', 'sleeps'], ['sing', 'sings'], ['write', 'writes']
];

function distinctValues(list, pick, exclude, n) {
  const banned = new Set(exclude);
  const pool = [...new Set(list.map(pick))].filter(value => !banned.has(value));
  return shuffle(pool).slice(0, n);
}

/**
 * Exactly four distinct options, the correct one among them.
 *
 * Verb forms collide more often than they look like they will: `come/came/come`
 * and `run/ran/run` repeat the base as the participle, and a naive
 * `base + 'ed'` lands on a form another distractor already used. Every such
 * collision silently produced a three-option question, which the student sees
 * as a one-in-three guess.
 *
 * `preferred` are the distractors that TEACH — the specific wrong forms a
 * student reaches for. `pool` is only there to make the count up when the
 * preferred ones collapse into each other.
 */
function fourOptions(correct, preferred, pool = []) {
  const out = [correct];
  for (const candidate of [...preferred, ...pool]) {
    if (out.length === 4) break;
    if (candidate && !out.includes(candidate)) out.push(candidate);
  }
  return shuffle(out);
}

const BAND_DIFF = { basic: 1, intermediate: 2, advanced: 3 };

/**
 * The slice of a word list appropriate to `level`: levels 1-2 draw from the
 * easier head, 3 from the whole list, 4-5 from the harder tail. Lists shorter
 * than four entries are returned whole, since halving them would leave too few
 * distinct distractors.
 */
function slice(list, level) {
  if (level == null || list.length < 4) return list;
  const half = Math.ceil(list.length / 2);
  const head = list.slice(0, half);
  const tail = list.slice(half);
  return byLevel(level, [head, head, list, tail, tail]);
}

/** Vocabulary band for a level: basic -> intermediate -> advanced. */
function bandFor(level) {
  return byLevel(level, ['basic', 'basic', 'intermediate', 'advanced', 'advanced']);
}

/**
 * Vocabulary. `band` pins the list when a grade needs a fixed one; when a level
 * is supplied it picks the band instead, so one generator serves both an easy
 * grade-10 quiz and a hard grade-5 one.
 *
 * Direction flips at the top: recognising a foreign word (English to Hebrew) is
 * easier than producing one, so levels 4-5 ask for production.
 */
function vocabGenerator(band) {
  return tag(level => {
    const chosen = level == null ? band : bandFor(level);
    const list = VOCAB[chosen];
    const [word, meaning] = list[rand(0, list.length - 1)];

    if (level != null && clampLevel(level) >= 4) {
      const distractors = distinctValues(list, pair => pair[0], [word], 3);
      return {
        topic: 'אוצר מילים',
        text: `כיצד אומרים "${meaning}" באנגלית?`,
        options: [word, ...distractors],
        correctVal: word,
        exp: `"${meaning}" הוא ${en(word)}.`
      };
    }
    const distractors = distinctValues(list, pair => pair[1], [meaning], 3);
    return {
      topic: 'אוצר מילים',
      text: `מה פירוש המילה ${en(word)} בעברית?`,
      options: [meaning, ...distractors],
      correctVal: meaning,
      exp: `${en(word)} פירושו "${meaning}".`
    };
  }, BAND_DIFF[band]);
}

/** Antonym selection. */
const oppositeGenerator = tag(level => {
  const flip = rand(0, 1) === 0;
  const pool = slice(ANTONYMS, level);
  const [a, b] = pool[rand(0, pool.length - 1)];
  const [word, answer] = flip ? [a, b] : [b, a];
  const distractors = distinctValues(
    ANTONYMS.flatMap(p => p), v => v, [word, answer], 3);
  return {
    topic: 'ניגודים',
    text: `בחר את ההפך של המילה ${en(word)}:`,
    options: [answer, ...distractors],
    correctVal: answer,
    exp: `ההפך של ${en(word)} הוא ${en(answer)}.`
  };
}, 2);

/** Irregular plural selection. */
const pluralGenerator = tag(level => {
  const pool = slice(PLURALS, level);
  const [singular, plural] = pool[rand(0, pool.length - 1)];
  const regular = `${singular}s`;
  const distractors = distinctValues(PLURALS, pair => pair[1], [plural, regular], 2);
  return {
    topic: 'רבים חריגים',
    text: `מהי צורת הרבים של ${en(singular)}?`,
    options: [plural, regular, ...distractors],
    correctVal: plural,
    exp: `${en(singular)} הוא רבים חריג: ${en(plural)}, ולא ${en(regular)}.`
  };
}, 1);

/** a / an article choice. */
const articleGenerator = tag(level => {
  // Reordered so the head is decided by the written first letter and the tail
  // by the SOUND, which is the part students actually get wrong: "an hour" has
  // a silent h, "a university" opens on a consonant glide.
  const words = [
    ['apple', 'an'], ['dog', 'a'], ['egg', 'an'], ['book', 'a'],
    ['orange', 'an'], ['car', 'a'], ['umbrella', 'an'], ['house', 'a'],
    ['hour', 'an'], ['university', 'a'], ['idea', 'an'], ['banana', 'a']
  ];
  const pool = slice(words, level);
  const [word, answer] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'a / an',
    // The blank goes INSIDE the LTR isolate together with the noun. Left
    // outside it, the underscore is a neutral character in an RTL paragraph, so
    // the bidi algorithm places it to the RIGHT of the isolated English run and
    // the student sees "orange ___" — the article after the noun it modifies.
    text: `בחר את המילית הנכונה: ${en(`___ ${word}`)}`,
    options: shuffle([answer, answer === 'a' ? 'an' : 'a', 'the', '—']),
    correctVal: answer,
    exp: `לפני צליל תנועה משתמשים ב-an, אחרת ב-a. כאן: ${en(`${answer} ${word}`)}.`
  };
}, 1);

/** Irregular past-tense selection. */
const pastTenseGenerator = tag(level => {
  const pool = slice(IRREGULAR, level);
  const [base, past] = pool[rand(0, pool.length - 1)];
  const regularised = `${base}ed`;
  const distractors = distinctValues(IRREGULAR, pair => pair[1], [past, regularised], 2);
  return {
    topic: 'זמן עבר',
    text: `בחר את צורת העבר הנכונה: ${en(`Yesterday I ___ . (${base})`)}`,
    options: [past, regularised, ...distractors],
    correctVal: past,
    exp: `${en(base)} הוא פועל לא רגיל — צורת העבר היא ${en(past)}, ולא ${en(regularised)}.`
  };
}, 2);

/** Preposition selection from a fixed frame list. */
const prepositionGenerator = tag(level => {
  const pool = slice(PREPOSITIONS, level);
  const [sentence, answer, wrong, explanation] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'מילות יחס',
    text: `השלם את המילה החסרה: ${en(sentence)}`,
    options: [answer, ...wrong],
    correctVal: answer,
    exp: explanation
  };
}, 2);

/** Comparative / superlative choice. */
const comparativeGenerator = tag(level => {
  // good/better/best and bad/worse/worst sit at the end of ADJECTIVES, so the
  // level slice reaches the irregular forms only at 4-5.
  const pool = slice(ADJECTIVES, level);
  const [base, comp, sup] = pool[rand(0, pool.length - 1)];
  const wantSuper = rand(0, 1) === 0;
  const answer = wantSuper ? sup : comp;
  const other = wantSuper ? comp : sup;
  const wrong = wantSuper ? `most ${base}` : `more ${base}`;
  const frame = wantSuper
    ? `This is the ___ one of all. (${base})`
    : `This one is ___ than that. (${base})`;
  return {
    topic: 'דרגות השוואה',
    text: `השלם את צורת ההשוואה: ${en(frame)}`,
    options: shuffle([answer, base, other, wrong]),
    correctVal: answer,
    exp: `הצורה הנכונה של ${en(base)} כאן היא ${en(answer)}.`
  };
}, 2);

/** Present-simple subject/verb agreement — parameterised for volume. */
const presentSimpleGenerator = tag(level => {
  // The plural subjects sit in the tail, and they are the ones that tempt a
  // wrongly-added -s.
  const subjects = slice(PS_SUBJECTS, level);
  const verbs = slice(PS_VERBS, level);
  const [subject, third] = subjects[rand(0, subjects.length - 1)];
  const [base, s] = verbs[rand(0, verbs.length - 1)];
  const answer = third ? s : base;
  return {
    topic: 'זמן הווה פשוט',
    text: `בחר את צורת הפועל הנכונה: ${en(`${subject} ___ every day. (${base})`)}`,
    options: shuffle([answer, third ? base : s, `${base}ing`, `${base}ed`]),
    correctVal: answer,
    exp: third
      ? `בגוף שלישי יחיד מוסיפים s/es: ${en(s)}.`
      : `עם ${en(subject)} משתמשים בצורת הבסיס: ${en(base)}.`
  };
}, 1);

// --- exam formats: cloze, multi-select, passage -------------------------
// These return the `parts` shape from js/qtypes.js instead of a single correct
// index. Every sentence and passage below is written for this app and built
// from slots, so one frame yields many distinct items.

const NAMES = ['Dana', 'Yonatan', 'Maya', 'Omer', 'Noa', 'Itai', 'Shira', 'Amit'];
const PLACES = ['the library', 'the park', 'the market', 'the beach', 'the museum'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function one(list) {
  return list[rand(0, list.length - 1)];
}

/** Builds a part whose options are shuffled, tracking where the answer landed. */
function choicePart(prompt, answer, wrong) {
  const options = shuffle([answer, ...wrong]);
  return { prompt, options, correct: options.indexOf(answer) };
}

/**
 * A sentence with two gaps — verb agreement and a preposition — gaining a third
 * at levels 4-5, where the article turns on sound rather than spelling.
 */
const clozeGenerator = tag(level => {
  const name = one(NAMES);
  const place = one(PLACES);
  const day = one(DAYS);
  const [base, third] = one(PS_VERBS);

  const parts = [
    choicePart('הפועל', third, [base, `${base}ing`, `${base}ed`]),
    choicePart('מילת היחס', 'to', ['at', 'on', 'for'])
  ];

  const hard = level != null && clampLevel(level) >= 4;
  if (hard) {
    const [word, article] = one([['hour', 'an'], ['university', 'a'], ['idea', 'an'], ['book', 'a']]);
    parts.push(choicePart('המילית', article, [article === 'a' ? 'an' : 'a', 'the', '—']));
    return {
      kind: 'cloze',
      topic: 'השלמת משפט',
      text: `השלם את שלושת החסרים: ${en(`${name} ___ ___ ${place} every ${day} with ___ ${word}.`)}`,
      parts,
      exp: `בגוף שלישי יחיד הפועל מקבל s/es (${en(third)}); אל מקום שהולכים אליו משתמשים ב-${en('to')}; והמילית נקבעת לפי הצליל הפותח — ${en(`${article} ${word}`)}.`
    };
  }

  return {
    kind: 'cloze',
    topic: 'השלמת משפט',
    text: `השלם את שני החסרים: ${en(`${name} ___ ___ ${place} every ${day}.`)}`,
    parts,
    exp: `בגוף שלישי יחיד מוסיפים s/es לפועל (${en(third)}), ולפני שם מקום שהולכים אליו משתמשים ב-${en('to')}.`
  };
}, 3);

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
    options: options.map(en),
    correct: options.reduce((acc, o, i) => (right.includes(o) ? [...acc, i] : acc), [])
  };
}

/** Choose every option that fits. Several are right, several are not. */
const multiSelectGenerator = tag(level => {
  const hard = level != null && clampLevel(level) >= 4;
  const mode = hard ? one(['past', 'plural', 'band']) : one(['past', 'plural']);

  if (mode === 'plural') {
    const pairs = shuffle(slice(PLURALS, level)).slice(0, 3);
    const right = pairs.map(p => p[1]);
    // The distractors are the regularised forms of the SAME words, so the
    // question tests the irregular rule rather than recognition of a stray word.
    const wrong = pairs.map(p => `${p[0]}s`).filter(w => !right.includes(w));
    return {
      kind: 'multi',
      topic: 'רבים חריגים',
      text: `סמן את כל צורות הרבים הנכונות של: ${pairs.map(p => en(p[0])).join(', ')}`,
      parts: [multiPart(right, wrong)],
      exp: `הצורות הנכונות הן ${right.map(en).join(', ')}. השאר הן תוספת s שגויה לרבים חריג.`
    };
  }

  if (mode === 'past') {
    const pairs = shuffle(slice(IRREGULAR, level)).slice(0, 3);
    const right = pairs.map(p => p[1]);
    const wrong = pairs.map(p => `${p[0]}ed`).filter(w => !right.includes(w));
    return {
      kind: 'multi',
      topic: 'זמן עבר',
      text: `סמן את כל צורות העבר הנכונות של: ${pairs.map(p => en(p[0])).join(', ')}`,
      parts: [multiPart(right, wrong)],
      exp: `הצורות הנכונות הן ${right.map(en).join(', ')}. השאר הן פעלים לא רגילים שקיבלו ed בטעות.`
    };
  }

  const advanced = shuffle(VOCAB.advanced).slice(0, 3).map(p => p[0]);
  const basic = shuffle(VOCAB.basic).slice(0, 2).map(p => p[0]);
  return {
    kind: 'multi',
    topic: 'אוצר מילים - מיון',
    text: `סמן את כל המילים ברמה גבוהה מבין: ${shuffle([...advanced, ...basic]).map(en).join(', ')}`,
    parts: [multiPart(advanced, basic)],
    exp: `${advanced.map(en).join(', ')} הן מילים ברמה גבוהה; השאר מילות יסוד.`
  };
}, 3);

/**
 * A short original passage followed by linked questions. Built from slots, so
 * the same frame yields many distinct passages.
 */
const passageGenerator = tag(level => {
  const name = one(NAMES);
  const place = one(PLACES);
  const day = one(DAYS);
  const hour = rand(3, 9);
  const count = rand(2, 6);

  const passage =
    `${name} goes to ${place} every ${day}. ` +
    `${name} leaves home at ${hour} in the morning and takes ${count} books along. ` +
    `The walk is short, so ${name} is never late.`;

  const parts = [
    choicePart('Where does the walk go?', place,
      shuffle(PLACES.filter(p => p !== place)).slice(0, 3)),
    choicePart('On which day?', day,
      shuffle(DAYS.filter(d => d !== day)).slice(0, 3))
  ];
  if (level != null && clampLevel(level) >= 4) {
    parts.push(choicePart('How many books are taken?', String(count),
      [String(count + 1), String(count - 1), String(count + 3)]));
  }

  return {
    kind: 'passage',
    topic: 'הבנת הנקרא',
    passage: en(passage),
    text: `קרא את הקטע על ${en(name)} וענה על השאלות:`,
    parts,
    exp: `כל התשובות מופיעות ישירות בקטע: ${en(place)}, ${en(day)}, ${count}.`
  };
}, 3);


// --- tenses beyond present-simple and past ----------------------------
//
// The Israeli junior-high syllabus introduces the progressive tenses, the
// future and the modals in grade 7. The app stopped at present simple and past,
// so a seventh-grader met almost none of the year's actual grammar.

/** Subjects paired with the be-form each takes, present and past. */
const BE_SUBJECTS = [
  ['I', 'am', 'was'], ['He', 'is', 'was'], ['She', 'is', 'was'],
  ['The dog', 'is', 'was'], ['We', 'are', 'were'], ['They', 'are', 'were'],
  ['You', 'are', 'were'], ['My friends', 'are', 'were']
];

/** [base, -ing]. The spelling change is the point, so it is stored, not derived. */
const ING = [
  ['play', 'playing'], ['read', 'reading'], ['eat', 'eating'], ['walk', 'walking'],
  ['sing', 'singing'], ['sleep', 'sleeping'], ['work', 'working'], ['watch', 'watching'],
  ['run', 'running'], ['sit', 'sitting'], ['swim', 'swimming'], ['stop', 'stopping'],
  ['write', 'writing'], ['take', 'taking'], ['come', 'coming'], ['make', 'making'],
  ['lie', 'lying'], ['die', 'dying'], ['begin', 'beginning'], ['travel', 'travelling']
];

/**
 * The progressive tenses. One generator for both, because the only thing that
 * changes is which be-form is wanted — and the mistake being tested is the same
 * in both: agreement between the subject and be.
 */
function progressiveGenerator(past) {
  return tag(level => {
    const [subject, presentBe, pastBe] = one(BE_SUBJECTS);
    const be = past ? pastBe : presentBe;
    const pool = slice(ING, level);
    const [base, ing] = pool[rand(0, pool.length - 1)];
    const when = past ? 'yesterday at six' : 'right now';
    // The distractors are the OTHER real be-forms, so the question is decided by
    // agreement rather than by spotting a word that is not English.
    //
    // The past has only two be-forms, so taking "the others" leaves one and the
    // question would be three options wide. The present-tense form of the same
    // subject fills the gap, and it is a real mistake — a student writing about
    // yesterday who reaches for `is`.
    const distractors = past
      ? [be === 'was' ? 'were' : 'was', presentBe, base]
      : [...['am', 'is', 'are'].filter(f => f !== be).slice(0, 2), base];
    return {
      topic: past ? 'עבר מתמשך' : 'הווה מתמשך',
      text: `בחר את הצורה הנכונה: ${en(`${subject} ___ ${ing} ${when}. (${base})`)}`,
      options: shuffle([be, ...distractors]),
      correctVal: be,
      exp: past
        ? `בעבר מתמשך: ${en('was')} ליחיד, ${en('were')} לרבים ול-${en('you')}. כאן ${en(`${subject} ${be} ${ing}`)}.`
        : `הווה מתמשך נבנה מ-${en('am/is/are')} + ${en('-ing')}. כאן ${en(`${subject} ${be} ${ing}`)}.`
    };
  }, past ? 3 : 2);
}

/** The -ing form itself, where the spelling rule is what is tested. */
const ingSpellingGenerator = tag(level => {
  // The doubling and dropped-e cases sit in the tail, so a level-4 question
  // lands on `running` and `writing` rather than on `playing`.
  const pool = slice(ING, level);
  const [base, ing] = pool[rand(0, pool.length - 1)];
  const naive = `${base}ing`;
  return {
    topic: 'צורת ing',
    text: `מהי צורת ה-${en('-ing')} של ${en(base)}?`,
    options: fourOptions(ing, [naive], distinctValues(ING, pair => pair[1], [ing], 3)),
    correctVal: ing,
    exp: naive === ing
      ? `מוסיפים ${en('-ing')} בלי שינוי: ${en(ing)}.`
      : `הצורה היא ${en(ing)} ולא ${en(naive)} — האיות משתנה לפני ${en('-ing')}.`
  };
}, 2);

/**
 * The future.
 *
 * `will` against `going to` is a distinction of MEANING, not of form, so the
 * hard frames state which meaning they want: a decision made on the spot takes
 * will, a plan already made takes going to. A frame without that context accepts
 * both and would have no single answer.
 */
const futureGenerator = tag(level => {
  if (level != null && clampLevel(level) >= 4) {
    const plan = rand(0, 1) === 0;
    const frame = plan
      ? 'We bought the tickets. We ___ fly to London tomorrow.'
      : 'The phone is ringing. I ___ answer it.';
    const answer = plan ? 'are going to' : 'will';
    return {
      topic: 'זמן עתיד',
      text: `בחר את הצורה המתאימה: ${en(frame)}`,
      options: shuffle([answer, plan ? 'will' : 'am going to', 'would', 'was going to']),
      correctVal: answer,
      exp: plan
        ? `תוכנית שהוחלטה מראש — ${en('going to')}.`
        : `החלטה שנולדה ברגע זה — ${en('will')}.`
    };
  }
  const [subject] = one(BE_SUBJECTS);
  const [base] = one(ING);
  return {
    topic: 'זמן עתיד',
    text: `בחר את צורת העתיד: ${en(`${subject} ___ tomorrow. (${base})`)}`,
    options: shuffle([`will ${base}`, `will ${base}s`, `will ${base}ed`, `will to ${base}`]),
    correctVal: `will ${base}`,
    exp: `אחרי ${en('will')} בא הפועל בצורת הבסיס — בלי ${en('to')} ובלי ${en('-s')}: ${en(`will ${base}`)}.`
  };
}, 2);

/**
 * Modals. Every frame carries the meaning that forces one modal, for the same
 * reason the future frames do: with no context several of them fit.
 */
const MODALS = [
  ['She ___ swim very well — she trains every day.', 'can', ['must', 'should', 'might'], 'יכולת — can.'],
  ['You ___ stop at a red light. It is the law.', 'must', ['can', 'might', 'could'], 'חובה מוחלטת — must.'],
  ['You look tired. You ___ go to sleep earlier.', 'should', ['must', 'can', 'will'], 'המלצה — should.'],
  ['Take a coat — it ___ rain later.', 'might', ['must', 'should', 'can'], 'אפשרות לא ודאית — might.'],
  ['___ I open the window, please?', 'May', ['Must', 'Should', 'Will'], 'בקשת רשות מנומסת — may.'],
  ['When he was five he ___ already read.', 'could', ['can', 'must', 'should'], 'יכולת בעבר — could.'],
  ['She ___ be at home; her car is outside.', 'must', ['should', 'might', 'can'], 'הסקה ודאית מראיה — must.'],
  ['I ___ help you with the boxes if you like.', 'can', ['must', 'should', 'might'], 'הצעת עזרה — can.'],
  ['We ___ not waste water in a dry summer.', 'must', ['can', 'might', 'could'], 'איסור — must not.'],
  ['He ___ have left already — his coat is gone.', 'must', ['should', 'can', 'would'], 'הסקה על העבר — must have.']
];

const modalGenerator = tag(level => {
  const pool = slice(MODALS, level);
  const [frame, answer, wrong, why] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'פעלים מודאליים',
    text: `בחר את הפועל המודאלי המתאים: ${en(frame)}`,
    options: [answer, ...wrong],
    correctVal: answer,
    exp: why
  };
}, 3);

/** Question words. The frame supplies the answer, so exactly one word fits. */
const QUESTION_WORDS = [
  ['___ is your teacher? — Mrs Cohen.', 'Who', 'שואלים על אדם — who.'],
  ['___ do you live? — In Haifa.', 'Where', 'שואלים על מקום — where.'],
  ['___ does the film start? — At eight.', 'When', 'שואלים על זמן — when.'],
  ['___ are you late? — Because the bus broke down.', 'Why', 'שואלים על סיבה — why.'],
  ['___ do you go to school? — By bus.', 'How', 'שואלים על אופן — how.'],
  ['___ is in the box? — A present.', 'What', 'שואלים על דבר — what.'],
  ['___ books did you read? — Three.', 'How many', 'כמות של דבר שנמנה — how many.'],
  ['___ water is left? — Very little.', 'How much', 'כמות של דבר שאינו נמנה — how much.'],
  ['___ bag is this? — Mine.', 'Whose', 'שואלים על בעלות — whose.'],
  ['___ one do you want, the red or the blue? — The red.', 'Which', 'בוחרים מתוך מספר מוגדר — which.']
];

const questionWordGenerator = tag(level => {
  const pool = slice(QUESTION_WORDS, level);
  const [frame, answer, why] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'מילות שאלה',
    text: `בחר את מילת השאלה: ${en(frame)}`,
    options: [answer, ...distinctValues(QUESTION_WORDS, row => row[1], [answer], 3)],
    correctVal: answer,
    exp: why
  };
}, 1);

/**
 * Countable against uncountable.
 *
 * Being countable is a property of the NOUN, so the nouns carry it and the
 * sentence is built around whichever is drawn — rather than a hand-written
 * sentence per noun.
 */
const COUNTABLE = ['books', 'apples', 'chairs', 'friends', 'cars', 'questions', 'students', 'eggs'];
const UNCOUNTABLE = ['water', 'money', 'bread', 'time', 'music', 'information', 'advice', 'homework'];

const quantifierGenerator = tag(level => {
  const countable = rand(0, 1) === 0;
  const noun = one(countable ? COUNTABLE : UNCOUNTABLE);
  if (level != null && clampLevel(level) >= 4) {
    // a few / a little is the same rule one step on, and it is exactly where a
    // student who has learnt many/much still slips.
    const answer = countable ? 'a few' : 'a little';
    return {
      topic: 'כמות ומנייה',
      text: `בחר את הצורה הנכונה: ${en(`There is only ___ ${noun} left.`)}`,
      options: shuffle([answer, countable ? 'a little' : 'a few', 'much', 'many']),
      correctVal: answer,
      exp: countable
        ? `${en(noun)} נמנה, ולכן ${en('a few')}.`
        : `${en(noun)} אינו נמנה, ולכן ${en('a little')}.`
    };
  }
  const answer = countable ? 'many' : 'much';
  return {
    topic: 'כמות ומנייה',
    text: `בחר את הצורה הנכונה: ${en(`How ___ ${noun} do you need?`)}`,
    options: shuffle([answer, countable ? 'much' : 'many', 'a lot', 'some']),
    correctVal: answer,
    exp: countable
      ? `${en(noun)} הוא שם עצם שנמנה, ולכן ${en('how many')}.`
      : `${en(noun)} אינו נמנה, ולכן ${en('how much')}.`
  };
}, 2);

/**
 * The present perfect. Two things are tested: the participle form, and
 * since/for — the pair that decides whether the sentence names a point in time
 * or a length of one.
 */
const presentPerfectGenerator = tag(level => {
  if (level != null && clampLevel(level) >= 4) {
    const point = rand(0, 1) === 0;
    const tail = point
      ? one(['2019', 'last March', 'Monday'])
      : one(['three years', 'two weeks', 'a long time']);
    const answer = point ? 'since' : 'for';
    return {
      topic: 'הווה מושלם',
      text: `בחר את המילה הנכונה: ${en(`She has lived here ___ ${tail}.`)}`,
      options: shuffle(['since', 'for', 'from', 'during']),
      correctVal: answer,
      exp: point
        ? `${en(tail)} היא נקודת התחלה, ולכן ${en('since')}.`
        : `${en(tail)} הוא משך זמן, ולכן ${en('for')}.`
    };
  }
  const pool = slice(IRREGULAR, level);
  const [base, past, pp] = pool[rand(0, pool.length - 1)];
  const third = rand(0, 1) === 0;
  const helper = third ? 'has' : 'have';
  const subject = third ? 'She' : 'They';
  return {
    topic: 'הווה מושלם',
    // When past and participle are the same word there is no contrast to draw,
    // so the distractors fall back to the regularised and -ing forms.
    text: `השלם: ${en(`${subject} ${helper} already ___ it. (${base})`)}`,
    options: fourOptions(pp, [past, `${base}ed`, base, `${base}ing`],
      distinctValues(IRREGULAR, row => row[2], [pp], 3)),
    correctVal: pp,
    exp: pp === past
      ? `בהווה מושלם באה הצורה השלישית: ${en(`${helper} ${pp}`)}.`
      : `בהווה מושלם באה הצורה השלישית ${en(pp)}, ולא ${en(past)} שהיא צורת העבר.`
  };
}, 4);

/** Adjective to adverb. The irregular pairs are what the level slice reaches. */
const ADVERBS = [
  ['quick', 'quickly'], ['slow', 'slowly'], ['quiet', 'quietly'], ['careful', 'carefully'],
  ['sudden', 'suddenly'], ['polite', 'politely'], ['brave', 'bravely'], ['clear', 'clearly'],
  ['happy', 'happily'], ['easy', 'easily'], ['angry', 'angrily'], ['gentle', 'gently'],
  ['good', 'well'], ['fast', 'fast'], ['hard', 'hard'], ['late', 'late']
];

const adverbGenerator = tag(level => {
  const pool = slice(ADVERBS, level);
  const [adj, adv] = pool[rand(0, pool.length - 1)];
  const naive = `${adj}ly`;
  return {
    topic: 'תארי הפועל',
    text: `בחר את תואר הפועל: ${en(`He speaks very ___ . (${adj})`)}`,
    options: fourOptions(adv, [naive], distinctValues(ADVERBS, pair => pair[1], [adv], 3)),
    correctVal: adv,
    exp: adv === naive
      ? `מוסיפים ${en('-ly')} לשם התואר: ${en(adv)}.`
      : `${en(adj)} חריג — תואר הפועל הוא ${en(adv)} ולא ${en(naive)}.`
  };
}, 3);

/**
 * Conditionals, types 1 and 2 only.
 *
 * Type 3 belongs to the five-point track and would be noise in a mixed grade-10
 * quiz, so it is left out rather than gated.
 */
const conditionalGenerator = tag(level => {
  if (level != null && clampLevel(level) >= 4) {
    return {
      topic: 'משפטי תנאי',
      text: `השלם את משפט התנאי: ${en('If I ___ rich, I would travel the world.')}`,
      options: shuffle(['were', 'am', 'will be', 'have been']),
      correctVal: 'were',
      exp: `בתנאי מסוג שני, שאינו מתקיים במציאות, בא ${en('were')} אחרי ${en('if')} ו-${en('would')} בפסוקית השנייה.`
    };
  }
  return {
    topic: 'משפטי תנאי',
    text: `השלם את משפט התנאי: ${en('If it rains tomorrow, we ___ at home.')}`,
    options: shuffle(['will stay', 'stayed', 'would stay', 'are staying']),
    correctVal: 'will stay',
    exp: `בתנאי מסוג ראשון: הווה פשוט אחרי ${en('if')}, ו-${en('will')} בפסוקית השנייה.`
  };
}, 4);

/** The passive, built on the participle — which is why IRREGULAR carries one. */
const passiveGenerator = tag(level => {
  const pool = slice(IRREGULAR, level);
  const [base, past, pp] = pool[rand(0, pool.length - 1)];
  const inPast = level != null && clampLevel(level) >= 4;
  const be = inPast ? 'was' : 'is';
  return {
    topic: 'סביל',
    text: `בחר את הצורה הסבילה: ${en(`The letter ___ by my sister. (${base})`)}`,
    // The distractors are the three ways this goes wrong: the base instead of
    // the participle, the progressive instead of the passive, and the active
    // past with no be at all.
    options: fourOptions(`${be} ${pp}`,
      [`${be} ${base}`, `${be} ${base}ing`, past, `${be} ${base}ed`]),
    correctVal: `${be} ${pp}`,
    exp: `סביל נבנה מ-${en('be')} + הצורה השלישית של הפועל: ${en(`${be} ${pp}`)}.`
  };
}, 4);

/** Phrasal verbs. A meaning question, so each frame pins its own meaning. */
const PHRASALS = [
  ['Please ___ after your little brother.', 'look', 'לשמור על מישהו — look after.'],
  ['Do not ___ up — you are almost there.', 'give', 'לוותר — give up.'],
  ['I ___ up early on Sundays.', 'get', 'לקום — get up.'],
  ['She ___ out the candles.', 'blew', 'לכבות בנשיפה — blow out.'],
  ['We ___ off the meeting until Monday.', 'put', 'לדחות — put off.'],
  ['He ___ up his new job last week.', 'took', 'להתחיל תפקיד — take up.'],
  ['They ___ out of money on the third day.', 'ran', 'להיגמר — run out of.'],
  ['Can you ___ on the light?', 'turn', 'להדליק — turn on.']
];

const phrasalGenerator = tag(level => {
  const pool = slice(PHRASALS, level);
  const [frame, answer, why] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'פעלים מורכבים',
    text: `בחר את הפועל המתאים: ${en(frame)}`,
    options: [answer, ...distinctValues(PHRASALS, row => row[1], [answer], 3)],
    correctVal: answer,
    exp: why
  };
}, 4);

/**
 * `the` against no article.
 *
 * a/an already had a generator; the definite article did not, and it is the one
 * Hebrew speakers get wrong most often. Hebrew marks definiteness on the noun
 * itself, so "I like the music" sounds right to an ear trained on
 * "אני אוהב את המוזיקה".
 */
const THE_FRAMES = [
  ['___ sun rises in the east.', 'The', 'דבר יחיד ומוכר בעולם — the.'],
  ['___ book you lent me was excellent.', 'The', 'ספר מסוים שהוזכר — the.'],
  ['She plays ___ piano every evening.', 'the', 'לפני כלי נגינה בא the.'],
  ['I love ___ music.', '—', 'לפני שם עצם מופשט בהוראה כללית אין the.'],
  ['We had ___ breakfast at seven.', '—', 'לפני שמות ארוחות אין the.'],
  ['He went to ___ school by bus.', '—', 'school במשמעות "ללמוד" בא בלי the.'],
  ['___ dogs are loyal animals.', '—', 'כלל על כל בני המין, ברבים — בלי the.'],
  ['They climbed ___ Mount Hermon.', '—', 'לפני שם של הר בודד אין the.']
];

const theArticleGenerator = tag(level => {
  const pool = slice(THE_FRAMES, level);
  const [frame, answer, why] = pool[rand(0, pool.length - 1)];
  return {
    topic: 'ה"א הידיעה באנגלית',
    text: `בחר את המילית הנכונה: ${en(frame)}`,
    options: shuffle([answer, answer === '—' ? 'the' : '—', 'a', 'an']),
    correctVal: answer,
    exp: why
  };
}, 3);

export const englishGenerators = {
  '4':  [vocabGenerator('basic'), articleGenerator, presentSimpleGenerator, pluralGenerator,
         questionWordGenerator],
  '5':  [vocabGenerator('basic'), presentSimpleGenerator, pastTenseGenerator, oppositeGenerator,
         questionWordGenerator, progressiveGenerator(false), ingSpellingGenerator],
  '6':  [vocabGenerator('basic'), pastTenseGenerator, prepositionGenerator, pluralGenerator,
         oppositeGenerator, clozeGenerator, progressiveGenerator(false), futureGenerator,
         ingSpellingGenerator, theArticleGenerator],
  '7':  [vocabGenerator('intermediate'), pastTenseGenerator, prepositionGenerator,
         comparativeGenerator, clozeGenerator, multiSelectGenerator,
         progressiveGenerator(false), progressiveGenerator(true), futureGenerator,
         modalGenerator, quantifierGenerator, theArticleGenerator, ingSpellingGenerator],
  '8':  [vocabGenerator('intermediate'), prepositionGenerator, comparativeGenerator,
         oppositeGenerator, clozeGenerator, multiSelectGenerator, passageGenerator,
         progressiveGenerator(true), futureGenerator, modalGenerator, quantifierGenerator,
         adverbGenerator, theArticleGenerator],
  '9':  [vocabGenerator('intermediate'), prepositionGenerator, pastTenseGenerator,
         comparativeGenerator, clozeGenerator, multiSelectGenerator, passageGenerator,
         progressiveGenerator(true), modalGenerator, presentPerfectGenerator,
         adverbGenerator, quantifierGenerator, phrasalGenerator],
  '10': [vocabGenerator('advanced'), prepositionGenerator, oppositeGenerator,
         clozeGenerator, multiSelectGenerator, passageGenerator,
         presentPerfectGenerator, modalGenerator, adverbGenerator,
         conditionalGenerator, passiveGenerator, phrasalGenerator],
  '11': [vocabGenerator('advanced'), prepositionGenerator, comparativeGenerator,
         clozeGenerator, multiSelectGenerator, passageGenerator,
         presentPerfectGenerator, conditionalGenerator, passiveGenerator,
         adverbGenerator, phrasalGenerator, modalGenerator],
  '12': [vocabGenerator('advanced'), prepositionGenerator, oppositeGenerator,
         clozeGenerator, multiSelectGenerator, passageGenerator,
         presentPerfectGenerator, conditionalGenerator, passiveGenerator,
         phrasalGenerator, adverbGenerator, quantifierGenerator]
};
