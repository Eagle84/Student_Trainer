/**
 * Bootstrap and glue. The only module that imports both db and ui.
 * All interaction goes through one delegated click listener that dispatches
 * on data-action.
 */
import * as db from './db.js';
import * as ui from './ui.js';
import * as uiLesson from './ui-lesson.js';
import * as drawer from './ui-drawer.js';
import * as uiGame from './ui-game.js';
import { DEFAULT_SUBJECT, topicsFor, subjectsForGrade, gradelessSubjects, MIXED, NO_GRADE } from './subjects/index.js';
import { getLesson } from './lessons/index.js';
import { APP_VERSION } from './config.js';
import { whatsNewFor } from './whatsnew.js';
import {
  buildStudyQueue, createStudySession, currentStudyItem, isStudySessionOver,
  studyPosition, completeStudyItem, skipStudyItem, studyResult
} from './study-session.js';
import {
  createLessonState,
  currentCard,
  isLastCard,
  nextCard,
  prevCard,
  revealStep,
  answerCheck,
  unresolvedTopics,
  isWorthSaving,
  getProgressRecord
} from './lesson.js';
import {
  assembleQuiz,
  assembleMixed,
  assembleReinforcement,
  createQuiz,
  answerQuestion,
  nextQuestion,
  isFinished,
  answeredCount,
  currentQuestion,
  getResult,
  getErrorRows,
  topicsAssessed
} from './quiz.js';
import { questionFingerprint, isFullyCorrect } from './qtypes.js';
import { vibrateCorrect, setHapticsEnabled, hapticsSupported } from './haptics.js';
import {
  createGame, isGameOver, tickGame, answerGame, gameResult,
  MODES as GAME_MODES, MIN_LEVEL, MAX_LEVEL
} from './game.js';

let studentName = '';
let userId = null;
let authMode = 'login';
let subjectId = DEFAULT_SUBJECT;
/**
 * The subject the student has actually CHOSEN, or null if they have not chosen
 * one yet. Distinct from `subjectId` above, which is the quiz form's current
 * value and must always hold a real subject for the form to work.
 *
 * The side panel keys off this one. Reading it off the form instead meant the
 * panel announced "ההתקדמות שלך במתמטיקה" to a student who had never picked
 * maths — the form's default was being reported as the student's choice.
 */
let chosenSubject = null;
/** The grade that choice was made at, so the ring measures a reachable total. */
let chosenGrade = null;
let quiz = null;
// Cached history + error topics for the setup side panel, so switching subject
// re-renders per-subject progress without another round trip.
let setupData = null;
// Context of the last finished quiz, so we can build a reinforcement drill on
// the topics the student missed.
let lastContext = null;
/**
 * The attempt the drill in progress is re-testing, or null for an ordinary quiz.
 *
 * A drill finishes by crediting that attempt rather than inserting one of its
 * own, so a 10-question follow-up to a 100-question quiz raises the 100's score
 * instead of appearing beside it as a separate "10 / 10".
 *
 * Module state, but persisted with the quiz: a drill can be closed and resumed
 * like any other, and a resumed drill that had forgotten its target would
 * quietly go back to writing its own row.
 */
let creditTarget = null;
// Study mode. lessonState is the lesson being read; lessonReturn is the screen
// to go back to, because a lesson can be opened from four different places.
let lessonState = null;
let lessonReturn = 'setup-screen';
/**
 * The study session in progress, or null.
 *
 * A session owns the lesson screen while it runs: finishing a lesson advances
 * the queue instead of returning to the catalogue. Held here, next to
 * lessonState, because the two move together.
 */
let studySession = null;
/** What a stopped session had left, so "carry on" resumes rather than restarts. */
let studyLeftover = [];
/**
 * What the study surfaces are scoped to. Separate from the quiz settings form
 * on purpose: a student can be studying a topic from a grade below the one they
 * intend to be tested on, which is the whole point of catching up. Seeded from
 * the form the first time so it is never a surprising default.
 */
let studyScope = null;
/** Which study surface is on screen, so a scope change repaints the right one. */
let scopeHost = null;
// The option the student clicked on the quiz question currently on screen.
// answerQuestion does not record it, and restoring the quiz after a detour into
// a lesson needs it to repaint the marked answer.
let lastAnswerIndex = null;

// --- helpers ----------------------------------------------------------

function refreshBanner() {
  const pending = db.pendingCount();
  if (pending > 0) {
    ui.showBanner(`לא מחובר לשרת — ${pending} תוצאות ממתינות לסנכרון. הן יישלחו אוטומטית כשהחיבור יחזור.`);
  } else {
    ui.hideBanner();
  }
}

async function syncPending() {
  const flushed = await db.flushPending();
  refreshBanner();
  return flushed;
}

// --- actions ----------------------------------------------------------

function handleAuthMode(mode) {
  authMode = mode === 'register' ? 'register' : 'login';
  ui.setAuthMode(authMode);
}

async function handleAuthSubmit() {
  const { username, password, displayName } = ui.getAuthFields();
  if (username.length < 3 || !password) {
    ui.showAuthError('יש למלא שם משתמש (3+ תווים) וסיסמה.');
    return;
  }
  if (authMode === 'register' && !displayName) {
    ui.showAuthError('יש להזין שם לתצוגה.');
    return;
  }

  ui.setAuthBusy(true);
  const res = authMode === 'register'
    ? await db.signUp(username, password, displayName)
    : await db.signIn(username, password);
  ui.setAuthBusy(false);

  if (!res.ok) { ui.showAuthError(res.error); return; }
  enterApp(res.user);
}

/** Enters the app for a signed-in user. */
function enterApp(user) {
  userId = user.id;
  studentName = user.displayName || user.username;
  ui.clearAuthForm();
  ui.setWelcome(studentName);
  ui.showHeaderUser(studentName);
  ui.showScreen('setup-screen');
  syncPending();
  loadSetupSide();
  maybeShowWhatsNew();
}

/**
 * Shows the "מה חדש" popup once per release — and only to a student who has
 * been here before.
 *
 * A first-ever sign-in has no "before" to compare against, so greeting a
 * brand-new account with a changelog would be noise dressed as news; it
 * silently records the current version and shows nothing. Only a RETURNING
 * student whose remembered version differs from this one sees the popup.
 *
 * If nothing was written for this version — see WHATS_NEW in js/whatsnew.js,
 * which is not touched on every deploy, only on ones worth naming — it is
 * skipped just as quietly. Either way the version is recorded immediately, so
 * a missing entry is never retried and the popup can never show twice for the
 * same release, even across tabs opened before this one closes.
 */
function maybeShowWhatsNew() {
  const seen = db.getSeenVersion();
  db.rememberSeenVersion(APP_VERSION);
  // getSeenVersion() is db.js's readRaw(), whose "nothing stored" sentinel is
  // '' rather than null — matching that convention (see getLastSubject's own
  // caller in this file) rather than assuming null is what a fresh browser
  // reports. Getting this wrong would show a brand-new signup the popup on
  // their very first visit, which is exactly the noise this function exists
  // to prevent.
  if (!seen || seen === APP_VERSION) return;

  const entry = whatsNewFor(APP_VERSION);
  if (!entry) return;
  ui.renderWhatsNew(entry);
  ui.showWhatsNew();
}

function handleCloseWhatsNew() {
  ui.hideWhatsNew();
}

async function handleLogout() {
  await db.signOut();
  userId = null;
  studentName = '';
  quiz = null;
  abandonGame();
  ui.hideHeaderUser();
  ui.setAuthMode('login');
  ui.showScreen('auth-screen');
}

/** Loads the setup side panel (progress ring + weak topics) for the student. */
async function loadSetupSide() {
  if (!studentName) return;
  const [{ rows }, errorTopics, lessonProgress] = await Promise.all([
    db.getStudentHistory(studentName),
    db.getStudentErrorTopics(studentName),
    db.getLessonProgress()
  ]);
  setupData = { rows, errorTopics, lessonProgress };
  offerResume();
  ui.renderSetupSide(studentName, rows, errorTopics, chosenSubject, lessonProgress, chosenGrade, db.getClearedTopics());
}

/** Re-renders the side panel for the chosen subject, or for all of them. */
function refreshSetupSide() {
  if (setupData) ui.renderSetupSide(studentName, setupData.rows, setupData.errorTopics, chosenSubject, setupData.lessonProgress, chosenGrade, db.getClearedTopics());
}

/** Picks a subject from the tiles — mirrors the old <select> change. */
function handlePickSubject(elm) {
  const id = elm.dataset.subject;
  const sel = document.getElementById('subject-select');
  if (!sel) return;
  // Deliberately not short-circuited on an unchanged value: the first click may
  // land on the tile the form already defaults to, and that click is still the
  // moment the student CHOSE it — which is what the side panel waits for.
  const changed = sel.value !== id;
  sel.value = id;
  chosenSubject = id;
  chosenGrade = Number(ui.getGrade());
  ui.markSubjectTile(id);
  if (changed) handleChangeSubject();
  refreshSetupSide();
}

/** Picks a difficulty level from the pills. */
function handlePickLevel(elm) {
  ui.markLevelPill(elm.dataset.value);
}

/**
 * Builds and shows a quiz from an explicit configuration.
 *
 * Takes the config rather than reading the setup form, because two cards now
 * start quizzes with different controls: the quiz card has a grade and a track,
 * the "מקצועות נוספים" card has neither.
 */
async function startQuizWith({ subject, grade, count, difficulty, track }) {
  subjectId = subject;
  // Sitting a quiz on a subject is the strongest choice there is, so the side
  // panel is scoped to it by the time the student comes back.
  chosenSubject = subject;
  chosenGrade = Number(grade);
  db.rememberSubject(subject);

  ui.setStartButtonBusy(true);
  let bankRows;
  let recent;
  try {
    // In parallel: the window is now read from the server so it follows the
    // login across devices, and waiting for it in series would add a round trip
    // to the one this already pays for the bank.
    [bankRows, recent] = await Promise.all([
      db.fetchBankQuestions(subject, grade, difficulty, track),
      db.getRecentQuestions(subject, grade)
    ]);
  } finally {
    ui.setStartButtonBusy(false);
  }

  if (!db.isOnline()) {
    ui.showBanner('לא מחובר לשרת — המבחן ייווצר משאלות אוטומטיות בלבד, והתוצאות יישמרו מקומית.');
  } else {
    refreshBanner();
  }

  const questions = assembleQuiz(bankRows, subject, grade, count, difficulty, track, recent);
  rememberServed(questions, subject, grade);
  quiz = createQuiz(questions, studentName, subject, grade, difficulty, track);
  lastAnswerIndex = null;
  creditTarget = null;
  rememberQuiz();
  ui.setMixedMode(false);
  ui.showScreen('quiz-screen');
  ui.applySubjectDirection(subject);
  ui.renderQuestion(currentQuestion(quiz), quiz.index, quiz.questions.length, answeredCount(quiz));
}


/**
 * Starts a quiz drawing on every subject currently selected in the drawer.
 *
 * Recorded as one attempt under the MIXED pseudo-subject: one sitting is one
 * score. Each question keeps its own subject, so every mistake is filed under
 * the subject it actually came from and the weak-topic chips still drill
 * something real.
 *
 * Bank rows and the recent-question window are fetched per subject and in
 * parallel — they are separate scopes on the server, and doing them in series
 * would multiply the wait by the number of subjects chosen.
 */
async function handleStartMixedQuiz() {
  const scope = currentScope();
  const offered = subjectsForGrade(scope.grade);
  const subjects = uiLesson.selectedSubjects(scope).filter(id => offered.includes(id));
  if (subjects.length < 2) return;

  const grade = scope.grade;
  const count = ui.getQuestionCount();
  const difficulty = ui.getDifficulty();

  drawer.closeDrawer();
  ui.setStartButtonBusy(true);
  let plan = [];
  try {
    plan = await Promise.all(subjects.map(async id => {
      const [bankRows, recent] = await Promise.all([
        db.fetchBankQuestions(id, grade, difficulty, scope.track),
        db.getRecentQuestions(id, grade)
      ]);
      return { subjectId: id, grade, bankRows, recent, track: scope.track };
    }));
  } finally {
    ui.setStartButtonBusy(false);
  }

  const questions = assembleMixed(plan, count, difficulty, scope.track);
  if (questions.length === 0) {
    ui.showBanner('אין שאלות זמינות למקצועות שנבחרו.');
    return;
  }

  // Remembered per subject, not under MIXED: the window is what stops a
  // repeat next time מתמטיקה is quizzed, whether or not that quiz is mixed.
  for (const id of subjects) {
    rememberServed(questions.filter(q => q.subject === id), id, grade);
  }

  quiz = createQuiz(questions, studentName, MIXED, grade, difficulty, scope.track);
  lastAnswerIndex = null;
  rememberQuiz();
  ui.setMixedMode(true);
  ui.showScreen('quiz-screen');
  // No quiz-wide direction to set: renderQuestion applies each question's own,
  // because the subjects here disagree about it.
  ui.renderQuestion(currentQuestion(quiz), quiz.index, quiz.questions.length, answeredCount(quiz));
}

// --- games -------------------------------------------------------------

/** The sprint in progress, its interval handle, and when the question appeared. */
let game = null;
let gameTimer = null;
let questionShownAt = 0;
/** When the clock was last advanced, so a tick measures REAL elapsed time. */
let lastTickAt = 0;

/** The subject and mode picked in the games card. */
let gameSubject = DEFAULT_SUBJECT;
let gameMode = 'sprint';

function stopGameClock() {
  if (gameTimer != null) { clearInterval(gameTimer); gameTimer = null; }
}

/** Drops the run in progress without posting it. Safe to call at any time. */
function abandonGame() {
  stopGameClock();
  game = null;
}

function handleGameMode(button) {
  gameMode = button.dataset.mode;
  ui.markGameMode(gameMode);
}

function handleGameSubject(button) {
  gameSubject = button.dataset.subject;
  ui.markGameTile(gameSubject);
  ui.populateGameGrades(gameSubject);
}

/**
 * Starts a sprint.
 *
 * The whole question pool is built up front. Generating mid-run would put an
 * unpredictable pause inside a timed game, which is the one place a stall is
 * unforgivable — and the clock would keep running through it.
 */
/**
 * Starts a game.
 *
 * The whole question pool is built up front. Generating mid-run would put an
 * unpredictable pause inside a timed game, which is the one place a stall is
 * unforgivable — and the clock would keep running through it.
 *
 * טיפוס needs a pool PER LEVEL, because it asks for a specific level next
 * rather than drawing from one flat list.
 */
async function handleStartSprint() {
  const subject = gameSubject;
  const mode = gameMode;
  const rules = GAME_MODES[mode] || GAME_MODES.sprint;
  const grade = ui.getGameGrade();
  const difficulty = rules.climbs ? null : ui.getGameDifficulty();

  const [bankRows, recent] = await Promise.all([
    db.fetchBankQuestions(subject, grade, difficulty),
    db.getRecentQuestions(subject, grade)
  ]);

  let source;
  if (rules.climbs) {
    source = {};
    let total = 0;
    for (let level = MIN_LEVEL; level <= MAX_LEVEL; level++) {
      source[level] = assembleQuiz(bankRows.filter(r => Number(r.difficulty) === level),
        subject, grade, 12, level, null, recent);
      total += source[level].length;
    }
    if (total === 0) { ui.showBanner('אין שאלות זמינות לצירוף הזה.'); return; }
  } else {
    // Sixty seconds at a brisk two seconds a question is thirty; sixty is ample
    // headroom, and running out ends the run gracefully either way.
    source = assembleQuiz(bankRows, subject, grade, 60, difficulty, null, recent);
    if (source.length === 0) { ui.showBanner('אין שאלות זמינות לצירוף הזה.'); return; }
  }

  game = createGame(source, { mode, studentName, subject, grade, difficulty });
  ui.showScreen('game-screen');
  ui.applySubjectDirection(subject);
  uiGame.clearFlash();
  uiGame.renderGameHud(game);
  uiGame.renderGameQuestion(game);
  rememberGameQuestion(game);
  questionShownAt = Date.now();

  stopGameClock();
  lastTickAt = Date.now();
  // Ticks every 100ms so the bar glides, but the clock is driven by REAL
  // elapsed time rather than by counting ticks.
  //
  // Browsers throttle setInterval in a hidden tab — often to a stop. Counting
  // ticks therefore meant backgrounding the tab froze the clock, so a player
  // could take as long as they liked and still post a sixty-second score. On a
  // leaderboard that is not a glitch, it is a way to win. Measuring the wall
  // clock means time away is time spent, and the run ends the moment the
  // student comes back.
  gameTimer = setInterval(() => {
    if (!game) return stopGameClock();
    const now = Date.now();
    const before = game.timeLeftMs;
    game = tickGame(game, now - lastTickAt);
    lastTickAt = now;
    // A per-question clock that ran out costs a life and moves on, so the new
    // question has to be drawn.
    if (game.timedOut && game.timeLeftMs > before) {
      uiGame.flashTimeout();
      if (!isGameOver(game)) {
        uiGame.renderGameQuestion(game);
        rememberGameQuestion(game);
        questionShownAt = Date.now();
      }
    }
    uiGame.renderGameHud(game);
    if (isGameOver(game)) finishGame();
  }, 100);
}

function handleGameAnswer(optionIndex) {
  if (!game || isGameOver(game)) return;
  const answerMs = Date.now() - questionShownAt;
  const paidBefore = game.penaltyMs;

  const wasCorrect = game.correct;
  game = answerGame(game, optionIndex, answerMs);
  if (game.correct > wasCorrect) vibrateCorrect();
  lastTickAt = Date.now();   // a per-question clock just restarted
  // Read the penalty that was actually charged rather than inferring one from
  // the clock going down: in הישרדות the next question's clock is shorter than
  // this one's, so a fast answer lowers the number without any penalty at all.
  if (game.penaltyMs > paidBefore) uiGame.flashPenalty(Math.round((game.penaltyMs - paidBefore) / 1000));

  uiGame.renderGameHud(game);
  if (isGameOver(game)) { finishGame(); return; }
  uiGame.renderGameQuestion(game);
  rememberGameQuestion(game);
  questionShownAt = Date.now();
}

/**
 * Records the question a game just showed.
 *
 * Per question rather than per game: a ספרינט is built from a pool of sixty and a
 * good run reaches maybe thirty, so recording the pool up front would spend the
 * window on questions the student never saw.
 */
function rememberGameQuestion(state) {
  const question = state && state.current;
  if (question) db.rememberQuestions(state.subject, state.grade, [questionFingerprint(question)]);
}

async function finishGame() {
  stopGameClock();
  if (!game) return;
  const result = gameResult(game);
  const { subject, difficulty, mode } = game;
  game = null;

  ui.showScreen('game-over-screen');
  uiGame.renderGameOver(result, 'שומר תוצאה...');
  uiGame.renderGameBoard([], { mode, subject, difficulty, studentName });

  const { saved } = await db.saveGameScore(result);
  uiGame.renderGameOver(result, saved
    ? 'התוצאה נשמרה בטבלה.'
    : 'לא ניתן להתחבר לשרת — התוצאה תישלח אוטומטית כשהחיבור יחזור.');
  uiGame.renderGameBoard(await db.getGameBoard(mode, subject, difficulty), { mode, subject, difficulty, studentName });
}

/** Leaves a game early. The run is abandoned, not posted. */
function handleQuitGame() {
  handleReturnToSetup();
}

/** The board from the setup card, without playing first. */
async function handleShowGameBoard() {
  const subject = gameSubject;
  const mode = gameMode;
  const rules = GAME_MODES[mode] || GAME_MODES.sprint;
  const difficulty = rules.climbs ? null : ui.getGameDifficulty();
  ui.showScreen('game-over-screen');
  document.getElementById('game-over-title').textContent = 'טבלת השיאים';
  uiGame.renderGameOver({ mode, subject, grade: ui.getGameGrade(), difficulty, score: 0, correct: 0, accuracy: 0, best_streak: 0 }, '');
  document.getElementById('game-over-stats').hidden = true;
  uiGame.renderGameBoard(await db.getGameBoard(mode, subject, difficulty), { mode, subject, difficulty, studentName });
}

// --- resuming an unfinished quiz --------------------------------------

/**
 * Records what a quiz just served, so the next one asks something else.
 *
 * js/quiz.js already stops a question repeating inside one quiz. It could not
 * know what an EARLIER quiz asked, because every quiz began with an empty
 * memory — which is what the kids were seeing. This closes that gap; db.js keeps
 * the window and caps it.
 */
function rememberServed(questions, sid, grade) {
  db.rememberQuestions(sid, grade, questions.map(questionFingerprint));
}

/** Paints the quiz screen for the current state, feedback included. */
function showCurrentQuestion() {
  const question = currentQuestion(quiz);
  ui.setMixedMode(quiz.subject === MIXED);
  ui.showScreen('quiz-screen');
  ui.applySubjectDirection(quiz.subject);
  ui.renderQuestion(question, quiz.index, quiz.questions.length, answeredCount(quiz));
  // Closed while reading the feedback: restore the marked answer rather than a
  // blank question the student has in fact already answered.
  if (quiz.answered && lastAnswerIndex != null) {
    ui.renderAnswerResult(question, lastAnswerIndex);
    offerLesson(question, lastAnswerIndex);
  }
}

/** Offers the unfinished quiz, if there is one worth offering. */
const resumeInfo = entry => ({
  id: String(entry.quiz.startedAt),
  subject: entry.quiz.subject,
  grade: entry.quiz.grade,
  answered: entry.quiz.index,
  total: entry.quiz.questions.length,
  savedAt: entry.savedAt
});

/**
 * Offers every unfinished quiz.
 *
 * Painted twice, like the topic catalogue: the local set first so the card is
 * never blank while the network is slow, then the merged set once the server
 * answers — which is what makes a quiz begun on a laptop show up on a phone.
 */
async function offerResume() {
  if (!studentName) return;
  ui.renderResume(db.getLocalActiveQuizzes(studentName).map(resumeInfo));
  ui.renderResume((await db.getActiveQuizzes(studentName)).map(resumeInfo));
}

async function handleResumeQuiz(button) {
  const saved = await db.getActiveQuiz(studentName, button && button.dataset.quizId);
  if (!saved || !saved.quiz) { offerResume(); return; }
  quiz = saved.quiz;
  lastAnswerIndex = saved.lastAnswerIndex ?? null;
  creditTarget = saved.creditTarget ?? null;
  subjectId = quiz.subject;
  chosenSubject = quiz.subject;
  chosenGrade = quiz.grade;
  ui.renderResume([]);
  showCurrentQuestion();
}

function handleDiscardResume(button) {
  db.clearActiveQuiz(button && button.dataset.quizId);
  offerResume();
}

async function handleStartQuiz() {
  await startQuizWith({
    subject: ui.getSubjectId(),
    grade: ui.getGrade(),
    count: ui.getQuestionCount(),
    difficulty: ui.getDifficulty(),
    track: ui.getTrack()
  });
}

function handleChangeSubject() {
  subjectId = ui.getSubjectId();
  ui.populateGrades(subjectId);
  // populateGrades may land on a different grade, so resolve the track picker
  // from what the grade select actually holds now.
  ui.populateTracks(subjectId, ui.getGrade());
}

function handleChangeGrade() {
  ui.populateTracks(ui.getSubjectId(), ui.getGrade());
  // Only once a subject has been chosen: before that the panel is deliberately
  // showing everything, and a grade alone should not narrow it.
  if (chosenSubject) { chosenGrade = Number(ui.getGrade()); refreshSetupSide(); }
}

/**
 * A click on an option.
 *
 * For a single-answer question the click IS the answer, so it grades straight
 * away — the original behaviour. For a cloze, multi-select or passage question
 * it only records a selection: there is no click that unambiguously means "I
 * have finished choosing", so those are graded by handleSubmitAnswer.
 */
/**
 * Persists the quiz in progress.
 *
 * Called after every mutation rather than on unload: `beforeunload` does not
 * fire reliably when a mobile browser is swiped away or the tab is discarded
 * under memory pressure, which is exactly the case this feature exists for.
 *
 * lastAnswerIndex rides along because it is not part of the quiz state but is
 * what repaints the marked answer — without it, a student who closed the tab
 * while reading the feedback would come back to a blank question.
 */
function rememberQuiz() {
  if (quiz && !isFinished(quiz)) db.saveActiveQuiz(quiz, { lastAnswerIndex, creditTarget });
}

function handleOptionClick(partIndex, optionIndex) {
  if (!quiz || quiz.answered) return;
  const question = currentQuestion(quiz);

  if (question.parts) {
    ui.selectOption(question, partIndex, optionIndex);
    return;
  }
  quiz = answerQuestion(quiz, optionIndex);
  lastAnswerIndex = optionIndex;
  if (optionIndex === question.correctIdx) vibrateCorrect();
  rememberQuiz();
  ui.renderAnswerResult(question, optionIndex);
  ui.setProgress(answeredCount(quiz), quiz.questions.length);
  offerLesson(question, optionIndex);
}

/** Adds "learn this topic" to the feedback box after a wrong answer — but only
 *  when a lesson actually exists, so the offer is never a dead end. */
function offerLesson(question, optionIndex) {
  const wrong = optionIndex !== question.correctIdx;
  const available = wrong && getLesson(quiz.subject, quiz.grade, question.topic);
  ui.setFeedbackLearn(available ? question.topic : null, quiz.subject, quiz.grade);
}

/** Grades a multi-part question once every part has a selection. */
function handleSubmitAnswer() {
  if (!quiz || quiz.answered) return;
  const question = currentQuestion(quiz);
  if (!question.parts) return;

  const answers = ui.getPendingAnswers();
  quiz = answerQuestion(quiz, answers);
  // Only for a clean sweep. A multi-part question scores in fractions, and
  // buzzing for three parts out of four would tell the student they were right
  // when they were not.
  if (isFullyCorrect(question, answers)) vibrateCorrect();
  ui.renderAnswerResult(question, answers);
  ui.setProgress(answeredCount(quiz), quiz.questions.length);
}

async function handleNextQuestion() {
  if (!quiz || !quiz.answered) return;
  quiz = nextQuestion(quiz);

  if (isFinished(quiz)) {
    await finishQuiz();
    return;
  }
  lastAnswerIndex = null;
  rememberQuiz();
  ui.renderQuestion(currentQuestion(quiz), quiz.index, quiz.questions.length, answeredCount(quiz));
}

async function finishQuiz() {
  const result = getResult(quiz);
  const errors = getErrorRows(quiz);
  // Finished: there is nothing left to resume into. Dropped before the save so
  // a failed save cannot leave a completed quiz being offered as unfinished.
  // By id, so finishing one quiz does not discard the others still waiting.
  db.clearActiveQuiz(quiz.startedAt);

  // Topics answered cleanly are recorded BEFORE the panel reloads, so a
  // student who has just drilled a chip sees it gone when they get back.
  const assessed = topicsAssessed(quiz);
  db.markTopicsAssessed(result.subject, result.grade, assessed);
  // The same tallies, to the server this time, where they accumulate into the
  // asked/correct counts the mastery table reads. The local copy above answers
  // "is this chip still weak" on this device; this one is the durable record.
  db.recordTopicResults(result.subject, result.grade, assessed);

  const wrongTopics = [...new Set(errors.map(e => e.topic))];
  const drilled = creditTarget;

  ui.showScreen('summary-screen');
  ui.renderSummary(result, errors, 'שומר תוצאות...');
  ui.setPracticeWeak(wrongTopics.length);

  // A drill credits the attempt it re-tested instead of writing one of its own.
  // Chained drills keep pointing at that same attempt, so drilling three times
  // in a row walks one score up rather than leaving three short quizzes behind.
  const outcome = drilled
    ? await db.creditAttempt(drilled, drillFraction(result), errors)
    : await db.saveAttempt(result, errors);

  lastContext = {
    subjectId: result.subject, grade: result.grade, difficulty: result.difficulty,
    topics: wrongTopics, wrongCount: errors.length,
    attemptId: drilled ?? outcome.attemptId ?? null
  };
  creditTarget = null;

  ui.renderSummary(result, errors, saveMessage(outcome, Boolean(drilled)));

  if (outcome.saved) await syncPending();
  else refreshBanner();
}

/** A drill's share of its own questions, which is the share of the original
 *  attempt's lost points it earns back. See creditedAttempt in js/quiz.js. */
function drillFraction(result) {
  return result.total_questions === 0 ? 0 : result.score / result.total_questions;
}

function saveMessage(outcome, credited) {
  if (!outcome.saved) {
    return 'לא ניתן להתחבר לשרת — התוצאות נשמרו מקומית ויסונכרנו אוטומטית.';
  }
  if (!credited) return 'התוצאות נשמרו בהצלחה.';
  // Says which number moved. Without it the student sees a drill score of
  // 18 / 20 and no sign that the quiz they were fixing changed at all.
  return `הציון במבחן המקורי עודכן ל-${Math.round(outcome.score)} מתוך ${outcome.total_questions} (${Math.round(outcome.percent)}%).`;
}

function handleConfirmRestart() {
  // Every answer already persists the quiz via rememberQuiz(), so leaving here
  // does not lose it — it is the same "unfinished quiz" the resume card offers
  // after a closed tab or a dead battery. Explicitly discarding a quiz is
  // handleDiscardResume's job, not this one's: a student who stops mid-quiz to
  // go check something else should come back to it, not have to redo it.
  if (window.confirm('לעצור את המבחן ולחזור למסך ההגדרות? ההתקדמות שלך תישמר, ותוכל להמשיך אותו מאוחר יותר.')) {
    quiz = null;
    lastAnswerIndex = null;
    creditTarget = null;
    ui.showScreen('setup-screen');
    loadSetupSide();
  }
}

/**
 * Home: the setup screen with BOTH path cards collapsed.
 *
 * Collapsing matters. Leaving the study card expanded meant "back to the main
 * screen" landed on something that still looked like the study screen, so there
 * was no way to get back to the plain choice between the two paths.
 */
function handleReturnToSetup(openMode = null) {
  quiz = null;
  creditTarget = null;
  // A game left by any route is ABANDONED, not finished.
  //
  // The clock is an interval, so leaving without stopping it left the run
  // ticking in the background — and when it hit zero it posted a score for a
  // game the student had walked away from. Boards filled with runs nobody
  // played. Home, the header button and signing out all pass through here.
  abandonGame();
  scopeHost = null;
  ui.showScreen('setup-screen');
  ui.collapseModes();
  if (openMode) {
    const head = document.querySelector(`.mode-head[data-mode="${openMode}"]`);
    if (head) handlePickMode(head);
  }
  loadSetupSide();
}

/** Starts a drill on the wrong topics of a specific past attempt, from the
 *  "my history" table. */
async function handlePracticeAttempt(button) {
  const attemptId = Number(button.dataset.attemptId);
  const sid = button.dataset.subject;
  const grade = Number(button.dataset.grade);
  const difficulty = button.dataset.difficulty ? Number(button.dataset.difficulty) : null;

  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'טוען...';
  const errors = await db.getAttemptErrors(attemptId);
  button.disabled = false;
  button.textContent = original;

  const topics = [...new Set(errors.map(e => e.topic))];
  if (topics.length === 0) {
    ui.showBanner('לא נמצאו שגיאות לחיזוק במבחן זה.');
    return;
  }

  const count = errors.length;
  const [bankRows, recent] = await Promise.all([
    db.fetchBankQuestions(sid, grade, difficulty),
    db.getRecentQuestions(sid, grade)
  ]);
  startDrill(assembleReinforcement(bankRows, sid, grade, topics, count, difficulty, null, recent),
    sid, grade, difficulty, 'את הנושאים האלה', attemptId);
}

/**
 * Starts a drill, or explains why it cannot.
 *
 * assembleReinforcement no longer pads a drill with unrelated topics, so it can
 * legitimately come back short or empty — a topic recorded at one grade may not
 * be producible at another. Starting a quiz with those questions was the old
 * behaviour and it was worse than saying nothing: the student drilled something
 * else entirely, and the topic they were trying to fix stayed on their weak
 * list. Mistakes on the filler even added new weak topics they never chose.
 */
function startDrill(questions, sid, grade, difficulty, what, attemptId = null) {
  if (questions.length === 0) {
    ui.showBanner(`אי אפשר לתרגל כרגע ${what} ב${ui.gradeName(grade)}. נסה נושא אחר, או את אותו נושא בכיתה שבה נלמד.`);
    return false;
  }
  subjectId = sid;
  rememberServed(questions, sid, grade);
  quiz = createQuiz(questions, studentName, sid, grade, difficulty);
  lastAnswerIndex = null;
  // Null when the attempt could not be identified — an attempt that never
  // reached the server, or a chip whose topic has no unfixed attempt behind it.
  // The drill then saves itself as an ordinary quiz, which is the old behaviour.
  creditTarget = attemptId ?? null;
  rememberQuiz();
  ui.setMixedMode(false);
  ui.showScreen('quiz-screen');
  ui.applySubjectDirection(sid);
  ui.renderQuestion(currentQuestion(quiz), quiz.index, quiz.questions.length, answeredCount(quiz));
  return true;
}

/** Starts a drill on a single topic clicked in the dashboard's weak-topics list. */
async function handlePracticeTopic(button) {
  const topic = button.dataset.topic;
  const sid = button.dataset.subject;
  const grade = Number(button.dataset.grade);
  if (!topic || !sid || !grade) return;

  // A chip is not launched from an attempt, so the one to credit is looked up:
  // the student's most recent attempt at this subject and grade that missed
  // this topic and has not already been drilled back to full marks.
  const [bankRows, recent, attemptId] = await Promise.all([
    db.fetchBankQuestions(sid, grade, null),
    db.getRecentQuestions(sid, grade),
    db.findDrillTarget(sid, grade, topic)
  ]);
  startDrill(assembleReinforcement(bankRows, sid, grade, [topic], 10, null, null, recent),
    sid, grade, null, `את "${topic}"`, attemptId);
}

/** Starts a focused drill on the topics the student just got wrong. */
async function handlePracticeWeak() {
  if (!lastContext || lastContext.topics.length === 0) return;
  const { subjectId: sid, grade, difficulty, topics, wrongCount, attemptId } = lastContext;
  const count = wrongCount;

  const [bankRows, recent] = await Promise.all([
    db.fetchBankQuestions(sid, grade, difficulty),
    db.getRecentQuestions(sid, grade)
  ]);
  startDrill(assembleReinforcement(bankRows, sid, grade, topics, count, difficulty, null, recent),
    sid, grade, difficulty, 'את הנושאים שטעית בהם', attemptId);
}

// --- study scope ------------------------------------------------------

/** The study scope, seeded from the quiz settings form on first use. */
function currentScope() {
  if (!studyScope) {
    const subjectId = ui.getSubjectId();
    // The remembered multi-selection, narrowed to subjects that still teach
    // this grade. Anything left over from another grade is dropped rather than
    // silently selecting a subject with nothing behind it.
    const grade = Number(ui.getGrade());
    const offered = subjectsForGrade(grade);
    const saved = db.getStudySubjects().filter(id => offered.includes(id));
    studyScope = {
      grade,
      subjectId,
      subjects: saved.length ? saved : [subjectId],
      track: ui.getTrack()
    };
  }
  return studyScope;
}

/**
 * Adds or removes a subject from the study selection.
 *
 * The last one cannot be removed: an empty selection has nothing to show and no
 * obvious recovery, so the final chip is inert rather than clearing the drawer.
 * `subjectId` tracks the first selected subject, because every single-subject
 * surface still reads it.
 */
async function handleStudySubjectToggle(button) {
  const scope = currentScope();
  const id = button.dataset.subject;
  const current = uiLesson.selectedSubjects(scope);
  const next = current.includes(id)
    ? current.filter(x => x !== id)
    : [...current, id];
  if (next.length === 0) return;

  scope.subjects = next;
  scope.subjectId = next[0];
  db.rememberStudySubjects(next);
  await refreshScopeSurface();
}

/** Repaints whichever study surface is showing, plus its scope picker. */
async function refreshScopeSurface() {
  const scope = currentScope();
  if (scopeHost === 'setup') {
    uiLesson.renderScopePicker(document.getElementById('setup-scope'), scope, { host: 'setup' });
  } else if (scopeHost === 'drawer') {
    uiLesson.renderScopePicker(document.getElementById('drawer-scope'), scope,
      { host: 'drawer', multi: true });
    drawer.renderDrawer(scope, new Map());
    drawer.renderDrawer(scope, await db.getLessonProgress());
  } else if (scopeHost === 'learn') {
    uiLesson.renderScopePicker(document.getElementById('learn-scope'), scope, { multi: true });
    uiLesson.renderCatalogFor(scope, new Map());
    uiLesson.renderCatalogFor(scope, await db.getLessonProgress());
  }
}

/**
 * Picks the study grade. The subject may not survive it: a subject that does
 * not teach the new grade is replaced by the first that does, rather than left
 * selected with nothing behind it.
 */
function handleStudyGrade(select) {
  const scope = currentScope();
  scope.grade = Number(select.value);
  // Tracks only exist in grades 10-12; carrying one down to grade 7 would
  // filter generators that never declared a track in the first place.
  scope.track = scope.grade >= 10 ? scope.track : null;
  const available = subjectsForGrade(scope.grade);
  if (!available.includes(scope.subjectId)) scope.subjectId = available[0] || DEFAULT_SUBJECT;
  if (chosenSubject) {
    chosenSubject = scope.subjectId;
    chosenGrade = scope.grade;
    refreshSetupSide();
  }
  refreshScopeSurface();
}

function handleStudySubjectSingle(button) {
  const scope = currentScope();
  scope.subjectId = button.dataset.subject;
  // Picking a subject to study is a choice like any other, so the side panel
  // narrows to it too — otherwise the student picks English on the study card
  // and the panel beside it keeps reporting on everything.
  chosenSubject = scope.subjectId;
  chosenGrade = Number(scope.grade);
  refreshSetupSide();
  refreshScopeSurface();
}

// --- gradeless subjects ("מקצועות נוספים") ----------------------------

/**
 * The subject selected in the extra card.
 *
 * Kept separate from the quiz card's `subjectId` and from the study scope: all
 * three can legitimately hold different subjects at once, and sharing one
 * variable would make opening one card silently rewrite the other two.
 */
let extraSubject = gradelessSubjects()[0];

function handleExtraSubject(button) {
  extraSubject = button.dataset.subject;
  chosenSubject = extraSubject;
  chosenGrade = NO_GRADE;
  ui.markExtraTile(extraSubject);
  refreshSetupSide();
}

/** Opens one gradeless subject's catalogue straight from the drawer. */
async function handleExtraOpen(button) {
  extraSubject = button.dataset.subject;
  chosenSubject = extraSubject;
  ui.markExtraTile(extraSubject);
  handleCloseDrawer();
  await handleExtraStudy();
}

/** Opens the catalogue for the selected gradeless subject. */
async function handleExtraStudy() {
  studyScope = { grade: NO_GRADE, subjectId: extraSubject, track: null };
  await handleShowLearn();
}

/** Starts a quiz on the selected gradeless subject. */
async function handleExtraQuiz() {
  await startQuizWith({
    subject: extraSubject,
    grade: NO_GRADE,
    count: ui.getExtraCount(),
    difficulty: ui.getExtraDifficulty(),
    // Tracks are a יחידות לימוד axis in the upper school grades. Nothing
    // gradeless has one.
    track: null
  });
}

// --- drawer -----------------------------------------------------------

/** Opens the topic drawer, scoped to the study grade and subject. */
async function handleOpenDrawer(button) {
  scopeHost = 'drawer';
  drawer.openDrawer(button);
  ui.setMenuExpanded(true);
  await refreshScopeSurface();
}

function handleCloseDrawer() {
  drawer.closeDrawer();
  ui.setMenuExpanded(false);
  if (scopeHost !== 'drawer') return;
  // The drawer can be opened on top of the catalogue. Handing the scope back to
  // it — rather than clearing it — is what keeps the catalogue's own picker live
  // after the drawer closes, and repaints it if the scope changed inside.
  if (document.getElementById('learn-screen')?.classList.contains('active')) {
    scopeHost = 'learn';
    refreshScopeSurface();
  } else {
    scopeHost = null;
  }
}

/**
 * Expands one of the two path cards and collapses the other.
 *
 * An accordion rather than two independently-open panels: the paths are
 * alternatives, and showing both sets of settings at once is the flat form this
 * screen replaced. Clicking the open one closes it, back to a clean choice.
 */
function handlePickMode(head) {
  const mode = head.dataset.mode;
  const wasOpen = head.getAttribute('aria-expanded') === 'true';

  for (const card of document.querySelectorAll('.mode-card')) {
    const cardHead = card.querySelector('.mode-head');
    const body = card.querySelector('.mode-body');
    const open = !wasOpen && cardHead.dataset.mode === mode;
    cardHead.setAttribute('aria-expanded', String(open));
    card.classList.toggle('open', open);
    body.hidden = !open;
  }

  if (wasOpen || mode !== 'study') {
    if (scopeHost === 'setup') scopeHost = null;
    return;
  }
  // The study card owns the grade/subject picker, so it is built the moment
  // that card opens rather than kept in the DOM behind a hidden panel.
  scopeHost = 'setup';
  refreshScopeSurface();
}

// --- study mode -------------------------------------------------------

/**
 * Opens the topic catalogue, scoped to the study grade and subject.
 *
 * refreshScopeSurface renders twice: once immediately from local data, then
 * again with the studied ticks. The topic list is computed locally and is
 * instant, and blocking the whole catalogue on a round trip would leave the
 * student looking at an empty screen for as long as the network takes.
 */
async function handleShowLearn() {
  // Reachable from the drawer as well as the home screen now, and the drawer is
  // modal — leaving it open would put the catalogue behind a scrim.
  drawer.closeDrawer();
  scopeHost = 'learn';
  ui.showScreen('learn-screen');
  await refreshScopeSurface();
}

/**
 * Starts a study session over everything selected.
 *
 * Skips lessons already finished — a student pressing "learn" wants the next
 * thing, not a tour of what they have done. If that empties the queue, it says
 * so and offers the whole list again rather than opening an empty session.
 */
async function handleStartStudySession(button) {
  const scope = currentScope();
  const offered = subjectsForGrade(scope.grade);
  const subjects = uiLesson.selectedSubjects(scope).filter(id => offered.includes(id));
  if (subjects.length === 0) return;

  drawer.closeDrawer();
  const progress = await db.getLessonProgress();
  const done = new Set();
  for (const [id, record] of progress) {
    if (record && record.completed) done.add(id);
  }

  const perSubject = subjects.map(id => ({
    subjectId: id,
    grade: scope.grade,
    topics: topicsFor(id, scope.grade, scope.track)
  }));

  const opts = {
    hasLesson: (sid, grade, topic) => Boolean(getLesson(sid, grade, topic)),
    isDone: (sid, grade, topic) => {
      const lesson = getLesson(sid, grade, topic);
      return Boolean(lesson && done.has(lesson.id));
    },
    // The button says "revise" once everything is finished.
    includeDone: button && button.dataset.includeDone === '1'
  };

  let queue = buildStudyQueue(perSubject, opts);
  if (queue.length === 0) {
    queue = buildStudyQueue(perSubject, { ...opts, includeDone: true });
    if (queue.length === 0) {
      ui.showBanner('אין עדיין שיעורים למקצועות שנבחרו.');
      return;
    }
    ui.showBanner('סיימת את כל השיעורים כאן — מתחילים סבב חזרה.');
  }

  studySession = createStudySession(queue);
  openCurrentStudyLesson();
}

/** Opens whatever the session is pointing at, or ends it. */
function openCurrentStudyLesson() {
  const item = currentStudyItem(studySession);
  if (!item) { finishStudySession(); return; }
  openLesson(item.subjectId, item.grade, item.topic, 'study-session');
}

/** Credits the lesson on screen and moves to the next one. */
function advanceStudySession() {
  saveLessonProgress();
  studySession = completeStudyItem(studySession);
  openCurrentStudyLesson();
}

function handleStudySkip() {
  if (!studySession) return;
  saveLessonProgress();
  studySession = skipStudyItem(studySession);
  openCurrentStudyLesson();
}

function handleStudyStop() {
  if (!studySession) return;
  saveLessonProgress();
  finishStudySession();
}

/** Ends the session and reports what it covered. */
function finishStudySession() {
  const result = studyResult(studySession);
  const leftover = studySession ? studySession.items.slice(studySession.index) : [];
  lessonState = null;
  uiLesson.resetLessonPaint();
  uiLesson.renderStudyBar(null);
  studySession = null;
  // Kept so "carry on from here" can rebuild the queue exactly where it stopped,
  // rather than recomputing it and landing somewhere else.
  studyLeftover = leftover;
  uiLesson.renderStudyDone(result);
  ui.showScreen('study-done-screen');
}

/** Resumes a stopped session from exactly where it was left. */
function handleStudyAgain() {
  if (!studyLeftover.length) { handleReturnToSetup(); return; }
  studySession = createStudySession(studyLeftover);
  studyLeftover = [];
  openCurrentStudyLesson();
}

/**
 * Opens a lesson. `returnTo` is the screen the close button goes back to,
 * because a lesson is reachable from the catalogue, the setup panel, the
 * summary and mid-quiz, and each wants a different way out.
 */
function openLesson(sid, grade, topic, returnTo) {
  const lesson = getLesson(sid, grade, topic);
  if (!lesson) {
    ui.showBanner(`עדיין אין שיעור לנושא "${topic}". אפשר לתרגל אותו בינתיים.`);
    return;
  }
  lessonState = createLessonState(lesson, { grade, topic });
  lessonReturn = returnTo;
  // The step reveal updates the card in place, so the record of what is painted
  // must be cleared before a different lesson claims the same surface.
  uiLesson.resetLessonPaint();
  ui.showScreen('lesson-screen');
  renderLessonCard();
  uiLesson.renderStudyBar(studySession ? studyPosition(studySession) : null);
}

function renderLessonCard() {
  if (!lessonState) return;
  uiLesson.renderLesson(lessonState);
  // After renderLesson, which is what hides the next button at the recap.
  uiLesson.showStudyAdvance(Boolean(studySession), isLastCard(lessonState));
}

function handleOpenLesson(button) {
  const topic = button.dataset.topic;
  const sid = button.dataset.subject;
  const grade = Number(button.dataset.grade);
  if (!topic || !sid || !grade) return;
  openLesson(sid, grade, topic, 'learn-screen');
}

/**
 * Opens a lesson from outside the catalogue — a weak-topic chip, a summary
 * error, or the quiz feedback box. The button carries where to return to, so
 * closing the lesson does not dump a student out of a quiz they were mid-way
 * through.
 */
function handleLearnTopic(button) {
  const topic = button.dataset.topic;
  const sid = button.dataset.subject;
  const grade = Number(button.dataset.grade);
  if (!topic || !sid || !grade) return;
  openLesson(sid, grade, topic, button.dataset.return || 'setup-screen');
}

function handleLessonNext() {
  if (!lessonState) return;

  // Already on the last card inside a session: the button is the session's now,
  // and pressing it means "next LESSON" rather than "next card". Without this
  // the student reaches the recap and the session has no way forward.
  if (studySession && isLastCard(lessonState)) {
    advanceStudySession();
    return;
  }

  lessonState = nextCard(lessonState);
  renderLessonCard();
  // Saved on reaching the recap so a student who reads to the end and then
  // navigates backwards is still credited with finishing.
  if (isLastCard(lessonState)) saveLessonProgress();
  if (studySession) uiLesson.renderStudyBar(studyPosition(studySession));
}

function handleLessonPrev() {
  if (!lessonState) return;
  lessonState = prevCard(lessonState);
  renderLessonCard();
}

function handleLessonStep() {
  if (!lessonState) return;
  lessonState = revealStep(lessonState);
  renderLessonCard();
}

/**
 * Answers a checkpoint.
 *
 * Deliberately indistinguishable from paging: the card changes and nothing
 * announces a result. Right, and the lesson moves on; wrong, and it goes back
 * to teach the micro-topic again in different words. The student is not told
 * which happened — see answerCheck in js/lesson.js for why.
 */
function handleAnswerCheck(button) {
  if (!lessonState || !button) return;
  lessonState = answerCheck(lessonState, Number(button.dataset.choice));
  renderLessonCard();
  if (isLastCard(lessonState)) saveLessonProgress();
}

/**
 * Records how far the student got.
 *
 * Called on EVERY exit from a lesson, not only on finishing it. Reading half a
 * lesson is still work, and saving only on completion silently discarded it.
 * isWorthSaving keeps a lesson that was merely opened and shut from leaving a
 * mark.
 */
function saveLessonProgress() {
  if (!lessonState || !isWorthSaving(lessonState)) return;
  db.saveLessonProgress(getProgressRecord(lessonState, studentName));

  // A checkpoint the student never cleared is the clearest possible signal that
  // a topic needs drilling — it is the one place the app watches someone fail
  // to understand something in real time. Recorded as a miss so it surfaces as
  // a weak-topic chip, which is already wired to start a drill on it.
  const stuck = unresolvedTopics(lessonState);
  if (stuck.length) {
    db.markTopicsAssessed(lessonState.lesson.subject, lessonState.grade,
      stuck.map(topic => ({ topic, asked: 1, missed: 1 })));
  }
}

/** "I'm ready" — a short drill on the one topic the lesson taught. */
async function handleLessonQuiz() {
  if (!lessonState) return;
  const sid = lessonState.lesson.subject;
  const grade = lessonState.grade;
  const topic = lessonState.topic;
  saveLessonProgress();

  const [bankRows, recent] = await Promise.all([
    db.fetchBankQuestions(sid, grade, null),
    db.getRecentQuestions(sid, grade)
  ]);
  const questions = assembleReinforcement(bankRows, sid, grade, [topic], 10, null, null, recent);
  // The lesson is dropped only once there is something to move on to, so a
  // topic that cannot be drilled leaves the student on the lesson they were
  // reading rather than on a blank screen.
  if (startDrill(questions, sid, grade, null, `את "${topic}"`)) lessonState = null;
}

/**
 * Closes the lesson and goes back where the student came from.
 *
 * Returning to a quiz has to repaint the answered state as well as the
 * question: showScreen never destroyed the quiz state, but the DOM was rebuilt
 * for the lesson, so without the replay the student lands on a blank version of
 * the question they had already answered and loses the feedback they came back
 * for.
 */
function handleCloseLesson() {
  // Before the state is dropped: leaving mid-lesson is the common case, and it
  // is exactly the case that used to lose the student's work.
  saveLessonProgress();
  lessonState = null;
  uiLesson.resetLessonPaint();

  if (lessonReturn === 'quiz-screen' && quiz) {
    const question = currentQuestion(quiz);
    ui.setMixedMode(quiz.subject === MIXED);
    ui.showScreen('quiz-screen');
    ui.applySubjectDirection(quiz.subject);
    ui.renderQuestion(question, quiz.index, quiz.questions.length, answeredCount(quiz));
    if (quiz.answered && lastAnswerIndex != null) {
      ui.renderAnswerResult(question, lastAnswerIndex);
      offerLesson(question, lastAnswerIndex);
    }
    return;
  }
  // Closing a lesson that a session opened ends the session — the ✕ means "stop",
  // and dropping back to a catalogue mid-queue would strand the student.
  if (lessonReturn === 'study-session') { finishStudySession(); return; }
  if (lessonReturn === 'learn-screen') { handleShowLearn(); return; }
  if (lessonReturn === 'summary-screen') { ui.showScreen('summary-screen'); return; }
  handleReturnToSetup();
}

async function loadBoard() {
  const { rows, fromCache } = await db.getLeaderboard(ui.getBoardSubject(), ui.getBoardFilter(), ui.getBoardDifficulty());
  ui.renderLeaderboard(rows);
  if (fromCache) {
    ui.showBanner('לא מחובר לשרת — מוצגות תוצאות מקומיות בלבד.');
  } else {
    refreshBanner();
  }
}

async function loadMyHistory() {
  const { rows } = await db.getStudentHistory(studentName);
  ui.renderMyHistory(rows, studentName);
}

async function handleShowDashboard() {
  ui.showScreen('dashboard-screen');
  ui.renderDashboard(studentName, [], [], new Map(), [], []); // clear stale content while loading
  const [{ rows, fromCache }, errorTopics, lessonProgress, gameScores, topicResults] = await Promise.all([
    db.getStudentHistory(studentName),
    db.getStudentErrorTopics(studentName),
    db.getLessonProgress(),
    db.getMyGameScores(),
    db.getTopicResults()
  ]);
  ui.renderDashboard(studentName, rows, errorTopics, lessonProgress, gameScores, topicResults);
  if (fromCache) ui.showBanner('לא מחובר לשרת — מוצג ניתוח מנתונים מקומיים בלבד.');
  else refreshBanner();
}

/**
 * Turns the buzz on or off, and remembers the choice.
 *
 * Opt-out rather than opt-in: it is a reward, and a reward nobody discovers is
 * not a reward. The switch exists because a phone that buzzes in a classroom is
 * a problem the student needs to be able to solve without leaving the app.
 */
function handleToggleHaptics() {
  const on = !db.getHaptics();
  db.rememberHaptics(on);
  setHapticsEnabled(on);
  ui.markHaptics(on);
  // Confirm the new state the way the feature itself speaks.
  if (on) vibrateCorrect();
}

function handleToggleTheme() {
  const next = ui.currentTheme() === 'dark' ? 'light' : 'dark';
  ui.applyTheme(next);
  db.rememberTheme(next);
}

async function handleShowHistory() {
  ui.showScreen('history-screen');
  ui.showTab('board');
  // Opens on every subject, not the one last practised: a leaderboard scoped to
  // one subject before the student chose to scope it hides most of the board.
  ui.setBoardSubject('');
  ui.populateBoardGrades('');
  await loadBoard();
  await loadMyHistory();
}

async function handleShowTab(name) {
  ui.showTab(name);
  if (name === 'board') await loadBoard();
  else await loadMyHistory();
}

async function handleToggleErrors(button) {
  // Already expanded: collapse without hitting the network. toggleErrorDetail
  // ignores the second argument when it is removing an existing detail row.
  if (ui.isErrorDetailOpen(button)) {
    ui.toggleErrorDetail(button, []);
    return;
  }
  const errors = await db.getAttemptErrors(Number(button.dataset.attemptId));
  ui.toggleErrorDetail(button, errors);
}

// --- wiring -----------------------------------------------------------

document.addEventListener('click', event => {
  const optionItem = event.target.closest('.option-item');
  if (optionItem && !optionItem.classList.contains('locked')) {
    // A sprint option scores immediately and moves on; a quiz option opens
    // the feedback box. Same markup, so the surface it sits in decides.
    if (optionItem.closest('#game-options')) {
      handleGameAnswer(Number(optionItem.dataset.optionIndex));
      return;
    }
    const group = optionItem.closest('[data-part]');
    handleOptionClick(group ? Number(group.dataset.part) : 0,
      Number(optionItem.dataset.optionIndex));
    return;
  }

  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  // Picking a topic navigates away, so the drawer has to shut first — otherwise
  // the student lands on a lesson with the panel still over it.
  //
  // The test is "does this control live inside the drawer?", not an allowlist of
  // action names. An allowlist is wrong by default: every control added to the
  // drawer later has to be remembered, and forgetting one dismisses the drawer.
  // That is exactly how the grade <select> broke — it carries data-action for
  // the change listener, and merely CLICKING it to open the dropdown looked to
  // this handler like a navigation.
  //
  // 'close-drawer' is excluded because the switch below already closes it;
  // closing twice would re-run the exit animation and steal focus.
  const NAVIGATES_AWAY = ['learn-topic', 'practice-topic'];
  if (drawer.isOpen() && action !== 'close-drawer' &&
      (NAVIGATES_AWAY.includes(action) || !actionEl.closest('#drawer'))) {
    handleCloseDrawer();
  }

  switch (action) {
    case 'auth-mode':        handleAuthMode(actionEl.dataset.mode); break;
    case 'auth-submit':      handleAuthSubmit(); break;
    case 'logout':           handleLogout(); break;
    case 'start-quiz':       handleStartQuiz(); break;
    case 'game-mode':        handleGameMode(actionEl); break;
    case 'game-subject':     handleGameSubject(actionEl); break;
    case 'start-sprint':     handleStartSprint(); break;
    case 'quit-game':        handleQuitGame(); break;
    case 'show-game-board':  handleShowGameBoard(); break;
    case 'resume-quiz':      handleResumeQuiz(actionEl); break;
    case 'discard-resume':   handleDiscardResume(actionEl); break;
    case 'next-question':    handleNextQuestion(); break;
    case 'submit-answer':    handleSubmitAnswer(); break;
    case 'confirm-restart':  handleConfirmRestart(); break;
    case 'return-to-setup':  handleReturnToSetup(); break;
    case 'show-history':     handleShowHistory(); break;
    case 'show-dashboard':   handleShowDashboard(); break;
    case 'practice-weak':    handlePracticeWeak(); break;
    case 'practice-attempt': handlePracticeAttempt(actionEl); break;
    case 'practice-topic':   handlePracticeTopic(actionEl); break;
    case 'show-learn':       handleShowLearn(); break;
    case 'start-study':      handleStartStudySession(actionEl); break;
    case 'study-skip':       handleStudySkip(); break;
    case 'study-stop':       handleStudyStop(); break;
    case 'study-again':      handleStudyAgain(); break;
    case 'open-drawer':      handleOpenDrawer(actionEl); break;
    case 'close-drawer':     handleCloseDrawer(); break;
    case 'close-whatsnew':   handleCloseWhatsNew(); break;
    case 'drawer-group':     drawer.toggleGroup(actionEl.dataset.group); break;
    case 'study-subject':    handleStudySubjectSingle(actionEl); break;
    case 'study-subject-toggle': handleStudySubjectToggle(actionEl); break;
    case 'start-mixed-quiz': handleStartMixedQuiz(); break;
    case 'extra-subject':    handleExtraSubject(actionEl); break;
    case 'extra-open':       handleExtraOpen(actionEl); break;
    case 'extra-study':      handleExtraStudy(); break;
    case 'extra-quiz':       handleExtraQuiz(); break;
    case 'pick-mode':        handlePickMode(actionEl); break;
    case 'open-lesson':      handleOpenLesson(actionEl); break;
    case 'learn-topic':      handleLearnTopic(actionEl); break;
    case 'lesson-next':      handleLessonNext(); break;
    case 'lesson-prev':      handleLessonPrev(); break;
    case 'lesson-step':      handleLessonStep(); break;
    case 'answer-check':     handleAnswerCheck(actionEl); break;
    case 'lesson-quiz':      handleLessonQuiz(); break;
    case 'close-lesson':     handleCloseLesson(); break;
    case 'pick-subject':     handlePickSubject(actionEl); break;
    case 'pick-level':       handlePickLevel(actionEl); break;
    // Opens Home with the quiz card already expanded — the button promises a
    // quiz, so it should not drop the student on a screen with both paths shut.
    case 'toggle-theme':     handleToggleTheme(); break;
    case 'toggle-haptics':   handleToggleHaptics(); break;
    case 'show-tab':         handleShowTab(actionEl.dataset.tab); break;
    case 'toggle-errors':    handleToggleErrors(actionEl); break;
    default: break;
  }
});

// Keyboard: options are role="button" with tabindex, so Enter/Space must work.
document.addEventListener('keydown', event => {
  // Drawer keys come first: while it is open it owns the keyboard.
  if (drawer.isOpen()) {
    if (event.key === 'Escape') { event.preventDefault(); handleCloseDrawer(); return; }
    if (event.key === 'Tab') { drawer.trapTab(event); return; }
  }

  if (event.key !== 'Enter' && event.key !== ' ') return;

  const optionItem = event.target.closest('.option-item');
  if (optionItem && !optionItem.classList.contains('locked')) {
    event.preventDefault();
    if (optionItem.closest('#game-options')) {
      handleGameAnswer(Number(optionItem.dataset.optionIndex));
      return;
    }
    const group = optionItem.closest('[data-part]');
    handleOptionClick(group ? Number(group.dataset.part) : 0,
      Number(optionItem.dataset.optionIndex));
    return;
  }

  if (event.key === 'Enter' &&
      ['auth-username', 'auth-display', 'auth-password'].includes(event.target.id)) {
    event.preventDefault();
    handleAuthSubmit();
  }
});

// The subject picker and board filters are <select> elements, so they need
// change, not click.
document.addEventListener('change', event => {
  const action = event.target.dataset.action;
  if (action === 'change-subject') handleChangeSubject();
  else if (action === 'change-grade') handleChangeGrade();
  else if (action === 'study-grade') handleStudyGrade(event.target);
  else if (action === 'filter-board') {
    if (event.target.id === 'board-subject-filter') ui.populateBoardGrades(ui.getBoardSubject());
    loadBoard();
  }
});

// Retry queued attempts as soon as the browser reports connectivity.
window.addEventListener('online', syncPending);

// --- boot -------------------------------------------------------------

// theme-init.js already set data-theme before paint; sync the toggle button.
ui.applyTheme(ui.currentTheme());

// Written once — the release never changes while the page is open.
ui.renderVersion();

// The buzz on a correct answer. Restored from the saved preference, and the
// switch is hidden outright on anything that cannot vibrate — every iPhone and
// every desktop, where the Vibration API does not exist.
setHapticsEnabled(db.getHaptics());
ui.markHaptics(db.getHaptics(), hapticsSupported());

// The remembered subject seeds the QUIZ card, which is grade-based. A gradeless
// subject can land there after an "מקצועות נוספים" quiz, and would then put its
// pseudo-grade in the grade picker — so it falls back to the default instead.
const remembered = db.getLastSubject();
subjectId = remembered && !gradelessSubjects().includes(remembered) ? remembered : DEFAULT_SUBJECT;
ui.populateSubjects(subjectId);
ui.renderSubjectTiles(subjectId);
ui.renderExtraTiles(extraSubject);
ui.renderGameModes(gameMode);
ui.renderGameTiles(gameSubject);
ui.populateGameGrades(gameSubject);
ui.populateGrades(subjectId);
ui.populateBoardGrades(subjectId);
ui.populateTracks(subjectId, ui.getGrade());
ui.markLevelPill('');

// Auth gate: restore an existing session, otherwise show the login/register
// screen. Everything else stays hidden until the student is signed in.
(async () => {
  const user = await db.currentUser();
  if (user) enterApp(user);
  else { ui.setAuthMode('login'); ui.showScreen('auth-screen'); }
  refreshBanner();
})();
