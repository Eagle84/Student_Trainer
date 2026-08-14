/**
 * Difficulty levels and high-school tracks.
 *
 * Two independent axes, because the syllabus genuinely has two:
 *
 *   level (1-5)  How deep the question goes WITHIN a topic. Applies to every
 *                grade. Mirrors the רמה א' / רמה ב' split that textbooks ship
 *                for each chapter, extended to five steps.
 *
 *   track (3|4|5) Which topic SET is in scope, in יחידות לימוד. Only grades 10
 *                and up. This is not "harder" — integrals do not exist at 3
 *                יח"ל at any level, and a 3 יח"ל student asked for level 5
 *                should get a hard 3 יח"ל question, not an easy 5 יח"ל one.
 *
 * Collapsing the two would make "5 יח"ל אינטגרלים" indistinguishable from
 * "hard 3 יח"ל", and would leave no way to ask for an easy integral.
 *
 * Pure: no DOM, no network. Safe to import from Node.
 */

export const LEVELS = [1, 2, 3, 4, 5];
export const DEFAULT_LEVEL = 3;

export const LEVEL_NAMES = {
  1: 'רמה 1 — מתחילים',
  2: 'רמה 2 — קל',
  3: 'רמה 3 — בינוני',
  4: 'רמה 4 — מתקדם',
  5: 'רמה 5 — מאתגר'
};

/** The first grade whose syllabus splits by matriculation track. */
export const TRACK_FROM_GRADE = 10;

export const TRACKS = [3, 4, 5];
export const DEFAULT_TRACK = 4;

export const TRACK_NAMES = {
  3: '3 יחידות',
  4: '4 יחידות',
  5: '5 יחידות'
};

/** True for grades where a track must be chosen. */
export function hasTracks(grade) {
  return Number(grade) >= TRACK_FROM_GRADE;
}

/**
 * Coerces anything into a valid level. Callers pass values straight from a
 * <select> or a database row, so a missing or malformed level must land on the
 * middle of the scale rather than produce undefined tier lookups.
 */
export function clampLevel(level) {
  // null and '' must be rejected before Number(), which maps both to 0 and
  // would then clamp up to 1. getLastLevel() returns '' when a student has
  // never chosen a level, so that path would silently pin them to the easiest
  // setting instead of the default.
  if (level === null || level === undefined || level === '') return DEFAULT_LEVEL;
  const n = Math.round(Number(level));
  if (!Number.isFinite(n)) return DEFAULT_LEVEL;
  return Math.min(5, Math.max(1, n));
}

/** Coerces anything into a valid track. */
export function clampTrack(track) {
  const n = Number(track);
  return TRACKS.includes(n) ? n : DEFAULT_TRACK;
}

/**
 * Picks the entry for `level` out of a five-element tier table.
 *
 * This is the whole mechanism by which a generator scales. A generator writes
 * its parameter ranges once, as five tiers, and reads the one matching the
 * requested level:
 *
 *   const [lo, hi] = byLevel(level, [[2, 9], [10, 50], [20, 200], ...]);
 *
 * Tier tables must have exactly five entries; clampLevel guarantees the index
 * is in range, so a short table would silently yield undefined.
 */
export function byLevel(level, tiers) {
  return tiers[clampLevel(level) - 1];
}
