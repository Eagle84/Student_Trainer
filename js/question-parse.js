/**
 * Parses hand-written questions pasted in bulk.
 *
 * Pure: no DOM, no network. Exists as its own module so the format can be
 * tested properly — a parser that silently misreads a line turns into a wrong
 * answer marked correct, which is the one defect in this whole app a student
 * cannot argue with.
 *
 * The format is pipe-separated, one question per line:
 *
 *   topic | question | correct answer | wrong | wrong | wrong | explanation | difficulty
 *
 * The last two are optional. Chosen over CSV because the content is Hebrew
 * prose full of commas, and over JSON because this is meant to be typed by
 * hand or pasted out of a spreadsheet column.
 *
 * THE CORRECT ANSWER IS ALWAYS FIRST. There is no index to state and therefore
 * none to get wrong. That is safe because nothing serves the stored order:
 * normalizeBankRow in quiz.js re-shuffles every bank row on every draw, so a
 * student never sees these four in the order they were written.
 */

/** Columns, in order. The first six are required. */
const FIELDS = ['topic', 'text', 'correct', 'wrong1', 'wrong2', 'wrong3', 'explanation', 'difficulty'];
const REQUIRED = 6;

/** A line that is blank, or a note to a human rather than a question. */
function isSkippable(line) {
  const t = line.trim();
  return !t || t.startsWith('#') || t.startsWith('//');
}

/**
 * Splits on pipes, tolerating the full-width bar.
 *
 * A Hebrew keyboard layout and a copy out of a formatted table both produce
 * '｜' rather than '|' often enough that rejecting it would read as the
 * parser being broken.
 */
function cells(line) {
  return line.split(/[|｜]/).map(c => c.trim());
}

/** What is wrong with one row, in Hebrew, or null. */
function problemWith(row) {
  if (!row.topic) return 'חסר נושא';
  if (!row.text) return 'חסרה שאלה';
  const options = [row.correct, row.wrong1, row.wrong2, row.wrong3];
  if (options.some(o => !o)) return 'צריך תשובה נכונה ושלושה מסיחים';
  if (new Set(options).size !== 4) return 'יש תשובות זהות — כל ארבע חייבות להיות שונות';
  if (row.difficulty != null && !(row.difficulty >= 1 && row.difficulty <= 5)) {
    return 'רמת קושי חייבת להיות מספר בין 1 ל-5';
  }
  return null;
}

/**
 * Parses pasted text into rows ready for question_bank.
 *
 * Returns the good rows AND the bad ones with their line numbers, rather than
 * throwing on the first mistake. Twenty pasted lines with a typo on line
 * eleven should save nineteen and tell you about the eleventh — not refuse the
 * lot and make you find it yourself.
 */
export function parseQuestions(text, { subject, grade, track = null } = {}) {
  const rows = [];
  const errors = [];

  const lines = String(text || '').split('\n');
  lines.forEach((line, i) => {
    if (isSkippable(line)) return;

    const parts = cells(line);
    if (parts.length < REQUIRED) {
      errors.push({
        line: i + 1,
        text: line.trim().slice(0, 60),
        problem: `צריך לפחות ${REQUIRED} שדות מופרדים ב-| ויש ${parts.length}`
      });
      return;
    }

    const row = {};
    FIELDS.forEach((name, at) => { row[name] = parts[at] || ''; });
    row.difficulty = row.difficulty ? Number(row.difficulty) : null;

    const problem = problemWith(row);
    if (problem) {
      errors.push({ line: i + 1, text: line.trim().slice(0, 60), problem });
      return;
    }

    rows.push({
      subject,
      grade: Number(grade),
      track: track == null ? null : Number(track),
      difficulty: row.difficulty || 3,
      topic: row.topic,
      text: row.text,
      // Correct answer first, which is the format's whole simplification.
      // correctIndex is therefore always 0, and quiz.js shuffles on read.
      options: [row.correct, row.wrong1, row.wrong2, row.wrong3],
      correctIndex: 0,
      explanation: row.explanation || null
    });
  });

  return { rows, errors };
}

/** One line in the pasted format, for the "copy this shape" example. */
export const EXAMPLE_LINE =
  'רשויות השלטון | איזו רשות מחוקקת חוקים? | הכנסת | הממשלה | בג"ץ | נשיא המדינה | הכנסת היא הרשות המחוקקת | 2';

/**
 * Turns the single-question form into the same row shape.
 *
 * Shared with the bulk path on purpose: one definition of what a valid
 * question is, so the form cannot accept something the paste would reject.
 */
export function buildRow({ subject, grade, track = null, topic, text, options, correctIndex, explanation, difficulty }) {
  const clean = (options || []).map(o => String(o || '').trim());
  const problem =
    !String(topic || '').trim() ? 'חסר נושא'
    : !String(text || '').trim() ? 'חסרה שאלה'
    : clean.length !== 4 || clean.some(o => !o) ? 'צריך ארבע תשובות מלאות'
    : new Set(clean).size !== 4 ? 'יש תשובות זהות — כל ארבע חייבות להיות שונות'
    : !(correctIndex >= 0 && correctIndex <= 3) ? 'סמן איזו תשובה נכונה'
    : null;

  if (problem) return { ok: false, problem };

  return {
    ok: true,
    row: {
      subject,
      grade: Number(grade),
      track: track == null ? null : Number(track),
      difficulty: Number(difficulty) || 3,
      topic: String(topic).trim(),
      text: String(text).trim(),
      options: clean,
      correctIndex: Number(correctIndex),
      explanation: String(explanation || '').trim() || null
    }
  };
}
