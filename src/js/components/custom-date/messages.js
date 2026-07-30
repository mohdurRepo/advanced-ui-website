import { BOUNDARIES, PRESETS } from "./constants";
import { getDocumentDirection, getDocumentLocale } from "./utils";

/* ==========================================================================
   English Messages
   ========================================================================== */

const ENGLISH_MESSAGES = Object.freeze({
  locale: "en",
  direction: "ltr",

  /* Control */
  openCalendar: "Open calendar",
  closeCalendar: "Close calendar",
  clearDate: "Clear date",
  clearRange: "Clear date range",

  /* Dialog */
  calendarDialog: "Choose a date",
  rangeDialog: "Choose a date range",

  /* Navigation */
  previousMonth: "Previous month",
  nextMonth: "Next month",
  previousYear: "Previous year",
  nextYear: "Next year",

  /* Views */
  chooseMonth: "Choose month",
  chooseYear: "Choose year",
  returnToDays: "Return to calendar days",

  /* Range */
  startDate: "Start date",
  endDate: "End date",
  chooseStartDate: "Choose a start date",
  chooseEndDate: "Choose an end date",
  rangeSeparator: "to",

  /* Footer */
  selectedRange: "Selected range",
  clear: "Clear",
  today: "Today",
  cancel: "Cancel",
  apply: "Apply",

  /* Presets */
  presetsLabel: "Quick ranges",

  presetLabels: Object.freeze({
    [PRESETS.today]: "Today",
    [PRESETS.yesterday]: "Yesterday",
    [PRESETS.last7]: "Last 7 days",
    [PRESETS.last30]: "Last 30 days",
    [PRESETS.thisMonth]: "This month",
    [PRESETS.lastMonth]: "Last month",
  }),

  /* State */
  loading: "Loading available dates",
  unavailable: "This date is unavailable",
  noDateSelected: "No date selected",
  noRangeSelected: "No date range selected",

  /* Announcements */
  dateSelected: (dateLabel) => `${dateLabel} selected.`,
  dateCleared: "Date cleared.",

  rangeStartSelected: (dateLabel) =>
    `${dateLabel} selected as the start date. Choose an end date.`,

  rangeEndSelected: (dateLabel) => `${dateLabel} selected as the end date.`,

  rangeSelected: (startLabel, endLabel) =>
    `Date range selected from ${startLabel} to ${endLabel}.`,

  rangeCleared: "Date range cleared.",

  monthChanged: (monthLabel) => `${monthLabel} displayed.`,

  yearChanged: (year) => `Year ${year} displayed.`,

  activeBoundary: (boundary) =>
    boundary === BOUNDARIES.end
      ? "Choosing the end date."
      : "Choosing the start date.",

  selectedDateSummary: (dateValue) => `Selected date: ${dateValue}.`,

  selectedRangeSummary: (startValue, endValue) =>
    `Selected range: ${startValue} to ${endValue}.`,
});

/* ==========================================================================
   Arabic Messages
   ========================================================================== */

const ARABIC_MESSAGES = Object.freeze({
  locale: "ar",
  direction: "rtl",

  /* Control */
  openCalendar: "فتح التقويم",
  closeCalendar: "إغلاق التقويم",
  clearDate: "مسح التاريخ",
  clearRange: "مسح النطاق الزمني",

  /* Dialog */
  calendarDialog: "اختر تاريخًا",
  rangeDialog: "اختر نطاقًا زمنيًا",

  /* Navigation */
  previousMonth: "الشهر السابق",
  nextMonth: "الشهر التالي",
  previousYear: "السنة السابقة",
  nextYear: "السنة التالية",

  /* Views */
  chooseMonth: "اختر الشهر",
  chooseYear: "اختر السنة",
  returnToDays: "العودة إلى أيام التقويم",

  /* Range */
  startDate: "تاريخ البداية",
  endDate: "تاريخ النهاية",
  chooseStartDate: "اختر تاريخ البداية",
  chooseEndDate: "اختر تاريخ النهاية",
  rangeSeparator: "إلى",

  /* Footer */
  selectedRange: "النطاق المحدد",
  clear: "مسح",
  today: "اليوم",
  cancel: "إلغاء",
  apply: "تطبيق",

  /* Presets */
  presetsLabel: "نطاقات سريعة",

  presetLabels: Object.freeze({
    [PRESETS.today]: "اليوم",
    [PRESETS.yesterday]: "أمس",
    [PRESETS.last7]: "آخر 7 أيام",
    [PRESETS.last30]: "آخر 30 يومًا",
    [PRESETS.thisMonth]: "هذا الشهر",
    [PRESETS.lastMonth]: "الشهر السابق",
  }),

  /* State */
  loading: "جارٍ تحميل التواريخ المتاحة",
  unavailable: "هذا التاريخ غير متاح",
  noDateSelected: "لم يتم اختيار تاريخ",
  noRangeSelected: "لم يتم اختيار نطاق زمني",

  /* Announcements */
  dateSelected: (dateLabel) => `تم اختيار ${dateLabel}.`,
  dateCleared: "تم مسح التاريخ.",

  rangeStartSelected: (dateLabel) =>
    `تم اختيار ${dateLabel} كتاريخ بداية. اختر تاريخ النهاية.`,

  rangeEndSelected: (dateLabel) => `تم اختيار ${dateLabel} كتاريخ نهاية.`,

  rangeSelected: (startLabel, endLabel) =>
    `تم اختيار النطاق من ${startLabel} إلى ${endLabel}.`,

  rangeCleared: "تم مسح النطاق الزمني.",

  monthChanged: (monthLabel) => `يتم عرض ${monthLabel}.`,

  yearChanged: (year) => `يتم عرض سنة ${year}.`,

  activeBoundary: (boundary) =>
    boundary === BOUNDARIES.end
      ? "يتم اختيار تاريخ النهاية."
      : "يتم اختيار تاريخ البداية.",

  selectedDateSummary: (dateValue) => `التاريخ المحدد: ${dateValue}.`,

  selectedRangeSummary: (startValue, endValue) =>
    `النطاق المحدد: من ${startValue} إلى ${endValue}.`,
});

/* ==========================================================================
   Locale Resolution
   ========================================================================== */

function getMessageDictionary(locale) {
  const normalizedLocale = String(locale || "")
    .trim()
    .toLowerCase();

  return normalizedLocale.startsWith("ar") ? ARABIC_MESSAGES : ENGLISH_MESSAGES;
}

/* ==========================================================================
   Component Overrides
   ========================================================================== */

/**
 * Applications may override concise labels through data attributes without
 * replacing the message module.
 *
 * Supported attributes:
 *
 * data-clear-label
 * data-today-label
 * data-cancel-label
 * data-apply-label
 * data-presets-label
 */

function getComponentOverrides(component) {
  if (!component?.dataset) return {};

  return {
    clear: component.dataset.clearLabel?.trim() || undefined,

    clearDate: component.dataset.clearLabel?.trim() || undefined,

    clearRange: component.dataset.clearLabel?.trim() || undefined,

    today: component.dataset.todayLabel?.trim() || undefined,

    cancel: component.dataset.cancelLabel?.trim() || undefined,

    apply: component.dataset.applyLabel?.trim() || undefined,

    presetsLabel: component.dataset.presetsLabel?.trim() || undefined,
  };
}

/* ==========================================================================
   Preset Overrides
   ========================================================================== */

/**
 * Individual preset labels may be overridden with:
 *
 * data-preset-today-label
 * data-preset-yesterday-label
 * data-preset-last7-label
 * data-preset-last30-label
 * data-preset-this-month-label
 * data-preset-last-month-label
 */

function getPresetOverrides(component) {
  if (!component?.dataset) return {};

  return {
    [PRESETS.today]: component.dataset.presetTodayLabel?.trim() || undefined,

    [PRESETS.yesterday]:
      component.dataset.presetYesterdayLabel?.trim() || undefined,

    [PRESETS.last7]: component.dataset.presetLast7Label?.trim() || undefined,

    [PRESETS.last30]: component.dataset.presetLast30Label?.trim() || undefined,

    [PRESETS.thisMonth]:
      component.dataset.presetThisMonthLabel?.trim() || undefined,

    [PRESETS.lastMonth]:
      component.dataset.presetLastMonthLabel?.trim() || undefined,
  };
}

/* ==========================================================================
   Message Factory
   ========================================================================== */

export function getCustomDateMessages(component) {
  const documentReference = component?.ownerDocument || document;

  const locale = getDocumentLocale(documentReference);
  const direction = getDocumentDirection(documentReference);

  const dictionary = getMessageDictionary(locale);
  const overrides = getComponentOverrides(component);
  const presetOverrides = getPresetOverrides(component);

  const presetLabels = Object.freeze(
    Object.fromEntries(
      Object.entries(dictionary.presetLabels).map(([key, label]) => [
        key,
        presetOverrides[key] || label,
      ]),
    ),
  );

  return Object.freeze({
    ...dictionary,
    ...Object.fromEntries(
      Object.entries(overrides).filter(([, value]) => value !== undefined),
    ),

    locale,
    direction,
    presetLabels,
  });
}
