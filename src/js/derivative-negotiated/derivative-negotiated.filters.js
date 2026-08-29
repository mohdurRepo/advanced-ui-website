/* ==========================================================================
   Derivative Negotiated Filters
   ========================================================================== */

/*
 * Filter state and form coordination for Derivative Negotiated.
 *
 * Responsibilities:
 *
 * - read and normalize filter values
 * - validate the selected date range
 * - convert native ISO dates to the service format
 * - reset filters to All / All / one month
 * - reset Contract when Category changes
 * - emit one controlled notification for each user action
 * - prevent duplicate notifications from programmatic synchronization
 *
 * This module intentionally has no:
 *
 * - endpoint URLs
 * - request implementation
 * - contract-option request logic
 * - response normalization
 * - table or card rendering
 */

/* ==========================================================================
   Constants
   ========================================================================== */

export const DERIVATIVE_NEGOTIATED_FILTER_SELECTORS = Object.freeze({
  form: "[data-derivative-negotiated-filters]",

  category: "[data-derivative-negotiated-category]",

  contract: "[data-derivative-negotiated-contract]",

  dateFrom: "[data-derivative-negotiated-date-from]",

  dateTo: "[data-derivative-negotiated-date-to]",

  reset: "[data-derivative-negotiated-reset]",
});

export const DERIVATIVE_NEGOTIATED_FILTER_FIELDS = Object.freeze({
  category: "category",

  contract: "contract",

  fromDate: "fromDate",

  toDate: "toDate",
});

const FILTER_FIELD_ORDER = Object.freeze([
  DERIVATIVE_NEGOTIATED_FILTER_FIELDS.category,

  DERIVATIVE_NEGOTIATED_FILTER_FIELDS.contract,

  DERIVATIVE_NEGOTIATED_FILTER_FIELDS.fromDate,

  DERIVATIVE_NEGOTIATED_FILTER_FIELDS.toDate,
]);

const ALL_VALUE = "All";

const DEFAULT_LOCALE = "en";

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeAllValue(value) {
  return normalizeString(value) || ALL_VALUE;
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function getScope(root) {
  if (root && typeof root.querySelector === "function") {
    return root;
  }

  throw new TypeError(
    "Derivative Negotiated filters require a valid root element.",
  );
}

function requireElement(root, selector, description) {
  const element = root.querySelector(selector);

  if (!element) {
    throw new Error(`Derivative Negotiated ${description} was not found.`);
  }

  return element;
}

function dispatchControlChange(element) {
  element.dispatchEvent(
    new Event("change", {
      bubbles: true,
    }),
  );
}

function getChangedFields(previousState, nextState) {
  return FILTER_FIELD_ORDER.filter(
    (field) => previousState?.[field] !== nextState?.[field],
  );
}

/* ==========================================================================
   Default Date Range
   ========================================================================== */

function formatInputDate(date) {
  return [
    date.getFullYear(),

    padDatePart(date.getMonth() + 1),

    padDatePart(date.getDate()),
  ].join("-");
}

function subtractOneCalendarMonth(date) {
  const year = date.getFullYear();

  const month = date.getMonth();

  const day = date.getDate();

  const lastDayOfPreviousMonth = new Date(year, month, 0).getDate();

  return new Date(year, month - 1, Math.min(day, lastDayOfPreviousMonth));
}

function createDefaultDateRange() {
  const today = new Date();

  return Object.freeze({
    fromDate: formatInputDate(subtractOneCalendarMonth(today)),

    toDate: formatInputDate(today),
  });
}

/* ==========================================================================
   Date Validation
   ========================================================================== */

function isValidInputDate(value) {
  const normalized = normalizeString(value);

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);

  const month = Number(match[2]);

  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function validateDerivativeNegotiatedFilters(state = {}) {
  const fromDate = normalizeString(state.fromDate);

  const toDate = normalizeString(state.toDate);

  if (!fromDate || !toDate) {
    return Object.freeze({
      valid: false,

      reason: "missing-date",
    });
  }

  if (!isValidInputDate(fromDate) || !isValidInputDate(toDate)) {
    return Object.freeze({
      valid: false,

      reason: "invalid-date",
    });
  }

  /*
   * YYYY-MM-DD strings sort chronologically, so no Date conversion or
   * timezone adjustment is necessary here.
   */

  if (fromDate > toDate) {
    return Object.freeze({
      valid: false,

      reason: "invalid-range",
    });
  }

  return Object.freeze({
    valid: true,

    reason: "",
  });
}

/* ==========================================================================
   Service Date Formatting
   ========================================================================== */

/*
 * The native date controls use YYYY-MM-DD.
 *
 * The legacy service expects DD-MM-YYYY.
 */

export function formatDerivativeNegotiatedServiceDate(value) {
  const normalized = normalizeString(value);

  if (!isValidInputDate(normalized)) {
    return "";
  }

  const [year, month, day] = normalized.split("-");

  return `${day}-${month}-${year}`;
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createDerivativeNegotiatedFilters(options = {}) {
  if (!isObject(options)) {
    throw new TypeError(
      "createDerivativeNegotiatedFilters requires an options object.",
    );
  }

  const root = getScope(options.root);

  const config = isObject(options.config) ? options.config : {};

  const form = requireElement(
    root,
    DERIVATIVE_NEGOTIATED_FILTER_SELECTORS.form,
    "filter form",
  );

  const categoryElement = requireElement(
    form,
    DERIVATIVE_NEGOTIATED_FILTER_SELECTORS.category,
    "Category filter",
  );

  const contractElement = requireElement(
    form,
    DERIVATIVE_NEGOTIATED_FILTER_SELECTORS.contract,
    "Contract filter",
  );

  const fromDateElement = requireElement(
    form,
    DERIVATIVE_NEGOTIATED_FILTER_SELECTORS.dateFrom,
    "From Date filter",
  );

  const toDateElement = requireElement(
    form,
    DERIVATIVE_NEGOTIATED_FILTER_SELECTORS.dateTo,
    "To Date filter",
  );

  if (!(form instanceof HTMLFormElement)) {
    throw new TypeError(
      "Derivative Negotiated filters require a form element.",
    );
  }

  if (!(categoryElement instanceof HTMLSelectElement)) {
    throw new TypeError(
      "Derivative Negotiated Category filter must be a select element.",
    );
  }

  if (!(contractElement instanceof HTMLSelectElement)) {
    throw new TypeError(
      "Derivative Negotiated Contract filter must be a select element.",
    );
  }

  if (!(fromDateElement instanceof HTMLInputElement)) {
    throw new TypeError(
      "Derivative Negotiated From Date filter must be an input element.",
    );
  }

  if (!(toDateElement instanceof HTMLInputElement)) {
    throw new TypeError(
      "Derivative Negotiated To Date filter must be an input element.",
    );
  }

  const abortController = new AbortController();

  const subscribers = new Set();

  let initialized = false;

  let destroyed = false;

  let synchronizing = false;

  let contractLoading = false;

  /* ========================================================================
     Default Values
     ======================================================================== */

  const generatedDefaultRange = createDefaultDateRange();

  const defaultDateRange = Object.freeze({
    fromDate:
      normalizeString(fromDateElement.defaultValue || fromDateElement.value) ||
      generatedDefaultRange.fromDate,

    toDate:
      normalizeString(toDateElement.defaultValue || toDateElement.value) ||
      generatedDefaultRange.toDate,
  });

  /* ========================================================================
     State
     ======================================================================== */

  function getState() {
    return Object.freeze({
      category: normalizeAllValue(categoryElement.value),

      contract: normalizeAllValue(contractElement.value),

      fromDate: normalizeString(fromDateElement.value),

      toDate: normalizeString(toDateElement.value),
    });
  }

  let previousState = getState();

  /* ========================================================================
     Date State
     ======================================================================== */

  function syncDateConstraints() {
    const fromDate = normalizeString(fromDateElement.value);

    const toDate = normalizeString(toDateElement.value);

    if (isValidInputDate(toDate)) {
      fromDateElement.max = toDate;
    } else {
      fromDateElement.removeAttribute("max");
    }

    if (isValidInputDate(fromDate)) {
      toDateElement.min = fromDate;
    } else {
      toDateElement.removeAttribute("min");
    }
  }

  function syncDateValidity(validation) {
    const invalid = !validation.valid;

    if (invalid) {
      fromDateElement.setAttribute("aria-invalid", "true");

      toDateElement.setAttribute("aria-invalid", "true");
    } else {
      fromDateElement.removeAttribute("aria-invalid");

      toDateElement.removeAttribute("aria-invalid");
    }
  }

  function getValidation() {
    const validation = validateDerivativeNegotiatedFilters(getState());

    syncDateValidity(validation);

    return validation;
  }

  /* ========================================================================
     Request Parameters
     ======================================================================== */

  function getRequestParams() {
    const state = getState();

    const validation = validateDerivativeNegotiatedFilters(state);

    syncDateValidity(validation);

    if (!validation.valid) {
      return null;
    }

    return Object.freeze({
      fromDate: formatDerivativeNegotiatedServiceDate(state.fromDate),

      toDate: formatDerivativeNegotiatedServiceDate(state.toDate),

      contract: state.contract,

      sector: state.category,

      requestLocale: normalizeString(config.locale) || DEFAULT_LOCALE,
    });
  }

  /* ========================================================================
     Notifications
     ======================================================================== */

  function notify({ reason, field = "", force = false }) {
    if (destroyed) {
      return null;
    }

    const state = getState();

    const changedFields = getChangedFields(previousState, state);

    if (!force && !changedFields.length) {
      return null;
    }

    previousState = state;

    const validation = validateDerivativeNegotiatedFilters(state);

    syncDateValidity(validation);

    const detail = Object.freeze({
      reason,

      field,

      changedFields: Object.freeze([...changedFields]),

      state,

      validation,
    });

    subscribers.forEach((subscriber) => {
      subscriber(detail);
    });

    return detail;
  }

  function subscribe(callback) {
    if (typeof callback !== "function") {
      throw new TypeError(
        "Derivative Negotiated filter subscriber must be a function.",
      );
    }

    subscribers.add(callback);

    return function unsubscribe() {
      subscribers.delete(callback);
    };
  }

  /* ========================================================================
     Programmatic Synchronization
     ======================================================================== */

  function setControlValue(element, value, { dispatch = true } = {}) {
    element.value = value;

    if (dispatch) {
      dispatchControlChange(element);
    }
  }

  function setContractValue(value, { notifyChange = false } = {}) {
    const normalizedValue = normalizeAllValue(value);

    const optionExists = Array.from(contractElement.options).some(
      (option) => option.value === normalizedValue,
    );

    const nextValue = optionExists ? normalizedValue : ALL_VALUE;

    synchronizing = true;

    setControlValue(contractElement, nextValue);

    synchronizing = false;

    if (notifyChange) {
      notify({
        reason: "programmatic",

        field: DERIVATIVE_NEGOTIATED_FILTER_FIELDS.contract,
      });
    }

    return contractElement.value;
  }

  function setContractLoading(loading) {
    contractLoading = Boolean(loading);

    contractElement.disabled = contractLoading;

    const customSelect = contractElement.closest("[data-custom-select]");

    if (customSelect) {
      customSelect.classList.toggle("is-disabled", contractLoading);

      if (contractLoading) {
        customSelect.setAttribute("aria-busy", "true");

        customSelect.setAttribute("aria-disabled", "true");
      } else {
        customSelect.removeAttribute("aria-busy");

        customSelect.removeAttribute("aria-disabled");
      }
    }

    return contractLoading;
  }

  function sync() {
    previousState = getState();

    syncDateConstraints();

    getValidation();

    return previousState;
  }

  /* ========================================================================
     Reset
     ======================================================================== */

  function reset({ notifyChange = true } = {}) {
    if (destroyed) {
      return null;
    }

    synchronizing = true;

    setControlValue(categoryElement, ALL_VALUE);

    setControlValue(contractElement, ALL_VALUE);

    setControlValue(fromDateElement, defaultDateRange.fromDate);

    setControlValue(toDateElement, defaultDateRange.toDate);

    synchronizing = false;

    syncDateConstraints();

    const detail = notifyChange
      ? notify({
          reason: "reset",

          force: true,
        })
      : null;

    if (!notifyChange) {
      previousState = getState();

      getValidation();
    }

    return detail;
  }

  /* ========================================================================
     Events
     ======================================================================== */

  function getFieldName(element) {
    if (element === categoryElement) {
      return DERIVATIVE_NEGOTIATED_FILTER_FIELDS.category;
    }

    if (element === contractElement) {
      return DERIVATIVE_NEGOTIATED_FILTER_FIELDS.contract;
    }

    if (element === fromDateElement) {
      return DERIVATIVE_NEGOTIATED_FILTER_FIELDS.fromDate;
    }

    if (element === toDateElement) {
      return DERIVATIVE_NEGOTIATED_FILTER_FIELDS.toDate;
    }

    return "";
  }

  function handleChange(event) {
    if (destroyed || synchronizing) {
      return;
    }

    const field = getFieldName(event.target);

    if (!field) {
      return;
    }

    /*
     * A newly selected Category invalidates the previously selected Contract.
     *
     * Reset the native Contract value immediately. contracts.js will then
     * replace its available options before the results request is sent.
     */

    if (field === DERIVATIVE_NEGOTIATED_FILTER_FIELDS.category) {
      setContractValue(ALL_VALUE);
    }

    syncDateConstraints();

    notify({
      reason: "change",

      field,
    });
  }

  function handleReset(event) {
    event.preventDefault();

    reset();
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function init() {
    if (initialized || destroyed) {
      return instance;
    }

    initialized = true;

    syncDateConstraints();

    getValidation();

    form.addEventListener("change", handleChange, {
      signal: abortController.signal,
    });

    form.addEventListener("reset", handleReset, {
      signal: abortController.signal,
    });

    return instance;
  }

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    abortController.abort();

    subscribers.clear();

    setContractLoading(false);

    initialized = false;
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    init,

    destroy,

    reset,

    subscribe,

    sync,

    getState,

    getValidation,

    getRequestParams,

    setContractValue,

    setContractLoading,

    isContractLoading() {
      return contractLoading;
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
