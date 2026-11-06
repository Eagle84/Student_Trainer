/**
 * Question shapes and scoring.
 *
 * Until now every question was one prompt, four options, one right answer. Exam
 * formats need more, so a question is modelled as a list of PARTS:
 *
 *   part = { prompt?: string, options: string[], correct: number | number[] }
 *
 * A part whose `correct` is a number is a single choice; an array means "choose
 * all that apply". That one shape covers every format:
 *
 *   single   one part, numeric correct           (every existing question)
 *   multi    one part, array correct             ("choose all that apply")
 *   cloze    N parts, each a blank in one sentence
 *   passage  N parts, plus a `passage` string shown above them
 *
 * `kind` is a rendering hint only — scoring reads the parts, never the kind, so
 * a malformed or unknown kind cannot change a student's mark.
 *
 * Pure: no DOM, no network. Safe to import from Node.
 */

export const KINDS = ['single', 'multi', 'cloze', 'passage'];
export const DEFAULT_KIND = 'single';

/** Normalises `correct` to an array, whichever form it was written in. */
export function correctSet(part) {
  const c = part.correct;
  const list = Array.isArray(c) ? c : [c];
  return new Set(list.map(Number).filter(Number.isInteger));
}

/** True if this part asks the student to pick more than one option. */
export function isMultiPart(part) {
  return Array.isArray(part.correct);
}

/**
 * Scores one part in [0, 1].
 *
 * Single choice is all-or-nothing because there is nothing to be partially
 * right about. Multi-select credits each correct pick as a fraction of the
 * correct options and debits each wrong pick as a fraction of the wrong ones:
 *
 *   hits / |correct| - misses / |incorrect|, clamped to [0, 1]
 *
 * Both terms are normalised against their own pool, and that is the point:
 * ticking every option then scores exactly 0 (1 - 1) rather than partial
 * marks. Debiting against |correct| instead would leave "select everything"
 * worth a third of the marks on a 3-of-5 question, which rewards a strategy
 * that demonstrates no knowledge at all.
 */
export function scorePart(part, chosen) {
  const correct = correctSet(part);
  const picked = new Set((Array.isArray(chosen) ? chosen : [chosen])
    .map(Number).filter(Number.isInteger));

  if (correct.size === 0) return 0;

  if (!isMultiPart(part)) {
    const only = [...correct][0];
    return picked.size === 1 && picked.has(only) ? 1 : 0;
  }

  let hits = 0;
  let misses = 0;
  for (const p of picked) (correct.has(p) ? hits++ : misses++);

  // When every option is correct there is nothing to debit against, so the
  // penalty term drops out rather than dividing by zero.
  const incorrectCount = Math.max(0, (part.options || []).length - correct.size);
  const penalty = incorrectCount === 0 ? 0 : misses / incorrectCount;
  return Math.max(0, Math.min(1, hits / correct.size - penalty));
}

/**
 * Scores a whole question in [0, 1] — the mean of its parts.
 *
 * Every question is worth exactly one mark regardless of how many parts it
 * has, so `total_questions` keeps meaning "how many questions were asked" and
 * a four-blank cloze cannot outweigh four single questions.
 */
export function scoreQuestion(question, answers) {
  const parts = question.parts || [];
  if (parts.length === 0) return 0;
  const given = Array.isArray(answers) ? answers : [answers];
  const sum = parts.reduce((acc, part, i) => acc + scorePart(part, given[i] ?? []), 0);
  return sum / parts.length;
}

/** True if the student got every part completely right. */
export function isFullyCorrect(question, answers) {
  return scoreQuestion(question, answers) === 1;
}

/** True once every part has an answer recorded, so the question can be graded. */
export function isAnswerComplete(question, answers) {
  const parts = question.parts || [];
  const given = Array.isArray(answers) ? answers : [];
  return parts.every((part, i) => {
    const a = given[i];
    if (a == null) return false;
    // A multi-select part with nothing ticked is not an answer, it is an
    // unanswered question. Grading it as 0 would punish a student who simply
    // had not finished reading.
    return Array.isArray(a) ? a.length > 0 : true;
  });
}

/**
 * Wraps a legacy single-answer question in the parts shape.
 *
 * Both the bank rows and the maths generators still produce
 * { options, correctIdx }, and there is no reason to rewrite thousands of rows
 * to gain a format they do not use.
 */
export function toParts(question) {
  if (Array.isArray(question.parts) && question.parts.length) return question.parts;
  return [{ options: question.options || [], correct: question.correctIdx ?? 0 }];
}

/** The kind of a question, defaulting safely for anything unrecognised. */
export function kindOf(question) {
  return KINDS.includes(question.kind) ? question.kind : DEFAULT_KIND;
}

/**
 * Identity of one part: the VALUES of its correct answers, sorted.
 *
 * Deliberately excludes the distractors. "What is the root of מברשת?" is the
 * same question whichever three wrong roots are offered alongside it, and a
 * student shown it twice in one quiz sees a repeat. Keying on the full option
 * list would treat those two draws as distinct and let the repeat through.
 *
 * Sorted values rather than indices, because the options are shuffled on every
 * draw — an index-based key would not survive the shuffle.
 */
function partKey(part) {
  const options = part.options || [];
  const indices = Array.isArray(part.correct) ? part.correct : [part.correct];
  return indices
    .filter(i => Number.isInteger(i) && i >= 0 && i < options.length)
    .map(i => String(options[i]))
    .sort();
}

/**
 * A stable identity for a question, for deduplication.
 *
 * Keyed on option and answer VALUES rather than positions, because the options
 * are shuffled on every draw — keying on `correctIdx` would make two draws of
 * the same question look different and defeat the dedupe entirely.
 *
 * The prompt text alone is not enough either: every multi-select question
 * shares one constant prompt ("choose all the correct plurals") and differs
 * only in the words offered, so text-only keys both merge distinct questions
 * and let real duplicates through.
 */
export function questionKey(question) {
  const parts = toParts(question).map(partKey);
  return JSON.stringify([question.text ?? '', question.passage ?? '', parts]);
}

/**
 * A SHORT identity for a question, for remembering it across quizzes.
 *
 * questionKey is the exact identity and is what stops a question appearing twice
 * inside one quiz. It is also long — a JSON array of every option — and a
 * session's worth of them does not belong in localStorage. This is a 32-bit hash
 * of it, about seven characters, so a few hundred fit comfortably.
 *
 * A collision would make the app needlessly avoid one unrelated question, which
 * is why a hash is acceptable here and not for the within-quiz check. At a few
 * hundred remembered questions the chance is around one in fifty thousand.
 */
export function questionFingerprint(question) {
  const key = questionKey(question);
  // FNV-1a. Chosen because it is four lines, has no dependencies, and spreads
  // the small textual differences between two draws of the same generator.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** The same identity, computed from a raw question_bank row. */
export function bankRowKey(row) {
  return questionKey({
    text: row.text,
    passage: row.passage,
    options: row.options || [],
    correctIdx: row.correct_index ?? 0
  });
}
