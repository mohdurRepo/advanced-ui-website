import { DEFAULTS, ISO_DATE_PATTERN, WEEKDAYS } from "./constants";

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
 * Date-only values are created at local noon.
 *
 * Noon avoids date movement around daylight-saving transitions while keeping
 * calendar calculations in the user's local civil-date system.
 */

export function createDate(year, month, day) {
  const date = new Date(year, month, day, 12, 0, 0, 0);

  if (
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
  if (typeof value !== "string") return null;

  const normalizedValue = value.trim();

  if (!ISO_DATE_PATTERN.test(normalizedValue)) {
    return null;
  }

  const [year, month, day] = normalizedValue.split("-").map(Number);

  return createDate(year, month - 1, day);
}

export function formatISODate(date) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) return "";

  const year = String(normalizedDate.getFullYear()).padStart(4, "0");
  const month = String(normalizedDate.getMonth() + 1).padStart(2, "0");
  const day = String(normalizedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* ==========================================================================
   Date Keys and Comparison
   ========================================================================== */

/**
 * A numeric civil-date key avoids time-zone and daylight-saving comparisons.
 */

export function getDateKey(date) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) return Number.NaN;

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

  if (firstKey < secondKey) return -1;
  if (firstKey > secondKey) return 1;

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

  if (!normalizedDate || !Number.isFinite(amount)) return null;

  const result = cloneDate(normalizedDate);

  result.setDate(result.getDate() + Math.trunc(amount));

  return normalizeDate(result);
}

export function addMonths(date, amount) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate || !Number.isFinite(amount)) return null;

  const originalDay = normalizedDate.getDate();

  const target = createDate(
    normalizedDate.getFullYear(),
    normalizedDate.getMonth(),
    1,
  );

  target.setMonth(target.getMonth() + Math.trunc(amount));

  const maximumDay = getDaysInMonth(target.getFullYear(), target.getMonth());

  target.setDate(Math.min(originalDay, maximumDay));

  return normalizeDate(target);
}

export function addYears(date, amount) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate || !Number.isFinite(amount)) return null;

  const targetYear = normalizedDate.getFullYear() + Math.trunc(amount);

  const maximumDay = getDaysInMonth(targetYear, normalizedDate.getMonth());

  return createDate(
    targetYear,
    normalizedDate.getMonth(),
    Math.min(normalizedDate.getDate(), maximumDay),
  );
}

/* ==========================================================================
   Month Utilities
   ========================================================================== */

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0, 12, 0, 0, 0).getDate();
}

export function startOfMonth(date) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) return null;

  return createDate(normalizedDate.getFullYear(), normalizedDate.getMonth(), 1);
}

export function endOfMonth(date) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) return null;

  return createDate(
    normalizedDate.getFullYear(),
    normalizedDate.getMonth(),
    getDaysInMonth(normalizedDate.getFullYear(), normalizedDate.getMonth()),
  );
}

export function isSameMonth(firstDate, secondDate) {
  const first = normalizeDate(firstDate);
  const second = normalizeDate(secondDate);

  if (!first || !second) return false;

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

  if (!normalizedDate) return null;

  const offset = modulo(normalizedDate.getDay() - firstDayOfWeek, 7);

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

  if (!normalizedDate) return null;

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

export function parseBooleanAttribute(value) {
  if (value === null || value === undefined) return false;

  if (value === "") return true;

  const normalizedValue = String(value).trim().toLowerCase();

  return !["false", "0", "no", "off"].includes(normalizedValue);
}

/* ==========================================================================
   Preset List
   ========================================================================== */

export function parseCommaSeparatedList(value) {
  if (typeof value !== "string") return [];

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

export function getDocumentLocale(documentReference = document) {
  return (
    documentReference.documentElement.lang ||
    documentReference.defaultView?.navigator?.language ||
    "en"
  );
}

export function getDocumentDirection(documentReference = document) {
  const explicitDirection =
    documentReference.documentElement.dir?.toLowerCase();

  if (explicitDirection === "rtl" || explicitDirection === "ltr") {
    return explicitDirection;
  }

  const computedDirection = documentReference.defaultView
    ?.getComputedStyle(documentReference.documentElement)
    ?.direction?.toLowerCase();

  return computedDirection === "rtl" ? "rtl" : "ltr";
}

export function isRTL(documentReference = document) {
  return getDocumentDirection(documentReference) === "rtl";
}

/* ==========================================================================
   Locale Week Information
   ========================================================================== */

/**
 * `Intl.Locale` reports Sunday as 7. JavaScript Date reports Sunday as 0.
 */

export function getFirstDayOfWeek(locale, fallback = DEFAULTS.firstDayOfWeek) {
  if (typeof Intl.Locale !== "function") return fallback;

  try {
    const localeObject = new Intl.Locale(locale);

    const weekInfo =
      typeof localeObject.getWeekInfo === "function"
        ? localeObject.getWeekInfo()
        : localeObject.weekInfo;

    const firstDay = weekInfo?.firstDay;

    if (!Number.isInteger(firstDay)) return fallback;

    return firstDay % 7;
  } catch {
    return fallback;
  }
}

/* ==========================================================================
   Localized Calendar Labels
   ========================================================================== */

export function getMonthNames(locale, { width = "long" } = {}) {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: width,
    timeZone: "UTC",
  });

  return Array.from({ length: 12 }, (_, month) =>
    formatter.format(new Date(Date.UTC(2020, month, 1))),
  );
}

export function getWeekdayNames(
  locale,
  { width = "short", firstDayOfWeek = DEFAULTS.firstDayOfWeek } = {},
) {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: width,
    timeZone: "UTC",
  });

  const sunday = new Date(Date.UTC(2020, 5, 7));

  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);

    date.setUTCDate(sunday.getUTCDate() + index);

    return formatter.format(date);
  });

  return [
    ...weekdays.slice(firstDayOfWeek),
    ...weekdays.slice(0, firstDayOfWeek),
  ];
}

export function formatAccessibleDate(date, locale) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) return "";

  const utcDate = new Date(
    Date.UTC(
      normalizedDate.getFullYear(),
      normalizedDate.getMonth(),
      normalizedDate.getDate(),
    ),
  );

  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcDate);
}

export function formatAccessibleMonth(date, locale) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) return "";

  const utcDate = new Date(
    Date.UTC(normalizedDate.getFullYear(), normalizedDate.getMonth(), 1),
  );

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(utcDate);
}

/* ==========================================================================
   DOM Creation
   ========================================================================== */

export function createElement(
  tagName,
  { className = "", attributes = {}, dataset = {}, text = null } = {},
  documentReference = document,
) {
  const element = documentReference.createElement(tagName);

  if (className) {
    element.className = className;
  }

  Object.entries(attributes).forEach(([name, value]) => {
    if (value === null || value === undefined || value === false) return;

    if (value === true) {
      element.setAttribute(name, "");
      return;
    }

    element.setAttribute(name, String(value));
  });

  Object.entries(dataset).forEach(([name, value]) => {
    if (value === null || value === undefined) return;

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

export function ensureElementId(element, prefix = "custom-date") {
  if (!element) return "";

  if (!element.id) {
    element.id = createUniqueId(prefix);
  }

  return element.id;
}

/* ==========================================================================
   Associated Labels
   ========================================================================== */

export function getAssociatedLabel(input) {
  if (!input) return null;

  if (input.labels?.length) {
    return input.labels[0];
  }

  if (input.id) {
    const escapedId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(input.id)
        : input.id.replace(/["\\]/g, "\\$&");

    const label = input.ownerDocument.querySelector(
      `label[for="${escapedId}"]`,
    );

    if (label) return label;
  }

  return input.closest("label");
}

/* ==========================================================================
   Attribute Restoration
   ========================================================================== */

export function restoreAttribute(element, name, value) {
  if (!element) return;

  if (value === null || value === undefined) {
    element.removeAttribute(name);
    return;
  }

  element.setAttribute(name, value);
}

/* ==========================================================================
   Focus
   ========================================================================== */

export function focusSafely(element, options = { preventScroll: true }) {
  if (!element || typeof element.focus !== "function") return false;

  try {
    element.focus(options);
  } catch {
    element.focus();
  }

  return element.ownerDocument.activeElement === element;
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
  if (!element || !eventName) return null;

  const view = element.ownerDocument.defaultView;
  const EventConstructor = view?.CustomEvent || CustomEvent;

  const event = new EventConstructor(eventName, {
    bubbles: true,
    cancelable: Boolean(options.cancelable),
    composed: true,
    detail,
  });

  element.dispatchEvent(event);

  return event;
}

/* ==========================================================================
   CSS Time Parsing
   ========================================================================== */

export function readCssTime(element, propertyName, fallback = 0) {
  if (!element) return fallback;

  const view = element.ownerDocument.defaultView;
  const value = view
    .getComputedStyle(element)
    .getPropertyValue(propertyName)
    .trim();

  if (!value) return fallback;

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

export function readCssLength(element, propertyName, fallback = 0) {
  if (!element) return fallback;

  const view = element.ownerDocument.defaultView;

  const value = view
    .getComputedStyle(element)
    .getPropertyValue(propertyName)
    .trim();

  const match = value.match(/^(-?(?:\d+|\d*\.\d+))(px|rem|em)?$/i);

  if (!match) return fallback;

  const amount = Number(match[1]);
  const unit = (match[2] || "px").toLowerCase();

  if (!Number.isFinite(amount)) return fallback;
  if (unit === "px") return amount;

  const root = element.ownerDocument.documentElement;
  const fontTarget = unit === "rem" ? root : element;

  const fontSize = Number.parseFloat(
    view.getComputedStyle(fontTarget).fontSize,
  );

  return Number.isFinite(fontSize) ? amount * fontSize : fallback;
}
