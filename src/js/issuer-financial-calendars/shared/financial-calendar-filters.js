/* ==========================================================================
   Financial Calendar Filters
   ========================================================================== */

/*
 * Shared filter state and lifecycle for Issuer Financial Calendar tabs.
 *
 * Responsibilities:
 *
 * - read and normalize native filter controls
 * - maintain immutable filter snapshots
 * - emit one notification for each meaningful user action
 * - debounce company search
 * - validate date ranges
 * - convert ISO input dates to the legacy DD-MM-YYYY service format
 * - provide a five-year default date range
 * - reset controls and dates safely
 * - support programmatic value/state changes
 * - synchronize dynamically updated Sector controls
 *
 * This module intentionally has no:
 *
 * - API requests
 * - Market -> Sector loading
 * - tab activation
 * - table or card rendering
 * - page-level loading state
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  formatInputDate,
  formatRequestDate,
  normalizeString,
  parseDateParts,
} from "./financial-calendar-utils.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_DATE_RANGE_YEARS = 5;

const DEFAULT_SEARCH_DEBOUNCE_MS = 300;

const SELECTORS = Object.freeze({
  customSelect: "[data-custom-select]",

  customDate: "[data-custom-date-range]",
});

export const FINANCIAL_CALENDAR_FILTER_FIELDS = Object.freeze({
  MARKET: "market",

  SECTOR: "sector",

  COMPANY: "company",

  PERIOD: "period",

  TYPE: "type",

  STATUS: "status",

  FROM_DATE: "fromDate",

  TO_DATE: "toDate",
});

export const FINANCIAL_CALENDAR_FILTER_EFFECTS = Object.freeze({
  RELOAD: "reload",

  DEPENDENCY: "dependency",

  NONE: "none",
});

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    );
  }

  return value;
}

function freezeSnapshot(value) {
  const cloned = cloneValue(value);

  function freeze(item) {
    if (item === null || typeof item !== "object" || Object.isFrozen(item)) {
      return item;
    }

    Object.values(item).forEach(freeze);

    return Object.freeze(item);
  }

  return freeze(cloned);
}

function areEqual(first, second) {
  if (Object.is(first, second)) {
    return true;
  }

  if (typeof first !== typeof second || first === null || second === null) {
    return false;
  }

  if (typeof first !== "object") {
    return false;
  }

  if (Array.isArray(first) !== Array.isArray(second)) {
    return false;
  }

  if (Array.isArray(first)) {
    return (
      first.length === second.length &&
      first.every((value, index) => areEqual(value, second[index]))
    );
  }

  const firstKeys = Object.keys(first);

  const secondKeys = Object.keys(second);

  if (firstKeys.length !== secondKeys.length) {
    return false;
  }

  return firstKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(second, key) &&
      areEqual(first[key], second[key]),
  );
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNonNegativeInteger(value, fallback) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/* ==========================================================================
   DOM Resolution
   ========================================================================== */

function resolveElement(root, value) {
  if (typeof Element !== "undefined" && value instanceof Element) {
    return value;
  }

  if (
    typeof value === "string" &&
    root &&
    typeof root.querySelector === "function"
  ) {
    return root.querySelector(value);
  }

  return null;
}

function requireForm(root, value) {
  const form = resolveElement(root, value);

  if (
    typeof HTMLFormElement === "undefined" ||
    !(form instanceof HTMLFormElement)
  ) {
    throw new Error("Financial Calendar filters require a valid form.");
  }

  return form;
}

function requireControl(form, value, description) {
  const control = resolveElement(form, value);

  if (typeof HTMLElement === "undefined" || !(control instanceof HTMLElement)) {
    throw new Error(
      `Financial Calendar filter "${description}" was not found.`,
    );
  }

  return control;
}

/* ==========================================================================
   Date Helpers
   ========================================================================== */

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function toLocalIsoDate(date) {
  return [
    date.getFullYear(),

    padDatePart(date.getMonth() + 1),

    padDatePart(date.getDate()),
  ].join("-");
}

function createPastDate(today, years) {
  const targetYear = today.getFullYear() - years;

  const month = today.getMonth();

  const day = today.getDate();

  const lastDayOfTargetMonth = new Date(targetYear, month + 1, 0).getDate();

  return new Date(targetYear, month, Math.min(day, lastDayOfTargetMonth));
}

export function createFinancialCalendarDefaultDateRange(
  years = DEFAULT_DATE_RANGE_YEARS,
  now = new Date(),
) {
  const normalizedYears = normalizePositiveInteger(
    years,
    DEFAULT_DATE_RANGE_YEARS,
  );

  const today =
    now instanceof Date && !Number.isNaN(now.getTime())
      ? new Date(now.getTime())
      : new Date();

  const fromDate = createPastDate(today, normalizedYears);

  return Object.freeze({
    fromDate: toLocalIsoDate(fromDate),

    toDate: toLocalIsoDate(today),
  });
}

function getComparableDate(value) {
  const parts = parseDateParts(value);

  if (!parts) {
    return null;
  }

  return parts.year * 10000 + parts.month * 100 + parts.day;
}

export function validateFinancialCalendarDateRange(fromDate, toDate) {
  const normalizedFrom = normalizeString(fromDate);

  const normalizedTo = normalizeString(toDate);

  /*
   * A completely cleared range is valid. The service receives empty dates.
   */

  if (!normalizedFrom && !normalizedTo) {
    return Object.freeze({
      valid: true,

      reason: "",

      fromDate: "",

      toDate: "",
    });
  }

  /*
   * A partially completed range must not produce an API request.
   */

  if (!normalizedFrom || !normalizedTo) {
    return Object.freeze({
      valid: false,

      reason: "incomplete-date-range",

      fromDate: normalizedFrom,

      toDate: normalizedTo,
    });
  }

  const comparableFrom = getComparableDate(normalizedFrom);

  const comparableTo = getComparableDate(normalizedTo);

  if (comparableFrom === null || comparableTo === null) {
    return Object.freeze({
      valid: false,

      reason: "invalid-date",

      fromDate: normalizedFrom,

      toDate: normalizedTo,
    });
  }

  if (comparableFrom > comparableTo) {
    return Object.freeze({
      valid: false,

      reason: "date-order",

      fromDate: normalizedFrom,

      toDate: normalizedTo,
    });
  }

  return Object.freeze({
    valid: true,

    reason: "",

    fromDate: normalizedFrom,

    toDate: normalizedTo,
  });
}

export function formatFinancialCalendarServiceDate(value) {
  return formatRequestDate(value, "");
}

/* ==========================================================================
   Field Definition
   ========================================================================== */

function normalizeFieldDefinition(key, definition) {
  if (typeof definition === "string") {
    return {
      key,

      selector: definition,
    };
  }

  if (!isPlainObject(definition)) {
    throw new TypeError(
      `Financial Calendar filter "${key}" requires a selector or configuration object.`,
    );
  }

  return {
    key,

    ...definition,
  };
}

function normalizeDefaultValue(value) {
  return value == null ? "" : String(value);
}

/* ==========================================================================
   Value Reading
   ========================================================================== */

function readControl(control) {
  if (control instanceof HTMLInputElement) {
    if (control.type === "checkbox") {
      return control.checked;
    }

    if (control.type === "radio") {
      return control.checked ? control.value : undefined;
    }

    return control.value;
  }

  if (
    control instanceof HTMLSelectElement ||
    control instanceof HTMLTextAreaElement
  ) {
    return control.value;
  }

  return control.dataset.value ?? "";
}

function normalizeFieldValue(field, value) {
  if (typeof field.normalize === "function") {
    return field.normalize(value, {
      field,

      control: field.control,
    });
  }

  if (typeof value === "boolean") {
    return value;
  }

  return normalizeString(value);
}

function readField(field) {
  return normalizeFieldValue(field, readControl(field.control));
}

/* ==========================================================================
   Value Writing
   ========================================================================== */

function writeControl(control, value) {
  if (control instanceof HTMLInputElement && control.type === "checkbox") {
    control.checked = Boolean(value);

    return;
  }

  if (control instanceof HTMLInputElement && control.type === "radio") {
    control.checked = String(control.value) === String(value ?? "");

    return;
  }

  if (
    control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement ||
    control instanceof HTMLTextAreaElement
  ) {
    control.value = value == null ? "" : String(value);

    return;
  }

  control.dataset.value = value == null ? "" : String(value);
}

function refreshEnhancedControl(control) {
  /*
   * Non-bubbling change events refresh the enhanced control without reaching
   * the delegated form listener and causing another filter notification.
   */

  control.dispatchEvent(
    new Event("change", {
      bubbles: false,
    }),
  );

  const customSelect = control.closest(SELECTORS.customSelect);

  customSelect?.dispatchEvent(
    new CustomEvent("custom-select:refresh", {
      bubbles: false,

      detail: Object.freeze({
        control,

        source: "financial-calendar-filters",
      }),
    }),
  );

  const customDate = control.closest(SELECTORS.customDate);

  customDate?.dispatchEvent(
    new CustomEvent("custom-date:refresh", {
      bubbles: false,

      detail: Object.freeze({
        control,

        source: "financial-calendar-filters",
      }),
    }),
  );
}

function writeField(field, value) {
  const normalizedValue = normalizeFieldValue(field, value);

  if (typeof field.write === "function") {
    field.write(normalizedValue, {
      field,

      control: field.control,
    });
  } else {
    writeControl(field.control, normalizedValue);
  }

  refreshEnhancedControl(field.control);

  return normalizedValue;
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createFinancialCalendarFilters(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError(
      "createFinancialCalendarFilters requires an options object.",
    );
  }

  const root = options.root || document;

  const form = requireForm(root, options.form);

  const config = isPlainObject(options.config) ? options.config : {};

  if (!isPlainObject(options.fields)) {
    throw new TypeError(
      "Financial Calendar filters require field definitions.",
    );
  }

  const tabKey = normalizeString(options.tabKey, "financial-calendar");

  const searchDebounceMs = normalizeNonNegativeInteger(
    options.searchDebounceMs ?? config.defaults?.searchDebounceMs,
    DEFAULT_SEARCH_DEBOUNCE_MS,
  );

  const dateRangeYears = normalizePositiveInteger(
    options.dateRangeYears ?? config.defaults?.dateRangeYears,
    DEFAULT_DATE_RANGE_YEARS,
  );

  /* ========================================================================
     Fields
     ======================================================================== */

  const fields = new Map();

  const controls = new Map();

  Object.entries(options.fields).forEach(([key, definition]) => {
    const field = normalizeFieldDefinition(key, definition);

    const control = requireControl(form, field.selector, key);

    const normalizedField = {
      effect: FINANCIAL_CALENDAR_FILTER_EFFECTS.RELOAD,

      debounce: false,

      ...field,

      control,
    };

    fields.set(key, normalizedField);

    controls.set(control, key);
  });

  /* ========================================================================
     Default Date Values
     ======================================================================== */

  const defaultDateRange =
    createFinancialCalendarDefaultDateRange(dateRangeYears);

  const fromDateField = fields.get(FINANCIAL_CALENDAR_FILTER_FIELDS.FROM_DATE);

  const toDateField = fields.get(FINANCIAL_CALENDAR_FILTER_FIELDS.TO_DATE);

  if (fromDateField && !normalizeString(readControl(fromDateField.control))) {
    writeControl(fromDateField.control, defaultDateRange.fromDate);

    fromDateField.control.defaultValue = defaultDateRange.fromDate;
  }

  if (toDateField && !normalizeString(readControl(toDateField.control))) {
    writeControl(toDateField.control, defaultDateRange.toDate);

    toDateField.control.defaultValue = defaultDateRange.toDate;
  }

  /* ========================================================================
     Initial and Current State
     ======================================================================== */

  function readState() {
    const nextState = {};

    fields.forEach((field, key) => {
      nextState[key] = readField(field);
    });

    return nextState;
  }

  const initialState = readState();

  fields.forEach((field, key) => {
    if (field.resetValue === undefined) {
      field.resetValue = cloneValue(initialState[key]);
    }
  });

  let state = readState();

  /* ========================================================================
     Lifecycle State
     ======================================================================== */

  const listeners = new Set();

  const abortController = new AbortController();

  let initialized = false;

  let destroyed = false;

  let debounceTimer = null;

  /* ========================================================================
     State Access
     ======================================================================== */

  function getState() {
    return freezeSnapshot(state);
  }

  function getValue(key) {
    return cloneValue(state[key]);
  }

  /* ========================================================================
     Validation
     ======================================================================== */

  function getValidation(nextState = state) {
    const dateValidation = validateFinancialCalendarDateRange(
      nextState[FINANCIAL_CALENDAR_FILTER_FIELDS.FROM_DATE],

      nextState[FINANCIAL_CALENDAR_FILTER_FIELDS.TO_DATE],
    );

    if (!dateValidation.valid) {
      return dateValidation;
    }

    if (typeof options.validate === "function") {
      const customValidation = options.validate(freezeSnapshot(nextState));

      if (isPlainObject(customValidation)) {
        return freezeSnapshot({
          valid: customValidation.valid !== false,

          reason: normalizeString(customValidation.reason),

          ...customValidation,
        });
      }
    }

    return dateValidation;
  }

  /* ========================================================================
     Change Detection
     ======================================================================== */

  function getChangedFields(previousState, nextState) {
    return Array.from(fields.keys()).filter(
      (key) => !areEqual(previousState[key], nextState[key]),
    );
  }

  function resolveEffect(changedFields) {
    const effects = changedFields.map(
      (key) =>
        fields.get(key)?.effect || FINANCIAL_CALENDAR_FILTER_EFFECTS.RELOAD,
    );

    if (effects.includes(FINANCIAL_CALENDAR_FILTER_EFFECTS.DEPENDENCY)) {
      return FINANCIAL_CALENDAR_FILTER_EFFECTS.DEPENDENCY;
    }

    if (effects.includes(FINANCIAL_CALENDAR_FILTER_EFFECTS.RELOAD)) {
      return FINANCIAL_CALENDAR_FILTER_EFFECTS.RELOAD;
    }

    return FINANCIAL_CALENDAR_FILTER_EFFECTS.NONE;
  }

  /* ========================================================================
     Notification
     ======================================================================== */

  function notify({
    type = "change",
    changedFields = [],
    previousState = state,
    source = null,
    effect,
  } = {}) {
    if (destroyed) {
      return;
    }

    const detail = freezeSnapshot({
      tabKey,

      type,

      effect: effect || resolveEffect(changedFields),

      changedFields: [...changedFields],

      previousState,

      state,

      validation: getValidation(state),

      source,
    });

    listeners.forEach((listener) => {
      listener(detail);
    });

    form.dispatchEvent(
      new CustomEvent("financial-calendar:filters-change", {
        bubbles: true,

        detail,
      }),
    );
  }

  /* ========================================================================
     Synchronization
     ======================================================================== */

  function sync(settings = {}) {
    if (destroyed) {
      return false;
    }

    const previousState = state;

    const nextState = readState();

    const changedFields = getChangedFields(previousState, nextState);

    state = nextState;

    if (changedFields.length && settings.notify === true) {
      notify({
        type: settings.type || "sync",

        changedFields,

        previousState,

        source: settings.source || null,

        effect: settings.effect,
      });
    }

    return changedFields.length > 0;
  }

  /* ========================================================================
     User Changes
     ======================================================================== */

  function commitUserChange(sourceEvent) {
    if (destroyed) {
      return;
    }

    const previousState = state;

    const nextState = readState();

    const changedFields = getChangedFields(previousState, nextState);

    if (!changedFields.length) {
      return;
    }

    state = nextState;

    notify({
      type: "change",

      changedFields,

      previousState,

      source: sourceEvent,
    });
  }

  function clearDebounce() {
    if (debounceTimer === null) {
      return;
    }

    window.clearTimeout(debounceTimer);

    debounceTimer = null;
  }

  function scheduleUserChange(sourceEvent) {
    clearDebounce();

    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;

      commitUserChange(sourceEvent);
    }, searchDebounceMs);
  }

  function handleInput(event) {
    if (destroyed) {
      return;
    }

    const key = controls.get(event.target);

    if (!key) {
      return;
    }

    const field = fields.get(key);

    if (!field?.debounce) {
      return;
    }

    scheduleUserChange(event);
  }

  function handleChange(event) {
    if (destroyed) {
      return;
    }

    const key = controls.get(event.target);

    if (!key) {
      return;
    }

    const field = fields.get(key);

    if (!field) {
      return;
    }

    /*
     * A search field is normally committed by its debounced input handler.
     * Its later native change event must not create a second request.
     */

    if (field.debounce) {
      clearDebounce();
    }

    commitUserChange(event);
  }

  /* ========================================================================
     Programmatic Values
     ======================================================================== */

  function setValue(key, value, settings = {}) {
    if (destroyed) {
      return false;
    }

    const field = fields.get(key);

    if (!field) {
      return false;
    }

    const previousState = state;

    const normalizedValue = writeField(field, value);

    const nextState = {
      ...state,

      [key]: normalizedValue,
    };

    const changedFields = getChangedFields(previousState, nextState);

    if (!changedFields.length) {
      return false;
    }

    state = nextState;

    if (settings.notify !== false) {
      notify({
        type: settings.type || "programmatic",

        changedFields,

        previousState,

        source: settings.source || null,

        effect: settings.effect,
      });
    }

    return true;
  }

  function setState(nextValues = {}, settings = {}) {
    if (destroyed || !isPlainObject(nextValues)) {
      return false;
    }

    const previousState = state;

    Object.entries(nextValues).forEach(([key, value]) => {
      const field = fields.get(key);

      if (!field) {
        return;
      }

      writeField(field, value);
    });

    const nextState = readState();

    const changedFields = getChangedFields(previousState, nextState);

    if (!changedFields.length) {
      return false;
    }

    state = nextState;

    if (settings.notify !== false) {
      notify({
        type: settings.type || "programmatic-state",

        changedFields,

        previousState,

        source: settings.source || null,

        effect: settings.effect,
      });
    }

    return true;
  }

  /* ========================================================================
     Reset
     ======================================================================== */

  function reset(settings = {}) {
    if (destroyed) {
      return false;
    }

    clearDebounce();

    const previousState = state;

    fields.forEach((field) => {
      writeField(field, cloneValue(field.resetValue));
    });

    state = readState();

    const changedFields = getChangedFields(previousState, state);

    /*
     * Reset emits exactly once, including when controls already contain their
     * default values. This lets Reset intentionally refresh the current data.
     */

    if (settings.notify !== false) {
      notify({
        type: "reset",

        changedFields,

        previousState,

        source: settings.source || null,

        effect: settings.effect || FINANCIAL_CALENDAR_FILTER_EFFECTS.RELOAD,
      });
    }

    return changedFields.length > 0;
  }

  function handleReset(event) {
    event.preventDefault();

    reset({
      source: event,
    });
  }

  /* ========================================================================
     Subscription
     ======================================================================== */

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError(
        "Financial Calendar filter listener must be a function.",
      );
    }

    if (destroyed) {
      return () => {};
    }

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  /* ========================================================================
     Initialization
     ======================================================================== */

  function init() {
    if (destroyed) {
      return null;
    }

    if (initialized) {
      return instance;
    }

    initialized = true;

    form.addEventListener("input", handleInput, {
      signal: abortController.signal,
    });

    form.addEventListener("change", handleChange, {
      signal: abortController.signal,
    });

    form.addEventListener("reset", handleReset, {
      signal: abortController.signal,
    });

    sync({
      notify: false,
    });

    return instance;
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    clearDebounce();

    abortController.abort();

    listeners.clear();

    initialized = false;
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    init,

    destroy,

    reset,

    sync,

    subscribe,

    getState,

    getValue,

    getValidation,

    setValue,

    setState,

    setSectorValue(value, settings = {}) {
      return setValue(FINANCIAL_CALENDAR_FILTER_FIELDS.SECTOR, value, settings);
    },

    isInitialized() {
      return initialized;
    },

    isDestroyed() {
      return destroyed;
    },
  });

  if (options.autoInit !== false) {
    init();
  }

  return instance;
}
