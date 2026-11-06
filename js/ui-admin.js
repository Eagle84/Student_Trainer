/**
 * The admin console's screens. Rendering only — no network, no state of its
 * own, same rule as ui.js: app.js fetches, this draws what it is handed.
 *
 * The console is one wizard and three lists. The wizard is the important part:
 * it walks a subject from "I want one" to "students can see it" through seven
 * steps, and every step that changes what a student will be shown has a gate
 * you have to press through. Nothing here advances on its own.
 *
 * The preview at step 6 is built from the SAME CSS classes the quiz screen
 * uses — .question-text, .options-list, .option-item — rather than a private
 * set that merely resembles them. A preview that drifts from the real renderer
 * is worse than none: it tells you a question is fine when it is not. It is not
 * pixel-identical (the quiz screen is a full-width screen and this is a card),
 * but every rule that decides how a question READS — direction, option order,
 * the maths isolates — is the same rule.
 */
import { $, el } from './dom.js';
import { subjectName, gradeName } from './ui.js';
import { sanitize } from './sanitize.js';
import { getSubject, NO_GRADE } from './subjects/index.js';
import { CATALOG_GROUPS } from './subject-catalog.js';
import { STEPS as PIPELINE_STEPS, STEP_LABELS } from './admin.js';
import { EXAMPLE_LINE } from './question-parse.js';

/** The wizard's steps, in the order they are walked. */
export const WIZARD_STEPS = [
  { id: 'subject', name: 'הגדרת מקצוע', hint: 'שם, כיתות וכיוון כתיבה' },
  { id: 'preview', name: 'תצוגה מקדימה', hint: 'איך המקצוע ייראה לתלמיד' },
  { id: 'search',  name: 'חיפוש מקורות', hint: 'מה נמצא ברשת' },
  { id: 'sources', name: 'בדיקת תוכן',   hint: 'לקרוא ולאשר כל קובץ' },
  { id: 'extract', name: 'חילוץ שאלות',  hint: 'הפיכת הקובץ לשאלות' },
  { id: 'review',  name: 'איך זה ייראה', hint: 'כל שאלה כפי שתוצג' },
  { id: 'publish', name: 'פרסום',        hint: 'העברה לתלמידים' }
];

const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const DIR_LABELS = {
  rtl:  'ימין לשמאל — טקסט בעברית',
  ltr:  'שמאל לימין — נוסחאות, קוד או אנגלית',
  auto: 'אוטומטי — נקבע לפי התו הראשון בכל פריט'
};

// --- small building blocks --------------------------------------------

function field(labelText, control, hint) {
  return el('div', { class: 'form-group' },
    el('label', { class: 'form-label', text: labelText }),
    control,
    hint ? el('small', { class: 'form-hint', text: hint }) : null);
}

function select(id, options, value, action) {
  const node = el('select', { class: 'form-control', attrs: { id } });
  if (action) node.dataset.action = action;
  for (const opt of options) {
    const o = el('option', { text: opt.label, attrs: { value: String(opt.value) } });
    if (String(opt.value) === String(value)) o.selected = true;
    node.appendChild(o);
  }
  return node;
}

function input(id, value, placeholder, action) {
  const node = el('input', {
    class: 'form-control',
    attrs: { id, type: 'text', value: value == null ? '' : String(value) }
  });
  if (placeholder) node.setAttribute('placeholder', placeholder);
  if (action) node.dataset.action = action;
  return node;
}

function button(label, action, { variant = '', data = {}, disabled = false } = {}) {
  const node = el('button', {
    class: `btn ${variant}`.trim(),
    text: label,
    attrs: { type: 'button' }
  });
  node.dataset.action = action;
  for (const [k, v] of Object.entries(data)) node.dataset[k] = String(v);
  node.disabled = disabled;
  return node;
}

/** A coloured status word — reused for subjects, sources, drafts and jobs. */
function pill(text, tone) {
  return el('span', { class: `admin-pill admin-pill-${tone}`, text });
}

const STATUS_PILLS = {
  draft:     ['טיוטה', 'wait'],
  published: ['מפורסם', 'ok'],
  archived:  ['בארכיון', 'muted'],
  pending:   ['ממתין לאישור', 'wait'],
  approved:  ['מאושר', 'ok'],
  rejected:  ['נדחה', 'bad'],
  fetched:   ['הורד', 'ok'],
  extracted: ['חולצו שאלות', 'ok'],
  failed:    ['נכשל', 'bad'],
  clean:     ['נקי', 'ok'],
  suspicious:['חשוד', 'warn'],
  malicious: ['זדוני', 'bad'],
  not_scanned: ['לא נסרק', 'muted'],
  queued:    ['בתור', 'wait'],
  running:   ['פועל', 'wait'],
  waiting:   ['ממתין לך', 'warn'],
  done:      ['הושלם', 'ok'],
  cancelled: ['בוטל', 'muted']
};

function statusPill(status) {
  const [text, tone] = STATUS_PILLS[status] || [status || '—', 'muted'];
  return pill(text, tone);
}

function bytesLabel(bytes) {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// --- the shell ---------------------------------------------------------

/**
 * Draws the console's tab bar and marks the open one.
 *
 * The badge on "אישור שאלות" is the reason the count is fetched at boot: a
 * review queue you have to remember to open is a review queue that fills up.
 */
export function renderAdminTabs(active, pendingCount, role = 'admin') {
  const host = $('admin-tabs');
  if (!host) return;
  const tabs = [
    ['subjects', 'מקצועות'],
    ['ingest',   'משיכת תוכן'],
    ['review',   'אישור שאלות'],
    // Editors do the content work and nothing else. Hiding the tab matches
    // what the policies in sql/admin-users.sql already enforce — an editor who
    // reached it anyway would get an empty list and a refused write.
    ...(role === 'admin' ? [['people', 'אנשים']] : []),
    ['settings', 'הגדרות']
  ];
  host.replaceChildren(...tabs.map(([id, label]) => {
    const b = el('button', {
      class: `admin-tab${id === active ? ' active' : ''}`,
      attrs: { type: 'button', 'aria-current': id === active ? 'page' : 'false' }
    }, el('span', { text: label }));
    b.dataset.action = 'admin-tab';
    b.dataset.tab = id;
    if (id === 'review' && pendingCount > 0) {
      b.appendChild(el('span', { class: 'admin-badge', text: String(pendingCount) }));
    }
    return b;
  }));
}

/** Why a source can no longer be approved or rejected. */
const SETTLED_NOTE = {
  fetched: 'הורד ונסרק — אין מה לאשר',
  extracted: 'כבר חולצו ממנו שאלות',
  failed: 'ההורדה נכשלה'
};

/** The Hebrew name of one wizard step, for the resume banner. */
function stepNameOf(id) {
  const step = WIZARD_STEPS.find(s => s.id === id);
  return step ? step.name : id;
}

/** Replaces the console body with one tab's content. */
function setBody(...nodes) {
  const host = $('admin-body');
  if (host) host.replaceChildren(...nodes.filter(Boolean));
}

/** A one-line message above the console body. Empty string clears it. */
export function adminMessage(text, tone = 'info') {
  const box = $('admin-message');
  if (!box) return;
  box.textContent = text || '';
  box.className = `admin-message admin-message-${tone}`;
  box.hidden = !text;
}

// --- tab: subjects -----------------------------------------------------

/** Just the letter: gradeName() already says "כיתה", and a list must not repeat it. */
function gradeLetter(grade) {
  return gradeName(grade).replace(/^כיתה\s+/, '');
}

/** "כיתות ג'-ט'", or the single grade, or the gradeless note. */
function gradeRangeLabel(grades, gradeless) {
  if (gradeless) return 'ללא כיתה';
  if (!grades || !grades.length) return 'לא נבחרה כיתה';
  const sorted = [...grades].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === last) return gradeName(first);
  // A range only when it IS one. "כיתות ג'-ט'" over a subject taught in ג' and
  // ט' only would be a lie, and the lie is invisible.
  const contiguous = sorted.every((g, i) => g === first + i);
  if (contiguous) return `כיתות ${gradeLetter(first)}-${gradeLetter(last)}`;
  return `כיתות ${sorted.map(g => gradeLetter(g)).join(', ')}`;
}

/**
 * Everything the console knows about, in three groups.
 *
 * The groups answer three different questions and are genuinely different
 * things, which is why they are not one list with a badge:
 *
 *   created  — rows in the database. Editable, publishable, deletable.
 *   builtIn  — subjects written as code in js/subjects/. Their name, grades
 *              and direction live in a file, not a table, so nothing here can
 *              change them — but their question BANK is shared with everything
 *              else, so adding questions to מתמטיקה works exactly as it does
 *              for a subject created here.
 *   catalog  — subjects the scraper knows how to search for and that have no
 *              row yet. This is the "not existing" list: it exists so adding
 *              אזרחות is one press rather than a guess at what to call it, and
 *              so the id matches the one the worker will search by.
 */
export function renderSubjectsTab({ created, builtIn, catalog, counts }) {
  setBody(
    el('div', { class: 'admin-head' },
      el('div', {},
        el('h3', { text: 'מקצועות' }),
        el('p', { class: 'admin-sub', text: 'מה שיש, מה שמובנה בקוד, ומה שאפשר להוסיף.' })),
      button('מקצוע חדש', 'admin-new-subject', { variant: 'cta-btn' })),

    createdSection(created, counts),
    builtInSection(builtIn, counts),
    catalogSection(catalog));
}

function createdSection(created, counts) {
  const rows = created.map(s => {
    const total = counts.get(s.id) || 0;
    const meta = [
      gradeRangeLabel(s.grades, s.gradeless),
      total ? `${total} שאלות בבנק` : 'אין עדיין שאלות'
    ].join(' · ');

    return el('li', { class: 'admin-row' },
      el('div', { class: 'admin-row-main' },
        el('div', { class: 'admin-row-title' },
          el('span', { text: s.name }),
          statusPill(s.status),
          el('code', { class: 'subject-id', text: s.id })),
        el('small', { class: 'admin-row-meta', text: meta }),
        s.blurb ? el('small', { class: 'admin-row-meta', text: s.blurb }) : null),
      el('div', { class: 'admin-row-actions' },
        button('פתח', 'admin-open-subject', { variant: 'cta-btn', data: { subject: s.id } }),
        s.status === 'published'
          ? button('הסתר', 'admin-archive-subject', { variant: 'btn-quiet', data: { subject: s.id } })
          : button('פרסם', 'admin-publish-subject', { variant: 'btn-quiet', data: { subject: s.id } }),
        button('מחק', 'admin-delete-subject', { variant: 'btn-danger', data: { subject: s.id } })));
  });

  return el('section', { class: 'admin-section' },
    el('h4', { class: 'admin-section-head', text: `מקצועות שנוצרו כאן (${created.length})` }),
    rows.length
      ? el('ul', { class: 'admin-list' }, ...rows)
      : el('p', { class: 'admin-empty', text: 'עדיין אין מקצוע שנוצר כאן. בחר אחד מהרשימה למטה, או לחץ "מקצוע חדש".' }));
}

function builtInSection(builtIn, counts) {
  if (!builtIn.length) return null;

  const cards = builtIn.map(s => {
    const total = counts.get(s.id) || 0;
    const card = el('button', { class: 'subject-card', attrs: { type: 'button' } },
      el('span', { class: 'subject-card-name', text: s.name }),
      el('small', { class: 'subject-card-meta', text: gradeRangeLabel(s.grades, s.gradeless) }),
      el('small', { class: 'subject-card-meta', text: total ? `${total} שאלות בבנק` : 'שאלות נוצרות בקוד' }));
    card.dataset.action = 'admin-open-subject';
    card.dataset.subject = s.id;
    return el('li', {}, card);
  });

  return el('section', { class: 'admin-section' },
    el('h4', { class: 'admin-section-head', text: `מובנים בקוד (${builtIn.length})` }),
    el('p', { class: 'admin-sub', text: 'השם, הכיתות וכיוון הכתיבה שלהם מוגדרים בקוד ואי אפשר לשנות אותם כאן — אבל אפשר להוסיף להם שאלות ולמשוך להם תוכן.' }),
    el('ul', { class: 'subject-grid' }, ...cards));
}

function catalogSection(catalog) {
  const box = input('subject-filter', '', 'סנן לפי שם…');
  box.setAttribute('autocomplete', 'off');

  const byGroup = new Map();
  for (const entry of catalog) {
    if (!byGroup.has(entry.group)) byGroup.set(entry.group, []);
    byGroup.get(entry.group).push(entry);
  }

  const groups = [...byGroup].map(([group, entries]) =>
    el('div', { class: 'catalog-group' },
      el('h5', { class: 'catalog-group-head', text: CATALOG_GROUPS[group] || group }),
      el('ul', { class: 'subject-grid' }, ...entries.map(entry => {
        const card = el('button', { class: 'subject-card subject-card-add', attrs: { type: 'button' } },
          el('span', { class: 'subject-card-name', text: entry.name }),
          el('small', { class: 'subject-card-meta', text: gradeRangeLabel(gradeSpan(entry), false) }),
          el('span', { class: 'subject-card-add-mark', text: '+' }));
        card.dataset.action = 'admin-create-from-catalog';
        card.dataset.subject = entry.id;
        return el('li', {}, card);
      }))));

  const nothing = el('p', { class: 'admin-empty', text: 'אין מקצוע שמתאים לסינון.' });
  nothing.hidden = true;

  // Filtered here rather than by re-rendering through the controller: the list
  // is sixty-three fixed rows that no round trip can change, and a redraw on
  // every keystroke loses the caret and costs a query per subject. The only
  // listener in this file, for the only thing on screen that is a view detail
  // and not a decision.
  box.addEventListener('input', () => {
    const needle = box.value.trim();
    let shown = 0;
    for (const group of groups) {
      let visible = 0;
      for (const item of group.querySelectorAll('li')) {
        const match = !needle || item.textContent.includes(needle);
        item.hidden = !match;
        if (match) visible++;
      }
      group.hidden = visible === 0;
      shown += visible;
    }
    nothing.hidden = shown > 0;
  });

  return el('section', { class: 'admin-section' },
    el('h4', { class: 'admin-section-head', text: `מקצועות שאפשר להוסיף (${catalog.length})` }),
    el('p', { class: 'admin-sub', text: 'אלה המקצועות שתוכנת המשיכה יודעת לחפש. לחיצה יוצרת את המקצוע כטיוטה עם השם והכיתות המקובלים, ופותחת אותו לעריכה.' }),
    catalog.length ? el('div', { class: 'catalog-filter' }, box) : null,
    ...groups,
    nothing,
    catalog.length
      ? null
      : el('p', { class: 'admin-empty', text: 'כל המקצועות המוכרים כבר קיימים.' }));
}

/** The grades a catalogue entry covers, so the range label can be shared. */
function gradeSpan(entry) {
  const span = [];
  for (let g = Math.max(1, entry.from); g <= Math.min(12, entry.to); g++) span.push(g);
  return span;
}

// --- the subject workbench --------------------------------------------

/**
 * One subject, and everything you can do to it, on one screen.
 *
 * "ערוך" used to drop into step 1 of the creation wizard, which is a form for
 * inventing a subject rather than for working on one that exists: to add a
 * question you had to walk forward through a preview and a search you did not
 * want. The two jobs are different and now have different screens — the wizard
 * creates, this one maintains.
 *
 * A built-in subject gets the same screen with the details section read-only.
 * Its name and grades come from a file, but its question bank does not, and
 * "add ten questions to מתמטיקה כיתה ז׳" is the same task either way.
 */
export function renderSubjectWorkbench(ctx) {
  const { subject, builtIn, counts, pendingDrafts, sample } = ctx;
  const grades = subject.gradeless ? [NO_GRADE] : [...(subject.grades || [])].sort((a, b) => a - b);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  setBody(
    el('div', { class: 'admin-head' },
      el('div', {},
        el('div', { class: 'admin-row-title' },
          el('h3', { text: subject.name || 'ללא שם' }),
          builtIn ? pill('מובנה בקוד', 'muted') : statusPill(subject.status),
          el('code', { class: 'subject-id', text: subject.id })),
        el('p', { class: 'admin-sub', text: `${gradeRangeLabel(subject.grades, subject.gradeless)} · ${total} שאלות בבנק` })),
      button('→ לרשימת המקצועות', 'admin-subject-close', { variant: 'btn-quiet' })),

    builtIn ? builtInDetails(subject) : editableDetails(subject, sample),

    el('section', { class: 'admin-section' },
      el('h4', { class: 'admin-section-head', text: 'תוכן' }),
      el('p', { class: 'admin-sub', text: 'כמה שאלות יש בכל כיתה, ומאיפה להביא עוד. "הוסף שאלות" כותב ישירות לבנק; "משוך תוכן" מפעיל את החיפוש עם אישור לכל שלב.' }),
      el('ul', { class: 'admin-list' }, ...grades.map(g => contentRow(subject, g, counts.get(Number(g)) || 0)))),

    pendingDrafts > 0
      ? el('p', { class: 'admin-note' },
        el('span', { text: `${pendingDrafts} שאלות של המקצוע הזה ממתינות לאישור. ` }),
        button('פתח את האישורים', 'admin-open-review', { variant: 'btn-quiet' }))
      : null,

    builtIn ? null : publishSection(subject, total),
    builtIn ? null : dangerSection(subject));
}

function contentRow(subject, grade, count) {
  return el('li', { class: 'admin-row' },
    el('div', { class: 'admin-row-main' },
      el('div', { class: 'admin-row-title' },
        el('span', { text: subject.gradeless ? 'ללא כיתה' : gradeName(grade) })),
      el('small', { class: 'admin-row-meta', text: count ? `${count} שאלות בבנק` : 'אין עדיין שאלות' })),
    el('div', { class: 'admin-row-actions' },
      button('הוסף שאלות', 'admin-add-questions',
        { variant: 'btn-quiet', data: { subject: subject.id, grade: String(grade) } }),
      button('משוך תוכן', 'admin-ingest-subject',
        { variant: 'btn-quiet', data: { subject: subject.id, grade: String(grade) } })));
}

function editableDetails(subject, sample) {
  return el('section', { class: 'admin-section' },
    el('h4', { class: 'admin-section-head', text: 'פרטי המקצוע' }),
    subjectFields(subject, { isEdit: true }),
    // The same preview the creation wizard shows at step 2, kept on screen
    // rather than behind a button. The two direction settings are the only
    // fields whose effect you cannot predict by reading them — an RTL option
    // list moves a minus sign to the wrong side of a number — and a preview
    // you have to go and ask for is one nobody looks at before saving.
    el('div', { class: 'preview-grid preview-grid-tight' },
      el('section', { class: 'preview-pane' },
        el('h4', { text: 'במסך הבית' }),
        el('div', { class: 'subject-tile selected preview-tile' },
          el('span', { class: 'tile-name', text: subject.name || 'ללא שם' }),
          subject.blurb ? el('small', { class: 'tile-blurb', text: subject.blurb }) : null)),
      el('section', { class: 'preview-pane preview-pane-wide' },
        el('h4', { text: 'במבחן' }),
        questionPreview(sample, subject))),
    el('p', { class: 'admin-note', text: 'התצוגה מתעדכנת אחרי שמירה, ומיד עם שינוי כיוון הכתיבה.' }),
    el('div', { class: 'wizard-actions' },
      button('שמור שינויים', 'admin-save-subject', { variant: 'cta-btn' })));
}

function builtInDetails(subject) {
  const line = (label, value) => el('li', {},
    el('span', { class: 'kv-label', text: label }),
    el('span', { class: 'kv-value', text: value }));

  return el('section', { class: 'admin-section' },
    el('h4', { class: 'admin-section-head', text: 'פרטי המקצוע' }),
    el('ul', { class: 'admin-kv' },
      line('שם', subject.name),
      line('מזהה', subject.id),
      line('כיתות', gradeRangeLabel(subject.grades, subject.gradeless)),
      line('כיוון השאלה', DIR_LABELS[subject.dir] || subject.dir),
      line('כיוון התשובות', DIR_LABELS[subject.optionsDir] || subject.optionsDir)),
    el('p', { class: 'admin-note', text: 'המקצוע הזה מוגדר ב-js/subjects/ ויוצר שאלות בעצמו. כדי לשנות שם או כיתות צריך לערוך את הקוד.' }));
}

function publishSection(subject, total) {
  const published = subject.status === 'published';
  return el('section', { class: 'admin-section' },
    el('h4', { class: 'admin-section-head', text: 'פרסום' }),
    el('p', { class: 'admin-sub', text: published
      ? 'המקצוע גלוי לתלמידים שלומדים בכיתות שנבחרו.'
      : 'המקצוע עדיין לא גלוי לאף תלמיד.' }),
    el('div', { class: 'wizard-actions' },
      published
        ? button('הסתר מהתלמידים', 'admin-archive-subject', { variant: 'btn-quiet', data: { subject: subject.id } })
        : button('פרסם לתלמידים', 'admin-publish-subject', { variant: 'cta-btn', data: { subject: subject.id } })),
    !published && total === 0
      ? el('p', { class: 'admin-note', text: 'אין עדיין שאלות — אם תפרסם עכשיו, האריח ייפתח לריק.' })
      : null);
}

function dangerSection(subject) {
  return el('section', { class: 'admin-section admin-danger' },
    el('h4', { class: 'admin-section-head', text: 'מחיקה' }),
    el('p', { class: 'admin-sub', text: 'מחיקה מסירה את המקצוע ואת השאלות שלו לתמיד. אם תלמידים כבר למדו בו, המחיקה תיחסם ותוצע לך הסתרה במקום.' }),
    el('div', { class: 'wizard-actions' },
      button('מחק את המקצוע', 'admin-delete-subject', { variant: 'btn-danger', data: { subject: subject.id } })));
}

// --- the wizard --------------------------------------------------------

/**
 * The step rail.
 *
 * Steps behind the current one are marked done and are clickable — going back
 * to re-read a source you already approved must always be possible. Steps ahead
 * are not: they depend on work that has not happened yet, and a rail that lets
 * you jump to "פרסום" before anything was extracted is a rail that lies.
 */
function stepRail(currentId, from = 0) {
  // A built-in subject has no step 1 and no step 2: its name, grades and
  // direction are written in js/subjects/ and nothing here can change them.
  // Dropping those steps rather than drawing them greyed out is what keeps the
  // count honest — "שלב 1 מתוך 5" is true for that run, and a rail with two
  // permanently unreachable circles at the head is not.
  const steps = WIZARD_STEPS.slice(from);
  const index = Math.max(0, steps.findIndex(s => s.id === currentId));
  const current = steps[index];
  // The fill stops at the CURRENT step's circle rather than past it: the step
  // you are on is not finished, and a bar drawn through it says it is.
  const pct = steps.length < 2
    ? 0
    : (index / (steps.length - 1)) * 100;

  const rail = el('ol', { class: 'wizard-rail' }, ...steps.map((step, i) => {
    const state = i < index ? 'done' : i === index ? 'current' : 'ahead';
    const node = el('li', {
      class: `wizard-step wizard-step-${state}`,
      attrs: { title: step.name }
    },
      el('span', { class: 'wizard-step-dot', text: state === 'done' ? '✓' : String(i + 1) }),
      el('span', { class: 'wizard-step-name', text: step.name }));

    if (state === 'done') {
      node.dataset.action = 'admin-wizard-step';
      node.dataset.step = step.id;
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
    }
    if (state === 'current') node.setAttribute('aria-current', 'step');
    return node;
  }));

  const track = el('div', { class: 'wizard-track' }, el('span', { class: 'wizard-track-fill' }));
  track.querySelector('.wizard-track-fill').style.width = `${pct}%`;

  // Where you are, in words and in a number, above the rail — because on a
  // narrow screen the rail wraps and reading your position off it stops being
  // possible at exactly the width where most people are looking.
  return el('div', { class: 'wizard-progress' },
    el('div', { class: 'wizard-progress-head' },
      el('span', { class: 'wizard-progress-count', text: `שלב ${index + 1} מתוך ${steps.length}` }),
      el('span', { class: 'wizard-progress-name', text: current.name }),
      el('span', { class: 'wizard-progress-hint', text: current.hint })),
    track,
    rail);
}

function wizardFrame(stepId, { from = 0 } = {}, ...content) {
  setBody(
    stepRail(stepId, from),
    el('div', { class: 'wizard-body' }, ...content.filter(Boolean)),
    // At the foot rather than the head: leaving is the least likely thing you
    // came here to do, and a button at the top of a form is a button people
    // press by accident.
    el('div', { class: 'wizard-exit' }, button('צא מהאשף', 'admin-wizard-exit', { variant: 'btn-quiet' })));
}

/** Step 1 — what the subject IS. */
export function renderWizardSubject(draft, { isEdit = false } = {}, view = {}) {
  wizardFrame('subject', view,
    subjectFields(draft, { isEdit }),
    el('div', { class: 'wizard-actions' },
      button('המשך לתצוגה מקדימה ←', 'admin-wizard-next', { variant: 'cta-btn' })));
}

/**
 * The fields that define a subject, shared by the wizard and the workbench.
 *
 * One block rather than two that look alike: these are the columns of one
 * table, and a copy that drifts is a form where changing the direction works
 * when you create a subject and silently does nothing when you edit one.
 */
function subjectFields(draft, { isEdit = false } = {}) {
  const gradeBoxes = el('div', { class: 'grade-checks' }, ...GRADE_OPTIONS.map(g => {
    const box = el('label', { class: 'grade-check' });
    const cb = el('input', { attrs: { type: 'checkbox', value: String(g) } });
    cb.checked = draft.grades.includes(g);
    cb.dataset.action = 'admin-toggle-grade';
    box.append(cb, el('span', { text: gradeName(g) }));
    return box;
  }));

  const gradeless = el('label', { class: 'admin-check' });
  const glBox = el('input', { attrs: { type: 'checkbox' } });
  glBox.checked = Boolean(draft.gradeless);
  glBox.dataset.action = 'admin-toggle-gradeless';
  gradeless.append(glBox, el('span', { text: 'מקצוע שאינו נלמד לפי כיתה (כמו פסיכומטרי)' }));

  const fields = el('div', { class: 'wizard-grid' },
    el('div', {},
        field('שם המקצוע', input('subject-name', draft.name, 'לדוגמה: אזרחות'),
          'השם שהתלמיד רואה על האריח.'),
        field('מזהה', input('subject-id', draft.id, 'civics'),
          isEdit
            ? 'המזהה נקבע ביצירה ואי אפשר לשנותו — שאלות שכבר נשמרו מפנות אליו.'
            : 'אותיות אנגליות קטנות בלבד. נשמר בבסיס הנתונים ולא ניתן לשינוי אחר כך.'),
        field('משפט הסבר', input('subject-blurb', draft.blurb, 'מה לומדים כאן'),
          'מופיע מתחת לשם. אפשר להשאיר ריק.')),
      el('div', {},
        field('כיוון הטקסט של השאלה',
          select('subject-dir', Object.entries(DIR_LABELS).map(([v, label]) => ({ value: v, label })),
            draft.dir, 'admin-field')),
        field('כיוון רשימת התשובות',
          select('subject-options-dir', Object.entries(DIR_LABELS).map(([v, label]) => ({ value: v, label })),
            draft.optionsDir, 'admin-field'),
          'נוסחאות ומספרים חייבים להיות "שמאל לימין", אחרת סימן המינוס יקפוץ למקום הלא נכון.'),
        el('div', { class: 'form-group' },
          el('label', { class: 'form-label', text: 'כיתות' }),
          gradeless,
          draft.gradeless ? null : gradeBoxes)));

  if (isEdit) {
    // Disabled here rather than after the render, so the workbench — which
    // does not go through wizardFrame — gets it too. The id is the primary
    // key every saved question already points at.
    const idField = fields.querySelector('#subject-id');
    if (idField) idField.disabled = true;
  }
  return fields;
}

/**
 * Step 2 — the subject as the student will meet it.
 *
 * Three surfaces, because a subject is met on three: the tile on the home
 * screen, the row in the drawer, and the heading over a quiz. Showing only the
 * tile hides the mistake that actually bites — a 40-character name that fits a
 * tile and overflows a drawer row.
 */
export function renderWizardPreview(draft, sampleQuestion, view = {}) {
  const tile = el('div', { class: 'subject-tile selected preview-tile' },
    el('span', { class: 'tile-name', text: draft.name || 'ללא שם' }),
    draft.blurb ? el('small', { class: 'tile-blurb', text: draft.blurb }) : null);

  const drawerRow = el('ul', { class: 'drawer-list preview-drawer' },
    el('li', {},
      el('span', { class: 'drawer-subhead', text: draft.name || 'ללא שם' })),
    el('li', {},
      el('span', { class: 'drawer-item' },
        el('span', { class: 'drawer-item-label', text: 'נושא לדוגמה' }),
        el('span', { class: 'drawer-time', text: '5 שאלות' }))));

  const grades = draft.gradeless
    ? 'זמין בכל הכיתות, מתוך הכרטיס "מקצועות נוספים"'
    : draft.grades.length
      ? `יופיע לתלמידי ${draft.grades.map(g => gradeName(g)).join(', ')}`
      : 'לא נבחרה אף כיתה — המקצוע לא יופיע לאף תלמיד';

  wizardFrame('preview', view,
    el('p', { class: 'admin-sub', text: grades }),
    el('div', { class: 'preview-grid' },
      el('section', { class: 'preview-pane' },
        el('h4', { text: 'במסך הבית' }), tile),
      el('section', { class: 'preview-pane' },
        el('h4', { text: 'בתפריט הצד' }), drawerRow),
      el('section', { class: 'preview-pane preview-pane-wide' },
        el('h4', { text: 'במבחן' }),
        questionPreview(sampleQuestion, draft))),
    el('p', { class: 'admin-note', text: 'השאלה כאן היא דוגמה בלבד, כדי להראות את כיוון הכתיבה שבחרת. שאלות אמיתיות ייכנסו בשלבים הבאים.' }),
    el('div', { class: 'wizard-actions' },
      button('→ חזור', 'admin-wizard-back', { variant: 'btn-quiet' }),
      button('שמור מקצוע והמשך ←', 'admin-wizard-next', { variant: 'cta-btn' })));
}

/** Step 3 — queue the scrape. */
export function renderWizardSearch(draft, modes, job, workerActivity = null, view = {}) {
  const gradeChoices = (draft.gradeless ? [NO_GRADE] : draft.grades)
    .map(g => ({ value: g, label: draft.gradeless ? 'ללא כיתה' : gradeName(g) }));
  // The grade the run was launched for, when it was launched from a grade's
  // own row in the workbench. Landing on the subject's first grade instead
  // means the admin picks it again, and a missed pick scrapes the wrong year.
  const wanted = gradeChoices.some(c => Number(c.value) === Number(view.grade))
    ? Number(view.grade)
    : (gradeChoices[0] ? gradeChoices[0].value : NO_GRADE);

  if (job && job.stage !== 'queued') {
    wizardFrame('search', view,
      jobStatusCard(job, workerActivity),
      el('div', { class: 'wizard-actions' },
        button('→ חזור', 'admin-wizard-back'),
        button('המשך לבדיקת התוכן ←', 'admin-wizard-next', { variant: 'cta-btn' })));
    return;
  }

  wizardFrame('search', view,
    el('p', { class: 'admin-sub', text: 'החיפוש רץ על המחשב שבבית — הוא מושך את הקבצים, סורק אותם בווירוס־טוטאל, ומעלה לכאן רק את מה שמותר לך לראות. אם התוכנה לא פועלת, העבודה פשוט תחכה בתור.' }),
    el('div', { class: 'wizard-grid' },
      el('div', {},
        field('כיתה', select('ingest-grade',
          gradeChoices.length ? gradeChoices : [{ value: NO_GRADE, label: 'ללא כיתה' }],
          wanted)),
        field('מילות חיפוש', input('ingest-query', '', `${draft.name} מבחנים`),
          'אפשר להשאיר ריק — אז יחפש לפי שם המקצוע והכיתה.'),
        field('כמה מקורות לכל היותר', select('ingest-max',
          [3, 5, 10, 20].map(n => ({ value: n, label: String(n) })), 5))),
      el('div', {},
        el('h4', { text: 'מה ירוץ לבד ומה יחכה לך' }),
        modeToggles(modes),
        el('p', { class: 'admin-note', text: 'שלב שמסומן "ידני" עוצר ומחכה לאישור שלך. שלב שמסומן "אוטומטי" ממשיך הלאה בלי לשאול.' }))),
    el('div', { class: 'wizard-actions' },
      button('→ חזור', 'admin-wizard-back', { variant: 'btn-quiet' }),
      button('התחל חיפוש ←', 'admin-start-ingest', { variant: 'cta-btn' })));
}

/** The five auto/manual switches, used by the wizard and the settings tab. */
export function modeToggles(modes, idPrefix = 'mode') {
  return el('ul', { class: 'mode-list' }, ...PIPELINE_STEPS.map(step => {
    const label = STEP_LABELS[step];
    const isAuto = modes[step] === 'auto';
    const toggle = el('button', {
      class: `mode-switch${isAuto ? ' mode-auto' : ''}`,
      text: isAuto ? 'אוטומטי' : 'ידני',
      attrs: {
        type: 'button',
        id: `${idPrefix}-${step}`,
        role: 'switch',
        'aria-checked': isAuto ? 'true' : 'false',
        'aria-label': `${label.name} — ${isAuto ? 'אוטומטי' : 'ידני'}`
      }
    });
    toggle.dataset.action = 'admin-toggle-mode';
    toggle.dataset.step = step;

    return el('li', { class: 'mode-item' },
      el('div', { class: 'mode-text' },
        el('span', { class: 'mode-name', text: label.name }),
        el('small', { class: 'mode-hint', text: label.hint })),
      toggle);
  }));
}

/** What a running job is doing, in words rather than stage names. */
/**
 * The pipeline a job walks, in order, with what each stage is doing while it
 * is the current one.
 *
 * Present tense on purpose: this is read while it is happening, and "מוריד
 * קבצים" answers "what is it doing right now" in a way that "הורדה" does not.
 */
const JOB_STAGES = [
  { id: 'queued',  name: 'בתור',           doing: 'ממתין שתוכנת הסריקה תיקח את העבודה' },
  { id: 'search',  name: 'מחפש מקורות',    doing: 'סורק את אתרי הלימוד' },
  { id: 'fetch',   name: 'מוריד קבצים',    doing: 'מוריד את הקבצים שאושרו להסגר' },
  { id: 'scan',    name: 'סורק וירוסים',   doing: 'ממתין לתשובה מווירוס־טוטאל' },
  { id: 'extract', name: 'מחלץ שאלות',     doing: 'קורא את הקבצים והופך אותם לשאלות' },
  { id: 'review',  name: 'ממתין לבדיקה',   doing: 'השאלות מוכנות ומחכות לך' },
  { id: 'done',    name: 'הושלם',          doing: 'הכל נגמר' }
];

/** How long ago, in words. Minutes are the useful unit for a scrape. */
function agoLabel(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `לפני ${seconds} שניות`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  return `לפני ${hours} שעות`;
}

/** Seconds since a timestamp, for the "nobody has taken this" threshold. */
function secondsSince(iso) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}

/**
 * How long an unclaimed job is allowed to look normal.
 *
 * The worker polls every fifteen seconds by default, so anything under about
 * that is simply the gap between ticks and saying so would be noise. Past it,
 * silence means something is actually wrong — and "is the program at home
 * running?" is a question only the person reading this can answer.
 */
const CLAIM_PATIENCE_SECONDS = 45;

/**
 * A job's progress, as a bar with the running step named above it.
 *
 * The bar is driven by the stage the worker has actually reached, never by a
 * timer. An animation that advances on its own is worse than no animation: it
 * says work is happening at exactly the moment you most need to know that it
 * is not — which is what this screen existed to hide until now.
 */
/**
 * How long a worker's last sign of life still counts as "it is alive".
 *
 * The worker polls every fifteen seconds and touches a job each time it moves
 * it, so a couple of minutes of silence is comfortably normal while it waits
 * on VirusTotal. Past that, it is no longer evidence of anything.
 */
const WORKER_ALIVE_SECONDS = 180;

function jobStatusCard(job, workerActivity = null) {
  const at = Math.max(0, JOB_STAGES.findIndex((s) => s.id === job.stage));
  const finished = job.state === 'done' || job.stage === 'done';
  const failed = job.state === 'failed' || job.stage === 'failed';
  const cancelled = job.state === 'cancelled';
  const waiting = job.state === 'waiting';
  // Is a worker demonstrably alive, whatever it is doing? Evidence is another
  // job it has touched recently — not this one, which is exactly the job it
  // has not got to yet.
  const workerAlive = Boolean(workerActivity)
    && secondsSince(workerActivity.at) < WORKER_ALIVE_SECONDS;

  const unclaimed = !job.claimed_by && !finished && !failed && !cancelled
    && secondsSince(job.created_at) > CLAIM_PATIENCE_SECONDS;

  // Only ONE of these two is ever true, and telling them apart is the whole
  // point: "nothing is running" and "something is running, on a different job"
  // look identical from this row and need opposite responses from the reader.
  const queuedBehind = unclaimed && workerAlive;
  const stalled = unclaimed && !workerAlive;

  const pct = failed || cancelled
    ? 100
    : Math.round((at / (JOB_STAGES.length - 1)) * 100);

  const stage = JOB_STAGES[at] || JOB_STAGES[0];
  // A parked job is not always parked on you. It also stops when something it
  // needs is missing — a credential, a setting — and calling that "waiting for
  // your approval" sends somebody to look for a button that is not there, on a
  // screen where every gate is already set to automatic.
  const blocked = waiting && Boolean(job.error) && !/approve|אשר/i.test(job.error);

  const headline = failed ? 'נכשל'
    : cancelled ? 'בוטל'
    : blocked ? 'נעצר — חסר משהו'
    : waiting ? 'ממתין לאישור שלך'
    : stage.name;
  const detail = failed ? (job.error || 'משהו השתבש')
    : cancelled ? 'המשיכה בוטלה'
    : blocked ? job.error
    : waiting ? 'העבודה עצרה בשער. אשר כדי להמשיך.'
    : stage.doing;

  const tone = failed || cancelled ? 'bad'
    : blocked ? 'bad'
    : waiting ? 'warn'
    : finished ? 'ok' : 'run';

  const bar = el('div', {
    class: `job-bar job-bar-${tone}${!finished && !failed && !cancelled && !waiting && job.claimed_by ? ' job-bar-live' : ''}`,
    attrs: {
      role: 'progressbar',
      'aria-valuenow': String(pct),
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-label': `התקדמות: ${headline}`
    }
  }, el('span', { class: 'job-bar-fill' }));
  bar.querySelector('.job-bar-fill').style.width = `${pct}%`;

  const progress = job.progress || {};
  const lines = [
    ['נמצאו', progress.found],
    ['דולגו', progress.skipped],
    ['הורדו', progress.fetched],
    ['נסרקו', progress.scanned],
    ['שאלות', progress.drafts],
    ['פורסמו', progress.published]
  ].filter(([, v]) => v != null);

  return el('div', { class: 'job-card' },
    el('div', { class: 'admin-row-title' },
      el('span', { text: `${subjectName(job.subject)} · ${gradeName(job.grade)}` }),
      statusPill(waiting ? 'waiting' : job.stage)),

    // The running step, named, directly above the bar — the thing that was
    // missing when a queued job looked identical to a dead one.
    el('div', { class: 'job-progress' },
      el('div', { class: 'job-stage' },
        el('span', { class: 'job-stage-name', text: headline }),
        // 'failed' and 'cancelled' are not stages in the pipeline, so findIndex
        // does not place them and the counter would read "step 1 of 7" over a
        // job that got as far as extraction before dying. No number is better
        // than a wrong one.
        failed || cancelled
          ? null
          : el('span', { class: 'job-stage-step', text: `שלב ${Math.min(at + 1, JOB_STAGES.length)} מתוך ${JOB_STAGES.length}` })),
      bar,
      el('small', { class: failed ? 'job-stage-doing admin-error' : 'job-stage-doing', text: detail })),

    // The job is fine and the queue is fine. Which of these two it is decides
    // whether there is anything at all for the reader to do.
    stalled
      ? el('div', { class: 'job-stalled' },
          el('strong', { text: 'אף תוכנה לא לקחה את העבודה' }),
          el('span', { text: `העבודה ממתינה בתור ${agoLabel(job.created_at)}. ודא שתוכנת exeScraper רצה על המחשב בבית, ושמוגדרים בה SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY בקובץ .env.` }),
          el('span', { class: 'admin-note', text: 'העבודה לא תאבד — היא תתחיל לבד ברגע שהתוכנה תעלה.' }))
      : null,

    queuedBehind
      ? el('div', { class: 'job-queued' },
          el('strong', { text: 'ממתין בתור' }),
          el('span', { text: `התוכנה רצה ועובדת כרגע על משיכה אחרת. היא לוקחת עבודה אחת בכל פעם ומסיימת אותה לפני שהיא מתחילה את הבאה.` }),
          el('span', { class: 'admin-note', text: `סימן חיים אחרון מ-${workerActivity.worker} ${agoLabel(workerActivity.at)}. סריקת וירוסים מוגבלת ל-4 קבצים בדקה, אז משיכה עם הרבה קבצים לוקחת זמן.` }))
      : null,

    lines.length
      ? el('ul', { class: 'job-stats' }, ...lines.map(([label, value]) =>
          el('li', {}, el('strong', { text: String(value) }), el('span', { text: label }))))
      : null,

    el('small', { class: 'admin-row-meta', text: job.claimed_by
      ? `רץ על ${job.claimed_by} · עודכן ${agoLabel(job.updated_at)}`
      : `נוצר ${agoLabel(job.created_at)}` }));
}


/**
 * Step 4 — read what was found, then approve it.
 *
 * The excerpt is the whole point of this screen. A filename and a URL cannot
 * tell you whether a PDF is the right year, whether it is a scan with no text
 * in it at all, or whether it is the answer key rather than the paper — and
 * approving on a filename is how a subject ends up full of nonsense.
 */
export function renderWizardSources(job, sources, workerActivity = null, view = {}) {
  const rows = sources.map(src => {
    const open = el('a', {
      class: 'admin-link',
      text: 'פתח את המקור',
      attrs: { href: src.url, target: '_blank', rel: 'noopener noreferrer' }
    });

    const meta = [src.ext ? src.ext.toUpperCase() : null, bytesLabel(src.bytes), src.source_id]
      .filter(Boolean).join(' · ');

    // Past this point the worker has acted on the source: it has been
    // downloaded, scanned, maybe read. Approving it again does not re-approve
    // anything — it drags the row BACKWARDS to 'approved', and the extraction
    // step, which looks for 'fetched', then finds nothing and reports that
    // there are no files. Which is exactly what happened, because the screen
    // asks you to approve sources and left the button live while it did.
    const settled = ['fetched', 'extracted', 'failed'].includes(src.status);
    const decided = src.status !== 'pending';

    return el('li', { class: `admin-row source-row${decided ? ' decided' : ''}` },
      el('div', { class: 'admin-row-main' },
        el('div', { class: 'admin-row-title' },
          el('span', { text: src.title }),
          statusPill(src.status),
          src.scan ? statusPill(src.scan) : null),
        el('small', { class: 'admin-row-meta', text: meta }),
        open,
        src.excerpt
          ? el('details', { class: 'source-excerpt' },
              el('summary', { text: 'הצץ בתוכן הקובץ' }),
              el('pre', { class: 'excerpt-text', text: src.excerpt }))
          : el('small', { class: 'admin-note', text: 'אין עדיין תצוגת תוכן — הקובץ עוד לא הורד ונקרא.' })),
      el('div', { class: 'admin-row-actions' },
        settled
          ? el('small', { class: 'admin-row-meta', text: SETTLED_NOTE[src.status] })
          : button('אשר', 'admin-source-approve',
              { variant: 'cta-btn', data: { id: src.id }, disabled: src.status === 'approved' }),
        settled
          ? null
          : button('דחה', 'admin-source-reject',
              { variant: 'btn-quiet', data: { id: src.id }, disabled: src.status === 'rejected' })));
  });

  // Everything that will actually be read: approved, plus the ones already
  // downloaded. Counting only 'approved' made the button read "extract from 0
  // sources" and sit disabled over four files the worker had already fetched
  // and scanned clean.
  const READY = ['approved', 'fetched', 'extracted'];
  const approved = sources.filter(s => READY.includes(s.status)).length;

  wizardFrame('sources', view,
    job ? jobStatusCard(job, workerActivity) : null,
    sources.length
      ? el('ul', { class: 'admin-list' }, ...rows)
      : el('p', { class: 'admin-empty', text: 'עוד לא נמצאו מקורות. אם החיפוש בדיוק התחיל, המתן רגע ורענן.' }),
    el('div', { class: 'wizard-actions' },
      button('→ חזור', 'admin-wizard-back', { variant: 'btn-quiet' }),
      button('רענן', 'admin-refresh', { variant: 'btn-quiet' }),
      button(`חלץ שאלות מ-${approved} מקורות ←`, 'admin-run-extract',
        { variant: 'cta-btn', disabled: approved === 0 })));
}

/** Step 5 — extraction is running elsewhere; this is the waiting room. */
export function renderWizardExtract(job, draftCount, workerActivity = null, view = {}) {
  wizardFrame('extract', view,
    job ? jobStatusCard(job, workerActivity) : null,
    el('p', { class: 'admin-sub', text: 'התוכנה קוראת את הקבצים שאישרת והופכת אותם לשאלות בפורמט של האפליקציה. זה לוקח דקה או שתיים לקובץ.' }),
    draftCount > 0
      ? el('p', { class: 'admin-ok', text: `מוכנות ${draftCount} שאלות לבדיקה.` })
      : el('p', { class: 'admin-note', text: 'עוד לא הגיעו שאלות.' }),
    el('div', { class: 'wizard-actions' },
      button('→ חזור', 'admin-wizard-back'),
      button('רענן', 'admin-refresh'),
      button('עבור לבדיקת השאלות ←', 'admin-wizard-next',
        { variant: 'cta-btn', disabled: draftCount === 0 })));
}

/**
 * Step 6 — every draft, drawn the way the student will see it.
 *
 * This is the step the whole console is built around. The fields above the
 * preview are editable because a draft is usually nearly right — a wrong topic
 * or a clumsy sentence is worth fixing rather than rejecting, and rejecting
 * forces a whole re-extraction to get it back.
 */
export function renderWizardReview(drafts, subjectDraft, selected, view = {}) {
  const cards = drafts.map(d => draftCard(d, subjectDraft, selected.has(d.id)));
  const chosen = selected.size;

  wizardFrame('review', view,
    el('div', { class: 'admin-head' },
      el('p', { class: 'admin-sub', text: 'כל שאלה מוצגת כאן בדיוק כפי שתיראה במבחן. אשר את מה שנכון, דחה את השאר.' }),
      el('div', { class: 'admin-row-actions' },
        button('סמן הכל', 'admin-select-all-drafts', { variant: 'btn-quiet' }),
        button('נקה בחירה', 'admin-clear-draft-selection', { variant: 'btn-quiet' }))),
    drafts.length
      ? el('div', { class: 'draft-grid' }, ...cards)
      : el('p', { class: 'admin-empty', text: 'אין שאלות שממתינות לבדיקה.' }),
    el('div', { class: 'wizard-actions' },
      button('→ חזור', 'admin-wizard-back', { variant: 'btn-quiet' }),
      button(`דחה ${chosen}`, 'admin-reject-drafts', { disabled: chosen === 0 }),
      button(`אשר ${chosen} ←`, 'admin-approve-drafts',
        { variant: 'cta-btn', disabled: chosen === 0 })));
}

function draftCard(draft, subjectDraft, checked) {
  const tick = el('input', { attrs: { type: 'checkbox' } });
  tick.checked = checked;
  tick.dataset.action = 'admin-toggle-draft';
  tick.dataset.id = String(draft.id);

  const question = {
    text: draft.text,
    topic: draft.topic,
    options: draft.options,
    correctIdx: draft.correct_index,
    exp: draft.explanation
  };

  const provenance = [draft.source_name, draft.model].filter(Boolean).join(' · ');

  return el('article', { class: `draft-card${checked ? ' selected' : ''}` },
    el('header', { class: 'draft-head' },
      el('label', { class: 'admin-check' }, tick, el('span', { text: `#${draft.id}` })),
      statusPill(draft.status),
      el('span', { class: 'draft-topic', text: draft.topic })),
    questionPreview(question, subjectDraft),
    el('details', { class: 'draft-fields' },
      el('summary', { text: 'ערוך שדות' }),
      field('נושא', input(`draft-topic-${draft.id}`, draft.topic)),
      field('הסבר לתשובה', input(`draft-exp-${draft.id}`, draft.explanation || '')),
      field('רמת קושי', select(`draft-diff-${draft.id}`,
        [1, 2, 3, 4, 5].map(n => ({ value: n, label: String(n) })), draft.difficulty)),
      button('שמור שינויים', 'admin-save-draft', { data: { id: draft.id } })),
    provenance
      ? el('small', { class: 'admin-row-meta', text: `מקור: ${provenance}` })
      : null,
    draft.source_url
      ? el('a', { class: 'admin-link', text: 'הקובץ שממנו נלקחה', attrs: { href: draft.source_url, target: '_blank', rel: 'noopener noreferrer' } })
      : null);
}

/**
 * One question, drawn with the quiz screen's own classes.
 *
 * `subject` may be the wizard's in-progress draft (which has dir/optionsDir on
 * it) or a registry id — the wizard needs the former, because the whole point
 * at step 2 is previewing a direction that has not been saved anywhere yet.
 *
 * The correct answer is marked. On the real screen it is revealed only after
 * answering, but this is a proofreading surface: the single most common defect
 * in an extracted question is the right answer being wrong, and hiding it would
 * make that the one thing the preview cannot show.
 */
export function questionPreview(question, subject) {
  const conf = typeof subject === 'string' ? getSubject(subject) : subject;
  const dir = (conf && conf.dir) || 'rtl';
  const optionsDir = (conf && (conf.optionsDir || conf.options_dir)) || 'rtl';

  const text = el('div', { class: 'question-text preview-question' });
  text.setAttribute('dir', dir);
  text.innerHTML = sanitize(question.text || '');

  const list = el('ul', { class: 'options-list preview-options' });
  list.setAttribute('dir', optionsDir);
  (question.options || []).forEach((option, i) => {
    const li = el('li', { class: 'option-item' });
    li.innerHTML = sanitize(String(option));
    if (optionsDir === 'auto') li.setAttribute('dir', 'auto');
    if (i === question.correctIdx) {
      li.classList.add('locked', 'correct');
      li.appendChild(el('span', { class: 'preview-correct-tag', text: 'התשובה הנכונה' }));
    }
    list.appendChild(li);
  });

  return el('div', { class: 'question-preview' },
    question.topic ? el('span', { class: 'topic-badge', text: `נושא: ${question.topic}` }) : null,
    text,
    list,
    question.exp
      ? el('p', { class: 'preview-exp', text: `הסבר: ${question.exp}` })
      : el('p', { class: 'admin-note', text: 'אין הסבר לתשובה. התלמיד יראה את השאלה בלי הסבר בסיום.' }));
}

/** Step 7 — what is about to reach students, and the button that sends it. */
export function renderWizardPublish(subjectDraft, approved, counts, view = {}) {
  const byGrade = new Map();
  for (const d of approved) byGrade.set(d.grade, (byGrade.get(d.grade) || 0) + 1);

  const summary = [...byGrade.entries()].sort((a, b) => a[0] - b[0]).map(([grade, n]) =>
    el('li', {}, el('strong', { text: String(n) }), el('span', { text: `שאלות ב${gradeName(grade)}` })));

  const live = counts.get(subjectDraft.id) || 0;

  wizardFrame('publish', view,
    el('div', { class: 'publish-summary' },
      el('h4', { text: subjectDraft.name }),
      summary.length
        ? el('ul', { class: 'job-stats' }, ...summary)
        : el('p', { class: 'admin-empty', text: 'אין שאלות מאושרות לפרסום.' }),
      el('p', { class: 'admin-note', text: `כרגע יש למקצוע ${live} שאלות פעילות בבנק.` })),
    subjectDraft.status === 'published'
      ? el('p', { class: 'admin-ok', text: 'המקצוע כבר גלוי לתלמידים. השאלות יצטרפו אליו מיד עם הפרסום.' })
      : el('p', { class: 'admin-note', text: 'המקצוע עדיין בטיוטה. פרסום כאן יפרסם גם אותו וגם את השאלות.' }),
    el('div', { class: 'wizard-actions' },
      button('→ חזור', 'admin-wizard-back', { variant: 'btn-quiet' }),
      button(`פרסם ${approved.length} שאלות לתלמידים`, 'admin-publish-all',
        { variant: 'cta-btn', disabled: approved.length === 0 })));
}

// --- tab: ingest jobs --------------------------------------------------

export function renderIngestTab(jobs, parkedWizard = null, workerActivity = null) {
  // The full card, bar and all, rather than a status word. This list is where
  // somebody looks to answer "is it still going?", and a pill that reads
  // "בתור" answers that identically whether a worker is chewing through it or
  // nothing has touched it for an hour.
  const rows = jobs.map(job => el('li', { class: 'admin-row admin-row-job' },
    el('div', { class: 'admin-row-main' },
      jobStatusCard(job, workerActivity),
      el('small', { class: 'admin-row-meta', text: job.query || 'ללא מילות חיפוש' })),
    el('div', { class: 'admin-row-actions' },
      button('פתח', 'admin-open-job', { variant: 'cta-btn', data: { id: job.id } }),
      // Not offered at the fetch gate. That gate is data — "at least one
      // source is approved" — so releasing it without approving anything
      // cannot pass it, and the worker parks again with the same sentence.
      // From here that reads as a button that does nothing. The approving is
      // done on the job's own screen, so send them there instead.
      job.state === 'waiting' && job.stage !== 'fetch'
        ? button('שחרר להמשך', 'admin-resume-job', { variant: 'btn-quiet', data: { id: job.id } })
        : null,
      // A failed job is finished as far as the worker is concerned, so one
      // dead link took the whole run with it — including sources that were
      // approved and fine. This puts it back on the queue at the download
      // step; nothing already downloaded is fetched twice.
      job.state === 'failed' || job.state === 'cancelled'
        ? button('נסה שוב', 'admin-retry-job', { variant: 'btn-quiet', data: { id: job.id } })
        : null,
      job.state === 'running' || job.state === 'waiting'
        ? button('בטל', 'admin-cancel-job', { variant: 'btn-quiet', data: { id: job.id } })
        : null)));

  setBody(
    el('div', { class: 'admin-head' },
      el('div', {},
        el('h3', { text: 'משיכות תוכן' }),
        el('p', { class: 'admin-sub', text: 'כל משיכה רצה על המחשב שבבית ומתעדכנת כאן מעצמה.' })),
      button('רענן', 'admin-refresh')),

    // A run left open behind a tab switch is offered back rather than lost.
    parkedWizard
      ? el('div', { class: 'wizard-resume' },
          el('div', {},
            el('strong', { text: 'יש לך אשף פתוח' }),
            el('span', { text: ` ${parkedWizard.subject.name} — ${stepNameOf(parkedWizard.step)}` })),
          button('חזור לאשף', 'admin-resume-wizard', { variant: 'cta-btn' }))
      : null,

    rows.length
      ? el('ul', { class: 'admin-list' }, ...rows)
      : el('p', { class: 'admin-empty', text: 'אין עדיין משיכות תוכן.' }));
}

// --- tab: review -------------------------------------------------------

export function renderReviewTab(drafts, selected) {
  setBody(
    el('div', { class: 'admin-head' },
      el('div', {},
        el('h3', { text: 'שאלות שממתינות לאישור' }),
        el('p', { class: 'admin-sub', text: 'מכל המקצועות, כפי שייראו לתלמיד.' })),
      el('div', { class: 'admin-row-actions' },
        button('סמן הכל', 'admin-select-all-drafts', { variant: 'btn-quiet' }),
        button('רענן', 'admin-refresh', { variant: 'btn-quiet' }))),
    drafts.length
      ? el('div', { class: 'draft-grid' },
          ...drafts.map(d => draftCard(d, d.subject, selected.has(d.id))))
      : el('p', { class: 'admin-empty', text: 'אין שאלות שממתינות. נקי.' }),
    drafts.length
      ? el('div', { class: 'wizard-actions' },
          button(`דחה ${selected.size}`, 'admin-reject-drafts', { disabled: selected.size === 0 }),
          button(`אשר ופרסם ${selected.size}`, 'admin-approve-and-publish',
            { variant: 'cta-btn', disabled: selected.size === 0 }))
      : null);
}

// --- tab: settings -----------------------------------------------------

export function renderSettingsTab(modes) {
  setBody(
    el('div', { class: 'admin-head' },
      el('div', {},
        el('h3', { text: 'ברירת מחדל לכל שלב' }),
        el('p', { class: 'admin-sub', text: 'ההגדרה נשמרת על משיכה חדשה בלבד — משיכה שכבר רצה ממשיכה עם מה שהיה כשהתחילה.' }))),
    modeToggles(modes, 'default'),
    el('div', { class: 'wizard-actions' },
      button('שמור', 'admin-save-settings', { variant: 'cta-btn' })));
}

// --- tab: people -------------------------------------------------------

const ROLE_LABELS = { admin: 'מנהל', editor: 'עורך תוכן' };

/**
 * Everyone with an account, staff first.
 *
 * Staff first because this screen is opened to change a permission far more
 * often than to read a roster, and the rows that can be changed should not be
 * somewhere down a list of every student who ever signed up.
 */
export function renderPeopleTab(people, requests, me) {
  const staff = people.filter(p => p.role);
  const students = people.filter(p => !p.role);

  setBody(
    el('div', { class: 'admin-head' },
      el('div', {},
        el('h3', { text: 'אנשים והרשאות' }),
        el('p', { class: 'admin-sub', text: 'מנהל יכול הכל, כולל ניהול אנשים. עורך תוכן יכול ליצור מקצועות, למשוך תוכן ולאשר שאלות — אבל לא לנהל הרשאות ולא לפרסם מקצוע.' })),
      button('צור משתמש', 'admin-new-user', { variant: 'cta-btn' })),

    el('h4', { class: 'admin-section-head', text: `צוות (${staff.length})` }),
    staff.length
      ? el('ul', { class: 'admin-list' }, ...staff.map(p => personRow(p, me)))
      : el('p', { class: 'admin-empty', text: 'אין אף אחד בצוות. זה לא אמור לקרות.' }),

    requests.length
      ? el('div', {},
          el('h4', { class: 'admin-section-head', text: 'בקשות פתיחת חשבון' }),
          el('ul', { class: 'admin-list' }, ...requests.map(requestRow)))
      : null,

    el('h4', { class: 'admin-section-head', text: `תלמידים (${students.length})` }),
    students.length
      ? el('ul', { class: 'admin-list' }, ...students.map(p => personRow(p, me)))
      : el('p', { class: 'admin-empty', text: 'אין עדיין תלמידים רשומים.' }));
}

function personRow(person, me) {
  const isSelf = person.id === me.id;
  const meta = [
    `שם משתמש: ${person.username}`,
    person.grade ? gradeName(person.grade) : null
  ].filter(Boolean).join(' · ');

  // Self-demotion is refused by a trigger in the database, not merely hidden
  // here — but a button that always fails is worse than no button.
  const actions = isSelf
    ? [el('small', { class: 'admin-row-meta', text: 'זה אתה' })]
    : [
        person.role !== 'admin'
          ? button('הפוך למנהל', 'admin-set-role',
              { variant: 'cta-btn', data: { user: person.id, role: 'admin' } })
          : null,
        person.role !== 'editor'
          ? button('הפוך לעורך', 'admin-set-role', { data: { user: person.id, role: 'editor' } })
          : null,
        person.role
          ? button('הסר הרשאות', 'admin-revoke-role', { data: { user: person.id } })
          : null
      ].filter(Boolean);

  return el('li', { class: 'admin-row' },
    el('div', { class: 'admin-row-main' },
      el('div', { class: 'admin-row-title' },
        el('span', { text: person.display_name }),
        person.role ? pill(ROLE_LABELS[person.role] || person.role, 'ok') : null),
      el('small', { class: 'admin-row-meta', text: meta })),
    el('div', { class: 'admin-row-actions' }, ...actions));
}

function requestRow(req) {
  return el('li', { class: 'admin-row' },
    el('div', { class: 'admin-row-main' },
      el('div', { class: 'admin-row-title' },
        el('span', { text: req.display_name }),
        statusPill(req.status === 'done' ? 'done' : req.status === 'failed' ? 'failed' : 'wait')),
      el('small', { class: 'admin-row-meta', text: `שם משתמש: ${req.username}` }),
      req.error ? el('small', { class: 'admin-error', text: req.error }) : null,
      req.status === 'pending'
        ? el('small', { class: 'admin-note', text: 'ממתין שהתוכנה בבית תפתח את החשבון.' })
        : null));
}

/**
 * The form for a new account.
 *
 * The password is set here and shown here, because there is nowhere to email it
 * to: logins in this app are usernames, and the address behind them is a
 * synthetic alias. Whoever fills this in is the person who will hand the
 * password over.
 */
export function renderNewUserForm(draft) {
  setBody(
    el('div', { class: 'admin-head' },
      el('div', {},
        el('h3', { text: 'חשבון חדש' }),
        el('p', { class: 'admin-sub', text: 'החשבון ייפתח על ידי התוכנה שרצה בבית, כי רק היא מחזיקה את המפתח שמורשה לפתוח חשבונות. אם היא כבויה, הבקשה תמתין.' })),
      button('חזור', 'admin-people-back', { variant: 'btn-quiet' })),
    el('div', { class: 'wizard-grid' },
      el('div', {},
        field('שם מלא', input('user-display', draft.displayName, 'איך ייקרא בלוח התוצאות')),
        field('שם משתמש', input('user-username', draft.username, 'igal'),
          '3-20 תווים: אותיות אנגליות קטנות, ספרות, נקודה או קו תחתון.'),
        field('סיסמה', input('user-password', draft.password, 'לפחות 6 תווים'),
          'רשום אותה — היא לא תוצג שוב אחרי שהחשבון ייפתח.')),
      el('div', {},
        field('כיתה', select('user-grade',
          [{ value: '', label: 'ללא' }, ...GRADE_OPTIONS.map(g => ({ value: g, label: gradeName(g) }))],
          draft.grade || '')),
        field('הרשאה', select('user-role', [
          { value: '', label: 'תלמיד — בלי גישה לניהול' },
          { value: 'editor', label: 'עורך תוכן' },
          { value: 'admin', label: 'מנהל' }
        ], draft.role || '')))),
    el('div', { class: 'wizard-actions' },
      button('בטל', 'admin-people-back', { variant: 'btn-quiet' }),
      button('פתח חשבון', 'admin-create-user', { variant: 'cta-btn' })));
}

// --- writing questions by hand ----------------------------------------

/**
 * The question editor.
 *
 * Exists because extraction is not the only way a bank gets filled, and on a
 * machine with no model credential it is not a way at all. It is also the only
 * way to add a question a scraper will never find, or to fix one by hand
 * rather than rejecting it and re-running a whole extraction.
 *
 * Two modes behind one screen. One at a time suits the question you are
 * thinking about as you type it; pasting suits the ten you already wrote in a
 * spreadsheet — and ten is roughly what a subject needs before a quiz in it
 * stops running short.
 */
export function renderQuestionEditor(ctx) {
  const tab = (id, label) => {
    const b = el('button', {
      class: `admin-tab${ctx.mode === id ? ' active' : ''}`,
      text: label,
      attrs: { type: 'button' }
    });
    b.dataset.action = 'admin-editor-mode';
    b.dataset.mode = id;
    return b;
  };

  setBody(
    el('div', { class: 'admin-head' },
      el('div', {},
        el('h3', { text: `שאלות ל${ctx.subjectName}` }),
        el('p', { class: 'admin-sub', text: `נשמרות ישירות לבנק ונראות לתלמידים מיד. כרגע יש ${ctx.existing} שאלות ב${gradeName(ctx.grade)}.` })),
      button('חזור', 'admin-editor-close', { variant: 'btn-quiet' })),

    el('div', { class: 'admin-tabs' }, tab('single', 'שאלה אחת'), tab('bulk', 'הדבקה מרובה')),

    ctx.mode === 'single' ? singleEditor(ctx) : bulkEditor(ctx));
}

function gradeChoices(ctx) {
  const grades = ctx.grades && ctx.grades.length ? ctx.grades : [ctx.grade];
  return grades.map(g => ({ value: g, label: gradeName(g) }));
}

function singleEditor(ctx) {
  const d = ctx.draft;

  // One radio group across the four boxes: "which of these is right" is a
  // single choice, and checkboxes would let you mark two.
  const optionRows = [0, 1, 2, 3].map(i => {
    const radio = el('input', {
      attrs: {
        type: 'radio', name: 'correct-option', value: String(i),
        'aria-label': `סמן תשובה ${i + 1} כנכונה`
      }
    });
    radio.checked = Number(d.correctIndex) === i;
    radio.dataset.action = 'admin-editor-correct';

    return el('div', { class: `option-row${radio.checked ? ' is-correct' : ''}` },
      el('label', { class: 'option-radio' }, radio),
      input(`q-option-${i}`, d.options[i], i === 0 ? 'תשובה' : 'מסיח', 'admin-editor-field'));
  });

  return el('div', { class: 'wizard-grid' },
    el('div', {},
      field('כיתה', select('q-grade', gradeChoices(ctx), ctx.grade, 'admin-editor-grade')),
      field('נושא', input('q-topic', d.topic, 'לדוגמה: רשויות השלטון', 'admin-editor-field'),
        'התלמיד רואה את זה מעל השאלה, והמערכת מקבצת לפיו נושאים חלשים.'),
      field('השאלה', input('q-text', d.text, 'מה רוצים לשאול?', 'admin-editor-field')),
      el('div', { class: 'form-group' },
        el('label', { class: 'form-label', text: 'תשובות — סמן את הנכונה' }),
        el('div', { class: 'option-rows' }, ...optionRows),
        el('small', { class: 'form-hint', text: 'הסדר כאן לא משנה: המערכת מערבבת את התשובות בכל פעם שהשאלה מוצגת.' })),
      field('הסבר', input('q-exp', d.explanation, 'למה זו התשובה הנכונה', 'admin-editor-field'),
        'מוצג לתלמיד אחרי שהוא עונה. אפשר להשאיר ריק.'),
      field('רמת קושי', select('q-difficulty',
        [1, 2, 3, 4, 5].map(n => ({ value: n, label: String(n) })), d.difficulty, 'admin-editor-field')),
      el('div', { class: 'wizard-actions' },
        button('שמור והמשך לשאלה הבאה', 'admin-save-question', { variant: 'cta-btn' }))),

    el('div', {},
      el('h4', { text: 'איך זה ייראה לתלמיד' }),
      // The same renderer the draft-review screen uses, so a hand-written
      // question and an extracted one are proofread on an identical surface.
      questionPreview({
        topic: d.topic || 'נושא',
        text: d.text || 'השאלה תופיע כאן',
        options: d.options.map((o, i) => o || `תשובה ${i + 1}`),
        correctIdx: Number(d.correctIndex),
        exp: d.explanation
      }, ctx.subject)));
}

function bulkEditor(ctx) {
  const box = el('textarea', {
    class: 'form-control bulk-box',
    attrs: { id: 'q-bulk', rows: '12', spellcheck: 'false' }
  });
  box.value = ctx.bulkText || '';
  box.setAttribute('placeholder', `${EXAMPLE_LINE}\n…שורה אחת לכל שאלה`);
  box.dataset.action = 'admin-editor-field';

  const parsed = ctx.parsed;

  return el('div', {},
    field('כיתה', select('q-bulk-grade', gradeChoices(ctx), ctx.grade, 'admin-editor-grade')),

    el('details', { class: 'bulk-help' },
      el('summary', { text: 'מה הפורמט?' }),
      el('p', { class: 'admin-note', text: 'שורה אחת לכל שאלה, שדות מופרדים בקו אנכי. התשובה הנכונה תמיד ראשונה — אין מה לספור ואין מה לטעות. שני השדות האחרונים אפשר להשמיט.' }),
      el('pre', { class: 'excerpt-text', text: 'נושא | שאלה | תשובה נכונה | מסיח | מסיח | מסיח | הסבר | קושי' }),
      el('p', { class: 'admin-note', text: 'דוגמה:' }),
      el('pre', { class: 'excerpt-text', text: EXAMPLE_LINE }),
      el('p', { class: 'admin-note', text: 'שורות ריקות ושורות שמתחילות ב-# מדולגות.' })),

    el('div', { class: 'form-group' },
      el('label', { class: 'form-label', attrs: { for: 'q-bulk' }, text: 'הדבק כאן' }),
      box),

    parsed
      ? el('div', { class: 'bulk-result' },
          el('p', {
            class: parsed.rows.length ? 'admin-ok' : 'admin-note',
            text: `${parsed.rows.length} שאלות תקינות`
          }),
          parsed.errors.length
            ? el('div', {},
                el('p', { class: 'admin-error', text: `${parsed.errors.length} שורות לא נקלטו:` }),
                el('ul', { class: 'bulk-errors' }, ...parsed.errors.slice(0, 12).map(e =>
                  el('li', {},
                    el('strong', { text: `שורה ${e.line}: ` }),
                    el('span', { text: e.problem }),
                    el('code', { text: e.text })))))
            : null,
          // Every parsed question, drawn the way the student will see it. The
          // point of pasting twenty at once is not having to check them one at
          // a time — but it must still be possible to check them.
          parsed.rows.length
            ? el('details', { class: 'bulk-preview' },
                el('summary', { text: `הצג תצוגה מקדימה של ${parsed.rows.length} השאלות` }),
                el('div', { class: 'draft-grid' }, ...parsed.rows.map(r =>
                  el('article', { class: 'draft-card' },
                    questionPreview({
                      topic: r.topic, text: r.text, options: r.options,
                      correctIdx: r.correctIndex, exp: r.explanation
                    }, ctx.subject)))))
            : null)
      : null,

    el('div', { class: 'wizard-actions' },
      button('בדוק', 'admin-parse-bulk', { variant: 'btn-quiet' }),
      button(parsed ? `שמור ${parsed.rows.length} שאלות` : 'שמור', 'admin-save-bulk',
        { variant: 'cta-btn', disabled: !parsed || parsed.rows.length === 0 })));
}
