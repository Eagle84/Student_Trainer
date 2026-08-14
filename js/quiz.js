/**
 * Quiz assembly and scoring. Subject-agnostic — this module never names a
 * subject; it reads whatever the registry provides.
 *
 * Pure: no DOM, no network, no localStorage. Bank rows are passed in by
 * app.js, which is what keeps this module importable from Node.
 *
 * Internal question shape:
 *   { source: 'bank'|'generated', topic, text, options: string[4], correctIdx, exp }
 */
import { rand, shuffle } from './mathfmt.js';
import { getSubject, isLevelAware, isGradeless, NO_GRADE } from './subjects/index.js';
import { hasTracks } from './levels.js';
import { scoreQuestion, toParts, kindOf, questionKey, questionFingerprint, bankRowKey } from './qtypes.js';
import { diagramFromBank } from './diagrams.js';
import { BANK_RATIO } from './config.js';

const OPTION_COUNT = 4;
// Raised from 15 once dedupe became exact. Generators are pure and cheap, so
// the extra rolls cost nothing measurable, and a bigger budget is what lets a
// small pool (the language subjects) fill a long quiz without repeating.
const DEDUPE_ATTEMPTS = 80;

/**
 * Default difficulty (1 easy, 2 medium, 3 hard) for a question that does not
 * declare its own. Grade is a good proxy: lower grades are easier. A generator
 * or bank row may override this by carrying its own `difficulty`.
 */
export function gradeDifficulty(grade) {
  const g = Number(grade);
  if (g <= 6) return 1;
  if (g <= 9) return 2;
  return 3;
}

/**
 * Produces exactly four distinct options with the correct one's index tracked
 * through the shuffle.
 *
 * The original code shuffled first and then called indexOf(correctVal), which
 * silently mis-marked the answer whenever a distractor collided with the
 * correct value. Tagging before shuffling removes that class of bug; the
 * dedupe removes the "two identical choices" display bug.
 */
export function buildOptions(rawOptions, correctValue) {
  const seen = new Set();
  const unique = [];

  for (const value of rawOptions) {
    const str = String(value);
    if (seen.has(str)) continue;
    seen.add(str);
    unique.push(str);
  }

  const correct = String(correctValue);
  if (!seen.has(correct)) {
    seen.add(correct);
    unique.unshift(correct);
  }

  while (unique.length < OPTION_COUNT) {
    const filler = String(rand(100, 999));
    if (seen.has(filler)) continue;
    seen.add(filler);
    unique.push(filler);
  }

  const four = unique.slice(0, OPTION_COUNT);
  if (!four.includes(correct)) four[OPTION_COUNT - 1] = correct;

  const tagged = four.map(value => ({ value, isCorrect: value === correct }));
  const mixed = shuffle(tagged);

  return {
    options: mixed.map(o => o.value),
    correctIdx: mixed.findIndex(o => o.isCorrect)
  };
}

/** Converts a question_bank row into the internal question shape. */
export function normalizeBankRow(row, subjectId = null, grade = null) {
  const correctValue = row.options[row.correct_index];
  const { options, correctIdx } = buildOptions(row.options, correctValue);
  return {
    source: 'bank',
    // Prefer the row's own columns; fall back to what the caller was asking
    // for, which is what a bank row fetched for one subject already implies.
    subject: row.subject || subjectId,
    grade: row.grade == null ? (grade == null ? null : Number(grade)) : Number(row.grade),
    topic: row.topic,
    text: row.text,
    options,
    correctIdx,
    exp: row.explanation || '',
    difficulty: row.difficulty ?? 2,
    diagram: diagramFromBank(row.topic, row.text)
  };
}

/**
 * Resolves the generator arrays to draw from: the requested grade weighted
 * twice, the previous grade once. Falls back to the subject's lowest defined
 * grade if the requested grade has no generators — never to another subject.
 */
function generatorPool(subjectId, grade, difficulty = null, track = null) {
  const subject = getSubject(subjectId);
  const gens = subject.generators;
  const lowest = String(subject.grades[0]);

  const current = gens[String(grade)] || gens[lowest];
  const previous = gens[String(Number(grade) - 1)] || gens[lowest];

  let pool = [...current, ...current, ...previous];

  // Track gating comes first: it decides which topics the student is taught at
  // all, so it applies whether or not a difficulty was requested. A generator
  // with no minTrack belongs to every track, which makes this a no-op for
  // subjects that never set it.
  if (subject.usesTracks && track != null) {
    const want = Number(track);
    const allowed = pool.filter(fn => !fn.minTrack || fn.minTrack <= want);
    // Weight the student's own track so a 5 יח"ל quiz is not mostly made of
    // the 3 יח"ל foundation they also happen to be taught.
    const specific = allowed.filter(fn => fn.minTrack === want);
    if (allowed.length) pool = [...allowed, ...specific];
  }

  // A level-aware subject scales each generator to the requested level, so
  // every generator can serve every level and there is nothing to filter. The
  // old filter would have been actively wrong here: it compares against
  // gradeDifficulty(grade), which is fixed per grade, so asking for level 5 at
  // grade 5 would have matched nothing and silently fallen back.
  if (difficulty != null && !subject.levelAware) {
    const want = Number(difficulty);
    const matching = pool.filter(fn => (fn.difficulty ?? gradeDifficulty(grade)) === want);
    // Fall back to the full pool if this grade has no generator of that band,
    // so a difficulty filter can never produce an empty quiz.
    if (matching.length) pool = matching;
  }
  return pool;
}

/**
 * Invokes one generator, passing the level only to subjects that understand it.
 * Language generators take no arguments and would ignore it anyway, but being
 * explicit keeps the contract visible at the call site.
 */
function draw(generate, subjectId, difficulty) {
  if (!isLevelAware(subjectId)) return generate();
  if (difficulty != null) return generate(Number(difficulty));
  // "All levels" now genuinely rolls a level instead of calling with none.
  //
  // Two bugs came from passing nothing. byLevel() clamps undefined to the
  // default tier, so an all-levels quiz was entirely level 3 and never mixed.
  // Worse, generators that switch TOPIC on a raw `level >= 3` test saw
  // `undefined >= 3` — always false — so topics that exist only at the higher
  // levels could never be drawn at all. That made
  // "חיבור שברים - מכנים שונים" and "שברים - חילוק" unreachable from every
  // caller that passes no difficulty: the topic drills, the weak-topic chips,
  // and the readiness quiz at the end of a lesson.
  const level = rand(1, 5);
  const data = generate(level);
  // Tag the drawn level so resolveDifficulty records what was actually rolled
  // rather than the grade proxy, which would report every mixed-level question
  // as the same band.
  return data.difficulty == null ? { ...data, difficulty: level } : data;
}

/** The difficulty to record for a generated question. */
function resolveDifficulty(data, generate, subjectId, grade, difficulty) {
  if (isLevelAware(subjectId) && difficulty != null) return Number(difficulty);
  return data.difficulty ?? generate.difficulty ?? gradeDifficulty(grade);
}

/**
 * Turns one generator's output into the internal question shape.
 *
 * A parts-shaped question (cloze, multi-select, passage) already carries its
 * own options per part and passes through untouched: buildOptions exists to
 * shuffle ONE option list and track a single answer, so it cannot express a
 * per-part option set.
 */
function buildGenerated(data, generate, subjectId, grade, difficulty) {
  const shared = {
    source: 'generated',
    // The question's OWN subject and grade. In a single-subject quiz these
    // simply match the quiz; in a mixed one they are the only record of which
    // subject a question — and therefore a mistake — actually belongs to.
    subject: subjectId,
    grade: Number(grade),
    topic: data.topic,
    text: data.text,
    exp: data.exp,
    diagram: data.diagram || null,
    // Answers drawn rather than written. Keyed by option string, so it survives
    // the shuffle in buildOptions untouched.
    optionDiagrams: data.optionDiagrams || null,
    difficulty: resolveDifficulty(data, generate, subjectId, grade, difficulty)
  };
  if (data.parts) {
    return { ...shared, kind: kindOf(data), passage: data.passage, parts: data.parts };
  }
  const { options, correctIdx } = buildOptions(data.options, data.correctVal);
  return { ...shared, options, correctIdx };
}

/** Draws `count` questions from a subject's generators, optionally filtered to
 *  a difficulty band. */
export function generateQuestions(subjectId, grade, count, difficulty = null, track = null, seen = null, recent = null) {
  const pool = generatorPool(subjectId, grade, difficulty, track);
  const out = [];
  // Seeded by the caller with the keys of any bank questions already chosen,
  // so a generated question cannot repeat one the student is about to see.
  const used = seen instanceof Set ? seen : new Set();
  // Fingerprints of questions served in EARLIER quizzes this sitting. Unlike
  // `used`, this one is advisory: see the fallback below.
  const avoid = recent instanceof Set ? recent : new Set();

  for (let i = 0; i < count; i++) {
    // Each retry re-rolls the GENERATOR as well as its parameters. Retrying the
    // same generator only helps while that one generator can still produce
    // something new; once its own space is used up, the only way out is a
    // different topic. The language subjects have small word lists, so this is
    // the difference between a clean quiz and a visibly repetitive one.
    //
    // The candidate is BUILT before its key is taken. Keying the raw generator
    // output instead was a silent bug: a legacy generator returns correctVal,
    // not correctIdx, so toParts() defaulted `correct` to 0 and the key was
    // computed from whichever option happened to be first. Every legacy
    // question — all of maths — was therefore deduped on the wrong value.
    let question = null;
    let staleButUsable = null;
    for (let attempts = 0; attempts < DEDUPE_ATTEMPTS; attempts++) {
      const generate = pool[rand(0, pool.length - 1)];
      const data = draw(generate, subjectId, difficulty);
      const candidate = buildGenerated(data, generate, subjectId, grade, difficulty);
      // Never twice in one quiz. This is the hard rule and it uses the exact key.
      if (used.has(questionKey(candidate))) continue;
      // Not seen in an earlier quiz either: take it.
      if (!avoid.has(questionFingerprint(candidate))) { question = candidate; break; }
      // Seen recently. Keep the first one as a fallback, and go on looking.
      if (!staleButUsable) staleButUsable = candidate;
    }

    // Prefer something the student has not just seen; accept something they have
    // rather than cut the quiz short.
    //
    // These pools are finite — מטלת הכתיבה repeated 65% of its questions across
    // four quizzes, so ruling out everything recent would have left a quiz of
    // seven where twenty were asked. A repeat after a hundred other questions is
    // a much smaller problem than a quiz that quietly shrinks.
    if (!question) question = staleButUsable;

    // The pool is finite. English and Hebrew draw on word lists a few hundred
    // items long, so a long quiz can genuinely exhaust what they can produce.
    // Returning a shorter quiz is better than showing the same question twice:
    // callers size everything off questions.length, so a short quiz is
    // coherent, whereas a repeat is the bug this whole path exists to prevent.
    if (!question) break;

    used.add(questionKey(question));
    out.push(question);
  }

  return out;
}

/**
 * Mixes hand-authored bank questions with generated ones. Bank rows are capped
 * at BANK_RATIO of the quiz, or the whole bank if smaller. An empty bank
 * degrades cleanly to a fully generated quiz.
 */
/** Bank rows a student on this track is taught. See fetchBankQuestions. */
function bankForTrack(bankRows, track) {
  if (track == null) return bankRows;
  return bankRows.filter(r => r.track == null || Number(r.track) <= Number(track));
}

/**
 * Drops bank rows that repeat one already kept.
 *
 * The bank has no unique constraint on question content, and the seed script
 * has been run more than once, so the same question can genuinely be stored
 * twice. Without this, a quiz can show a student the same question twice from
 * the bank alone.
 */
function dedupeBank(bankRows) {
  const seen = new Set();
  return bankRows.filter(row => {
    const key = bankRowKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Rows the student has not been served recently, first; the rest after.
 *
 * A stable partition rather than a filter, so the bank still fills its share of
 * the quiz once every row has been seen.
 */
function preferUnseen(rows, recent, toQuestion) {
  if (!(recent instanceof Set) || recent.size === 0) return rows;
  const fresh = [];
  const stale = [];
  for (const row of rows) {
    (recent.has(questionFingerprint(toQuestion(row))) ? stale : fresh).push(row);
  }
  return [...fresh, ...stale];
}

export function assembleQuiz(bankRows, subjectId, grade, count, difficulty = null, track = null, recent = null) {
  const eligible = bankForTrack(bankRows, track);
  const filtered = difficulty == null
    ? eligible
    : eligible.filter(r => Number(r.difficulty) === Number(difficulty));
  const usableBank = dedupeBank(filtered);

  const bankTarget = Math.min(Math.floor(count * BANK_RATIO), usableBank.length);
  // Bank rows are drawn recent-last, so a second quiz in one sitting reaches for
  // the ones it has not shown yet before falling back. There are only ever a few
  // dozen of them, which is why this sorts rather than filters — filtering could
  // empty the bank half of the quiz entirely.
  const bankQuestions = preferUnseen(shuffle(usableBank), recent, normalizeBankRow)
    .slice(0, bankTarget).map(r => normalizeBankRow(r, subjectId, grade));

  // Seed the generator's dedupe with what the bank already contributed, so a
  // generated question cannot repeat one the student is about to be shown.
  const seen = new Set(bankQuestions.map(questionKey));
  const generated = generateQuestions(
    subjectId, grade, count - bankTarget, difficulty, track, seen, recent);
  return shuffle([...bankQuestions, ...generated]);
}

/**
 * Assembles one quiz spanning several subjects.
 *
 * `plan` is [{ subjectId, grade, bankRows, recent }] — one entry per chosen
 * subject, each already carrying the bank rows and recent-question window for
 * ITS OWN scope. Built by the caller because those are network reads, and this
 * module does no I/O.
 *
 * The count is split as evenly as the subjects divide it, with the remainder
 * going to the earliest subjects rather than being dropped. A subject whose
 * pool comes up short does not steal from the others' shares — the quiz simply
 * runs shorter, which is honest about there being nothing more to ask.
 *
 * Every question is already tagged with its own subject by buildGenerated, so
 * the shuffle at the end can interleave them freely without losing track of
 * where each came from.
 */
export function assembleMixed(plan, count, difficulty = null, track = null) {
  const entries = (plan || []).filter(p => p && p.subjectId);
  if (entries.length === 0) return [];

  const base = Math.floor(count / entries.length);
  const remainder = count % entries.length;

  const out = [];
  // Shared across subjects: two subjects can produce the same question text —
  // "מהי המילה ההפוכה..." exists in both עברית and אנגלית — and a student
  // should not meet it twice in one quiz just because it came from two pools.
  const seen = new Set();

  entries.forEach((entry, i) => {
    const share = base + (i < remainder ? 1 : 0);
    if (share <= 0) return;
    const questions = assembleQuiz(
      entry.bankRows || [], entry.subjectId, entry.grade, share,
      difficulty, entry.track ?? track, entry.recent);
    for (const q of questions) {
      const key = questionKey(q);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(q);
    }
  });

  return shuffle(out);
}

/**
 * Generates `count` questions restricted to the given topics — used by the
 * end-of-quiz reinforcement flow to drill the topics a student got wrong.
 * If the requested topics cannot fill the quiz (e.g. a bank-only topic), it
 * tops up with any question so the reinforcement set is never short.
 */
export function generateByTopics(subjectId, grade, topics, count, difficulty = null, track = null, seen = null, recent = null) {
  const wanted = new Set(topics);
  const pool = generatorPool(subjectId, grade, difficulty, track);
  const out = [];
  const usedTexts = seen instanceof Set ? seen : new Set();
  const avoid = recent instanceof Set ? recent : new Set();
  const maxAttempts = count * 80;
  let attempts = 0;

  // A drill is restricted to a handful of topics, so its pool is far smaller
  // than a whole quiz's and it exhausts sooner. Held aside on the first pass and
  // used only if the topics cannot fill the drill without them — a student who
  // asked to practise one topic would rather see a question again than get four
  // questions when they asked for ten.
  const held = [];

  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    const generate = pool[rand(0, pool.length - 1)];
    const data = draw(generate, subjectId, difficulty);
    if (!wanted.has(data.topic)) continue;
    // Built before keyed, for the same reason as generateQuestions.
    const candidate = buildGenerated(data, generate, subjectId, grade, difficulty);
    if (usedTexts.has(questionKey(candidate))) continue;
    usedTexts.add(questionKey(candidate));
    if (avoid.has(questionFingerprint(candidate))) { held.push(candidate); continue; }
    out.push(candidate);
  }

  while (out.length < count && held.length) out.push(held.shift());

  // Deliberately NOT topped up with other topics.
  //
  // It used to be, so that a drill always ran to its full length. The result
  // was worse than a short drill: asking to practise a topic the generators
  // cannot produce at that grade returned ten questions on unrelated topics,
  // with nothing to say so. The student drilled, got questions about something
  // else, and the topic they were trying to fix stayed on their weak list —
  // which is exactly the complaint this fixes. Worse, mistakes on the filler
  // questions added NEW weak topics they had never asked to practise.
  //
  // Returning what the topic can actually produce lets the caller say
  // something honest when that is nothing.
  return shuffle(out).slice(0, count);
}

/** Builds a reinforcement quiz from bank rows and generators, both restricted
 *  to the given (missed) topics. */
export function assembleReinforcement(bankRows, subjectId, grade, topics, count, difficulty = null, track = null, recent = null) {
  const wanted = new Set(topics);
  const usableBank = dedupeBank(bankForTrack(bankRows, track).filter(r =>
    wanted.has(r.topic) && (difficulty == null || Number(r.difficulty) === Number(difficulty))));
  const bankTarget = Math.min(Math.floor(count * BANK_RATIO), usableBank.length);
  const bankQuestions = preferUnseen(shuffle(usableBank), recent, normalizeBankRow)
    .slice(0, bankTarget).map(r => normalizeBankRow(r, subjectId, grade));
  const seen = new Set(bankQuestions.map(questionKey));
  const generated = generateByTopics(
    subjectId, grade, topics, count - bankTarget, difficulty, track, seen, recent);
  return shuffle([...bankQuestions, ...generated]);
}

// --- state machine ----------------------------------------------------
// Every transition returns a new state object. Nothing mutates in place.

export function createQuiz(questions, studentName, subjectId, grade, difficulty = null, track = null) {
  return {
    questions,
    studentName,
    subject: subjectId,
    // A gradeless subject records NO_GRADE whatever it was handed.
    //
    // Otherwise a stale grade perpetuates itself: פסיכומטרי was once
    // declared for grades 10-12, so its old error rows carry grade 12; a
    // weak-topic chip drills at the grade it was missed at, and the attempt
    // that produced recorded grade 12 again. Six weeks of history read
    // "פסיכומטרי · כיתה י\"ב" for a subject that belongs to no year.
    grade: isGradeless(subjectId) ? NO_GRADE : Number(grade),
    difficulty: difficulty == null ? null : Number(difficulty),
    // Null for grades below 10, so a stored attempt distinguishes "3 יח\"ל"
    // from "this grade has no track".
    track: hasTracks(grade) && track != null ? Number(track) : null,
    index: 0,
    score: 0,
    errors: [],
    answered: false,
    startedAt: Date.now()
  };
}

export function currentQuestion(state) {
  return state.questions[state.index];
}

export function isFinished(state) {
  return state.index >= state.questions.length;
}

/** Questions the student has actually resolved — drives the progress bar. */
export function answeredCount(state) {
  return state.index + (state.answered ? 1 : 0);
}

/** Renders one part's selection as readable text for the error log. */
function describe(part, chosen) {
  const picks = (Array.isArray(chosen) ? chosen : [chosen])
    .filter(i => Number.isInteger(i) && i >= 0 && i < part.options.length);
  return picks.length ? picks.map(i => part.options[i]).join(', ') : '—';
}

/** The correct answer to one part, as readable text. */
function describeCorrect(part) {
  const correct = Array.isArray(part.correct) ? part.correct : [part.correct];
  return correct.map(i => part.options[i]).join(', ');
}

/**
 * Records an answer and adds its mark.
 *
 * `answers` is one selection per part: a number for a single choice, an array
 * for choose-all-that-apply. A bare number is accepted for the single-part
 * questions that make up almost the whole bank, so existing callers and the
 * maths generators need no changes.
 *
 * The mark is fractional — see scoreQuestion. A question is logged as an error
 * unless it was answered perfectly, because a partially right answer is still
 * something worth reviewing.
 */
export function answerQuestion(state, answers) {
  if (state.answered || isFinished(state)) return state;

  const q = currentQuestion(state);
  const parts = toParts(q);
  const given = Array.isArray(answers) && parts.length === 1 && !Array.isArray(parts[0].correct)
    ? [answers[0] ?? answers]
    : (Array.isArray(answers) ? answers : [answers]);

  const mark = scoreQuestion({ parts }, given);

  const errors = mark === 1
    ? state.errors
    : [...state.errors, {
        topic: q.topic,
        // Falls back to the quiz's own subject for anything built before
        // questions were tagged — a resumed quiz saved by an older build.
        subject: q.subject || state.subject,
        grade: q.grade == null ? state.grade : q.grade,
        question_text: q.text,
        correct_answer: parts.map(describeCorrect).join(' | '),
        chosen_answer: parts.map((p, i) => describe(p, given[i])).join(' | '),
        explanation: q.exp
      }];

  return { ...state, answered: true, score: state.score + mark, errors };
}

export function nextQuestion(state) {
  return { ...state, index: state.index + 1, answered: false };
}

/** Shapes the state into a row for the `attempts` table. */
export function getResult(state) {
  const total = state.questions.length;
  // Partial credit makes the running score fractional, so it is rounded to two
  // decimals for storage. attempts.score must be numeric, not int: an int
  // column would silently truncate 7.67 to 7 and lose two thirds of a mark.
  const score = Math.round(state.score * 100) / 100;
  const percent = total === 0 ? 0 : Math.round((score / total) * 10000) / 100;
  return {
    student_name: state.studentName,
    subject: state.subject,
    grade: state.grade,
    difficulty: state.difficulty,
    total_questions: total,
    score,
    percent,
    duration_seconds: Math.max(0, Math.round((Date.now() - state.startedAt) / 1000))
  };
}

/**
 * What an attempt's score becomes after a reinforcement drill on its errors.
 *
 * A drill re-tests the topics one attempt got wrong, so it earns back a SHARE
 * of what that attempt lost: 90% on the drill recovers 90% of the lost points.
 *
 * Proportional rather than a point per correct answer, because a drill's
 * questions are drawn from the missed TOPICS, not replays of the exact
 * questions missed — even a drill sized to match the error count can land
 * easier or harder questions than the ones it is standing in for, so crediting
 * per answer would let a lucky drill overpay and an unlucky one underpay.
 *
 * The score can only rise, and never past the total: a drill recovers ground
 * already lost, it does not earn new marks.
 */
export function creditedAttempt(score, total, fraction) {
  const t = Number(total);
  const s = Math.min(Math.max(Number(score), 0), t);
  const share = Math.min(Math.max(Number(fraction) || 0, 0), 1);
  const recovered = (t - s) * share;
  // Two decimals, for the same reason getResult rounds: attempts.score is
  // numeric(6,2) and partial credit already makes the score fractional.
  const credited = Math.min(t, Math.round((s + recovered) * 100) / 100);
  return {
    score: credited,
    percent: t === 0 ? 0 : Math.round((credited / t) * 10000) / 100
  };
}

/** Shapes the errors into rows for the `attempt_errors` table. */
export function getErrorRows(state) {
  return state.errors.map(e => ({ ...e }));
}

/**
 * What this attempt says about each topic it actually assessed.
 *
 * Returns [{ topic, asked, missed }] for every topic the attempt covered at
 * least `min` times. This is the only place the app learns anything POSITIVE:
 * everything else it stores is a record of mistakes, which is why a weak topic
 * used to be impossible to shift — there was no event that meant "I have just
 * been tested on this, here is how it went".
 *
 * `min` guards against one lucky answer in a broad quiz speaking for a topic.
 * A drill is ten questions on one topic, so it always qualifies.
 */
export function topicsAssessed(state, min = 2) {
  const asked = new Map();
  for (let i = 0; i < state.index && i < state.questions.length; i++) {
    const topic = state.questions[i].topic;
    if (topic) asked.set(topic, (asked.get(topic) || 0) + 1);
  }
  const missed = new Map();
  for (const e of state.errors) missed.set(e.topic, (missed.get(e.topic) || 0) + 1);

  return [...asked.entries()]
    .filter(([, count]) => count >= min)
    .map(([topic, count]) => ({ topic, asked: count, missed: missed.get(topic) || 0 }));
}

/** Topics assessed with no mistake at all. */
export function topicsMastered(state, min = 2) {
  return topicsAssessed(state, min).filter(t => t.missed === 0).map(t => t.topic);
}
