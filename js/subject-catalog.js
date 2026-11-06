/**
 * Every school subject the scraper knows how to look for.
 *
 * GENERATED — do not edit. Regenerate from exeScraper with:
 *   npm run export:catalog
 *
 * This is the list the console shows under "מקצועות שאפשר להוסיף": subjects
 * that exist as far as the content pipeline is concerned but have no row in
 * the database yet. Creating one from here rather than typing it by hand is
 * what guarantees the id matches the one the worker will search by.
 *
 * `from`/`to` are the grade range the subject is taught across, not an
 * explicit list — the console expands it when it creates the row, because
 * subjects.grades is a real array of the grades an admin actually picked.
 *
 * `optionsDir` is which way the ANSWERS read, and it is not cosmetic: an
 * answer list declared right-to-left runs the bidi algorithm over every
 * option, so "-7" renders as "7-" and a student is shown an answer that is not
 * the one being scored. See answerDirection() in exeScraper's src/subjects.js.
 */
const C = (id, name, from, to, group, optionsDir) =>
  ({ id, name, from, to, group, dir: 'rtl', optionsDir });

export const CATALOG_GROUPS = {
  'elementary': "יסודי",
  'middle': "חטיבת ביניים",
  'high-required': "תיכון — חובה",
  'high-elective': "תיכון — מגמות",
  'high-tech': "תיכון — מגמות טכנולוגיות",
  'religious': "לימודי קודש"
};

export const CATALOG = [
  C('hebrew-lang', "שפה (עברית)", 1, 6, 'elementary', 'rtl'),
  C('homeland', "מולדת, חברה ואזרחות", 2, 4, 'elementary', 'rtl'),
  C('life-skills', "כישורי חיים / מפתח הל\"ב", 1, 9, 'elementary', 'rtl'),
  C('tanach', "תנ\"ך", 1, 12, 'middle', 'rtl'),
  C('geography', "גיאוגרפיה", 5, 12, 'middle', 'rtl'),
  C('science-tech', "מדעים וטכנולוגיה", 3, 9, 'middle', 'ltr'),
  C('english', "אנגלית", 3, 12, 'middle', 'auto'),
  C('pe', "חינוך גופני", 1, 12, 'middle', 'rtl'),
  C('arts', "אמנות / מוזיקה / דרמה", 1, 12, 'elementary', 'rtl'),
  C('math', "מתמטיקה", 7, 12, 'middle', 'ltr'),
  C('lashon', "לשון והבעה", 7, 12, 'middle', 'rtl'),
  C('literature', "ספרות", 7, 12, 'middle', 'rtl'),
  C('history', "היסטוריה", 7, 12, 'middle', 'rtl'),
  C('second-lang', "שפה זרה שנייה", 7, 12, 'middle', 'auto'),
  C('shelah', "של\"ח וידיעת הארץ", 8, 9, 'middle', 'rtl'),
  C('jewish-culture', "תרבות יהודית-ישראלית / מורשת", 7, 12, 'middle', 'rtl'),
  C('civics', "אזרחות", 10, 12, 'high-required', 'rtl'),
  C('physics', "פיזיקה", 10, 12, 'high-elective', 'ltr'),
  C('chemistry', "כימיה", 10, 12, 'high-elective', 'ltr'),
  C('biology', "ביולוגיה", 10, 12, 'high-elective', 'ltr'),
  C('cs', "מדעי המחשב / הנדסת תוכנה", 7, 12, 'high-elective', 'ltr'),
  C('biotech', "ביוטכנולוגיה", 10, 12, 'high-elective', 'ltr'),
  C('electronics', "אלקטרוניקה", 10, 12, 'high-elective', 'ltr'),
  C('psychology', "פסיכולוגיה", 10, 12, 'high-elective', 'rtl'),
  C('sociology', "סוציולוגיה", 10, 12, 'high-elective', 'rtl'),
  C('economics', "כלכלה", 10, 12, 'high-elective', 'ltr'),
  C('business', "מנהל עסקים", 10, 12, 'high-elective', 'rtl'),
  C('philosophy', "פילוסופיה", 10, 12, 'high-elective', 'rtl'),
  C('communication', "תקשורת", 10, 12, 'high-elective', 'rtl'),
  C('languages-adv', "שפות מוגבר", 10, 12, 'high-elective', 'auto'),
  C('arts-adv', "אמנויות (מגמה)", 10, 12, 'high-elective', 'rtl'),
  C('pe-adv', "חינוך גופני מורחב", 10, 12, 'high-elective', 'rtl'),
  C('digital-literacy', "אוריינות דיגיטלית ומחשבים", 1, 9, 'elementary', 'ltr'),
  C('road-safety', "זהירות בדרכים", 1, 9, 'elementary', 'rtl'),
  C('nature', "טבע וסביבה", 1, 9, 'elementary', 'rtl'),
  C('oral-torah', "תורה שבעל פה", 3, 12, 'religious', 'rtl'),
  C('halacha', "הלכה", 3, 12, 'religious', 'rtl'),
  C('jewish-thought', "מחשבת ישראל", 7, 12, 'religious', 'rtl'),
  C('land-of-israel', "לימודי ארץ ישראל וארכיאולוגיה", 7, 12, 'religious', 'rtl'),
  C('arabic', "ערבית", 7, 12, 'middle', 'auto'),
  C('french', "צרפתית", 7, 12, 'middle', 'auto'),
  C('russian', "רוסית", 7, 12, 'middle', 'auto'),
  C('spanish', "ספרדית", 7, 12, 'middle', 'auto'),
  C('hebrew-second', "עברית כשפה שנייה", 1, 12, 'middle', 'auto'),
  C('health-sciences', "מדעי הבריאות", 10, 12, 'high-elective', 'ltr'),
  C('env-science', "מדעי הסביבה", 10, 12, 'high-elective', 'ltr'),
  C('data-science', "מדעי הנתונים וסטטיסטיקה", 10, 12, 'high-elective', 'ltr'),
  C('social-sciences', "מדעי החברה", 10, 12, 'high-elective', 'rtl'),
  C('accounting', "חשבונאות", 10, 12, 'high-elective', 'ltr'),
  C('law', "משפט", 10, 12, 'high-elective', 'rtl'),
  C('finance-literacy', "חינוך פיננסי", 7, 12, 'high-elective', 'ltr'),
  C('tourism', "תיירות", 10, 12, 'high-elective', 'rtl'),
  C('agriculture', "חקלאות ומדעי הצמח", 10, 12, 'high-elective', 'ltr'),
  C('mechanical-eng', "הנדסת מכונות", 10, 12, 'high-tech', 'ltr'),
  C('mechatronics', "מכטרוניקה ורובוטיקה", 10, 12, 'high-tech', 'ltr'),
  C('civil-eng', "הנדסת בניין ואדריכלות", 10, 12, 'high-tech', 'ltr'),
  C('aeronautics', "תעופה וחלל", 10, 12, 'high-tech', 'ltr'),
  C('maritime', "ימאות", 10, 12, 'high-tech', 'rtl'),
  C('optics', "אופטיקה", 10, 12, 'high-tech', 'ltr'),
  C('chem-tech', "כימיה טכנולוגית", 10, 12, 'high-tech', 'ltr'),
  C('cyber', "סייבר ואבטחת מידע", 10, 12, 'high-tech', 'ltr'),
  C('graphic-design', "עיצוב גרפי ומדיה", 10, 12, 'high-tech', 'rtl')
];

const BY_ID = new Map(CATALOG.map((s) => [s.id, s]));

/** One catalogue entry, or undefined. */
export function catalogSubject(id) {
  return BY_ID.get(id);
}

/** The grades a catalogue entry covers, as the array a subject row wants. */
export function catalogGrades(entry) {
  const grades = [];
  for (let g = Math.max(1, entry.from); g <= Math.min(12, entry.to); g++) grades.push(g);
  return grades;
}
