/* ==========================================================================
   Trading Dependencies
   ========================================================================== */

/*
 * Trading dependent-filter behavior.
 *
 * Responsibilities:
 *
 * - manage Sector / Industry Group -> Company
 * - preserve the original JSP-rendered All-Market Company options
 * - load sector-specific Company options
 * - restore Company to All Companies after a Sector change
 * - normalize a cleared Company value back to All Companies
 * - restore the complete Company list when Sector returns to All
 * - keep createDataFilters synchronized
 * - keep the design-system custom-select synchronized
 * - expose dependency loading state
 * - cancel stale dependency requests
 * - support clean destruction
 *
 * This module intentionally has no:
 *
 * - Trading dataset reloads
 * - tab behavior
 * - table rendering
 * - card rendering
 * - DataTables logic
 * - page result rendering
 *
 * trading.js decides when the final Trading dataset should reload.
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

/*
 * The server-rendered Company <select> represents the complete All-Market
 * company universe.
 *
 * Once Sector filtering starts, the native options are replaced. Therefore
 * the original list must be captured exactly once before any dependency
 * mutation.
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
} = {}) {
  const option = document.createElement("option");

  option.value = String(value ?? "");

  option.textContent = String(label ?? "");

  option.selected = Boolean(selected);

  option.disabled = Boolean(disabled);

  option.hidden = Boolean(hidden);

  return option;
}

/* ==========================================================================
   Select Notification
   ========================================================================== */

/*
 * Native options/value may be changed programmatically.
 *
 * The design-system custom-select must then rebuild/synchronize its enhanced
 * presentation.
 *
 * Current design-system contract:
 *
 * custom-select:options-updated
 *
 * Native "change" is intentionally optional because dependency changes are
 * normally synchronized silently through createDataFilters and trading.js
 * performs one final dataset reload.
 */

function notifySelect(select, { optionsUpdated = true, change = false } = {}) {
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
   Response Parsing
   ========================================================================== */

function parseResponse(response) {
  if (typeof response !== "string") {
    return response;
  }

  try {
    return JSON.parse(response);
  } catch {
    return response;
  }
}

/* ==========================================================================
   Response Rows
   ========================================================================== */

function getCompanyRows(response) {
  const value = parseResponse(response);

  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.rows)) {
    return value.rows;
  }

  if (Array.isArray(value?.results)) {
    return value.results;
  }

  /*
   * Preserve compatibility with older endpoint/DataTables wrappers.
   */

  if (Array.isArray(value?.aaData)) {
    return value.aaData;
  }

  return [];
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

function normalizeResponse(response) {
  const raw = parseResponse(response);

  return {
    rows: getCompanyRows(raw),

    meta: {},

    raw,
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

  const endpoint = normalizeString(
    dependency.endpoint,
    normalizeString(config.endpoints?.companiesBySector),
  );

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
     Original All-Market Company Options
     ========================================================================= */

  /*
   * Capture once before any Sector operation.
   *
   * This guarantees:
   *
   * Sector = All
   * Reset
   * dependency error recovery
   *
   * can restore the complete JSP-generated company list without another API
   * request.
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
     Runtime State
     ========================================================================= */

  let destroyed = false;

  let loading = false;

  let activeSector = normalizeString(
    filters.negotiated.getValue("sector"),
    TRADING_VALUES.all,
  );

  /* =========================================================================
     Data Source
     ========================================================================= */

  const source = createDataSource({
    endpoint,

    /*
     * Exact dependency request contract.
     *
     * Existing endpoint:
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

  /*
   * Native <select> remains the DOM source of truth.
   *
   * Any programmatic dependency operation must silently synchronize
   * createDataFilters before the Trading dataset request is built.
   */

  function synchronizeCompanyFilter(sourceName = "sector-company-dependency") {
    if (destroyed) {
      return;
    }

    const value = normalizeString(companySelect.value, defaultValue);

    /*
     * Ensure native DOM never remains empty.
     */

    if (companySelect.value !== value) {
      companySelect.value = value;
    }

    filters.negotiated.setValue("company", value, {
      notify: false,

      source: sourceName,
    });

    filters.negotiated.sync();
  }

  /* =========================================================================
     Loading State
     ========================================================================= */

  function setCompanyLoading(nextLoading) {
    if (destroyed) {
      return;
    }

    loading = Boolean(nextLoading);

    /*
     * Disable through createDataFilters so native and component state remain
     * coordinated.
     */

    filters.negotiated.setDisabled("company", loading);

    if (loading) {
      companySelect.setAttribute("aria-busy", "true");

      return;
    }

    companySelect.removeAttribute("aria-busy");
  }

  /* =========================================================================
     Option Fragment
     ========================================================================= */

  function createOptionsFragment(items, { selectedValue = defaultValue } = {}) {
    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      fragment.append(
        createOption({
          ...item,

          selected: String(item.value) === String(selectedValue),
        }),
      );
    });

    return fragment;
  }

  /* =========================================================================
     Replace Company Options
     ========================================================================= */

  /*
   * All Company-option mutations pass through one method.
   *
   * This prevents subtle divergence between:
   *
   * - native select
   * - createDataFilters
   * - enhanced custom-select
   */

  function replaceCompanyOptions(
    items,
    {
      selectedValue = defaultValue,

      sourceName = "sector-company-dependency",

      optionsUpdated = true,
    } = {},
  ) {
    if (destroyed) {
      return;
    }

    const fragment = createOptionsFragment(items, {
      selectedValue,
    });

    companySelect.replaceChildren(fragment);

    /*
     * If selectedValue does not exist because of malformed data, force the
     * safe All Companies value.
     */

    const hasSelectedValue = Array.from(companySelect.options).some(
      (option) => String(option.value) === String(selectedValue),
    );

    companySelect.value = hasSelectedValue
      ? String(selectedValue)
      : String(defaultValue);

    synchronizeCompanyFilter(sourceName);

    notifySelect(companySelect, {
      optionsUpdated,

      /*
       * Do not emit change.
       *
       * trading.js owns the final dataset request.
       */
      change: false,
    });
  }

  /* =========================================================================
     Restore Original Options
     ========================================================================= */

  /**
   * Restore the complete JSP-rendered All-Market Company list.
   *
   * Used when:
   *
   * - Sector = All
   * - Negotiated Reset
   * - dependency request fails
   *
   * Company always returns to All Companies.
   */

  function restoreAllCompanies({ sourceName = "sector-company-restore" } = {}) {
    if (destroyed) {
      return;
    }

    const items = [...originalOptions];

    /*
     * Defensive fallback:
     *
     * If malformed JSP markup did not contain the All Companies option, insert
     * it explicitly.
     */

    const hasDefault = items.some(
      (item) => String(item.value) === String(defaultValue),
    );

    if (!hasDefault) {
      items.unshift(
        Object.freeze({
          value: defaultValue,

          label: defaultLabel,

          disabled: false,

          hidden: false,
        }),
      );
    }

    replaceCompanyOptions(items, {
      selectedValue: defaultValue,

      sourceName,
    });
  }

  /* =========================================================================
     Sector Company Normalization
     ========================================================================= */

  function normalizeSectorCompanies(companies = []) {
    if (!Array.isArray(companies)) {
      return [];
    }

    const seen = new Set([String(defaultValue)]);

    const normalized = [];

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
       * Ignore:
       *
       * - backend-supplied All
       * - duplicate symbols/IDs
       */

      if (seen.has(value)) {
        return;
      }

      seen.add(value);

      const rawLabel = company[labelField];

      normalized.push(
        Object.freeze({
          value,

          label: normalizeString(rawLabel, value),

          disabled: false,

          hidden: false,
        }),
      );
    });

    return normalized;
  }

  /* =========================================================================
     Render Sector Companies
     ========================================================================= */

  function renderSectorCompanies(companies = []) {
    if (destroyed) {
      return;
    }

    const normalized = normalizeSectorCompanies(companies);

    /*
     * All Companies is always first and selected after a Sector change.
     */

    const items = [
      Object.freeze({
        value: defaultValue,

        label: defaultLabel,

        disabled: false,

        hidden: false,
      }),

      ...normalized,
    ];

    replaceCompanyOptions(items, {
      selectedValue: defaultValue,

      sourceName: "sector-company-load",
    });
  }

  /* =========================================================================
     Company Clear
     ========================================================================= */

  /**
   * Ensure Company never remains empty.
   *
   * Enhanced custom-select behavior:
   *
   * X / Clear
   *   ↓
   * native empty value
   *   ↓
   * All Companies
   *
   * @returns {boolean} true when normalization occurred
   */

  function normalizeCompanyValue() {
    if (destroyed || hasValue(companySelect.value)) {
      return false;
    }

    /*
     * If All Companies is unexpectedly absent, restore the full list first.
     */

    const hasDefault = Array.from(companySelect.options).some(
      (option) => String(option.value) === String(defaultValue),
    );

    if (!hasDefault) {
      restoreAllCompanies({
        sourceName: "company-clear-restore",
      });

      return true;
    }

    companySelect.value = defaultValue;

    synchronizeCompanyFilter("company-clear");

    /*
     * Options did not change; only visible selected value needs refresh.
     *
     * The existing custom-select event is still safe and avoids inventing
     * another page-specific UI contract.
     */

    notifySelect(companySelect, {
      optionsUpdated: true,

      change: false,
    });

    return true;
  }

  /* =========================================================================
     Load Companies
     ========================================================================= */

  async function loadCompanies(sectorValue) {
    if (destroyed) {
      return Object.freeze({
        sector: TRADING_VALUES.all,

        companies: [],
      });
    }

    const sector = normalizeString(sectorValue, TRADING_VALUES.all);

    activeSector = sector;

    /* -----------------------------------------------------------------------
       All Market
       ----------------------------------------------------------------------- */

    /*
     * Sector = All does NOT require dependency AJAX.
     *
     * The JSP already rendered the complete Company list.
     */

    if (sector === TRADING_VALUES.all) {
      source.cancel();

      setCompanyLoading(false);

      restoreAllCompanies({
        sourceName: "sector-all",
      });

      return Object.freeze({
        sector,

        companies: [],
      });
    }

    /* -----------------------------------------------------------------------
       Sector-specific Request
       ----------------------------------------------------------------------- */

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

      /*
       * createDataSource already implements latest-request-wins.
       *
       * This extra guard protects against future transport changes and ensures
       * an old Sector response can never repaint a newer selection.
       */

      if (sector !== activeSector) {
        return Object.freeze({
          sector,

          companies: [],
        });
      }

      const companies = Array.isArray(response.rows) ? response.rows : [];

      renderSectorCompanies(companies);

      return Object.freeze({
        sector,

        companies: Object.freeze([...companies]),
      });
    } catch (error) {
      /*
       * Abort is expected when:
       *
       * - user changes Sector quickly
       * - Reset occurs during request
       * - Sector returns to All
       */

      if (error?.name === "AbortError") {
        throw error;
      }

      /*
       * Real dependency failure:
       *
       * never leave stale companies from another Sector visible.
       *
       * Restore the safe complete All-Market list.
       */

      if (!destroyed) {
        restoreAllCompanies({
          sourceName: "sector-company-error",
        });
      }

      throw error;
    } finally {
      /*
       * Only the current Sector owns the visible loading state.
       *
       * If another Sector request has already started, do not let the older
       * request clear its loading UI.
       */

      if (!destroyed && sector === activeSector) {
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
   * Restore the complete original Company list and select All Companies.
   *
   * Important:
   *
   * - no dependency AJAX
   * - no Trading dataset AJAX
   *
   * trading.js performs exactly one final Negotiated reload after the complete
   * reset state has been synchronized.
   */

  function resetCompany() {
    if (destroyed) {
      return;
    }

    activeSector = TRADING_VALUES.all;

    source.cancel();

    setCompanyLoading(false);

    restoreAllCompanies({
      sourceName: "negotiated-reset",
    });
  }

  /* =========================================================================
     Queries
     ========================================================================= */

  function getCompanyValue() {
    return normalizeString(companySelect.value, defaultValue);
  }

  function getOriginalCompanyCount() {
    return originalOptions.length;
  }

  function getActiveSector() {
    return activeSector;
  }

  function isLoading() {
    return loading;
  }

  /* =========================================================================
     Cancellation
     ========================================================================= */

  function cancel() {
    if (destroyed) {
      return false;
    }

    activeSector = normalizeString(
      filters.negotiated.getValue("sector"),
      TRADING_VALUES.all,
    );

    const cancelled = source.cancel();

    setCompanyLoading(false);

    return cancelled;
  }

  /* =========================================================================
     Lifecycle
     ========================================================================= */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    /*
     * createDataSource.destroy() cancels the active request.
     */

    source.destroy();

    companySelect.removeAttribute("aria-busy");
  }

  /* =========================================================================
     Public Instance
     ========================================================================= */

  return Object.freeze({
    /* -----------------------------------------------------------------------
       Loading
       ----------------------------------------------------------------------- */

    loadCompanies,
    loadCurrentSector,

    /* -----------------------------------------------------------------------
       Normalization
       ----------------------------------------------------------------------- */

    normalizeCompanyValue,

    /* -----------------------------------------------------------------------
       Reset / Restore
       ----------------------------------------------------------------------- */

    resetCompany,
    restoreAllCompanies,

    /* -----------------------------------------------------------------------
       Queries
       ----------------------------------------------------------------------- */

    getCompanyValue,
    getOriginalCompanyCount,
    getActiveSector,
    isLoading,

    /* -----------------------------------------------------------------------
       Lifecycle
       ----------------------------------------------------------------------- */

    cancel,
    destroy,
  });
}
