/**
 * English lessons.
 *
 * English words inside Hebrew prose must be wrapped by en(): without an
 * explicit dir the bidi algorithm relocates trailing punctuation and the
 * student reads "?went he Where". The same span/class pair the question
 * generators use is on the sanitizer's allowlist.
 */

/** Wraps an English fragment so it reads left-to-right inside RTL prose. */
const en = text => `<span dir="ltr" class="lang-ltr">${text}</span>`;

const pastTense = {
  id: 'english-past-simple',
  subject: 'english',
  // Grade 8 is deliberately absent: it has no past-tense generator of its own,
  // and reaches the topic only through the multi-select generator, which is
  // parts-shaped and therefore skipped by quiz.js. Listing grade 8 here would
  // give the catalogue a lesson whose check cards and readiness quiz come up
  // empty. A grade-8 student who arrives from a weak-topic chip still gets this
  // lesson through getLesson's nearest-grade fallback.
  grades: [5, 6, 7, 9],
  topics: ['זמן עבר'],
  title: 'Past Simple — זמן עבר באנגלית',
  intro: 'מתי מוסיפים ed-, מתי הפועל משתנה לגמרי, ומה קורה אחרי did.',
  minutes: 7,
  cards: [
    {
      kind: 'concept',
      title: 'הפועל מסמן מתי זה קרה',
      lead: 'באנגלית לא מוסיפים מילה כדי לומר "אתמול" — משנים את הפועל עצמו.',
      visual: { shape: 'verbTimeline', past: 'played', now: 'play', highlight: 'past' },
      body: [
        `${en('I play football')} — אני משחק, עכשיו או בדרך כלל.`,
        `${en('I played football')} — שיחקתי, זה נגמר.`,
        'ההבדל היחיד הוא הסיומת. אין "אתמול" במשפט, ובכל זאת ברור שזה עבר.'
      ],
      rule: 'רוב הפעלים: מוסיפים ed- לצורת הבסיס.'
    },
    {
      kind: 'steps',
      title: 'כללי האיות של ed-',
      problem: 'איך בדיוק מדביקים את הסיומת?',
      visual: { shape: 'verbTimeline', past: 'stopped', now: 'stop', highlight: 'past' },
      steps: [
        {
          text: 'ברירת מחדל — פשוט מוסיפים ed.',
          expr: en('work → worked · play → played · watch → watched'),
          highlight: 'past'
        },
        {
          text: 'פועל שנגמר ב-e — מוסיפים d בלבד, אין טעם בשתי e.',
          expr: en('like → liked · live → lived · close → closed')
        },
        {
          text: 'עיצור + y — ה-y הופכת ל-i.',
          expr: en('study → studied · cry → cried · try → tried')
        },
        {
          text: 'הברה אחת שנגמרת בתנועה + עיצור — מכפילים את העיצור.',
          expr: en('stop → stopped · plan → planned · shop → shopped')
        }
      ]
    },
    {
      kind: 'concept',
      title: 'הפעלים החריגים — אין ברירה, זוכרים',
      lead: 'הפעלים הנפוצים ביותר באנגלית הם דווקא אלה שלא מקבלים ed-.',
      visual: { shape: 'verbTimeline', past: 'went', now: 'go', highlight: 'past' },
      body: [
        `${en('go → went')} · ${en('see → saw')} · ${en('eat → ate')} · ${en('take → took')}`,
        `${en('buy → bought')} · ${en('come → came')} · ${en('write → wrote')} · ${en('run → ran')}`,
        'זו רשימה סגורה של כמה עשרות פעלים. הם חוזרים כל כך הרבה שאחרי מספיק חשיפה הם פשוט נשמעים נכון.'
      ],
      rule: 'חריגים לא מקבלים ed- לעולם. אין להם כלל — יש להם רשימה.'
    },
    {
      kind: 'pitfall',
      title: 'הטעות שכולם עושים: עבר כפול',
      wrong: en("I didn't went to school."),
      right: en("I didn't go to school."),
      why: `המילה ${en('did')} כבר נושאת את העבר. אחריה הפועל חוזר לצורת הבסיס — אחרת סימנת עבר פעמיים. אותו דבר בשאלה: ${en('Where did you go?')} ולא ${en('Where did you went?')}.`
    },
    {
      kind: 'concept',
      title: 'שלילה ושאלה',
      lead: 'בשניהם הפועל חוזר לבסיס, וה-did עושה את כל העבודה.',
      visual: { shape: 'verbTimeline', past: 'did + go', now: 'go', highlight: 'past' },
      body: [
        `חיובי: ${en('She watched TV.')}`,
        `שלילה: ${en("She didn't watch TV.")} — לא ${en('watched')}.`,
        `שאלה: ${en('Did she watch TV?')} — שוב ${en('watch')}, לא ${en('watched')}.`
      ],
      rule: 'אחרי did / didn\'t — תמיד צורת הבסיס.'
    },
    {
      kind: 'recap',
      bullets: [
        'רוב הפעלים: בסיס + ed, עם התאמות איות (e / y / הכפלת עיצור).',
        'הפעלים הנפוצים ביותר חריגים ונלמדים בעל פה.',
        'אחרי did או didn\'t הפועל חוזר לצורת הבסיס.',
        'סימן עבר פעם אחת בלבד במשפט.'
      ]
    }
  ]
};

const vocabulary = {
  id: 'english-vocabulary',
  subject: 'english',
  grades: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  topics: ['אוצר מילים'],
  title: 'אוצר מילים — איך באמת זוכרים',
  intro: 'למה רשימות לא עובדות, ומה כן.',
  minutes: 7,
  cards: [
    {
      kind: 'concept',
      title: 'מילה בודדת נשכחת, מילה בהקשר נשארת',
      lead: 'המוח לא מאחסן מילים ברשימה — הוא מאחסן אותן ברשת של קשרים.',
      body: [
        `ללמוד ש-${en('apple')} זה "תפוח" זו נקודה בודדת בזיכרון, ואין ממה לתלות אותה.`,
        `ללמוד ${en('I ate a green apple')} נותן ארבעה עוגנים בבת אחת — הפועל, הצבע, המשפט והתמונה.`,
        'לכן הכלל הראשון: תמיד לרשום מילה חדשה בתוך משפט שלם, לא בעמודה מול תרגום.'
      ],
      rule: 'מילה חדשה נלמדת בתוך משפט, לא ברשימה.'
    },
    {
      kind: 'concept',
      title: 'קבוצות ולא אקראי',
      lead: 'עשר מילים מאותו עולם תוכן נקלטות טוב יותר מעשר מילים מקריות.',
      body: [
        `<strong>לפי נושא</strong>: ${en('kitchen — fridge, oven, plate, spoon')} — כולן מצטיירות באותו חדר.`,
        `<strong>לפי ניגוד</strong>: ${en('hot / cold')}, ${en('early / late')} — זוג נזכר יחד.`,
        `<strong>לפי משפחת מילים</strong>: ${en('teach → teacher → teaching')} — מילה אחת נותנת שלוש.`,
        'שלוש השיטות עובדות כי כולן יוצרות קשר. מילה מבודדת היא מילה שנשכחת.'
      ],
      aside: 'עדיף ללמוד 5 מילים היטב מ-20 מילים ברפרוף. מילה שאתה יכול להשתמש בה במשפט היא מילה שלמדת.'
    },
    {
      kind: 'example',
      title: 'לנחש מילה מההקשר',
      problem: `לא מכירים את המילה: ${en('The soup was so hot that I burned my tongue.')}`,
      solution: [
        `לא צריך לדעת מה זה ${en('burned')} כדי להתקדם. קוראים את כל המשפט.`,
        `${en('soup')} חם, ומשהו קרה ל-${en('tongue')} — ללשון.`,
        `המילה ${en('so...that')} מסמנת תוצאה: היה כל כך חם, <strong>ולכן</strong> משהו קרה.`,
        `אז ${en('burned')} הוא משהו רע שקורה מחום — כנראה "נכוויתי". וזה בדיוק נכון.`
      ],
      answer: `${en('burned')} = נכוויתי.`,
      note: 'זו המיומנות החשובה ביותר במבחן: אף פעם לא תדע את כל המילים, אבל כמעט תמיד תוכל להסיק מהמשפט. אל תיתקע על מילה — תמשיך לקרוא.'
    },
    {
      kind: 'pitfall',
      title: 'חברים מדומים',
      wrong: `${en('sympathetic')} = סימפטי · ${en('actually')} = אקטואלי`,
      right: `${en('sympathetic')} = אוהד ומבין · ${en('actually')} = למעשה, בעצם`,
      why: 'יש מילים שנשמעות כמו מילה עברית מוכרת ופירושן שונה לגמרי. הן נקראות "חברים מדומים" והן מלכודת מבחן קלאסית — הן נראות קלות, ולכן לא בודקים אותן. כשמילה נראית מוכרת מדי, זה בדיוק הרגע לוודא.'
    },
    {
      kind: 'recap',
      bullets: [
        'לומדים מילה בתוך משפט, לא ברשימה מול תרגום.',
        'מקבצים לפי נושא, לפי ניגוד או לפי משפחת מילים.',
        'עדיף 5 מילים שאפשר להשתמש בהן מ-20 שרק ראית.',
        'מילה לא מוכרת במבחן — נחש מההקשר והמשך לקרוא.',
        'מילה שנשמעת מוכרת מדי היא לפעמים חבר מדומה.'
      ]
    }
  ]
};

const articles = {
  id: 'english-articles',
  subject: 'english',
  grades: [4],
  topics: ['a / an'],
  title: 'a או an',
  intro: 'הכלל האמיתי הוא על הצליל, לא על האות.',
  minutes: 5,
  cards: [
    {
      kind: 'concept',
      title: 'למה בכלל יש שתי צורות',
      lead: 'כדי שלא ייווצרו שתי תנועות רצופות שקשה להגות.',
      body: [
        `נסה לומר ${en('a apple')} בקול — שתי תנועות נפגשות והמילים נדבקות. לכן אומרים ${en('an apple')}.`,
        `לעומת זאת ${en('a book')} זורם בקלות, כי ${en('b')} הוא עיצור.`,
        `זה הכל. ה-${en('n')} נוספה רק כדי להפריד בין שתי תנועות.`
      ],
      rule: 'an לפני צליל תנועה (a, e, i, o, u). a לפני כל צליל אחר.'
    },
    {
      kind: 'pitfall',
      title: 'הכלל הוא על הצליל, לא על האות',
      wrong: `${en('an university')} · ${en('a hour')}`,
      right: `${en('a university')} · ${en('an hour')}`,
      why: `${en('university')} מתחילה באות תנועה אבל נשמעת ${en('yu')} — צליל עיצור, ולכן ${en('a')}. ${en('hour')} מתחילה בעיצור אבל ה-${en('h')} שותקת ונשמע ${en('our')} — צליל תנועה, ולכן ${en('an')}. תמיד תגיד את המילה בקול לפני שתחליט.`
    },
    {
      kind: 'example',
      title: 'מחליטים במקרים מבלבלים',
      problem: `מה נכון: ${en('___ honest man')}, ${en('___ European city')}, ${en('___ MP3 player')}?`,
      solution: [
        `${en('honest')} — ה-${en('h')} שותקת, נשמע ${en('onest')}, צליל תנועה ← ${en('an honest man')}`,
        `${en('European')} — נשמע ${en('yu-ropean')}, צליל עיצור ← ${en('a European city')}`,
        `${en('MP3')} — קוראים את האות ${en('M')} כ-${en('em')}, צליל תנועה ← ${en('an MP3 player')}`
      ],
      answer: `${en('an honest man')} · ${en('a European city')} · ${en('an MP3 player')}`,
      note: 'בראשי תיבות ההגייה קובעת, לא הכתיב. מבחן זריז: אמור את זה בקול. האוזן כמעט תמיד צודקת.'
    },
    {
      kind: 'concept',
      title: 'מתי לא שמים כלום',
      lead: `${en('a')} ו-${en('an')} מופיעים רק לפני שם עצם ביחיד שאפשר לספור.`,
      body: [
        `ברבים אין ${en('a')}: אומרים ${en('books')}, לא ${en('a books')}.`,
        `לפני חומרים ומושגים מופשטים גם אין: ${en('water')}, ${en('music')}, ${en('happiness')}.`,
        `${en('the')} זה משהו אחר — הוא מציין דבר <strong>מסוים</strong>. ${en('a book')} זה איזשהו ספר; ${en('the book')} זה הספר שדיברנו עליו.`
      ],
      rule: 'a/an — יחיד וסָפִיר בלבד. the — משהו מסוים שכבר ידוע.'
    },
    {
      kind: 'recap',
      bullets: [
        'an לפני צליל תנועה, a לפני צליל עיצור.',
        'הצליל קובע, לא האות: a university, an hour.',
        'בראשי תיבות ההגייה קובעת: an MP3.',
        'אין a/an לפני רבים או לפני חומרים ומושגים.',
        'a = איזשהו · the = המסוים שדיברנו עליו.'
      ]
    }
  ]
};

const presentSimple = {
  id: 'english-present-simple',
  subject: 'english',
  grades: [4, 5],
  topics: ['זמן הווה פשוט'],
  title: 'Present Simple — הווה פשוט',
  intro: 'מתי מוסיפים s-, ולמה דווקא לגוף שלישי.',
  minutes: 6,
  cards: [
    {
      kind: 'concept',
      title: 'זמן של הרגלים, לא של הרגע',
      lead: 'ההווה הפשוט מתאר מה קורה בדרך כלל — לא מה קורה ממש עכשיו.',
      visual: { shape: 'verbTimeline', past: 'played', now: 'plays', highlight: 'now' },
      body: [
        `${en('I play football')} = אני משחק כדורגל (בדרך כלל, פעם בשבוע).`,
        `למה שקורה ברגע זה יש זמן אחר: ${en('I am playing football')} = אני משחק עכשיו.`,
        `מילים שמסגירות הווה פשוט: ${en('always, usually, often, sometimes, never, every day')}.`
      ],
      rule: 'הווה פשוט = הרגל, שגרה, עובדה קבועה.'
    },
    {
      kind: 'steps',
      title: 'הכלל היחיד: s- לגוף שלישי יחיד',
      problem: `מתי מוסיפים ${en('s')} לפועל?`,
      steps: [
        { text: 'לכל הגופים הפועל נשאר בצורת הבסיס.', expr: en('I / you / we / they play') },
        { text: 'רק לגוף שלישי יחיד מוסיפים s. אלה he, she, it — או שם של אדם או דבר אחד.', expr: en('he / she / it plays') },
        { text: 'פועל שנגמר ב-o, ch, sh, s, x מקבל es.', expr: en('go → goes · watch → watches · wash → washes') },
        { text: 'עיצור + y הופך ל-ies.', expr: en('study → studies · cry → cries') },
        { text: 'ושלושה חריגים ששווה להכיר.', expr: en('have → has · be → is · do → does') }
      ]
    },
    {
      kind: 'pitfall',
      title: 'הטעות: s- אחרי does',
      wrong: en("She doesn't likes pizza."),
      right: en("She doesn't like pizza."),
      why: `ה-${en('s')} כבר יושבת על ${en('does')}. אחריו הפועל חוזר לצורת הבסיס, בדיוק כמו שאחרי ${en('did')} בזמן עבר. אותו דבר בשאלה: ${en('Does she like pizza?')} — לא ${en('likes')}. סימן s אחד בלבד במשפט.`
    },
    {
      kind: 'example',
      title: 'משפט אחד בשלוש צורות',
      problem: `הפוך את ${en('My brother watches TV every evening')} לשלילה ולשאלה.`,
      solution: [
        `${en('My brother')} הוא גוף שלישי יחיד, ולכן החיובי הוא ${en('watches')}.`,
        `בשלילה ה-es עוברת ל-does: ${en("My brother doesn't watch TV every evening.")}`,
        `בשאלה ה-does עולה להתחלה: ${en('Does my brother watch TV every evening?')}`,
        `שים לב שבשתי הצורות האחרונות הפועל חזר ל-${en('watch')} נקי.`
      ],
      answer: `${en("doesn't watch")} · ${en('Does ... watch?')}`,
      note: 'זו בדיוק אותה מכניקה של זמן עבר, רק עם does במקום did. מי שהבין אחד מהם מבין את השני.'
    },
    {
      kind: 'recap',
      bullets: [
        'הווה פשוט מתאר הרגל ושגרה, לא את הרגע הנוכחי.',
        'מוסיפים s רק ל-he, she, it.',
        'o/ch/sh/s/x מקבלים es; עיצור+y הופך ל-ies.',
        'have → has, be → is, do → does.',
        "אחרי does או doesn't הפועל חוזר לבסיס — סימן s אחד במשפט."
      ]
    }
  ]
};

const irregularPlurals = {
  id: 'english-irregular-plurals',
  subject: 'english',
  grades: [4, 6],
  topics: ['רבים חריגים'],
  title: 'רבים חריגים',
  intro: 'איפה s- לא עובד, ומה כן.',
  minutes: 5,
  cards: [
    {
      kind: 'concept',
      title: 'רוב הרבים קלים',
      lead: `ברוב שמות העצם פשוט מוסיפים ${en('s')}, ורק קומץ מתנהג אחרת.`,
      body: [
        `${en('book → books')} · ${en('car → cars')} · ${en('table → tables')}`,
        `אחרי ${en('s, ch, sh, x')} מוסיפים ${en('es')} כדי שאפשר יהיה להגות: ${en('box → boxes')}.`,
        `עיצור + ${en('y')} הופך ל-${en('ies')}: ${en('city → cities')}. אבל תנועה + ${en('y')} נשאר רגיל: ${en('boy → boys')}.`
      ],
      rule: 'ברירת מחדל s-. הכללים האחרים הם התאמות הגייה.'
    },
    {
      kind: 'concept',
      title: 'החריגים האמיתיים',
      lead: 'אלה לא מקבלים סיומת בכלל — הם משנים את עצמם.',
      body: [
        `<strong>משנים תנועה</strong>: ${en('man → men')} · ${en('woman → women')} · ${en('foot → feet')} · ${en('tooth → teeth')} · ${en('goose → geese')}`,
        `<strong>סיומת en-</strong>: ${en('child → children')} · ${en('ox → oxen')}`,
        `<strong>לא משתנים כלל</strong>: ${en('sheep → sheep')} · ${en('fish → fish')} · ${en('deer → deer')}`,
        `<strong>f הופכת ל-ves</strong>: ${en('leaf → leaves')} · ${en('knife → knives')} · ${en('wife → wives')}`
      ],
      aside: 'זו רשימה סגורה של כמה עשרות מילים, והן מהנפוצות ביותר בשפה — ולכן שווה להשקיע בהן.'
    },
    {
      kind: 'pitfall',
      title: 'הטעות: להוסיף s לחריג',
      wrong: `${en('childs')} · ${en('mans')} · ${en('foots')} · ${en('sheeps')}`,
      right: `${en('children')} · ${en('men')} · ${en('feet')} · ${en('sheep')}`,
      why: `חריג כבר <strong>נמצא</strong> ברבים — אין מה להוסיף לו. ${en('children')} הוא כבר הרבים, ו-${en('childrens')} הוא רבים של רבים. אותו דבר ב-${en('sheep')}: אותה מילה משמשת ליחיד ולרבים, והמספר מגיע מההקשר.`
    },
    {
      kind: 'example',
      title: 'מזהים בתוך משפט',
      problem: `מה חסר: ${en('Three ___ (child) are playing with two ___ (mouse).')}`,
      solution: [
        `${en('three')} מסמן רבים, ו-${en('child')} הוא חריג שמשנה צורה.`,
        `${en('child → children')}`,
        `${en('two')} מסמן רבים גם כן, ו-${en('mouse')} משנה תנועה.`,
        `${en('mouse → mice')}`
      ],
      answer: en('Three children are playing with two mice.'),
      note: `שים לב לפועל: ${en('are')} ולא ${en('is')}. אחרי נושא ברבים גם הפועל עובר לרבים — טעות שקל לפספס אחרי שכבר התאמצת על שם העצם.`
    },
    {
      kind: 'recap',
      bullets: [
        'ברירת המחדל היא s-, וכללי es/ies הם התאמות הגייה.',
        'החריגים משנים תנועה (man→men), מקבלים en (child→children), או לא משתנים (sheep).',
        'f בסוף הופכת בדרך כלל ל-ves.',
        'לא מוסיפים s לחריג — הוא כבר ברבים.',
        'נושא ברבים גורר גם פועל ברבים.'
      ]
    }
  ]
};

const opposites = {
  id: 'english-opposites',
  subject: 'english',
  grades: [5, 6, 8, 10, 12],
  topics: ['ניגודים'],
  title: 'ניגודים באנגלית',
  intro: 'זוגות שנלמדים יחד, ותחיליות ששוללות מילה.',
  minutes: 6,
  cards: [
    {
      kind: 'concept',
      title: 'זוג נזכר יותר טוב מיחיד',
      lead: 'ניגוד הוא הדרך היעילה ביותר לזכור מילה — שתי מילים במחיר אחת.',
      body: [
        `${en('big / small')} · ${en('hot / cold')} · ${en('fast / slow')} · ${en('early / late')}`,
        `${en('easy / difficult')} · ${en('clean / dirty')} · ${en('full / empty')} · ${en('strong / weak')}`,
        'כשאתה פוגש מילה חדשה, שאל מיד מה ההפך שלה. אם אתה יודע — קיבלת חיזוק. אם לא — קיבלת מילה נוספת ללמוד.'
      ],
      rule: 'לומדים ניגודים בזוגות, לא בנפרד.'
    },
    {
      kind: 'concept',
      title: 'תחיליות שהופכות משמעות',
      lead: 'לפעמים לא צריך מילה חדשה — מספיק להוסיף תחילית.',
      body: [
        `<strong>un-</strong> — הנפוצה ביותר: ${en('happy → unhappy')} · ${en('fair → unfair')} · ${en('able → unable')}`,
        `<strong>im-</strong> לפני m ו-p: ${en('possible → impossible')} · ${en('polite → impolite')}`,
        `<strong>in-</strong>: ${en('correct → incorrect')} · ${en('visible → invisible')}`,
        `<strong>dis-</strong>: ${en('agree → disagree')} · ${en('like → dislike')} · ${en('honest → dishonest')}`
      ],
      aside: 'אין כלל שקובע איזו תחילית מתאימה לאיזו מילה — זה נלמד מחשיפה. אבל im- כמעט תמיד לפני m ו-p, וזה כן כלל שימושי.'
    },
    {
      kind: 'pitfall',
      title: 'הטעות: להמציא תחילית',
      wrong: `${en('unpossible')} · ${en('inhappy')}`,
      right: `${en('impossible')} · ${en('unhappy')}`,
      why: `לכל מילה יש תחילית אחת נכונה, ואי אפשר לנחש. אם אינך בטוח, עדיף להשתמש בניגוד מלא שאתה כן מכיר — למשל במקום להמציא צורה, לכתוב ${en('very hard')}. במבחן, ניסוח נכון עדיף על מילה מומצאת.`
    },
    {
      kind: 'example',
      title: 'ניגוד תלוי הקשר',
      problem: `מה ההפך של ${en('light')}?`,
      solution: [
        `תלוי לגמרי במשמעות במשפט. ל-${en('light')} יש שתי משמעויות שונות.`,
        `${en('a light bag')} = תיק קל במשקל ← ההפך הוא ${en('heavy')}`,
        `${en('a light room')} = חדר מואר ← ההפך הוא ${en('dark')}`,
        `לכן חייבים לקרוא את המשפט השלם לפני שבוחרים ניגוד.`
      ],
      answer: `${en('heavy')} או ${en('dark')} — לפי ההקשר.`,
      note: 'זו מלכודת מבחן שכיחה: נותנים מילה עם שתי משמעויות ובודקים אם קראת את המשפט או רק את המילה.'
    },
    {
      kind: 'recap',
      bullets: [
        'לומדים מילים בזוגות של ניגודים.',
        'un-, im-, in-, dis- הופכות משמעות.',
        'im- כמעט תמיד לפני m ו-p.',
        'לא ממציאים תחילית — עדיף ניסוח מלא שאתה בטוח בו.',
        'למילה עם כמה משמעויות יש כמה ניגודים. ההקשר מכריע.'
      ]
    }
  ]
};

const prepositions = {
  id: 'english-prepositions',
  subject: 'english',
  grades: [6, 7, 8, 9, 10, 11, 12],
  topics: ['מילות יחס'],
  title: 'מילות יחס — in, on, at',
  intro: 'שיטת המשפך: מהגדול לקטן, גם במקום וגם בזמן.',
  minutes: 7,
  cards: [
    {
      kind: 'concept',
      title: 'משפך: מהגדול אל הקטן',
      lead: 'שלוש המילים מסודרות לפי גודל — וזה עובד גם במקום וגם בזמן.',
      body: [
        `<strong>${en('in')}</strong> — הגדול ביותר. משהו <strong>בתוך</strong> מרחב: ${en('in Israel')} · ${en('in the room')} · ${en('in the box')}`,
        `<strong>${en('on')}</strong> — האמצעי. משהו <strong>על משטח</strong>: ${en('on the table')} · ${en('on the wall')} · ${en('on the bus')}`,
        `<strong>${en('at')}</strong> — הקטן ביותר. <strong>נקודה מסוימת</strong>: ${en('at the door')} · ${en('at school')} · ${en('at the bus stop')}`
      ],
      rule: 'in = בתוך מרחב · on = על משטח · at = נקודה.'
    },
    {
      kind: 'concept',
      title: 'אותו משפך בזמן',
      lead: 'בדיוק אותו סדר: תקופה, יום, שעה.',
      visual: { shape: 'verbTimeline', past: 'in 2020', now: 'at 8:00', highlight: 'now' },
      body: [
        `<strong>${en('in')}</strong> — תקופות ארוכות: ${en('in 2024')} · ${en('in May')} · ${en('in the morning')} · ${en('in summer')}`,
        `<strong>${en('on')}</strong> — ימים ותאריכים: ${en('on Monday')} · ${en('on my birthday')} · ${en('on May 5th')}`,
        `<strong>${en('at')}</strong> — שעות ורגעים: ${en("at 8 o'clock")} · ${en('at noon')} · ${en('at night')}`,
        'שים לב שזה אותו היגיון: שנה גדולה מיום, ויום גדול משעה.'
      ],
      aside: `${en('at night')} הוא יוצא דופן קטן — אפשר לחשוב עליו כעל נקודה בסוף היום. ${en('in the morning')} לעומת זאת הוא תקופה.`
    },
    {
      kind: 'pitfall',
      title: 'הטעות: לתרגם מעברית',
      wrong: `${en('I am in the bus')} · ${en('depend of')} · ${en('good in math')}`,
      right: `${en('I am on the bus')} · ${en('depend on')} · ${en('good at math')}`,
      why: 'מילות יחס כמעט אף פעם לא מתורגמות מילולית. בעברית אומרים "באוטובוס", אבל באנגלית אוטובוס נחשב משטח שעולים עליו. וחלק מהצירופים פשוט נקבעו כך ואין בהם היגיון — אלה נלמדים כיחידה אחת, לא כמילה ועוד מילה.'
    },
    {
      kind: 'example',
      title: 'משפט עם שלושתן',
      problem: `השלם: ${en('We met ___ the café ___ Friday ___ 7 pm.')}`,
      solution: [
        `${en('café')} — מקום מסוים שנפגשים בו, נקודה על המפה ← ${en('at')}`,
        `${en('Friday')} — יום בשבוע ← ${en('on')}`,
        `${en('7 pm')} — שעה מדויקת ← ${en('at')}`
      ],
      answer: en('We met at the café on Friday at 7 pm.'),
      note: 'שים לב שהמשפט הולך מהגדול לקטן: מקום, ואז יום, ואז שעה. זה גם סדר המילים הטבעי באנגלית.'
    },
    {
      kind: 'recap',
      bullets: [
        'in = מרחב · on = משטח · at = נקודה.',
        'בזמן: in לתקופה, on ליום, at לשעה.',
        'לא מתרגמים מילות יחס מעברית.',
        'צירופים קבועים (depend on, good at) נלמדים כיחידה.',
        'סדר טבעי במשפט: מקום, יום, שעה.'
      ]
    }
  ]
};

const comparatives = {
  id: 'english-comparatives',
  subject: 'english',
  grades: [7, 8, 9, 11],
  topics: ['דרגות השוואה'],
  title: 'דרגות השוואה',
  intro: 'מתי er- ומתי more, ואיך לא לעשות השוואה כפולה.',
  minutes: 7,
  cards: [
    {
      kind: 'concept',
      title: 'שלוש דרגות',
      lead: 'רגילה, משווה בין שניים, ומעולה — הכי מכולם.',
      body: [
        `<strong>רגילה</strong>: ${en('tall')} — גבוה.`,
        `<strong>משווה</strong>: ${en('taller than')} — גבוה יותר מ־. תמיד עם ${en('than')}.`,
        `<strong>מעולה</strong>: ${en('the tallest')} — הגבוה ביותר. תמיד עם ${en('the')}.`,
        `שתי המילים הקטנות האלה הן הסימן: ${en('than')} מסגיר השוואה, ${en('the')} מסגיר מעולה.`
      ],
      rule: 'משווה → than · מעולה → the.'
    },
    {
      kind: 'steps',
      title: 'איך יודעים אם er- או more',
      problem: 'האורך של המילה קובע.',
      steps: [
        { text: 'הברה אחת — תמיד er ו-est.', expr: en('big → bigger → the biggest') },
        { text: 'שתי הברות שנגמרות ב-y — הופכים ל-ier ו-iest.', expr: en('happy → happier → the happiest') },
        { text: 'שתי הברות ומעלה (שאינן ב-y) — משתמשים ב-more ו-the most.', expr: en('careful → more careful → the most careful') },
        { text: 'ויש חריגים שאין בהם היגיון — נלמדים בעל פה.', expr: en('good → better → the best · bad → worse → the worst') },
        { text: 'עוד שניים נפוצים.', expr: en('far → further · many/much → more → the most') }
      ]
    },
    {
      kind: 'pitfall',
      title: 'הטעות: השוואה כפולה',
      wrong: `${en('more bigger')} · ${en('the most tallest')}`,
      right: `${en('bigger')} · ${en('the tallest')}`,
      why: `ה-${en('er')} כבר אומרת "יותר", ולכן ${en('more')} לפניה אומרת "יותר יותר". בוחרים אחד מהשניים — או הסיומת או המילה, אף פעם לא את שניהם. זו אותה לוגיקה של "עבר כפול" ב-${en("didn't went")}: סימן דקדוקי אחד מספיק.`
    },
    {
      kind: 'example',
      title: 'משפט מלא בשלוש דרגות',
      problem: `השווה: ${en('Dan (tall) than Ron, but Ami is (tall) in the class.')}`,
      solution: [
        `${en('tall')} היא הברה אחת ← מקבלת ${en('er')}.`,
        `יש ${en('than')} במשפט, ולכן זו דרגת השוואה: ${en('Dan is taller than Ron')}`,
        `בחלק השני משווים לכל הכיתה — זו הדרגה המעולה.`,
        `מעולה דורשת ${en('the')} וסיומת ${en('est')}: ${en('Ami is the tallest in the class')}`
      ],
      answer: en('Dan is taller than Ron, but Ami is the tallest in the class.'),
      note: `כשמשווים שני דברים שווים משתמשים במבנה אחר לגמרי: ${en('Dan is as tall as Ron')} — "גבוה כמו".`
    },
    {
      kind: 'recap',
      bullets: [
        'שלוש דרגות: רגילה, משווה (than), מעולה (the ... est).',
        'הברה אחת → er/est. שלוש הברות ומעלה → more/the most.',
        'שתי הברות ב-y → ier/iest.',
        'good→better→best, bad→worse→worst — בעל פה.',
        'לעולם לא more ו-er יחד.'
      ]
    }
  ]
};

const clozeLesson = {
  id: 'english-cloze',
  subject: 'english',
  grades: [6, 7, 8, 9, 10, 11, 12],
  topics: ['השלמת משפט'],
  title: 'השלמת משפט',
  intro: 'כמה חסרים במשפט אחד — ואיך לא לפתור אותם בנפרד.',
  minutes: 6,
  cards: [
    {
      kind: 'concept',
      title: 'המשפט הוא יחידה אחת',
      lead: 'כל חסר משפיע על השאר, ולכן לא פותרים אותם בבידוד.',
      body: [
        'קרא את המשפט <strong>כולו</strong> פעם אחת לפני שאתה ממלא משהו.',
        'התחל מהחסר שאתה הכי בטוח בו — הוא מצמצם את האפשרויות לשאר.',
        `לדוגמה, אם מילאת ${en('yesterday')} באחד החסרים, כל הפעלים במשפט חייבים להיות בעבר.`,
        'לבסוף קרא את המשפט המלא עם כל התשובות. אם משהו צורם — אחד מהם שגוי.'
      ],
      rule: 'קרא הכול → מלא את הבטוח → בדוק התאמה → קרא שוב.'
    },
    {
      kind: 'concept',
      title: 'מה בודקים בכל חסר',
      lead: 'שלוש שאלות, בסדר הזה.',
      body: [
        '<strong>1. חלק דיבר</strong> — צריך כאן פועל, שם עצם או תואר? המבנה קובע.',
        '<strong>2. זמן והתאמה</strong> — אם זה פועל, באיזה זמן, ומי הנושא שלו.',
        '<strong>3. משמעות</strong> — רק אם שתי אפשרויות שרדו את הראשונות.',
        'רוב המסיחים נופלים כבר בשלב הראשון או השני, בלי צורך להבין את המשפט לעומק.'
      ],
      aside: `שים לב לסימנים קטנים: ${en('a')} או ${en('an')} לפני החסר מסגירים שאחריו בא שם עצם ביחיד.`
    },
    {
      kind: 'example',
      title: 'סדר הפתרון',
      problem: en('Yesterday she ___ to the store and ___ some milk.'),
      solution: [
        `${en('Yesterday')} קובע את הזמן לכל המשפט — עבר.`,
        `החסר הראשון הוא פועל תנועה אחרי נושא: ${en('went')}.`,
        `ה-${en('and')} מחבר שני פעלים לאותו נושא ולאותו זמן.`,
        `לכן גם השני בעבר: ${en('bought')} — לא ${en('buy')}.`
      ],
      answer: en('Yesterday she went to the store and bought some milk.'),
      note: 'המילה שקבעה הכול היתה הראשונה במשפט. תמיד חפש את מילת הזמן לפני שאתה ממלא פועל.'
    },
    {
      kind: 'pitfall',
      title: 'למלא כל חסר בנפרד',
      wrong: en('Yesterday she went to the store and buys some milk.'),
      right: en('Yesterday she went to the store and bought some milk.'),
      why: 'כל חסר נראה סביר לבדו, אבל יחד הם סותרים: אותו משפט אינו יכול להיות גם בעבר וגם בהווה. זו בדיוק הסיבה שהשאלה מכילה כמה חסרים — היא בודקת אם קראת אותם כיחידה.'
    },
    {
      kind: 'recap',
      bullets: [
        'קוראים את המשפט כולו לפני שממלאים.',
        'מתחילים מהחסר הבטוח ביותר.',
        'בודקים חלק דיבר, ואז זמן והתאמה, ורק אז משמעות.',
        'מילת זמן אחת קובעת את כל הפעלים במשפט.',
        'קוראים את המשפט המלא בסוף.'
      ]
    }
  ]
};

const vocabSorting = {
  id: 'english-vocab-sorting',
  subject: 'english',
  grades: [7, 8, 9, 10, 11, 12],
  topics: ['אוצר מילים - מיון'],
  title: 'מיון אוצר מילים',
  intro: 'לבחור את כל המילים שמתאימות — לא רק אחת.',
  minutes: 6,
  cards: [
    {
      kind: 'concept',
      title: 'שאלה עם כמה תשובות נכונות',
      lead: 'זה סוג שאלה אחר, והניקוד בו חלקי.',
      body: [
        'נדרש לסמן את <strong>כל</strong> המילים ששייכות לקטגוריה — לפעמים שתיים, לפעמים שלוש.',
        'סימון נכון מוסיף, אבל סימון שגוי <strong>מוריד</strong>. לכן לא כדאי לסמן "ליתר ביטחון".',
        'עבור על כל אפשרות בנפרד ושאל: האם היא שייכת? כן או לא — בלי לחשוב על השאר.',
        'הכלל: סמן רק מה שאתה בטוח בו.'
      ],
      rule: 'בודקים כל מילה בנפרד. מסמנים רק את הוודאי.'
    },
    {
      kind: 'concept',
      title: 'סוגי הקטגוריות הנפוצות',
      lead: 'הקטגוריה מגדירה את מבחן ההשתייכות.',
      body: [
        `<strong>שדה סמנטי</strong>: ${en('kitchen — fridge, oven, plate')} — כולן מאותו עולם.`,
        `<strong>חלק דיבר</strong>: אילו מהן פעלים? אילו שמות תואר?`,
        `<strong>זמן</strong>: אילו מהן צורות עבר? כאן חריגים כמו ${en('went')} קלים לפספס.`,
        `<strong>ניגוד</strong>: אילו מהן הפכים של המילה הנתונה?`
      ],
      aside: 'זהה את הקטגוריה לפני שאתה מסתכל באפשרויות. בלי זה אתה בודק כל מילה לפי קריטריון מעורפל.'
    },
    {
      kind: 'example',
      title: 'בודקים אחת־אחת',
      problem: `אילו מהמילים הן צורות עבר? ${en('went, sings, bought, running')}`,
      solution: [
        `${en('went')} — עבר של ${en('go')}, חריג. ✓`,
        `${en('sings')} — הווה, גוף שלישי יחיד. ✗`,
        `${en('bought')} — עבר של ${en('buy')}, חריג. ✓`,
        `${en('running')} — צורת ing, לא עבר. ✗`
      ],
      answer: `${en('went')} ו-${en('bought')}`,
      note: 'שתי התשובות הן חריגים, ואף אחת מהן לא נגמרת ב-ed. מי שחיפש רק סיומת ed היה מסמן אפס.'
    },
    {
      kind: 'pitfall',
      title: 'לסמן הכול ליתר ביטחון',
      wrong: 'מסמנים ארבע מתוך ארבע כדי לא לפספס',
      right: 'מסמנים רק את מה שעומד במבחן',
      why: 'הניקוד מחסיר על סימון שגוי, ולכן סימון גורף מבטל את עצמו ולפעמים אף גורע. שתי תשובות נכונות עדיפות על ארבע שמתוכן שתיים שגויות.'
    },
    {
      kind: 'recap',
      bullets: [
        'יש יותר מתשובה נכונה אחת, והניקוד חלקי.',
        'סימון שגוי מוריד — לא מסמנים בניחוש.',
        'מזהים את הקטגוריה לפני שקוראים אפשרויות.',
        'בודקים כל מילה בנפרד, כן או לא.',
        'חריגים לא נראים כמו הכלל — בודקים לגופם.'
      ]
    }
  ]
};

const readingComprehension = {
  id: 'english-reading',
  subject: 'english',
  grades: [8, 9, 10, 11, 12],
  topics: ['הבנת הנקרא'],
  title: 'Reading Comprehension',
  intro: 'לקרוא בשביל המבנה, ולחזור לטקסט לכל תשובה.',
  minutes: 7,
  cards: [
    {
      kind: 'concept',
      title: 'קורא את הקטע, לא משנן אותו',
      lead: 'המטרה בקריאה הראשונה היא המבנה, לא הפרטים.',
      body: [
        'קרא פעם אחת במהירות וענה לעצמך: על מה הקטע, ומה עמדת הכותב.',
        'הפרטים לא צריכים להיזכר — הם יישארו בטקסט, ותחזור אליהם לפי הצורך.',
        'שים לב למילות מעבר: ${en("however")}, ${en("therefore")}, ${en("in contrast")} — הן מסמנות את מבנה הטיעון.',
        'רק אז עבור לשאלות.'
      ],
      rule: 'קריאה ראשונה למבנה. הפרטים נשארים בטקסט.'
    },
    {
      kind: 'concept',
      title: 'ארבעה סוגי שאלות',
      lead: 'לכל סוג שיטת מענה משלו.',
      body: [
        '<strong>פרט ספציפי</strong> — חזור לטקסט ומצא את השורה. אל תענה מהזיכרון.',
        '<strong>רעיון מרכזי</strong> — התשובה מכסה את כל הקטע, לא פסקה אחת.',
        '<strong>מילה בהקשר</strong> — קרא את המשפט שסביבה; המשמעות המילונית עשויה לא להתאים.',
        '<strong>הסקה</strong> — נובע מהטקסט אך אינו כתוב בו במפורש. חייב להישען על משהו כתוב.'
      ],
      aside: 'לכל תשובה נכונה יש עוגן בטקסט. אם אינך יכול להצביע על השורה — כנראה בחרת לפי היגיון כללי ולא לפי הקטע.'
    },
    {
      kind: 'example',
      title: 'מילה בהקשר',
      problem: en('The company decided to table the proposal until next year.'),
      solution: [
        `המשמעות המוכרת של ${en('table')} היא שולחן — לא מתאימה כפועל.`,
        `קוראים את ההקשר: ${en('until next year')} מסמן דחייה.`,
        'לכן הפועל כאן פירושו לדחות, לא להעלות לדיון.',
        'ההקשר הכריע, לא המילון.'
      ],
      answer: `${en('table')} כאן = לדחות.`,
      note: 'שאלות "מילה בהקשר" בוחרות תמיד מילה רב־משמעית, והמסיח הוא המשמעות הנפוצה יותר. ההקשר הוא הראיה היחידה.'
    },
    {
      kind: 'pitfall',
      title: 'לבחור תשובה נכונה שאינה בטקסט',
      wrong: 'התשובה נשמעת הגיונית ונכונה במציאות',
      right: 'התשובה חייבת לנבוע מהקטע הזה',
      why: 'מסיח קלאסי הוא אמירה נכונה בעולם שהקטע פשוט לא אמר. השאלה בודקת קריאה, לא ידע כללי. לפני שאתה מסמן — הצבע על השורה שממנה זה נובע.'
    },
    {
      kind: 'recap',
      bullets: [
        'קריאה ראשונה למבנה ולעמדת הכותב.',
        'חוזרים לטקסט לכל שאלת פרט.',
        'רעיון מרכזי מכסה את כל הקטע.',
        'מילה בהקשר נקבעת מהמשפט, לא מהמילון.',
        'לכל תשובה נכונה יש שורה שתומכת בה.'
      ]
    }
  ]
};


// --- the tenses, the modals and the articles --------------------------
//
// Authored alongside the generators that produce these topics. Each lesson's
// `grades` list is exactly the grades whose generator array contains a flat
// (non-parts) generator for the topic — see the note on pastTense for why a
// grade listed without one gives the student an empty readiness quiz.

const presentProgressive = {
  id: 'english-present-progressive',
  subject: 'english',
  grades: [5, 6, 7],
  topics: ['הווה מתמשך', 'צורת ing'],
  title: 'Present Progressive — מה קורה עכשיו',
  intro: 'ההבדל בין "אני קורא כל יום" ל"אני קורא בדיוק ברגע זה", ואיך מאייתים את ing-.',
  minutes: 7,
  cards: [
    {
      kind: 'concept',
      title: 'שני הווים, לא אחד',
      lead: 'לעברית יש צורת הווה אחת. לאנגלית יש שתיים, והן אומרות דברים שונים.',
      visual: { shape: 'verbTimeline', past: 'read', now: 'am reading', highlight: 'now' },
      body: [
        `${en('I read every evening')} — אני קורא כל ערב. הרגל, לא רגע.`,
        `${en('I am reading now')} — אני קורא ברגע זה. פעולה שנמצאת באמצע.`,
        'בעברית שני המשפטים מתורגמים "אני קורא", ולכן צריך להחליט לפי המשמעות ולא לפי התרגום.'
      ],
      rule: 'הווה מתמשך = am / is / are + פועל + ing.'
    },
    {
      kind: 'steps',
      title: 'שני חלקים, ושניהם חייבים להיות שם',
      problem: 'איך בונים את הצורה?',
      visual: { shape: 'verbTimeline', past: 'played', now: 'is playing', highlight: 'now' },
      steps: [
        {
          text: 'בוחרים את צורת be שמתאימה לנושא.',
          expr: en('I am · he / she / it is · we / you / they are'),
          highlight: 'now'
        },
        {
          text: 'מוסיפים ing לפועל.',
          expr: en('play → playing · watch → watching')
        },
        {
          text: 'מחברים.',
          expr: en('She is playing. · They are watching.')
        }
      ]
    },
    {
      kind: 'steps',
      title: 'כללי האיות של ing-',
      problem: 'לפעמים האות האחרונה משתנה. שלושה כללים מכסים כמעט הכול.',
      steps: [
        {
          text: 'ברירת מחדל — פשוט מוסיפים ing.',
          expr: en('walk → walking · sleep → sleeping · eat → eating')
        },
        {
          text: 'פועל שנגמר ב-e שקטה — משמיטים את ה-e.',
          expr: en('write → writing · take → taking · come → coming')
        },
        {
          text: 'הברה אחת שנגמרת בתנועה + עיצור — מכפילים את העיצור.',
          expr: en('run → running · sit → sitting · stop → stopping')
        },
        {
          text: 'פועל שנגמר ב-ie — הצירוף הופך ל-y.',
          expr: en('lie → lying · die → dying')
        }
      ]
    },
    {
      kind: 'pitfall',
      title: 'הטעות הנפוצה: לשכוח את be',
      wrong: en('She reading a book.'),
      right: en('She is reading a book.'),
      why: `בעברית אין פועל עזר, ולכן ${en('is')} נשמע מיותר. באנגלית הוא חלק מהזמן עצמו — בלעדיו המשפט אינו זמן כלל. גם ההפוך שגוי: ${en('She is read')} חסר את ה-${en('ing')}.`
    },
    {
      kind: 'concept',
      title: 'פעלים שלא באים בהווה מתמשך',
      lead: 'יש פעלים שמתארים מצב ולא פעולה, ולמצב אין "באמצע".',
      body: [
        `${en('know, want, need, love, hate, believe, understand')}`,
        `אומרים ${en('I know the answer')} ולא ${en('I am knowing the answer')}.`,
        'הבדיקה הפשוטה: האם אפשר לעצור באמצע? אפשר לעצור באמצע ריצה. אי אפשר לעצור באמצע ידיעה.'
      ],
      rule: 'פועלי מצב באים בהווה פשוט בלבד.'
    },
    {
      kind: 'recap',
      bullets: [
        'הווה מתמשך: am / is / are + ing, לפעולה שקורית ברגע זה.',
        'הווה פשוט: להרגל ולעובדה קבועה.',
        'איות: משמיטים e שקטה, מכפילים עיצור אחרי תנועה בהברה אחת, ie הופך ל-y.',
        'בלי be אין זמן — זו הטעות שחוזרת יותר מכל אחרת.',
        'פועלי מצב כמו know ו-want לא מקבלים ing.'
      ]
    }
  ]
};

const pastProgressive = {
  id: 'english-past-progressive',
  subject: 'english',
  grades: [7, 8, 9],
  topics: ['עבר מתמשך'],
  title: 'Past Progressive — מה היה באמצע',
  intro: 'הזמן שמתאר רקע: מה נמשך כשמשהו אחר קטע אותו.',
  minutes: 6,
  cards: [
    {
      kind: 'concept',
      title: 'הזמן של הרקע',
      lead: 'עבר פשוט מספר מה קרה. עבר מתמשך מספר מה היה קורה מסביב.',
      visual: { shape: 'verbTimeline', past: 'was reading', now: 'read', highlight: 'past' },
      body: [
        `${en('I was reading when the phone rang.')}`,
        'הקריאה נמשכה. הצלצול קרה בתוכה, בנקודה אחת.',
        'שני זמנים במשפט אחד, וכל אחד עושה עבודה אחרת: אחד רקע, אחד אירוע.'
      ],
      rule: 'עבר מתמשך = was / were + פועל + ing.'
    },
    {
      kind: 'steps',
      title: 'was או were',
      problem: 'לעבר יש רק שתי צורות be, וזו כל ההחלטה.',
      steps: [
        { text: 'יחיד — was.', expr: en('I was · he was · she was · the dog was'), highlight: 'past' },
        { text: 'רבים — were.', expr: en('we were · they were') },
        { text: 'you — תמיד were, גם ליחיד.', expr: en('you were') }
      ]
    },
    {
      kind: 'concept',
      title: 'when ו-while',
      lead: 'שתי המילים מחברות את הרקע לאירוע, ולכל אחת תפקיד קבוע.',
      body: [
        `${en('While I was cooking, the doorbell rang.')} — ${en('while')} בא לפני הפעולה שנמשכה.`,
        `${en('I was cooking when the doorbell rang.')} — ${en('when')} בא לפני האירוע הקצר.`,
        'שני המשפטים אומרים את אותו הדבר. מה שמשתנה הוא איזה חלק פותח.'
      ],
      rule: 'while + מתמשך · when + עבר פשוט.'
    },
    {
      kind: 'pitfall',
      title: 'הטעות: מתמשך במקום פשוט',
      wrong: en('Yesterday I was going to school and I was meeting my friend.'),
      right: en('Yesterday I went to school and met my friend.'),
      why: 'שתי פעולות שהסתיימו ובאו זו אחר זו הן עבר פשוט. עבר מתמשך אינו "עבר מנומס יותר" — הוא שמור לפעולה שנמשכה ברקע.'
    },
    {
      kind: 'recap',
      bullets: [
        'was / were + ing לפעולה שנמשכה בעבר.',
        'was ליחיד, were לרבים ול-you.',
        'while לפני המתמשך, when לפני האירוע הקצר.',
        'רצף של פעולות שהסתיימו — עבר פשוט, לא מתמשך.'
      ]
    }
  ]
};

const future = {
  id: 'english-future',
  subject: 'english',
  grades: [6, 7, 8],
  topics: ['זמן עתיד'],
  title: 'Future — will מול going to',
  intro: 'שתי דרכים לדבר על העתיד, ומה בדיוק מבדיל ביניהן.',
  minutes: 6,
  cards: [
    {
      kind: 'concept',
      title: 'הצורה הפשוטה: will',
      lead: 'אחרי will הפועל תמיד בצורת הבסיס — בלי to, בלי s, בלי ed.',
      visual: { shape: 'verbTimeline', past: 'went', now: 'will go', highlight: 'now' },
      body: [
        `${en('I will call you tomorrow.')}`,
        `${en('She will help us.')} — לא ${en('She will helps us')}.`,
        `שלילה: ${en("won't")}, שהוא קיצור של ${en('will not')}.`
      ],
      rule: 'will + צורת הבסיס, לכל נושא באותה צורה.'
    },
    {
      kind: 'concept',
      title: 'ההבדל האמיתי: מי החליט, ומתי',
      lead: 'will ו-going to אינם שני איותים של אותו דבר. הם מספרים מתי ההחלטה נולדה.',
      body: [
        `${en('The phone is ringing — I will answer it.')} החלטה שנולדה ברגע זה.`,
        `${en('We bought tickets. We are going to fly to London.')} תוכנית שהוחלטה מראש.`,
        'בעברית שני המשפטים הם "אני אענה" ו"אנחנו נטוס", ולכן ההבדל נעלם בתרגום וצריך לחשוב על ההקשר.'
      ],
      rule: 'החלטה ברגע — will. תוכנית מוכנה — going to.'
    },
    {
      kind: 'steps',
      title: 'איך בונים going to',
      problem: 'שלושה חלקים, ורק הראשון משתנה.',
      steps: [
        { text: 'צורת be שמתאימה לנושא.', expr: en('I am · she is · they are') },
        { text: 'המילים going to, שאינן משתנות.', expr: en('going to') },
        { text: 'הפועל בצורת הבסיס.', expr: en('She is going to travel.') }
      ]
    },
    {
      kind: 'pitfall',
      title: 'הטעות: עתיד אחרי if ו-when',
      wrong: en('If it will rain, we will stay home.'),
      right: en('If it rains, we will stay home.'),
      why: `אחרי ${en('if')} ואחרי ${en('when')} בא הווה פשוט, גם כשהכוונה לעתיד. ה-${en('will')} נשאר בחלק השני של המשפט בלבד.`
    },
    {
      kind: 'recap',
      bullets: [
        'will + בסיס — בלי to, בלי s.',
        'will להחלטה של הרגע, לתחזית ולהצעה.',
        'am / is / are going to לתוכנית שכבר הוחלטה.',
        'אחרי if ו-when — הווה פשוט, לא will.'
      ]
    }
  ]
};

const modals = {
  id: 'english-modals',
  subject: 'english',
  // Grade 12 is absent: its generator list has no modal generator, and a grade
  // listed without one hands the student an empty readiness quiz. A
  // twelfth-grader who arrives from a weak-topic chip still reaches this lesson
  // through getLesson's nearest-grade fallback.
  grades: [7, 8, 9, 10, 11],
  topics: ['פעלים מודאליים'],
  title: 'Modals — can, must, should, might',
  intro: 'הפעלים שמוסיפים למשפט יכולת, חובה, המלצה או אפשרות.',
  minutes: 7,
  cards: [
    {
      kind: 'concept',
      title: 'פועל שמשנה את היחס, לא את הזמן',
      lead: 'מודאל לא מספר מה קרה — הוא מספר איך הדובר מתייחס למה שקרה.',
      body: [
        `${en('She swims')} — עובדה.`,
        `${en('She can swim')} — יכולת. ${en('She must swim')} — חובה. ${en('She should swim')} — המלצה.`,
        'הפועל לא זז. כל השינוי הוא במילה שלפניו.'
      ],
      rule: 'אחרי מודאל בא הפועל בצורת הבסיס — בלי to ובלי s.'
    },
    {
      kind: 'concept',
      title: 'מה כל אחד אומר',
      lead: 'הבחירה תלויה במשמעות, ובלי הקשר יותר מאחד יתאים.',
      body: [
        `${en('can')} — יכולת או רשות: ${en('I can swim.')}`,
        `${en('must')} — חובה או איסור: ${en('You must stop at a red light.')}`,
        `${en('should')} — המלצה: ${en('You should sleep earlier.')}`,
        `${en('might / may')} — אפשרות שאינה ודאית: ${en('It might rain.')}`,
        `${en('could')} — יכולת בעבר, או בקשה מנומסת: ${en('Could you help me?')}`
      ]
    },
    {
      kind: 'steps',
      title: 'איך בוחרים מודאל',
      problem: 'הוא אומר לי לעצור באור אדום. איזה מודאל?',
      steps: [
        {
          text: 'שואלים מה סוג היחס: יכולת, חובה, המלצה או אפשרות. כאן זו חובה שהחוק קובע.',
          expr: en('must')
        },
        {
          text: 'מוסיפים את הפועל בצורת הבסיס — בלי to ובלי s.',
          expr: en('must stop')
        },
        {
          text: 'מרכיבים את המשפט.',
          expr: en('You must stop at a red light.')
        },
        {
          text: 'בודקים בשלילה: אסור, ולכן mustn\'t ולא don\'t have to.',
          expr: en("You mustn't cross on a red light.")
        }
      ]
    },
    {
      kind: 'concept',
      title: 'must מול have to, ו-mustn\'t מול don\'t have to',
      lead: 'כאן ההבדל הוא בין איסור ובין היעדר חובה, וזה לא אותו דבר.',
      body: [
        `${en("You mustn't smoke here.")} — אסור.`,
        `${en("You don't have to come.")} — אתה לא חייב, אבל מותר.`,
        'שתי הצורות נשמעות דומות בעברית ("אתה לא צריך"), והמשמעות הפוכה.'
      ],
      rule: "mustn't = אסור. don't have to = לא חייב."
    },
    {
      kind: 'pitfall',
      title: 'הטעות: to אחרי מודאל',
      wrong: en('She can to swim. · He must goes home.'),
      right: en('She can swim. · He must go home.'),
      why: `מודאל הוא עצמו הפועל המוטה, ולכן מה שאחריו הוא צורת בסיס נקייה. אין ${en('to')}, אין ${en('-s')} לגוף שלישי, ואין ${en('-ed')}.`
    },
    {
      kind: 'recap',
      bullets: [
        'מודאל + בסיס. בלי to, בלי s, בלי ed.',
        'can יכולת · must חובה · should המלצה · might אפשרות.',
        "mustn't אסור, אבל don't have to פירושו לא חייב.",
        'בלי הקשר יותר ממודאל אחד מתאים — המשמעות היא שמכריעה.'
      ]
    }
  ]
};

const presentPerfect = {
  id: 'english-present-perfect',
  subject: 'english',
  grades: [9, 10, 11, 12],
  topics: ['הווה מושלם'],
  title: 'Present Perfect — עבר שנוגע בהווה',
  intro: 'למה "איבדתי את המפתחות" ו"איבדתי אותם אתמול" הם שני זמנים שונים באנגלית.',
  minutes: 8,
  cards: [
    {
      kind: 'concept',
      title: 'הזמן שאין לו מקביל בעברית',
      lead: 'הווה מושלם מתאר פעולה מהעבר שהתוצאה שלה עדיין כאן.',
      visual: { shape: 'verbTimeline', past: 'lost', now: 'have lost', highlight: 'now' },
      body: [
        `${en('I have lost my keys.')} — איבדתי, והם עדיין אבודים. זו הנקודה.`,
        `${en('I lost my keys yesterday.')} — אירוע שנגמר, מתוארך, סגור.`,
        'בעברית שני המשפטים הם "איבדתי". ההבדל אינו בזמן שעבר אלא בשאלה אם זה עוד רלוונטי.'
      ],
      rule: 'have / has + הצורה השלישית של הפועל.'
    },
    {
      kind: 'steps',
      title: 'הצורה השלישית',
      problem: 'לפועל אנגלי יש שלוש צורות, ולהווה מושלם דרושה השלישית.',
      steps: [
        { text: 'פועל רגיל — הצורה השלישית זהה לעבר.', expr: en('work → worked → worked') },
        { text: 'חריג — שלוש צורות שונות.', expr: en('go → went → gone · write → wrote → written') },
        { text: 'חריג ששתי צורותיו זהות.', expr: en('buy → bought → bought · make → made → made') },
        { text: 'has לגוף שלישי יחיד, have לכל השאר.', expr: en('She has gone. · They have gone.') }
      ]
    },
    {
      kind: 'concept',
      title: 'since מול for',
      lead: 'שתיהן מתורגמות "מאז" או "במשך", ומה שמכריע הוא מה בא אחריהן.',
      body: [
        `${en('since 2019 · since Monday · since I was ten')} — נקודת התחלה.`,
        `${en('for three years · for two weeks · for a long time')} — משך זמן.`,
        `הבדיקה: אם אפשר לשאול "מתי זה התחיל" — ${en('since')}. אם התשובה היא "כמה זמן" — ${en('for')}.`
      ],
      rule: 'since + נקודה בזמן · for + אורך זמן.'
    },
    {
      kind: 'pitfall',
      title: 'הטעות: הווה מושלם עם תאריך',
      wrong: en('I have seen him yesterday.'),
      right: en('I saw him yesterday.'),
      why: `זמן מוגדר בעבר — ${en('yesterday')}, ${en('last week')}, ${en('in 2019')} — סוגר את האירוע, ולכן דורש עבר פשוט. הווה מושלם אינו מסתדר עם תאריך, כי כל תפקידו הוא לא לתארך.`
    },
    {
      kind: 'concept',
      title: 'already, yet, ever, never',
      lead: 'ארבע המילים שכמעט תמיד מופיעות דווקא בזמן הזה.',
      body: [
        `${en('She has already finished.')} — כבר, מוקדם מהצפוי.`,
        `${en("He hasn't arrived yet.")} — עדיין לא, בשלילה ובשאלה.`,
        `${en('Have you ever been to Rome?')} — אי פעם, בשאלה.`,
        `${en('I have never tried it.')} — מעולם לא.`
      ]
    },
    {
      kind: 'recap',
      bullets: [
        'have / has + צורה שלישית.',
        'לפעולה מהעבר שהתוצאה שלה עדיין רלוונטית.',
        'since לנקודת התחלה, for לאורך זמן.',
        'זמן מוגדר בעבר — עבר פשוט, לא הווה מושלם.',
        'already · yet · ever · never הם המילים שנוסעות עם הזמן הזה.'
      ]
    }
  ]
};

const quantifiers = {
  id: 'english-quantifiers',
  subject: 'english',
  grades: [7, 8, 9, 12],
  topics: ['כמות ומנייה'],
  title: 'Countable — much, many, few, little',
  intro: 'למה אומרים many books אבל much water, ולמה זה תלוי בשם העצם ולא בכמות.',
  minutes: 6,
  cards: [
    {
      kind: 'concept',
      title: 'שני סוגים של שמות עצם',
      lead: 'אנגלית מחלקת שמות עצם לנמנים ולבלתי נמנים, וההחלטה הזאת קובעת איזו מילת כמות מותרת.',
      body: [
        `נמנה — אפשר לספור אותו: ${en('one book, two books, three books')}.`,
        `בלתי נמנה — אין לו רבים: ${en('water, money, time, music, advice')}.`,
        'הבדיקה: האם המילה יכולה לקבל s של רבים? אם כן, היא נמנית.'
      ],
      rule: 'הסוג הוא תכונה של המילה, לא של הכמות.'
    },
    {
      kind: 'steps',
      title: 'איזו מילה עם איזה סוג',
      problem: 'שלושה זוגות, וכל זוג מתחלק באותו קו בדיוק.',
      steps: [
        { text: 'כמה?', expr: en('how many books · how much water') },
        { text: 'הרבה, בשלילה ובשאלה.', expr: en("not many chairs · not much time") },
        { text: 'מעט.', expr: en('a few friends · a little bread') }
      ]
    },
    {
      kind: 'pitfall',
      title: 'המילים שנשמעות נמנות ואינן',
      wrong: en('I need some advices. · She gave me many informations.'),
      right: en('I need some advice. · She gave me a lot of information.'),
      why: `${en('advice')}, ${en('information')}, ${en('homework')}, ${en('furniture')} ו-${en('news')} הן בלתי נמנות באנגלית גם כשהעברית סופרת אותן ("עצות", "ידיעות"). אין להן צורת רבים בכלל.`
    },
    {
      kind: 'concept',
      title: 'a few מול few',
      lead: 'המילית a הופכת את המשמעות מכוס חצי ריקה לחצי מלאה.',
      body: [
        `${en('I have a few friends here.')} — יש לי כמה. זה בסדר.`,
        `${en('I have few friends here.')} — יש לי מעט מדי. זו תלונה.`,
        `אותו דבר ב-${en('a little')} מול ${en('little')}.`
      ],
      rule: 'עם a — מספיק. בלי a — פחות מהנדרש.'
    },
    {
      kind: 'recap',
      bullets: [
        'נמנה מקבל s של רבים; בלתי נמנה אינו מקבל.',
        'many / a few לנמנה · much / a little לבלתי נמנה.',
        'advice, information, homework, news — בלתי נמנות, בניגוד לעברית.',
        'a few פירושו מספיק; few פירושו מעט מדי.'
      ]
    }
  ]
};

const definiteArticle = {
  id: 'english-definite-article',
  subject: 'english',
  grades: [6, 7, 8],
  topics: ['ה"א הידיעה באנגלית'],
  title: 'The — מתי כן ומתי בכלל לא',
  intro: 'הטעות שכמעט כל דובר עברית עושה, ומאיפה היא באה.',
  minutes: 6,
  cards: [
    {
      kind: 'concept',
      title: 'למה זה קשה דווקא לנו',
      lead: 'עברית מסמנת ידיעה על שם העצם עצמו. אנגלית מסמנת אותה במילה נפרדת — ולפעמים לא מסמנת בכלל.',
      body: [
        `"אני אוהב את המוזיקה" נשמע לנו טבעי, ולכן גם ${en('I like the music')} נשמע נכון.`,
        `אבל על מוזיקה בכלל אומרים ${en('I like music')}, בלי ${en('the')}.`,
        'העברית כאן מטעה, ולכן צריך כלל ולא אוזן.'
      ],
      rule: 'the לדבר מסוים ומזוהה. בלי the לדבר כללי.'
    },
    {
      kind: 'steps',
      title: 'מתי כן the',
      problem: 'ארבעה מצבים מכסים כמעט את כל המקרים.',
      steps: [
        { text: 'דבר מסוים שכבר הוזכר או ששנינו מכירים.', expr: en('The book you lent me was excellent.') },
        { text: 'דבר יחיד בעולם.', expr: en('the sun · the moon · the sky') },
        { text: 'כלי נגינה.', expr: en('She plays the piano.') },
        { text: 'דרגת ההפלגה.', expr: en('the best · the tallest') }
      ]
    },
    {
      kind: 'steps',
      title: 'מתי בכלל לא',
      problem: 'וכאן נמצאות הטעויות.',
      steps: [
        { text: 'שם עצם מופשט או כללי.', expr: en('I love music. · Time is short.') },
        { text: 'רבים בהוראה כללית.', expr: en('Dogs are loyal animals.') },
        { text: 'שמות ארוחות.', expr: en('We had breakfast at seven.') },
        { text: 'מקומות בתפקידם, לא בבניין שלהם.', expr: en('go to school · go to bed · at home') },
        { text: 'שם של אדם, עיר, מדינה או הר בודד.', expr: en('Israel · Haifa · Mount Hermon') }
      ]
    },
    {
      kind: 'pitfall',
      title: 'הטעות: the על כלל',
      wrong: en('The children need the sleep. · I go to the school by bus.'),
      right: en('Children need sleep. · I go to school by bus.'),
      why: `שני המשפטים השגויים מדברים על כלל — ילדים בכלל, ולימודים בכלל — ולכן אין ${en('the')}. ${en('the school')} תקין רק כשמדובר בבניין מסוים: ${en('The school on our street is new.')}`
    },
    {
      kind: 'recap',
      bullets: [
        'the לדבר מזוהה, יחיד בעולם, כלי נגינה ודרגת הפלגה.',
        'בלי the לשם מופשט, לרבים כללי, לארוחות ולשמות פרטיים.',
        'go to school בלי the כשמדובר בלימודים, עם the כשמדובר בבניין.',
        'העברית מסמנת ידיעה אחרת — לא לסמוך על התרגום.'
      ]
    }
  ]
};

const adverbs = {
  id: 'english-adverbs',
  subject: 'english',
  grades: [8, 9, 10, 11, 12],
  topics: ['תארי הפועל'],
  title: 'Adverbs — לתאר את הפעולה',
  intro: 'ההבדל בין נהג זהיר לנהיגה בזהירות, ולמה he runs good שגוי.',
  minutes: 6,
  cards: [
    {
      kind: 'concept',
      title: 'שם תואר מתאר מי. תואר הפועל מתאר איך.',
      lead: 'שתי מילים מאותו שורש, שתי עבודות שונות.',
      body: [
        `${en('He is a careful driver.')} — ${en('careful')} מתאר את הנהג.`,
        `${en('He drives carefully.')} — ${en('carefully')} מתאר את הנהיגה.`,
        'השאלה הפשוטה: המילה עונה על "איזה?" או על "איך?"'
      ],
      rule: 'שם תואר לשם עצם. תואר הפועל לפועל.'
    },
    {
      kind: 'steps',
      title: 'איך בונים',
      problem: 'רוב תארי הפועל נבנים בכלל אחד, עם שני תיקוני איות.',
      steps: [
        { text: 'ברירת מחדל — מוסיפים ly.', expr: en('quick → quickly · slow → slowly') },
        { text: 'עיצור + y — ה-y הופכת ל-i.', expr: en('happy → happily · easy → easily') },
        { text: 'סיומת le — מחליפים ל-ly.', expr: en('gentle → gently · simple → simply') }
      ]
    },
    {
      kind: 'concept',
      title: 'החריגים',
      lead: 'שלוש קבוצות קטנות שלא מקבלות ly, ודווקא הן הנפוצות.',
      body: [
        `${en('good → well')} — צורה אחרת לגמרי.`,
        `${en('fast, hard, late, early')} — אותה מילה בשני התפקידים.`,
        `${en('hardly')} ו-${en('lately')} קיימות, אבל פירושן "בקושי" ו"לאחרונה" — לא צורות של ${en('hard')} ו-${en('late')}.`
      ],
      rule: 'well הוא תואר הפועל של good.'
    },
    {
      kind: 'pitfall',
      title: 'הטעות: שם תואר במקום תואר הפועל',
      wrong: en('He runs good. · She sings beautiful.'),
      right: en('He runs well. · She sings beautifully.'),
      why: `הפועל מתואר בתואר פועל. יוצא הדופן הוא אחרי פועלי חושים ומצב — ${en('be, feel, look, sound, taste, smell')} — שאחריהם דווקא שם התואר: ${en('It looks good')}, לא ${en('It looks well')}.`
    },
    {
      kind: 'recap',
      bullets: [
        'תואר הפועל מתאר את הפעולה ונבנה בדרך כלל ב-ly.',
        'y הופכת ל-i, וסיומת le הופכת ל-ly.',
        'good → well, ו-fast / hard / late אינם משתנים.',
        'אחרי look, feel, sound ו-be בא שם תואר ולא תואר פועל.'
      ]
    }
  ]
};

const conditionals = {
  id: 'english-conditionals',
  subject: 'english',
  grades: [10, 11, 12],
  topics: ['משפטי תנאי'],
  title: 'Conditionals — משפטי תנאי',
  intro: 'שני סוגים: מה שיכול לקרות, ומה שרק מדמיינים.',
  minutes: 7,
  cards: [
    {
      kind: 'concept',
      title: 'משפט תנאי הוא שני חלקים',
      lead: 'פסוקית ה-if מציבה את התנאי, והפסוקית השנייה אומרת מה ייצא ממנו.',
      body: [
        `${en('If it rains, we will stay home.')}`,
        'סדר החלקים חופשי. כשה-if פותח, בא פסיק; כשהוא בא שני, אין פסיק.',
        `${en('We will stay home if it rains.')} — אותו משפט בדיוק.`
      ]
    },
    {
      kind: 'steps',
      title: 'תנאי ראשון — דבר שיכול לקרות',
      problem: 'תנאי אמיתי לגבי העתיד.',
      steps: [
        { text: 'אחרי if — הווה פשוט. לא will.', expr: en('If it rains...') },
        { text: 'בפסוקית השנייה — will + בסיס.', expr: en('...we will stay home.') },
        { text: 'ביחד.', expr: en('If you study, you will pass.') }
      ]
    },
    {
      kind: 'steps',
      title: 'תנאי שני — דבר שאינו כך',
      problem: 'מצב מדומיין, שאינו מתקיים במציאות.',
      steps: [
        { text: 'אחרי if — עבר פשוט, גם כשהכוונה להווה.', expr: en('If I had a million...') },
        { text: 'בפסוקית השנייה — would + בסיס.', expr: en('...I would travel the world.') },
        { text: 'עם be באים ב-were לכל הגופים.', expr: en('If I were you, I would apologise.') }
      ]
    },
    {
      kind: 'pitfall',
      title: 'הטעות: will אחרי if',
      wrong: en('If it will rain, we will cancel.'),
      right: en('If it rains, we will cancel.'),
      why: `ה-${en('if')} עצמו כבר מסמן שמדובר במשהו שטרם קרה, ולכן ${en('will')} אחריו מיותר ושגוי. אותו כלל חל אחרי ${en('when')}, ${en('before')} ו-${en('as soon as')}.`
    },
    {
      kind: 'concept',
      title: 'איך בוחרים בין השניים',
      lead: 'השאלה היחידה: האם זה יכול לקרות באמת?',
      body: [
        `${en('If I miss the bus, I will take a taxi.')} — עלול לקרות. תנאי ראשון.`,
        `${en('If I were a bird, I would fly.')} — לא יקרה. תנאי שני.`,
        'העבר בתנאי שני אינו זמן — הוא סימן לכך שזה מדומיין.'
      ],
      rule: 'ריאלי — הווה + will. מדומיין — עבר + would.'
    },
    {
      kind: 'recap',
      bullets: [
        'תנאי ראשון: if + הווה פשוט, ואז will + בסיס.',
        'תנאי שני: if + עבר פשוט, ואז would + בסיס.',
        'עם be בתנאי שני באים ב-were לכל הגופים.',
        'אחרי if לא בא will, גם כשמדובר בעתיד.'
      ]
    }
  ]
};

const passive = {
  id: 'english-passive',
  subject: 'english',
  grades: [10, 11, 12],
  topics: ['סביל'],
  title: 'Passive Voice — מי עשה זה לא העיקר',
  intro: 'מתי מעבירים את מקבל הפעולה לראש המשפט, ואיך.',
  minutes: 7,
  cards: [
    {
      kind: 'concept',
      title: 'מה זה משנה',
      lead: 'בפעיל, הנושא הוא מי שעושה. בסביל, הנושא הוא מי שהפעולה נעשתה בו.',
      body: [
        `פעיל: ${en('My sister wrote the letter.')} — האחות בראש המשפט.`,
        `סביל: ${en('The letter was written by my sister.')} — המכתב בראש.`,
        'שני המשפטים מדווחים על אותו מעשה. מה שמשתנה הוא במה המשפט עוסק.'
      ],
      rule: 'סביל = be + הצורה השלישית של הפועל.'
    },
    {
      kind: 'steps',
      title: 'איך הופכים פעיל לסביל',
      problem: 'שלושה צעדים, באותו סדר בכל פעם.',
      steps: [
        { text: 'המושא הופך לנושא.', expr: en('the letter...') },
        { text: 'הפועל הופך ל-be באותו זמן + צורה שלישית.', expr: en('...was written...') },
        { text: 'העושה עובר לסוף עם by, או נעלם.', expr: en('...by my sister.') }
      ]
    },
    {
      kind: 'concept',
      title: 'be נושא את הזמן',
      lead: 'הצורה השלישית אינה משתנה. כל הזמן יושב על be.',
      body: [
        `הווה: ${en('The room is cleaned every day.')}`,
        `עבר: ${en('The room was cleaned yesterday.')}`,
        `עתיד: ${en('The room will be cleaned tomorrow.')}`,
        `הווה מושלם: ${en('The room has been cleaned.')}`
      ]
    },
    {
      kind: 'concept',
      title: 'למה בכלל להשתמש בו',
      lead: 'סביל אינו קישוט. הוא נבחר כשהעושה אינו חשוב, אינו ידוע, או שלא רוצים לנקוב בו.',
      body: [
        `לא ידוע: ${en('My bike was stolen.')} — אין טעם ב-${en('by someone')}.`,
        `לא חשוב: ${en('The bridge was built in 1952.')}`,
        `בכתיבה מדעית: ${en('The samples were heated to 40 degrees.')}`
      ],
      rule: 'אין by כשהעושה אינו מוסיף מידע.'
    },
    {
      kind: 'pitfall',
      title: 'הטעות: צורת עבר במקום צורה שלישית',
      wrong: en('The letter was wrote by my sister.'),
      right: en('The letter was written by my sister.'),
      why: `${en('wrote')} היא צורת העבר, ובסביל דרושה הצורה השלישית ${en('written')}. אצל פעלים רגילים שתי הצורות זהות ולכן הטעות אינה נראית — היא מתגלה דווקא בחריגים.`
    },
    {
      kind: 'recap',
      bullets: [
        'סביל: be + צורה שלישית.',
        'be נושא את הזמן; הצורה השלישית קבועה.',
        'by נוסף רק כשהעושה מוסיף מידע.',
        'בחריגים הצורה השלישית שונה מצורת העבר — שם הטעות מתגלה.'
      ]
    }
  ]
};

const phrasalVerbs = {
  id: 'english-phrasal-verbs',
  subject: 'english',
  grades: [9, 10, 11, 12],
  topics: ['פעלים מורכבים'],
  title: 'Phrasal Verbs — פועל ועוד מילה',
  intro: 'למה look after אינו "להסתכל אחרי", ואיך לומדים אותם בלי לשנן רשימה.',
  minutes: 6,
  cards: [
    {
      kind: 'concept',
      title: 'הצירוף אינו סכום חלקיו',
      lead: 'פועל מורכב הוא פועל ועוד מילית, שיחד מקבלים משמעות חדשה לגמרי.',
      body: [
        `${en('look')} = להסתכל. ${en('after')} = אחרי. ${en('look after')} = לשמור על מישהו.`,
        `${en('give up')} אינו "לתת למעלה" אלא לוותר.`,
        'לכן תרגום מילה־מילה לא עובד כאן, ורק ההקשר מגלה את המשמעות.'
      ]
    },
    {
      kind: 'concept',
      title: 'אותו פועל, מילית אחרת, משמעות אחרת',
      lead: 'המילית היא שקובעת, ולכן כדאי ללמוד לפי פועל.',
      body: [
        `${en('take off')} — להמריא, או להוריד בגד.`,
        `${en('take up')} — להתחיל תחום או תפקיד.`,
        `${en('take after')} — להידמות למישהו במשפחה.`,
        `${en('take over')} — להשתלט או לקבל אחריות.`
      ]
    },
    {
      kind: 'concept',
      title: 'איפה שם המושא נכנס',
      lead: 'חלק מהצירופים נותנים למושא להיכנס באמצע, וחלק לא.',
      body: [
        `נפרד: ${en('turn on the light')} או ${en('turn the light on')} — שניהם תקינים.`,
        `עם כינוי, ההפרדה מחויבת: ${en('turn it on')} ולא ${en('turn on it')}.`,
        `לא נפרד: ${en('look after the baby')} בלבד, לא ${en('look the baby after')}.`
      ],
      rule: 'כינוי גוף נכנס תמיד באמצע הצירוף הנפרד.'
    },
    {
      kind: 'steps',
      title: 'איך מפענחים צירוף שלא מכירים',
      problem: `קראתי ${en('The meeting was put off until Monday')} ואיני יודע מה זה.`,
      steps: [
        {
          text: 'מזהים את הצירוף: פועל ועוד מילית שצמודה לו.',
          expr: en('put + off')
        },
        {
          text: 'לא מתרגמים מילה־מילה. "לשים כבוי" אינו אומר דבר.',
          expr: en('put off ≠ put + off')
        },
        {
          text: 'קוראים את ההקשר: פגישה, ותאריך חדש בהמשך המשפט.',
          expr: en('...until Monday')
        },
        {
          text: 'מסיקים את המשמעות ומאמתים אותה במשפט אחר.',
          expr: en('put off = לדחות')
        }
      ]
    },
    {
      kind: 'pitfall',
      title: 'הטעות: לתרגם את המילית מעברית',
      wrong: en('I am waiting you. · She listened the music.'),
      right: en('I am waiting for you. · She listened to the music.'),
      why: `בעברית "חיכיתי לך" ו"הקשבתי למוזיקה" כוללות את הל' בתוך המשפט, ובאנגלית המילית היא ${en('for')} ו-${en('to')} — ולא נגזרת מהעברית. את המילית לומדים יחד עם הפועל, כמלה אחת.`
    },
    {
      kind: 'recap',
      bullets: [
        'פועל + מילית = משמעות חדשה, לא סכום התרגומים.',
        'אותו פועל עם מילית אחרת הוא פועל אחר.',
        'צירוף נפרד מאפשר מושא באמצע; עם כינוי גוף זה מחויב.',
        'לומדים את המילית יחד עם הפועל.'
      ]
    }
  ]
};

const questionWords = {
  id: 'english-question-words',
  subject: 'english',
  grades: [4, 5],
  topics: ['מילות שאלה'],
  title: 'Question Words — לשאול באנגלית',
  intro: 'איזו מילה פותחת איזו שאלה, ולמה סדר המילים מתהפך.',
  minutes: 5,
  cards: [
    {
      kind: 'concept',
      title: 'כל מילת שאלה מבקשת סוג אחר של תשובה',
      lead: 'אם יודעים מה התשובה תהיה, יודעים איזו מילה לפתוח בה.',
      body: [
        `${en('Who')} — אדם. ${en('What')} — דבר. ${en('Where')} — מקום.`,
        `${en('When')} — זמן. ${en('Why')} — סיבה. ${en('How')} — אופן.`,
        `${en('Whose')} — של מי. ${en('Which')} — איזה מתוך אפשרויות מוגדרות.`
      ]
    },
    {
      kind: 'steps',
      title: 'How ועוד מילה',
      problem: 'ל-how יש משפחה שלמה, וכל אחת שואלת דבר אחר.',
      steps: [
        { text: 'כמה, לדבר שנמנה.', expr: en('How many books do you have?') },
        { text: 'כמה, לדבר שאינו נמנה.', expr: en('How much water is left?') },
        { text: 'כמה זמן.', expr: en('How long does it take?') },
        { text: 'כמה תכופות.', expr: en('How often do you swim?') }
      ]
    },
    {
      kind: 'concept',
      title: 'סדר המילים בשאלה',
      lead: 'באנגלית שאלה אינה רק סימן שאלה בסוף — הסדר עצמו משתנה.',
      body: [
        `הצהרה: ${en('You live in Haifa.')}`,
        `שאלה: ${en('Where do you live?')} — נכנס ${en('do')}, והפועל חוזר לבסיס.`,
        `עם be אין צורך ב-do: ${en('Where are you?')}`
      ],
      rule: 'מילת שאלה + פועל עזר + נושא + פועל.'
    },
    {
      kind: 'pitfall',
      title: 'הטעות: סדר של הצהרה',
      wrong: en('Where you live? · What she wants?'),
      right: en('Where do you live? · What does she want?'),
      why: `בעברית "איפה אתה גר?" תקין בלי מילת עזר, ולכן החיסרון אינו נשמע. באנגלית חייב לבוא ${en('do')} או ${en('does')}, ואחריו הפועל בצורת הבסיס — ${en('want')} ולא ${en('wants')}.`
    },
    {
      kind: 'recap',
      bullets: [
        'סוג התשובה קובע את מילת השאלה.',
        'how many לנמנה, how much לבלתי נמנה.',
        'סדר: מילת שאלה, פועל עזר, נושא, פועל.',
        'אחרי do או does — הפועל בצורת הבסיס.'
      ]
    }
  ]
};

export const englishLessons = [
  vocabulary, articles, presentSimple, pastTense,
  irregularPlurals, opposites, prepositions, comparatives,
  clozeLesson, vocabSorting, readingComprehension,
  questionWords, presentProgressive, pastProgressive, future, modals,
  quantifiers, definiteArticle, adverbs, presentPerfect,
  conditionals, passive, phrasalVerbs
];
