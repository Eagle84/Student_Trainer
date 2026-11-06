/**
 * The navigation drawer: pick a topic to study or to be quizzed on, without
 * leaving the screen you are on.
 *
 * Slides in from the inline-start edge, which on this RTL page is the right —
 * expressed with logical properties so it stays correct if the app is ever
 * rendered LTR.
 *
 * Its own module rather than more of ui.js: the drawer spans both modes (it
 * lists study topics AND quiz topics), so it belongs to neither ui.js's quiz
 * screens nor ui-lesson.js's lesson screens.
 */
import { $, el } from './dom.js';
import { subjectName, gradeName } from './ui.js';
import { topicsFor, gradelessSubjects, subjectsForGrade, NO_GRADE } from './subjects/index.js';
import { getLesson } from './lessons/index.js';
import { progressLabel, selectedSubjects } from './ui-lesson.js';

/** The element focus returns to when the drawer closes. */
let opener = null;
/** Which groups are expanded, kept across opens so the drawer reopens as left. */
const expanded = new Set(['study']);

export function isOpen() {
  const drawer = $('drawer');
  return Boolean(drawer) && !drawer.hidden;
}

/**
 * Renders the drawer body for a subject and grade.
 *
 * `progressMap` marks finished and part-way lessons. It is passed in rather
 * than fetched here because this module does no I/O — same rule as ui.js.
 */
export function renderDrawer(scope, progressMap) {
  const grade = scope.grade;
  const track = scope.track;
  // Only subjects that actually teach this grade. The stored selection can
  // outlive a grade change — pick מתמטיקה and אנגלית in grade 5, drop to grade
  // 2, and only maths still exists there.
  const offered = subjectsForGrade(grade);
  const chosen = selectedSubjects(scope).filter(id => offered.includes(id));
  const subjects = chosen.length ? chosen : [scope.subjectId];

  const context = $('drawer-context');
  if (context) {
    context.textContent = subjects.length === 1
      ? `${subjectName(subjects[0])} · ${gradeName(grade)}`
      : `${subjects.length} מקצועות · ${gradeName(grade)}`;
  }

  const body = $('drawer-body');
  if (!body) return;

  const progress = progressMap instanceof Map ? progressMap : new Map();
  const perSubject = subjects.map(id => ({ id, topics: topicsFor(id, grade, track) }));

  body.replaceChildren(
    group('study', 'ללמוד נושא', 'הסבר מונחה, ואז תרגול',
      [
        ...studyAllItem(subjects),
        ...sectioned(perSubject, ({ id, topics }) => studyItems(id, grade, topics, progress))
      ]),
    group('quiz', 'להיבחן על נושא', 'מבחן קצר על נושא אחד',
      [
        ...mixedQuizItem(subjects, grade),
        ...sectioned(perSubject, ({ id, topics }) => quizItems(id, grade, topics))
      ]),
    // Gradeless subjects get their own group rather than appearing in the two
    // above: those are scoped by the grade picker at the top of the drawer, and
    // these have no grade to be scoped by.
    group('extra', 'מקצועות נוספים', 'ללא קשר לכיתה', extraItems())
  );
}

/**
 * Flattens per-subject item lists, inserting a heading before each one.
 *
 * The heading is skipped for a single subject: with one selected the drawer
 * should look exactly as it always did, and a lone heading over the whole list
 * is noise.
 */
function sectioned(perSubject, build) {
  if (perSubject.length === 1) return build(perSubject[0]);
  const out = [];
  for (const entry of perSubject) {
    out.push(el('li', { class: 'drawer-subhead', text: subjectName(entry.id) }));
    out.push(...build(entry));
  }
  return out;
}

/**
 * Opens the full catalogue for everything selected.
 *
 * The quiz group has a row that acts on the whole selection; without this the
 * study group had none, and the only way in was to close the drawer and find
 * the button on the home screen. A student who has just ticked three subjects
 * is looking for somewhere to press.
 *
 * Absent for a single subject, where the per-topic rows below are already the
 * whole story and the home screen's button covers the rest.
 */
function studyAllItem(subjects) {
  const scope = subjects.length > 1 ? `${subjects.length} מקצועות` : 'לפי הסדר';

  // The thing to press. Starts a session that opens the first unfinished lesson
  // and rolls on to the next when it ends — the list below is for picking one
  // topic on purpose, which is a different intent.
  const start = el('button', {
    class: 'drawer-item drawer-item-btn drawer-item-start',
    attrs: { type: 'button', 'aria-label': 'התחל ללמוד לפי הסדר' }
  },
    el('span', { class: 'drawer-item-label', text: 'התחל ללמוד' }),
    el('span', { class: 'drawer-time', text: scope }));
  start.dataset.action = 'start-study';

  const rows = [el('li', {}, start)];
  if (subjects.length < 2) return rows;

  const all = el('button', {
    class: 'drawer-item drawer-item-btn drawer-item-all',
    attrs: { type: 'button', 'aria-label': `פתח את כל הנושאים של ${subjects.length} המקצועות` }
  },
    el('span', { class: 'drawer-item-label', text: 'כל הנושאים' }),
    el('span', { class: 'drawer-time', text: scope }));
  all.dataset.action = 'show-learn';
  rows.push(el('li', {}, all));
  return rows;
}

/**
 * The one row that starts a quiz spanning everything selected.
 *
 * Absent for a single subject, where it would be the ordinary quiz under a
 * grander name.
 */
function mixedQuizItem(subjects, grade) {
  if (subjects.length < 2) return [];
  const btn = el('button', {
    class: 'drawer-item drawer-item-btn drawer-item-mixed',
    attrs: { type: 'button', 'aria-label': `התחל מבחן מעורב על ${subjects.length} מקצועות` }
  },
    el('span', { class: 'drawer-item-label', text: 'מבחן מעורב' }),
    el('span', { class: 'drawer-time', text: `${subjects.length} מקצועות` }));
  btn.dataset.action = 'start-mixed-quiz';
  btn.dataset.grade = String(grade);
  return [el('li', {}, btn)];
}

/** One row per gradeless subject, opening its catalogue. */
function extraItems() {
  return gradelessSubjects().map(id => {
    const btn = el('button', {
      class: 'drawer-item drawer-item-btn',
      attrs: { type: 'button', 'aria-label': `למד ${subjectName(id)}` }
    },
      el('span', { class: 'drawer-item-label', text: subjectName(id) }),
      el('span', { class: 'drawer-time', text: `${topicsFor(id, NO_GRADE).length} נושאים` }));
    btn.dataset.action = 'extra-open';
    btn.dataset.subject = id;
    return el('li', {}, btn);
  });
}

/** One collapsible group. Both can be open at once — they are independent
 *  lists, and forcing one shut to open the other only hides information. */
function group(id, title, subtitle, items) {
  const open = expanded.has(id);

  const head = el('button', {
    class: 'drawer-group-head',
    attrs: { type: 'button', 'aria-expanded': String(open), 'aria-controls': `drawer-list-${id}` }
  },
    el('span', { class: 'drawer-group-titles' },
      el('b', { text: title }),
      el('small', { text: subtitle })),
    el('span', { class: 'drawer-caret', attrs: { 'aria-hidden': 'true' }, text: '▾' }));
  head.dataset.action = 'drawer-group';
  head.dataset.group = id;

  const list = el('ul', { class: 'drawer-list', attrs: { id: `drawer-list-${id}` } });
  list.hidden = !open;
  for (const item of items) list.appendChild(item);
  if (items.length === 0) {
    list.appendChild(el('li', { class: 'drawer-empty', text: 'אין נושאים זמינים לצירוף הזה.' }));
  }

  return el('section', { class: `drawer-group${open ? ' open' : ''}` }, head, list);
}

function studyItems(subjectId, grade, topics, progress) {
  return topics.map(topic => {
    const lesson = getLesson(subjectId, grade, topic);
    // A topic with no lesson is listed but inert. Dropping it would make the
    // drawer disagree with the catalogue about what the subject covers.
    if (!lesson) {
      return el('li', {},
        el('span', { class: 'drawer-item soon' },
          el('span', { class: 'drawer-item-label', text: topic }),
          el('span', { class: 'drawer-tag', text: 'בקרוב' })));
    }
    const status = progressLabel(progress.get(lesson.id));
    const marker = !status
      ? el('span', { class: 'drawer-time', text: `${lesson.minutes}′` })
      : status.done
        ? el('span', { class: 'drawer-tick', text: '✓' })
        // The fraction, not just "in progress": it is the difference between
        // "I barely started" and "I have one card left".
        : el('span', { class: 'drawer-partial', text: `${status.text.replace('באמצע — ', '')}` });

    const btn = el('button', {
      class: 'drawer-item drawer-item-btn',
      attrs: {
        type: 'button',
        'aria-label': status && !status.done
          ? `המשך ללמוד את הנושא ${topic}, ${status.text}`
          : `למד את הנושא ${topic}`
      }
    },
      el('span', { class: 'drawer-item-label', text: topic }), marker);
    btn.dataset.action = 'learn-topic';
    btn.dataset.topic = topic;
    btn.dataset.subject = subjectId;
    btn.dataset.grade = String(grade);
    btn.dataset.return = 'setup-screen';
    return el('li', {}, btn);
  });
}

function quizItems(subjectId, grade, topics) {
  return topics.map(topic => {
    const btn = el('button', {
      class: 'drawer-item drawer-item-btn',
      attrs: { type: 'button', 'aria-label': `תרגל את הנושא ${topic}` }
    }, el('span', { class: 'drawer-item-label', text: topic }));
    btn.dataset.action = 'practice-topic';
    btn.dataset.topic = topic;
    btn.dataset.subject = subjectId;
    btn.dataset.grade = String(grade);
    return el('li', {}, btn);
  });
}

/** Expands or collapses one group and repaints just that group. */
export function toggleGroup(id) {
  if (expanded.has(id)) expanded.delete(id);
  else expanded.add(id);

  const open = expanded.has(id);
  const head = document.querySelector(`.drawer-group-head[data-group="${id}"]`);
  if (!head) return;
  head.setAttribute('aria-expanded', String(open));
  head.closest('.drawer-group')?.classList.toggle('open', open);
  const list = $(`drawer-list-${id}`);
  if (list) list.hidden = !open;
}

export function openDrawer(trigger) {
  const drawer = $('drawer');
  const scrim = $('drawer-scrim');
  if (!drawer || !scrim) return;

  opener = trigger || document.activeElement;
  scrim.hidden = false;
  drawer.hidden = false;
  // Toggled on the next frame so the element is laid out before the transform
  // changes; setting both at once would skip the slide entirely.
  requestAnimationFrame(() => {
    drawer.classList.add('open');
    scrim.classList.add('open');
  });
  document.body.classList.add('drawer-locked');
  $('drawer-close')?.focus();
}

export function closeDrawer() {
  const drawer = $('drawer');
  const scrim = $('drawer-scrim');
  if (!drawer || drawer.hidden) return;

  drawer.classList.remove('open');
  scrim.classList.remove('open');
  document.body.classList.remove('drawer-locked');

  // Kept in the DOM until the slide-out finishes, then hidden so its contents
  // leave the tab order. 220ms matches the transition in the stylesheet.
  window.setTimeout(() => {
    drawer.hidden = true;
    if (scrim) scrim.hidden = true;
  }, 220);

  if (opener && document.contains(opener)) opener.focus();
  opener = null;
}

/**
 * Keeps Tab inside the open drawer.
 *
 * Without this, tabbing past the last item lands on the setup form behind the
 * scrim — focus goes somewhere the student cannot see and cannot click.
 */
export function trapTab(event) {
  const drawer = $('drawer');
  if (!drawer || drawer.hidden) return;
  const focusable = [...drawer.querySelectorAll('button:not([disabled])')]
    .filter(node => node.offsetParent !== null);
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
