import { DATA_ATTRIBUTES } from "./constants";

/* ==========================================================================
   Message Catalog
   ========================================================================== */

const MESSAGE_CATALOG = Object.freeze({
  en: Object.freeze({
    locale: "en",

    searchPlaceholder: "Search options",
    noResults: "No matching options",
    clearSelection: "Clear selection",
    clearSearch: "Clear search",
    loading: "Loading options",
    selectionCleared: "Selection cleared",

    optionSelected: (label) => `${label} selected`,
    optionDeselected: (label) => `${label} deselected`,
  }),

  ar: Object.freeze({
    locale: "ar-SA",

    searchPlaceholder: "ابحث في الخيارات",
    noResults: "لا توجد خيارات مطابقة",
    clearSelection: "مسح التحديد",
    clearSearch: "مسح البحث",
    loading: "جارٍ تحميل الخيارات",
    selectionCleared: "تم مسح التحديد",

    optionSelected: (label) => `تم تحديد ${label}`,
    optionDeselected: (label) => `تم إلغاء تحديد ${label}`,
  }),
});

/* ==========================================================================
   Count Messages
   ========================================================================== */

const RESULT_COUNT_MESSAGES = Object.freeze({
  en: Object.freeze({
    zero: () => "No options available",
    one: (number) => `${number} option available`,
    other: (number) => `${number} options available`,
  }),

  ar: Object.freeze({
    zero: () => "لا توجد خيارات متاحة",
    one: () => "يتوفر خيار واحد",
    two: () => "يتوفر خياران",
    few: (number) => `تتوفر ${number} خيارات`,
    many: (number) => `يتوفر ${number} خيارًا`,
    other: (number) => `يتوفر ${number} خيار`,
  }),
});

const SELECTED_COUNT_MESSAGES = Object.freeze({
  en: Object.freeze({
    zero: () => "None selected",
    one: (number) => `${number} selected`,
    other: (number) => `${number} selected`,
  }),

  ar: Object.freeze({
    zero: () => "لا يوجد تحديد",
    one: () => "خيار واحد",
    two: () => "خياران",
    few: (number) => `${number} خيارات`,
    many: (number) => `${number} خيارًا`,
    other: (number) => `${number} خيار`,
  }),
});

const SELECTION_STATUS_MESSAGES = Object.freeze({
  en: Object.freeze({
    zero: () => "No options selected",
    one: (number) => `${number} option selected`,
    other: (number) => `${number} options selected`,
  }),

  ar: Object.freeze({
    zero: () => "لم يتم تحديد أي خيار",
    one: () => "تم تحديد خيار واحد",
    two: () => "تم تحديد خيارين",
    few: (number) => `تم تحديد ${number} خيارات`,
    many: (number) => `تم تحديد ${number} خيارًا`,
    other: (number) => `تم تحديد ${number} خيار`,
  }),
});

/* ==========================================================================
   Language Resolution
   ========================================================================== */

function normalizeLanguage(language) {
  return String(language || "")
    .trim()
    .toLowerCase()
    .startsWith("ar")
    ? "ar"
    : "en";
}

export function getCustomSelectLanguage(component) {
  const languageRoot = component?.closest?.("[lang]");
  const documentLanguage = component?.ownerDocument?.documentElement?.lang;

  return normalizeLanguage(
    languageRoot?.getAttribute("lang") || documentLanguage || "en",
  );
}

/* ==========================================================================
   Formatting
   ========================================================================== */

const FORMATTERS = Object.freeze({
  en: Object.freeze({
    number: new Intl.NumberFormat(MESSAGE_CATALOG.en.locale),
    plural: new Intl.PluralRules(MESSAGE_CATALOG.en.locale),
  }),

  ar: Object.freeze({
    number: new Intl.NumberFormat(MESSAGE_CATALOG.ar.locale),
    plural: new Intl.PluralRules(MESSAGE_CATALOG.ar.locale),
  }),
});

function normalizeCount(count) {
  const number = Number(count);

  if (!Number.isFinite(number)) return 0;

  return Math.max(0, Math.trunc(number));
}

function formatCount(messages, language, count) {
  const normalizedCount = normalizeCount(count);
  const formatter = FORMATTERS[language];
  const category = formatter.plural.select(normalizedCount);
  const message = messages[language][category] || messages[language].other;

  return message(formatter.number.format(normalizedCount));
}

function getOverride(component, attribute, fallback) {
  const value = component?.getAttribute?.(attribute)?.trim();

  return value || fallback;
}

/* ==========================================================================
   Public Messages
   ========================================================================== */

/**
 * Resolves localized strings for one custom-select component.
 *
 * The visible search placeholder, empty-result message, and clear label may be
 * overridden directly on the component through data attributes. Generated
 * status messages remain locale controlled for consistent announcements.
 */

export function getCustomSelectMessages(component) {
  const language = getCustomSelectLanguage(component);
  const catalog = MESSAGE_CATALOG[language];

  return Object.freeze({
    language,
    locale: catalog.locale,

    searchPlaceholder: getOverride(
      component,
      DATA_ATTRIBUTES.searchPlaceholder,
      catalog.searchPlaceholder,
    ),

    noResults: getOverride(
      component,
      DATA_ATTRIBUTES.emptyMessage,
      catalog.noResults,
    ),

    clearSelection: getOverride(
      component,
      DATA_ATTRIBUTES.clearLabel,
      catalog.clearSelection,
    ),

    clearSearch: catalog.clearSearch,
    loading: catalog.loading,
    selectionCleared: catalog.selectionCleared,

    resultsStatus(count) {
      return formatCount(RESULT_COUNT_MESSAGES, language, count);
    },

    selectedCount(count) {
      return formatCount(SELECTED_COUNT_MESSAGES, language, count);
    },

    selectionStatus(count) {
      return formatCount(SELECTION_STATUS_MESSAGES, language, count);
    },

    optionSelected(label) {
      return catalog.optionSelected(String(label || "").trim());
    },

    optionDeselected(label) {
      return catalog.optionDeselected(String(label || "").trim());
    },
  });
}
