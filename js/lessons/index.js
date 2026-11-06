/**
 * The lesson registry — the single extension point for study content.
 *
 * To add a lesson: append an object to js/lessons/<subject>.js. Nothing in
 * lesson.js, ui-lesson.js, app.js, or the schema needs to change.
 *
 * A lesson TEACHES one or more quiz topics. The `topics` array holds the exact
 * `topic` strings the generators produce, because that string is already the
 * join key for attempt_errors, analytics.weakTopics() and every reinforcement
 * drill. Keying lessons by the same string is what lets "you got אחוזים wrong"
 * link straight to the אחוזים lesson without a translation table.
 *
 * tests/lessons.test.js asserts every one of those strings against
 * topicsFor() — a single wrong Hebrew character would silently break both the
 * check cards and the link to the quiz, and it is invisible to the eye.
 *
 * Lesson shape:
 *   id       stable slug, stored in lesson_progress; never reuse one
 *   subject  registry id from js/subjects/index.js
 *   grades   grades this lesson serves, ascending
 *   topics   exact generator topic strings it teaches
 *   title    Hebrew heading
 *   intro    one sentence: what the student will be able to do afterwards
 *   minutes  rough reading time, shown on the catalogue card
 *   cards    the lesson itself; see js/lesson.js for the card kinds
 */
import { mathLessons } from './math/index.js';
import { englishLessons } from './english.js';
import { hebrewLessons } from './hebrew.js';
import { psychometricLessons } from './psychometric.js';
import { psychotechnicalLessons } from './psychotechnical.js';
import { reliabilityLessons } from './reliability.js';
import { writingLessons } from './writing.js';
import { codingLessons } from './coding.js';

export const LESSONS = [
  ...mathLessons, ...englishLessons, ...hebrewLessons,
  ...psychometricLessons, ...psychotechnicalLessons, ...reliabilityLessons, ...writingLessons,
  ...codingLessons
];

/** 'subject|grade|topic' -> lesson, for the exact-match lookup. */
const byTriple = new Map();
/** 'subject|topic' -> lessons teaching it, for the nearest-grade fallback. */
const byTopic = new Map();

for (const lesson of LESSONS) {
  for (const topic of lesson.topics) {
    const topicKey = `${lesson.subject}|${topic}`;
    if (!byTopic.has(topicKey)) byTopic.set(topicKey, []);
    byTopic.get(topicKey).push(lesson);
    for (const grade of lesson.grades) {
      byTriple.set(`${lesson.subject}|${grade}|${topic}`, lesson);
    }
  }
}

/**
 * The lesson for a topic, or null.
 *
 * Exact grade first, then the same subject+topic at the nearest grade. Both
 * steps are needed: `הסתברות` is taught in grade 9 AND grade 12 with different
 * content, so the triple must win; but `שורשים` in Hebrew is one lesson serving
 * grades 5-12, and a student two grades off should still get it.
 */
export function getLesson(subjectId, grade, topic) {
  const exact = byTriple.get(`${subjectId}|${grade}|${topic}`);
  if (exact) return exact;

  const candidates = byTopic.get(`${subjectId}|${topic}`);
  if (!candidates || candidates.length === 0) return null;

  const g = Number(grade);
  let best = null;
  let bestDistance = Infinity;
  for (const lesson of candidates) {
    for (const lg of lesson.grades) {
      const distance = Math.abs(lg - g);
      if (distance < bestDistance) { bestDistance = distance; best = lesson; }
    }
  }
  return best;
}

export function hasLesson(subjectId, grade, topic) {
  return getLesson(subjectId, grade, topic) !== null;
}

/** A lesson by its stored id — how lesson_progress rows are resolved back. */
export function lessonById(id) {
  return LESSONS.find(l => l.id === id) || null;
}
