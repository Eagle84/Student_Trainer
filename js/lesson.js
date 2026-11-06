/**
 * Lesson navigation and scoring — the study-mode counterpart of quiz.js.
 *
 * Pure: no DOM, no network, no localStorage. Every transition returns a new
 * state object; nothing mutates in place, so the same state can be rendered
 * twice without surprises.
 *
 * A lesson TEACHES. It deliberately asks the student nothing: there used to be
 * a `check` card that drew a live question from the quiz generators, and it
 * made the lesson read as a quiz with prose around it. Answering belongs to the
 * quiz, which is one button away at the end.
 *
 * The five card kinds:
 *   concept  { title, lead, body: string[], visual?, rule?, aside? }
 *   steps    { title, problem, visual?, steps: [{ text, expr?, highlight? }] }
 *   example  { title, problem, solution: string[], answer, visual?, note? }
 *   pitfall  { title, wrong, right, why }
 *   recap    { bullets: string[] }
 */

export const CARD_KINDS = ['concept', 'steps', 'example', 'pitfall', 'recap', 'check'];

/** Fields every kind must carry, checked by tests/lessons.test.js. */
export const REQUIRED_FIELDS = {
  concept: ['title', 'lead'],
  steps: ['title', 'problem', 'steps'],
  example: ['title', 'problem', 'solution', 'answer'],
  pitfall: ['title', 'wrong', 'right', 'why'],
  recap: ['bullets'],
  // A checkpoint closing a micro-topic. `unit` names the run of cards it tests;
  // getting it wrong replays that run rather than the whole lesson.
  check: ['unit', 'question', 'options', 'correctIdx']
};

/**
 * How many times one micro-topic may be re-taught before the lesson gives up
 * and moves on.
 *
 * The brief is to keep re-teaching until the student passes, and that is what
 * this does for any realistic number of attempts. But a checkpoint whose
 * question is simply beyond the student — a bad question, a missing
 * prerequisite — would otherwise trap them in a loop with no exit and no way to
 * reach the rest of the lesson, which is worse than an unanswered checkpoint.
 * On the last pass the lesson continues and the unit is recorded as unresolved,
 * so the dashboard can surface it as a topic to drill.
 */
export const MAX_RETRAIN_PASSES = 3;

export function createLessonState(lesson, { grade, topic } = {}) {
  return {
    lesson,
    grade: Number(grade ?? lesson.grades[0]),
    // The furthest card reached, not the current one: a student who read six
    // cards and paged back to card two has still seen six, and their progress
    // must not shrink when they browse backwards.
    furthest: 0,
    // The topic the student arrived through, which is the one the "I'm ready"
    // quiz drills. A lesson can teach several; without this it would be a coin
    // flip which one they get tested on.
    topic: topic && lesson.topics.includes(topic) ? topic : lesson.topics[0],
    index: 0,
    // Steps revealed on the CURRENT card. Reset by every navigation, because a
    // steps card the student comes back to should replay, not sit solved.
    revealed: 0,
    // How many times each micro-topic has been re-taught, by unit id. A unit
    // absent here is one the student has not yet failed.
    passes: {},
    // Units whose checkpoint was answered correctly, and units that ran out of
    // passes. Kept apart: the first is learning, the second is a topic to drill.
    passed: [],
    unresolved: []
  };
}

// --- checkpoints ------------------------------------------------------
//
// A lesson is punctuated by `check` cards: a micro-topic is taught, then tested
// before the next one starts. Getting one wrong silently replays that
// micro-topic in different words and asks again.
//
// Silently is the whole design. The student is never told they failed — there
// is no "wrong", no score, no retry button. From where they sit the lesson
// simply carries on and covers the idea again from another angle, which is what
// a good tutor does and what a red X does not. Telling a child they have failed
// three times in a row on the same idea is how you teach them to stop trying.

/** The contiguous run of cards the given unit is taught by. */
export function unitRange(lesson, unit) {
  const cards = lesson.cards;
  let end = cards.findIndex(c => c.kind === 'check' && c.unit === unit);
  if (end === -1) return null;
  let start = end;
  while (start > 0 && cards[start - 1].kind !== 'check' && cards[start - 1].unit === unit) start--;
  return { start, end };
}

/** True while the student is being re-taught a unit they have not yet passed. */
export function isRetraining(state) {
  const card = state.lesson.cards[state.index];
  return Boolean(card && card.unit && (state.passes[card.unit] || 0) > 0
    && !state.passed.includes(card.unit));
}

/**
 * The wording to show for a card, given how many times its unit has been
 * re-taught.
 *
 * A card may carry `alt: [{...}, {...}]` — the same idea explained differently.
 * Pass 1 takes the first, pass 2 the second, and a unit with fewer alternatives
 * than passes falls back to the last one it has rather than repeating the
 * original wording, which is the one already known not to have landed.
 */
export function cardVariant(card, pass = 0) {
  if (!card || !pass || !Array.isArray(card.alt) || card.alt.length === 0) return card;
  return { ...card, ...card.alt[Math.min(pass, card.alt.length) - 1] };
}

/** The current card, in the wording this pass calls for. */
export function currentVariant(state) {
  const card = state.lesson.cards[state.index];
  return cardVariant(card, card && card.unit ? state.passes[card.unit] || 0 : 0);
}

/**
 * Answers the checkpoint on the current card.
 *
 * Correct: the unit is banked and the lesson moves past the checkpoint.
 * Wrong: the unit's pass count goes up and the index jumps back to the first
 * card of that unit, so the next thing the student sees is the idea being
 * taught again — not a verdict on the answer they just gave.
 */
export function answerCheck(state, chosenIdx) {
  const card = state.lesson.cards[state.index];
  if (!card || card.kind !== 'check') return state;

  if (Number(chosenIdx) === Number(card.correctIdx)) {
    return {
      ...state,
      revealed: 0,
      passed: state.passed.includes(card.unit) ? state.passed : [...state.passed, card.unit],
      index: Math.min(state.index + 1, state.lesson.cards.length - 1),
      furthest: Math.max(state.furthest, state.index + 1)
    };
  }

  const passes = (state.passes[card.unit] || 0) + 1;
  // Out of passes: continue rather than trap them, and record the unit as one
  // to drill later.
  if (passes >= MAX_RETRAIN_PASSES) {
    return {
      ...state,
      revealed: 0,
      passes: { ...state.passes, [card.unit]: passes },
      unresolved: state.unresolved.includes(card.unit)
        ? state.unresolved : [...state.unresolved, card.unit],
      index: Math.min(state.index + 1, state.lesson.cards.length - 1),
      furthest: Math.max(state.furthest, state.index + 1)
    };
  }

  const range = unitRange(state.lesson, card.unit);
  return {
    ...state,
    revealed: 0,
    passes: { ...state.passes, [card.unit]: passes },
    index: range ? range.start : state.index
  };
}

export function currentCard(state) {
  return state.lesson.cards[state.index];
}

export function cardCount(state) {
  return state.lesson.cards.length;
}

export function isLastCard(state) {
  return state.index >= cardCount(state) - 1;
}

export function isFirstCard(state) {
  return state.index <= 0;
}

/** Steps still hidden on the current card, or 0 when it is not a steps card. */
export function stepsRemaining(state) {
  const card = currentCard(state);
  if (!card || card.kind !== 'steps') return 0;
  return Math.max(0, card.steps.length - state.revealed);
}

/** Reveals the next step of a steps card. A no-op once they are all out. */
export function revealStep(state) {
  if (stepsRemaining(state) === 0) return state;
  return { ...state, revealed: state.revealed + 1 };
}

/** The highlight the visual should render at, given how far the steps have got.
 *  Falls back to the card's own highlight before any step is revealed. */
export function activeHighlight(state) {
  const card = currentCard(state);
  if (!card || card.kind !== 'steps' || state.revealed === 0) return undefined;
  const step = card.steps[state.revealed - 1];
  return step ? step.highlight : undefined;
}

export function nextCard(state) {
  if (isLastCard(state)) return state;
  const index = state.index + 1;
  return {
    ...state,
    index,
    furthest: Math.max(state.furthest, index),
    revealed: 0
  };
}

export function prevCard(state) {
  if (isFirstCard(state)) return state;
  return { ...state, index: state.index - 1, revealed: 0 };
}

/** Cards seen, 1-based — 1 on the opening card, cardCount on the recap. */
export function cardsSeen(state) {
  return Math.min(cardCount(state), state.furthest + 1);
}

/** True once the student has reached the last card. */
export function isComplete(state) {
  return cardsSeen(state) >= cardCount(state);
}

/**
 * Worth recording at all.
 *
 * Opening a lesson and closing it immediately is not progress, and storing it
 * would put a "you started this" marker on every lesson a student merely
 * glanced at. One card advanced is the threshold.
 */
export function isWorthSaving(state) {
  return state.furthest > 0;
}

/**
 * The registry topics behind the checkpoints the student never cleared.
 *
 * A unit id names a micro-topic inside one lesson and means nothing to the rest
 * of the app, so a checkpoint may carry its own `topic` — a real topic from the
 * registry — and falls back to the topic the lesson was entered through. That
 * is what lets an uncleared checkpoint become a drillable chip rather than a
 * fact recorded nowhere.
 *
 * Deliberately reports only the units that ran out of passes. A unit failed
 * twice and then understood is a student who got there, which is the system
 * working; listing it as weak would punish them for the learning.
 */
export function unresolvedTopics(state) {
  const out = [];
  for (const unit of state.unresolved) {
    const card = state.lesson.cards.find(c => c.kind === 'check' && c.unit === unit);
    const topic = (card && card.topic) || state.topic;
    if (topic && !out.includes(topic)) out.push(topic);
  }
  return out;
}

/**
 * Shapes the state into a row for the `lesson_progress` table.
 *
 * Records how far the student got, not merely that they finished. Without
 * cards_seen the row could only ever mean "done", so abandoning a lesson
 * halfway would throw away the reading the student had already done.
 */
export function getProgressRecord(state, studentName) {
  return {
    student_name: studentName,
    lesson_id: state.lesson.id,
    subject: state.lesson.subject,
    grade: state.grade,
    topic: state.topic,
    cards_seen: cardsSeen(state),
    cards_total: cardCount(state),
    completed: isComplete(state)
  };
}
