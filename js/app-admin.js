/**
 * The admin console's controller: the state its screens read, and the handler
 * for every data-action they emit.
 *
 * A module of its own rather than four hundred more lines of app.js. The
 * console is a self-contained sub-app — it shares the auth session and the
 * screen switcher with the rest of the page and nothing else, and app.js
 * forwards it the actions it owns rather than knowing what any of them do.
 *
 * The rule the whole file is built on: NOTHING advances by itself. Every step
 * that changes what a student will be shown ends in a button, and the button
 * says what it is about to do. Steps marked 'auto' let the worker run the next
 * technical stage without asking — they never publish.
 */
import { $ } from './dom.js';
import * as admin from './admin.js';
import * as ui from './ui.js';
import * as uiAdmin from './ui-admin.js';
import {
  registerRemoteSubjects, setRemoteTopics, NO_GRADE, SUBJECTS, isRemote, isMixed
} from './subjects/index.js';
import { CATALOG, catalogGrades } from './subject-catalog.js';
import { parseQuestions, buildRow } from './question-parse.js';

/**
 * The signed-in account's staff row, or null.
 *
 * Holds the role as well as the fact of membership, because an editor and an
 * admin get different tabs. It is a convenience for drawing, not a gate — the
 * policies in sql/admin-users.sql are the gate.
 */
let me = null;

const state = {
  tab: 'subjects',
  subjects: [],
  counts: new Map(),
  jobs: [],
  drafts: [],
  selected: new Set(),
  modes: null,
  /** Last sign of life from any worker: { worker, at } or null. */
  workerActivity: null,
  people: [],
  userRequests: [],
  /** Non-null while the wizard is open. */
  wizard: null,
  /** Non-null while one subject is open for maintenance. */
  workbench: null,
  /** Non-null while the new-account form is open. */
  newUser: null,
  /** Non-null while the question editor is open. */
  editor: null
};

/** A blank question, and what the editor returns to after each save. */
function emptyQuestionDraft() {
  return {
    topic: '', text: '', options: ['', '', '', ''],
    correctIndex: 0, explanation: '', difficulty: 3
  };
}

/**
 * The timer that re-reads a running job.
 *
 * A scrape takes minutes and the person watching has no other way to know it
 * is alive, so the screen refreshes itself rather than asking them to press a
 * button to find out whether anything happened.
 *
 * Module-level rather than part of `state` because it is a live handle, not
 * data: it has to be cleared on every path that leaves the screen, and one
 * variable with one clearing function is harder to leak than a field somebody
 * copies along with the rest of the state.
 */
let jobPollTimer = null;

/** How often to re-read a job. */
const JOB_POLL_MS = 5000;

/** The wizard steps that are watching a job and should keep themselves fresh. */
const POLLED_STEPS = ['search', 'sources', 'extract'];

function stopJobPolling() {
  if (jobPollTimer) clearInterval(jobPollTimer);
  jobPollTimer = null;
}

/**
 * Keeps one job's screen up to date while it is on show.
 *
 * Restarted rather than topped up on each draw, so the interval can never be
 * doubled by two renders — the bug that turns a five-second poll into a
 * request every half second by the twentieth redraw.
 */
function startJobPolling() {
  stopJobPolling();
  jobPollTimer = setInterval(async () => {
    // Anything that moved off a job-watching step stops the timer at its next
    // beat, so no path out of the wizard has to remember to.
    const onAdminScreen =
      document.getElementById('admin-screen')?.classList.contains('active') === true;
    if (!onAdminScreen) { stopJobPolling(); return; }

    // The ingest list shows every job's progress, so it is worth refreshing
    // even with no wizard open.
    if (!state.wizard || state.wizard.homeTab !== state.tab) {
      if (state.tab === 'ingest' && !state.editor) {
        state.jobs = await admin.listJobs();
        state.workerActivity = await admin.lastWorkerActivity();
        uiAdmin.renderIngestTab(state.jobs, state.wizard, state.workerActivity);
        return;
      }
      stopJobPolling();
      return;
    }

    if (!state.wizard.jobId || !POLLED_STEPS.includes(state.wizard.step)) {
      stopJobPolling();
      return;
    }
    await drawWizard();
  }, JOB_POLL_MS);
}

/**
 * The subjects written as code, in the shape the console draws them in.
 *
 * Read off the registry rather than listed here, so a subject added to
 * js/subjects/ appears in the console without anyone remembering to. Remote
 * rows are excluded because registerRemoteSubjects() merges them into the same
 * object at boot — they are already the first group, and showing them twice
 * would offer an "edit" that cannot work beside one that can.
 */
function builtInSubjects() {
  return Object.values(SUBJECTS)
    .filter(s => !isRemote(s.id) && !isMixed(s.id))
    .map(s => ({
      id: s.id,
      name: s.name,
      dir: s.dir,
      optionsDir: s.optionsDir,
      grades: s.grades || [],
      gradeless: Boolean(s.gradeless)
    }));
}

function emptySubjectDraft() {
  return {
    id: '', name: '', dir: 'rtl', optionsDir: 'rtl',
    grades: [], gradeless: false, blurb: '', status: 'draft'
  };
}

/**
 * A stand-in question for the step-2 preview.
 *
 * Deliberately one whose options are bare numbers. That is the case where the
 * direction setting actually bites: in an RTL list the bidi algorithm relocates
 * a leading minus sign, so "-7" renders as "7-" and the student is shown an
 * answer that is not the one being scored. A sample made of Hebrew words would
 * look identical under every setting and teach the admin nothing.
 */
const SAMPLE_QUESTION = {
  topic: 'נושא לדוגמה',
  text: 'כמה יוצא 12 פחות 19?',
  options: ['-7', '7', '31', '-31'],
  correctIdx: 0,
  exp: 'הפרש שלילי: 12 קטן מ-19, ולכן התוצאה שלילית.'
};

// --- boot --------------------------------------------------------------

/**
 * Merges published console subjects into the registry, and their topics with
 * them.
 *
 * Called at boot before the first screen renders. Topics are fetched here
 * rather than lazily because topicsFor() is synchronous — the drawer renders
 * from it mid-click and cannot wait on a round trip. One extra query per
 * data-backed subject and grade, at startup only.
 */
export async function loadRemoteSubjects() {
  const rows = await admin.listPublishedSubjects();
  const added = registerRemoteSubjects(rows);
  if (!added.length) return added;

  await Promise.all(added.flatMap(id => {
    const row = rows.find(r => r.id === id);
    const grades = row.gradeless ? [NO_GRADE] : (row.grades || []);
    return grades.map(async grade => {
      setRemoteTopics(id, grade, await admin.bankTopics(id, grade));
    });
  }));
  return added;
}

/** Asks whether this account is staff, and shows the link if it is. */
export async function initAdmin() {
  me = await admin.myRole();
  ui.setAdminLink(Boolean(me));
  if (!me) return false;
  const pending = await admin.pendingDraftCount();
  uiAdmin.renderAdminTabs(state.tab, pending, me.role);
  return true;
}

/** Forgets everything on sign-out, so the next account starts clean. */
export function resetAdmin() {
  stopJobPolling();
  me = null;
  state.editor = null;
  state.wizard = null;
  state.workbench = null;
  state.newUser = null;
  state.selected.clear();
  state.subjects = [];
  state.drafts = [];
  state.jobs = [];
  state.people = [];
  ui.setAdminLink(false);
}

export function isAdmitted() {
  return Boolean(me);
}

// --- opening and drawing ----------------------------------------------

export async function openAdmin() {
  if (!me) return;
  ui.showScreen('admin-screen');
  await refresh();
}

/** Re-reads whatever the open tab or wizard step needs, then draws it. */
async function refresh() {
  if (!state.modes) state.modes = await admin.getIngestDefaults();
  // Read before drawing anything that shows a job: it is what decides whether
  // an unclaimed job reads as "nothing is running" or "wait your turn".
  state.workerActivity = await admin.lastWorkerActivity();

  if (state.editor) {
    await drawEditor();
  } else if (state.wizard && state.wizard.homeTab === state.tab) {
    await drawWizard();
  } else if (state.tab === 'subjects' && state.workbench) {
    await drawWorkbench();
  } else if (state.tab === 'subjects') {
    state.subjects = await admin.listSubjects();
    const builtIn = builtInSubjects();
    state.counts = new Map();
    // Both groups draw a question count, and the built-in ones can have a bank
    // too — a hand-written question filed under מתמטיקה is as real as one
    // under a subject created here.
    for (const s of [...state.subjects, ...builtIn]) {
      const counts = await admin.bankCounts(s.id);
      state.counts.set(s.id, [...counts.values()].reduce((a, b) => a + b, 0));
    }
    const taken = new Set([...state.subjects.map(s => s.id), ...builtIn.map(s => s.id)]);
    uiAdmin.renderSubjectsTab({
      created: state.subjects,
      builtIn,
      catalog: CATALOG.filter(entry => !taken.has(entry.id)),
      counts: state.counts
    });
  } else if (state.tab === 'ingest') {
    state.jobs = await admin.listJobs();
    uiAdmin.renderIngestTab(state.jobs, state.wizard, state.workerActivity);
    // Running jobs move on their own, so this list has to as well — otherwise
    // it is a snapshot that looks stuck for exactly as long as you watch it.
    if (state.jobs.some(j => j.state === 'running' || j.state === 'waiting')) {
      if (!jobPollTimer) startJobPolling();
    }
  } else if (state.tab === 'review') {
    state.drafts = await admin.listDrafts({ status: 'pending' });
    pruneSelection();
    uiAdmin.renderReviewTab(state.drafts, state.selected);
  } else if (state.tab === 'people') {
    if (state.newUser) {
      uiAdmin.renderNewUserForm(state.newUser);
    } else {
      [state.people, state.userRequests] = await Promise.all([
        admin.listPeople(), admin.listUserRequests()
      ]);
      uiAdmin.renderPeopleTab(state.people, state.userRequests, me);
    }
  } else if (state.tab === 'settings') {
    uiAdmin.renderSettingsTab(state.modes);
  }

  uiAdmin.renderAdminTabs(state.tab, await admin.pendingDraftCount(), me.role);
}

/**
 * Drops selected ids that are no longer on screen.
 *
 * Without this, approving a batch and then refreshing leaves those ids in the
 * set, the counter on the button says "אשר 12" over a list of three, and the
 * next approve reaches rows the admin can no longer see.
 */
function pruneSelection() {
  const visible = new Set(state.drafts.map(d => d.id));
  for (const id of [...state.selected]) if (!visible.has(id)) state.selected.delete(id);
}

// --- the subject workbench --------------------------------------------

/**
 * Opens one subject for maintenance, from either group.
 *
 * `builtIn` is decided by where the row came from rather than by the id, so a
 * subject created here that happens to share a name with a code subject is
 * still the editable one. Returns false when the id matches neither, which is
 * only reachable from a stale screen.
 */
function openWorkbench(id) {
  const row = state.subjects.find(s => s.id === id);
  if (row) {
    state.workbench = {
      builtIn: false,
      subject: {
        id: row.id, name: row.name, dir: row.dir, optionsDir: row.options_dir,
        grades: [...(row.grades || [])], gradeless: row.gradeless,
        blurb: row.blurb || '', status: row.status
      }
    };
    return true;
  }

  const code = builtInSubjects().find(s => s.id === id);
  if (!code) return false;
  state.workbench = { builtIn: true, subject: { ...code, status: 'published' } };
  return true;
}

/**
 * Re-reads the counts, then draws.
 *
 * Fetched on every draw rather than carried in state: the workbench is the
 * screen you come back to after adding ten questions, and a count that still
 * says the old number is the one piece of feedback that would be wrong exactly
 * when it matters.
 */
async function drawWorkbench() {
  const w = state.workbench;
  const [counts, pending] = await Promise.all([
    admin.bankCounts(w.subject.id),
    admin.listDrafts({ subject: w.subject.id, status: 'pending', limit: 200 })
  ]);
  uiAdmin.renderSubjectWorkbench({
    subject: w.subject,
    builtIn: w.builtIn,
    counts,
    pendingDrafts: pending.length,
    sample: SAMPLE_QUESTION
  });
}

/**
 * One subject to work on, from either group, in the console's draft shape.
 *
 * Both "add questions" and "pull content" apply to a code subject as much as
 * to one created here — question_bank is keyed by a plain subject id and does
 * not care which kind it is — so both buttons go through here rather than
 * through a lookup that can only see the database.
 */
function subjectForWork(id) {
  const row = state.subjects.find(s => s.id === id);
  if (row) {
    return {
      builtIn: false,
      draft: {
        id: row.id, name: row.name, dir: row.dir, optionsDir: row.options_dir,
        grades: [...(row.grades || [])], gradeless: row.gradeless,
        blurb: row.blurb || '', status: row.status
      }
    };
  }
  const code = builtInSubjects().find(s => s.id === id);
  if (!code) return null;
  return { builtIn: true, draft: { ...code, blurb: '', status: 'published' } };
}

/**
 * Carries a status change into the copies that are already on screen.
 *
 * The workbench draws from its own draft rather than re-reading the row, so
 * publishing from inside it would otherwise leave the pill saying טיוטה over a
 * subject students can already see.
 */
async function noteStatus(id, status) {
  state.subjects = await admin.listSubjects();
  if (state.workbench && state.workbench.subject.id === id) {
    state.workbench.subject.status = status;
  }
  await loadRemoteSubjects();
}

/** The subject draft the open screen's form fields belong to, or null. */
function openSubjectDraft() {
  if (state.workbench && !state.workbench.builtIn) return state.workbench.subject;
  if (state.wizard) return state.wizard.subject;
  return null;
}

// --- the question editor ----------------------------------------------

/**
 * Re-reads how many questions the subject already has, then draws.
 *
 * The count is the one number that tells you whether a subject is usable yet:
 * a quiz asks for ten and a bank of four serves four. Re-read on every draw so
 * it climbs as you save, which is the feedback that makes typing ten of these
 * bearable.
 */
async function drawEditor() {
  const e = state.editor;
  const counts = await admin.bankCounts(e.subjectId);
  uiAdmin.renderQuestionEditor({
    subject: e.subject,
    subjectId: e.subjectId,
    subjectName: e.subject.name,
    grades: e.grades,
    grade: e.grade,
    existing: counts.get(Number(e.grade)) || 0,
    mode: e.mode,
    draft: e.draft,
    bulkText: e.bulkText,
    parsed: e.parsed
  });
}

/**
 * Reads the single-question form back into the draft.
 *
 * Called before every redraw and before saving, because the live preview is
 * built from the draft rather than from the inputs — so anything not read back
 * first would preview stale.
 */
function readQuestionForm() {
  const d = state.editor.draft;
  const topic = $('q-topic');
  const text = $('q-text');
  const exp = $('q-exp');
  const difficulty = $('q-difficulty');
  if (topic) d.topic = topic.value;
  if (text) d.text = text.value;
  if (exp) d.explanation = exp.value;
  if (difficulty) d.difficulty = Number(difficulty.value);
  for (let i = 0; i < 4; i++) {
    const box = $(`q-option-${i}`);
    if (box) d.options[i] = box.value;
  }
  const bulk = $('q-bulk');
  if (bulk) state.editor.bulkText = bulk.value;
}

// --- the wizard --------------------------------------------------------

function startWizard(subjectDraft, step = 'subject', homeTab = state.tab, builtIn = false) {
  state.wizard = {
    step,
    subject: subjectDraft,
    // A subject defined in code has no steps 1 and 2: its name, grades and
    // direction come from a file this console cannot write to. The rail drops
    // them rather than drawing two circles that refuse to open.
    builtIn,
    // The tab this wizard was opened from. Switching tabs no longer throws it
    // away, so something has to know where it belongs in order to put it back.
    homeTab,
    isEdit: Boolean(subjectDraft.id) && state.subjects.some(s => s.id === subjectDraft.id),
    jobId: null,
    sources: [],
    drafts: [],
    approved: []
  };
  state.selected.clear();
}

async function drawWizard() {
  const w = state.wizard;
  const rail = { from: firstStep() };
  // The poll timer calls this directly rather than through refresh(), so the
  // signal would otherwise freeze at whatever it was when the screen opened.
  if (w.jobId) state.workerActivity = await admin.lastWorkerActivity();

  // Only the steps that are waiting on the worker poll. The rest are forms and
  // lists that nothing else can change under you.
  if (w.jobId && POLLED_STEPS.includes(w.step) && w.homeTab === state.tab) {
    if (!jobPollTimer) startJobPolling();
  } else {
    stopJobPolling();
  }

  switch (w.step) {
    case 'subject':
      uiAdmin.renderWizardSubject(w.subject, { isEdit: w.isEdit }, rail);
      break;
    case 'preview':
      uiAdmin.renderWizardPreview(w.subject, SAMPLE_QUESTION, rail);
      break;
    case 'search': {
      const job = w.jobId ? await admin.getJob(w.jobId) : null;
      uiAdmin.renderWizardSearch(w.subject, state.modes, job, state.workerActivity, rail);
      break;
    }
    case 'sources': {
      const job = w.jobId ? await admin.getJob(w.jobId) : null;
      w.sources = w.jobId ? await admin.listSources(w.jobId) : [];
      uiAdmin.renderWizardSources(job, w.sources, state.workerActivity);
      break;
    }
    case 'extract': {
      const job = w.jobId ? await admin.getJob(w.jobId) : null;
      w.drafts = await admin.listDrafts({ jobId: w.jobId, status: 'pending' });
      uiAdmin.renderWizardExtract(job, w.drafts.length, state.workerActivity);
      break;
    }
    case 'review':
      w.drafts = await admin.listDrafts({ jobId: w.jobId, status: 'pending' });
      state.drafts = w.drafts;
      pruneSelection();
      uiAdmin.renderWizardReview(w.drafts, w.subject, state.selected);
      break;
    case 'publish':
      w.approved = await admin.listDrafts({
        jobId: w.jobId, subject: w.subject.id, status: 'approved'
      });
      state.counts.set(w.subject.id,
        [...(await admin.bankCounts(w.subject.id)).values()].reduce((a, b) => a + b, 0));
      uiAdmin.renderWizardPublish(w.subject, w.approved, state.counts);
      break;
    default:
      break;
  }
}

const ORDER = uiAdmin.WIZARD_STEPS.map(s => s.id);

/** The first step this run can reach: past the subject form for a code subject. */
function firstStep() {
  return state.wizard.builtIn ? ORDER.indexOf('search') : 0;
}

async function goToStep(step) {
  const at = ORDER.indexOf(step);
  state.wizard.step = ORDER[Math.max(at, firstStep())];
  await drawWizard();
}

/**
 * Reads the subject form back into whichever draft is on screen.
 *
 * The wizard and the workbench draw the same fields with the same ids — see
 * subjectFields() in ui-admin.js — so this reads them back for both rather
 * than growing a second copy that would drift from the first.
 */
function readSubjectForm() {
  const w = state.workbench && !state.workbench.builtIn ? state.workbench : state.wizard;
  if (!w) return;
  const name = $('subject-name');
  const id = $('subject-id');
  const blurb = $('subject-blurb');
  const dir = $('subject-dir');
  const optionsDir = $('subject-options-dir');
  if (name) w.subject.name = name.value.trim();
  // The workbench never lets the id change: it is the primary key that every
  // saved question, draft and job already points at.
  if (id && !w.isEdit && w !== state.workbench) w.subject.id = id.value.trim().toLowerCase();
  if (blurb) w.subject.blurb = blurb.value.trim();
  if (dir) w.subject.dir = dir.value;
  if (optionsDir) w.subject.optionsDir = optionsDir.value;
}

/** What is wrong with the draft, in Hebrew, or null. */
function subjectProblem(subject) {
  if (!subject.name) return 'צריך שם למקצוע.';
  if (!subject.id) return 'צריך מזהה למקצוע.';
  if (!/^[a-z][a-z0-9_-]{1,30}$/.test(subject.id)) {
    return 'המזהה חייב להתחיל באות אנגלית קטנה, ולהכיל אותיות קטנות, ספרות, מקף או קו תחתון בלבד.';
  }
  if (!subject.gradeless && !subject.grades.length) return 'בחר לפחות כיתה אחת.';
  return null;
}

async function advance() {
  const w = state.wizard;
  const at = ORDER.indexOf(w.step);

  if (w.step === 'subject') {
    readSubjectForm();
    const problem = subjectProblem(w.subject);
    if (problem) { uiAdmin.adminMessage(problem, 'bad'); return; }
    uiAdmin.adminMessage('');
    await goToStep('preview');
    return;
  }

  if (w.step === 'preview') {
    // Saved here rather than at step 1, so a subject only reaches the database
    // once its author has seen what it will look like. It is saved as a DRAFT —
    // the students cannot see it until publish, which is step 7.
    const result = await admin.saveSubject(w.subject);
    if (!result.ok) { uiAdmin.adminMessage(result.error, 'bad'); return; }
    w.isEdit = true;
    uiAdmin.adminMessage('המקצוע נשמר כטיוטה.', 'ok');
    await goToStep('search');
    return;
  }

  await goToStep(ORDER[Math.min(at + 1, ORDER.length - 1)]);
}

async function retreat() {
  const at = ORDER.indexOf(state.wizard.step);
  if (at <= firstStep()) return;
  await goToStep(ORDER[at - 1]);
}

// --- actions -----------------------------------------------------------

/**
 * Handles one console action. Returns false for an action it does not own, so
 * app.js can fall through to its own switch.
 */
export async function handleAdminAction(action, node) {
  if (!me) return false;

  switch (action) {
    case 'show-admin':
      await openAdmin();
      return true;

    case 'admin-tab':
      stopJobPolling();
      state.tab = node.dataset.tab;
      state.editor = null;
      state.newUser = null;
      state.selected.clear();
      uiAdmin.adminMessage('');
      // The wizard is deliberately NOT cleared. A scrape takes minutes, and
      // glancing at another tab while it runs used to throw the whole run's
      // screen away — the work continued on the worker, but the person
      // watching it lost their place and had to find the job again. It is put
      // back when its own tab is reopened; "צא מהאשף" is how you end it.
      await refresh();
      return true;

    case 'admin-refresh':
      await refresh();
      return true;

    // --- subjects tab ---

    case 'admin-new-subject':
      startWizard(emptySubjectDraft());
      await drawWizard();
      return true;

    case 'admin-create-from-catalog': {
      const entry = CATALOG.find(c => c.id === node.dataset.subject);
      if (!entry) return true;
      // Created straight away rather than opened as an empty form: everything
      // the form would ask for is already known, and the id in particular must
      // be the catalogue's — it is what the worker searches by, and a typed
      // one that is nearly right fails silently by searching for the wrong
      // subject. It lands as a draft, so nothing reaches a student yet.
      const draft = {
        ...emptySubjectDraft(),
        id: entry.id,
        name: entry.name,
        grades: catalogGrades(entry),
        dir: entry.dir,
        // Which way the ANSWERS read, and it is not cosmetic: an answer list
        // declared right-to-left runs the bidi algorithm over every option, so
        // "-7" renders as "7-" and a student is shown an answer that is not the
        // one being scored. A maths subject answers in notation, a language
        // subject answers in a mix of Hebrew and its own script, and only the
        // catalogue knows which this is.
        optionsDir: entry.optionsDir
      };
      const result = await admin.saveSubject(draft);
      if (!result.ok) { uiAdmin.adminMessage(result.error, 'bad'); return true; }
      state.subjects = await admin.listSubjects();
      openWorkbench(entry.id);
      uiAdmin.adminMessage(`${entry.name} נוצר כטיוטה. בדוק את הכיתות ואת כיוון הכתיבה, ואז הוסף תוכן.`, 'ok');
      await refresh();
      return true;
    }

    case 'admin-open-subject': {
      if (!openWorkbench(node.dataset.subject)) return true;
      state.tab = 'subjects';
      uiAdmin.adminMessage('');
      await refresh();
      return true;
    }

    case 'admin-subject-close':
      state.workbench = null;
      uiAdmin.adminMessage('');
      await refresh();
      return true;

    case 'admin-save-subject': {
      readSubjectForm();
      const draft = state.workbench.subject;
      const problem = subjectProblem(draft);
      if (problem) { uiAdmin.adminMessage(problem, 'bad'); return true; }
      const result = await admin.saveSubject(draft);
      if (!result.ok) { uiAdmin.adminMessage(result.error, 'bad'); return true; }
      state.subjects = await admin.listSubjects();
      // The registry is built at boot, so a rename or a changed grade list is
      // invisible to the picker until a reload unless it is merged now.
      await loadRemoteSubjects();
      uiAdmin.adminMessage('השינויים נשמרו.', 'ok');
      await refresh();
      return true;
    }

    case 'admin-delete-subject': {
      const id = node.dataset.subject;
      const row = state.subjects.find(x => x.id === id);
      if (!row) return true;
      if (!window.confirm(`למחוק את "${row.name}" לתמיד? אי אפשר לבטל.`)) return true;

      let result = await admin.deleteSubject(id);

      // A subject with questions is a second question, not a failure: the
      // admin has now been told how many there are, which they did not know
      // when they pressed the button.
      if (!result.ok && result.blocked === 'questions') {
        if (!window.confirm(`למקצוע יש ${result.count} שאלות בבנק. למחוק גם אותן?`)) {
          uiAdmin.adminMessage('המחיקה בוטלה.', 'info');
          return true;
        }
        result = await admin.deleteSubject(id, { purgeQuestions: true });
      }

      if (!result.ok) { uiAdmin.adminMessage(result.error, 'bad'); return true; }

      state.workbench = null;
      state.tab = 'subjects';
      uiAdmin.adminMessage(`"${row.name}" נמחק.`, 'ok');
      await refresh();
      return true;
    }

    case 'admin-open-review':
      state.workbench = null;
      state.tab = 'review';
      await refresh();
      return true;

    case 'admin-ingest-subject': {
      const subject = subjectForWork(node.dataset.subject);
      if (!subject) return true;
      // Filed under the ingest tab rather than the one it was launched from,
      // so "where did my run go" has one answer: משיכת תוכן.
      startWizard(subject.draft, 'search', 'ingest', subject.builtIn);
      state.wizard.grade = node.dataset.grade ? Number(node.dataset.grade) : null;
      state.tab = 'ingest';
      await refresh();
      return true;
    }

    case 'admin-resume-wizard':
      // The banner on the ingest list, for a run parked behind a tab switch.
      if (state.wizard) { state.tab = state.wizard.homeTab; await refresh(); }
      return true;

    case 'admin-publish-subject': {
      const id = node.dataset.subject;
      const counts = await admin.bankCounts(id);
      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      // A subject with an empty bank has no generators behind it either, so
      // publishing it puts a tile on the home screen that opens onto nothing.
      // Asking is cheap; a student finding it is not.
      if (total === 0 &&
          !window.confirm('למקצוע הזה אין עדיין אף שאלה. לפרסם אותו בכל זאת?')) {
        return true;
      }
      const result = await admin.setSubjectStatus(id, 'published');
      if (result.ok) await noteStatus(id, 'published');
      uiAdmin.adminMessage(result.ok ? 'המקצוע פורסם.' : result.error, result.ok ? 'ok' : 'bad');
      await refresh();
      return true;
    }

    case 'admin-archive-subject': {
      const id = node.dataset.subject;
      const result = await admin.setSubjectStatus(id, 'archived');
      if (result.ok) await noteStatus(id, 'archived');
      uiAdmin.adminMessage(result.ok ? 'המקצוע הוסתר מהתלמידים.' : result.error,
        result.ok ? 'ok' : 'bad');
      await refresh();
      return true;
    }

    // --- wizard navigation ---

    case 'admin-wizard-next':  await advance(); return true;
    case 'admin-wizard-back':  await retreat(); return true;
    case 'admin-wizard-step':  await goToStep(node.dataset.step); return true;

    case 'admin-wizard-exit':
      stopJobPolling();
      state.wizard = null;
      state.selected.clear();
      uiAdmin.adminMessage('');
      await refresh();
      return true;

    // --- step 1 form ---

    case 'admin-toggle-grade': {
      // Set from the box's own state rather than flipped. Flipping makes the
      // result depend on how many times the handler ran; this makes it depend
      // on what the box actually says, which is the thing the admin can see.
      const grade = Number(node.value);
      const draft = openSubjectDraft();
      if (!draft) return true;
      const grades = draft.grades;
      const at = grades.indexOf(grade);
      if (node.checked && at === -1) grades.push(grade);
      if (!node.checked && at !== -1) grades.splice(at, 1);
      grades.sort((a, b) => a - b);
      return true;
    }

    case 'admin-toggle-gradeless': {
      readSubjectForm();
      const draft = openSubjectDraft();
      if (!draft) return true;
      draft.gradeless = node.checked;
      if (node.checked) draft.grades = [];
      if (state.workbench) await drawWorkbench(); else await drawWizard();
      return true;
    }

    case 'admin-field':
      readSubjectForm();
      // The workbench keeps a preview beside these fields, and a preview that
      // does not move when you change the direction is the one thing it must
      // never do. The wizard's step 1 has no preview, so it does not redraw.
      if (state.workbench) await drawWorkbench();
      return true;

    // --- the auto/manual switches ---

    case 'admin-toggle-mode': {
      const step = node.dataset.step;
      state.modes[step] = state.modes[step] === 'auto' ? 'manual' : 'auto';
      if (state.wizard) await drawWizard();
      else uiAdmin.renderSettingsTab(state.modes);
      return true;
    }

    case 'admin-save-settings': {
      const result = await admin.saveIngestDefaults(state.modes);
      uiAdmin.adminMessage(result.ok ? 'ההגדרות נשמרו.' : result.error,
        result.ok ? 'ok' : 'bad');
      return true;
    }

    // --- step 3: queue the scrape ---

    case 'admin-start-ingest': {
      const w = state.wizard;
      const grade = Number($('ingest-grade')?.value) || NO_GRADE;
      const result = await admin.createJob({
        subject: w.subject.id,
        grade,
        query: $('ingest-query')?.value.trim() || null,
        maxSources: Number($('ingest-max')?.value) || 5,
        modes: state.modes
      });
      if (!result.ok) { uiAdmin.adminMessage(result.error, 'bad'); return true; }
      w.jobId = result.id;
      uiAdmin.adminMessage('החיפוש בתור. הוא יתחיל ברגע שהתוכנה בבית תיקח אותו.', 'ok');
      await goToStep('sources');
      return true;
    }

    // --- step 4: sources ---

    case 'admin-source-approve':
    case 'admin-source-reject': {
      const status = action.endsWith('approve') ? 'approved' : 'rejected';
      const result = await admin.setSourceStatus([Number(node.dataset.id)], status);
      if (!result.ok) uiAdmin.adminMessage(result.error, 'bad');
      await drawWizard();
      return true;
    }

    case 'admin-run-extract': {
      // Approving the sources is the gate; releasing the job is what tells the
      // worker the gate has been passed. Without this the job sits at 'waiting'
      // however many sources were ticked.
      //
      // Re-read rather than kept: the release has to carry the stage the job
      // is actually parked at, and the wizard holds only its id.
      const job = await admin.getJob(state.wizard.jobId);
      const result = await admin.resumeJob(job);
      if (!result.ok) { uiAdmin.adminMessage(result.error, 'bad'); return true; }
      uiAdmin.adminMessage('המקורות אושרו. החילוץ מתחיל.', 'ok');
      await goToStep('extract');
      return true;
    }

    // --- steps 6 and review tab: drafts ---

    case 'admin-toggle-draft': {
      const id = Number(node.dataset.id);
      if (node.checked) state.selected.add(id);
      else state.selected.delete(id);
      await refresh();
      return true;
    }

    case 'admin-select-all-drafts':
      for (const d of state.drafts) state.selected.add(d.id);
      await refresh();
      return true;

    case 'admin-clear-draft-selection':
      state.selected.clear();
      await refresh();
      return true;

    case 'admin-save-draft': {
      const id = Number(node.dataset.id);
      const result = await admin.updateDraft(id, {
        topic: $(`draft-topic-${id}`)?.value.trim(),
        explanation: $(`draft-exp-${id}`)?.value.trim(),
        difficulty: Number($(`draft-diff-${id}`)?.value)
      });
      uiAdmin.adminMessage(result.ok ? 'השינויים נשמרו.' : result.error,
        result.ok ? 'ok' : 'bad');
      await refresh();
      return true;
    }

    case 'admin-approve-drafts': {
      const ids = [...state.selected];
      const result = await admin.setDraftStatus(ids, 'approved');
      if (!result.ok) { uiAdmin.adminMessage(result.error, 'bad'); return true; }
      state.selected.clear();
      uiAdmin.adminMessage(`${ids.length} שאלות אושרו. הן עדיין לא אצל התלמידים — זה קורה בשלב הפרסום.`, 'ok');
      if (state.wizard) await goToStep('publish');
      else await refresh();
      return true;
    }

    case 'admin-reject-drafts': {
      const ids = [...state.selected];
      const result = await admin.setDraftStatus(ids, 'rejected');
      state.selected.clear();
      uiAdmin.adminMessage(result.ok ? `${ids.length} שאלות נדחו.` : result.error,
        result.ok ? 'ok' : 'bad');
      await refresh();
      return true;
    }

    case 'admin-approve-and-publish': {
      const ids = [...state.selected];
      const approved = await admin.setDraftStatus(ids, 'approved');
      if (!approved.ok) { uiAdmin.adminMessage(approved.error, 'bad'); return true; }
      const published = await admin.publishDrafts(ids);
      state.selected.clear();
      uiAdmin.adminMessage(
        published.ok ? `${published.count} שאלות פורסמו לתלמידים.` : published.error,
        published.ok ? 'ok' : 'bad');
      await refresh();
      return true;
    }

    // --- step 7: publish ---

    case 'admin-publish-all': {
      const w = state.wizard;
      const ids = w.approved.map(d => d.id);
      if (!window.confirm(`לפרסם ${ids.length} שאלות? מרגע זה תלמידים יקבלו אותן במבחנים.`)) {
        return true;
      }
      const published = await admin.publishDrafts(ids);
      if (!published.ok) { uiAdmin.adminMessage(published.error, 'bad'); return true; }

      // Publishing questions into a subject students cannot see is a no-op they
      // would have to come back and finish, so the subject goes live with them.
      if (w.subject.status !== 'published') {
        const opened = await admin.setSubjectStatus(w.subject.id, 'published');
        if (opened.ok) w.subject.status = 'published';
      }

      // The registry is built at boot, so a subject published mid-session is
      // invisible to the picker until the page reloads. Merging it now means
      // the admin can go and look at their own work immediately.
      await loadRemoteSubjects();

      uiAdmin.adminMessage(`${published.count} שאלות פורסמו. המקצוע גלוי לתלמידים.`, 'ok');
      state.wizard = null;
      state.tab = 'subjects';
      await refresh();
      return true;
    }

    // --- ingest tab ---

    case 'admin-open-job': {
      const job = state.jobs.find(j => j.id === node.dataset.id);
      if (!job) return true;
      const row = await admin.listSubjects().then(rows => rows.find(s => s.id === job.subject));
      startWizard(row
        ? {
            id: row.id, name: row.name, dir: row.dir, optionsDir: row.options_dir,
            grades: [...(row.grades || [])], gradeless: row.gradeless,
            blurb: row.blurb || '', status: row.status
          }
        : { ...emptySubjectDraft(), id: job.subject, name: job.subject },
        'sources', 'ingest');
      state.wizard.jobId = job.id;
      await drawWizard();
      return true;
    }

    case 'admin-resume-job': {
      const job = state.jobs.find(j => j.id === node.dataset.id)
        || await admin.getJob(node.dataset.id);
      const result = await admin.resumeJob(job);
      uiAdmin.adminMessage(result.ok ? 'העבודה שוחררה להמשך.' : result.error,
        result.ok ? 'ok' : 'bad');
      await refresh();
      return true;
    }

    case 'admin-retry-job': {
      const result = await admin.retryJob(node.dataset.id);
      uiAdmin.adminMessage(result.ok
        ? 'העבודה חזרה לתור. המקורות שאושרו יורדים עכשיו.'
        : result.error, result.ok ? 'ok' : 'bad');
      await refresh();
      return true;
    }

    case 'admin-cancel-job': {
      if (!window.confirm('לבטל את המשיכה הזו?')) return true;
      const result = await admin.cancelJob(node.dataset.id);
      uiAdmin.adminMessage(result.ok ? 'המשיכה בוטלה.' : result.error,
        result.ok ? 'ok' : 'bad');
      await refresh();
      return true;
    }

    // --- writing questions by hand ---

    case 'admin-add-questions': {
      const found = subjectForWork(node.dataset.subject);
      if (!found) return true;
      const row = found.draft;
      const grades = row.gradeless ? [NO_GRADE] : (row.grades || []);
      const asked = node.dataset.grade ? Number(node.dataset.grade) : null;
      state.editor = {
        subjectId: row.id,
        // The registry entry, so the preview uses the subject's real text
        // direction rather than the page default — the setting that decides
        // whether a minus sign renders on the correct side of a number.
        subject: {
          name: row.name, dir: row.dir, optionsDir: row.optionsDir
        },
        grades,
        // Opened on the grade whose row was pressed. Landing on the subject's
        // first grade instead meant picking the grade again every time, and
        // getting it wrong writes questions into the wrong year.
        grade: asked && grades.includes(asked) ? asked : (grades[0] || NO_GRADE),
        mode: 'single',
        draft: emptyQuestionDraft(),
        bulkText: '',
        parsed: null
      };
      uiAdmin.adminMessage('');
      await refresh();
      return true;
    }

    case 'admin-editor-close':
      state.editor = null;
      uiAdmin.adminMessage('');
      await refresh();
      return true;

    case 'admin-editor-mode':
      readQuestionForm();
      state.editor.mode = node.dataset.mode;
      await refresh();
      return true;

    case 'admin-editor-grade':
      readQuestionForm();
      state.editor.grade = Number(node.value);
      await refresh();
      return true;

    case 'admin-editor-correct':
      readQuestionForm();
      state.editor.draft.correctIndex = Number(node.value);
      await refresh();
      return true;

    case 'admin-editor-field':
      // Typing redraws the preview. Reading the form first is what makes the
      // preview show what you just typed rather than what you typed before.
      readQuestionForm();
      await refresh();
      return true;

    case 'admin-save-question': {
      readQuestionForm();
      const e = state.editor;
      const built = buildRow({ ...e.draft, subject: e.subjectId, grade: e.grade });
      if (!built.ok) { uiAdmin.adminMessage(built.problem, 'bad'); return true; }

      const result = await admin.addBankQuestions([built.row]);
      if (!result.ok) { uiAdmin.adminMessage(result.error, 'bad'); return true; }

      // The topic is kept and everything else cleared: a run of questions is
      // almost always a run on one topic, and retyping it ten times is the
      // kind of friction that stops somebody at four.
      const topic = e.draft.topic;
      e.draft = emptyQuestionDraft();
      e.draft.topic = topic;
      uiAdmin.adminMessage('השאלה נשמרה והיא כבר בבנק.', 'ok');
      await refresh();
      return true;
    }

    case 'admin-parse-bulk': {
      readQuestionForm();
      const e = state.editor;
      e.parsed = parseQuestions(e.bulkText, { subject: e.subjectId, grade: e.grade });
      uiAdmin.adminMessage(
        e.parsed.errors.length
          ? `${e.parsed.rows.length} תקינות, ${e.parsed.errors.length} לא נקלטו.`
          : `${e.parsed.rows.length} שאלות מוכנות לשמירה.`,
        e.parsed.errors.length ? 'bad' : 'ok');
      await refresh();
      return true;
    }

    case 'admin-save-bulk': {
      const e = state.editor;
      if (!e.parsed || !e.parsed.rows.length) return true;
      const result = await admin.addBankQuestions(e.parsed.rows);
      if (!result.ok) { uiAdmin.adminMessage(result.error, 'bad'); return true; }
      uiAdmin.adminMessage(`${result.count} שאלות נשמרו לבנק.`, 'ok');
      // Cleared rather than left in place: leaving it would invite a second
      // press of save, and a second press would insert every one of them
      // again.
      e.bulkText = '';
      e.parsed = null;
      await refresh();
      return true;
    }

    // --- people ---

    case 'admin-new-user':
      state.newUser = { username: '', displayName: '', grade: '', role: '', password: '' };
      await refresh();
      return true;

    case 'admin-people-back':
      state.newUser = null;
      uiAdmin.adminMessage('');
      await refresh();
      return true;

    case 'admin-create-user': {
      const draft = {
        username: $('user-username')?.value.trim().toLowerCase() || '',
        displayName: $('user-display')?.value.trim() || '',
        grade: $('user-grade')?.value || '',
        role: $('user-role')?.value || '',
        password: $('user-password')?.value || ''
      };
      // Kept so a rejected form comes back filled in. Retyping a username and a
      // password because one field was short is the kind of small cruelty that
      // makes people stop using a screen.
      state.newUser = draft;

      const problem =
        !draft.displayName ? 'צריך שם מלא.'
        : !/^[a-z0-9_.]{3,20}$/.test(draft.username) ? 'שם משתמש: 3-20 תווים, אותיות אנגליות קטנות, ספרות, נקודה או קו תחתון.'
        : draft.password.length < 6 ? 'הסיסמה חייבת להיות לפחות 6 תווים.'
        : null;
      if (problem) { uiAdmin.adminMessage(problem, 'bad'); return true; }

      const result = await admin.requestUser(draft);
      if (!result.ok) { uiAdmin.adminMessage(result.error, 'bad'); return true; }

      state.newUser = null;
      uiAdmin.adminMessage(
        `הבקשה נרשמה. החשבון ייפתח ברגע שהתוכנה בבית תיקח אותה. הסיסמה שקבעת: ${draft.password}`,
        'ok');
      await refresh();
      return true;
    }

    case 'admin-set-role': {
      const { user, role } = node.dataset;
      const person = state.people.find(p => p.id === user);
      if (role === 'admin' && !window.confirm(
        `להפוך את ${person ? person.display_name : 'המשתמש'} למנהל? מנהל יכול לשנות הרשאות של כל אחד, כולל שלך.`)) {
        return true;
      }
      const result = await admin.setRole(user, role);
      uiAdmin.adminMessage(result.ok ? 'ההרשאה עודכנה.' : result.error,
        result.ok ? 'ok' : 'bad');
      await refresh();
      return true;
    }

    case 'admin-revoke-role': {
      if (!window.confirm('להסיר את ההרשאות של המשתמש הזה?')) return true;
      const result = await admin.revokeRole(node.dataset.user);
      uiAdmin.adminMessage(result.ok ? 'ההרשאות הוסרו.' : result.error,
        result.ok ? 'ok' : 'bad');
      await refresh();
      return true;
    }

    default:
      return false;
  }
}
