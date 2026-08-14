/**
 * Every Supabase call and every localStorage access lives here.
 * No DOM access. Callers get plain data plus a `fromCache` flag.
 *
 * Failure policy: nothing here ever throws at the caller. Reads degrade to
 * cached local data; writes queue into localStorage and are retried by
 * flushPending() on the next successful connection.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  HISTORY_PAGE_SIZE,
  LEADERBOARD_EXCLUDED_NAMES,
  LS_PENDING_ATTEMPTS,
  LS_LOCAL_ATTEMPTS,
  LS_STUDENT_NAME,
  LS_LAST_SUBJECT,
  LS_THEME,
  LS_HAPTICS,
  LS_STUDY_SUBJECTS,
  LS_PENDING_LESSONS,
  LS_LESSON_PROGRESS,
  LS_PENDING_GAMES,
  LS_PENDING_CREDITS,
  LS_SEEN_VERSION,
  LS_ACTIVE_QUIZ,
  LS_TOPIC_CLEARED,
  ACTIVE_QUIZ_VERSION,
  ACTIVE_QUIZ_MAX_AGE_MS,
  ACTIVE_QUIZ_MAX,
  LS_RECENT_QUESTIONS,
  LS_PENDING_RECENT,
  RECENT_QUESTIONS_MAX
} from './config.js';
import { creditedAttempt } from './quiz.js';

let client = null;
let online = false;

/** True if the last Supabase call succeeded. */
export function isOnline() {
  return online;
}

function getClient() {
  if (client) return client;
  if (!SUPABASE_URL || SUPABASE_URL.startsWith('YOUR_')) return null;
  try {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch {
    client = null;
  }
  return client;
}

// --- authentication ---------------------------------------------------
// Usernames are aliased to a synthetic email; the alias is internal and never
// shown. The real display name lives in the profiles table.

const USERNAME_DOMAIN = 'student-trainer.com';
function emailFor(username) {
  return `${String(username).trim().toLowerCase()}@${USERNAME_DOMAIN}`;
}

async function authUserId(c) {
  try {
    const { data } = await c.auth.getUser();
    return data && data.user ? data.user.id : null;
  } catch {
    return null;
  }
}

function authMessage(error) {
  const m = (error && error.message) || '';
  if (/already registered|already been registered|already exists/i.test(m)) return 'שם המשתמש כבר תפוס.';
  if (/invalid login credentials/i.test(m)) return 'שם משתמש או סיסמה שגויים.';
  if (/password/i.test(m)) return 'הסיסמה חייבת להכיל לפחות 6 תווים.';
  if (/confirm/i.test(m) || /rate limit/i.test(m)) {
    return 'ההרשמה חסומה: יש לכבות "Confirm email" בהגדרות Supabase (Authentication → Email).';
  }
  return 'לא ניתן להשלים את הפעולה. נסה שוב.';
}

/** Registers a new account (username + password) and creates its profile. */
export async function signUp(username, password, displayName, grade) {
  const c = getClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  const uname = String(username).trim().toLowerCase();
  try {
    const { data, error } = await c.auth.signUp({ email: emailFor(uname), password });
    if (error) { online = true; return { ok: false, error: authMessage(error) }; }
    if (!data.session) {
      return { ok: false, error: 'ההרשמה דורשת כיבוי "Confirm email" בהגדרות Supabase.' };
    }
    const uid = data.user.id;
    const { error: pErr } = await c.from('profiles').insert({
      id: uid, username: uname, display_name: String(displayName).trim(), grade: grade || null
    });
    if (pErr) {
      const dup = /duplicate|unique|username/i.test(pErr.message || '');
      return { ok: false, error: dup ? 'שם המשתמש כבר תפוס.' : 'ההרשמה נכשלה. נסה שוב.' };
    }
    online = true;
    return { ok: true, user: { id: uid, username: uname, displayName: String(displayName).trim(), grade: grade || null } };
  } catch {
    online = false;
    return { ok: false, error: 'שגיאת רשת. נסה שוב.' };
  }
}

/** Signs in with username + password. */
export async function signIn(username, password) {
  const c = getClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  try {
    const { error } = await c.auth.signInWithPassword({ email: emailFor(username), password });
    if (error) { online = true; return { ok: false, error: authMessage(error) }; }
    online = true;
    return { ok: true, user: await currentUser() };
  } catch {
    online = false;
    return { ok: false, error: 'שגיאת רשת. נסה שוב.' };
  }
}

export async function signOut() {
  const c = getClient();
  if (c) { try { await c.auth.signOut(); } catch { /* ignore */ } }
}

/** The signed-in user's profile, or null when nobody is logged in. */
export async function currentUser() {
  const c = getClient();
  if (!c) return null;
  const uid = await authUserId(c);
  if (!uid) return null;
  try {
    const { data } = await c
      .from('profiles')
      .select('id, username, display_name, grade')
      .eq('id', uid)
      .maybeSingle();
    if (data) return { id: data.id, username: data.username, displayName: data.display_name, grade: data.grade };
  } catch { /* fall through */ }
  return { id: uid, username: '', displayName: '', grade: null };
}

// --- localStorage helpers ---------------------------------------------

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled. Losing the cache is acceptable.
  }
}

function readRaw(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function getRememberedName() { return readRaw(LS_STUDENT_NAME); }
export function rememberName(name) { writeRaw(LS_STUDENT_NAME, name); }
export function getLastSubject() { return readRaw(LS_LAST_SUBJECT); }
export function rememberSubject(id) { writeRaw(LS_LAST_SUBJECT, id); }
export function getTheme() { return readRaw(LS_THEME); }
export function rememberTheme(theme) { writeRaw(LS_THEME, theme); }

/** Haptics preference. Absent means on — the feature is opt-out, not opt-in. */
export function getHaptics() { return readRaw(LS_HAPTICS) !== 'off'; }
export function rememberHaptics(on) { writeRaw(LS_HAPTICS, on ? 'on' : 'off'); }

/**
 * The APP_VERSION this browser last saw the "מה חדש" screen for.
 *
 * Returns '' — not null — when nothing has been stored yet, same as every
 * other readRaw()-backed getter above. Callers test falsiness, not `=== null`.
 */
export function getSeenVersion() { return readRaw(LS_SEEN_VERSION); }
export function rememberSeenVersion(version) { writeRaw(LS_SEEN_VERSION, version); }

/** The subjects picked in the drawer. Local only — it is a working set, not a record. */
export function getStudySubjects() {
  const list = readLocal(LS_STUDY_SUBJECTS, []);
  return Array.isArray(list) ? list.filter(x => typeof x === 'string') : [];
}
export function rememberStudySubjects(ids) {
  writeLocal(LS_STUDY_SUBJECTS, Array.isArray(ids) ? ids : []);
}

// --- an unfinished quiz -----------------------------------------------

/**
 * Saves a quiz in progress, locally and on the server.
 *
 * Several can be held at once, keyed by the moment the quiz started: leaving a
 * maths quiz to sit an English one is ordinary, and the single slot this
 * replaces destroyed the first the moment the second began.
 *
 * Written locally FIRST and always. The local copy is what makes the app work
 * offline and what answers instantly on the next load; the server copy is what
 * lets a quiz begun on a laptop be finished on a phone. The upload is deliberately
 * not awaited — a slow network must never delay the next question — and it can
 * never throw, because failing to remember must not interrupt a working quiz.
 */
export function saveActiveQuiz(quiz, extra = {}) {
  if (!quiz) return;
  const entry = { savedAt: Date.now(), studentName: quiz.studentName, quiz, ...extra };
  const kept = readEntries().filter(e => quizId(e.quiz) !== quizId(quiz));
  kept.unshift(entry);
  writeLocal(LS_ACTIVE_QUIZ, { v: ACTIVE_QUIZ_VERSION, quizzes: kept.slice(0, ACTIVE_QUIZ_MAX) });
  uploadActiveQuiz(entry);
}

/** A quiz identifies itself by when it began. */
function quizId(quiz) {
  return quiz ? String(quiz.startedAt) : '';
}

/** Pushes one entry to the server. Fire-and-forget; never throws. */
async function uploadActiveQuiz(entry) {
  const c = getClient();
  if (!c) return;
  try {
    const uid = await authUserId(c);
    if (!uid) return;
    await c.from('active_quizzes').upsert({
      user_id: uid,
      student_name: entry.studentName,
      quiz_id: quizId(entry.quiz),
      payload: entry,
      saved_at: new Date(entry.savedAt).toISOString()
    }, { onConflict: 'user_id,quiz_id' });
    online = true;
  } catch {
    online = false;
  }
}

/**
 * Every stored entry, including other students' and expired ones.
 *
 * Migrates the single-slot shape this replaced rather than discarding it, so
 * upgrading mid-quiz does not lose the quiz the student is in the middle of.
 */
function readEntries() {
  const saved = readLocal(LS_ACTIVE_QUIZ, null);
  if (!saved || typeof saved !== 'object') return [];
  if (Array.isArray(saved.quizzes)) return saved.quizzes.filter(e => e && e.quiz);
  if (saved.quiz) return [{ savedAt: saved.savedAt, studentName: saved.studentName, quiz: saved.quiz, lastAnswerIndex: saved.lastAnswerIndex }];
  return [];
}

/** True if this entry can actually be resumed into. */
function resumable(entry, studentName) {
  const quiz = entry && entry.quiz;
  const sound = Boolean(quiz) && Array.isArray(quiz.questions) && quiz.questions.length > 0
    && Number.isInteger(quiz.index) && quiz.index >= 0 && quiz.index < quiz.questions.length;
  return sound
    && entry.studentName === studentName
    && Date.now() - Number(entry.savedAt || 0) < ACTIVE_QUIZ_MAX_AGE_MS;
}

/**
 * This student's unfinished quizzes from local storage alone.
 *
 * Synchronous, so Home can paint the card before the server round trip and the
 * offer never flashes blank on a slow connection.
 */
export function getLocalActiveQuizzes(studentName) {
  return localQuizzes(studentName);
}

/** Local entries for this student, newest first, pruned of the unusable. */
function localQuizzes(studentName) {
  const all = readEntries();
  const mine = all.filter(e => e.studentName === studentName);
  const live = mine.filter(e => resumable(e, studentName));
  if (live.length !== mine.length) {
    const others = all.filter(e => e.studentName !== studentName);
    writeLocal(LS_ACTIVE_QUIZ, { v: ACTIVE_QUIZ_VERSION, quizzes: [...live, ...others] });
  }
  return live.sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
}

/**
 * This student's unfinished quizzes, most recent first, merged across devices.
 *
 * The server is consulted so a quiz begun on one device appears on another, and
 * the two sets are merged by id with the NEWER save winning — answering three
 * more questions on a phone must not be undone by the laptop's older copy.
 * Offline, the local set is returned unchanged, which is the whole point of
 * keeping one.
 *
 * Other students' local entries are left alone throughout: the browser may be
 * shared, and signing in must not discard somebody else's progress.
 */
export async function getActiveQuizzes(studentName) {
  const local = localQuizzes(studentName);
  const c = getClient();
  if (!c) return local;

  let remote;
  try {
    const uid = await authUserId(c);
    if (!uid) return local;
    const { data, error } = await c
      .from('active_quizzes')
      .select('quiz_id, payload, saved_at')
      .eq('user_id', uid)
      .order('saved_at', { ascending: false })
      .limit(ACTIVE_QUIZ_MAX);
    if (error) throw error;
    online = true;
    remote = (data || [])
      .map(r => r.payload)
      .filter(e => e && e.quiz && resumable(e, studentName));
  } catch {
    online = false;
    return local;
  }

  const byId = new Map();
  for (const entry of [...local, ...remote]) {
    const id = quizId(entry.quiz);
    const seen = byId.get(id);
    if (!seen || Number(entry.savedAt || 0) > Number(seen.savedAt || 0)) byId.set(id, entry);
  }
  const merged = [...byId.values()]
    .sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))
    .slice(0, ACTIVE_QUIZ_MAX);

  // The merge result becomes the local cache, so the next load is instant and
  // a quiz pulled from another device survives going offline.
  const others = readEntries().filter(e => e.studentName !== studentName);
  writeLocal(LS_ACTIVE_QUIZ, { v: ACTIVE_QUIZ_VERSION, quizzes: [...merged, ...others] });
  return merged;
}

/** One saved quiz by its id, or null. */
export async function getActiveQuiz(studentName, id = null) {
  const list = await getActiveQuizzes(studentName);
  if (id == null) return list[0] || null;
  return list.find(e => quizId(e.quiz) === String(id)) || null;
}

/**
 * Forgets one saved quiz, or all of this student's when given no id.
 *
 * Removed from the server too — this is the one table whose rows a client may
 * delete, precisely because finishing or abandoning a quiz has to remove it
 * everywhere, not just on the device it happened to end on.
 */
export function clearActiveQuiz(id = null, studentName = null) {
  const all = readEntries();
  const kept = id == null
    ? (studentName == null ? [] : all.filter(e => e.studentName !== studentName))
    : all.filter(e => quizId(e.quiz) !== String(id));
  writeLocal(LS_ACTIVE_QUIZ, { v: ACTIVE_QUIZ_VERSION, quizzes: kept });
  deleteActiveQuiz(id, studentName);
}

/** Removes the server copy. Fire-and-forget; never throws. */
async function deleteActiveQuiz(id, studentName) {
  const c = getClient();
  if (!c) return;
  try {
    const uid = await authUserId(c);
    if (!uid) return;
    let q = c.from('active_quizzes').delete().eq('user_id', uid);
    if (id != null) q = q.eq('quiz_id', String(id));
    else if (studentName != null) q = q.eq('student_name', studentName);
    await q;
    online = true;
  } catch {
    online = false;
  }
}


// --- games -------------------------------------------------------------

/**
 * Posts a sprint score, queueing it if the network is down.
 *
 * Queued rather than dropped for the same reason attempts are: a personal best
 * lost to a dead connection is exactly the result a student most wanted kept.
 */
export async function saveGameScore(result) {
  const c = getClient();
  const queue = () => {
    const pending = readLocal(LS_PENDING_GAMES, []);
    pending.push(result);
    writeLocal(LS_PENDING_GAMES, pending.slice(-50));
  };
  if (!c) { online = false; queue(); return { saved: false }; }
  try {
    const uid = await authUserId(c);
    if (!uid) { queue(); return { saved: false }; }
    const { error } = await c.from('game_scores').insert(gameRow(result, uid));
    if (error) throw error;
    online = true;
    return { saved: true };
  } catch {
    online = false;
    queue();
    return { saved: false };
  }
}

/**
 * The columns game_scores actually has.
 *
 * Spelled out rather than spreading the result object: gameResult() also
 * returns `accuracy`, which is derived for the summary screen and is NOT a
 * column. Spreading it made Postgres reject the whole insert, so every score
 * silently went to the offline queue and the board stayed empty — with the app
 * reporting "no connection" when the connection was fine.
 */
function gameRow(result, uid) {
  return {
    user_id: uid,
    student_name: result.student_name,
    mode: result.mode,
    subject: result.subject,
    grade: result.grade,
    difficulty: result.difficulty,
    score: result.score,
    correct: result.correct,
    wrong: result.wrong,
    best_streak: result.best_streak,
    duration_seconds: result.duration_seconds
  };
}

/** Sends any queued scores. Called by flushPending. */
async function flushGames() {
  const pending = readLocal(LS_PENDING_GAMES, []);
  if (pending.length === 0) return 0;
  const c = getClient();
  if (!c) return 0;
  try {
    const uid = await authUserId(c);
    if (!uid) return 0;
    const { error } = await c.from('game_scores').insert(pending.map(r => gameRow(r, uid)));
    if (error) throw error;
    writeLocal(LS_PENDING_GAMES, []);
    online = true;
    return pending.length;
  } catch {
    online = false;
    return 0;
  }
}

/**
 * The board for one mode, subject and difficulty.
 *
 * Filtered rather than ranked across everything: a sprint at "קל מאוד" and one
 * at "מאתגר" are not comparable, and mixing them would put the easiest setting
 * permanently on top. A null difficulty is its OWN board, not "any".
 */
export async function getGameBoard(mode, subject, difficulty = null, limit = 20) {
  const c = getClient();
  if (!c) { online = false; return []; }
  try {
    let q = c.from('game_scores')
      .select('student_name, score, correct, wrong, best_streak, difficulty, created_at')
      .eq('mode', mode)
      .eq('subject', subject);
    q = difficulty == null ? q.is('difficulty', null) : q.eq('difficulty', Number(difficulty));
    for (const name of LEADERBOARD_EXCLUDED_NAMES) q = q.neq('student_name', name);
    const { data, error } = await q.order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    online = true;
    return data || [];
  } catch {
    online = false;
    return [];
  }
}

/**
 * Every game this student has played, newest first.
 *
 * Filtered by user_id rather than by student_name: the board shows names
 * because that is what a board is for, but a personal statistic must not fold
 * in a second student who happens to share a first name.
 */
export async function getMyGameScores(limit = 200) {
  const c = getClient();
  if (!c) { online = false; return []; }
  try {
    const uid = await authUserId(c);
    if (!uid) return [];
    const { data, error } = await c.from('game_scores')
      .select('mode, subject, grade, difficulty, score, correct, wrong, best_streak, duration_seconds, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    online = true;
    return data || [];
  } catch {
    online = false;
    return [];
  }
}

// --- questions the student has just been served ------------------------

/**
 * Remembering what was asked, so the next quiz asks something else.
 *
 * js/quiz.js already guarantees no question appears twice inside ONE quiz. What
 * it could not know is what an earlier quiz asked, because every quiz started
 * with an empty memory — measured across four twenty-question quizzes, that
 * meant 3% repeats in maths grade 5 but 37% in Hebrew grade 4 and 65% in
 * מטלת הכתיבה. Children noticed, which is how this was found.
 *
 * SERVER-BACKED, keyed on the login rather than the device. A child who does a
 * quiz on the laptop and another on the phone is one student having one sitting,
 * and a per-device note could not see that. localStorage is still written, but
 * now as a cache and an offline queue rather than as the record.
 *
 * The read costs nothing extra: js/app.js already awaits fetchBankQuestions
 * before a quiz can start, so this rides along in the same Promise.all.
 *
 * Scoped by subject and grade, so working on English does not use up the budget
 * for maths. NOT scoped by difficulty: the same question at the same level is
 * exactly what repeats, and the difficulty picker should not reset the memory.
 */
function recentScope(subject, grade) {
  return `${subject}|${grade}`;
}

/** The locally cached window for a scope. */
function localRecent(subject, grade) {
  const all = readLocal(LS_RECENT_QUESTIONS, {});
  const list = all[recentScope(subject, grade)];
  return Array.isArray(list) ? list : [];
}

/** Writes a scope's window to the local cache, oldest first and capped. */
function writeLocalRecent(subject, grade, fingerprints) {
  const all = readLocal(LS_RECENT_QUESTIONS, {});
  all[recentScope(subject, grade)] = fingerprints.slice(-RECENT_QUESTIONS_MAX);
  writeLocal(LS_RECENT_QUESTIONS, all);
}

/**
 * Merges a batch into a window. Shared by the local cache and the offline queue,
 * and mirrors what public.remember_questions does in SQL.
 *
 * Re-serving a question moves it to the BACK. Left near the front it would fall
 * off the window next and come straight back — the opposite of the point.
 */
function mergeWindow(previous, batch) {
  const fresh = new Set(batch);
  return [...previous.filter(fp => !fresh.has(fp)), ...batch].slice(-RECENT_QUESTIONS_MAX);
}

/**
 * Fingerprints served recently for this subject and grade, across every device
 * this student logs in from.
 *
 * The server's copy and this device's cache are UNIONED rather than the server
 * simply winning. Two reasons: a batch still sitting in the offline queue is
 * real history the server has not heard about yet, and a read that failed should
 * degrade to "what this device knows" instead of to "nothing".
 */
export async function getRecentQuestions(subject, grade) {
  const cached = localRecent(subject, grade);
  const c = getClient();
  if (!c) return new Set(cached);

  try {
    // No user_id filter and no getUser() call. The select policy is
    // `auth.uid() = user_id`, so the query can only ever see this student's row
    // — asking the client who it is first would add a token-validation round
    // trip to a read that sits on the critical path before a quiz can start.
    const { data, error } = await c.from('recent_questions')
      .select('fingerprints')
      .eq('subject', subject)
      .eq('grade', Number(grade))
      .maybeSingle();
    if (error) throw error;
    online = true;
    const server = data && Array.isArray(data.fingerprints) ? data.fingerprints : [];
    // Server first, so anything this device has that the server lacks stays at
    // the recent end where it belongs.
    const merged = mergeWindow(server, cached);
    writeLocalRecent(subject, grade, merged);
    return new Set(merged);
  } catch {
    online = false;
    return new Set(cached);
  }
}

/**
 * Records what was just served.
 *
 * Local first and synchronously, so the next quiz in this sitting is protected
 * even with no network and even if the request below is still in flight.
 *
 * The server side is one RPC that merges in SQL rather than a read-modify-write
 * here. That is what makes two devices safe: if the phone read, merged and wrote
 * while the laptop did the same, the second write would drop the first one's
 * questions and the child would see them again.
 *
 * Never throws and never awaited by callers — a quiz must not wait on
 * bookkeeping, and a failed write is queued, not lost.
 */
export function rememberQuestions(subject, grade, fingerprints) {
  if (!fingerprints || fingerprints.length === 0) return;
  writeLocalRecent(subject, grade, mergeWindow(localRecent(subject, grade), fingerprints));
  pushRecentToServer(subject, grade, fingerprints);
}

/** Sends one batch, queueing it for flushPending if that fails. */
async function pushRecentToServer(subject, grade, fingerprints) {
  const c = getClient();
  if (!c) { queueRecent(subject, grade, fingerprints); return; }
  try {
    const { error } = await c.rpc('remember_questions', {
      p_subject: subject,
      p_grade: Number(grade),
      p_fingerprints: fingerprints
    });
    if (error) throw error;
    online = true;
  } catch {
    online = false;
    queueRecent(subject, grade, fingerprints);
  }
}

function queueRecent(subject, grade, fingerprints) {
  const queue = readLocal(LS_PENDING_RECENT, []);
  queue.push({ subject, grade: Number(grade), fingerprints });
  // Bounded: this is advisory data, and an unbounded queue on a device that has
  // been offline for weeks would grow without limit for no benefit.
  writeLocal(LS_PENDING_RECENT, queue.slice(-40));
}

/** Sends whatever the queue is holding. Returns how many batches went through. */
async function flushRecent(c) {
  const queue = readLocal(LS_PENDING_RECENT, []);
  if (queue.length === 0) return 0;
  const stillPending = [];
  let flushed = 0;
  for (const item of queue) {
    try {
      const { error } = await c.rpc('remember_questions', {
        p_subject: item.subject,
        p_grade: Number(item.grade),
        p_fingerprints: item.fingerprints
      });
      if (error) throw error;
      flushed++;
    } catch {
      stillPending.push(item);
    }
  }
  writeLocal(LS_PENDING_RECENT, stillPending);
  return flushed;
}

// --- topics the student has since got right ---------------------------

/** Key for the cleared map. Grade is left out on purpose: proving a topic at
 *  one grade is evidence about the topic, not about that year. */
function clearedKey(subject, topic) {
  return `${subject || ''}|${topic}`;
}

/** `subject|topic` -> when it was last answered cleanly. */
export function getClearedTopics() {
  const map = readLocal(LS_TOPIC_CLEARED, {});
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

/**
 * Records that these topics were just answered cleanly.
 *
 * Called with the topics an attempt covered without a single mistake, which is
 * what finally lets a weak topic leave the panel.
 */
/**
 * Records how each topic went in the attempt that just finished.
 *
 * Stores the MISS COUNT, not merely "cleared". The panel then reports the most
 * recent assessment of a topic rather than a lifetime tally, which is what
 * makes a drill visibly change the number: nine right out of ten takes the chip
 * from "(5)" to "(1)" instead of pushing it to "(6)".
 */
export function markTopicsAssessed(subject, grade, assessments, at = Date.now()) {
  if (!assessments || assessments.length === 0) return;
  const map = getClearedTopics();
  for (const a of assessments) {
    // grade rides along so a topic whose historical misses have been
    // superseded can still be drilled from the chip: without it the panel
    // would know the topic is weak but not where to practise it.
    map[clearedKey(subject, a.topic)] = { at, missed: Number(a.missed) || 0, grade: Number(grade) };
  }
  writeLocal(LS_TOPIC_CLEARED, map);
}




function cacheAttemptLocally(result) {
  const cached = readLocal(LS_LOCAL_ATTEMPTS, []);
  cached.push({ ...result, created_at: new Date().toISOString() });
  writeLocal(LS_LOCAL_ATTEMPTS, cached.slice(-HISTORY_PAGE_SIZE));
}

function queueAttempt(result, errors) {
  const pending = readLocal(LS_PENDING_ATTEMPTS, []);
  pending.push({ result, errors });
  writeLocal(LS_PENDING_ATTEMPTS, pending.slice(-HISTORY_PAGE_SIZE));
  cacheAttemptLocally(result);
}

function localAttempts(subject, grade) {
  const rows = readLocal(LS_LOCAL_ATTEMPTS, []);
  const filtered = rows.filter(r =>
    (!subject || r.subject === subject) &&
    (!grade || Number(r.grade) === Number(grade)) &&
    !LEADERBOARD_EXCLUDED_NAMES.includes(r.student_name)
  );
  return [...filtered]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, HISTORY_PAGE_SIZE);
}

// --- reads ------------------------------------------------------------

/**
 * Bank rows for one subject, at the chosen grade and the one below it.
 *
 * The track filter is not optional decoration: a bank row stores the track it
 * was generated for, and a row generated for track N only ever contains topics
 * taught at track N or below. So `track <= requested` is exactly the set a
 * student on that track is taught. Without it, bank rows bypass the gating that
 * the generator pool applies, and a 3-unit student is served calculus for the
 * BANK_RATIO share of the quiz.
 *
 * Rows with a NULL track are not track-specific (every grade below 10) and are
 * always eligible.
 */
export async function fetchBankQuestions(subject, grade, difficulty = null, track = null) {
  const c = getClient();
  if (!c) {
    online = false;
    return [];
  }
  const g = Number(grade);
  try {
    let query = c
      .from('question_bank')
      .select('id, subject, grade, difficulty, track, topic, text, options, correct_index, explanation')
      .eq('subject', subject)
      .in('grade', [g, g - 1])
      .eq('active', true);
    if (difficulty) query = query.eq('difficulty', Number(difficulty));
    if (track) query = query.or(`track.is.null,track.lte.${Number(track)}`);
    const { data, error } = await query;
    if (error) throw error;
    online = true;
    return data || [];
  } catch {
    online = false;
    return [];
  }
}

/** Recent results for one subject, newest first, optionally filtered by grade. */
export async function getLeaderboard(subject, grade, difficulty = null) {
  const c = getClient();
  if (!c) {
    online = false;
    return { rows: localAttempts(subject, grade), fromCache: true };
  }
  try {
    let query = c
      .from('attempts')
      .select('student_name, subject, grade, difficulty, score, total_questions, percent, created_at')
      .order('created_at', { ascending: false })
      .limit(HISTORY_PAGE_SIZE);
    if (subject) query = query.eq('subject', subject);
    if (grade) query = query.eq('grade', Number(grade));
    if (difficulty) query = query.eq('difficulty', Number(difficulty));
    for (const name of LEADERBOARD_EXCLUDED_NAMES) query = query.neq('student_name', name);

    const { data, error } = await query;
    if (error) throw error;
    online = true;
    return { rows: data || [], fromCache: false };
  } catch {
    online = false;
    return { rows: localAttempts(subject, grade), fromCache: true };
  }
}

const HISTORY_COLUMNS =
  'id, student_name, subject, grade, difficulty, score, total_questions, percent, duration_seconds, created_at';

/**
 * One student's attempts across all subjects, newest first.
 *
 * Asked for WITH credited_points and again without it if that fails.
 *
 * PostgREST rejects the whole select when one column does not exist, so the
 * moment this JavaScript deploys ahead of its migration — and the site deploys
 * on a push while the schema is applied by hand — every dashboard would fall
 * back to local cache and most would render empty. The retry costs one round
 * trip in exactly that window and none afterwards. It can be deleted once the
 * column is everywhere; the dashboard simply loses the drill-recovery card
 * until then.
 */
export async function getStudentHistory(name) {
  const c = getClient();
  const localRows = () =>
    readLocal(LS_LOCAL_ATTEMPTS, []).filter(r => r.student_name === name).reverse();

  if (!c) {
    online = false;
    return { rows: localRows(), fromCache: true };
  }
  const fetch = async columns => {
    const { data, error } = await c
      .from('attempts')
      .select(columns)
      .eq('user_id', await authUserId(c))
      .order('created_at', { ascending: false })
      .limit(HISTORY_PAGE_SIZE);
    if (error) throw error;
    return data || [];
  };
  try {
    const uid = await authUserId(c);
    if (!uid) { online = true; return { rows: [], fromCache: false }; }
    let rows;
    try {
      rows = await fetch(`${HISTORY_COLUMNS}, credited_points`);
    } catch {
      rows = await fetch(HISTORY_COLUMNS);
    }
    online = true;
    return { rows, fromCache: false };
  } catch {
    online = false;
    return { rows: localRows(), fromCache: true };
  }
}

/** Every error topic across one student's attempts. Drives the dashboard's
 *  strengths/weaknesses. Degrades to [] offline. */
export async function getStudentErrorTopics(name) {
  const c = getClient();
  if (!c) {
    online = false;
    return [];
  }
  try {
    const uid = await authUserId(c);
    if (!uid) { online = true; return []; }
    const { data, error } = await c
      .from('attempt_errors')
      // attempt_id and created_at come back so analytics can bound the list to
      // recent attempts. Without them every mistake a student ever made counted
      // forever, and a topic they had since mastered never left the panel.
      .select('topic, subject, grade, attempt_id, attempts!inner(user_id, subject, grade, created_at)')
      .eq('attempts.user_id', uid)
      .order('created_at', { foreignTable: 'attempts', ascending: false })
      .limit(500);
    if (error) throw error;
    online = true;
    return (data || []).map(r => ({
      topic: r.topic,
      attemptId: r.attempt_id,
      at: r.attempts ? r.attempts.created_at : undefined,
      // The error's own subject wins. The attempt is only a fallback now, for
      // rows written before the column existed — and for a mixed attempt it is
      // the WRONG answer, since its subject is 'mixed', which has no
      // generators and would make every chip from it drill nothing.
      subject: r.subject || (r.attempts ? r.attempts.subject : undefined),
      grade: r.grade == null ? (r.attempts ? r.attempts.grade : undefined) : r.grade
    }));
  } catch {
    online = false;
    return [];
  }
}

/** The wrong answers from one past attempt. Lazy-loaded when a row expands. */
export async function getAttemptErrors(attemptId) {
  const c = getClient();
  if (!c) return [];
  try {
    const { data, error } = await c
      .from('attempt_errors')
      .select('topic, question_text, correct_answer, chosen_answer, explanation')
      .eq('attempt_id', attemptId)
      .order('id', { ascending: true });
    if (error) throw error;
    online = true;
    return data || [];
  } catch {
    online = false;
    return [];
  }
}

// --- writes -----------------------------------------------------------

async function insertAttempt(c, result, errors) {
  const uid = await authUserId(c);

  const { data, error } = await c
    .from('attempts')
    .insert({ ...result, user_id: uid })
    .select('id')
    .single();
  if (error) throw error;

  if (errors.length > 0) {
    const rows = errors.map(e => ({ ...e, attempt_id: data.id }));
    const { error: errorsError } = await c.from('attempt_errors').insert(rows);
    if (errorsError) throw errorsError;
  }
  return data.id;
}

/**
 * Persists one completed quiz. Returns { saved: boolean }.
 * On failure the attempt is queued locally and retried by flushPending().
 */
export async function saveAttempt(result, errors) {
  const c = getClient();
  if (!c) {
    online = false;
    queueAttempt(result, errors);
    return { saved: false };
  }
  try {
    const attemptId = await insertAttempt(c, result, errors);
    online = true;
    cacheAttemptLocally(result);
    return { saved: true, attemptId };
  } catch {
    online = false;
    queueAttempt(result, errors);
    return { saved: false };
  }
}

// --- topic results ------------------------------------------------------
//
// The counterpart to attempt_errors: how many questions a topic was ASKED, not
// only how many were missed. Without a denominator the dashboard can rank
// topics by how often they go wrong but cannot say how well any of them is
// going, which is the difference between a list of complaints and a measure of
// mastery.

/**
 * Adds one finished quiz's per-topic tallies to the running totals.
 *
 * Fire-and-forget and never throws: this is a statistic, and failing to record
 * one must not disturb the summary screen the student is looking at. Nothing
 * queues it offline either — unlike an attempt, a lost tally costs a little
 * precision in a long-run average rather than a result the student earned.
 */
export async function recordTopicResults(subject, grade, assessments) {
  if (!assessments || assessments.length === 0) return;
  const c = getClient();
  if (!c) { online = false; return; }
  try {
    const rows = assessments.map(a => ({
      topic: a.topic,
      asked: Number(a.asked) || 0,
      correct: Math.max(0, (Number(a.asked) || 0) - (Number(a.missed) || 0))
    }));
    const { error } = await c.rpc('record_topic_results', {
      p_subject: subject,
      p_grade: Number(grade),
      p_rows: rows
    });
    if (error) throw error;
    online = true;
  } catch {
    online = false;
  }
}

/** Every topic this student has been assessed on. Drives the mastery table. */
export async function getTopicResults() {
  const c = getClient();
  if (!c) { online = false; return []; }
  try {
    const uid = await authUserId(c);
    if (!uid) { online = true; return []; }
    const { data, error } = await c
      .from('topic_results')
      .select('subject, grade, topic, asked, correct, last_at')
      .eq('user_id', uid)
      .order('last_at', { ascending: false })
      .limit(400);
    if (error) throw error;
    online = true;
    return data || [];
  } catch {
    online = false;
    return [];
  }
}

// --- reinforcement credit ---------------------------------------------
//
// A drill on an attempt's weak topics is not a quiz of its own: it re-tests
// what that attempt got wrong, so it updates that attempt instead of inserting
// a second row. This is what stops a 100-question quiz and its 10-question
// follow-up from reading as "10 / 10" next to a "86 / 100" nobody connects to
// it — the denominator stays the length of the quiz the student actually sat.

/**
 * Applies one drill's result to the attempt it drilled.
 *
 * `fraction` is the drill's own score over its own length. The attempt is
 * re-read here rather than passed in because it may have been credited by an
 * earlier drill, on this device or another, and crediting a stale score would
 * hand back ground that has already been recovered.
 *
 * New errors made during the drill are attached to the SAME attempt, so the
 * weak-topic chips and "הצג שגיאות" keep working off one row. Deduped on the
 * question text: drilling the same topic twice must not double-count a question
 * the student has missed once.
 */
export async function creditAttempt(attemptId, fraction, errors = []) {
  const c = getClient();
  if (!c) {
    online = false;
    queueCredit(attemptId, fraction, errors);
    return { saved: false };
  }
  try {
    const { data: row, error } = await c
      .from('attempts')
      .select('id, score, total_questions, credited_points')
      .eq('id', attemptId)
      .single();
    if (error) throw error;

    // Errors first, score second, because only the first half is idempotent.
    // A failure between the two queues the credit for retry, and attaching the
    // same errors again is deduped to nothing — whereas a score credited twice
    // would hand back ground that was already recovered.
    await attachErrors(c, attemptId, errors);

    const credited = creditedAttempt(row.score, row.total_questions, fraction);
    // .select().single() is load-bearing, not decoration. An update that row
    // level security rejects touches no rows and reports no error, so without a
    // row coming back this would return saved: true for a write that did not
    // happen and the credit would be dropped instead of queued.
    // The delta, accumulated: the dashboard reports how much of a score was
    // recovered by drilling rather than earned in the sitting, and `score`
    // alone cannot tell the two apart.
    const recovered = Math.round((credited.score - Number(row.score)) * 100) / 100;
    const { error: updateError } = await c
      .from('attempts')
      .update({
        score: credited.score,
        percent: credited.percent,
        credited_points: Math.round((Number(row.credited_points) + recovered) * 100) / 100
      })
      .eq('id', attemptId)
      .select('id')
      .single();
    if (updateError) throw updateError;
    online = true;
    return { saved: true, ...credited, recovered, total_questions: row.total_questions };
  } catch {
    online = false;
    queueCredit(attemptId, fraction, errors);
    return { saved: false };
  }
}

/** Adds drill errors to an existing attempt, skipping questions already on it. */
async function attachErrors(c, attemptId, errors) {
  if (!errors || errors.length === 0) return;
  const { data: existing } = await c
    .from('attempt_errors')
    .select('question_text')
    .eq('attempt_id', attemptId);
  const seen = new Set((existing || []).map(e => e.question_text));
  const rows = errors
    .filter(e => !seen.has(e.question_text))
    .map(e => ({ ...e, attempt_id: attemptId }));
  if (rows.length === 0) return;
  const { error } = await c.from('attempt_errors').insert(rows);
  if (error) throw error;
}

function queueCredit(attemptId, fraction, errors) {
  const pending = readLocal(LS_PENDING_CREDITS, []);
  pending.push({ attemptId, fraction, errors: errors || [] });
  writeLocal(LS_PENDING_CREDITS, pending.slice(-HISTORY_PAGE_SIZE));
}

/** Retries queued drill credits. Same shape as flushPendingLessons. */
async function flushPendingCredits(c) {
  const pending = readLocal(LS_PENDING_CREDITS, []);
  if (pending.length === 0) return 0;

  const stillPending = [];
  let flushed = 0;
  for (const item of pending) {
    // Through creditAttempt rather than inline, so a credit that was queued
    // offline is applied to the score the server holds NOW.
    const { saved } = await creditAttempt(item.attemptId, item.fraction, item.errors);
    if (saved) flushed++;
    else stillPending.push(item);
  }
  writeLocal(LS_PENDING_CREDITS, stillPending);
  return flushed;
}

/**
 * The most recent attempt of this student that missed `topic` and still has
 * points to recover.
 *
 * Drills started from a weak-topic chip are not launched from any one attempt,
 * so the attempt to credit has to be found. Attempts already back at full marks
 * are skipped: crediting one is arithmetically a no-op, and it would attach the
 * drill's errors to a row that reads as flawless.
 */
export async function findDrillTarget(subject, grade, topic) {
  const c = getClient();
  if (!c) { online = false; return null; }
  try {
    const uid = await authUserId(c);
    if (!uid) { online = true; return null; }
    const { data, error } = await c
      .from('attempt_errors')
      .select('attempt_id, attempts!inner(id, score, total_questions, user_id, subject, grade)')
      .eq('topic', topic)
      .eq('attempts.user_id', uid)
      .eq('attempts.subject', subject)
      .eq('attempts.grade', Number(grade))
      .order('attempt_id', { ascending: false })
      .limit(20);
    if (error) throw error;
    online = true;
    // id descending is newest first: attempts.id is a bigserial.
    const hit = (data || []).find(r =>
      r.attempts && Number(r.attempts.score) < Number(r.attempts.total_questions));
    return hit ? hit.attempts.id : null;
  } catch {
    online = false;
    return null;
  }
}

/** Retries queued lesson completions. Folded into flushPending so the single
 *  'online' listener drains both queues. */
async function flushPendingLessons(c) {
  const pending = readLocal(LS_PENDING_LESSONS, []);
  if (pending.length === 0) return 0;

  const stillPending = [];
  let flushed = 0;
  for (const record of pending) {
    try {
      await upsertLessonProgress(c, record);
      flushed++;
    } catch {
      stillPending.push(record);
    }
  }
  writeLocal(LS_PENDING_LESSONS, stillPending);
  return flushed;
}

/** Retries queued attempts. Returns the number of ATTEMPTS flushed. */
export async function flushPending() {
  const pending = readLocal(LS_PENDING_ATTEMPTS, []);
  const lessonsWaiting = readLocal(LS_PENDING_LESSONS, []).length;
  const gamesWaiting = readLocal(LS_PENDING_GAMES, []).length;
  const recentWaiting = readLocal(LS_PENDING_RECENT, []).length;
  const creditsWaiting = readLocal(LS_PENDING_CREDITS, []).length;
  if (pending.length === 0 && lessonsWaiting === 0 && gamesWaiting === 0
      && recentWaiting === 0 && creditsWaiting === 0) return 0;

  const c = getClient();
  if (!c) return 0;

  // Deliberately not counted in the return value: that number drives a banner
  // telling the student their results were saved, and a window of already-asked
  // questions is not a result. It just needs to reach the server.
  await flushRecent(c);

  const stillPending = [];
  let flushed = 0;

  for (const item of pending) {
    try {
      await insertAttempt(c, item.result, item.errors || []);
      flushed++;
    } catch {
      stillPending.push(item);
    }
  }

  writeLocal(LS_PENDING_ATTEMPTS, stillPending);
  // Lessons and game scores are drained too but deliberately not counted: the
  // return value feeds the "N results waiting to sync" banner, which is about
  // attempts.
  // Credits are drained AFTER the queued attempts: a drill can only credit an
  // attempt that exists on the server, and offline both can be waiting at once.
  const lessonsFlushed = await flushPendingLessons(c);
  const gamesFlushed = await flushGames();
  const creditsFlushed = await flushPendingCredits(c);
  if (flushed > 0 || lessonsFlushed > 0 || gamesFlushed > 0 || creditsFlushed > 0) online = true;
  return flushed;
}

/** How many results are waiting to sync. Drives the offline banner. A drill
 *  credit counts: it is a result the student earned and cannot see yet. */
export function pendingCount() {
  return readLocal(LS_PENDING_ATTEMPTS, []).length
    + readLocal(LS_PENDING_CREDITS, []).length;
}

// --- lesson progress --------------------------------------------------
// Same failure policy as attempts: never throws, queues offline, retried by
// flushPending. The local mirror is written FIRST on every path, because the
// catalogue must show ✓ נלמד the instant the student finishes — waiting for a
// round trip to decide whether a lesson counts would make the tick flicker.

function cacheLessonLocally(record) {
  const cached = readLocal(LS_LESSON_PROGRESS, []);
  // One row per lesson: re-studying updates in place, mirroring the unique
  // (user_id, lesson_id) constraint the table enforces.
  const rest = cached.filter(r => r.lesson_id !== record.lesson_id);
  rest.push({ ...record, completed_at: new Date().toISOString() });
  writeLocal(LS_LESSON_PROGRESS, rest);
}

async function upsertLessonProgress(c, record) {
  const uid = await authUserId(c);
  if (!uid) throw new Error('not signed in');
  const { error } = await c
    .from('lesson_progress')
    .upsert({ ...record, user_id: uid }, { onConflict: 'user_id,lesson_id' });
  if (error) throw error;
}

/** Records one finished lesson. Returns { saved: boolean }. */
export async function saveLessonProgress(record) {
  cacheLessonLocally(record);

  const c = getClient();
  if (!c) {
    online = false;
    queueLesson(record);
    return { saved: false };
  }
  try {
    await upsertLessonProgress(c, record);
    online = true;
    return { saved: true };
  } catch {
    online = false;
    queueLesson(record);
    return { saved: false };
  }
}

function queueLesson(record) {
  const pending = readLocal(LS_PENDING_LESSONS, []);
  const rest = pending.filter(r => r.lesson_id !== record.lesson_id);
  rest.push(record);
  writeLocal(LS_PENDING_LESSONS, rest.slice(-HISTORY_PAGE_SIZE));
}

/** Merges rows into a Map keyed by lesson_id, newest progress winning. */
function mergeProgress(rows) {
  const byLesson = new Map();
  for (const row of rows) {
    const existing = byLesson.get(row.lesson_id);
    // Furthest wins, not latest: re-opening a finished lesson and closing it on
    // card one must not demote it from נלמד back to "in progress".
    if (!existing || (row.cards_seen ?? 0) > (existing.cards_seen ?? 0) || (row.completed && !existing.completed)) {
      byLesson.set(row.lesson_id, { ...existing, ...row });
    }
  }
  return byLesson;
}

/**
 * This student's lesson progress, as lesson_id -> row.
 *
 * Merged from server and cache rather than picking one: the cache holds
 * progress that has not synced yet, and the server holds progress from the
 * student's other devices. Either alone would show a lesson as untouched that
 * the student has in fact worked through.
 */
export async function getLessonProgress() {
  const local = readLocal(LS_LESSON_PROGRESS, []);

  const c = getClient();
  if (!c) {
    online = false;
    return mergeProgress(local);
  }
  try {
    const uid = await authUserId(c);
    if (!uid) { online = true; return mergeProgress(local); }
    const { data, error } = await c
      .from('lesson_progress')
      .select('lesson_id, cards_seen, cards_total, completed, checks_correct, checks_total')
      .eq('user_id', uid);
    if (error) throw error;
    online = true;
    return mergeProgress([...(data || []), ...local]);
  } catch {
    online = false;
    return mergeProgress(local);
  }
}
