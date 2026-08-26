/* ==========================================================================
   Trading Dependencies
   ========================================================================== */

/*
 * Trading dependent-filter behavior.
 *
 * Responsibilities:
 *
 * - manage Industry Group -> Company
 * - preserve the original All-Market Company options
 * - load sector-specific Company options
 * - reset Company to "All Companies"
 * - restore the full original Company list when Sector returns to All
 * - keep createDataFilters synchronized
 * - keep the design-system custom-select synchronized
 * - cancel stale dependency requests
 *
 * This file intentionally has no:
 *
 * - Trading table loading
 * - Trading dataset reloads
 * - cards
 * - DataTables
 * - tabs
 * - result rendering
 */

/* ==========================================================================
   Common Data View
   ========================================================================== */

import { createDataSource } from "../common/data-view/index.js";

/* ==========================================================================
   Trading
   ========================================================================== */

import { SELECTORS, TRADING_VALUES } from "./constants.js";

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeString(value, fallback = "") {
  return hasValue(value) ? String(value).trim() : fallback;
}

function query(root, selector) {
  return root?.querySelector?.(selector) || null;
}

/* ==========================================================================
   Option Snapshot
   ========================================================================== */

/**
 * Capture an immutable representation of a native <select>'s options.
 *
 * The JSP-provided Company options represent the complete "All Market"
 * Company list and must remain recoverable after sector-specific filtering.
 *
 * @param {HTMLSelectElement} select
 * @returns {ReadonlyArray<object>}
 */
function captureOptions(select) {
  if (!(select instanceof HTMLSelectElement)) {
    return Object.freeze([]);
  }

  return Object.freeze(
    Array.from(select.options).map((option) =>
      Object.freeze({
        value: option.value,

        label: option.textContent || "",

        disabled: option.disabled,

        hidden: option.hidden,
      }),
    ),
  );
}

/* ==========================================================================
   Option Creation
   ========================================================================== */

function createOption({
  value,
  label,
  selected = false,
  disabled = false,
  hidden = false,
}) {
  const option = document.createElement("option");

  option.value = String(value ?? "");

  option.textContent = String(label ?? "");

  option.selected = Boolean(selected);

  option.disabled = Boolean(disabled);

  option.hidden = Boolean(hidden);

  return option;
}

/* ==========================================================================
   Native Select Update
   ========================================================================== */

/**
 * Notify the existing design-system custom-select after native options/value
 * change.
 *
 * The current design-system contract uses:
 *
 * custom-select:options-updated
 *
 * The native change event is optional because Trading normally synchronizes
 * common filter state explicitly and does not need to create a second filter
 * reload cycle.
 *
 * @param {HTMLSelectElement} select
 * @param {object} options
 */
function dispatchSelectUpdate(
  select,
  { change = false, optionsUpdated = true } = {},
) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  if (optionsUpdated) {
    select.dispatchEvent(
      new CustomEvent("custom-select:options-updated", {
        bubbles: true,
      }),
    );
  }

  if (change) {
    select.dispatchEvent(
      new Event("change", {
        bubbles: true,
      }),
    );
  }
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

function getCompanyRows(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.rows)) {
    return response.rows;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
}

function normalizeResponse(response) {
  return {
    rows: getCompanyRows(response),

    meta: {},

    raw: response,
  };
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createTradingDependencies({
  root = document,
  config = {},
  filters,
} = {}) {
  if (!filters?.negotiated) {
    throw new TypeError("Trading dependencies require negotiated filters.");
  }

  /* =========================================================================
     Configuration
     ========================================================================= */

  const dependency = config.dependencies?.sectorCompany || {};

  const endpoint =
    dependency.endpoint || config.endpoints?.companiesBySector || "";

  if (!endpoint) {
    throw new Error("Trading Company dependency endpoint is required.");
  }

  const defaultValue = normalizeString(
    config.filters?.negotiatedDeals?.companyClearValue,
    normalizeString(dependency.defaultValue, TRADING_VALUES.all),
  );

  const sectorParameter = normalizeString(
    dependency.request?.sectorParameter,
    "sector",
  );

  const valueField = normalizeString(dependency.response?.value, "symbol");

  const labelField = normalizeString(dependency.response?.label, "longName");

  /* =========================================================================
     Elements
     ========================================================================= */

  const companySelect = query(root, SELECTORS.negotiated.company);

  if (!(companySelect instanceof HTMLSelectElement)) {
    throw new Error("Trading Company select was not found.");
  }

  /* =========================================================================
     Original All-Market Options
     ========================================================================= */

  /*
   * Capture these exactly once, before any Sector dependency replaces them.
   *
   * This is the critical difference from the previous implementation.
   */
  const originalOptions = captureOptions(companySelect);

  const originalDefaultOption = originalOptions.find(
    (option) => String(option.value) === String(defaultValue),
  );

  const defaultLabel = normalizeString(
    originalDefaultOption?.label,
    config.labels?.controls?.all || "All Companies",
  );

  /* =========================================================================
     State
     ========================================================================= */

  let destroyed = false;

  /* =========================================================================
     Data Source
     ========================================================================= */

  const source = createDataSource({
    endpoint,

    /*
     * Keep this endpoint contract deliberately small.
     *
     * Existing backend:
     *
     * sector=<selected-sector>
     */
    buildRequestData(state = {}) {
      return {
        [sectorParameter]: normalizeString(state.sector, TRADING_VALUES.all),
      };
    },

    normalizeResponse,
  });

  /* =========================================================================
     Filter Synchronization
     ========================================================================= */

  function synchronizeCompanyFilter() {
    if (destroyed) {
      return;
    }

    /*
     * createDataFilters reads the native select as the source of truth.
     *
     * Silent setValue ensures any cached internal state is consistent without
     * triggering a Trading data reload.
     */
    filters.negotiated.setValue(
      "company",
      companySelect.value || defaultValue,
      {
        notify: false,

        source: "sector-company-dependency",
      },
    );

    filters.negotiated.sync();
  }

  /* =========================================================================
     Loading State
     ========================================================================= */

  function setCompanyLoading(loading) {
    if (destroyed) {
      return;
    }

    filters.negotiated.setDisabled("company", Boolean(loading));

    if (loading) {
      companySelect.setAttribute("aria-busy", "true");

      return;
    }

    companySelect.removeAttribute("aria-busy");
  }

  /* =========================================================================
     Restore Original Options
     ========================================================================= */

  /**
   * Restore the complete JSP-rendered Company list.
   *
   * Used when:
   *
   * - Sector = All
   * - Negotiated Reset
   * - dependency request fails
   *
   * The selected Company becomes All Companies.
   */
  function restoreAllCompanies() {
    if (destroyed) {
      return;
    }

    const fragment = document.createDocumentFragment();

    originalOptions.forEach((item) => {
      fragment.append(
        createOption({
          ...item,

          selected: String(item.value) === String(defaultValue),
        }),
      );
    });

    /*
     * Defensive fallback for a malformed JSP/config where no All option was
     * originally rendered.
     */
    if (
      !originalOptions.some(
        (item) => String(item.value) === String(defaultValue),
      )
    ) {
      fragment.prepend(
        createOption({
          value: defaultValue,

          label: defaultLabel,

          selected: true,
        }),
      );
    }

    companySelect.replaceChildren(fragment);

    companySelect.value = defaultValue;

    synchronizeCompanyFilter();

    dispatchSelectUpdate(companySelect, {
      change: false,

      optionsUpdated: true,
    });
  }

  /* =========================================================================
     Sector-specific Options
     ========================================================================= */

  function renderSectorCompanies(companies = []) {
    if (destroyed) {
      return;
    }

    const fragment = document.createDocumentFragment();

    /*
     * All Companies is always first and always selected after a Sector change.
     */
    fragment.append(
      createOption({
        value: defaultValue,

        label: defaultLabel,

        selected: true,
      }),
    );

    const seenValues = new Set([String(defaultValue)]);

    companies.forEach((company) => {
      if (!isObject(company)) {
        return;
      }

      const rawValue = company[valueField];

      if (!hasValue(rawValue)) {
        return;
      }

      const value = String(rawValue).trim();

      /*
       * Prevent duplicate options if the backend itself returns All or
       * repeated companies.
       */
      if (seenValues.has(value)) {
        return;
      }

      seenValues.add(value);

      const rawLabel = company[labelField];

      const label = normalizeString(rawLabel, value);

      fragment.append(
        createOption({
          value,
          label,
        }),
      );
    });

    companySelect.replaceChildren(fragment);

    companySelect.value = defaultValue;

    synchronizeCompanyFilter();

    dispatchSelectUpdate(companySelect, {
      change: false,

      optionsUpdated: true,
    });
  }

  /* =========================================================================
     Company Clear
     ========================================================================= */

  /**
   * Ensure Company never remains empty.
   *
   * Useful if the enhanced custom-select exposes a clear action now or later.
   *
   * @returns {boolean}
   */
  function normalizeCompanyValue() {
    if (destroyed || hasValue(companySelect.value)) {
      return false;
    }

    companySelect.value = defaultValue;

    synchronizeCompanyFilter();

    dispatchSelectUpdate(companySelect, {
      change: false,

      optionsUpdated: false,
    });

    return true;
  }

  /* =========================================================================
     Load Companies
     ========================================================================= */

  async function loadCompanies(sectorValue) {
    if (destroyed) {
      return {
        sector: defaultValue,

        companies: [],
      };
    }

    const sector = normalizeString(sectorValue, TRADING_VALUES.all);

    /*
     * Sector = All
     *
     * No remote dependency request is required because the original complete
     * Company list was already rendered by the JSP.
     */
    if (sector === TRADING_VALUES.all) {
      source.cancel();

      setCompanyLoading(false);

      restoreAllCompanies();

      return Object.freeze({
        sector,

        companies: [],
      });
    }

    setCompanyLoading(true);

    try {
      const response = await source.load({
        sector,
      });

      if (destroyed) {
        return Object.freeze({
          sector,

          companies: [],
        });
      }

      const companies = Array.isArray(response.rows) ? response.rows : [];

      renderSectorCompanies(companies);

      return Object.freeze({
        sector,

        companies: [...companies],
      });
    } catch (error) {
      /*
       * Stale Sector requests are expected and must not overwrite a newer
       * Sector selection.
       */
      if (error?.name === "AbortError") {
        throw error;
      }

      /*
       * On real dependency failure, never leave stale companies from the
       * previous Sector visible.
       *
       * Restore the safe full-market state.
       */
      restoreAllCompanies();

      throw error;
    } finally {
      if (!destroyed) {
        setCompanyLoading(false);
      }
    }
  }

  /* =========================================================================
     Current Sector
     ========================================================================= */

  function loadCurrentSector() {
    const sector = filters.negotiated.getValue("sector");

    return loadCompanies(sector);
  }

  /* =========================================================================
     Reset
     ========================================================================= */

  /**
   * Restore the complete initial Company option set and select All Companies.
   *
   * Important:
   *
   * This does NOT perform an AJAX request.
   *
   * trading.js performs one final Negotiated dataset reload after all reset
   * state has been synchronized.
   */
  function resetCompany() {
    source.cancel();

    setCompanyLoading(false);

    restoreAllCompanies();
  }

  /* =========================================================================
     Public Queries
     ========================================================================= */

  function getCompanyValue() {
    return companySelect.value || defaultValue;
  }

  function getOriginalCompanyCount() {
    return originalOptions.length;
  }

  /* =========================================================================
     Lifecycle
     ========================================================================= */

  function cancel() {
    return source.cancel();
  }

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    source.destroy();
  }

  /* =========================================================================
     Public Instance
     ========================================================================= */

  return Object.freeze({
    loadCompanies,
    loadCurrentSector,

    normalizeCompanyValue,

    resetCompany,
    restoreAllCompanies,

    getCompanyValue,
    getOriginalCompanyCount,

    cancel,
    destroy,
  });
}
