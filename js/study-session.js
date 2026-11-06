/**
 * A study session: lessons queued up and played one after another.
 *
 * The catalogue and the drawer both hand a student a LIST and ask them to pick.
 * That is the right shape for "I want fractions"; it is the wrong shape for "I
 * have half an hour, teach me". This turns a selection of subjects into a queue
 * and rolls through it, the way the mixed quiz rolls through questions.
 *
 * A pure state machine like js/quiz.js, js/lesson.js and js/game.js — no DOM, no
 * network, no clock. The queue is built from data the caller has already
 * fetched, so this module never asks anyone for anything.
 */

/**
 * Builds the queue.
 *
 * `perSubject` is [{ subjectId, grade, topics }]. `hasLesson` and `isDone` are
 * passed in rather than imported so this stays free of the lesson registry and
 * of the progress store — and so the tests can drive it without either.
 *
 * Ordered subject by subject rather than interleaved, which is the opposite of
 * the mixed quiz. A quiz interleaves to keep a student alert; studying rewards
 * the other thing — finishing one subject's thread before starting another's.
 *
 * Topics with no lesson are dropped, not queued and skipped: "בקרוב" is not
 * something a session can teach, and a queue that stops on it would strand the
 * student on a card with no content.
 */
export function buildStudyQueue(perSubject, { hasLesson, isDone, includeDone = false } = {}) {
  const queue = [];
  for (const entry of perSubject || []) {
    if (!entry || !entry.subjectId) continue;
    for (const topic of entry.topics || []) {
      if (hasLesson && !hasLesson(entry.subjectId, entry.grade, topic)) continue;
      if (!includeDone && isDone && isDone(entry.subjectId, entry.grade, topic)) continue;
      queue.push({ subjectId: entry.subjectId, grade: entry.grade, topic });
    }
  }
  return queue;
}

/**
 * Starts a session over a queue.
 *
 * `total` is fixed at creation and never recomputed, so the counter a student
 * reads cannot move under them: "שיעור 3 מתוך 12" stays out of 12 even as they
 * skip.
 */
export function createStudySession(queue) {
  const items = [...(queue || [])];
  return {
    items,
    index: 0,
    total: items.length,
    /** Topics finished in this session, in order — what the summary reports. */
    completed: [],
    /** Topics passed over. Kept so the session can offer them again at the end. */
    skipped: []
  };
}

export function currentStudyItem(session) {
  if (!session || session.index >= session.items.length) return null;
  return session.items[session.index];
}

export function isStudySessionOver(session) {
  return !session || session.index >= session.items.length;
}

/** 1-based position, for display. Clamped so a finished session still reads sensibly. */
export function studyPosition(session) {
  if (!session) return { at: 0, total: 0 };
  return { at: Math.min(session.index + 1, session.total), total: session.total };
}

/** Marks the current lesson finished and moves on. */
export function completeStudyItem(session) {
  const item = currentStudyItem(session);
  if (!item) return session;
  return {
    ...session,
    index: session.index + 1,
    completed: [...session.completed, item]
  };
}

/** Passes over the current lesson without crediting it. */
export function skipStudyItem(session) {
  const item = currentStudyItem(session);
  if (!item) return session;
  return {
    ...session,
    index: session.index + 1,
    skipped: [...session.skipped, item]
  };
}

/**
 * What the session did, for the end screen.
 *
 * `remaining` is what a student who stopped early left behind, which is the
 * number worth showing next to an offer to carry on.
 */
export function studyResult(session) {
  if (!session) return { completed: 0, skipped: 0, remaining: 0, total: 0, subjects: [] };
  return {
    completed: session.completed.length,
    skipped: session.skipped.length,
    remaining: Math.max(0, session.items.length - session.index),
    total: session.total,
    subjects: [...new Set(session.completed.map(i => i.subjectId))]
  };
}
