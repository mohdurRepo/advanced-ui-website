import { DEFAULTS, ISO_DATE_PATTERN, WEEKDAYS } from "./constants";

/* ==========================================================================
   Environment
   ========================================================================== */

/**
 * Returns the browser document when one exists.
 *
 * Most component calls explicitly provide an ownerDocument, but keeping the
 * fallback guarded makes these utilities safer in tests, SSR builds, and
 * non-browser module evaluation.
 */
function getDefaultDocument() {
  return typeof document !== "undefined" ? document : null;
}

/* ==========================================================================
   Numeric Utilities
   ========================================================================== */

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

/* ==========================================================================
   Element Guards
   ========================================================================== */

export function isInputElement(element) {
  return element?.tagName === "INPUT";
}

export function isButtonElement(element) {
  return element?.tagName === "BUTTON";
}

/* ==========================================================================
   Date Construction
   ========================================================================== */

/**
 * Creates a local civil date at noon.
 *
 * Noon avoids date movement around daylight-saving transitions while keeping
 * all calendar calculations in the user's local civil-date system.
 *
 * setFullYear() is intentionally used rather than:
 *
 *     new Date(year, month, day)
 *
 * because the Date constructor treats years 0–99 as 1900–1999.
 */
export function createDate(year, month, day) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const date = new Date(0);

  /*
   * Establish local noon before assigning the civil-date fields.
   */
  date.setHours(12, 0, 0, 0);

  date.setFullYear(year, month, day);

  /*
   * Reject overflow such as:
   *
   * 2026-02-31
   * month 12
   * day 0
   */
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function normalizeDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return createDate(date.getFullYear(), date.getMonth(), date.getDate());
}

export function cloneDate(date) {
  return normalizeDate(date);
}

export function getToday() {
  return normalizeDate(new Date());
}

/* ==========================================================================
   ISO Parsing and Formatting
   ========================================================================== */

export function parseISODate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (!ISO_DATE_PATTERN.test(normalizedValue)) {
    return null;
  }

  const [year, month, day] = normalizedValue.split("-").map(Number);

  return createDate(year, month - 1, day);
}

export function formatISODate(date) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) {
    return "";
  }

  const year = String(normalizedDate.getFullYear()).padStart(4, "0");

  const month = String(normalizedDate.getMonth() + 1).padStart(2, "0");

  const day = String(normalizedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* ==========================================================================
   Date Keys and Comparison
   ========================================================================== */

/**
 * Converts a date into a sortable civil-date key.
 *
 * This avoids comparing timestamps and therefore avoids time-zone and
 * daylight-saving effects.
 */
export function getDateKey(date) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) {
    return Number.NaN;
  }

  return (
    normalizedDate.getFullYear() * 10_000 +
    (normalizedDate.getMonth() + 1) * 100 +
    normalizedDate.getDate()
  );
}

export function compareDates(firstDate, secondDate) {
  const firstKey = getDateKey(firstDate);

  const secondKey = getDateKey(secondDate);

  if (!Number.isFinite(firstKey) || !Number.isFinite(secondKey)) {
    return Number.NaN;
  }

  if (firstKey < secondKey) {
    return -1;
  }

  if (firstKey > secondKey) {
    return 1;
  }

  return 0;
}

export function isSameDay(firstDate, secondDate) {
  return compareDates(firstDate, secondDate) === 0;
}

export function isBefore(firstDate, secondDate) {
  return compareDates(firstDate, secondDate) < 0;
}

export function isAfter(firstDate, secondDate) {
  return compareDates(firstDate, secondDate) > 0;
}

export function isDateBetween(
  date,
  startDate,
  endDate,
  { inclusive = true } = {},
) {
  const startComparison = compareDates(date, startDate);

  const endComparison = compareDates(date, endDate);

  if (!Number.isFinite(startComparison) || !Number.isFinite(endComparison)) {
    return false;
  }

  if (inclusive) {
    return startComparison >= 0 && endComparison <= 0;
  }

  return startComparison > 0 && endComparison < 0;
}

/* ==========================================================================
   Date Arithmetic
   ========================================================================== */

export function addDays(date, amount) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate || !Number.isFinite(amount)) {
    return null;
  }

  const result = cloneDate(normalizedDate);

  result.setDate(result.getDate() + Math.trunc(amount));

  return normalizeDate(result);
}

export function addMonths(date, amount) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate || !Number.isFinite(amount)) {
    return null;
  }

  const originalDay = normalizedDate.getDate();

  /*
   * Move from the first day of the source month so dates such as January 31
   * cannot overflow directly into the following target month.
   */
  const target = createDate(
    normalizedDate.getFullYear(),

    normalizedDate.getMonth(),

    1,
  );

  if (!target) {
    return null;
  }

  target.setMonth(target.getMonth() + Math.trunc(amount));

  const maximumDay = getDaysInMonth(target.getFullYear(), target.getMonth());

  if (!Number.isFinite(maximumDay)) {
    return null;
  }

  target.setDate(Math.min(originalDay, maximumDay));

  return normalizeDate(target);
}

export function addYears(date, amount) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate || !Number.isFinite(amount)) {
    return null;
  }

  const targetYear = normalizedDate.getFullYear() + Math.trunc(amount);

  const maximumDay = getDaysInMonth(targetYear, normalizedDate.getMonth());

  if (!Number.isFinite(maximumDay)) {
    return null;
  }

  /*
   * February 29 becomes February 28 when moving into a non-leap year.
   */
  return createDate(
    targetYear,

    normalizedDate.getMonth(),

    Math.min(
      normalizedDate.getDate(),

      maximumDay,
    ),
  );
}

/* ==========================================================================
   Month Utilities
   ========================================================================== */

/**
 * Returns the number of days in a calendar month.
 *
 * Month follows JavaScript's zero-based month numbering.
 */
export function getDaysInMonth(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return Number.NaN;
  }

  /*
   * Using setFullYear avoids Date's special 0–99 year handling.
   *
   * Day 0 of the following month is the final day of the requested month.
   */
  const date = new Date(0);

  date.setHours(12, 0, 0, 0);

  date.setFullYear(year, month + 1, 0);

  if (Number.isNaN(date.getTime())) {
    return Number.NaN;
  }

  return date.getDate();
}

export function startOfMonth(date) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) {
    return null;
  }

  return createDate(normalizedDate.getFullYear(), normalizedDate.getMonth(), 1);
}

export function endOfMonth(date) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) {
    return null;
  }

  const maximumDay = getDaysInMonth(
    normalizedDate.getFullYear(),

    normalizedDate.getMonth(),
  );

  if (!Number.isFinite(maximumDay)) {
    return null;
  }

  return createDate(
    normalizedDate.getFullYear(),

    normalizedDate.getMonth(),

    maximumDay,
  );
}

export function isSameMonth(firstDate, secondDate) {
  const first = normalizeDate(firstDate);

  const second = normalizeDate(secondDate);

  if (!first || !second) {
    return false;
  }

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth()
  );
}

/* ==========================================================================
   Week Utilities
   ========================================================================== */

export function startOfWeek(date, firstDayOfWeek = DEFAULTS.firstDayOfWeek) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) {
    return null;
  }

  const normalizedFirstDay = Number.isFinite(firstDayOfWeek)
    ? modulo(Math.trunc(firstDayOfWeek), 7)
    : DEFAULTS.firstDayOfWeek;

  const offset = modulo(normalizedDate.getDay() - normalizedFirstDay, 7);

  return addDays(normalizedDate, -offset);
}

export function endOfWeek(date, firstDayOfWeek = DEFAULTS.firstDayOfWeek) {
  const startDate = startOfWeek(date, firstDayOfWeek);

  return startDate ? addDays(startDate, 6) : null;
}

/* ==========================================================================
   Date Clamping
   ========================================================================== */

export function clampDate(date, minimumDate, maximumDate) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) {
    return null;
  }

  if (minimumDate && isBefore(normalizedDate, minimumDate)) {
    return cloneDate(minimumDate);
  }

  if (maximumDate && isAfter(normalizedDate, maximumDate)) {
    return cloneDate(maximumDate);
  }

  return normalizedDate;
}

/* ==========================================================================
   Disabled Weekdays
   ========================================================================== */

export function parseDisabledWeekdays(value) {
  if (typeof value !== "string" || !value.trim()) {
    return new Set();
  }

  return new Set(
    value
      .split(",")
      .map((item) => Number.parseInt(item.trim(), 10))
      .filter(
        (weekday) =>
          Number.isInteger(weekday) &&
          weekday >= WEEKDAYS.sunday &&
          weekday <= WEEKDAYS.saturday,
      ),
  );
}

/* ==========================================================================
   Boolean Data Attributes
   ========================================================================== */

/**
 * HTML-style boolean parser.
 *
 * These are treated as false:
 *
 * false
 * 0
 * no
 * off
 *
 * Every other present value is treated as true.
 */
export function parseBooleanAttribute(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (value === "") {
    return true;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  return !["false", "0", "no", "off"].includes(normalizedValue);
}

/* ==========================================================================
   Preset List
   ========================================================================== */

export function parseCommaSeparatedList(value) {
  if (typeof value !== "string") {
    return [];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

/* ==========================================================================
   Locale
   ========================================================================== */

export function getDocumentLocale(documentReference = getDefaultDocument()) {
  if (!documentReference) {
    return "en";
  }

  const documentLanguage = documentReference.documentElement?.lang?.trim();

  if (documentLanguage) {
    return documentLanguage;
  }

  const navigatorLanguage =
    documentReference.defaultView?.navigator?.language?.trim();

  return navigatorLanguage || "en";
}

export function getDocumentDirection(documentReference = getDefaultDocument()) {
  if (!documentReference) {
    return "ltr";
  }

  const documentElement = documentReference.documentElement;

  if (!documentElement) {
    return "ltr";
  }

  const explicitDirection = documentElement.dir?.trim().toLowerCase();

  if (explicitDirection === "rtl" || explicitDirection === "ltr") {
    return explicitDirection;
  }

  const view = documentReference.defaultView;

  if (!view || typeof view.getComputedStyle !== "function") {
    return "ltr";
  }

  const computedDirection = view
    .getComputedStyle(documentElement)
    .direction?.toLowerCase();

  return computedDirection === "rtl" ? "rtl" : "ltr";
}

export function isRTL(documentReference = getDefaultDocument()) {
  return getDocumentDirection(documentReference) === "rtl";
}

/* ==========================================================================
   Locale Week Information
   ========================================================================== */

/**
 * Intl.Locale reports Sunday as 7.
 * JavaScript Date reports Sunday as 0.
 */
export function getFirstDayOfWeek(locale, fallback = DEFAULTS.firstDayOfWeek) {
  if (typeof Intl === "undefined" || typeof Intl.Locale !== "function") {
    return fallback;
  }

  try {
    const localeObject = new Intl.Locale(locale);

    const weekInfo =
      typeof localeObject.getWeekInfo === "function"
        ? localeObject.getWeekInfo()
        : localeObject.weekInfo;

    const firstDay = weekInfo?.firstDay;

    if (!Number.isInteger(firstDay)) {
      return fallback;
    }

    /*
     * Intl:
     * Sunday = 7
     *
     * Date:
     * Sunday = 0
     */
    return firstDay % 7;
  } catch {
    return fallback;
  }
}

/* ==========================================================================
   Intl Formatter
   ========================================================================== */

/**
 * Creates an Intl.DateTimeFormat while gracefully falling back when the
 * supplied locale is invalid.
 */
function createDateTimeFormatter(locale, options) {
  try {
    return new Intl.DateTimeFormat(locale || "en", options);
  } catch {
    return new Intl.DateTimeFormat("en", options);
  }
}

/* ==========================================================================
   Localized Calendar Labels
   ========================================================================== */

export function getMonthNames(locale, { width = "long" } = {}) {
  const formatter = createDateTimeFormatter(locale, {
    month: width,
    timeZone: "UTC",
  });

  return Array.from(
    {
      length: 12,
    },
    (_, month) => formatter.format(new Date(Date.UTC(2020, month, 1))),
  );
}

export function getWeekdayNames(
  locale,
  {
    width = "short",

    firstDayOfWeek = DEFAULTS.firstDayOfWeek,
  } = {},
) {
  const formatter = createDateTimeFormatter(locale, {
    weekday: width,
    timeZone: "UTC",
  });

  /*
   * 2020-06-07 was a Sunday.
   */
  const sunday = new Date(Date.UTC(2020, 5, 7));

  const weekdays = Array.from(
    {
      length: 7,
    },
    (_, index) => {
      const date = new Date(sunday);

      date.setUTCDate(sunday.getUTCDate() + index);

      return formatter.format(date);
    },
  );

  const normalizedFirstDay = Number.isFinite(firstDayOfWeek)
    ? modulo(Math.trunc(firstDayOfWeek), 7)
    : DEFAULTS.firstDayOfWeek;

  return [
    ...weekdays.slice(normalizedFirstDay),

    ...weekdays.slice(0, normalizedFirstDay),
  ];
}

export function formatAccessibleDate(date, locale) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) {
    return "";
  }

  /*
   * Convert the civil date to an equivalent UTC date before formatting.
   *
   * This ensures the localized accessible label never shifts to the previous
   * or following day because of the user's time zone.
   */
  const utcDate = new Date(
    Date.UTC(
      normalizedDate.getFullYear(),

      normalizedDate.getMonth(),

      normalizedDate.getDate(),
    ),
  );

  const formatter = createDateTimeFormatter(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return formatter.format(utcDate);
}

export function formatAccessibleMonth(date, locale) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) {
    return "";
  }

  const utcDate = new Date(
    Date.UTC(
      normalizedDate.getFullYear(),

      normalizedDate.getMonth(),

      1,
    ),
  );

  const formatter = createDateTimeFormatter(locale, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return formatter.format(utcDate);
}

/* ==========================================================================
   DOM Creation
   ========================================================================== */

/**
 * Creates an element and applies optional classes, attributes, dataset values,
 * and text.
 *
 * Attribute rules:
 *
 * null / undefined / false
 *   Attribute is omitted.
 *
 * true
 *   Boolean attribute is emitted as an empty attribute.
 *
 * everything else
 *   Value is stringified.
 */
export function createElement(
  tagName,
  { className = "", attributes = {}, dataset = {}, text = null } = {},
  documentReference = getDefaultDocument(),
) {
  if (
    !documentReference ||
    typeof documentReference.createElement !== "function"
  ) {
    throw new TypeError("createElement requires a valid Document.");
  }

  const element = documentReference.createElement(tagName);

  if (className) {
    element.className = className;
  }

  Object.entries(attributes).forEach(([name, value]) => {
    if (value === null || value === undefined || value === false) {
      return;
    }

    if (value === true) {
      element.setAttribute(name, "");

      return;
    }

    element.setAttribute(name, String(value));
  });

  Object.entries(dataset).forEach(([name, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    element.dataset[name] = String(value);
  });

  if (text !== null && text !== undefined) {
    element.textContent = String(text);
  }

  return element;
}

/* ==========================================================================
   Unique IDs
   ========================================================================== */

let generatedId = 0;

export function createUniqueId(prefix = "custom-date") {
  generatedId += 1;

  return `${prefix}-${generatedId}`;
}

/**
 * Ensures that an element has an ID.
 *
 * Existing IDs are preserved because they may be referenced by labels,
 * validation messages, tests, or application code.
 */
export function ensureElementId(element, prefix = "custom-date") {
  if (!element) {
    return "";
  }

  if (!element.id) {
    const documentReference = element.ownerDocument;

    let candidateId;

    /*
     * Avoid accidentally generating an ID that already exists in the current
     * document.
     */
    do {
      candidateId = createUniqueId(prefix);
    } while (documentReference?.getElementById?.(candidateId));

    element.id = candidateId;
  }

  return element.id;
}

/* ==========================================================================
   Associated Labels
   ========================================================================== */

export function getAssociatedLabel(input) {
  if (!input) {
    return null;
  }

  /*
   * The native labels collection is the most reliable source and correctly
   * handles both explicit and wrapping labels.
   */
  if (input.labels?.length) {
    return input.labels[0];
  }

  if (input.id && input.ownerDocument) {
    const escapedId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(input.id)
        : input.id.replace(/["\\]/g, "\\$&");

    try {
      const label = input.ownerDocument.querySelector(
        `label[for="${escapedId}"]`,
      );

      if (label) {
        return label;
      }
    } catch {
      /*
       * Fall through to wrapping-label lookup if an unusual legacy ID cannot
       * be represented safely by the fallback selector escaping.
       */
    }
  }

  return input.closest?.("label") || null;
}

/* ==========================================================================
   Attribute Restoration
   ========================================================================== */

/**
 * Restores an attribute captured before enhancement.
 *
 * null / undefined means the original attribute was absent.
 */
export function restoreAttribute(element, name, value) {
  if (!element || !name) {
    return;
  }

  if (value === null || value === undefined) {
    element.removeAttribute(name);

    return;
  }

  element.setAttribute(name, String(value));
}

/* ==========================================================================
   Focus
   ========================================================================== */

export function focusSafely(
  element,
  options = {
    preventScroll: true,
  },
) {
  if (!element || typeof element.focus !== "function") {
    return false;
  }

  try {
    element.focus(options);
  } catch {
    /*
     * Older browsers may reject the FocusOptions argument.
     */
    element.focus();
  }

  return element.ownerDocument?.activeElement === element;
}

/* ==========================================================================
   Events
   ========================================================================== */

export function dispatchComponentEvent(
  element,
  eventName,
  detail = {},
  options = {},
) {
  if (!element || !eventName) {
    return null;
  }

  const documentReference = element.ownerDocument;

  const view = documentReference?.defaultView;

  const EventConstructor =
    view?.CustomEvent ||
    (typeof CustomEvent !== "undefined" ? CustomEvent : null);

  if (!EventConstructor) {
    return null;
  }

  const event = new EventConstructor(eventName, {
    bubbles: true,

    cancelable: Boolean(options.cancelable),

    /*
     * Allows events to pass through shadow-DOM boundaries when the
     * component is used inside a shadow root.
     */
    composed: true,

    detail,
  });

  element.dispatchEvent(event);

  return event;
}

/* ==========================================================================
   CSS Time Parsing
   ========================================================================== */

/**
 * Reads a CSS custom property representing time.
 *
 * Supported examples:
 *
 * 140ms
 * .14s
 * 140
 */
export function readCssTime(element, propertyName, fallback = 0) {
  if (!element || !propertyName) {
    return fallback;
  }

  const view = element.ownerDocument?.defaultView;

  if (!view || typeof view.getComputedStyle !== "function") {
    return fallback;
  }

  const value = view
    .getComputedStyle(element)
    .getPropertyValue(propertyName)
    .trim();

  if (!value) {
    return fallback;
  }

  if (value.endsWith("ms")) {
    const milliseconds = Number.parseFloat(value);

    return Number.isFinite(milliseconds) ? milliseconds : fallback;
  }

  if (value.endsWith("s")) {
    const seconds = Number.parseFloat(value);

    return Number.isFinite(seconds) ? seconds * 1000 : fallback;
  }

  const number = Number.parseFloat(value);

  return Number.isFinite(number) ? number : fallback;
}

/* ==========================================================================
   CSS Length Parsing
   ========================================================================== */

/**
 * Reads simple CSS lengths used by the positioning system.
 *
 * Supported units:
 *
 * px
 * rem
 * em
 *
 * Unitless values are interpreted as pixels.
 */
export function readCssLength(element, propertyName, fallback = 0) {
  if (!element || !propertyName) {
    return fallback;
  }

  const documentReference = element.ownerDocument;

  const view = documentReference?.defaultView;

  if (!view || typeof view.getComputedStyle !== "function") {
    return fallback;
  }

  const value = view
    .getComputedStyle(element)
    .getPropertyValue(propertyName)
    .trim();

  const match = value.match(/^(-?(?:\d+|\d*\.\d+))(px|rem|em)?$/i);

  if (!match) {
    return fallback;
  }

  const amount = Number(match[1]);

  const unit = (match[2] || "px").toLowerCase();

  if (!Number.isFinite(amount)) {
    return fallback;
  }

  if (unit === "px") {
    return amount;
  }

  const root = documentReference?.documentElement;

  const fontTarget = unit === "rem" ? root : element;

  if (!fontTarget) {
    return fallback;
  }

  const fontSize = Number.parseFloat(
    view.getComputedStyle(fontTarget).fontSize,
  );

  return Number.isFinite(fontSize) ? amount * fontSize : fallback;
}
