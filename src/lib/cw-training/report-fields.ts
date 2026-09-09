/** Google Form fields inspected September 9, 2026, with metric sanity checks. Keep choice casing intact. */
export interface ReportField {
  key: string;
  label: string;
  section: string;
  entryId: number;
  type: "text" | "number" | "textarea" | "rating" | "date";
  required?: boolean;
  options?: readonly string[];
  min?: number;
  max?: number;
  integer?: boolean;
  minExclusive?: number;
  maxExclusive?: number;
}

export const REPORT_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScVofUQMR3P8G2Ayom5iEspPMsCRe51CdaNkF6Vc-WGk-WniA/viewform";

export const REPORT_FIELDS: readonly ReportField[] = [
  {"key": "callsign", "label": "Your Call Sign", "section": "Identity", "entryId": 244022429, "type": "text", "required": true},
  {"key": "firstName", "label": "Your First Name", "section": "Identity", "entryId": 1426214762, "type": "text", "required": true},
  {"key": "session", "label": "Session Number (odd # Mon - even # Thu)  i.e. \"3\"", "section": "Identity", "entryId": 608418922, "type": "number", "required": true, "min": 1, "integer": true},
  {"key": "reportDate", "label": "Todays Date", "section": "Identity", "entryId": 1091633832, "type": "date", "required": true},
  {"key": "scalesRating", "label": "How did Scales go", "section": "Sending", "entryId": 332595719, "type": "rating", "required": true, "options": ["Very good", "Good", "Fair", "Poor"]},
  {"key": "runnerWpm", "label": "Morse Runner Speed WPM  i.e. \"15\"", "section": "Morse Runner", "entryId": 1661778892, "type": "number", "minExclusive": 10},
  {"key": "runnerVerifiedPoints", "label": "Morse Runner Highest Verified Pts [1 to 60] not Score", "section": "Morse Runner", "entryId": 1945917634, "type": "number", "min": 0, "integer": true},
  {"key": "callsignWpm", "label": "Callsign Speed WPM", "section": "LCWO callsigns", "entryId": 1479855398, "type": "number", "minExclusive": 10},
  {"key": "callsignScore", "label": "Callsign Score", "section": "LCWO callsigns", "entryId": 859299997, "type": "number", "min": 0, "integer": true},
  {"key": "callsignErrors", "label": "Callsign # of Errors", "section": "LCWO callsigns", "entryId": 73650576, "type": "number", "min": 0, "integer": true},
  {"key": "lettersLength", "label": "Letters Group Length  i.e. \"3\"", "section": "LCWO code practice", "entryId": 1087119143, "type": "number", "maxExclusive": 10, "min": 1, "integer": true},
  {"key": "lettersWpm", "label": "Letters Effective Speed  i.e. \"15\"", "section": "LCWO code practice", "entryId": 2110956444, "type": "number", "minExclusive": 10},
  {"key": "lettersErrorPercent", "label": "Letters Percent of Errors  i.e. Errors: \"30 = 29.4%\"", "section": "LCWO code practice", "entryId": 1584948381, "type": "number", "min": 0, "max": 100},
  {"key": "wordsWpm", "label": "Word Training Speed (does not use CW settings)  i.e. \"13\"", "section": "LCWO code practice", "entryId": 1262829745, "type": "number", "minExclusive": 10},
  {"key": "wordsMaximumLength", "label": "Word Training Maximum Length   i.e. \"3\"", "section": "LCWO code practice", "entryId": 1449565470, "type": "number", "minExclusive": 2, "integer": true},
  {"key": "wordsErrors", "label": "Word Training Number of Errors  'count the number of red 'received' i.e. \"8\"", "section": "LCWO code practice", "entryId": 920766910, "type": "number", "min": 0, "integer": true},
  {"key": "wordsScore", "label": "Word Training Score  i.e. \"850\"", "section": "LCWO code practice", "entryId": 1893116760, "type": "number", "min": 0, "integer": true},
  {"key": "figuresLength", "label": "Figures Group Length  i.e. \"Numbers\"", "section": "LCWO code practice", "entryId": 602746521, "type": "number", "maxExclusive": 9, "min": 1, "integer": true},
  {"key": "figuresWpm", "label": "Figures Effective Speed ", "section": "LCWO code practice", "entryId": 784128549, "type": "number", "minExclusive": 10},
  {"key": "figuresErrorPercent", "label": "Figures Percent of Errors (correct answers)", "section": "LCWO code practice", "entryId": 1897498036, "type": "number", "min": 0, "max": 100},
  {"key": "customLength", "label": "Custom Characters (Koch) Length", "section": "LCWO code practice", "entryId": 820879724, "type": "number", "maxExclusive": 9, "min": 1, "integer": true},
  {"key": "customWpm", "label": "Custom Characters (Koch) Effective Speed", "section": "LCWO code practice", "entryId": 1854090109, "type": "number", "minExclusive": 10},
  {"key": "customErrorPercent", "label": "Custom Characters (Koch) Percent of Errors (correct answers)", "section": "LCWO code practice", "entryId": 181624827, "type": "number", "min": 0, "max": 100},
  {"key": "shortWordsFiles", "label": "Short Words files and speed  i.e. \"201 10\"", "section": "CWA sound files", "entryId": 206527126, "type": "text"},
  {"key": "shortWordsRating", "label": "How did Short Words go", "section": "CWA sound files", "entryId": 771776992, "type": "rating", "options": ["Very Good", "Good", "Fair", "Poor"]},
  {"key": "shortPhrasesFiles", "label": "Short Phrases Files and speed  i.e. \"201 15\"", "section": "CWA sound files", "entryId": 2010143099, "type": "text"},
  {"key": "shortPhrasesRating", "label": "How did Short Phrases go ", "section": "CWA sound files", "entryId": 710144967, "type": "rating", "options": ["Very Good", "Good", "Fair", "Poor"]},
  {"key": "shortQsoFiles", "label": "Short QSO files and speed  i.e. \"104 10\"", "section": "CWA sound files", "entryId": 578546735, "type": "text"},
  {"key": "shortQsoRating", "label": "How did Short QSO's go", "section": "CWA sound files", "entryId": 896780368, "type": "rating", "options": ["Very Good", "Good", "Fair", "Poor"]},
  {"key": "shortPotaFiles", "label": "Short POTA files and speed  i.e. \"104 13\"", "section": "CWA sound files", "entryId": 528376606, "type": "text"},
  {"key": "shortPotaRating", "label": "How did Short POTA go", "section": "CWA sound files", "entryId": 1155746201, "type": "rating", "options": ["Very Good", "Good", "Fair", "Poor"]},
  {"key": "prefixFiles", "label": "Prefix files and speed  i.e. \"DIS4\"", "section": "CWA sound files", "entryId": 914892006, "type": "text"},
  {"key": "prefixRating", "label": "How did Prefixes go", "section": "CWA sound files", "entryId": 764060153, "type": "rating", "options": ["Very Good", "Good", "Fair", "Poor"]},
  {"key": "suffixFiles", "label": "Suffix files and speed  i.e. \"ING4\"", "section": "CWA sound files", "entryId": 824329659, "type": "text"},
  {"key": "suffixRating", "label": "How did Suffixes go", "section": "CWA sound files", "entryId": 19758343, "type": "rating", "options": ["Very good", "Good", "Fair", "Poor"]},
  {"key": "learnedWords", "label": "What new words did you learn", "section": "New words", "entryId": 1130226476, "type": "text"},
  {"key": "heardCallsigns", "label": "What Callsigns did you hear", "section": "MST/SST/CWT monitoring", "entryId": 575428902, "type": "text"},
  {"key": "heardExchanges", "label": "What Names and Exchanges did you hear", "section": "MST/SST/CWT monitoring", "entryId": 1124729670, "type": "textarea"},
  {"key": "eventComments", "label": "MST, SST or CWT Comments", "section": "MST/SST/CWT monitoring", "entryId": 463298786, "type": "textarea"},
  {"key": "workedCallsigns", "label": "What Callsigns did you work", "section": "On-air QSOs", "entryId": 689931435, "type": "textarea"},
  {"key": "workedNames", "label": "First names of people you worked", "section": "On-air QSOs", "entryId": 1818771364, "type": "textarea"},
  {"key": "problems", "label": "Explain", "section": "Problems", "entryId": 2010417226, "type": "textarea"},
];

export interface ReportAnswerError {
  key: string;
  message: string;
}

export function isReportDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Blank optional answers remain blank. Numeric zero is a real answer. */
export function validateReportAnswers(
  answers: Readonly<Record<string, string>>,
  options: { requireComplete?: boolean } = {},
): ReportAnswerError[] {
  const errors: ReportAnswerError[] = [];
  for (const field of REPORT_FIELDS) {
    const raw = answers[field.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    let problem = "";
    if (raw !== undefined && typeof raw !== "string") problem = "Use a text answer.";
    else if (!value) {
      if (field.required && options.requireComplete !== false) problem = "An answer is required.";
    } else if (field.type === "rating" && !field.options?.includes(raw)) {
      problem = "Choose one of the listed ratings.";
    } else if (field.type === "date" && !isReportDate(value)) {
      problem = "Use a valid date in YYYY-MM-DD format.";
    } else if (field.type === "number") {
      const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) ? Number(value) : NaN;
      if (!Number.isFinite(number)) problem = "Enter a number without units or a percent sign.";
      else if (field.integer && !Number.isSafeInteger(number)) problem = "Enter a whole number.";
      else if (field.min !== undefined && number < field.min) problem = `Enter a number at least ${field.min}.`;
      else if (field.max !== undefined && number > field.max) problem = `Enter a number at most ${field.max}.`;
      else if (field.minExclusive !== undefined && number <= field.minExclusive) problem = `Google Forms requires a number greater than ${field.minExclusive}.`;
      else if (field.maxExclusive !== undefined && number >= field.maxExclusive) problem = `Google Forms requires a number less than ${field.maxExclusive}.`;
    }
    if (problem) errors.push({ key: field.key, message: problem });
  }
  return errors;
}

/** Opens the real form for review; this never submits a response. */
export function buildPrefilledReportUrl(answers: Readonly<Record<string, string>>): string {
  const url = new URL(REPORT_FORM_URL);
  url.searchParams.set("usp", "pp_url");
  for (const field of REPORT_FIELDS) {
    const value = answers[field.key];
    if (typeof value === "string" && value.trim()) url.searchParams.set(`entry.${field.entryId}`, value);
  }
  return url.toString();
}
