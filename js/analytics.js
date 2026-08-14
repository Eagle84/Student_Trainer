/**
 * Personal-analytics aggregation for the dashboard.
 *
 * Pure: no DOM, no network, no clock. Every function takes plain rows (as
 * returned by db.getStudentHistory / db.getAttemptErrors) and returns plain
 * data, so it is fully unit-testable from Node.
 *
 * Where "now" is genuinely needed — a streak has to know what today is — it is
 * passed in as an argument with a default rather than read from the clock, so
 * the tests can pin an instant and the function stays deterministic.
 */

function round(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Headline numbers across all of a student's attempts.
 *
 * TWO averages, deliberately, because they answer different questions and the
 * board now labels which is which:
 *
 *   accuracy   — correct / questions. Every question weighs the same, so a
 *                hundred-question quiz counts ten times a ten-question one.
 *                This is the headline.
 *   avgPercent — the mean of the per-quiz percentages. Every QUIZ weighs the
 *                same. Kept because "how do I usually score" is a fair question,
 *                but it is the one a short lucky quiz can flatter.
 *
 * They diverge in ordinary use — 71% against 73% on the history this was
 * written from — and the board used to show one in the ring and the other in a
 * tile with nothing to say they were computed differently.
 */
export function overview(attempts) {
  const count = attempts.length;
  if (count === 0) {
    return {
      count: 0, avgPercent: 0, bestPercent: 0,
      totalCorrect: 0, totalQuestions: 0, accuracy: 0
    };
  }
  let sumPercent = 0;
  let bestPercent = 0;
  let totalCorrect = 0;
  let totalQuestions = 0;
  for (const a of attempts) {
    sumPercent += Number(a.percent) || 0;
    bestPercent = Math.max(bestPercent, Number(a.percent) || 0);
    totalCorrect += Number(a.score) || 0;
    totalQuestions += Number(a.total_questions) || 0;
  }
  return {
    count,
    avgPercent: round(sumPercent / count),
    bestPercent: round(bestPercent),
    totalCorrect,
    totalQuestions,
    accuracy: totalQuestions ? round((totalCorrect / totalQuestions) * 100) : 0
  };
}

/**
 * One row per subject: attempt count, both averages, and best.
 *
 * `accuracy` is the weighted one and is what the bars measure; `avgPercent`
 * rides along for the tooltip that names the difference.
 */
export function perSubject(attempts) {
  const groups = new Map();
  for (const a of attempts) {
    const g = groups.get(a.subject)
      || { subject: a.subject, count: 0, sum: 0, best: 0, correct: 0, questions: 0 };
    g.count += 1;
    g.sum += Number(a.percent) || 0;
    g.best = Math.max(g.best, Number(a.percent) || 0);
    g.correct += Number(a.score) || 0;
    g.questions += Number(a.total_questions) || 0;
    groups.set(a.subject, g);
  }
  return [...groups.values()]
    .map(g => ({
      subject: g.subject,
      count: g.count,
      avgPercent: round(g.sum / g.count),
      accuracy: g.questions ? round((g.correct / g.questions) * 100) : 0,
      correct: g.correct,
      questions: g.questions,
      bestPercent: round(g.best)
    }))
    .sort((a, b) => b.count - a.count || b.accuracy - a.accuracy);
}

/** The newest attempts first, capped at n. */
export function recent(attempts, n = 5) {
  return [...attempts]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, n);
}

/** The last n attempts, oldest-first, as { t, percent } points for a chart. */
export function trend(attempts, n = 10) {
  return [...attempts]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-n)
    .map(a => ({ t: a.created_at, percent: round(Number(a.percent) || 0) }));
}

/** Topics the student misses most, ranked by error frequency, capped at n. */
/**
 * How many of the student's most recent attempts a weak topic is judged on.
 *
 * The panel is meant to answer "what should I work on NOW". Counting every
 * mistake ever made answered a different question — a topic drilled until it
 * was solid still sat there, and its count could only ever rise, so the list
 * silently became a permanent record of everything ever got wrong.
 *
 * Bounded by ATTEMPTS rather than by days: a student who takes a break should
 * come back to the same list they left, not an empty one.
 */
export const WEAK_TOPIC_WINDOW = 10;

/**
 * The topics worth drilling, most-missed first.
 *
 * Only mistakes from the last WEAK_TOPIC_WINDOW attempts count. Rows without an
 * attempt id — the offline queue, and every existing test fixture — are treated
 * as one anonymous attempt so they still register rather than vanishing.
 */
export function weakTopics(errorRows, n = 5, window = WEAK_TOPIC_WINDOW, cleared = null) {
  // Topics assessed locally report their LATEST result, not a lifetime tally.
  //
  // Without this the panel could not observe a topic being learned at all —
  // only mistakes are ever recorded — so a chip survived any amount of
  // drilling, and its count could only ever rise. Reporting the last
  // assessment is what makes nine-out-of-ten read as "(1)" rather than "(6)".
  //
  // The stored value is { at, missed }; the older shape was a bare timestamp
  // meaning "cleared", and is still honoured.
  const assessed = new Map();
  if (cleared && typeof cleared === 'object') {
    for (const [key, value] of Object.entries(cleared)) {
      const at = typeof value === 'object' && value ? Number(value.at) : Number(value);
      const missed = typeof value === 'object' && value ? Number(value.missed) || 0 : 0;
      const grade = typeof value === 'object' && value ? value.grade : undefined;
      if (Number.isFinite(at)) assessed.set(key, { at, missed, grade });
    }
    errorRows = errorRows.filter(e => {
      const rec = assessed.get(`${e.subject || ''}|${e.topic}`);
      if (!rec) return true;
      // A miss recorded BEFORE the latest assessment is history: it has been
      // superseded by how the topic actually went this time. No timestamp at
      // all means the row predates the field, so the assessment is newer.
      const missedAt = e.at ? Date.parse(e.at) : 0;
      return !(missedAt < rec.at);
    });
  }
  // Newest attempts first. `at` is an ISO timestamp, so a string sort is a
  // chronological sort; ties keep their relative order.
  const attempts = [...new Set(errorRows.map(e => e.attemptId ?? null))];
  if (attempts.length > window) {
    const newestFirst = [...errorRows]
      .filter(e => e.attemptId != null)
      .sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')));
    const keep = new Set();
    for (const e of newestFirst) {
      if (keep.size >= window) break;
      keep.add(e.attemptId);
    }
    // Rows with no attempt id are kept: they predate this field or came from
    // the offline path, and dropping them would empty the panel outright.
    errorRows = errorRows.filter(e => e.attemptId == null || keep.has(e.attemptId));
  }

  // Per topic: how many misses, its subject, and a tally of grades so we can
  // pick the grade the student most often missed it at — enough to launch a
  // focused drill straight from the dashboard.
  const map = new Map();
  for (const e of errorRows) {
    const rec = map.get(e.topic) || { count: 0, subject: e.subject, grades: new Map() };
    rec.count += 1;
    if (e.subject != null) rec.subject = e.subject;
    if (e.grade != null) rec.grades.set(e.grade, (rec.grades.get(e.grade) || 0) + 1);
    map.set(e.topic, rec);
  }
  // A topic assessed since its last recorded miss contributes that assessment's
  // miss count. Zero means it does not appear at all — the student has just
  // proved it — and the entry is dropped rather than shown as "(0)".
  for (const [key, rec] of assessed) {
    const [subject, topic] = key.split('|');
    const existing = map.get(topic);
    if (existing && existing.subject !== subject) continue;
    // The assessment found no mistakes, so it contributes nothing. Any rows
    // that survived the filter above are misses recorded AFTER it, and those
    // still count: clearing a topic does not immunise it against getting it
    // wrong again tomorrow.
    if (rec.missed === 0) continue;
    if (existing) {
      existing.count = rec.missed;
      continue;
    }
    // Every historical miss was superseded by this assessment, so the topic
    // has no rows left — but the assessment itself found mistakes, and a
    // topic just got wrong is precisely what the panel is for.
    if (rec.grade == null) continue;
    map.set(topic, { count: rec.missed, subject, grades: new Map([[rec.grade, 1]]) });
  }

  return [...map.entries()]
    .map(([topic, rec]) => {
      let grade = null;
      let best = -1;
      for (const [g, c] of rec.grades) if (c > best) { best = c; grade = g; }
      return { topic, count: rec.count, subject: rec.subject, grade };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/**
 * Subjects whose accuracy is at or above the threshold, best-first.
 *
 * Weighted accuracy, matching the bars and the headline ring. On the unweighted
 * mean a single short lucky quiz could declare a subject a strength.
 */
export function strongSubjects(attempts, threshold = 80) {
  return perSubject(attempts)
    .filter(s => s.accuracy >= threshold)
    .sort((a, b) => b.accuracy - a.accuracy);
}

// --- deeper analysis ---------------------------------------------------
//
// Everything below takes `now` as an argument rather than reading the clock, so
// it stays as testable as the rest of this module. The dashboard passes
// Date.now(); the tests pass a fixed instant.

/** The calendar day of an ISO timestamp, as 'YYYY-MM-DD' in local time. */
function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Whether the student is getting better, comparing the last `n` attempts with
 * the `n` before them.
 *
 * Returns null when there is not enough history to say anything — an honest
 * "not yet" beats a confident number computed from two data points.
 */
export function improvement(attempts, n = 5) {
  const ordered = [...attempts].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (ordered.length < n + 2) return null;

  const recentRows = ordered.slice(-n);
  const earlierRows = ordered.slice(-(n * 2), -n);
  if (earlierRows.length === 0) return null;

  const mean = rows => rows.reduce((sum, r) => sum + (Number(r.percent) || 0), 0) / rows.length;
  const recentAvg = mean(recentRows);
  const earlierAvg = mean(earlierRows);
  return {
    recent: round(recentAvg),
    earlier: round(earlierAvg),
    delta: round(recentAvg - earlierAvg),
    sampleSize: recentRows.length,
    comparedWith: earlierRows.length
  };
}

/**
 * The point past which an attempt's duration is not a measure of thinking.
 *
 * duration_seconds is wall time from the moment the quiz began, and a quiz can
 * be left and resumed the next day — the history this was written from holds an
 * attempt of 78,508 seconds, or nearly twenty-two hours, for a hundred
 * questions. Counted, it dragged the average from 39 seconds a question to
 * 42.7: a figure describing a night's sleep, presented as how fast the student
 * works.
 *
 * Five minutes a question is well past deliberating over a hard one and well
 * short of a parked tab, so an attempt above it is excluded rather than
 * clamped. Clamping would still let a parked quiz vote.
 */
export const MAX_SECONDS_PER_QUESTION = 300;

/** Whether an attempt's duration can be believed as time spent working. */
function timedHonestly(a) {
  const secs = Number(a.duration_seconds);
  const total = Number(a.total_questions) || 0;
  return Number.isFinite(secs) && secs > 0 && total > 0
    && secs / total <= MAX_SECONDS_PER_QUESTION;
}

/**
 * How long a question takes, overall and per subject.
 *
 * Attempts with no recorded duration are skipped rather than counted as zero,
 * which would drag the average towards a figure the student never achieved.
 * Attempts that were parked and resumed are skipped for the mirror-image
 * reason; `excluded` reports how many, so the board can say so rather than
 * quietly presenting a filtered number as the whole picture.
 */
export function pace(attempts) {
  let seconds = 0;
  let questions = 0;
  let excluded = 0;
  const bySubject = new Map();

  for (const a of attempts) {
    const secs = Number(a.duration_seconds);
    const total = Number(a.total_questions) || 0;
    if (!Number.isFinite(secs) || secs <= 0 || total <= 0) continue;
    if (!timedHonestly(a)) { excluded++; continue; }
    seconds += secs;
    questions += total;
    const s = bySubject.get(a.subject) || { subject: a.subject, seconds: 0, questions: 0 };
    s.seconds += secs;
    s.questions += total;
    bySubject.set(a.subject, s);
  }
  if (questions === 0) return null;

  const perSubjectPace = [...bySubject.values()]
    .map(s => ({ subject: s.subject, secondsPerQuestion: round(s.seconds / s.questions) }))
    .sort((a, b) => a.secondsPerQuestion - b.secondsPerQuestion);

  return {
    secondsPerQuestion: round(seconds / questions),
    totalMinutes: Math.round(seconds / 60),
    countedAttempts: attempts.length - excluded,
    excluded,
    fastest: perSubjectPace[0] || null,
    slowest: perSubjectPace.length > 1 ? perSubjectPace[perSubjectPace.length - 1] : null
  };
}

/**
 * How regularly the student turns up.
 *
 * `streak` counts back from today, and tolerates today being empty so a student
 * who has not practised YET today is not told their streak is already broken.
 */
export function activity(attempts, now = Date.now()) {
  const days = new Set(attempts.map(a => dayKey(a.created_at)).filter(Boolean));
  if (days.size === 0) return { activeDays: 0, streak: 0, last7: 0, busiestDay: null };

  const dayOf = offset => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  let streak = 0;
  const start = days.has(dayOf(0)) ? 0 : 1;
  for (let i = start; days.has(dayOf(i)); i++) streak++;

  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const last7 = attempts.filter(a => new Date(a.created_at).getTime() >= weekAgo).length;

  const counts = new Map();
  for (const a of attempts) {
    const k = dayKey(a.created_at);
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  let busiestDay = null;
  for (const [day, count] of counts) {
    if (!busiestDay || count > busiestDay.count) busiestDay = { day, count };
  }
  return { activeDays: days.size, streak, last7, busiestDay };
}

const DIFFICULTY_ORDER = [1, 2, 3, 4, 5];

/**
 * Average by difficulty band, so a student can see where the ceiling is.
 *
 * Mixed-level quizzes carry no difficulty and are grouped separately rather
 * than folded into a band they were never filtered to.
 */
export function byDifficulty(attempts) {
  const groups = new Map();
  for (const a of attempts) {
    const key = a.difficulty == null ? 'mixed' : Number(a.difficulty);
    const g = groups.get(key) || { difficulty: key, count: 0, sum: 0 };
    g.count += 1;
    g.sum += Number(a.percent) || 0;
    groups.set(key, g);
  }
  return [...groups.values()]
    .map(g => ({ difficulty: g.difficulty, count: g.count, avgPercent: round(g.sum / g.count) }))
    .sort((a, b) => {
      if (a.difficulty === 'mixed') return 1;
      if (b.difficulty === 'mixed') return -1;
      return DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty);
    });
}

/** The single best attempt, for the record. */
export function personalBest(attempts) {
  let best = null;
  for (const a of attempts) {
    const percent = Number(a.percent) || 0;
    // Ties go to the longer quiz: 100% of forty questions beats 100% of ten.
    if (!best || percent > Number(best.percent)
      || (percent === Number(best.percent) && Number(a.total_questions) > Number(best.total_questions))) {
      best = a;
    }
  }
  return best;
}

// --- progress per subject ----------------------------------------------

/** How many attempts in a subject before a first-versus-latest claim is fair. */
export const TREND_MIN_ATTEMPTS = 3;

/**
 * Each subject's own trend, rather than one pooled line.
 *
 * The single chart could not answer "which subject is actually moving": a run
 * of strong English attempts and a run of weak maths ones average into a flat
 * line that describes neither. Subjects with fewer than TREND_MIN_ATTEMPTS
 * attempts carry `delta: null` — two points is a pair of scores, not a
 * direction, and an arrow drawn from them is an opinion presented as data.
 */
export function subjectTrends(attempts, n = 8) {
  const groups = new Map();
  for (const a of attempts) {
    const list = groups.get(a.subject) || [];
    list.push(a);
    groups.set(a.subject, list);
  }

  return [...groups.entries()]
    .map(([subject, rows]) => {
      const ordered = [...rows].sort((x, y) => new Date(x.created_at) - new Date(y.created_at));
      const points = ordered.slice(-n).map(a => ({
        t: a.created_at,
        percent: round(Number(a.percent) || 0)
      }));
      const enough = ordered.length >= TREND_MIN_ATTEMPTS;
      // First and last THIRD, not first and last attempt: one unlucky opening
      // quiz would otherwise manufacture an improvement that never happened.
      const slice = Math.max(1, Math.floor(ordered.length / 3));
      const mean = rows2 => rows2.reduce((s, r) => s + (Number(r.percent) || 0), 0) / rows2.length;
      const first = mean(ordered.slice(0, slice));
      const latest = mean(ordered.slice(-slice));
      return {
        subject,
        count: ordered.length,
        points,
        first: enough ? round(first) : null,
        latest: enough ? round(latest) : null,
        delta: enough ? round(latest - first) : null
      };
    })
    .sort((a, b) => b.count - a.count);
}

// --- effort and consistency --------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What the student actually put in: time, volume and rhythm.
 *
 * Minutes come only from attempts whose duration can be believed (see
 * MAX_SECONDS_PER_QUESTION) — an overnight tab would otherwise report a week's
 * practice from one sitting. Questions and attempt counts use every row,
 * because those are exact whatever the clock did.
 */
export function effort(attempts, now = Date.now(), weeks = 6) {
  if (attempts.length === 0) return null;

  let questions = 0;
  let seconds = 0;
  let timedAttempts = 0;
  for (const a of attempts) {
    questions += Number(a.total_questions) || 0;
    if (timedHonestly(a)) {
      seconds += Number(a.duration_seconds);
      timedAttempts++;
    }
  }

  // Week buckets counting back from today, oldest first, so the bars read
  // left-to-right as time passing.
  const buckets = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = now - w * 7 * DAY_MS;
    const start = end - 7 * DAY_MS;
    const rows = attempts.filter(a => {
      const t = new Date(a.created_at).getTime();
      return t > start && t <= end;
    });
    buckets.push({
      weeksAgo: w,
      attempts: rows.length,
      questions: rows.reduce((s, r) => s + (Number(r.total_questions) || 0), 0),
      minutes: Math.round(
        rows.filter(timedHonestly).reduce((s, r) => s + Number(r.duration_seconds), 0) / 60)
    });
  }

  // Calendar days with at least one attempt, for the heatmap.
  const perDay = new Map();
  for (const a of attempts) {
    const k = dayKey(a.created_at);
    if (k) perDay.set(k, (perDay.get(k) || 0) + 1);
  }

  return {
    questions,
    minutes: Math.round(seconds / 60),
    timedAttempts,
    untimedAttempts: attempts.length - timedAttempts,
    // Per SITTING rather than per question: it is the number a student
    // recognises — "I usually do about twenty minutes".
    minutesPerSession: timedAttempts ? round(seconds / 60 / timedAttempts) : null,
    questionsPerAttempt: round(questions / attempts.length),
    weeks: buckets,
    days: [...perDay.entries()].map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day))
  };
}

// --- topic mastery ------------------------------------------------------

/** Attempts on a topic before its percentage is treated as a measurement. */
export const MASTERY_MIN_ASKED = 3;

/**
 * Per-topic mastery from recorded asked/correct counts.
 *
 * Takes rows from the topic_results table — {subject, grade, topic, asked,
 * correct, last_at} — NOT error rows. That distinction is the whole point: the
 * errors table records only mistakes, so a percentage derived from it would
 * have no denominator and every topic would read as 100% wrong.
 *
 * Topics asked fewer than MASTERY_MIN_ASKED times get `percent: null` and are
 * reported as "not enough data" rather than as a score, because one question is
 * a coin toss and the table's whole claim is that it can be trusted.
 */
export function topicMastery(rows, { minAsked = MASTERY_MIN_ASKED } = {}) {
  if (!rows || rows.length === 0) return [];
  return rows
    .map(r => {
      const asked = Number(r.asked) || 0;
      const correct = Number(r.correct) || 0;
      const enough = asked >= minAsked;
      return {
        topic: r.topic,
        subject: r.subject,
        grade: r.grade == null ? null : Number(r.grade),
        asked,
        correct,
        missed: Math.max(0, asked - correct),
        percent: enough && asked ? round((correct / asked) * 100) : null,
        lastAt: r.last_at || null
      };
    })
    .filter(r => r.asked > 0)
    // Weakest measurable topics first — the table is a worklist, not a record.
    // Unmeasured topics sit at the end rather than at the top, where a null
    // would otherwise sort as the worst score of all.
    .sort((a, b) => {
      if (a.percent == null && b.percent == null) return b.asked - a.asked;
      if (a.percent == null) return 1;
      if (b.percent == null) return -1;
      return a.percent - b.percent || b.asked - a.asked;
    });
}

// --- drill recovery -----------------------------------------------------

/**
 * What the reinforcement drills have earned back.
 *
 * `credited_points` accumulates on the attempt each drill credits, so this is a
 * record of ground recovered rather than an inference from the current score.
 * Returns null when nothing has been credited: a card reading "0 points
 * recovered" tells a student who has never drilled nothing they need.
 */
export function drillRecovery(attempts) {
  let points = 0;
  let credited = 0;
  for (const a of attempts) {
    const p = Number(a.credited_points) || 0;
    if (p <= 0) continue;
    points += p;
    credited++;
  }
  if (credited === 0) return null;

  const lostBefore = attempts.reduce((sum, a) => {
    const p = Number(a.credited_points) || 0;
    if (p <= 0) return sum;
    // What the attempt was missing before any drill touched it.
    return sum + ((Number(a.total_questions) || 0) - (Number(a.score) || 0) + p);
  }, 0);

  return {
    points: round(points),
    attempts: credited,
    // How much of the ground originally lost on those attempts is back.
    recoveredShare: lostBefore > 0 ? round((points / lostBefore) * 100) : 0
  };
}

// --- games ------------------------------------------------------------

/**
 * What a student's game history says about them.
 *
 * Grouped BY MODE and never pooled, because the five modes measure different
 * things and their scores are not on one scale: a ספרינט score grows with
 * however many questions fit in a minute, a דיוק score stops at the first
 * mistake. One combined "best score" would simply report whichever mode is
 * most generous and say nothing about the student.
 *
 * Accuracy IS comparable across modes — it is a ratio — so it is the one
 * cross-mode number reported.
 */
export function gameStats(rows) {
  if (!rows || rows.length === 0) return null;

  const byMode = new Map();
  let correct = 0;
  let wrong = 0;
  let seconds = 0;
  let bestStreak = 0;

  for (const row of rows) {
    const asked = Number(row.correct) + Number(row.wrong);
    correct += Number(row.correct);
    wrong += Number(row.wrong);
    seconds += Number(row.duration_seconds) || 0;
    bestStreak = Math.max(bestStreak, Number(row.best_streak) || 0);

    const entry = byMode.get(row.mode) || {
      mode: row.mode, runs: 0, bestScore: 0, bestStreak: 0, correct: 0, asked: 0, lastAt: null
    };
    entry.runs++;
    entry.bestScore = Math.max(entry.bestScore, Number(row.score) || 0);
    entry.bestStreak = Math.max(entry.bestStreak, Number(row.best_streak) || 0);
    entry.correct += Number(row.correct);
    entry.asked += asked;
    // Rows arrive newest first, so the first one seen for a mode is its latest.
    if (!entry.lastAt) entry.lastAt = row.created_at;
    byMode.set(row.mode, entry);
  }

  // Runs first, then recency. A student who has tried each mode once has no
  // favourite by count, and picking whichever the Map happened to see first
  // would report a preference they never expressed — so the tie goes to the one
  // they came back to last.
  const modes = [...byMode.values()]
    .map(m => ({ ...m, accuracy: m.asked ? Math.round((m.correct / m.asked) * 100) : 0 }))
    .sort((a, b) => b.runs - a.runs || String(b.lastAt).localeCompare(String(a.lastAt)));

  const asked = correct + wrong;
  return {
    runs: rows.length,
    modes,
    // The mode played most, which is the one a student actually chose.
    favourite: modes[0].mode,
    correct,
    asked,
    accuracy: asked ? Math.round((correct / asked) * 100) : 0,
    bestStreak,
    minutes: Math.round(seconds / 60)
  };
}
