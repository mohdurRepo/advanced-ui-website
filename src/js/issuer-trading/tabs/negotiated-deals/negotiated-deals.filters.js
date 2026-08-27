/* ==========================================================================
   Negotiated Deals Filters
   ========================================================================== */

/*
 * Filter configuration and UI coordination for the Negotiated Deals tab.
 *
 * Responsibilities:
 *
 * - define and normalize filter fields
 * - resolve the selected Negotiated Deals view
 * - initialize the default one-month date range
 * - restore the default range after reset
 * - coordinate the dependent Sector and Company filters
 * - disable request filters while Minimum Size is selected
 * - synchronize native and enhanced design-system controls
 *
 * This module intentionally has no:
 *
 * - endpoint configuration
 * - request transport
 * - response normalization
 * - table rendering
 * - card rendering
 */

/* ==========================================================================
   Constants
   ========================================================================== */

export const NEGOTIATED_DEALS_TYPES = Object.freeze({
  negotiatedDeals: "Negotiated-Deals",
  minimumSize: "Minimum-Size",
});

export const NEGOTIATED_DEALS_VIEWS = Object.freeze({
  negotiatedDeals: "negotiatedDeals",
  minimumSize: "minimumSize",
});

export const NEGOTIATED_DEALS_FILTER_SELECTORS = Object.freeze({
  form: "[data-negotiated-deals-filters]",

  type: "[data-negotiated-deals-type]",
  sector: "[data-negotiated-deals-sector]",
  company: "[data-negotiated-deals-company]",

  dateFrom: "[data-negotiated-deals-date-from]",
  dateTo: "[data-negotiated-deals-date-to]",
  dateRange: "[data-custom-date-range]",

  requestFilters: "[data-negotiated-deals-request-filter]",

  reset: "[data-negotiated-deals-reset]",
});

const ALL_VALUE = "All";

const DATE_RANGE_SEPARATOR = " \u2013 ";

const INTERACTIVE_SELECTOR = [
  "input",
  "select",
  "textarea",
  "button",
  "[role='button']",
  "[role='combobox']",
].join(", ");

const ENHANCED_CONTROL_SELECTOR = [
  "[data-custom-select]",
  "[data-custom-date-range]",
].join(", ");

/*
 * Preserve each control's original disabled state.
 *
 * This prevents the filter mode from accidentally enabling controls that
 * were already disabled by another component.
 */

const managedInteractiveStates = new WeakMap();

const managedContainerStates = new WeakMap();

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isElement(value) {
  return Boolean(value && value.nodeType === 1);
}

function isFormElement(value) {
  return isElement(value) && value.tagName === "FORM";
}

function isSelectElement(value) {
  return isElement(value) && value.tagName === "SELECT";
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeAllValue(value) {
  return normalizeString(value) || ALL_VALUE;
}

function normalizeDateValue(value) {
  return normalizeString(value);
}

function getRootElement(root) {
  if (
    root &&
    typeof root.querySelector === "function" &&
    typeof root.querySelectorAll === "function"
  ) {
    return root;
  }

  throw new TypeError("Negotiated Deals filters require a valid root element.");
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function dispatchControlChange(element) {
  if (!isElement(element)) {
    return;
  }

  const EventConstructor =
    element.ownerDocument?.defaultView?.Event ?? window.Event;

  element.dispatchEvent(
    new EventConstructor("change", {
      bubbles: true,
    }),
  );
}

/* ==========================================================================
   Default Date Range
   ========================================================================== */

/*
 * These dates are used by input[type="date"], so the required browser format
 * is YYYY-MM-DD.
 *
 * Transaction dates returned by the service are not formatted here.
 */

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

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

  /*
   * Clamp month-end dates correctly.
   *
   * Example:
   *
   * March 31 -> February 28 or 29
   */

  const lastDayOfPreviousMonth = new Date(year, month, 0).getDate();

  return new Date(year, month - 1, Math.min(day, lastDayOfPreviousMonth));
}

export function getDefaultNegotiatedDealsDateRange(now = new Date()) {
  const currentDate =
    now instanceof Date && !Number.isNaN(now.getTime())
      ? new Date(now.getTime())
      : new Date();

  return Object.freeze({
    fromDate: formatInputDate(subtractOneCalendarMonth(currentDate)),

    toDate: formatInputDate(currentDate),
  });
}

/* ==========================================================================
   Type Normalization
   ========================================================================== */

export function normalizeNegotiatedDealsType(value) {
  const normalized = normalizeString(value);

  if (normalized === NEGOTIATED_DEALS_TYPES.minimumSize) {
    return NEGOTIATED_DEALS_TYPES.minimumSize;
  }

  return NEGOTIATED_DEALS_TYPES.negotiatedDeals;
}

/* ==========================================================================
   View Resolution
   ========================================================================== */

export function getNegotiatedDealsView(filterState = {}) {
  const type = isObject(filterState) ? filterState.type : filterState;

  return normalizeNegotiatedDealsType(type) ===
    NEGOTIATED_DEALS_TYPES.minimumSize
    ? NEGOTIATED_DEALS_VIEWS.minimumSize
    : NEGOTIATED_DEALS_VIEWS.negotiatedDeals;
}

export function isMinimumSizeView(filterState = {}) {
  return (
    getNegotiatedDealsView(filterState) === NEGOTIATED_DEALS_VIEWS.minimumSize
  );
}

/* ==========================================================================
   Filter Definitions
   ========================================================================== */

export function createNegotiatedDealsFilterDefinitions() {
  const defaultDateRange = getDefaultNegotiatedDealsDateRange();

  return {
    type: {
      selector: NEGOTIATED_DEALS_FILTER_SELECTORS.type,

      required: true,

      effect: "view",

      resetValue: NEGOTIATED_DEALS_TYPES.negotiatedDeals,

      normalize: normalizeNegotiatedDealsType,
    },

    /*
     * Sector changes are coordinated by this module.
     *
     * The Company options must be refreshed before the table request is sent,
     * so the generic filter controller must not reload immediately.
     */

    sector: {
      selector: NEGOTIATED_DEALS_FILTER_SELECTORS.sector,

      required: true,

      effect: "none",

      resetValue: ALL_VALUE,

      normalize: normalizeAllValue,
    },

    company: {
      selector: NEGOTIATED_DEALS_FILTER_SELECTORS.company,

      required: true,

      effect: "reload",

      resetValue: ALL_VALUE,

      normalize: normalizeAllValue,
    },

    fromDate: {
      selector: NEGOTIATED_DEALS_FILTER_SELECTORS.dateFrom,

      required: true,

      effect: "reload",

      resetValue: defaultDateRange.fromDate,

      normalize: normalizeDateValue,
    },

    toDate: {
      selector: NEGOTIATED_DEALS_FILTER_SELECTORS.dateTo,

      required: true,

      effect: "reload",

      resetValue: defaultDateRange.toDate,

      normalize: normalizeDateValue,
    },
  };
}

/* ==========================================================================
   Managed Disabled State
   ========================================================================== */

function setInteractiveDisabled(element, disabled) {
  if (!isElement(element)) {
    return;
  }

  if (disabled) {
    if (!managedInteractiveStates.has(element)) {
      managedInteractiveStates.set(element, {
        supportsDisabled: "disabled" in element,

        disabled: "disabled" in element ? Boolean(element.disabled) : false,

        ariaDisabled: element.getAttribute("aria-disabled"),
      });
    }

    if ("disabled" in element) {
      element.disabled = true;
    }

    element.setAttribute("aria-disabled", "true");

    return;
  }

  const previousState = managedInteractiveStates.get(element);

  if (!previousState) {
    return;
  }

  if (previousState.supportsDisabled && "disabled" in element) {
    element.disabled = previousState.disabled;
  }

  if (previousState.ariaDisabled === null) {
    element.removeAttribute("aria-disabled");
  } else {
    element.setAttribute("aria-disabled", previousState.ariaDisabled);
  }

  managedInteractiveStates.delete(element);
}

function setContainerDisabled(element, disabled) {
  if (!isElement(element)) {
    return;
  }

  if (disabled) {
    if (!managedContainerStates.has(element)) {
      managedContainerStates.set(element, {
        hadDisabledClass: element.classList.contains("is-disabled"),

        ariaDisabled: element.getAttribute("aria-disabled"),
      });
    }

    element.classList.add("is-disabled");

    element.setAttribute("aria-disabled", "true");

    return;
  }

  const previousState = managedContainerStates.get(element);

  if (!previousState) {
    return;
  }

  element.classList.toggle("is-disabled", previousState.hadDisabledClass);

  if (previousState.ariaDisabled === null) {
    element.removeAttribute("aria-disabled");
  } else {
    element.setAttribute("aria-disabled", previousState.ariaDisabled);
  }

  managedContainerStates.delete(element);
}

function setFilterRegionDisabled(region, disabled) {
  if (!isElement(region)) {
    return;
  }

  setContainerDisabled(region, disabled);

  region.querySelectorAll(ENHANCED_CONTROL_SELECTOR).forEach((controlRoot) => {
    setContainerDisabled(controlRoot, disabled);
  });

  region.querySelectorAll(INTERACTIVE_SELECTOR).forEach((control) => {
    setInteractiveDisabled(control, disabled);
  });
}

/* ==========================================================================
   Minimum Size Mode
   ========================================================================== */

/*
 * Minimum Size requires only the request locale.
 *
 * Sector, Company, and Time Period remain visible to avoid layout movement,
 * but they are disabled and excluded from native form submission.
 */

export function syncNegotiatedDealsFilterMode(root, filterState = {}) {
  const scope = getRootElement(root);

  const minimumSize = isMinimumSizeView(filterState);

  scope
    .querySelectorAll(NEGOTIATED_DEALS_FILTER_SELECTORS.requestFilters)
    .forEach((region) => {
      setFilterRegionDisabled(region, minimumSize);
    });

  return minimumSize;
}

/* ==========================================================================
   Company Options
   ========================================================================== */

function normalizeCompanyOption(company) {
  if (!isObject(company)) {
    return null;
  }

  const value = normalizeString(
    company.value ?? company.symbol ?? company.companyCode ?? company.code,
  );

  const label = normalizeString(
    company.label ?? company.longName ?? company.companyName ?? company.name,
  );

  if (!value || !label) {
    return null;
  }

  return {
    value,
    label,
  };
}

function createSelectOption(selectElement, label, value) {
  const option = selectElement.ownerDocument.createElement("option");

  option.value = value;

  option.textContent = label;

  return option;
}

export function replaceNegotiatedDealsCompanyOptions(
  companyElement,
  companies = [],
  options = {},
) {
  if (!isSelectElement(companyElement)) {
    throw new TypeError("Company options require a valid select element.");
  }

  const allLabel =
    normalizeString(options.allLabel) ||
    normalizeString(companyElement.options[0]?.textContent) ||
    ALL_VALUE;

  const selectedValue = normalizeAllValue(options.selectedValue);

  const normalizedCompanies = Array.isArray(companies)
    ? companies.map(normalizeCompanyOption).filter(Boolean)
    : [];

  const uniqueCompanies = new Map();

  normalizedCompanies.forEach((company) => {
    if (!uniqueCompanies.has(company.value)) {
      uniqueCompanies.set(company.value, company);
    }
  });

  const fragment = companyElement.ownerDocument.createDocumentFragment();

  fragment.append(createSelectOption(companyElement, allLabel, ALL_VALUE));

  uniqueCompanies.forEach((company) => {
    fragment.append(
      createSelectOption(companyElement, company.label, company.value),
    );
  });

  companyElement.replaceChildren(fragment);

  const hasSelectedValue = Array.from(companyElement.options).some(
    (option) => option.value === selectedValue,
  );

  companyElement.value = hasSelectedValue ? selectedValue : ALL_VALUE;

  return companyElement.value;
}

/* ==========================================================================
   Filter Binding
   ========================================================================== */

/*
 * loadCompanies example:
 *
 * async function loadCompanies(sector, context) {
 *   return [
 *     {
 *       value: "1010",
 *       label: "Example Company"
 *     }
 *   ];
 * }
 *
 * The supplied callback owns the request.
 *
 * This module owns:
 *
 * - updating the Company control
 * - synchronizing its enhanced presentation
 * - triggering one table reload after the dependency is ready
 */

export function bindNegotiatedDealsFilters(options = {}) {
  if (!isObject(options)) {
    throw new TypeError(
      "bindNegotiatedDealsFilters requires an options object.",
    );
  }

  const root = getRootElement(options.root);

  const filters = options.filters;

  const requiredFilterMethods = [
    "getState",
    "setDisabled",
    "setState",
    "setValue",
    "subscribe",
    "sync",
  ];

  const hasValidFilterController = requiredFilterMethods.every(
    (method) => typeof filters?.[method] === "function",
  );

  if (!hasValidFilterController) {
    throw new TypeError(
      "Negotiated Deals requires a valid data-filter controller.",
    );
  }

  const form = root.querySelector(NEGOTIATED_DEALS_FILTER_SELECTORS.form);

  const typeElement = root.querySelector(
    NEGOTIATED_DEALS_FILTER_SELECTORS.type,
  );

  const sectorElement = root.querySelector(
    NEGOTIATED_DEALS_FILTER_SELECTORS.sector,
  );

  const companyElement = root.querySelector(
    NEGOTIATED_DEALS_FILTER_SELECTORS.company,
  );

  const dateFromElement = root.querySelector(
    NEGOTIATED_DEALS_FILTER_SELECTORS.dateFrom,
  );

  const dateToElement = root.querySelector(
    NEGOTIATED_DEALS_FILTER_SELECTORS.dateTo,
  );

  if (!isFormElement(form)) {
    throw new Error("Negotiated Deals filter form was not found.");
  }

  if (!isSelectElement(typeElement)) {
    throw new Error("Negotiated Deals Type filter was not found.");
  }

  if (!isSelectElement(sectorElement)) {
    throw new Error("Negotiated Deals Sector filter was not found.");
  }

  if (!isSelectElement(companyElement)) {
    throw new Error("Negotiated Deals Company filter was not found.");
  }

  if (!isElement(dateFromElement) || !isElement(dateToElement)) {
    throw new Error("Negotiated Deals date filters were not found.");
  }

  const abortController = new AbortController();

  const initialAllCompanyLabel =
    normalizeString(companyElement.options[0]?.textContent) || ALL_VALUE;

  const companyRegion = companyElement.closest(
    NEGOTIATED_DEALS_FILTER_SELECTORS.requestFilters,
  );

  let destroyed = false;

  let companyLoading = false;

  let companyRequestId = 0;

  /* ========================================================================
     Enhanced Control Synchronization
     ======================================================================== */

  function synchronizeControls(elements) {
    filters.sync();

    elements.filter(isElement).forEach(dispatchControlChange);
  }

  function synchronizeRequestControls() {
    synchronizeControls([
      sectorElement,
      companyElement,
      dateFromElement,
      dateToElement,
    ]);
  }

  function synchronizeAllControls() {
    synchronizeControls([
      typeElement,
      sectorElement,
      companyElement,
      dateFromElement,
      dateToElement,
    ]);
  }

  /* ========================================================================
     Date Range Presentation
     ======================================================================== */

  function updateInitialDatePresentation() {
    const dateRangeElement = dateFromElement.closest(
      NEGOTIATED_DEALS_FILTER_SELECTORS.dateRange,
    );

    const initialValueElement = dateRangeElement?.querySelector(
      ".custom-date__initial-value",
    );

    if (!initialValueElement) {
      return;
    }

    const fromDate = normalizeDateValue(dateFromElement.value);

    const toDate = normalizeDateValue(dateToElement.value);

    if (!fromDate || !toDate) {
      initialValueElement.textContent =
        dateRangeElement.dataset.placeholder || "YYYY-MM-DD \u2013 YYYY-MM-DD";

      initialValueElement.classList.add("is-placeholder");

      return;
    }

    initialValueElement.textContent = fromDate + DATE_RANGE_SEPARATOR + toDate;

    initialValueElement.classList.remove("is-placeholder");
  }

  function storeNativeDateDefaults() {
    dateFromElement.defaultValue = dateFromElement.value;

    dateToElement.defaultValue = dateToElement.value;
  }

  function initializeDefaultDateRange() {
    const state = filters.getState();

    const defaultRange = getDefaultNegotiatedDealsDateRange();

    const initialDates = {};

    if (!normalizeDateValue(state.fromDate)) {
      initialDates.fromDate = defaultRange.fromDate;
    }

    if (!normalizeDateValue(state.toDate)) {
      initialDates.toDate = defaultRange.toDate;
    }

    if (Object.keys(initialDates).length) {
      filters.setState(initialDates, {
        notify: false,
        source: "initial-date-range",
      });
    }

    filters.sync();

    storeNativeDateDefaults();

    updateInitialDatePresentation();

    synchronizeControls([dateFromElement, dateToElement]);
  }

  /* ========================================================================
     Availability
     ======================================================================== */

  function syncAvailability() {
    const minimumSize = syncNegotiatedDealsFilterMode(root, filters.getState());

    /*
     * Company may also be disabled independently while its options load.
     */

    setFilterRegionDisabled(companyRegion, minimumSize || companyLoading);

    filters.setDisabled("company", minimumSize || companyLoading);

    if (companyRegion) {
      if (companyLoading) {
        companyRegion.setAttribute("aria-busy", "true");
      } else {
        companyRegion.removeAttribute("aria-busy");
      }
    }

    return minimumSize;
  }

  /* ========================================================================
     Company Dependency
     ======================================================================== */

  async function refreshCompanies(sector, settings = {}) {
    const shouldReload = settings.reload !== false;

    /*
     * Never send a Company value belonging to the previous Sector.
     */

    filters.setValue("company", ALL_VALUE, {
      notify: false,
      source: settings.source || null,
    });

    filters.sync();

    dispatchControlChange(companyElement);

    if (typeof options.loadCompanies !== "function") {
      if (shouldReload) {
        options.onReload?.();
      }

      return;
    }

    const currentRequestId = ++companyRequestId;

    companyLoading = true;

    syncAvailability();

    try {
      const companies = await options.loadCompanies(sector, {
        filters: filters.getState(),

        source: settings.source || null,
      });

      if (destroyed || currentRequestId !== companyRequestId) {
        return;
      }

      replaceNegotiatedDealsCompanyOptions(companyElement, companies, {
        allLabel: initialAllCompanyLabel,
        selectedValue: ALL_VALUE,
      });

      filters.sync();

      dispatchControlChange(companyElement);
    } catch (error) {
      if (
        !destroyed &&
        currentRequestId === companyRequestId &&
        !isAbortError(error)
      ) {
        options.onError?.(error);
      }
    } finally {
      if (destroyed || currentRequestId !== companyRequestId) {
        return;
      }

      companyLoading = false;

      syncAvailability();

      if (shouldReload) {
        options.onReload?.();
      }
    }
  }

  /* ========================================================================
     Reset
     ======================================================================== */

  function resetFilters(source = null) {
    const defaultDateRange = getDefaultNegotiatedDealsDateRange();

    const changed = filters.setState(
      {
        type: NEGOTIATED_DEALS_TYPES.negotiatedDeals,

        sector: ALL_VALUE,

        company: ALL_VALUE,

        fromDate: defaultDateRange.fromDate,

        toDate: defaultDateRange.toDate,
      },
      {
        type: "reset",

        effect: "view",

        source,
      },
    );

    /*
     * setState() notifies synchronously when values changed.
     *
     * The reset subscription below performs the UI synchronization and
     * Company refresh in that case.
     */

    if (changed) {
      return true;
    }

    /*
     * Even if the filters already contain their defaults, Reset should still
     * refresh the current result set exactly once.
     */

    filters.sync();

    storeNativeDateDefaults();

    updateInitialDatePresentation();

    syncAvailability();

    synchronizeAllControls();

    refreshCompanies(ALL_VALUE, {
      reload: false,
      source,
    });

    options.onReload?.();

    return false;
  }

  /* ========================================================================
     Filter Changes
     ======================================================================== */

  const unsubscribe = filters.subscribe((event) => {
    if (destroyed) {
      return;
    }

    if (event.key === "type") {
      filters.sync();

      syncAvailability();

      synchronizeRequestControls();

      return;
    }

    if (event.key === "sector") {
      refreshCompanies(event.state.sector, {
        reload: true,

        source: event.source,
      });

      return;
    }

    if (event.type === "reset") {
      /*
       * setState() does not update the filter controller's cached field
       * values, so synchronize before dispatching native change events.
       */

      filters.sync();

      storeNativeDateDefaults();

      updateInitialDatePresentation();

      syncAvailability();

      refreshCompanies(event.state.sector, {
        reload: false,

        source: event.source,
      });

      synchronizeAllControls();
    }
  });

  /* ========================================================================
     Form Events
     ======================================================================== */

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      filters.sync();

      options.onReload?.();
    },
    {
      signal: abortController.signal,
    },
  );

  form.addEventListener(
    "reset",
    (event) => {
      event.preventDefault();

      resetFilters(event);
    },
    {
      signal: abortController.signal,
    },
  );

  /* ========================================================================
     Initial State
     ======================================================================== */

  initializeDefaultDateRange();

  syncAvailability();

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    companyRequestId += 1;

    abortController.abort();

    unsubscribe();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    destroy,

    refreshCompanies,

    reset: resetFilters,

    sync() {
      filters.sync();

      updateInitialDatePresentation();

      syncAvailability();

      synchronizeAllControls();
    },
  });
}
