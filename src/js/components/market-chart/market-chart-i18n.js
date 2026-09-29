import {
  DEFAULT_LANGUAGE,
  isPlainObject,
  toKeyword,
} from "./market-chart-utils.js";

/* ==========================================================================
   Market Chart i18n
   ==========================================================================

   Single source of truth for every user-facing Market Chart string.

   Rules:

   1. No other module hard-codes user-facing text.
   2. Unsupported languages fall back to English.
   3. Consumer overrides can only replace existing keys with a value of the
      same type (string -> string, function -> function). Unknown keys and
      mismatched types are ignored, so a bad override can never break a
      formatter.

   Usage:

     const strings = getMarketChartStrings("ar", {
       messages: { empty: "لا توجد بيانات اليوم." },
     });

     strings.tooltip.close;              // "الإغلاق"
     strings.accessibility.description("TASI");
   ========================================================================== */

/* ==========================================================================
   Dictionaries
   ========================================================================== */

const EN = Object.freeze({
  messages: Object.freeze({
    loading: "Loading market data…",
    empty: "Market data is currently unavailable.",
    error: "Market data could not be loaded.",
  }),

  axis: Object.freeze({
    time: "Time",
    date: "Date",
    value: "Index Value",
  }),

  tooltip: Object.freeze({
    value: "Value",
    open: "Open",
    high: "High",
    low: "Low",
    close: "Close",
  }),

  /*
   * Passed to Highcharts `lang`.
   */
  highcharts: Object.freeze({
    noData: "No market data available.",
    loading: "Loading market data…",
    resetZoom: "Reset zoom",
    resetZoomTitle: "Reset chart zoom",
  }),

  accessibility: Object.freeze({
    description: (name) =>
      name
        ? `${name} market performance over time.`
        : "Market performance over time.",
  }),
});

const AR = Object.freeze({
  messages: Object.freeze({
    loading: "جارٍ تحميل بيانات السوق…",
    empty: "بيانات السوق غير متاحة حاليًا.",
    error: "تعذّر تحميل بيانات السوق.",
  }),

  axis: Object.freeze({
    time: "الوقت",
    date: "التاريخ",
    value: "قيمة المؤشر",
  }),

  tooltip: Object.freeze({
    value: "القيمة",
    open: "الافتتاح",
    high: "الأعلى",
    low: "الأدنى",
    close: "الإغلاق",
  }),

  highcharts: Object.freeze({
    noData: "لا تتوفر بيانات للسوق.",
    loading: "جارٍ تحميل بيانات السوق…",
    resetZoom: "إعادة ضبط التكبير",
    resetZoomTitle: "إعادة ضبط مستوى تكبير الرسم البياني",
  }),

  accessibility: Object.freeze({
    description: (name) =>
      name ? `أداء ${name} في السوق عبر الزمن.` : "أداء السوق عبر الزمن.",
  }),
});

const DICTIONARIES = Object.freeze({
  en: EN,
  ar: AR,
});

export const SUPPORTED_LANGUAGES = Object.freeze(Object.keys(DICTIONARIES));

/*
 * Primary language subtags written right-to-left.
 */
const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur"]);

/* ==========================================================================
   Language
   ========================================================================== */

/**
 * Primary subtag of a BCP-47 tag: "ar-SA" -> "ar", "EN_us" -> "en".
 *
 * @param {*} language
 * @returns {string}
 */
function getPrimarySubtag(language) {
  return toKeyword(language).split(/[-_]/)[0];
}

/**
 * Resolves any language tag to a supported dictionary key.
 *
 * @param {*} language
 * @returns {"en" | "ar"}
 */
export function resolveMarketChartLanguage(language) {
  const primary = getPrimarySubtag(language);

  return Object.hasOwn(DICTIONARIES, primary) ? primary : DEFAULT_LANGUAGE;
}

/**
 * Language-based direction fallback, used only when the DOM does not
 * declare an explicit `dir`.
 *
 * @param {*} language
 * @returns {boolean}
 */
export function isRTLLanguage(language) {
  return RTL_LANGUAGES.has(getPrimarySubtag(language));
}

/* ==========================================================================
   Strings
   ========================================================================== */

/**
 * Merge one dictionary group with consumer overrides.
 *
 * Only existing keys are replaceable, and only with a value of the same
 * type as the built-in value.
 */
function mergeGroup(base, override) {
  if (!isPlainObject(override)) {
    return base;
  }

  const merged = { ...base };

  for (const [key, value] of Object.entries(base)) {
    const replacement = override[key];

    if (
      replacement !== undefined &&
      typeof replacement === typeof value &&
      (typeof replacement !== "string" || replacement.trim() !== "")
    ) {
      merged[key] = replacement;
    }
  }

  return Object.freeze(merged);
}

/**
 * Returns the complete, frozen string table for a language.
 *
 * @param {*} language  Any BCP-47 tag ("ar", "ar-SA", "en-US", …).
 * @param {object} [overrides]  Same shape as the dictionaries, e.g.
 *   { messages: { empty: "…" }, axis: { value: "Points" } }
 * @returns {typeof EN}
 */
export function getMarketChartStrings(language, overrides = null) {
  const dictionary = DICTIONARIES[resolveMarketChartLanguage(language)];

  if (!isPlainObject(overrides)) {
    return dictionary;
  }

  const strings = {};

  for (const [group, values] of Object.entries(dictionary)) {
    strings[group] = mergeGroup(values, overrides[group]);
  }

  return Object.freeze(strings);
}
