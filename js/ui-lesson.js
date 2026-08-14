/**
 * Rendering for the two study-mode screens: the topic catalogue and the lesson
 * itself.
 *
 * Separate from ui.js on purpose — that module is already over a thousand lines
 * and covers six screens. The two share their DOM primitives through dom.js so
 * there is one element builder, not two drifting copies.
 *
 * XSS rule, same as ui.js: lesson prose is repo-authored but still goes through
 * sanitize() before innerHTML, so the allowlist is enforced in one place and a
 * future lesson pasted from elsewhere cannot introduce a sink. SVG visuals do
 * NOT go through it — sanitize() strips <svg> by design — and are safe because
 * js/visuals.js builds them from the author's own numbers with no student input.
 */
import { $, el } from './dom.js';
import { sanitize } from './sanitize.js';
import { renderDiagram } from './diagrams.js';
import { subjectName, gradeName } from './ui.js';
import { getSubject, subjectsForGrade, allGrades, topicsFor, SUBJECTS, isGradeless } from './subjects/index.js';
import { getLesson } from './lessons/index.js';
import { currentCard, cardCount, isFirstCard, isLastCard, stepsRemaining, activeHighlight, currentVariant } from './lesson.js';

/** Builds an element whose content is markup, sanitized on the way in. */
function rich(tag, className, markup) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.innerHTML = sanitize(markup);
  return node;
}

/** Builds a visual container, or null when the card declares none. */
function visualNode(spec) {
  const svg = spec ? renderDiagram(spec) : '';
  if (!svg) return null;
  const node = el('div', { class: 'lesson-visual' });
  node.innerHTML = svg; // trusted: numeric SVG from visuals.js, no student input
  return node;
}

// --- scope picker -----------------------------------------------------

/**
 * The grade-then-subject picker that scopes the study flow.
 *
 * Grade comes first because it is the fact about the student, and subject
 * second because which subjects exist depends on it — `subjectsForGrade` is
 * what enforces that, rather than showing all three and failing later with an
 * empty topic list.
 *
 * Rendered into whichever host is passed, so the drawer and the catalogue use
 * one implementation and cannot drift in what they offer.
 */
/**
 * The subjects a scope has selected, always non-empty.
 *
 * `subjects` is the multi-selection and `subjectId` is the primary one. Falling
 * back to the primary keeps every single-subject surface working unchanged
 * against a scope that has never been multi-selected.
 */
export function selectedSubjects(scope) {
  const list = Array.isArray(scope.subjects) ? scope.subjects.filter(Boolean) : [];
  return list.length ? list : [scope.subjectId];
}

export function renderScopePicker(host, scope, { host: hostName = 'learn', multi = false } = {}) {
  if (!host) return;

  // A gradeless subject has no year to pick, and the grade select is built from
  // allGrades() — which deliberately excludes its pseudo-grade. Rendering the
  // picker anyway would show grade א' selected and offer the subjects of grade
  // א', none of which is the subject being studied. It states the scope instead.
  if (isGradeless(scope.subjectId)) {
    host.replaceChildren(
      el('span', { class: 'scope-label', text: 'מסלול הכנה' }),
      el('div', { class: 'scope-subjects' },
        el('span', { class: 'scope-chip on', text: subjectName(scope.subjectId) })),
      el('p', { class: 'scope-note', text: 'מקצוע זה אינו משויך לכיתה. לבחירת מקצוע אחר — חזרה למסך הבית.' }));
    return;
  }

  // Ids must be unique per host: three copies of this picker can exist in the
  // DOM at once, and a duplicated id would point every label at the first one.
  const gradeId = `${hostName}-grade-pick`;
  const label = el('label', { class: 'scope-label', text: 'כיתה', attrs: { for: gradeId } });

  const select = el('select', {
    class: 'form-control scope-grade',
    attrs: { id: gradeId, 'aria-label': 'בחר כיתה' }
  });
  select.dataset.action = 'study-grade';
  for (const grade of allGrades()) {
    const option = el('option', { text: gradeName(grade) });
    option.value = String(grade);
    if (grade === Number(scope.grade)) option.selected = true;
    select.appendChild(option);
  }

  const available = subjectsForGrade(scope.grade);
  // In multi mode the chips are a checkbox set, not a radio group: several can
  // be on at once, and the aria role has to say so or a screen reader announces
  // every chip as the single current choice.
  const chosen = multi ? selectedSubjects(scope) : [scope.subjectId];
  const chips = el('div', {
    class: 'scope-subjects',
    attrs: { role: 'group', 'aria-label': multi ? 'בחר מקצוע אחד או יותר' : 'בחר מקצוע' }
  });
  for (const id of available) {
    const on = chosen.includes(id);
    const chip = el('button', {
      class: `scope-chip${multi ? ' scope-chip-multi' : ''}`,
      text: SUBJECTS[id] ? SUBJECTS[id].name : id,
      attrs: multi
        ? { type: 'button', role: 'checkbox', 'aria-checked': String(on) }
        : { type: 'button', 'aria-pressed': String(on) }
    });
    // aria-pressed is set in both cases so the CSS, which keys off it, does not
    // need to know which mode it is in.
    chip.setAttribute('aria-pressed', String(on));
    chip.dataset.action = multi ? 'study-subject-toggle' : 'study-subject';
    chip.dataset.subject = id;
    chips.appendChild(chip);
  }

  host.replaceChildren(
    el('div', { class: 'scope-row' }, label, select),
    el('span', { class: 'scope-label', text: 'מקצוע' }),
    chips);
}

// --- catalogue --------------------------------------------------------

/**
 * The topic catalogue for one subject and grade.
 *
 * `topics` comes from topicsFor(), so it lists everything the subject teaches
 * at this grade — including topics with no lesson written yet. Those still
 * render, marked בקרוב, because a catalogue that hid them would imply the
 * subject has five topics when it has forty.
 *
 * Nothing here starts a quiz. This is the study side, and a "practise" button
 * on every card was the single thing that made study mode feel like a second
 * way into the quiz — it also made בקרוב meaningless, since the card said the
 * topic was unavailable while offering a working quiz on it. Quizzes are
 * reached from the quiz card on the setup screen or the drawer's quiz list.
 */
/**
 * How a lesson's stored progress reads on a card: finished, part-way, or
 * untouched. Shared so the catalogue and the drawer cannot describe the same
 * row differently.
 */
export function progressLabel(row) {
  if (!row) return null;
  if (row.completed) return { done: true, text: '✓ נלמד' };
  const seen = Number(row.cards_seen) || 0;
  const total = Number(row.cards_total) || 0;
  if (seen <= 0) return null;
  return { done: false, text: total ? `באמצע — ${seen} מתוך ${total}` : 'באמצע' };
}

export function renderCatalog(subjectId, grade, topics, progressMap) {
  const sub = $('learn-sub');
  if (sub) {
    sub.textContent = `${subjectName(subjectId)} · ${gradeName(grade)} — בחר נושא ללמידה, ואחר כך תרגל אותו.`;
  }

  const grid = $('learn-grid');
  if (!grid) return;
  grid.replaceChildren();

  if (topics.length === 0) {
    grid.appendChild(el('p', { class: 'learn-empty', text: 'אין נושאים זמינים לצירוף הזה.' }));
    return;
  }

  const progress = progressMap instanceof Map ? progressMap : new Map();
  for (const card of catalogCards(subjectId, grade, topics, progress)) grid.appendChild(card);
}

/**
 * One card per topic.
 *
 * Extracted so the single-subject catalogue and the multi-subject one build
 * identical cards — a second copy would drift, and the difference would only
 * show up as one of them quietly losing the ✓ marker.
 */
function catalogCards(subjectId, grade, topics, progress) {
  return topics.map(topic => {
    const lesson = getLesson(subjectId, grade, topic);
    const status = lesson ? progressLabel(progress.get(lesson.id)) : null;
    const done = Boolean(status && status.done);

    const card = el('article', { class: `learn-card${lesson ? '' : ' soon'}${done ? ' done' : ''}${status && !done ? ' partial' : ''}` });
    card.appendChild(el('h3', { class: 'learn-topic', text: topic }));

    if (lesson) {
      card.appendChild(el('p', { class: 'learn-intro', text: lesson.intro }));
      const meta = el('div', { class: 'learn-meta' },
        el('span', { class: 'learn-time', text: `≈ ${lesson.minutes} דקות` }),
        status ? el('span', { class: done ? 'learn-done' : 'learn-partial', text: status.text }) : null);
      card.appendChild(meta);
    } else {
      card.appendChild(el('p', { class: 'learn-intro', text: 'השיעור לנושא הזה עדיין בכתיבה.' }));
      card.appendChild(el('div', { class: 'learn-meta' }, el('span', { class: 'learn-soon', text: 'בקרוב' })));
    }

    if (lesson) {
      const learn = el('button', {
        class: 'btn btn-small',
        text: done ? 'ללמוד שוב' : status ? 'להמשיך' : 'ללמוד',
        attrs: { type: 'button', 'aria-label': `למד את הנושא ${topic}` }
      });
      learn.dataset.action = 'open-lesson';
      learn.dataset.topic = topic;
      learn.dataset.subject = subjectId;
      learn.dataset.grade = String(grade);
      card.appendChild(el('div', { class: 'learn-actions' }, learn));
    }
    return card;
  });
}

/**
 * The catalogue for every subject the scope has selected.
 *
 * With one subject this is renderCatalog unchanged. With several, each subject
 * gets a heading and its own grid: a flat list of thirty topics drawn from three
 * subjects gives a student no way to tell a Hebrew גזרה from an English tense.
 */
/**
 * The study-session bar, and the lesson's next button while a session runs.
 *
 * Hidden entirely when there is no session, so a student who opened one lesson
 * from the catalogue sees exactly what they saw before.
 */
export function renderStudyBar(position) {
  const bar = $('study-bar');
  if (!bar) return;
  bar.hidden = !position;
  const count = $('study-bar-count');
  if (position && count) count.textContent = `שיעור ${position.at} מתוך ${position.total}`;
}

/** The end-of-session screen. */
export function renderStudyDone(result) {
  const line = $('study-done-line');
  if (line) {
    line.textContent = result.completed === 0
      ? 'לא הושלם אף שיעור הפעם.'
      : result.completed === 1
        ? `סיימת שיעור אחד מתוך ${result.total}.`
        : `סיימת ${result.completed} שיעורים מתוך ${result.total}.`;
  }
  const stats = $('study-done-stats');
  if (stats) {
    stats.replaceChildren(
      el('div', { class: 'stat-grid' },
        el('div', { class: 'stat-tile' },
          el('b', { class: 'stat-value', text: String(result.completed) }),
          el('span', { class: 'stat-label',
            text: result.completed === 1 ? 'שיעור שהושלם' : 'שיעורים שהושלמו' })),
        el('div', { class: 'stat-tile' },
          el('b', { class: 'stat-value', text: String(result.subjects.length) }),
          // Hebrew does not take a plural after one: "1 מקצועות" is wrong the
          // way "1 subjects" is.
          el('span', { class: 'stat-label', text: result.subjects.length === 1 ? 'מקצוע' : 'מקצועות' })),
        result.remaining > 0
          ? el('div', { class: 'stat-tile' },
              el('b', { class: 'stat-value', text: String(result.remaining) }),
              el('span', { class: 'stat-label', text: 'נשארו בתור' }))
          : null));
  }
  const again = $('study-again-btn');
  // Offered only when there is something left, so the button never promises a
  // continuation that does not exist.
  if (again) again.hidden = result.remaining === 0;
}

/**
 * The "just start" row above a catalogue.
 *
 * A catalogue asks the student to choose; this is for the student who does not
 * want to, and it is the first thing on the page for that reason.
 */
function startStudyRow(subjectCount) {
  const btn = el('button', {
    class: 'btn cta-btn learn-start-btn',
    text: 'התחל ללמוד לפי הסדר ←',
    attrs: { type: 'button' }
  });
  btn.dataset.action = 'start-study';
  return el('div', { class: 'learn-start' },
    btn,
    el('p', { class: 'learn-start-note',
      text: subjectCount > 1
        ? 'נלמד נושא אחרי נושא, מקצוע אחרי מקצוע — או בחר נושא מהרשימה.'
        : 'נלמד נושא אחרי נושא — או בחר נושא מהרשימה.' }));
}

export function renderCatalogFor(scope, progressMap) {
  const offered = subjectsForGrade(scope.grade);
  const picked = selectedSubjects(scope).filter(id => offered.includes(id));
  const chosen = picked.length ? picked : [scope.subjectId];

  if (chosen.length === 1) {
    renderCatalog(chosen[0], scope.grade, topicsFor(chosen[0], scope.grade, scope.track), progressMap);
    return;
  }

  const sub = $('learn-sub');
  if (sub) {
    sub.textContent = `${chosen.length} מקצועות · ${gradeName(scope.grade)} — בחר נושא ללמידה, ואחר כך תרגל אותו.`;
  }

  const grid = $('learn-grid');
  if (!grid) return;
  grid.replaceChildren();
  grid.appendChild(startStudyRow(chosen.length));

  const progress = progressMap instanceof Map ? progressMap : new Map();
  for (const id of chosen) {
    const topics = topicsFor(id, scope.grade, scope.track);
    if (topics.length === 0) continue;
    grid.appendChild(el('h3', { class: 'learn-subject-head', text: subjectName(id) }));
    const section = el('div', { class: 'learn-grid-section' });
    for (const card of catalogCards(id, scope.grade, topics, progress)) section.appendChild(card);
    grid.appendChild(section);
  }
}

// --- lesson sections ---------------------------------------------------
// Each card is a numbered section of a book chapter, not a screen of a wizard:
// a kicker naming what kind of section it is, a heading, then prose. The kicker
// is what lets a student skim a lesson and find "the worked example" or "the
// common mistake" without reading every card.

function sectionHead(index, kicker, title) {
  return el('header', { class: 'sec-head' },
    el('span', { class: 'sec-kicker' },
      el('span', { class: 'sec-num', text: String(index + 1) }),
      el('span', { text: kicker })),
    rich('h3', 'sec-title', title));
}

function conceptCard(card, state) {
  const node = el('article', { class: 'sec sec-concept' });
  node.appendChild(sectionHead(state.index, 'רעיון', card.title));
  node.appendChild(rich('p', 'sec-lead', card.lead));
  const visual = visualNode(card.visual);
  if (visual) node.appendChild(visual);
  for (const paragraph of card.body || []) node.appendChild(rich('p', 'sec-body', paragraph));
  // An aside is the margin note of a textbook: true, useful, but not on the
  // main line of the argument.
  if (card.aside) {
    node.appendChild(el('aside', { class: 'sec-aside' },
      el('span', { class: 'sec-aside-tag', text: 'שים לב' }),
      rich('div', 'sec-aside-body', card.aside)));
  }
  if (card.rule) {
    node.appendChild(el('div', { class: 'sec-rule' },
      el('span', { class: 'sec-rule-tag', text: 'הכלל' }),
      rich('div', 'sec-rule-body', card.rule)));
  }
  return node;
}

/** Builds one worked step. Shared by the full render and the live reveal, so
 *  a revealed step cannot be built differently from a re-rendered one. */
function stepItem(step, index, state) {
  const item = el('li', { class: 'step' });
  item.appendChild(rich('div', 'step-text', step.text));
  if (step.expr) item.appendChild(rich('div', 'step-expr', step.expr));
  // The newest step is the one the visual is highlighting; marking it lets the
  // stylesheet draw the eye there without the student hunting for it.
  if (index === state.revealed - 1) item.classList.add('step-current');
  return item;
}

function stepsCard(card, state) {
  const node = el('article', { class: 'sec sec-steps' });
  node.appendChild(sectionHead(state.index, 'נפתור יחד', card.title));
  node.appendChild(el('div', { class: 'sec-problem' },
    el('span', { class: 'sec-problem-tag', text: 'השאלה' }),
    rich('div', 'sec-problem-body', card.problem)));

  const visual = visualNode(
    card.visual ? { ...card.visual, highlight: activeHighlight(state) ?? card.visual.highlight } : null);
  if (visual) node.appendChild(visual);

  const list = el('ol', { class: 'step-list' });
  card.steps.slice(0, state.revealed).forEach((step, i) => list.appendChild(stepItem(step, i, state)));
  node.appendChild(list);

  if (stepsRemaining(state) > 0) {
    const more = el('button', {
      class: 'btn btn-secondary step-btn',
      text: state.revealed === 0 ? 'נתחיל בצעד הראשון' : `הצעד הבא · נותרו ${stepsRemaining(state)}`,
      attrs: { type: 'button' }
    });
    more.dataset.action = 'lesson-step';
    node.appendChild(more);
  }
  return node;
}

/**
 * A fully worked example, shown whole.
 *
 * Different from a steps card on purpose: steps are paced by the student one
 * reveal at a time, while an example is there to be read straight through and
 * come back to. A lesson wants both — one to build the method, one to show it
 * applied.
 */
function exampleCard(card, state) {
  const node = el('article', { class: 'sec sec-example' });
  node.appendChild(sectionHead(state.index, 'דוגמה', card.title));
  node.appendChild(el('div', { class: 'sec-problem' },
    el('span', { class: 'sec-problem-tag', text: 'השאלה' }),
    rich('div', 'sec-problem-body', card.problem)));

  const visual = visualNode(card.visual);
  if (visual) node.appendChild(visual);

  const list = el('ol', { class: 'solution-list' });
  for (const line of card.solution) list.appendChild(rich('li', 'solution-line', line));
  node.appendChild(list);

  node.appendChild(el('div', { class: 'sec-answer' },
    el('span', { class: 'sec-answer-tag', text: 'תשובה' }),
    rich('div', 'sec-answer-body', card.answer)));
  if (card.note) node.appendChild(rich('p', 'sec-note', card.note));
  return node;
}

function pitfallCard(card, state) {
  const node = el('article', { class: 'sec sec-pitfall' });
  node.appendChild(sectionHead(state.index, 'טעות נפוצה', card.title));
  node.appendChild(el('div', { class: 'pitfall-pair' },
    el('div', { class: 'pitfall-side wrong' },
      el('span', { class: 'pitfall-tag', text: '✗ לא נכון' }),
      rich('div', 'pitfall-body', card.wrong)),
    el('div', { class: 'pitfall-side right' },
      el('span', { class: 'pitfall-tag', text: '✓ נכון' }),
      rich('div', 'pitfall-body', card.right))));
  node.appendChild(rich('p', 'pitfall-why', card.why));
  return node;
}

function recapCard(card, state) {
  const node = el('article', { class: 'sec sec-recap' });
  node.appendChild(sectionHead(state.index, 'סיכום', 'מה למדנו'));
  const list = el('ul', { class: 'recap-list' });
  for (const bullet of card.bullets) list.appendChild(rich('li', 'recap-item', bullet));
  node.appendChild(list);
  return node;
}

/**
 * A checkpoint: one question closing a micro-topic.
 *
 * Framed as part of the lesson, not as a test. No score, no "check your
 * answer", no right/wrong marking — answering simply moves the lesson on, and
 * answering wrong moves it back to teach the idea again. The student is never
 * shown a verdict, so there is nothing here to render one with: the options are
 * plain buttons that dispatch and nothing more.
 */
function checkCard(card, state) {
  const node = el('article', { class: 'sec sec-check' });
  node.appendChild(sectionHead(state.index, 'רגע של בדיקה', 'נסה בעצמך'));
  node.appendChild(rich('p', 'check-question', card.question));

  const list = el('div', { class: 'check-options' });
  card.options.forEach((option, i) => {
    const btn = el('button', { class: 'check-option', attrs: { type: 'button' } });
    btn.innerHTML = sanitize(option);
    btn.dataset.action = 'answer-check';
    btn.dataset.choice = String(i);
    list.appendChild(btn);
  });
  node.appendChild(list);
  return node;
}

const CARD_RENDERERS = {
  concept: conceptCard,
  steps: stepsCard,
  example: exampleCard,
  pitfall: pitfallCard,
  recap: recapCard,
  check: checkCard
};

// --- lesson screen -----------------------------------------------------

/** Renders the whole lesson screen for a state. Safe to call repeatedly. */
// --- revealing a step in place ----------------------------------------

/**
 * What the lesson surface currently shows, so a step reveal can tell "one more
 * step on the card already on screen" apart from "a different card entirely".
 */
let painted = null;

function prefersReducedMotion() {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Grows an element from nothing to its natural height.
 *
 * Driven from the Web Animations API rather than a CSS keyframe because the
 * height is only knowable once the element is in the document, and a keyframe
 * would have to guess it — a max-height guess large enough for the longest step
 * makes every shorter one ease wrongly, snapping open and then crawling.
 *
 * WAAPI does not write a style attribute, so it is fine under `style-src 'self'`.
 */
const STEP_OPEN_MS = 320;

function growIn(item) {
  // The class holds overflow:hidden so the text cannot spill while the box is
  // shorter than its content. Dropped the moment the box is its own size again.
  const settle = () => item.classList.remove('step-opening');

  const height = item.getBoundingClientRect().height;
  if (prefersReducedMotion() || !item.animate || height === 0) { settle(); return; }

  const animation = item.animate(
    [
      { height: '0px', opacity: 0, transform: 'translateY(-6px)' },
      { height: `${height}px`, opacity: 1, transform: 'none' }
    ],
    { duration: STEP_OPEN_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });

  animation.addEventListener('finish', settle);
  animation.addEventListener('cancel', settle);

  // Safety net. A document that is not producing frames — a background tab, a
  // hidden pane — never advances the animation, so `finish` never fires and the
  // step would sit at its first keyframe, which is zero height: the step reads
  // as missing rather than as animating. Cancelling drops the effect and the
  // element snaps to its natural size, so the content is never lost.
  setTimeout(() => {
    if (animation.playState !== 'finished') animation.cancel();
    settle();
  }, STEP_OPEN_MS + 250);
}

/** Cross-fades the visual to its new highlight instead of cutting to it. */
function swapVisual(host, card, state) {
  if (!card.visual) return;
  const art = host.querySelector('.lesson-visual');
  const svg = renderDiagram({
    ...card.visual,
    highlight: activeHighlight(state) ?? card.visual.highlight
  });
  if (!art || !svg) return;
  art.innerHTML = svg; // trusted: numeric SVG from visuals.js, no student input
  if (!prefersReducedMotion()) {
    art.animate([{ opacity: 0.45 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
  }
}

/**
 * Adds the newly revealed steps to the card already on screen.
 *
 * Returns false if the DOM is not what it expects, so the caller falls back to
 * a full render rather than leaving a half-updated card.
 *
 * This exists because re-rendering the whole card for one more step is what the
 * student saw as a flicker: replaceChildren threw away everything they were
 * reading and the card-enter animation replayed from scratch, so the entire
 * lesson blinked to reveal one line.
 */
function revealSteps(card, state, from) {
  const host = $('lesson-card');
  const list = host && host.querySelector('.step-list');
  if (!list || list.children.length !== from) return false;

  for (const previous of list.querySelectorAll('.step-current')) {
    previous.classList.remove('step-current');
  }

  const opened = [];
  for (let i = from; i < state.revealed; i++) {
    const step = card.steps[i];
    if (!step) return false;
    const item = stepItem(step, i, state);
    item.classList.add('step-opening');
    list.appendChild(item);
    opened.push(item);
  }
  // Measured after every insertion, so a two-step jump does not size the first
  // one against a layout the second is about to change.
  for (const item of opened) growIn(item);

  swapVisual(host, card, state);

  const button = host.querySelector('.step-btn');
  if (button) {
    if (stepsRemaining(state) > 0) {
      button.textContent = `הצעד הבא · נותרו ${stepsRemaining(state)}`;
    } else {
      button.remove();
    }
  }

  // Keeps the newest step in view on a phone, where the card is taller than the
  // screen and the step can otherwise open below the fold.
  const last = opened[opened.length - 1];
  if (last && !prefersReducedMotion() && typeof last.scrollIntoView === 'function') {
    last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  return true;
}

export function renderLesson(state) {
  const lesson = state.lesson;
  const badge = $('lesson-subject-badge');
  if (badge) badge.textContent = `${subjectName(lesson.subject)} · ${gradeName(state.grade)}`;
  const title = $('lesson-title');
  if (title) title.textContent = lesson.title;

  // Revealing a step changes one thing on a card that is already correct, so it
  // updates in place. Everything else — a different card, a different lesson,
  // paging back — falls through to the full render below.
  const card0 = currentCard(state);
  const sameCard = painted
    && painted.lessonId === lesson.id
    && painted.index === state.index;
  if (sameCard && card0 && card0.kind === 'steps'
      && state.revealed > painted.revealed
      && revealSteps(card0, state, painted.revealed)) {
    painted = { lessonId: lesson.id, index: state.index, revealed: state.revealed };
    return;
  }

  const total = cardCount(state);
  const dots = $('lesson-dots');
  if (dots) {
    dots.replaceChildren();
    for (let i = 0; i < total; i++) {
      dots.appendChild(el('span', {
        class: `lesson-dot${i === state.index ? ' on' : ''}${i < state.index ? ' past' : ''}`,
        attrs: { 'aria-hidden': 'true' }
      }));
    }
    dots.setAttribute('aria-label', `חלק ${state.index + 1} מתוך ${total}`);
  }
  const counter = $('lesson-counter');
  if (counter) counter.textContent = `חלק ${state.index + 1} מתוך ${total}`;

  // The variant, not the raw card: a micro-topic being taught a second time is
  // shown in different words, which is the whole point of re-teaching it.
  const card = currentVariant(state);
  const host = $('lesson-card');
  if (host) {
    const build = CARD_RENDERERS[card.kind];
    host.replaceChildren(build ? build(card, state) : el('p', { text: '' }));
    // Restart the entry transition on every card change. Reading offsetWidth in
    // between is what forces the browser to notice the class was removed;
    // without it the two changes coalesce and nothing animates.
    host.classList.remove('card-enter');
    void host.offsetWidth;
    host.classList.add('card-enter');
  }

  const prev = $('lesson-prev');
  if (prev) prev.disabled = isFirstCard(state);
  const next = $('lesson-next');
  // A checkpoint is passed by answering it, not by paging past it — otherwise
  // the one card that measures anything is the one card a student can skip.
  if (next) next.hidden = isLastCard(state) || card.kind === 'check';
  const cta = $('lesson-quiz-btn');
  if (cta) {
    cta.hidden = !isLastCard(state);
    cta.textContent = `הבנתי — בוא נתרגל ${state.topic}`;
  }

  painted = { lessonId: lesson.id, index: state.index, revealed: state.revealed };
}

/**
 * Turns the lesson's footer into the session's on the last card.
 *
 * renderLesson HIDES the next button at the recap and hands the footer to the
 * "let's practise" CTA. That is right for a lesson opened on its own and wrong
 * inside a session, where the recap is exactly the moment to move on — with the
 * button hidden there was no way forward at all.
 *
 * The practise CTA stays: finishing a lesson and drilling it is still a
 * reasonable thing to want mid-session.
 */
export function showStudyAdvance(on, isLast) {
  const next = $('lesson-next');
  if (!next) return;
  next.classList.toggle('study-advance', Boolean(on && isLast));
  if (on && isLast) {
    next.hidden = false;
    next.textContent = 'לשיעור הבא ←';
  } else if (!on) {
    next.textContent = 'הבא ›';
  }
}

/**
 * Forgets what is on screen. Called when the lesson surface is torn down, so a
 * later lesson cannot match a stale record and try to append to a card that is
 * no longer in the document.
 */
export function resetLessonPaint() {
  painted = null;
}
