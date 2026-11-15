/**
 * "מה חדש" — the release notes shown once per version, in the voice a student
 * reads them in rather than the voice they were built in.
 *
 * Pure data, no DOM: js/ui.js renders it, js/app.js decides when to show it.
 *
 * Writing rules for every entry, because these are read by children:
 *   - Second person, warm, short. "הוספנו לך" not "נוסף מקצוע חדש".
 *   - One emoji per line, doing real work (naming the thing), not decoration.
 *   - Say what a student can now DO, never how it was built. "אפשר ללמוד
 *     מדעים" — not "נרשם מקצוע חדש למאגר עם תמיכה בכיתות א׳-ו׳".
 *   - No bug fixes, no "we fixed X". A kid does not care that a display bug
 *     was corrected, and naming it just says "something was broken before" —
 *     this screen is only ever good news.
 *   - Newest entry first. Only the entry matching the CURRENT APP_VERSION is
 *     ever shown — see shouldShowWhatsNew() in js/app.js — so older entries
 *     exist only as a record, not because several can appear at once.
 */
export const WHATS_NEW = [
  {
    version: '1.1.0',
    emoji: '🎉',
    title: 'הכי חדש אצלנו',
    items: [
      { emoji: '🔬', text: 'מקצוע חדש: מדעים! אפשר ללמוד ולהיבחן, מכיתה א׳ עד ו׳.' },
      { emoji: '💻', text: 'מקצוע חדש: תכנות! מתאים לכל גיל — מהוראות פשוטות ועד קוד אמיתי.' },
      { emoji: '🧠', text: 'בשיעורים יש עכשיו רגעים קטנים של "נסה בעצמך" — ואם משהו לא ברור, השיעור מסביר את זה שוב, אחרת, בלי לחץ ובלי ציון.' },
      { emoji: '📊', text: 'הלוח האישי שלך מחודש: רואים בדיוק איפה אתה חזק ואיפה כדאי לתרגל עוד קצת.' },
      { emoji: '🏆', text: 'לוח התוצאות מסודר עכשיו לפי הזמן — הכי חדש למעלה.' }
    ]
  }
];

/** The entry for one version, or null if nothing was written for it. */
export function whatsNewFor(version) {
  return WHATS_NEW.find(entry => entry.version === version) || null;
}
