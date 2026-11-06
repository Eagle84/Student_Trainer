/**
 * משחקים — the timed modes.
 *
 * A pure state machine, like js/quiz.js and js/lesson.js: no DOM, no clock, no
 * network. The clock lives in the UI and drives this by handing it elapsed
 * milliseconds, which is what keeps the scoring rules testable to the
 * millisecond instead of only observable by playing.
 *
 * Why games are not just fast quizzes. A quiz is deliberately untimed — a
 * student can think, and nothing punishes them for it. These measure something
 * else, and each measures a different thing:
 *
 *   ספרינט    volume under a total clock — is the answer FLUENT?
 *   דיוק      one mistake ends the run — can you be careful at speed?
 *   טיפוס     the level rises with every correct answer — where is the ceiling?
 *   בזק       a fixed twenty questions — the same workload for everyone
 *   הישרדות   the clock shrinks as you go — where do you break?
 *
 * Separate modes rather than one with settings, because each asks a genuinely
 * different question and rewards different play. A single "hard mode" toggle
 * would have flattened them into the same game.
 */

/** Sixty seconds: long enough to find a rhythm, short enough to retry. */
export const SPRINT_MS = 60000;

/**
 * What a wrong answer costs in ספרינט, in milliseconds off the clock.
 *
 * Four options mean guessing pays 25% for free, so without a cost the top of
 * every board would be whoever tapped fastest rather than whoever knew most.
 * Time rather than points, deliberately: it punishes the guess immediately and
 * keeps the pressure where the mode puts it, without making a bad start feel
 * like a run not worth finishing.
 */
export const WRONG_PENALTY_MS = 3000;

/** The lowest and highest level טיפוס can reach. */
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

/**
 * The rules of each mode, in one place.
 *
 * `perQuestionMs` means the clock restarts every question rather than running
 * for the whole game — that is what makes דיוק and טיפוס about deciding
 * quickly rather than about total volume.
 */
export const MODES = {
  sprint: {
    id: 'sprint',
    label: 'ספרינט',
    blurb: '60 שניות — כמה תספיק?',
    totalMs: SPRINT_MS,
    perQuestionMs: null,
    lives: Infinity,
    wrongPenaltyMs: WRONG_PENALTY_MS,
    climbs: false
  },
  accuracy: {
    id: 'accuracy',
    label: 'דיוק',
    blurb: 'טעות אחת והמשחק נגמר — 15 שניות לשאלה',
    totalMs: null,
    perQuestionMs: 15000,
    lives: 1,
    wrongPenaltyMs: 0,
    climbs: false
  },
  climb: {
    id: 'climb',
    label: 'טיפוס',
    blurb: 'כל תשובה נכונה מעלה רמה — שלוש טעויות והמשחק נגמר',
    totalMs: null,
    perQuestionMs: 20000,
    lives: 3,
    wrongPenaltyMs: 0,
    climbs: true
  },
  /**
   * Fixed WORKLOAD instead of fixed time — the mirror of ספרינט.
   *
   * Everyone answers the same twenty questions, so scores compare directly
   * rather than through however many each player happened to reach. Speed
   * still pays, through the same speed bonus.
   */
  blitz: {
    id: 'blitz',
    label: 'בזק',
    blurb: '20 שאלות בדיוק — אותה כמות לכולם',
    totalMs: null,
    perQuestionMs: 20000,
    lives: Infinity,
    wrongPenaltyMs: 0,
    climbs: false,
    questionLimit: 20
  },
  /**
   * The clock itself gets harder.
   *
   * Twelve seconds for the first question, half a second less each time, and
   * never below four. Every other mode holds its pressure steady; this one
   * finds the speed at which the student breaks.
   */
  survival: {
    id: 'survival',
    label: 'הישרדות',
    blurb: 'הזמן לכל שאלה מתקצר — שלוש טעויות וזה נגמר',
    totalMs: null,
    perQuestionMs: 12000,
    shrinkMs: 500,
    minQuestionMs: 4000,
    lives: 3,
    wrongPenaltyMs: 0,
    climbs: false
  }
};

/** Answer inside this and the question scores its full speed bonus. */
const FAST_MS = 3000;
const BRISK_MS = 6000;

/** Points before any multiplier. */
const BASE_POINTS = 10;

/** A streak multiplier step every STREAK_STEP answers, capped. */
const STREAK_STEP = 5;
const STREAK_CAP = 3;

/**
 * Starts a game.
 *
 * `source` is an array of questions for ספרינט and דיוק, and an object keyed by
 * level for טיפוס — that mode has to ask for a specific level next, so it
 * cannot draw from one flat list.
 */
export function createGame(source, { mode = 'sprint', studentName, subject, grade, difficulty = null } = {}) {
  const rules = MODES[mode] || MODES.sprint;
  const byLevel = rules.climbs ? normaliseLevels(source) : null;
  // A mode with a question limit takes exactly that many, so every run is the
  // same length and the scores are comparable.
  const queue = rules.climbs ? null
    : (rules.questionLimit ? [...source].slice(0, rules.questionLimit) : [...source]);

  const level = rules.climbs ? MIN_LEVEL : null;
  const first = rules.climbs ? takeFromLevel(byLevel, level) : queue.shift() || null;

  return {
    mode: rules.id,
    studentName,
    subject,
    grade: Number(grade),
    // טיפוס has no chosen difficulty — the level is the thing being climbed,
    // so its board is per subject and its difficulty is recorded as null.
    difficulty: rules.climbs ? null : (difficulty == null ? null : Number(difficulty)),
    queue,
    byLevel,
    current: first,
    level,
    answered: 0,
    score: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    bestStreak: 0,
    bestLevel: level,
    livesLeft: rules.lives,
    timeLeftMs: rules.totalMs ?? rules.perQuestionMs,
    // What the bar is measured against: the whole game, or this question.
    clockMs: rules.totalMs ?? rules.perQuestionMs,
    durationMs: rules.totalMs ?? rules.perQuestionMs,
    penaltyMs: 0,
    startedAt: 0,
    over: first == null
  };
}

/** Fills any missing level with an empty list so lookups are always safe. */
function normaliseLevels(source) {
  const out = {};
  for (let l = MIN_LEVEL; l <= MAX_LEVEL; l++) out[l] = [...(source[l] || source[String(l)] || [])];
  return out;
}

/**
 * Pops a question for a level, falling back DOWNWARDS then upwards.
 *
 * A generator pool can run dry at one level while others still have questions.
 * Ending the climb because level 4 is exhausted would read as a bug to the
 * student, so the nearest level stands in rather than the run stopping.
 */
function takeFromLevel(byLevel, level) {
  if (!byLevel) return null;
  if (byLevel[level] && byLevel[level].length) return byLevel[level].shift();
  for (let d = 1; d < MAX_LEVEL; d++) {
    const lower = level - d;
    const higher = level + d;
    if (lower >= MIN_LEVEL && byLevel[lower] && byLevel[lower].length) return byLevel[lower].shift();
    if (higher <= MAX_LEVEL && byLevel[higher] && byLevel[higher].length) return byLevel[higher].shift();
  }
  return null;
}

export function gameRules(state) {
  return MODES[state.mode] || MODES.sprint;
}

export function currentGameQuestion(state) {
  return state.over ? null : state.current;
}

export function isGameOver(state) {
  return state.over || state.timeLeftMs <= 0 || state.current == null || state.livesLeft <= 0;
}

/** How much a correct answer is worth right now. */
export function speedBonus(answerMs) {
  if (answerMs <= FAST_MS) return 1.5;
  if (answerMs <= BRISK_MS) return 1.2;
  return 1;
}

/** The multiplier the CURRENT streak has earned, capped. */
export function streakMultiplier(streak) {
  return Math.min(STREAK_CAP, 1 + Math.floor(streak / STREAK_STEP));
}

/**
 * Advances the clock. Returns a new state; never goes below zero.
 *
 * Separate from answering so the UI can tick at whatever rate it likes without
 * the rules caring — and so a test can advance a whole minute instantly.
 *
 * Running out is not the same event in every mode. In ספרינט it ends the game;
 * in the per-question modes it costs a life, exactly like a wrong answer, which
 * is what stops a student from parking on a question they cannot do.
 */
export function tickGame(state, deltaMs) {
  if (isGameOver(state)) return state.over ? state : { ...state, over: true };

  const timeLeftMs = Math.max(0, state.timeLeftMs - Math.max(0, deltaMs));
  if (timeLeftMs > 0) return { ...state, timeLeftMs };

  const rules = gameRules(state);
  if (!rules.perQuestionMs) return { ...state, timeLeftMs: 0, over: true };
  return applyWrong({ ...state, timeLeftMs: 0 }, rules, { timedOut: true });
}

/**
 * The clock the NEXT question gets.
 *
 * Constant in every mode but הישרדות, where it shrinks by a fixed step down
 * to a floor. Computed from the count answered rather than by decrementing
 * state, so it cannot drift and a test can ask for question fifty directly.
 */
function clockFor(rules, answered) {
  if (!rules.perQuestionMs) return rules.totalMs;
  if (!rules.shrinkMs) return rules.perQuestionMs;
  return Math.max(rules.minQuestionMs, rules.perQuestionMs - rules.shrinkMs * answered);
}

/** The shared "that was wrong" transition: lose a life, break the streak. */
function applyWrong(state, rules, { timedOut = false } = {}) {
  const livesLeft = state.livesLeft - 1;
  const level = rules.climbs ? Math.max(MIN_LEVEL, state.level - 1) : state.level;

  let timeLeftMs = state.timeLeftMs;
  let penaltyMs = state.penaltyMs;
  if (rules.wrongPenaltyMs) {
    timeLeftMs = Math.max(0, state.timeLeftMs - rules.wrongPenaltyMs);
    penaltyMs += rules.wrongPenaltyMs;
  }

  const next = advance({ ...state, level }, rules);
  const dead = livesLeft <= 0;

  return {
    ...state,
    ...next,
    level,
    answered: state.answered + 1,
    wrong: state.wrong + 1,
    streak: 0,
    livesLeft,
    penaltyMs,
    timedOut,
    // A per-question clock restarts for the next question; a whole-game clock
    // carries whatever the penalty left it.
    timeLeftMs: rules.perQuestionMs && !dead ? clockFor(rules, state.answered + 1) : timeLeftMs,
    clockMs: rules.perQuestionMs ? clockFor(rules, state.answered + 1) : state.clockMs,
    over: dead || next.current == null || (!rules.perQuestionMs && timeLeftMs <= 0)
  };
}

/** Pulls the next question for whichever mode this is. */
function advance(state, rules) {
  if (rules.climbs) {
    return { current: takeFromLevel(state.byLevel, state.level), byLevel: state.byLevel };
  }
  const queue = state.queue;
  return { current: queue.length ? queue.shift() : null, queue };
}

/**
 * Records an answer.
 *
 * `answerMs` is how long this question took, which is what the speed bonus
 * reads.
 */
export function answerGame(state, optionIndex, answerMs = 0) {
  if (isGameOver(state)) return state;
  const question = currentGameQuestion(state);
  if (!question) return { ...state, over: true };

  const rules = gameRules(state);
  if (optionIndex !== question.correctIdx) return applyWrong(state, rules, { timedOut: false });

  // The level the question was actually drawn at, so a hard question is worth
  // more than an easy one even inside a mixed run.
  const level = rules.climbs ? state.level : (Number(question.difficulty) || 1);
  const gained = Math.round(BASE_POINTS * level * speedBonus(answerMs) * streakMultiplier(state.streak));
  const streak = state.streak + 1;
  const nextLevel = rules.climbs ? Math.min(MAX_LEVEL, state.level + 1) : state.level;

  const next = advance({ ...state, level: nextLevel }, rules);
  return {
    ...state,
    ...next,
    level: nextLevel,
    bestLevel: rules.climbs ? Math.max(state.bestLevel ?? MIN_LEVEL, nextLevel) : state.bestLevel,
    answered: state.answered + 1,
    score: state.score + gained,
    correct: state.correct + 1,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    timedOut: false,
    timeLeftMs: rules.perQuestionMs ? clockFor(rules, state.answered + 1) : state.timeLeftMs,
    clockMs: rules.perQuestionMs ? clockFor(rules, state.answered + 1) : state.clockMs,
    over: next.current == null
  };
}

/** The row this run posts to the board. */
export function gameResult(state) {
  const answered = state.correct + state.wrong;
  const rules = gameRules(state);
  return {
    student_name: state.studentName,
    mode: state.mode,
    subject: state.subject,
    grade: state.grade,
    difficulty: state.difficulty,
    score: state.score,
    correct: state.correct,
    wrong: state.wrong,
    best_streak: state.bestStreak,
    duration_seconds: Math.max(1, Math.round((rules.totalMs ?? (rules.perQuestionMs * Math.max(1, answered))) / 1000)),
    accuracy: answered === 0 ? 0 : Math.round((state.correct / answered) * 100),
    bestLevel: rules.climbs ? (state.bestLevel ?? MIN_LEVEL) : null
  };
}
