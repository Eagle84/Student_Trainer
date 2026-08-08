/**
 * All DOM rendering. Receives plain data; never fetches, never computes
 * quiz logic.
 *
 * XSS rule: any value that reaches innerHTML is passed through sanitize()
 * first. Question text, options, and explanations legitimately contain math
 * and formatting markup, so they cannot be escaped — but some of that content
 * (the attempt_errors rows) is insertable by any anonymous client and is
 * therefore untrusted. sanitize() keeps the allowed markup and strips scripts,
 * event handlers, and every other injection vector. Anything a student typed —
 * the name — is still written with textContent, never innerHTML.
 */
import { SUBJECTS, subjectIds, getSubject, gradesFor, usesTracks, DEFAULT_SUBJECT, NO_GRADE, gradelessSubjects, isGradeless } from './subjects/index.js';
import { $, el } from './dom.js';
import { hasLesson, LESSONS } from './lessons/index.js';
import { hasTracks } from './levels.js';
import { sanitize } from './sanitize.js';
import { renderDiagram } from './diagrams.js';
import { isAnswerComplete, toParts, scoreQuestion } from './qtypes.js';
import {
  overview, perSubject, recent, trend, weakTopics, strongSubjects,
  improvement, pace, activity, byDifficulty, personalBest, gameStats,
  subjectTrends, effort, topicMastery, drillRecovery,
  WEAK_TOPIC_WINDOW, TREND_MIN_ATTEMPTS, MASTERY_MIN_ASKED
} from './analytics.js';
import { APP_VERSION, BUILD_ID } from './config.js';
import { MODES as GAME_MODES } from './game.js';

const GRADE_NAMES = {
  1: "כיתה א'", 2: "כיתה ב'", 3: "כיתה ג'",
  4: "כיתה ד'", 5: "כיתה ה'", 6: "כיתה ו'", 7: "כיתה ז'",
  8: "כיתה ח'", 9: "כיתה ט'", 10: "כיתה י'", 11: 'כיתה י"א', 12: 'כיתה י"ב'
};

export function gradeName(value) {
  // NO_GRADE belongs to subjects that are not taught by year; it must never
  // render as "כיתה 13". It gets a name rather than an empty string because it
  // reaches standalone cells — a leaderboard row, a history row — where a blank
  // reads as missing data rather than as "no grade applies".
  if (Number(value) === NO_GRADE) return 'מסלול הכנה';
  return GRADE_NAMES[Number(value)] || String(value);
}

export function subjectName(id) {
  return SUBJECTS[id] ? SUBJECTS[id].name : id;
}

/**
 * Direction of the current subject's answer list, set by
 * applySubjectDirection() and read by renderQuestion(). Held here rather than
 * threaded through renderQuestion's signature because it changes once per
 * quiz, not once per question.
 */
let optionsDirection = 'rtl';

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

/** Escapes text destined for an innerHTML template. */
function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- screens and banner -----------------------------------------------

/**
 * Screens where the Home button is pointless or wrong: Home itself, and the
 * sign-in screen, which has no "home" to go back to.
 */
const NO_HOME_BUTTON = ['setup-screen', 'auth-screen'];

/** Header nav pills, paired with the screen each one leads to. */
const HEADER_LINKS = [
  ['header-dashboard', 'dashboard-screen'],
  ['header-board', 'history-screen']
];

export function showScreen(id) {
  let active = null;
  for (const el of document.querySelectorAll('.screen')) {
    const on = el.id === id;
    el.classList.toggle('active', on);
    if (on) active = el;
  }

  // Signed out, the whole header user area is hidden and hideHeaderUser owns
  // these buttons; signed in, they follow the screen.
  const signedIn = !document.querySelector('.header-logout')?.hidden;
  const home = $('header-home');
  if (home && signedIn) {
    home.hidden = NO_HOME_BUTTON.includes(id);
  }
  // The board and dashboard links stay put on every signed-in screen, including
  // their own — a control that vanishes when you reach its destination is a
  // control that moves the ones beside it, mid-tap. The one you are on is
  // marked instead.
  if (signedIn) {
    for (const [buttonId, screenId] of HEADER_LINKS) {
      const link = $(buttonId);
      if (!link) continue;
      link.hidden = id === 'auth-screen';
      if (id === screenId) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  window.scrollTo(0, 0);
  // SPA screen change: move focus to the new screen's heading so keyboard and
  // screen-reader users land at the top of the new content instead of being
  // stranded where the old, now-hidden control used to be.
  if (active) {
    const heading = active.querySelector('h1, h2, h3');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }
}

export function showBanner(message) {
  const el = $('banner');
  el.textContent = message;
  el.hidden = false;
}

export function hideBanner() {
  $('banner').hidden = true;
}

export function setWelcome(name) {
  // This screen stopped being "quiz setup" when study mode landed — it is now
  // the choice between the two paths, and the heading has to say so.
  $('welcome-message').textContent = `שלום, ${name}! מה נעשה היום?`;
}

export function getLoginName() {
  return $('student-name').value.trim();
}

export function setLoginName(name) {
  $('student-name').value = name;
}

export function getGrade() {
  return $('grade-select').value;
}

const DIFFICULTY_NAMES = { 1: 'קל מאוד', 2: 'קל', 3: 'בינוני', 4: 'קשה', 5: 'מאתגר' };
export function difficultyName(value) {
  return DIFFICULTY_NAMES[Number(value)] || 'מעורב';
}

/** Chosen quiz difficulty, or null for "all levels". */
export function getDifficulty() {
  const v = $('difficulty-select').value;
  return v ? Number(v) : null;
}

/**
 * The chosen track, or null when the current grade has no track.
 *
 * Reads the visibility of the group rather than the grade, so the returned
 * value can never disagree with what the student was actually shown.
 */
export function getTrack() {
  const group = $('track-group');
  if (!group || group.hidden) return null;
  return Number($('track-select').value);
}

/**
 * Shows or hides the track picker for the current subject and grade.
 * Hiding rather than disabling keeps the setup screen honest: a grade 7
 * student is never shown a control that does not apply to them.
 */
export function populateTracks(subjectId, grade) {
  const group = $('track-group');
  if (!group) return;
  group.hidden = !(usesTracks(subjectId) && hasTracks(grade));
}

/** Leaderboard difficulty filter, or null for "all". */
export function getBoardDifficulty() {
  const v = $('board-difficulty-filter').value;
  return v ? Number(v) : null;
}

export function getQuestionCount() {
  return Number($('num-questions').value);
}

export function getBoardFilter() {
  return $('board-grade-filter').value;
}

export function setStartButtonBusy(busy) {
  const btn = document.querySelector('[data-action="start-quiz"]');
  btn.disabled = busy;
  btn.textContent = busy ? 'טוען שאלות...' : 'התחל מבחן מותאם';
}

// --- subject and grade selects -----------------------------------------

/** Fills a <select> with one <option> per registry subject. */
/**
 * Fills a subject <select>.
 *
 * `withGradeless` is separate from `includeAll` on purpose: the leaderboard
 * filter must list every subject a student can have attempted, including the
 * gradeless ones, while the quiz card's hidden select must not — its next
 * control is a grade picker.
 */
function fillSubjectSelect(select, includeAll, withGradeless) {
  select.replaceChildren();
  if (includeAll) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'כל המקצועות';
    select.appendChild(opt);
  }
  for (const id of subjectIds()) {
    if (!withGradeless && isGradeless(id)) continue;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = SUBJECTS[id].name;
    select.appendChild(opt);
  }
}

/** Populates both subject selects. Call once at boot. */
export function populateSubjects(selectedId) {
  fillSubjectSelect($('subject-select'), false, false);
  fillSubjectSelect($('board-subject-filter'), true, true);
  $('subject-select').value = selectedId || DEFAULT_SUBJECT;
}

/** Rebuilds a grade <select> from the subject's declared grades. */
function fillGradeSelect(select, subjectId, includeAll, preferred) {
  const previous = preferred ?? select.value;
  select.replaceChildren();
  if (includeAll) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'כל הכיתות';
    select.appendChild(opt);
  }
  for (const grade of gradesFor(subjectId)) {
    const opt = document.createElement('option');
    opt.value = String(grade);
    opt.textContent = gradeName(grade);
    select.appendChild(opt);
  }
  // Keep the old choice if this subject still offers it.
  if (previous && [...select.options].some(o => o.value === previous)) {
    select.value = previous;
  } else if (!includeAll) {
    select.value = String(gradesFor(subjectId)[0]);
  }
}

/** Rebuilds the setup-screen grade select for the chosen subject. */
export function populateGrades(subjectId) {
  fillGradeSelect($('grade-select'), subjectId, false);
}

/** Rebuilds the leaderboard grade filter for the chosen subject. */
export function populateBoardGrades(subjectId) {
  fillGradeSelect($('board-grade-filter'), subjectId || DEFAULT_SUBJECT, true);
}

export function getSubjectId() { return $('subject-select').value; }
export function getBoardSubject() { return $('board-subject-filter').value; }
export function setBoardSubject(id) { $('board-subject-filter').value = id || ''; }

/**
 * Applies the subject's text direction to the quiz surfaces.
 *
 * Prose and answers are set independently: Math is worded in Hebrew (RTL) but
 * answered in mathematical notation (LTR). Setting both from a single `dir`
 * would put "x1=3, x2=-2" in an RTL list, where the bidi algorithm relocates
 * the comma and the minus sign.
 */
export function applySubjectDirection(subjectId) {
  const subject = getSubject(subjectId);
  optionsDirection = subject.optionsDir;
  $('question-text').setAttribute('dir', subject.dir);
  $('options-list').setAttribute('dir', subject.optionsDir);
}

// --- quiz -------------------------------------------------------------

/** Sets the progress bar width and its aria-valuenow (0-100). */
function updateProgress(answered, total) {
  const pct = total > 0 ? (answered / total) * 100 : 0;
  const bar = $('progress-bar');
  bar.style.width = `${pct}%`;
  bar.setAttribute('aria-valuenow', String(Math.round(pct)));
}

/**
 * Selections for the question on screen, one entry per part: a number for a
 * single choice, an array for choose-all-that-apply.
 *
 * Held here rather than in the quiz state because it is transient UI — the
 * quiz state only ever sees the finished answer, when the student submits.
 */
let pending = [];

/** The current selections, for app.js to hand to answerQuestion. */
export function getPendingAnswers() {
  return pending;
}

/** True once every part has a selection, so the answer can be graded. */
function pendingComplete(question) {
  return isAnswerComplete(question, pending);
}

/** Enables the submit button only when every part has been answered. */
function refreshSubmit(question) {
  const btn = $('submit-answer');
  const ready = pendingComplete(question);
  btn.disabled = !ready;
  $('submit-hint').textContent = ready ? '' : 'יש לבחור תשובה בכל הסעיפים.';
}

/** Repaints the selected state of one part's options. */
function paintPart(partIndex) {
  const chosen = pending[partIndex];
  const picks = new Set(Array.isArray(chosen) ? chosen : chosen == null ? [] : [chosen]);
  for (const item of document.querySelectorAll(`[data-part="${partIndex}"] .option-item`)) {
    const i = Number(item.dataset.optionIndex);
    item.classList.toggle('selected', picks.has(i));
    item.setAttribute('aria-checked', String(picks.has(i)));
  }
}

/**
 * Records a click on one part's option.
 *
 * A single-choice part replaces its selection; a multi-select part toggles,
 * because "choose all that apply" cannot be expressed by a last-click-wins
 * control. That is also why these questions need an explicit submit: there is
 * no click that unambiguously means "I have finished choosing".
 */
export function selectOption(question, partIndex, optionIndex) {
  const part = question.parts[partIndex];
  if (Array.isArray(part.correct)) {
    const current = new Set(Array.isArray(pending[partIndex]) ? pending[partIndex] : []);
    if (current.has(optionIndex)) current.delete(optionIndex);
    else current.add(optionIndex);
    pending[partIndex] = [...current].sort((a, b) => a - b);
  } else {
    pending[partIndex] = optionIndex;
  }
  paintPart(partIndex);
  refreshSubmit(question);
}

/** Builds the option list for one part. */
function buildPartOptions(part, partIndex) {
  const list = document.createElement('ul');
  list.className = 'options-list';
  if (optionsDirection !== 'auto') list.setAttribute('dir', optionsDirection);

  const multi = Array.isArray(part.correct);
  part.options.forEach((option, i) => {
    const li = document.createElement('li');
    li.className = 'option-item';
    li.dataset.optionIndex = String(i);
    li.setAttribute('role', multi ? 'checkbox' : 'radio');
    li.setAttribute('aria-checked', 'false');
    li.setAttribute('tabindex', '0');
    li.innerHTML = sanitize(option);
    if (optionsDirection === 'auto') li.setAttribute('dir', 'auto');
    list.appendChild(li);
  });
  return list;
}

/** Renders a cloze, multi-select or passage question as one group per part. */
function renderParts(question) {
  pending = question.parts.map(p => (Array.isArray(p.correct) ? [] : null));

  const container = $('question-parts');
  container.replaceChildren();

  question.parts.forEach((part, index) => {
    const group = document.createElement('div');
    group.className = 'part-group';
    group.dataset.part = String(index);
    group.setAttribute('role', Array.isArray(part.correct) ? 'group' : 'radiogroup');

    const label = document.createElement('p');
    label.className = 'part-prompt';
    // Numbered so a three-blank cloze reads as three questions, not one blur.
    const prompt = part.prompt ? sanitize(part.prompt) : '';
    label.innerHTML = question.parts.length > 1
      ? `<span class="part-number">${index + 1}</span> ${prompt}`
      : prompt;
    if (prompt || question.parts.length > 1) group.appendChild(label);

    if (Array.isArray(part.correct)) {
      const hint = document.createElement('p');
      hint.className = 'part-hint';
      hint.textContent = 'ניתן לבחור יותר מתשובה אחת.';
      group.appendChild(hint);
    }

    group.appendChild(buildPartOptions(part, index));
    container.appendChild(group);
  });

  container.hidden = false;
  $('options-list').hidden = true;
  $('submit-row').hidden = false;
  refreshSubmit(question);
}

export function renderQuestion(question, index, total, answered) {
  $('question-counter').textContent = `שאלה ${index + 1} מתוך ${total}`;
  $('topic-badge').textContent = `נושא: ${question.topic}`;
  updateProgress(answered, total);
  $('question-text').innerHTML = sanitize(question.text);

  // Geometry diagram (our own numeric SVG — trusted, not user content).
  const dgm = $('question-diagram');
  const svg = question.diagram ? renderDiagram(question.diagram) : '';
  if (svg) { dgm.innerHTML = svg; dgm.hidden = false; }
  else { dgm.replaceChildren(); dgm.hidden = true; }

  const passageBox = $('passage-text');
  passageBox.hidden = !question.passage;
  passageBox.innerHTML = question.passage ? sanitize(question.passage) : '';

  const fbReset = $('feedback-box');
  fbReset.className = 'feedback-box';
  $('next-btn').hidden = true;

  // A multi-part question renders one option group per blank and is graded by
  // an explicit submit; a single-answer question is graded by the click itself.
  // Both containers are reset here so neither can leak from the previous
  // question — the bug that shape produces is a stale submit row sitting under
  // a single-answer question.
  $('question-parts').hidden = true;
  $('submit-row').hidden = true;
  if (question.parts) {
    renderParts(question);
    return;
  }

  pending = [];
  const list = $('options-list');
  list.hidden = false;
  list.replaceChildren();

  // A question may answer in pictures rather than words: `optionDiagrams` maps
  // each option STRING to a visual spec, and the option text becomes the short
  // label under its picture. Everything downstream — scoring, the error log —
  // still sees four distinct strings, so nothing else has to know about this.
  //
  // Keyed by the option's own text rather than held as a parallel array on
  // purpose: quiz.js shuffles the option list, and a parallel array would hand
  // every figure to the wrong answer. Rendered only when EVERY option has one,
  // so a partial map degrades to plain text instead of a half-blank grid.
  const map = question.optionDiagrams;
  const figures = map && question.options.every(o => map[o]) ? map : null;
  list.classList.toggle('options-visual', Boolean(figures));

  question.options.forEach((option, i) => {
    const li = document.createElement('li');
    li.className = 'option-item';
    li.dataset.optionIndex = String(i);
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');

    if (figures) {
      const art = document.createElement('div');
      art.className = 'option-figure';
      art.innerHTML = renderDiagram(figures[option]); // trusted: numeric SVG, no student input
      const tag = document.createElement('span');
      tag.className = 'option-tag';
      tag.textContent = option;
      li.append(art, tag);
      list.appendChild(li);
      return;
    }

    li.innerHTML = sanitize(option);
    // When the subject resolves direction per item ('auto'), each option needs
    // its own dir. dir="auto" on the <ul> resolves ONCE, from the first strong
    // character in the whole list — so a list holding both a Hebrew
    // translation and an English word would force them all one way.
    if (optionsDirection === 'auto') li.setAttribute('dir', 'auto');
    list.appendChild(li);
  });

  const fb = $('feedback-box');
  fb.className = 'feedback-box';
  $('next-btn').hidden = true;
}

/** Locks every option and marks right/wrong, for one part's list. */
function markPart(part, chosen, scope) {
  const picks = new Set(Array.isArray(chosen) ? chosen : chosen == null ? [] : [chosen]);
  const correct = new Set(Array.isArray(part.correct) ? part.correct : [part.correct]);

  for (const item of scope.querySelectorAll('.option-item')) {
    const i = Number(item.dataset.optionIndex);
    item.classList.add('locked');
    item.classList.remove('selected');
    item.setAttribute('tabindex', '-1');

    // A missed correct answer is shown as correct too, so the student can see
    // what they should have picked — the point of a multi-select is learning
    // which ones belonged, not only that the set was wrong.
    if (correct.has(i)) item.classList.add('correct');
    else if (picks.has(i)) item.classList.add('incorrect');
  }
}

/**
 * Shows the result. `answers` is one selection per part; a bare index is
 * accepted for the single-answer questions that make up nearly the whole bank.
 */
export function renderAnswerResult(question, answers) {
  const parts = toParts(question);
  const given = Array.isArray(answers) ? answers : [answers];

  if (question.parts) {
    question.parts.forEach((part, i) => {
      const scope = document.querySelector(`[data-part="${i}"]`);
      if (scope) markPart(part, given[i], scope);
    });
    $('submit-answer').disabled = true;
    $('submit-hint').textContent = '';
  } else {
    markPart(parts[0], given[0], $('options-list'));
  }

  const mark = scoreQuestion({ parts }, given);
  const fb = $('feedback-box');
  // Three states, not two: a partly-right answer is neither, and calling it
  // "טעות" would misreport a student who got two of three blanks.
  const state = mark === 1 ? 'correct-fb' : mark === 0 ? 'incorrect-fb' : 'partial-fb';
  fb.className = `feedback-box show ${state}`;
  $('feedback-title').textContent =
    mark === 1 ? 'נכון מאוד!'
      : mark === 0 ? 'טעות.'
        : `כמעט — ${Math.round(mark * 100)}% מהסעיפים נכונים.`;
  $('feedback-text').innerHTML = sanitize(question.exp);

  $('next-btn').hidden = false;
}

export function setProgress(answered, total) {
  updateProgress(answered, total);
}

/**
 * Builds a "learn this topic" button. Shared by the three surfaces that offer
 * one outside the catalogue, so they cannot drift in what they carry.
 *
 * `returnTo` travels on the button because closing the lesson has to go back to
 * wherever it was opened from, and by then the click that opened it is long
 * gone.
 */
function learnButton(topic, subjectId, grade, returnTo, label, extraClass = '') {
  const btn = el('button', {
    class: `btn btn-small btn-learn ${extraClass}`.trim(),
    text: label,
    attrs: { type: 'button', 'aria-label': `למד את הנושא ${topic}` }
  });
  btn.dataset.action = 'learn-topic';
  btn.dataset.topic = topic;
  btn.dataset.subject = subjectId;
  btn.dataset.grade = String(grade);
  btn.dataset.return = returnTo;
  return btn;
}

/**
 * Offers the lesson inside the quiz feedback box. Pass a null topic to clear it.
 * app.js only passes a topic after a wrong answer AND when a lesson exists, so
 * this never renders an offer that leads nowhere.
 */
export function setFeedbackLearn(topic, subjectId, grade) {
  const host = $('feedback-learn');
  if (!host) return;
  host.replaceChildren();
  if (!topic) return;
  host.appendChild(el('span', { class: 'feedback-learn-lead', text: 'לא הבנת את הנושא?' }));
  host.appendChild(learnButton(topic, subjectId, grade, 'quiz-screen', 'למד אותו עכשיו'));
}

// --- summary ----------------------------------------------------------

/** Shows the "reinforce weak topics" button when the quiz had wrong answers. */
export function setPracticeWeak(topicCount) {
  const btn = $('practice-weak-btn');
  if (!btn) return;
  if (topicCount > 0) {
    btn.hidden = false;
    btn.textContent = topicCount === 1
      ? 'חזק את הנושא הקשה'
      : `חזק את ${topicCount} הנושאים הקשים`;
  } else {
    btn.hidden = true;
  }
}

export function renderSummary(result, errors, saveMessage) {
  $('summary-student-name').textContent = result.student_name;
  $('summary-subject').textContent = `${subjectName(result.subject)} — ${gradeName(result.grade)}`;
  $('final-score').textContent =
    `${result.score} מתוך ${result.total_questions} (${Math.round(result.percent)}%)`;
  $('save-status').textContent = saveMessage;

  const container = $('errors-container');
  const title = $('errors-title');
  container.replaceChildren();

  if (errors.length === 0) {
    title.hidden = true;
    const card = document.createElement('div');
    card.className = 'card card-narrow';
    const h3 = document.createElement('h3');
    h3.textContent = 'מושלם! אין שגיאות במבחן זה.';
    h3.style.color = '';
    card.appendChild(h3);
    container.appendChild(card);
    return;
  }

  title.hidden = false;
  for (const err of errors) {
    const div = document.createElement('div');
    div.className = 'error-item';
    div.innerHTML = `
      <p><strong>נושא: ${esc(err.topic)}</strong></p>
      <p>${sanitize(err.question_text)}</p>
      <p class="error-wrong">התשובה שנבחרה: ${sanitize(err.chosen_answer)} — התשובה הנכונה: ${sanitize(err.correct_answer)}</p>
      <p><strong>הסבר פתרון נכון:</strong> ${sanitize(err.explanation)}</p>
    `;
    // An explanation tells the student what the right answer was; a lesson
    // tells them why. Offered only where one exists, so the row never grows a
    // button that leads to "עדיין אין שיעור".
    if (hasLesson(result.subject, result.grade, err.topic)) {
      div.appendChild(learnButton(
        err.topic, result.subject, result.grade, 'summary-screen', 'למד את הנושא הזה'));
    }
    container.appendChild(div);
  }
}

// --- history ----------------------------------------------------------

export function showTab(name) {
  for (const tab of document.querySelectorAll('.tab')) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  }
  for (const panel of document.querySelectorAll('.tab-panel')) {
    panel.classList.toggle('active', panel.id === `tab-${name}`);
  }
}

function emptyState(container, message) {
  container.replaceChildren();
  const p = document.createElement('p');
  p.className = 'empty-state';
  p.textContent = message;
  container.appendChild(p);
}

export function renderLeaderboard(rows) {
  const container = $('board-container');
  if (rows.length === 0) {
    emptyState(container, 'אין עדיין תוצאות שמורות.');
    return;
  }

  const table = document.createElement('table');
  table.className = 'history-table';
  table.innerHTML =
    '<thead><tr><th>#</th><th>שם התלמיד</th><th>מקצוע</th><th>כיתה</th><th>רמה</th><th>ציון</th>' +
    '<th>אחוזים</th><th>תאריך</th></tr></thead>';

  const tbody = document.createElement('tbody');
  rows.forEach((row, i) => {
    const tr = document.createElement('tr');

    // Rows are newest-first, so this is a line number, not a ranking. No medals
    // and no podium tint: they would decorate whoever happened to play last.
    const rank = document.createElement('td');
    rank.className = 'rank-cell';
    rank.textContent = String(i + 1);

    // Student-supplied. textContent, never innerHTML.
    const name = document.createElement('td');
    name.textContent = row.student_name;

    const subject = document.createElement('td');
    subject.textContent = subjectName(row.subject);

    const grade = document.createElement('td');
    grade.textContent = gradeName(row.grade);

    const difficulty = document.createElement('td');
    difficulty.textContent = difficultyName(row.difficulty);

    const score = document.createElement('td');
    score.dir = 'ltr';
    score.textContent = `${row.score} / ${row.total_questions}`;

    const percent = document.createElement('td');
    percent.dir = 'ltr';
    percent.textContent = `${Math.round(row.percent)}%`;

    const date = document.createElement('td');
    date.dir = 'ltr';
    date.textContent = formatDate(row.created_at);

    tr.append(rank, name, subject, grade, difficulty, score, percent, date);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.replaceChildren(table);
}

export function renderMyHistory(rows, studentName) {
  const container = $('mine-container');
  if (rows.length === 0) {
    emptyState(container, `אין עדיין מבחנים שמורים עבור ${studentName}.`);
    return;
  }

  const table = document.createElement('table');
  table.className = 'history-table';
  table.innerHTML =
    '<thead><tr><th>תאריך</th><th>מקצוע</th><th>כיתה</th><th>ציון</th><th>אחוזים</th><th>שגיאות</th></tr></thead>';

  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');

    const date = document.createElement('td');
    date.dir = 'ltr';
    date.textContent = formatDate(row.created_at);

    const subject = document.createElement('td');
    subject.textContent = subjectName(row.subject);

    const grade = document.createElement('td');
    grade.textContent = gradeName(row.grade);

    const score = document.createElement('td');
    score.dir = 'ltr';
    score.textContent = `${row.score} / ${row.total_questions}`;

    const percent = document.createElement('td');
    percent.dir = 'ltr';
    percent.textContent = `${Math.round(row.percent)}%`;

    const actions = document.createElement('td');
    // A perfect attempt has nothing to show and nothing to reinforce. Both
    // buttons used to appear anyway, and "הצג שגיאות" on a 100% row opened an
    // empty drawer — an offer that could only ever disappoint.
    const perfect = Number(row.score) >= Number(row.total_questions);
    if (row.id && !perfect) {
      const btn = document.createElement('button');
      btn.className = 'expand-btn';
      btn.dataset.action = 'toggle-errors';
      btn.dataset.attemptId = String(row.id);
      btn.textContent = 'הצג שגיאות';
      actions.appendChild(btn);

      const drill = document.createElement('button');
      drill.className = 'expand-btn drill-btn';
      drill.dataset.action = 'practice-attempt';
      drill.dataset.attemptId = String(row.id);
      drill.dataset.subject = row.subject;
      drill.dataset.grade = String(row.grade);
      if (row.difficulty != null) drill.dataset.difficulty = String(row.difficulty);
      drill.textContent = 'חזק נושאים';
      actions.appendChild(drill);
    } else if (row.id) {
      actions.appendChild(el('span', { class: 'all-correct', text: '✓ הכול נכון' }));
    } else {
      actions.textContent = '—';
    }

    tr.append(date, subject, grade, score, percent, actions);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.replaceChildren(table);
}

/** True if this row's error detail is currently expanded. */
export function isErrorDetailOpen(button) {
  const next = button.closest('tr').nextElementSibling;
  return Boolean(next && next.classList.contains('error-detail-row'));
}

/** Inserts (or removes) a detail row under one history row. */
export function toggleErrorDetail(button, errors) {
  const row = button.closest('tr');
  const existing = row.nextElementSibling;

  if (existing && existing.classList.contains('error-detail-row')) {
    existing.remove();
    button.textContent = 'הצג שגיאות';
    return;
  }

  const detailRow = document.createElement('tr');
  detailRow.className = 'error-detail-row';

  const cell = document.createElement('td');
  cell.className = 'error-detail-cell';
  cell.colSpan = 6;

  const wrap = document.createElement('div');
  if (errors.length === 0) {
    wrap.innerHTML = '<p class="empty-state">אין שגיאות במבחן זה.</p>';
  } else {
    wrap.innerHTML = errors.map(e => `
      <div class="error-item">
        <p><strong>נושא: ${esc(e.topic)}</strong></p>
        <p>${sanitize(e.question_text)}</p>
        <p class="error-wrong">התשובה שנבחרה: ${sanitize(e.chosen_answer)} — התשובה הנכונה: ${sanitize(e.correct_answer)}</p>
        <p><strong>הסבר:</strong> ${sanitize(e.explanation || '')}</p>
      </div>
    `).join('');
  }

  cell.appendChild(wrap);
  detailRow.appendChild(cell);
  row.after(detailRow);
  button.textContent = 'הסתר שגיאות';
}

// --- theme ------------------------------------------------------------

/** 'dark' or 'light', read from the <html data-theme> attribute. */
export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Applies a theme to the document and syncs the toggle button's state. */
export function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const btn = document.querySelector('[data-action="toggle-theme"]');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(dark));
  btn.setAttribute('aria-label', dark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה');
  const txt = btn.querySelector('.theme-toggle-text');
  if (txt) txt.textContent = dark ? 'מצב בהיר' : 'מצב כהה';
}

/**
 * Reflects the haptics preference, and hides the switch entirely where the
 * device cannot vibrate.
 *
 * Shown only when supported, because a control that visibly does nothing is
 * worse than no control — and on iOS it would do nothing for every student,
 * every time.
 */
export function markHaptics(on, supported = true) {
  const btn = $('haptics-toggle');
  if (!btn) return;
  btn.hidden = !supported;
  btn.setAttribute('aria-pressed', String(Boolean(on)));
  btn.setAttribute('aria-label', on ? 'כבה רטט בתשובה נכונה' : 'הפעל רטט בתשובה נכונה');
  const state = $('haptics-state');
  if (state) state.textContent = on ? 'מופעל' : 'כבוי';
}

// --- dashboard --------------------------------------------------------
// Every value here is written with textContent or CSSOM (.style.*), never
// innerHTML of database content — the dashboard is XSS-safe by construction.

/**
 * A dashboard card.
 *
 * `note` is not decoration. Every headline number on this board is one of
 * several defensible ways to compute the same idea, and a percentage with no
 * statement of method is a number the student cannot check — the board used to
 * show an unweighted mean in the ring and a weighted one in a tile beside it,
 * both unlabelled, differing by two points and neither admitting the other
 * existed.
 */
function dashCard(titleText, note, ...kids) {
  return el('section', { class: 'dash-card' },
    el('h3', { text: titleText }),
    note ? el('p', { class: 'dash-note', text: note }) : null,
    ...kids);
}

/**
 * Circular gauge. SVG presentation attributes only (CSP-safe).
 *
 * `caption` is required by the caller because an unlabelled ring is the exact
 * defect this board was redesigned to fix: it showed a percentage that named
 * neither what it measured nor how it was computed.
 */
function ringNode(percent, caption) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const off = c * (1 - clamped / 100);
  const wrap = el('div', { class: 'ring' });
  wrap.innerHTML = `
    <svg viewBox="0 0 120 120" width="132" height="132" role="img"
         aria-label="${caption} ${Math.round(clamped)} אחוז">
      <defs><linearGradient id="ringGrad" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#22d3ee"/>
      </linearGradient></defs>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--ring-track)" stroke-width="12"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="url(#ringGrad)" stroke-width="12"
              stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}"
              stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 60 60)"/>
      <text x="60" y="68" text-anchor="middle" class="ring-label">${Math.round(clamped)}%</text>
    </svg>`;
  // Appended rather than interpolated: the caption is ours, but the rule in
  // this section is that nothing reaches innerHTML that does not have to.
  wrap.appendChild(el('span', { class: 'ring-caption', text: caption }));
  return wrap;
}

/** A number with its name, and optionally how it was arrived at. */
function statTile(value, label, note) {
  return el('div', { class: 'stat-tile' },
    el('div', { class: 'stat-value', text: value }),
    el('div', { class: 'stat-label', text: label }),
    note ? el('div', { class: 'stat-note', text: note }) : null);
}

/**
 * One subject's bar.
 *
 * The bar measures weighted accuracy — every question counts the same — and the
 * row spells out the fraction it came from. It used to show the mean of the
 * quiz percentages with the same "%" and no way to tell: a student with one
 * lucky five-question quiz and one laboured hundred-question one saw a figure
 * that belonged to neither.
 */
function subjectRow(s) {
  const fill = el('div', { class: `meter-fill${s.accuracy < 60 ? ' low' : ''}` });
  fill.style.width = `${Math.max(2, Math.round(s.accuracy))}%`;
  return el('div', { class: 'subj-row' },
    el('span', { class: 'subj-name', text: subjectName(s.subject) }),
    el('div', { class: 'meter' }, fill),
    el('span', { class: 'subj-val',
      text: `${Math.round(s.accuracy)}% · ${s.correct}/${s.questions} · ${s.count} מבחנים` }));
}

/** "12/7" — enough to place an attempt without crowding the axis. */
function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * The score trend, as a bar per attempt.
 *
 * Every bar carries its percentage and its date. They used to carry only a
 * `title` tooltip, which meant the chart showed the shape of the trend and none
 * of its numbers — and a tooltip cannot be reached at all on a touch screen,
 * where most of this is read.
 */
function trendNode(points) {
  const series = points.map(p => `${shortDate(p.t)}: ${Math.round(p.percent)}%`).join(', ');
  const bars = el('div', {
    class: 'trend-bars',
    attrs: { role: 'img', 'aria-label': `מגמת אחוזי הצלחה במבחנים האחרונים — ${series}` }
  });

  for (const p of points) {
    const percent = Math.round(p.percent);
    const bar = el('div', { class: `trend-bar${percent < 60 ? ' low' : ''}` });
    // A 0% attempt still needs a visible stub, or the column reads as missing
    // data rather than as a score of zero.
    bar.style.height = `${Math.max(4, percent)}%`;

    bars.appendChild(el('div', { class: 'trend-col' },
      el('span', { class: 'trend-val', text: `${percent}%` }),
      el('div', { class: 'trend-track' }, bar),
      el('span', { class: 'trend-date', text: shortDate(p.t) })));
  }
  return el('div', { class: 'trend' }, bars);
}

function chip(text, kind) {
  return el('span', { class: `chip chip-${kind}`, text });
}

/**
 * One weak topic: its name, how often it was missed, and — where a lesson
 * exists — a way into it.
 *
 * The name and the count are separate elements rather than the string
 * "topic (5)", so the count can be a quiet badge instead of competing with the
 * thing it describes. Paired with the lesson button it becomes one segmented
 * control: two buttons, because a button cannot nest inside a button and both
 * actions are real, but one shape, so the row reads as a single topic rather
 * than as a pill that happens to have a slab parked beside it.
 */
function weakTopicChip(w, returnTo) {
  const drillable = Boolean(w.subject) && w.grade != null;
  const node = el(drillable ? 'button' : 'span', {
    class: `chip chip-weak${drillable ? ' chip-btn' : ''}`
  }, el('span', { class: 'chip-topic', text: w.topic }),
     el('span', { class: 'chip-count', text: String(w.count), attrs: { 'aria-hidden': 'true' } }));

  if (drillable) {
    node.setAttribute('type', 'button');
    node.dataset.action = 'practice-topic';
    node.dataset.topic = w.topic;
    node.dataset.subject = w.subject;
    node.dataset.grade = String(w.grade);
    // The count is decorative in the label but not in the meaning, so the
    // accessible name says what it is instead of reading a bare number.
    node.setAttribute('aria-label', `תרגל את הנושא ${w.topic} — ${w.count} טעויות`);
  }

  // A topic the student keeps getting wrong is the strongest signal there is
  // that they need the lesson, not another round of the same drill — so where a
  // lesson exists it sits right next to the practice chip.
  if (drillable && hasLesson(w.subject, w.grade, w.topic)) {
    return el('span', { class: 'chip-pair' }, node,
      learnButton(w.topic, w.subject, w.grade, returnTo, 'למד', 'chip-learn'));
  }
  return node;
}

/** One insight: a big value, a label, and an optional footnote. */
function insight(value, label, note, tone) {
  return el('div', { class: `insight${tone ? ' ' + tone : ''}` },
    el('b', { class: 'insight-val', text: value }),
    el('span', { class: 'insight-label', text: label }),
    note ? el('small', { class: 'insight-note', text: note }) : null);
}

/**
 * The insights card: is the student improving, how often do they turn up, and
 * how fast do they work.
 *
 * Every tile is omitted when its underlying figure cannot honestly be computed
 * — an improvement claim from three attempts, or a pace from attempts that
 * recorded no duration, would be a number dressed up as a finding.
 */
function insightsCard(attempts, now = Date.now()) {
  const tiles = [];

  const imp = improvement(attempts, 5);
  if (imp) {
    const up = imp.delta > 0;
    const flat = Math.abs(imp.delta) < 1;
    tiles.push(insight(
      `${up && !flat ? '+' : ''}${flat ? '≈' : imp.delta}${flat ? '' : '%'}`,
      flat ? 'יציב' : (up ? 'שיפור' : 'ירידה'),
      `${imp.sampleSize} אחרונים (${imp.recent}%) מול ${imp.comparedWith} שלפניהם (${imp.earlier}%)`,
      flat ? '' : (up ? 'good' : 'bad')));
  }

  const act = activity(attempts, now);
  if (act.streak > 0) {
    tiles.push(insight(String(act.streak), act.streak === 1 ? 'יום ברצף' : 'ימים ברצף',
      act.last7 ? `${act.last7} מבחנים בשבוע האחרון` : ''));
  }
  tiles.push(insight(String(act.activeDays), act.activeDays === 1 ? 'יום פעיל' : 'ימים פעילים',
    act.busiestDay && act.busiestDay.count > 1 ? `הכי הרבה ביום אחד: ${act.busiestDay.count}` : ''));

  const p = pace(attempts);
  if (p) {
    // Names the exclusions rather than hiding them. A student who parked a quiz
    // overnight would otherwise see a pace they never worked at, and no clue why.
    const detail = p.excluded > 0
      ? `לפי ${p.countedAttempts} מבחנים · ${p.excluded} הושהו וחודשו ולכן לא נספרו`
      : (p.fastest && p.slowest && p.fastest.subject !== p.slowest.subject
        ? `הכי מהר ב${subjectName(p.fastest.subject)}`
        : `${p.totalMinutes} דקות תרגול בסך הכול`);
    tiles.push(insight(`${p.secondsPerQuestion}שנ׳`, 'לשאלה בממוצע', detail));
  }

  const best = personalBest(attempts);
  if (best) {
    tiles.push(insight(`${Math.round(Number(best.percent))}%`, 'השיא שלך',
      `${subjectName(best.subject)} · ${best.total_questions} שאלות`, 'good'));
  }

  return tiles.length
    ? dashCard('תובנות', 'כל תובנה מוצגת רק כשיש מספיק נתונים לחשב אותה',
      el('div', { class: 'insight-grid' }, ...tiles))
    : null;
}

// --- the four analysis cards -------------------------------------------

/** A short "12/7" date, or an em dash when there is nothing to show. */
function dayLabel(iso) {
  return iso ? shortDate(iso) : '—';
}

/**
 * Per-topic mastery: asked, correct, and the share right.
 *
 * Reads topic_results, never attempt_errors. The errors table holds only
 * mistakes, so a percentage taken from it has no denominator — every topic
 * would read as nought per cent. That is why this table needed a new record
 * rather than a new query.
 *
 * Topics asked fewer than MASTERY_MIN_ASKED times show their counts and no
 * percentage. Printing "0%" from a single question would be the most confident
 * number on the board and the least earned.
 */
function masteryCard(topicResults) {
  const rows = topicMastery(topicResults);
  if (rows.length === 0) return null;

  const measured = rows.filter(r => r.percent != null);
  const body = el('tbody');
  for (const r of rows.slice(0, 20)) {
    const pct = el('td', { dir: 'ltr',
      text: r.percent == null ? '—' : `${Math.round(r.percent)}%` });
    if (r.percent != null && r.percent < 60) pct.className = 'cell-weak';
    else if (r.percent != null && r.percent >= 85) pct.className = 'cell-strong';

    const action = el('td');
    // Drillable only where the topic knows which subject and grade it belongs
    // to — the same condition the weak-topic chips use.
    if (r.subject && r.grade != null) {
      const btn = el('button', { class: 'expand-btn drill-btn', text: 'תרגל' });
      btn.type = 'button';
      btn.dataset.action = 'practice-topic';
      btn.dataset.topic = r.topic;
      btn.dataset.subject = r.subject;
      btn.dataset.grade = String(r.grade);
      btn.setAttribute('aria-label', `תרגל את הנושא ${r.topic}`);
      action.appendChild(btn);
    } else {
      action.textContent = '—';
    }

    body.appendChild(el('tr', {},
      el('td', { text: r.topic }),
      el('td', { text: subjectName(r.subject) }),
      el('td', { dir: 'ltr', text: String(r.asked) }),
      el('td', { dir: 'ltr', text: String(r.correct) }),
      pct,
      el('td', { dir: 'ltr', text: dayLabel(r.lastAt) }),
      action));
  }

  const table = el('div', { class: 'table-wrap' },
    el('table', { class: 'history-table' },
      el('thead', {},
        el('tr', {},
          el('th', { text: 'נושא' }),
          el('th', { text: 'מקצוע' }),
          el('th', { text: 'נשאלו' }),
          el('th', { text: 'נכונות' }),
          el('th', { text: 'שיעור הצלחה' }),
          el('th', { text: 'נבדק לאחרונה' }),
          el('th', { text: '' }))),
      body));

  const unmeasured = rows.length - measured.length;
  const notes = [`${rows.length} נושאים · מסודר מהחלש לחזק`];
  if (unmeasured > 0) {
    notes.push(unmeasured === 1
      ? `נושא אחד נשאל פחות מ-${MASTERY_MIN_ASKED} פעמים, ולכן מוצג בלי אחוז`
      : `${unmeasured} נושאים נשאלו פחות מ-${MASTERY_MIN_ASKED} פעמים, ולכן מוצגים בלי אחוז`);
  }
  const more = rows.length > 20 ? el('p', { class: 'sw-empty', text: `מוצגים 20 מתוך ${rows.length} נושאים.` }) : null;

  return dashCard('שליטה בנושאים', notes.join(' · '), table, more);
}

/**
 * Each subject's trajectory, as its own row of bars.
 *
 * One pooled trend line could not answer "which subject is improving": a run of
 * strong English and a run of weak maths average into a flat line describing
 * neither. The arrow compares the first third of a subject's attempts with the
 * last third, and is withheld below TREND_MIN_ATTEMPTS — two scores are a pair,
 * not a direction.
 */
function subjectProgressCard(attempts) {
  const trends = subjectTrends(attempts, 8).filter(t => t.points.length >= 2);
  if (trends.length === 0) return null;

  const rows = trends.map(t => {
    const spark = el('div', { class: 'spark' });
    for (const p of t.points) {
      const bar = el('div', { class: `spark-bar${p.percent < 60 ? ' low' : ''}` });
      bar.style.height = `${Math.max(6, Math.round(p.percent))}%`;
      bar.setAttribute('title', `${shortDate(p.t)}: ${Math.round(p.percent)}%`);
      spark.appendChild(bar);
    }

    let delta;
    if (t.delta == null) {
      delta = el('span', { class: 'delta delta-none', text: 'אין די נתונים' });
    } else {
      const flat = Math.abs(t.delta) < 1;
      delta = el('span', {
        class: `delta ${flat ? 'delta-flat' : (t.delta > 0 ? 'delta-up' : 'delta-down')}`,
        dir: 'ltr',
        text: flat ? '≈ יציב' : `${t.delta > 0 ? '▲ +' : '▼ '}${t.delta}%`
      });
    }

    const detail = t.delta == null
      ? `${t.count} מבחנים`
      : `${t.count} מבחנים · מ-${t.first}% ל-${t.latest}%`;

    return el('div', { class: 'trend-row' },
      el('span', { class: 'subj-name', text: subjectName(t.subject) }),
      spark,
      el('span', { class: 'trend-meta' }, delta, el('small', { text: detail })));
  });

  return dashCard('התקדמות לפי מקצוע',
    `שליש ראשון מול שליש אחרון · חץ מוצג רק מ-${TREND_MIN_ATTEMPTS} מבחנים ומעלה`, ...rows);
}

/**
 * What the reinforcement drills have earned back.
 *
 * Reads credited_points, which each drill accumulates on the attempt it fixed,
 * so this reports what happened rather than inferring it from a score that
 * cannot say how it got there. Absent entirely for a student who has never
 * drilled — a card reading "0 נקודות" teaches them nothing.
 */
function recoveryCard(attempts) {
  const r = drillRecovery(attempts);
  if (!r) return null;

  const tiles = el('div', { class: 'stat-grid' },
    statTile(String(r.points), 'נקודות שהוחזרו', 'בזכות תרגול נושאים'),
    statTile(String(r.attempts), r.attempts === 1 ? 'מבחן שופר' : 'מבחנים שופרו'),
    statTile(`${Math.round(r.recoveredShare)}%`, 'מהנקודות שאבדו', 'הוחזרו באותם מבחנים'));

  return dashCard('שיפור בזכות תרגול',
    'תרגול נושאים שטעית בהם מעלה את ציון המבחן המקורי, בלי לשנות את מספר השאלות', tiles);
}

/** Hebrew for a week bucket: "השבוע", "שבוע שעבר", or "לפני N שבועות". */
function weekLabel(weeksAgo) {
  if (weeksAgo === 0) return 'השבוע';
  if (weeksAgo === 1) return 'שעבר';
  return `לפני ${weeksAgo}`;
}

/**
 * Effort and consistency: how much, how often, how long a sitting.
 *
 * Minutes come only from attempts whose clock can be believed — see
 * MAX_SECONDS_PER_QUESTION — and the card says so when any were left out, in
 * place of quietly presenting a filtered figure as the whole picture.
 */
function effortCard(attempts, now = Date.now()) {
  const e = effort(attempts, now);
  if (!e) return null;

  const tiles = el('div', { class: 'stat-grid' },
    statTile(String(e.questions), 'שאלות נענו', `${e.questionsPerAttempt} בממוצע למבחן`),
    statTile(`${e.minutes}`, 'דקות תרגול',
      e.minutesPerSession != null ? `${e.minutesPerSession} בממוצע למבחן` : ''),
    statTile(String(e.days.length), e.days.length === 1 ? 'יום פעיל' : 'ימים פעילים'));

  // Week bars, scaled to the busiest week so a quiet one still reads as quiet
  // rather than as no data.
  const peak = Math.max(1, ...e.weeks.map(w => w.questions));
  const bars = el('div', { class: 'trend-bars' });
  for (const w of e.weeks) {
    const bar = el('div', { class: 'trend-bar' });
    bar.style.height = `${w.questions ? Math.max(4, Math.round((w.questions / peak) * 100)) : 2}%`;
    bars.appendChild(el('div', { class: 'trend-col' },
      el('span', { class: 'trend-val', text: String(w.questions) }),
      el('div', { class: 'trend-track' }, bar),
      el('span', { class: 'trend-date', text: weekLabel(w.weeksAgo) })));
  }
  const weeks = el('div', { class: 'trend' }, bars);
  weeks.setAttribute('role', 'img');
  weeks.setAttribute('aria-label',
    `שאלות לשבוע — ${e.weeks.map(w => `${weekLabel(w.weeksAgo)}: ${w.questions}`).join(', ')}`);

  const note = e.untimedAttempts > 0
    ? `זמן התרגול מחושב מ-${e.timedAttempts} מבחנים; ${e.untimedAttempts === 1
      ? 'מבחן אחד לא נכלל כי הושהה וחודש מאוחר יותר'
      : `${e.untimedAttempts} מבחנים לא נכללו כי הושהו וחודשו מאוחר יותר`}`
    : `זמן התרגול מחושב מ-${e.timedAttempts} מבחנים`;

  return dashCard('התמדה ומאמץ', note, tiles,
    el('h4', { class: 'dash-sub', text: 'שאלות בשישה השבועות האחרונים' }), weeks);
}

/** Average by difficulty band — where the ceiling actually is. */
function difficultyCard(attempts) {
  const rows = byDifficulty(attempts).filter(r => r.count > 0);
  if (rows.length < 2) return null;

  const nodes = rows.map(r => {
    const name = r.difficulty === 'mixed' ? 'מעורב' : difficultyName(r.difficulty);
    const fill = el('div', { class: `meter-fill${r.avgPercent < 60 ? ' low' : ''}` });
    fill.style.width = `${Math.max(2, Math.round(r.avgPercent))}%`;
    return el('div', { class: 'subj-row' },
      el('span', { class: 'subj-name', text: name }),
      el('div', { class: 'meter' }, fill),
      el('span', { class: 'subj-val', text: `${Math.round(r.avgPercent)}% · ${r.count} מבחנים` }));
  });
  return dashCard('לפי רמת קושי', 'ממוצע ציון למבחן בכל רמה', ...nodes);
}

/** Renders the whole personal dashboard from the student's own data. */
/**
 * The study half of the personal board.
 *
 * Kept separate from the quiz statistics rather than merged into them: reading
 * lessons and answering questions are different activities, and averaging a
 * "lessons finished" count into a score would describe neither. The leaderboard
 * stays quiz-only for the same reason — study progress is private and is not a
 * competition.
 */
function studySection(progressMap) {
  const rows = [...(progressMap instanceof Map ? progressMap.values() : [])];
  if (rows.length === 0) {
    return dashCard('הלמידה שלי', null,
      el('p', { class: 'empty-state', text: 'עדיין לא נלמד אף נושא. כל שיעור שתתחיל יופיע כאן.' }));
  }

  const done = rows.filter(r => r.completed);
  const inProgress = rows.filter(r => !r.completed);
  const cardsRead = rows.reduce((sum, r) => sum + (Number(r.cards_seen) || 0), 0);

  const bySubject = new Map();
  for (const row of rows) {
    const key = row.subject || '';
    const entry = bySubject.get(key) || { done: 0, started: 0 };
    if (row.completed) entry.done++; else entry.started++;
    bySubject.set(key, entry);
  }

  const tiles = el('div', { class: 'stat-grid' },
    statTile(String(done.length), 'שיעורים הושלמו'),
    statTile(String(inProgress.length), 'שיעורים באמצע'),
    statTile(String(cardsRead), 'חלקי שיעור שנקראו'));

  const list = el('div', { class: 'sw-list' });
  for (const [subject, entry] of bySubject) {
    list.appendChild(el('div', { class: 'activity-item' },
      el('span', { class: 'activity-label', text: subjectName(subject) }),
      el('span', { class: 'activity-meta', text: `${entry.done} הושלמו · ${entry.started} באמצע` })));
  }

  return dashCard('הלמידה שלי', 'שיעורים נספרים בנפרד מהמבחנים ואינם משפיעים על הציון', tiles, list);
}

/**
 * The games card.
 *
 * Per mode rather than one pooled score, because the modes are not on a common
 * scale — see analytics.gameStats. The tiles carry only what IS comparable
 * across all of them: how much was played, how accurately, and the longest
 * streak.
 */
function gamesSection(gameScores) {
  const g = gameStats(gameScores);
  if (!g) return null;

  const favourite = GAME_MODES[g.favourite] ? GAME_MODES[g.favourite].label : g.favourite;
  const tiles = el('div', { class: 'stat-grid' },
    statTile(String(g.runs), 'משחקים'),
    statTile(`${g.accuracy}%`, 'דיוק במשחקים'),
    statTile(String(g.bestStreak), 'הרצף הארוך ביותר'),
    statTile(favourite, 'המשחק המועדף'));

  const body = el('tbody');
  for (const m of g.modes) {
    const label = GAME_MODES[m.mode] ? GAME_MODES[m.mode].label : m.mode;
    body.appendChild(el('tr', {},
      el('td', { text: label }),
      el('td', { text: String(m.runs) }),
      el('td', { text: String(m.bestScore) }),
      el('td', { text: `${m.accuracy}%` }),
      el('td', { text: String(m.bestStreak) })));
  }

  const table = el('div', { class: 'table-wrap' },
    el('table', { class: 'history-table' },
      el('thead', {},
        el('tr', {},
          el('th', { text: 'משחק' }),
          el('th', { text: 'ריצות' }),
          el('th', { text: 'שיא' }),
          el('th', { text: 'דיוק' }),
          el('th', { text: 'רצף' }))),
      body));

  const note = g.minutes >= 1
    ? el('p', { class: 'sw-empty', text: `שיחקת בסך הכול ${g.minutes} דקות.` })
    : null;

  return dashCard('המשחקים שלי',
    'כל מצב משחק נמדד בנפרד — הניקוד שלהם אינו על אותו סולם', tiles, table, note);
}

export function renderDashboard(studentName, attempts, errorTopics, lessonProgress, gameScores, topicResults = []) {
  $('dashboard-greeting').textContent = attempts.length
    ? `שלום ${studentName}, כך נראים ההישגים שלך:`
    : `שלום ${studentName}!`;

  const container = $('dashboard-content');
  container.replaceChildren();

  const hasStudy = lessonProgress instanceof Map && lessonProgress.size > 0;
  const games = gamesSection(gameScores);
  if (attempts.length === 0) {
    // Study or games alone are worth a board. A student who has read lessons or
    // played but not yet sat a quiz used to be told they had no data at all.
    if (games) { container.appendChild(el('h3', { class: 'dash-heading', text: 'משחקים' })); container.appendChild(games); }
    if (hasStudy) container.appendChild(studySection(lessonProgress));
    else if (!games) emptyState(container, 'עדיין אין נתונים להצגה. למד נושא או השלם מבחן כדי לראות ניתוח אישי.');
    return;
  }

  container.appendChild(el('h3', { class: 'dash-heading', text: 'מבחנים' }));

  const o = overview(attempts);

  // Overview: the ring is weighted accuracy — every question counts once — and
  // says so. The per-quiz mean sits beside it as its own labelled tile instead
  // of masquerading as the same measurement, which is what it did when it was
  // the unlabelled ring and the weighted figure was the unlabelled tile.
  const tiles = el('div', { class: 'stat-grid' },
    statTile(String(o.count), 'מבחנים הושלמו'),
    statTile(`${o.totalCorrect}/${o.totalQuestions}`, 'תשובות נכונות', 'מתוך כל השאלות שנענו'),
    statTile(`${Math.round(o.avgPercent)}%`, 'ממוצע ציון למבחן', 'כל מבחן במשקל שווה'),
    statTile(`${Math.round(o.bestPercent)}%`, 'הציון הגבוה ביותר'));
  container.appendChild(
    dashCard('מבט־על',
      'הטבעת מודדת דיוק: סך התשובות הנכונות חלקי סך השאלות, כך שלמבחן ארוך יש משקל גדול יותר',
      el('div', { class: 'overview-row' }, ringNode(o.accuracy, 'דיוק כולל'), tiles)));

  // Trend (needs at least two points to be meaningful).
  const points = trend(attempts, 12);
  if (points.length >= 2) {
    container.appendChild(dashCard('מגמת התקדמות',
      'ציון כל מבחן, מהישן לחדש', trendNode(points)));
  }

  const progress = subjectProgressCard(attempts);
  if (progress) container.appendChild(progress);

  const mastery = masteryCard(topicResults);
  if (mastery) container.appendChild(mastery);

  const recovery = recoveryCard(attempts);
  if (recovery) container.appendChild(recovery);

  const insights = insightsCard(attempts);
  if (insights) container.appendChild(insights);

  const effortNode = effortCard(attempts);
  if (effortNode) container.appendChild(effortNode);

  const byLevel = difficultyCard(attempts);
  if (byLevel) container.appendChild(byLevel);

  // Per-subject breakdown.
  const subjRows = perSubject(attempts).map(subjectRow);
  container.appendChild(dashCard('פילוח לפי מקצוע',
    'העמודה מודדת דיוק — תשובות נכונות מתוך כל השאלות שנשאלו במקצוע', ...subjRows));

  // Strengths & weaknesses.
  const strong = strongSubjects(attempts, 80);
  const weak = weakTopics(errorTopics, 6);
  const sw = el('div', { class: 'sw-grid' });

  const strongBox = el('div', { class: 'sw-box' }, el('h4', { text: 'החוזקות שלך' }));
  if (strong.length) {
    const wrap = el('div', { class: 'chips' });
    strong.forEach(s => wrap.appendChild(chip(`${subjectName(s.subject)} · ${Math.round(s.accuracy)}%`, 'strong')));
    strongBox.appendChild(wrap);
  } else {
    strongBox.appendChild(el('p', { class: 'sw-empty', text: 'המשך להתאמן כדי לבסס חוזקות (80% ומעלה).' }));
  }

  const weakBox = el('div', { class: 'sw-box' }, el('h4', { text: 'נושאים לחיזוק' }));
  if (weak.length) {
    // The same control as the side panel's, so a topic looks and behaves
    // identically wherever the student meets it.
    const wrap = el('div', { class: 'chips side-weak-chips' });
    for (const w of weak) wrap.appendChild(weakTopicChip(w, 'dashboard-screen'));
    weakBox.appendChild(wrap);
  } else {
    weakBox.appendChild(el('p', { class: 'sw-empty', text: 'אין נושאים חלשים בולטים — כל הכבוד!' }));
  }

  sw.append(strongBox, weakBox);
  container.appendChild(dashCard('חוזקות ונקודות לחיזוק',
    `חוזקה = דיוק 80% ומעלה במקצוע · נושא לחיזוק נשקל לפי ${WEAK_TOPIC_WINDOW} המבחנים האחרונים`, sw));

  // Recent activity.
  const list = el('ul', { class: 'activity-list' });
  for (const a of recent(attempts, 6)) {
    const meta = el('span', { class: 'activity-meta', dir: 'ltr',
      text: `${Math.round(a.percent)}%` });
    const label = el('span', { class: 'activity-label',
      text: `${subjectName(a.subject)} · ${gradeName(a.grade)}` });
    const date = el('span', { class: 'activity-date', dir: 'ltr', text: formatDate(a.created_at) });
    list.appendChild(el('li', { class: 'activity-item' }, label, date, meta));
  }
  container.appendChild(dashCard('פעילות אחרונה', 'ששת המבחנים האחרונים, מהחדש לישן', list));

  if (games) {
    container.appendChild(el('h3', { class: 'dash-heading', text: 'משחקים' }));
    container.appendChild(games);
  }

  container.appendChild(el('h3', { class: 'dash-heading', text: 'למידה' }));
  container.appendChild(studySection(lessonProgress));
}

// --- setup screen: subject tiles, difficulty pills, side panel --------

const SUBJECT_META = {
  math: { icon: '🧮', sub: 'חשבון והנדסה' },
  science: { icon: '🔬', sub: 'טבע, חומר ואנרגיה' },
  coding: { icon: '💻', sub: 'חשיבה אלגוריתמית וקוד' },
  english: { icon: '🔤', sub: 'אוצר מילים ודקדוק' },
  hebrew: { icon: 'א', sub: 'הבנה ולשון' },
  psychometric: { icon: '🎯', sub: 'כמותי, מילולי ואנגלית' },
  psychotechnical: { icon: '🧩', sub: 'צורות, מרחב ודיוק' },
  reliability: { icon: '🛡️', sub: 'שיפוט מצבי ועקביות' },
  writing: { icon: '✍️', sub: 'טיעון, מבנה ולשון' }
};

/** What the student is preparing for, shown when an extra subject is picked. */
const EXTRA_BLURB = {
  psychometric: 'הבחינה הפסיכומטרית: פרקים כמותי, מילולי ואנגלית.',
  psychotechnical: 'מבחני מיון פסיכוטכניים: צורות, סדרות, תפיסה מרחבית, הוראות ודיוק.',
  reliability: 'שאלוני אמינות במיון תעסוקתי: מה נמדד, עקביות, ושיפוט מצבי.',
  writing: 'מטלת הכתיבה: ניסוח טענה, מבנה החיבור, מילות קישור ומחוון ההערכה.'
};

/** Builds one tile for a subject. Shared by the quiz card and the extra card. */
function subjectTile(id, selectedId, action) {
  const meta = SUBJECT_META[id] || { icon: '📘', sub: '' };
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = `subject-tile ${id}`;
  tile.dataset.action = action;
  tile.dataset.subject = id;
  tile.setAttribute('aria-pressed', String(id === selectedId));
  const ico = document.createElement('span');
  ico.className = 'tile-ico';
  ico.setAttribute('aria-hidden', 'true');
  ico.textContent = meta.icon;
  const name = document.createElement('b');
  name.textContent = SUBJECTS[id] ? SUBJECTS[id].name : id;
  const sub = document.createElement('small');
  sub.textContent = meta.sub;
  tile.append(ico, name, sub);
  return tile;
}

/**
 * The quiz card's subject tiles — school subjects only.
 *
 * Gradeless subjects are excluded because this card's next control is a grade
 * picker, and there is no year to pick for them. They live in the
 * "מקצועות נוספים" card instead, which offers both study and quiz.
 */
export function renderSubjectTiles(selectedId) {
  const host = $('subject-tiles');
  if (!host) return;
  host.replaceChildren();
  for (const id of subjectIds()) {
    if (isGradeless(id)) continue;
    host.appendChild(subjectTile(id, selectedId, 'pick-subject'));
  }
}

/** The extra card's tiles: exactly the gradeless subjects. */
export function renderExtraTiles(selectedId) {
  const host = $('extra-tiles');
  if (!host) return;
  host.replaceChildren();
  for (const id of gradelessSubjects()) {
    host.appendChild(subjectTile(id, selectedId, 'extra-subject'));
  }
  markExtraTile(selectedId);
}

/** Reflects the chosen subject in the tiles. */
export function markSubjectTile(id) {
  for (const t of document.querySelectorAll('#subject-tiles .subject-tile')) {
    t.setAttribute('aria-pressed', String(t.dataset.subject === id));
  }
}

/** Reflects the chosen extra subject, and names what it prepares for. */
export function markExtraTile(id) {
  for (const t of document.querySelectorAll('#extra-tiles .subject-tile')) {
    t.setAttribute('aria-pressed', String(t.dataset.subject === id));
  }
  const blurb = $('extra-blurb');
  if (blurb) blurb.textContent = EXTRA_BLURB[id] || '';
}

export function getExtraCount() { return Number($('extra-count').value); }
export function getExtraDifficulty() {
  const v = $('extra-difficulty').value;
  return v ? Number(v) : null;
}

/** Reflects the chosen difficulty in the pills and the hidden select. */
export function markLevelPill(value) {
  const v = value == null ? '' : String(value);
  for (const p of document.querySelectorAll('#difficulty-pills .lv-pill')) {
    const on = p.dataset.value === v;
    p.classList.toggle('on', on);
    p.setAttribute('aria-pressed', String(on));
  }
  const sel = $('difficulty-select');
  if (sel) sel.value = v;
}

/** Renders the setup side panel (progress ring + clickable weak topics) from
 *  the student's own data, or hides it when there is nothing to show. */
export function renderSetupSide(studentName, attempts, errorTopics, subjectId, lessonProgress, grade = null, cleared = null) {
  const progEl = $('setup-progress');
  const weakEl = $('setup-weak');
  if (!progEl || !weakEl) return;

  // `subjectId` null means the student has not chosen a subject yet, and the
  // panel covers EVERYTHING rather than silently reporting on the form's default.
  // It used to read "ההתקדמות שלך במתמטיקה" on a screen where nobody had picked
  // maths, which made a student who had only studied English think their work
  // had not registered.
  const allAttempts = attempts || [];
  const allErrors = errorTopics || [];
  const subjAttempts = subjectId ? allAttempts.filter(a => a.subject === subjectId) : allAttempts;
  const subjErrors = subjectId ? allErrors.filter(e => e.subject === subjectId) : allErrors;

  const scopeName = subjectId
    ? `${subjectName(subjectId)}${grade == null ? '' : ` · ${gradeName(grade)}`}`
    : 'כל המקצועות';
  const title = `ההתקדמות שלך — ${scopeName}`;

  const o = overview(subjAttempts);
  const allRows = lessonProgress instanceof Map ? [...lessonProgress.values()] : [];
  // Rows are filtered by the same scope as the denominator, so the fraction
  // cannot read 20/14 for a student who studied a grade they are not scoped to.
  const subjLessons = allRows.filter(r =>
    (subjectId == null || r.subject === subjectId) &&
    (grade == null || Number(r.grade) === Number(grade)));
  const done = subjLessons.filter(r => r.completed).length;
  const started = subjLessons.length - done;

  // The ring measures LEARNING, not quiz average: how much of the material this
  // student has actually worked through. It used to show the quiz average, which
  // meant the panel on the study side was scored entirely by exams — a student
  // who had studied and not yet been tested saw 0%.
  //
  // With no subject chosen the denominator widens to every lesson in the app,
  // so the ring answers "how much of everything have I covered" rather than
  // collapsing to 0% for want of a subject to divide by.
  const available = lessonsInScope(subjectId, grade);
  // Part-read lessons count for their fraction, so the ring moves during a
  // lesson and not only at the end of one.
  const learned = available
    ? Math.min(100, Math.round((lessonCredit(subjLessons) / available) * 100))
    : 0;

  progEl.hidden = false;
  const stats = el('div', { class: 'side-stats' },
    el('div', { class: 'side-stat' },
      el('b', { text: available ? `${done}/${available}` : String(done) }),
      el('small', { text: 'שיעורים שהושלמו' })),
    started > 0
      ? el('div', { class: 'side-stat' }, el('b', { text: String(started) }), el('small', { text: 'שיעורים באמצע' }))
      : null,
    el('div', { class: 'side-stat' }, el('b', { text: String(o.count) }), el('small', { text: 'מבחנים' })),
    o.count > 0
      ? el('div', { class: 'side-stat' }, el('b', { text: `${Math.round(o.avgPercent)}%` }), el('small', { text: 'ממוצע במבחנים' }))
      : null);
  progEl.replaceChildren(
    el('h3', { text: title }),
    ringNode(learned),
    el('p', { class: 'side-ring-label', text: 'מהחומר נלמד' }),
    stats);

  const weak = weakTopics(subjErrors, 6, undefined, cleared);
  // Emptied as well as hidden. Hiding alone left the last set of chips sitting
  // in the DOM, so the topics a student had just cleared would reappear for a
  // frame the next time the panel had something to show.
  if (weak.length === 0) { weakEl.hidden = true; weakEl.replaceChildren(); return; }
  weakEl.hidden = false;
  const chips = el('div', { class: 'side-weak-chips' });
  for (const w of weak) chips.appendChild(weakTopicChip(w, 'setup-screen'));
  weakEl.replaceChildren(el('h3', { text: 'נושאים לחיזוק' }), chips);
}

// --- auth screen ------------------------------------------------------

/** Switches the auth form between login and register. */
export function setAuthMode(mode) {
  const register = mode === 'register';
  for (const t of document.querySelectorAll('.auth-tab')) {
    const on = t.dataset.mode === mode;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  }
  const dg = $('auth-display-group');
  if (dg) dg.hidden = !register;
  const submit = $('auth-submit');
  if (submit) submit.textContent = register ? 'הרשמה' : 'כניסה';
  const pw = $('auth-password');
  if (pw) pw.setAttribute('autocomplete', register ? 'new-password' : 'current-password');
  hideAuthError();
}

export function getAuthFields() {
  return {
    username: $('auth-username').value.trim(),
    password: $('auth-password').value,
    displayName: $('auth-display').value.trim()
  };
}

export function showAuthError(message) {
  const e = $('auth-error');
  if (!e) return;
  e.textContent = message;
  e.hidden = false;
}

export function hideAuthError() {
  const e = $('auth-error');
  if (e) e.hidden = true;
}

export function setAuthBusy(busy) {
  const b = $('auth-submit');
  if (!b) return;
  b.disabled = busy;
  if (busy) {
    b.dataset.label = b.textContent;
    b.textContent = 'רגע...';
  } else if (b.dataset.label) {
    b.textContent = b.dataset.label;
  }
}

export function clearAuthForm() {
  for (const id of ['auth-username', 'auth-password', 'auth-display']) {
    const el = $(id);
    if (el) el.value = '';
  }
  hideAuthError();
}

/** How many lessons exist for a subject, across every grade it offers. The
 *  denominator of the study ring — "2 of 40" is progress; a bare "2" is not. */
/**
 * How many lessons the ring is measuring against.
 *
 * The grade matters as much as the subject. Maths alone carries 98 lessons
 * across twelve years, and no student studies twelve years at once — measured
 * against all of them, a fifth-grader who had finished every grade-5 lesson
 * showed 8% and concluded the counter was broken. Narrowing to the grade in
 * play is what makes the number reachable, and therefore meaningful.
 *
 * Either argument may be null, which widens the scope rather than emptying it.
 */
function lessonsInScope(subjectId, grade) {
  const g = grade == null ? null : Number(grade);
  return LESSONS.filter(l =>
    (subjectId == null || l.subject === subjectId) &&
    (g == null || l.grades.includes(g))).length;
}

/**
 * Credit earned across the lessons in scope, counting part-read ones.
 *
 * A finished lesson is worth 1; one stopped four cards into eight is worth 0.5.
 * Whole-lesson counting meant a student could read for twenty minutes, stop one
 * card short, and watch the ring stay on zero — which reads as "nothing was
 * saved" rather than "not finished yet".
 */
function lessonCredit(rows) {
  let credit = 0;
  for (const r of rows) {
    if (r.completed) { credit += 1; continue; }
    const seen = Number(r.cards_seen) || 0;
    const total = Number(r.cards_total) || 0;
    if (seen > 0 && total > 0) credit += Math.min(1, seen / total);
  }
  return credit;
}

/** Shuts both path cards on the setup screen — the neutral "Home" state. */
export function collapseModes() {
  for (const card of document.querySelectorAll('.mode-card')) {
    card.classList.remove('open');
    const head = card.querySelector('.mode-head');
    if (head) head.setAttribute('aria-expanded', 'false');
    const body = card.querySelector('.mode-body');
    if (body) body.hidden = true;
  }
}

/**
 * Every control that opens the drawer: the edge tab at desk widths and the
 * header button on phones. CSS decides which one is visible, so both are kept
 * in the same state rather than the code guessing at the breakpoint.
 */
function drawerTriggers() {
  return document.querySelectorAll('[data-action="open-drawer"]');
}

/** Reflects the drawer's state on the controls that open it. */
export function setMenuExpanded(open) {
  for (const t of drawerTriggers()) t.setAttribute('aria-expanded', String(Boolean(open)));
}

/**
 * Stamps the release at the foot of the drawer.
 *
 * The build id is appended only when the deploy stamped one, so a working copy
 * reads "גרסה 1.0.0" and the deployed site reads "גרסה 1.0.0 · a2b2d02" —
 * which is the quickest answer to "did my change actually go out?", given the
 * JS module graph is deliberately unversioned and Pages caches it.
 */
export function renderVersion() {
  const host = $('drawer-version');
  if (!host) return;
  const stamped = BUILD_ID && BUILD_ID !== 'dev';
  host.textContent = stamped ? `גרסה ${APP_VERSION} · ${BUILD_ID}` : `גרסה ${APP_VERSION}`;
  host.setAttribute('dir', 'rtl');
}

/** "Yesterday", "today", or a date — how long the quiz has been waiting. */
function whenSaved(ms) {
  const days = Math.floor((Date.now() - Number(ms || 0)) / 86400000);
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
}

/**
 * The offer to resume an unfinished quiz, or nothing when there is none.
 *
 * Shows how far through it got, so the student can judge whether to carry on or
 * drop it — "12 מתוך 40" is a different decision from "38 מתוך 40".
 */
export function renderResume(list) {
  const host = $('resume-card');
  if (!host) return;

  // Accepts one or many. A single object is still honoured so any caller that
  // has not been updated cannot silently render nothing.
  const items = Array.isArray(list) ? list : (list ? [list] : []);
  if (items.length === 0) { host.hidden = true; host.replaceChildren(); return; }

  host.hidden = false;
  host.replaceChildren(
    el('p', { class: 'resume-title' },
      el('span', { class: 'resume-ico', attrs: { 'aria-hidden': 'true' }, text: '⏸' }),
      el('b', { text: items.length === 1 ? 'יש לך מבחן שלא הסתיים' : `יש לך ${items.length} מבחנים שלא הסתיימו` })),
    ...items.map(info => {
      const where = `${subjectName(info.subject)}${info.grade == null ? '' : ` · ${gradeName(info.grade)}`}`;
      const row = el('div', { class: 'resume-item' },
        el('div', { class: 'resume-text' },
          el('b', { text: where }),
          el('small', { text: `${info.answered} מתוך ${info.total} שאלות · ${whenSaved(info.savedAt)}` })),
        el('div', { class: 'resume-actions' },
          el('button', {
            class: 'btn cta-btn btn-small', text: 'המשך ←',
            attrs: { type: 'button', 'aria-label': `המשך את המבחן ב${where}` }
          }),
          el('button', {
            class: 'btn btn-secondary btn-small', text: 'מחק',
            attrs: { type: 'button', 'aria-label': `מחק את המבחן ב${where}` }
          })));

      const [resume, discard] = row.querySelectorAll('button');
      resume.dataset.action = 'resume-quiz';
      discard.dataset.action = 'discard-resume';
      if (info.id != null) {
        resume.dataset.quizId = String(info.id);
        discard.dataset.quizId = String(info.id);
      }
      return row;
    }));
}

/**
 * The mode picker, built from the rules themselves.
 *
 * Rendered from MODES rather than written into the markup, so adding a fourth
 * game means one entry in js/game.js and nothing here.
 */
export function renderGameModes(selectedMode) {
  const host = $('game-modes');
  if (!host) return;
  host.replaceChildren();
  for (const mode of Object.values(GAME_MODES)) {
    const btn = el('button', {
      class: 'game-mode',
      attrs: { type: 'button', 'aria-pressed': String(mode.id === selectedMode) }
    },
      el('b', { text: mode.label }),
      el('small', { text: mode.blurb }));
    btn.dataset.action = 'game-mode';
    btn.dataset.mode = mode.id;
    host.appendChild(btn);
  }
  markGameMode(selectedMode);
}

/**
 * Reflects the chosen mode, and adapts the form to it.
 *
 * טיפוס has no difficulty to choose — the level is what it climbs — so the
 * control is hidden rather than shown and ignored, which would imply a setting
 * that does nothing.
 */
export function markGameMode(modeId) {
  for (const b of document.querySelectorAll('#game-modes .game-mode')) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === modeId));
  }
  const mode = GAME_MODES[modeId] || GAME_MODES.sprint;

  const rules = $('game-rules');
  if (rules) rules.textContent = GAME_RULES_TEXT[mode.id] || mode.blurb;

  const group = $('game-difficulty-group');
  if (group) group.hidden = Boolean(mode.climbs);

  const start = $('game-start');
  if (start) start.textContent = `התחל ${mode.label} ←`;
}

/** What each mode asks of the student, in full. */
const GAME_RULES_TEXT = {
  sprint: '60 שניות. תשובה נכונה מזכה בנקודות — מהר יותר שווה יותר, ורצף מכפיל. תשובה שגויה גורעת 3 שניות מהשעון.',
  accuracy: 'טעות אחת והמשחק נגמר. 15 שניות לכל שאלה, וגם נגמר הזמן נחשב טעות. כמה תצליח לצבור בלי ליפול?',
  climb: 'מתחילים ברמה 1, וכל תשובה נכונה מעלה רמה — עד רמה 5. טעות מורידה רמה ועולה חיים; שלוש טעויות והמשחק נגמר.'
};

/** The games card's subject tiles — every subject can be played. */
export function renderGameTiles(selectedId) {
  const host = $('game-tiles');
  if (!host) return;
  host.replaceChildren();
  for (const id of subjectIds()) host.appendChild(subjectTile(id, selectedId, 'game-subject'));
  markGameTile(selectedId);
}

export function markGameTile(id) {
  for (const t of document.querySelectorAll('#game-tiles .subject-tile')) {
    t.setAttribute('aria-pressed', String(t.dataset.subject === id));
  }
}

/** Fills the games grade picker from whatever grades the subject offers. */
export function populateGameGrades(subjectId) {
  const select = $('game-grade');
  if (!select) return;
  fillGradeSelect(select, subjectId, false);
}

export function getGameGrade() { return Number($('game-grade').value); }
export function getGameDifficulty() {
  const v = $('game-difficulty').value;
  return v ? Number(v) : null;
}

export function showHeaderUser(name) {
  const btn = document.querySelector('.header-logout');
  if (!btn) return;
  $('header-username').textContent = name;
  btn.hidden = false;
  // The drawer lists a signed-in student's topics and progress, so its triggers
  // appear and disappear with the session, exactly like the logout pill.
  for (const t of drawerTriggers()) t.hidden = false;
  // Same for the board and dashboard links: both lead to the student's own
  // results, so neither means anything to a visitor who is not signed in.
  for (const [buttonId] of HEADER_LINKS) {
    const link = $(buttonId);
    if (link) link.hidden = false;
  }
}

export function hideHeaderUser() {
  const btn = document.querySelector('.header-logout');
  if (btn) btn.hidden = true;
  for (const t of drawerTriggers()) t.hidden = true;
  // Signing out lands on the auth screen, where Home means nothing.
  const home = $('header-home');
  if (home) home.hidden = true;
  for (const [buttonId] of HEADER_LINKS) {
    const link = $(buttonId);
    if (link) link.hidden = true;
  }
}
