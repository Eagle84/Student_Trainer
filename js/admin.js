/**
 * Every admin-console Supabase call. No DOM access, same contract as db.js:
 * nothing here throws at the caller, and every write reports { ok, error }.
 *
 * Unlike db.js there is no offline queue. A student's attempt must survive a
 * dead connection because the student cannot be asked to try again later; an
 * admin publishing a subject can be, and silently replaying content writes
 * after a reconnect is a much worse failure than an error message.
 *
 * SECURITY: nothing in this file is a gate. `isAdmin()` decides whether to draw
 * a menu, and that is all it decides — every table it touches is closed by the
 * RLS policies in sql/admin.sql, so a student who calls these functions from
 * the console gets an empty list and a refused write.
 */
import { supabaseClient } from './db.js';

/** Hebrew for the failures an admin can actually act on. */
function writeError(error) {
  const m = (error && error.message) || '';
  if (/row-level security|not authorised|42501/i.test(m)) return 'אין לך הרשאה לפעולה הזו.';
  if (/duplicate key|already exists|unique/i.test(m)) return 'המזהה הזה כבר קיים.';
  if (/subject_id_not_reserved/i.test(m)) return 'המזהה שמור למקצוע קיים בקוד. בחר מזהה אחר.';
  if (/subject_id_shape/i.test(m)) return 'מזהה חייב להיות אותיות אנגליות קטנות, ספרות, מקף או קו תחתון.';
  if (/subject_name_valid/i.test(m)) return 'שם המקצוע חייב להיות עד 40 תווים, בלי < או >.';
  if (/options_is_four/i.test(m)) return 'לכל שאלה חייבות להיות בדיוק ארבע תשובות.';
  if (/correct_valid/i.test(m)) return 'התשובה הנכונה חייבת להיות אחת מארבע האפשרויות.';
  if (/לפחות מנהל אחד|של עצמך|לעצמך/.test(m)) return m;
  if (/user_request_username_valid/i.test(m)) return 'שם משתמש: 3-20 תווים, אותיות אנגליות קטנות, ספרות, נקודה או קו תחתון.';
  if (/violates check constraint/i.test(m)) return 'אחד השדות לא עומד בכללי הטבלה.';
  return 'הפעולה נכשלה. נסה שוב.';
}

// --- who is an admin ---------------------------------------------------

/**
 * True if the signed-in user may open the console.
 *
 * Reads the caller's own admins row, which is the only row the RLS policy lets
 * anyone see. A student gets zero rows and `false`; so does a signed-out
 * visitor, and so does anyone whose connection is down — failing closed is the
 * right default for a menu that writes to the question bank.
 */
export async function myRole() {
  const c = supabaseClient();
  if (!c) return null;
  try {
    const { data: auth } = await c.auth.getUser();
    const uid = auth && auth.user ? auth.user.id : null;
    if (!uid) return null;
    const { data, error } = await c
      .from('admins')
      .select('user_id, role')
      .eq('user_id', uid)
      .maybeSingle();
    if (error || !data) return null;
    return { id: uid, role: data.role || 'admin' };
  } catch {
    return null;
  }
}

/** True for anyone on the staff list — admin or editor. */
export async function isAdmin() {
  return Boolean(await myRole());
}

// --- people ------------------------------------------------------------

/**
 * Every account, with its staff role beside it.
 *
 * Reads the staff_directory view, which joins profiles to admins under the
 * caller's own permissions — see the security_invoker note in
 * sql/admin-users.sql. A student who called this would get the profile list
 * they can already see and a null role against every row.
 */
export async function listPeople() {
  const c = supabaseClient();
  if (!c) return [];
  try {
    const { data, error } = await c
      .from('staff_directory')
      .select('id, username, display_name, grade, role, role_granted_at, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

/** Grants or changes a staff role. */
export async function setRole(userId, role) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  try {
    const { data: auth } = await c.auth.getUser();
    const { error } = await c.from('admins').upsert({
      user_id: userId,
      role,
      granted_by: auth && auth.user ? auth.user.id : null
    }, { onConflict: 'user_id' });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

/** Removes someone from the staff list entirely. */
export async function revokeRole(userId) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  try {
    const { error } = await c.from('admins').delete().eq('user_id', userId);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

/**
 * Asks the worker to create an account.
 *
 * Creating an auth user needs the service role key, which lives on the machine
 * running exeScraper and must never reach a browser. So this queues a request
 * rather than doing the work — the same arrangement as an ingest job, for the
 * same reason.
 */
export async function requestUser({ username, displayName, grade, role, password }) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  try {
    const { data: auth } = await c.auth.getUser();
    const { data, error } = await c.from('user_requests').insert({
      username: String(username).trim().toLowerCase(),
      display_name: String(displayName).trim(),
      grade: grade ? Number(grade) : null,
      role: role || null,
      password,
      created_by: auth && auth.user ? auth.user.id : null
    }).select('id').single();
    if (error) throw error;
    return { ok: true, id: data.id };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

/** Account requests the worker has not finished yet. */
export async function listUserRequests() {
  const c = supabaseClient();
  if (!c) return [];
  try {
    const { data, error } = await c
      .from('user_requests')
      .select('id, username, display_name, grade, role, status, error, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

// --- subjects ----------------------------------------------------------

/**
 * Subjects created from the console, newest first.
 *
 * `includeDrafts` exists because the same query serves two callers with
 * opposite needs: the console lists everything it can see, while boot needs the
 * published ones only — a half-written draft must never reach the student
 * picker just because its author happens to be the one browsing.
 */
export async function listSubjects({ includeDrafts = true } = {}) {
  const c = supabaseClient();
  if (!c) return [];
  try {
    let query = c
      .from('subjects')
      .select('id, name, dir, options_dir, grades, gradeless, blurb, status, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (!includeDrafts) query = query.eq('status', 'published');
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

/** The subjects a student is allowed to see. Called at boot; never throws. */
export async function listPublishedSubjects() {
  return listSubjects({ includeDrafts: false });
}

/**
 * Creates or replaces one subject row.
 *
 * Upsert rather than insert-or-update: the console's form is the same form for
 * both, and the id is the primary key, so "save" means the same thing either
 * way. Status is not settable here — publishing is its own deliberate action.
 */
export async function saveSubject(subject) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  try {
    const { data: auth } = await c.auth.getUser();
    const row = {
      id: subject.id,
      name: subject.name,
      dir: subject.dir,
      options_dir: subject.optionsDir,
      grades: subject.grades,
      gradeless: Boolean(subject.gradeless),
      blurb: subject.blurb || null,
      created_by: auth && auth.user ? auth.user.id : null
    };
    // The status column is left out on purpose: on an update, omitting it keeps
    // whatever the row already had, so editing a published subject does not
    // quietly unpublish it, and editing a draft does not publish it.
    const { error } = await c.from('subjects').upsert(row, { onConflict: 'id' });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

/**
 * Removes a subject created here, and everything that belongs to it.
 *
 * Refuses rather than orphans. `subject` is unconstrained text in every table
 * that records what a student did, so nothing in the database stops a delete
 * or cleans up after one — see sql/admin-subject-delete.sql, which is where
 * the rule actually lives. This function's job is to turn its two refusals
 * into sentences, and to report which refusal it was so the caller can decide
 * whether there is a second question worth asking.
 */
export async function deleteSubject(id, { purgeQuestions = false } = {}) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  try {
    const { data, error } = await c.rpc('delete_subject', {
      subject_id: id,
      purge_questions: Boolean(purgeQuestions)
    });
    if (error) throw error;
    return { ok: true, removed: data || {} };
  } catch (error) {
    const m = (error && error.message) || '';

    const studied = m.match(/subject_has_history:(\d+)/);
    if (studied) {
      return {
        ok: false, blocked: 'history', count: Number(studied[1]),
        error: `תלמידים כבר למדו במקצוע הזה (${studied[1]} רשומות), ולכן אי אפשר למחוק אותו. `
          + 'לחץ "הסתר" במקום — האריח ייעלם מהתלמידים וההיסטוריה שלהם תישאר תקינה.'
      };
    }

    const questions = m.match(/subject_has_questions:(\d+)/);
    if (questions) {
      return {
        ok: false, blocked: 'questions', count: Number(questions[1]),
        error: `למקצוע יש ${questions[1]} שאלות בבנק.`
      };
    }

    // The function lives in a file of its own, so "not installed" is a real
    // state a working console can be in — and "הפעולה נכשלה" would send the
    // admin looking for the problem everywhere except where it is.
    if (/PGRST202|42883|could not find the function|does not exist/i.test(m)) {
      return {
        ok: false,
        error: 'המחיקה עדיין לא הותקנה בבסיס הנתונים. הרץ את sql/admin-subject-delete.sql ב-Supabase.'
      };
    }

    return { ok: false, error: writeError(error) };
  }
}

/** Moves a subject between draft / published / archived. */
export async function setSubjectStatus(id, status) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  try {
    const { error } = await c.from('subjects').update({ status }).eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

/**
 * How many live questions a subject actually has, per grade.
 *
 * The publish confirmation needs this: a subject with no generators and an
 * empty bank is a tile that opens onto nothing, and finding that out as a
 * student is much worse than being told before pressing publish.
 */
export async function bankCounts(subjectId) {
  const c = supabaseClient();
  if (!c) return new Map();
  try {
    const { data, error } = await c
      .from('question_bank')
      .select('grade')
      .eq('subject', subjectId)
      .eq('active', true);
    if (error) throw error;
    const counts = new Map();
    for (const row of data || []) {
      counts.set(row.grade, (counts.get(row.grade) || 0) + 1);
    }
    return counts;
  } catch {
    return new Map();
  }
}

/**
 * Distinct topics a data-backed subject can serve at one grade.
 *
 * A code subject answers this by running its generators (topicsFor in
 * js/subjects/index.js). A subject created here has none, so its catalogue is
 * whatever its published questions say it is.
 */
export async function bankTopics(subjectId, grade) {
  const c = supabaseClient();
  if (!c) return [];
  try {
    const { data, error } = await c
      .from('question_bank')
      .select('topic')
      .eq('subject', subjectId)
      .eq('grade', Number(grade))
      .eq('active', true);
    if (error) throw error;
    const seen = new Set();
    const topics = [];
    for (const row of data || []) {
      if (!row.topic || seen.has(row.topic)) continue;
      seen.add(row.topic);
      topics.push(row.topic);
    }
    return topics;
  } catch {
    return [];
  }
}

// --- questions written by hand ----------------------------------------

/** Inserts hand-authored questions straight into the live bank. */
export async function addBankQuestions(rows) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  if (!rows.length) return { ok: true, count: 0 };
  try {
    const { error } = await c.from('question_bank').insert(rows.map(r => ({
      subject: r.subject,
      grade: Number(r.grade),
      difficulty: Number(r.difficulty) || 3,
      track: r.track == null ? null : Number(r.track),
      topic: r.topic,
      text: r.text,
      options: r.options,
      correct_index: Number(r.correctIndex),
      explanation: r.explanation || null,
      active: true
    })));
    if (error) throw error;
    return { ok: true, count: rows.length };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

// --- the per-step auto/manual settings --------------------------------

export const STEPS = ['search', 'fetch', 'scan', 'extract', 'publish'];

/** Hebrew labels and the one-line explanation each toggle needs. */
export const STEP_LABELS = {
  search:  { name: 'חיפוש מקורות',  hint: 'איתור קבצים מאתרי הלימוד' },
  fetch:   { name: 'הורדת קבצים',   hint: 'הורדה להסגר לפני בדיקה' },
  scan:    { name: 'סריקת וירוסים', hint: 'בדיקת VirusTotal לכל קובץ' },
  extract: { name: 'חילוץ שאלות',   hint: 'הפיכת הקובץ לשאלות בפורמט של האפליקציה' },
  publish: { name: 'פרסום לתלמידים', hint: 'העברת השאלות המאושרות לבנק' }
};

const DEFAULT_MODES = {
  search: 'manual', fetch: 'manual', scan: 'auto', extract: 'manual', publish: 'manual'
};

/** The saved defaults, falling back to all-manual for anything missing. */
export async function getIngestDefaults() {
  const c = supabaseClient();
  if (!c) return { ...DEFAULT_MODES };
  try {
    const { data, error } = await c
      .from('admin_settings')
      .select('value')
      .eq('key', 'ingest_defaults')
      .maybeSingle();
    if (error) throw error;
    // Spread the saved value OVER the defaults rather than replacing them: a
    // step added to the pipeline later would otherwise arrive undefined, and
    // undefined is not 'manual' — it would read as "no gate" in the worker.
    return { ...DEFAULT_MODES, ...(data && data.value ? data.value : {}) };
  } catch {
    return { ...DEFAULT_MODES };
  }
}

export async function saveIngestDefaults(modes) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  try {
    const value = {};
    for (const step of STEPS) value[step] = modes[step] === 'auto' ? 'auto' : 'manual';
    const { error } = await c
      .from('admin_settings')
      .upsert({ key: 'ingest_defaults', value, updated_at: new Date().toISOString() },
        { onConflict: 'key' });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

// --- ingest jobs -------------------------------------------------------

/**
 * Queues a scrape for one subject and grade.
 *
 * The modes are COPIED onto the job rather than read from settings when the
 * worker gets there. Changing a default mid-run would otherwise reach back into
 * a job already in flight and drop a gate the admin had relied on.
 */
export async function createJob({ subject, grade, track = null, query = null, maxSources = 5, modes }) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  try {
    const { data: auth } = await c.auth.getUser();
    const frozen = {};
    for (const step of STEPS) frozen[step] = modes && modes[step] === 'auto' ? 'auto' : 'manual';
    const { data, error } = await c.from('ingest_jobs').insert({
      subject,
      grade: Number(grade),
      track: track == null ? null : Number(track),
      query: query || null,
      max_sources: Number(maxSources) || 5,
      modes: frozen,
      created_by: auth && auth.user ? auth.user.id : null
    }).select('id').single();
    if (error) throw error;
    return { ok: true, id: data.id };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

export async function listJobs(limit = 20) {
  const c = supabaseClient();
  if (!c) return [];
  try {
    const { data, error } = await c
      .from('ingest_jobs')
      .select('id, subject, grade, track, query, stage, state, modes, progress, error, created_at, updated_at, claimed_by')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

/**
 * When a worker was last seen doing anything, or null if never.
 *
 * An unclaimed job means two completely different things, and the console had
 * no way to tell them apart: either no worker is running, or one is running
 * and is busy with an earlier job. The worker takes one at a time and finishes
 * what it holds first, so queueing behind a VirusTotal scan is both normal and
 * indistinguishable from a dead machine — unless you look at whether any job
 * anywhere is being worked on.
 *
 * One row, two columns. Cheap enough to ask on every poll.
 */
export async function lastWorkerActivity() {
  const c = supabaseClient();
  if (!c) return null;
  try {
    const { data, error } = await c
      .from('ingest_jobs')
      .select('claimed_by, updated_at')
      .not('claimed_by', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return { worker: data.claimed_by, at: data.updated_at };
  } catch {
    return null;
  }
}

export async function getJob(id) {
  const c = supabaseClient();
  if (!c) return null;
  try {
    const { data, error } = await c
      .from('ingest_jobs')
      .select('id, subject, grade, track, query, stage, state, modes, progress, error, created_at, updated_at, claimed_by')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch {
    return null;
  }
}

export async function cancelJob(id) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  try {
    const { error } = await c
      .from('ingest_jobs')
      .update({ stage: 'cancelled', state: 'cancelled' })
      .eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

/**
 * Releases a job the worker has stopped at.
 *
 * The worker parks a gated job at state 'waiting' and stops touching it. This
 * is the only thing that starts it moving again, which is what makes a manual
 * step a real gate rather than a delay.
 *
 * WHICH gate was released is recorded, and it has to be. A gate whose
 * condition is a SETTING rather than data — "scan is set to manual" — is still
 * true the moment the job starts moving again, so the worker ran the same step
 * and parked at the same place. The button flickered and nothing changed,
 * forever. The worker reads progress.released to know it has already been let
 * through here; see released() in exeScraper's src/pipeline/worker.js.
 *
 * Takes the job row rather than an id because the stage and the existing
 * progress both have to be carried over — a bare id cannot say which gate the
 * admin was looking at.
 */
export async function resumeJob(job) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  if (!job || !job.id) return { ok: false, error: 'העבודה לא נמצאה.' };
  try {
    const progress = { ...(job.progress || {}) };
    const already = Array.isArray(progress.released) ? progress.released : [];
    progress.released = already.includes(job.stage) ? already : [...already, job.stage];

    const { error } = await c
      .from('ingest_jobs')
      .update({ state: 'running', error: null, progress })
      .eq('id', job.id)
      .eq('state', 'waiting');
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

/**
 * Puts a failed job back on the queue, at the download step.
 *
 * A job that fails is finished as far as the worker is concerned — claimJob
 * only looks at running ones — so a run that died on one dead link took four
 * perfectly good approved sources down with it, and the console had nothing to
 * offer but starting again from the search.
 *
 * It restarts at 'fetch' whatever it died of, because that is the only stage
 * that is safe to re-enter from cold: a source already downloaded is restored
 * rather than fetched twice, an approved one is downloaded, and scan and
 * extract follow from whatever that leaves. Restarting at the stage it failed
 * at would need the stage, and failing overwrites it.
 *
 * The released gates are left alone on purpose. The admin has already pressed
 * continue at them; a retry is not a reason to ask again.
 */
export async function retryJob(id) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  try {
    const { error } = await c
      .from('ingest_jobs')
      .update({ stage: 'fetch', state: 'running', error: null })
      .eq('id', id)
      .in('state', ['failed', 'cancelled']);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

// --- sources -----------------------------------------------------------

export async function listSources(jobId) {
  const c = supabaseClient();
  if (!c) return [];
  try {
    const { data, error } = await c
      .from('ingest_sources')
      .select('id, title, url, source_id, ext, bytes, scan, excerpt, status, note')
      .eq('job_id', jobId)
      .order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

/** Marks sources approved or rejected in one round trip. */
export async function setSourceStatus(ids, status) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  if (!ids.length) return { ok: true };
  try {
    const { error } = await c.from('ingest_sources').update({ status }).in('id', ids);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

// --- drafts ------------------------------------------------------------

export async function listDrafts({ jobId = null, subject = null, status = 'pending', limit = 100 } = {}) {
  const c = supabaseClient();
  if (!c) return [];
  try {
    let query = c
      .from('question_drafts')
      .select('id, job_id, subject, grade, difficulty, track, topic, text, options, correct_index, explanation, source_url, source_name, model, status, review_note, created_at')
      .order('id', { ascending: true })
      .limit(limit);
    if (jobId) query = query.eq('job_id', jobId);
    if (subject) query = query.eq('subject', subject);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

/** How many drafts are waiting, so the menu can carry a badge. */
export async function pendingDraftCount() {
  const c = supabaseClient();
  if (!c) return 0;
  try {
    const { count, error } = await c
      .from('question_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) throw error;
    return count || 0;
  } catch {
    return 0;
  }
}

export async function setDraftStatus(ids, status, note = null) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  if (!ids.length) return { ok: true };
  try {
    const { data: auth } = await c.auth.getUser();
    const patch = {
      status,
      review_note: note,
      reviewed_by: auth && auth.user ? auth.user.id : null,
      reviewed_at: new Date().toISOString()
    };
    const { error } = await c.from('question_drafts').update(patch).in('id', ids);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

/** Saves an edit made during review, without changing the draft's status. */
export async function updateDraft(id, patch) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  try {
    const row = {};
    if (patch.topic != null) row.topic = patch.topic;
    if (patch.text != null) row.text = patch.text;
    if (patch.options != null) row.options = patch.options;
    if (patch.correctIndex != null) row.correct_index = Number(patch.correctIndex);
    if (patch.explanation !== undefined) row.explanation = patch.explanation || null;
    if (patch.difficulty != null) row.difficulty = Number(patch.difficulty);
    const { error } = await c.from('question_drafts').update(row).eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}

/**
 * Copies approved drafts into the live bank.
 *
 * One RPC rather than an insert plus an update, so a crash between the two
 * cannot publish questions that still read as awaiting review — which on the
 * next run would publish them a second time. See publish_question_drafts in
 * sql/admin.sql.
 */
export async function publishDrafts(ids) {
  const c = supabaseClient();
  if (!c) return { ok: false, error: 'אין חיבור לשרת.' };
  if (!ids.length) return { ok: true, count: 0 };
  try {
    const { data, error } = await c.rpc('publish_question_drafts', { draft_ids: ids });
    if (error) throw error;
    return { ok: true, count: Number(data) || 0 };
  } catch (error) {
    return { ok: false, error: writeError(error) };
  }
}
