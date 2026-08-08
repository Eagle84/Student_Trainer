/**
 * Configuration constants.
 *
 * SECURITY NOTE: SUPABASE_ANON_KEY is a PUBLIC identifier, not a secret. It is
 * meant to ship in client-side code. Access is enforced entirely by the Row
 * Level Security policies in sql/schema.sql — apply them before going live.
 *
 * NEVER put the service_role key, the database password, or the connection
 * string in client-side code. They bypass RLS completely.
 *
 * The two Supabase values come from the generated js/env.js, which is produced
 * from your local .env by `node scripts/gen-config.mjs`. Do not hand-edit them
 * here — edit .env and re-run the generator.
 */
export { SUPABASE_URL, SUPABASE_ANON_KEY } from './env.js';

/**
 * The release, shown at the foot of the drawer.
 *
 * Bump APP_VERSION by hand when shipping something worth naming. BUILD_ID is
 * rewritten by .github/workflows/deploy.yml to the deploying commit's short
 * SHA; it stays 'dev' when the app is served from a working copy.
 *
 * That distinction is the point. GitHub Pages caches the module graph for
 * around ten minutes and the JS is deliberately unversioned, so "has my change
 * actually deployed yet?" is otherwise unanswerable from the browser. Now the
 * page states which commit it came from.
 */
export const APP_VERSION = '1.0.0';
export const BUILD_ID = 'ad8297f';

/** Fraction of each quiz drawn from the hand-authored question_bank table. */
export const BANK_RATIO = 0.4;

/** Row cap for the leaderboard and for a student's own history list. */
export const HISTORY_PAGE_SIZE = 50;

/** localStorage keys. */
export const LS_STUDENT_NAME = 'student_trainer_name';
export const LS_LAST_SUBJECT = 'student_trainer_last_subject';
export const LS_PENDING_ATTEMPTS = 'student_trainer_pending_attempts';
export const LS_LOCAL_ATTEMPTS = 'student_trainer_local_attempts';
export const LS_THEME = 'student_trainer_theme';
/** Whether a correct answer buzzes the phone. Android only; see js/haptics.js. */
export const LS_HAPTICS = 'student_trainer_haptics';
/** Lesson completions waiting to sync, and the local mirror the catalogue reads. */
export const LS_PENDING_LESSONS = 'student_trainer_pending_lessons';
export const LS_LESSON_PROGRESS = 'student_trainer_lesson_progress';
/** Game scores waiting to reach the server. */
export const LS_PENDING_GAMES = 'student_trainer_pending_games';
/** Drill credits waiting to reach the server; see creditAttempt in js/db.js. */
export const LS_PENDING_CREDITS = 'student_trainer_pending_credits';

/** A quiz left unfinished, so closing the tab mid-quiz does not lose it. */
export const LS_ACTIVE_QUIZ = 'student_trainer_active_quiz';
/**
 * When each topic was last answered cleanly — `subject|topic` -> timestamp.
 *
 * Local, because the server records only errors and there is no column to write
 * a success into. The consequence is honest and worth knowing: clear a topic on
 * a phone and it can still show as weak on a laptop until it is cleared there
 * too. Fixing that properly means a resolved_at column and a migration.
 */
export const LS_TOPIC_CLEARED = 'student_trainer_topic_cleared';

/**
 * Recently served questions, so a second quiz in one sitting does not re-ask the
 * first one's questions.
 *
 * Capped PER subject and grade. The cap is what bounds both localStorage and how
 * much of a finite pool the app is willing to rule out: past it, the oldest
 * fingerprints are dropped and those questions become askable again. 300 covers
 * several sittings at every subject measured, and at roughly eight bytes a
 * fingerprint costs a few kilobytes.
 */
export const LS_RECENT_QUESTIONS = 'student_trainer_recent_questions';
/** Batches that could not reach the server yet. Flushed with the rest. */
export const LS_PENDING_RECENT = 'student_trainer_pending_recent';
export const RECENT_QUESTIONS_MAX = 300;


/**
 * Shape version for the saved quiz, and how long one is worth offering.
 *
 * The saved blob holds whole question objects. If their shape changes — a new
 * field the renderer needs, a different way of storing answers — a quiz saved
 * by the old code would restore into a renderer that cannot draw it. Bumping
 * this discards those rather than resuming into a broken screen.
 */
export const ACTIVE_QUIZ_VERSION = 2;
export const ACTIVE_QUIZ_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How many unfinished quizzes are kept at once.
 *
 * More than one because a student legitimately leaves a maths quiz to sit an
 * English one; capped because each holds its whole question list, and an
 * unbounded pile would both fill localStorage and turn Home into a to-do list.
 * Oldest are dropped first.
 */
export const ACTIVE_QUIZ_MAX = 5;
