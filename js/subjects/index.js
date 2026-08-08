/**
 * The subject registry — the single extension point for new subjects.
 *
 * To add a subject: write js/subjects/<id>.js exporting a generators object
 * keyed by grade string, import it here, and add one entry below. Nothing in
 * quiz.js, db.js, ui.js, or sql/schema.sql needs to change.
 *
 * Entry shape:
 *   id         must equal the object key; stored in the database
 *   name       Hebrew display name shown in the picker
 *   dir        'rtl' | 'ltr' — direction of the question PROSE
 *   optionsDir 'rtl' | 'ltr' — direction of the ANSWER LIST
 *   generators object keyed by grade string -> array of generator functions
 *   grades     grades this subject offers, ascending
 *
 * dir and optionsDir are separate because they genuinely differ. Math
 * questions are worded in Hebrew (RTL prose) but answered in mathematical
 * notation, which reads left-to-right in every language. Putting an answer
 * like "x1=3, x2=-2" in an RTL list makes the bidi algorithm relocate the
 * comma and the minus sign, so the student sees an expression that is not the
 * one being scored. A future Physics or Chemistry subject gets correct
 * rendering just by declaring optionsDir: 'ltr'.
 */
import { mathGenerators } from './math.js';
import { englishGenerators } from './english.js';
import { hebrewGenerators } from './hebrew.js';
import { psychometricGenerators } from './psychometric.js';
import { psychotechnicalGenerators } from './psychotechnical.js';
import { reliabilityGenerators } from './reliability.js';
import { writingGenerators } from './writing.js';
import { scienceGenerators } from './science.js';
import { codingGenerators } from './coding.js';

const ALL_GRADES = [4, 5, 6, 7, 8, 9, 10, 11, 12];
/**
 * Math starts at grade 1; the language subjects do not.
 *
 * This is the first time the three subjects genuinely differ in the grades they
 * offer, which is what subjectsForGrade() exists for — a first-grader is shown
 * only מתמטיקה, because English and Hebrew have no generators that low and
 * would otherwise present an empty catalogue.
 */
const MATH_GRADES = [1, 2, 3, ...ALL_GRADES];

/**
 * Pseudo-grade for subjects that are not taught by year.
 *
 * The whole app keys questions, lessons and lesson_progress by grade, so a
 * gradeless subject still needs one value to store — but it must never appear
 * in a grade picker, and it must not be reachable only from grades 10-12, which
 * is where the psychometric subject was hiding when it was declared that way.
 * Subjects marked `gradeless` are offered at EVERY grade instead.
 */
export const NO_GRADE = 13;

export const SUBJECTS = {
  math: {
    id: 'math',
    name: 'מתמטיקה',
    dir: 'rtl',          // Hebrew wording
    optionsDir: 'ltr',   // answers are mathematical notation
    generators: mathGenerators,
    grades: MATH_GRADES,
    // Math generators take a difficulty level and scale themselves within their
    // topic, so a level is passed through to them rather than being used to
    // pick between whole generators. The language subjects are not yet
    // level-aware: their generators ignore the argument, so quiz.js keeps
    // selecting among them by grade the way it always has.
    levelAware: true,
    // Grades 10-12 split into 3/4/5 יח"ל, which changes which topics exist
    // rather than how hard they are. No language subject has such an axis.
    usesTracks: true
  },
  science: {
    id: 'science',
    name: 'מדעים',
    dir: 'rtl',
    // Answers are Hebrew words — "מוצק", "מדבר" — never notation, so they read
    // RTL like the question. This is the one place science differs from maths,
    // whose options are expressions and must be pinned LTR.
    optionsDir: 'rtl',
    generators: scienceGenerators,
    // Grades 1-6, which is the range the supplied מפרט תכנים covers. Not
    // declared beyond it: the app would then offer a grade the curriculum
    // documents say nothing about, and the generators would silently serve
    // grade-2 content to a seventh-grader.
    grades: [1, 2, 3, 4, 5, 6],
    // The generators classify rather than compute, so there is no difficulty
    // axis to scale within a topic — "is a dog alive" is not harder at level 4.
    // Difficulty comes from which topics a grade offers, as with the language
    // subjects.
    levelAware: false,
    usesTracks: false
  },
  coding: {
    id: 'coding',
    name: 'תכנות',
    dir: 'rtl',
    // Options are a mix: bare numbers at the lower grades, code snippets higher
    // up. 'auto' would resolve a bare "12" against the RTL page and relocate a
    // minus sign, so this is pinned RTL and every snippet carries its own LTR
    // isolate from code() in the generators.
    optionsDir: 'rtl',
    generators: codingGenerators,
    // All twelve years, but this is three different subjects across them: no
    // syntax at 1-3, pseudo-code at 4-6, real syntax from 7. That split lives
    // in the generator pools rather than in a difficulty level, because it
    // changes WHAT is asked and not how hard it is.
    grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    levelAware: false,
    usesTracks: false
  },
  english: {
    id: 'english',
    name: 'אנגלית',
    // 'auto' resolves direction from the first strong directional character,
    // per element. English lessons mix scripts freely: "מה פירוש המילה dog?"
    // is Hebrew-led and must read RTL, while "She rarely eats breakfast." is
    // English-led and must read LTR. Pinning either way gets one of them wrong.
    //
    // 'auto' is safe here only because every English option contains real
    // letters. Never use it for math — a bare option like "16" or "x = 5" has
    // no strong directional character, so 'auto' would fall back to the page's
    // RTL and relocate the operators.
    dir: 'auto',
    optionsDir: 'auto',
    generators: englishGenerators,
    grades: ALL_GRADES,
    // Generators scale with the requested level; see the header of this
    // subject's module for what each level changes.
    levelAware: true
  },
  hebrew: {
    id: 'hebrew',
    name: 'עברית',
    dir: 'rtl',
    optionsDir: 'rtl',
    generators: hebrewGenerators,
    grades: ALL_GRADES,
    // Generators scale with the requested level; see the header of this
    // subject's module for what each level changes.
    levelAware: true
  },
  psychometric: {
    id: 'psychometric',
    name: 'פסיכומטרי',
    // Hebrew wording throughout; answers are a mix of Hebrew phrases, English
    // sentences and bare numbers, so direction is resolved per option.
    dir: 'rtl',
    optionsDir: 'auto',
    generators: psychometricGenerators,
    // Not a school syllabus and not tied to a year: one pool, always available.
    grades: [NO_GRADE],
    gradeless: true,
    // Generators scale with the requested level; see the header of this
    // subject's module for what each level changes.
    levelAware: true
  },
  psychotechnical: {
    id: 'psychotechnical',
    name: 'פסיכוטכני',
    dir: 'rtl',
    // Options are Hebrew phrases, bare numbers and figure labels, so direction
    // is resolved per option.
    optionsDir: 'auto',
    generators: psychotechnicalGenerators,
    grades: [NO_GRADE],
    gradeless: true,
    levelAware: true
  },
  reliability: {
    id: 'reliability',
    name: 'מבחני אמינות',
    dir: 'rtl',
    optionsDir: 'rtl',
    generators: reliabilityGenerators,
    grades: [NO_GRADE],
    gradeless: true,
    levelAware: true
  },
  writing: {
    id: 'writing',
    name: 'מטלת הכתיבה',
    dir: 'rtl',
    optionsDir: 'rtl',
    generators: writingGenerators,
    grades: [NO_GRADE],
    gradeless: true,
    levelAware: true
  }
};

export const DEFAULT_SUBJECT = 'math';

/** Registry keys, in declaration order. */
export function subjectIds() {
  return Object.keys(SUBJECTS);
}

/** A registry entry, falling back to the default for an unknown id. */
export function getSubject(id) {
  return SUBJECTS[id] || SUBJECTS[DEFAULT_SUBJECT];
}

/** Grades a subject offers. Unknown ids fall back to the default subject. */
export function gradesFor(id) {
  return getSubject(id).grades;
}

/** True if this subject is not taught by year — see NO_GRADE. */
export function isGradeless(id) {
  return Boolean(getSubject(id).gradeless);
}

/** Subjects that are not tied to a school year, in registry order. */
export function gradelessSubjects() {
  return subjectIds().filter(isGradeless);
}

/**
 * Every school grade, ascending — the union across grade-based subjects only.
 * A gradeless subject's pseudo-grade must never reach a grade picker.
 */
export function allGrades() {
  const grades = new Set();
  for (const id of subjectIds()) {
    if (isGradeless(id)) continue;
    for (const g of SUBJECTS[id].grades) grades.add(g);
  }
  return [...grades].sort((a, b) => a - b);
}

/**
 * Subject ids that teach a given grade, in registry order.
 *
 * The study flow picks a grade first and a subject second, so it needs the
 * inverse of gradesFor. All three launch subjects cover 4-12, which makes this
 * a no-op today — but a subject added later for the upper grades only would
 * otherwise be offered to a fourth-grader with an empty topic list behind it.
 */
export function subjectsForGrade(grade) {
  const g = Number(grade);
  // Gradeless subjects are excluded on purpose: they are reached from their own
  // card, not by picking a school year. Listing them under every grade would
  // imply a fourth-grader should sit the psychometric exam.
  return subjectIds().filter(id => !isGradeless(id) && SUBJECTS[id].grades.includes(g));
}

/** True if this subject's generators accept a difficulty level argument. */
export function isLevelAware(id) {
  return Boolean(getSubject(id).levelAware);
}

/** True if this subject splits its upper grades by יחידות לימוד. */
export function usesTracks(id) {
  return Boolean(getSubject(id).usesTracks);
}

/**
 * Levels probed by topicsFor, and how many draws at each.
 *
 * Three levels because some generators change their TOPIC with the level rather
 * than just their numbers: the grade-5 fractions generator reports
 * 'חיבור שברים פשוטים' at levels 1-2 and 'חיבור שברים - מכנים שונים' at 3+.
 *
 * Several draws per level because some generators pick their topic at random —
 * the English multi-select generator chooses between three of them. A single
 * draw would make the catalogue list a different set of topics on every visit.
 * Generators are pure and take microseconds, so the extra rolls cost nothing.
 */
const TOPIC_PROBE_LEVELS = [1, 3, 5];
const TOPIC_PROBE_ROUNDS = 24;

/**
 * Every topic a subject can actually SERVE at one grade, in a stable order.
 *
 * Topic strings are not declared anywhere — they live inside the object each
 * generator returns. Rather than keep a hand-written list in sync with the
 * generators (which would drift the first time a topic is renamed), this runs
 * each generator and reads the topic back.
 *
 * Parts-shaped draws (cloze, multi-select, passage) are included: quiz.js
 * renders them as one option group per blank with an explicit submit, so a
 * topic reachable only through a parts generator is genuinely quizzable.
 *
 * Track gating matches generatorPool: a generator with no minTrack belongs to
 * every track, so this is a no-op for subjects that never set it.
 */
export function topicsFor(id, grade, track = null) {
  const subject = getSubject(id);
  const gens = subject.generators[String(grade)] || [];
  const want = track == null ? null : Number(track);

  const topics = [];
  const seen = new Set();
  for (const generate of gens) {
    if (subject.usesTracks && want != null && generate.minTrack && generate.minTrack > want) continue;
    for (const level of TOPIC_PROBE_LEVELS) {
      for (let round = 0; round < TOPIC_PROBE_ROUNDS; round++) {
        let data;
        try {
          data = subject.levelAware ? generate(level) : generate();
        } catch {
          // A generator that throws contributes no topic rather than emptying
          // the whole catalogue for that grade.
          break;
        }
        if (!data || !data.topic || seen.has(data.topic)) continue;
        seen.add(data.topic);
        topics.push(data.topic);
      }
    }
  }
  return topics;
}
