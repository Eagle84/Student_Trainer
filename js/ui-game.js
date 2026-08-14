/**
 * Rendering for the sprint and its board.
 *
 * Its own module for the same reason ui-lesson.js is: ui.js already covers six
 * screens, and a game screen shares almost nothing with a quiz screen — no
 * next button, no feedback box, a clock instead.
 *
 * The question and its options DO share the quiz's markup and sanitising, so a
 * picture answer or a bidi-isolated formula renders identically in both.
 */
import { $, el } from './dom.js';
import { sanitize } from './sanitize.js';
import { renderDiagram } from './diagrams.js';
import { subjectName, gradeName, difficultyName } from './ui.js';
import { currentGameQuestion, gameRules, MODES } from './game.js';

/**
 * Repaints the HUD.
 *
 * The third slot means different things in different modes, because what a
 * player needs to watch differs: lives in דיוק and טיפוס, and the current level
 * in טיפוס. Showing all of them always would fill the bar with numbers that do
 * not apply.
 */
export function renderGameHud(state) {
  const seconds = Math.ceil(state.timeLeftMs / 1000);
  const clock = $('game-clock');
  if (clock) {
    clock.textContent = String(seconds);
    // Under ten seconds the number itself carries the urgency, so a student
    // watching the questions still notices.
    clock.classList.toggle('urgent', seconds <= 10);
  }
  const score = $('game-score');
  if (score) score.textContent = String(state.score);
  const streak = $('game-streak');
  if (streak) {
    streak.textContent = String(state.streak);
    streak.classList.toggle('hot', state.streak >= 5);
  }

  const rules = gameRules(state);
  const extra = $('game-extra-stat');
  if (extra) {
    if (rules.climbs) {
      extra.hidden = false;
      $('game-extra').textContent = `${state.level}`;
      $('game-extra-label').textContent = `רמה · ${state.livesLeft} חיים`;
    } else if (Number.isFinite(rules.lives)) {
      extra.hidden = false;
      $('game-extra').textContent = '❤'.repeat(Math.max(0, state.livesLeft)) || '—';
      $('game-extra-label').textContent = 'חיים';
    } else {
      extra.hidden = true;
    }
  }

  // Measured against whatever this mode's clock is: the whole game in ספרינט,
  // this question in the others.
  const percent = Math.max(0, Math.min(100, (state.timeLeftMs / (state.clockMs || state.durationMs)) * 100));
  const fill = $('game-timefill');
  if (fill) fill.style.width = `${percent}%`;
  const bar = $('game-timebar');
  if (bar) bar.setAttribute('aria-valuenow', String(Math.round(percent)));
}

/** Draws the current question and its options. */
export function renderGameQuestion(state) {
  const question = currentGameQuestion(state);
  if (!question) return;

  $('game-question').innerHTML = sanitize(question.text);

  const dgm = $('game-diagram');
  const svg = question.diagram ? renderDiagram(question.diagram) : '';
  if (svg) { dgm.innerHTML = svg; dgm.hidden = false; }
  else { dgm.replaceChildren(); dgm.hidden = true; }

  const list = $('game-options');
  list.replaceChildren();

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
      art.innerHTML = renderDiagram(figures[option]); // trusted: numeric SVG
      const tag = document.createElement('span');
      tag.className = 'option-tag';
      tag.textContent = option;
      li.append(art, tag);
    } else {
      li.innerHTML = sanitize(option);
      li.setAttribute('dir', 'auto');
    }
    list.appendChild(li);
  });
}

/**
 * The one piece of feedback a sprint gives.
 *
 * A quiz explains every answer; a sprint cannot, because stopping to read is
 * the opposite of what it measures. What it must not do is take three seconds
 * away silently, so the penalty announces itself and nothing else does.
 */
export function flashPenalty(seconds) {
  const flash = $('game-flash');
  if (!flash) return;
  flash.textContent = `−${seconds} שניות`;
  flash.classList.remove('show');
  void flash.offsetWidth;   // restart the animation
  flash.classList.add('show');
}

/** Announces a question lost to the clock, which costs a life like a mistake. */
export function flashTimeout() {
  const flash = $('game-flash');
  if (!flash) return;
  flash.textContent = 'נגמר הזמן לשאלה';
  flash.classList.remove('show');
  void flash.offsetWidth;
  flash.classList.add('show');
}

export function clearFlash() {
  const flash = $('game-flash');
  if (flash) { flash.textContent = ''; flash.classList.remove('show'); }
}

/** The end-of-run summary. */
export function renderGameOver(result, saveMessage) {
  const sub = $('game-over-sub');
  if (sub) {
    const mode = MODES[result.mode];
    const scope = result.mode === 'climb'
      ? `${subjectName(result.subject)} · ${gradeName(result.grade)}`
      : `${subjectName(result.subject)} · ${gradeName(result.grade)} · ${difficultyName(result.difficulty)}`;
    sub.textContent = `${mode ? mode.label : result.mode} — ${scope}`;
  }
  const stats = $('game-over-stats');
  if (!stats) return;
  stats.replaceChildren(
    el('div', { class: 'stat-grid' },
      statTile(String(result.score), 'נקודות'),
      statTile(`${result.correct}`, 'נכונות'),
      statTile(`${result.accuracy}%`, 'דיוק'),
      result.bestLevel
        ? statTile(`${result.bestLevel}`, 'הרמה הגבוהה ביותר')
        : statTile(String(result.best_streak), 'הרצף הארוך ביותר')),
    saveMessage ? el('p', { class: 'save-note', text: saveMessage }) : null);
}

function statTile(value, label) {
  return el('div', { class: 'stat-tile' },
    el('b', { class: 'stat-value', text: value }),
    el('span', { class: 'stat-label', text: label }));
}

/**
 * The board for one subject and level.
 *
 * Scoped rather than global on purpose: a sprint at "קל מאוד" and one at
 * "מאתגר" are not comparable, so one combined table would simply rank the
 * easiest setting on top and tell nobody anything.
 */
export function renderGameBoard(rows, { mode = 'sprint', subject, difficulty, studentName } = {}) {
  const host = $('game-board-card');
  if (!host) return;

  const label = MODES[mode] ? MODES[mode].label : mode;
  const title = mode === 'climb'
    ? `טבלת השיאים · ${label} — ${subjectName(subject)}`
    : `טבלת השיאים · ${label} — ${subjectName(subject)} · ${difficultyName(difficulty)}`;
  if (!rows || rows.length === 0) {
    host.replaceChildren(
      el('h3', { text: title }),
      el('p', { class: 'board-empty', text: 'אף אחד עוד לא רץ כאן. תהיה הראשון.' }));
    return;
  }

  const body = el('tbody');
  rows.forEach((row, i) => {
    const mine = row.student_name === studentName;
    const tr = el('tr', { class: mine ? 'me' : '' },
      el('td', { text: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1) }),
      el('td', { text: row.student_name }),
      el('td', { text: String(row.score) }),
      el('td', { text: `${row.correct}/${row.correct + row.wrong}` }),
      el('td', { text: String(row.best_streak) }));
    body.appendChild(tr);
  });

  host.replaceChildren(
    el('h3', { text: title }),
    el('div', { class: 'table-wrap' },
      el('table', { class: 'history-table' },
        el('thead', {},
          el('tr', {},
            el('th', { text: '#' }),
            el('th', { text: 'שם' }),
            el('th', { text: 'נקודות' }),
            el('th', { text: 'נכונות' }),
            el('th', { text: 'רצף' }))),
        body)));
}
