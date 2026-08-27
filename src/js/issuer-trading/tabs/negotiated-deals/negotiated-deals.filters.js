/* ==========================================================================
   Negotiated Deals Filters
   ========================================================================== */

/*
 * Filter configuration and UI coordination for the Negotiated Deals tab.
 *
 * Responsibilities:
 *
 * - define filter selectors and normalization
 * - identify the active Negotiated Deals view
 * - coordinate the dependent sector/company filters
 * - disable request filters for Minimum Size
 * - handle form submission and reset
 *
 * This module intentionally has no:
 *
 * - endpoint URLs
 * - AJAX transport implementation
 * - table rendering
 * - card rendering
 * - response normalization
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

  requestFilters: "[data-negotiated-deals-request-filter]",

  reset: "[data-negotiated-deals-reset]",
});

const ALL_VALUE = "All";

/* ==========================================================================
   Helpers
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

function dispatchControlChange(element) {
  if (!(element instanceof Element)) {
    return;
  }

  element.dispatchEvent(
    new Event("change", {
      bubbles: true,
    }),
  );
}

function isAbortError(error) {
  return error?.name === "AbortError";
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
  return {
    type: {
      selector: NEGOTIATED_DEALS_FILTER_SELECTORS.type,

      required: true,

      effect: "view",

      resetValue: NEGOTIATED_DEALS_TYPES.negotiatedDeals,

      normalize: normalizeNegotiatedDealsType,
    },

    /*
     * Sector changes are coordinated by this module because the Company
     * options must be refreshed before the table request is sent.
     *
     * The filter controller therefore receives the descriptive "none"
     * effect. bindNegotiatedDealsFilters() performs one reload after the
     * dependent Company control has been synchronized.
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

      resetValue: "",

      normalize: normalizeDateValue,
    },

    toDate: {
      selector: NEGOTIATED_DEALS_FILTER_SELECTORS.dateTo,

      required: true,

      effect: "reload",

      resetValue: "",

      normalize: normalizeDateValue,
    },
  };
}

/* ==========================================================================
   Minimum Size Mode
   ========================================================================== */

/*
 * The Minimum Size endpoint only requires locale information.
 *
 * Sector, Company, and date controls remain visible so the layout does not
 * jump when the user changes the selected type, but they are disabled and
 * excluded from native form submission.
 */

export function syncNegotiatedDealsFilterMode(root, filterState = {}) {
  const scope = getRootElement(root);

  const minimumSize = isMinimumSizeView(filterState);

  const regions = scope.querySelectorAll(
    NEGOTIATED_DEALS_FILTER_SELECTORS.requestFilters,
  );

  regions.forEach((region) => {
    region.classList.toggle("is-disabled", minimumSize);

    if (minimumSize) {
      region.setAttribute("aria-disabled", "true");
    } else {
      region.removeAttribute("aria-disabled");
    }

    region
      .querySelectorAll("input, select, textarea, button")
      .forEach((control) => {
        control.disabled = minimumSize;
      });
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

export function replaceNegotiatedDealsCompanyOptions(
  companyElement,
  companies = [],
  options = {},
) {
  if (!(companyElement instanceof HTMLSelectElement)) {
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

  const fragment = document.createDocumentFragment();

  fragment.append(new Option(allLabel, ALL_VALUE));

  uniqueCompanies.forEach((company) => {
    fragment.append(new Option(company.label, company.value));
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
 * loadCompanies:
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
 * The callback owns the request. This module owns updating the Company
 * control and coordinating one table reload after the dependency finishes.
 */

export function bindNegotiatedDealsFilters(options = {}) {
  if (!isObject(options)) {
    throw new TypeError(
      "bindNegotiatedDealsFilters requires an options object.",
    );
  }

  const root = getRootElement(options.root);

  const filters = options.filters;

  if (
    !filters ||
    typeof filters.getState !== "function" ||
    typeof filters.reset !== "function" ||
    typeof filters.setValue !== "function" ||
    typeof filters.setDisabled !== "function" ||
    typeof filters.subscribe !== "function" ||
    typeof filters.sync !== "function"
  ) {
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

  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Negotiated Deals filter form was not found.");
  }

  if (!(companyElement instanceof HTMLSelectElement)) {
    throw new Error("Negotiated Deals Company filter was not found.");
  }

  const abortController = new AbortController();

  const initialAllCompanyLabel =
    normalizeString(companyElement.options[0]?.textContent) || ALL_VALUE;

  let destroyed = false;
  let companyLoading = false;
  let companyRequestId = 0;

  /* ========================================================================
     Availability
     ======================================================================== */

  function syncAvailability() {
    const minimumSize = syncNegotiatedDealsFilterMode(root, filters.getState());

    filters.setDisabled("company", minimumSize || companyLoading);

    const companyRegion = companyElement.closest(
      NEGOTIATED_DEALS_FILTER_SELECTORS.requestFilters,
    );

    if (companyRegion) {
      if (companyLoading) {
        companyRegion.setAttribute("aria-busy", "true");
      } else {
        companyRegion.removeAttribute("aria-busy");
      }
    }
  }

  /* ========================================================================
     Enhanced Control Synchronization
     ======================================================================== */

  function announceControlUpdates() {
    [
      typeElement,
      sectorElement,
      companyElement,
      dateFromElement,
      dateToElement,
    ].forEach(dispatchControlChange);
  }

  /* ========================================================================
     Company Dependency
     ======================================================================== */

  async function refreshCompanies(sector, settings = {}) {
    const shouldReload = settings.reload !== false;

    /*
     * A new Sector selection must never send the Company value belonging to
     * the previous Sector.
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
     Filter Changes
     ======================================================================== */

  const unsubscribe = filters.subscribe((event) => {
    if (destroyed) {
      return;
    }

    if (event.key === "type" || event.type === "reset") {
      syncAvailability();
    }

    if (event.key === "sector") {
      refreshCompanies(event.state.sector, {
        reload: true,
        source: event.source,
      });
    }

    /*
     * Reset already causes the controller's "view" effect and one request.
     * The Company options still need to match the reset Sector, but no second
     * table reload is required.
     */

    if (event.type === "reset") {
      refreshCompanies(event.state.sector, {
        reload: false,
        source: event.source,
      });

      announceControlUpdates();
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

      filters.reset({
        type: "reset",
        effect: "view",
        source: event,
      });
    },
    {
      signal: abortController.signal,
    },
  );

  /* ========================================================================
     Initial State
     ======================================================================== */

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

  return Object.freeze({
    destroy,

    refreshCompanies,

    sync() {
      filters.sync();

      syncAvailability();
    },
  });
}
