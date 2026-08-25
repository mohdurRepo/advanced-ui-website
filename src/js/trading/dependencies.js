/* ==========================================================================
   Trading Dependencies
   ========================================================================== */

/*
 * Trading-specific dependent-filter behavior.
 *
 * Responsibilities:
 *
 * - load Company options when Sector changes
 * - keep only one active dependency request
 * - reset Company to "All Companies"
 * - synchronize the enhanced custom-select UI
 * - expose loading/error-safe lifecycle
 *
 * This file intentionally has no:
 *
 * - Trading table loading
 * - Trading cards
 * - DataTables
 * - tab switching
 * - view switching
 * - result rendering
 * - page reload orchestration
 */

import { createDataSource } from "../common/data-view/index.js";

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

function getElement(root, selector) {
  return root?.querySelector?.(selector) || null;
}

/* ==========================================================================
   Custom Select Synchronization
   ========================================================================== */

/*
 * The native <select> is the source of truth.
 *
 * After programmatic option/value changes, notify the design-system
 * custom-select enhancement so its visible UI stays synchronized.
 *
 * Keep these events centralized here rather than scattering them through
 * Trading.
 */

function refreshCustomSelect(select) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  /*
   * Native change keeps ordinary listeners synchronized.
   *
   * This event should be dispatched only after the final value has been set.
   */
  select.dispatchEvent(
    new Event("change", {
      bubbles: true,
    }),
  );

  /*
   * Existing design-system hook used after dynamically replacing options.
   *
   * If the current custom-select implementation uses a different event name,
   * only this function needs to change.
   */
  select.dispatchEvent(
    new CustomEvent("custom-select:refresh", {
      bubbles: true,
    }),
  );
}

/* ==========================================================================
   Option Rendering
   ========================================================================== */

function createOption(value, label, selected = false) {
  const option = document.createElement("option");

  option.value = String(value ?? "");

  option.textContent = String(label ?? "");

  option.selected = Boolean(selected);

  return option;
}

/* ==========================================================================
   Response Normalization
   ========================================================================== */

function normalizeCompaniesResponse(response) {
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

  if (Array.isArray(response?.companies)) {
    return response.companies;
  }

  return [];
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

  const dependencyConfig = config.dependencies?.sectorCompany || {};

  const endpoint =
    dependencyConfig.endpoint || config.endpoints?.companiesBySector || "";

  if (!endpoint) {
    throw new Error("Trading Sector → Company endpoint is required.");
  }

  const defaultValue = dependencyConfig.defaultValue || TRADING_VALUES.all;

  const valueField = dependencyConfig.response?.value || "symbol";

  const labelField = dependencyConfig.response?.label || "longName";

  const sectorParameter = dependencyConfig.request?.sectorParameter || "sector";

  const companySelect = getElement(root, SELECTORS.negotiated.company);

  if (!(companySelect instanceof HTMLSelectElement)) {
    throw new Error("Trading Company select was not found.");
  }

  const initialAllOption = companySelect.querySelector(
    `option[value="${CSS.escape(defaultValue)}"]`,
  );

  const allCompaniesLabel =
    initialAllOption?.textContent?.trim() ||
    config.labels?.controls?.all ||
    "All Companies";

  /* ==========================================================================
     Source
     ========================================================================== */

  const source = createDataSource({
    endpoint,

    buildRequestData(state = {}) {
      return {
        [sectorParameter]: state.sector || defaultValue,
      };
    },

    normalizeResponse(response) {
      return {
        rows: normalizeCompaniesResponse(response),

        meta: {},

        raw: response,
      };
    },
  });

  /* ==========================================================================
     Company Options
     ========================================================================== */

  function replaceCompanyOptions(companies = []) {
    const fragment = document.createDocumentFragment();

    fragment.append(createOption(defaultValue, allCompaniesLabel, true));

    companies.forEach((company) => {
      if (!isObject(company)) {
        return;
      }

      const value = company[valueField];

      const label = company[labelField];

      if (!hasValue(value) || !hasValue(label)) {
        return;
      }

      fragment.append(createOption(value, label, false));
    });

    companySelect.replaceChildren(fragment);

    companySelect.value = defaultValue;

    /*
     * Keep common filter state synchronized with the native control without
     * creating its own notification/reload cycle.
     */
    filters.negotiated.setValue("company", defaultValue, {
      notify: false,

      source: "sector-company-dependency",
    });

    /*
     * createDataFilters caches the last DOM value used for change detection.
     * Re-sync after replacing the native options.
     */
    filters.negotiated.sync();

    refreshCustomSelect(companySelect);
  }

  function resetCompany() {
    replaceCompanyOptions([]);
  }

  /* ==========================================================================
     Loading
     ========================================================================== */

  function setCompanyLoading(loading) {
    filters.negotiated.setDisabled("company", loading);

    if (loading) {
      companySelect.setAttribute("aria-busy", "true");

      return;
    }

    companySelect.removeAttribute("aria-busy");
  }

  /* ==========================================================================
     Load Companies
     ========================================================================== */

  async function loadCompanies(sectorValue) {
    const sector = hasValue(sectorValue)
      ? String(sectorValue).trim()
      : defaultValue;

    /*
     * "All Sectors" requires no remote Company lookup.
     *
     * Company simply returns to its business-default state.
     */
    if (sector === defaultValue) {
      source.cancel();

      resetCompany();

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

      const companies = Array.isArray(response.rows) ? response.rows : [];

      replaceCompanyOptions(companies);

      return Object.freeze({
        sector,
        companies,
      });
    } catch (error) {
      /*
       * createDataSource uses AbortError for stale/cancelled requests.
       *
       * Do not reset the current Company UI when an older Sector request was
       * cancelled by a newer one.
       */
      if (error?.name === "AbortError") {
        throw error;
      }

      /*
       * Dependency failure should leave the filter in a safe usable state.
       *
       * Users can still request all Companies rather than being left with
       * stale options from the previous Sector.
       */
      resetCompany();

      throw error;
    } finally {
      setCompanyLoading(false);
    }
  }

  /* ==========================================================================
     Current Sector
     ========================================================================== */

  function loadCurrentSector() {
    const sector = filters.negotiated.getValue("sector");

    return loadCompanies(sector);
  }

  /* ==========================================================================
     Lifecycle
     ========================================================================== */

  function cancel() {
    return source.cancel();
  }

  function destroy() {
    source.destroy();
  }

  /* ==========================================================================
     Public Instance
     ========================================================================== */

  return Object.freeze({
    loadCompanies,
    loadCurrentSector,

    resetCompany,

    cancel,
    destroy,
  });
}
