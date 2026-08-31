/* ==========================================================================
   Financial Calendar Sectors
   ========================================================================== */

/*
 * Shared Market -> Sector dependency loader.
 *
 * Responsibilities:
 *
 * - request sectors for the selected Market
 * - normalize supported endpoint response shapes
 * - normalize Sector option values and labels
 * - cancel stale requests
 * - prevent stale responses from replacing newer options
 * - safely replace native select options
 * - preserve a requested Sector when it still exists
 * - control the Sector select loading and disabled state
 * - refresh the design-system CustomSelect after programmatic updates
 * - restore the Sector select after success, error, cancellation, or destroy
 *
 * This module intentionally has no:
 *
 * - result API requests
 * - tab activation logic
 * - filter subscriptions
 * - table or card rendering
 * - page-level loading ownership
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createDataSource } from "../../../common/data-view/index.js";

import { normalizeString } from "../../../shared/trading/trading-formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_MARKET = "M";

const EMPTY_SECTOR_VALUE = "";

const SELECTORS = Object.freeze({
  customSelect: "[data-custom-select]",
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

function requireSelect(root, value, description) {
  const select = resolveElement(root, value);

  if (
    typeof HTMLSelectElement === "undefined" ||
    !(select instanceof HTMLSelectElement)
  ) {
    throw new Error(
      `Financial Calendar ${description} must be a native select element.`,
    );
  }

  return select;
}

function normalizeMarket(value) {
  return normalizeString(value).toUpperCase() === "S" ? "S" : DEFAULT_MARKET;
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

/* ==========================================================================
   Response Collection
   ========================================================================== */

function parseJson(value) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();

  if (!normalized) {
    return [];
  }

  try {
    return JSON.parse(normalized);
  } catch {
    return [];
  }
}

function getResponseCollection(response) {
  const parsed = parseJson(response);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (!isPlainObject(parsed)) {
    return [];
  }

  const candidates = [
    parsed.rows,

    parsed.data,

    parsed.items,

    parsed.results,

    parsed.sectors,

    parsed.sectorList,
  ];

  return candidates.find(Array.isArray) || [];
}

/* ==========================================================================
   Sector Normalization
   ========================================================================== */

function getFirstString(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function normalizeSector(item) {
  if (typeof item === "string" || typeof item === "number") {
    const value = normalizeString(item);

    return value
      ? Object.freeze({
          value,

          label: value,
        })
      : null;
  }

  if (!isPlainObject(item)) {
    return null;
  }

  const value = getFirstString(
    item.id,

    item.value,

    item.symbol,

    item.code,

    item.sectorId,

    item.sectorCode,
  );

  if (!value) {
    return null;
  }

  const label = getFirstString(
    item.name,

    item.label,

    item.longName,

    item.description,

    item.sectorName,

    value,
  );

  return Object.freeze({
    value,

    label,
  });
}

function normalizeSectors(response) {
  const seenValues = new Set();

  return getResponseCollection(response)
    .map(normalizeSector)
    .filter((sector) => {
      if (!sector || seenValues.has(sector.value)) {
        return false;
      }

      seenValues.add(sector.value);

      return true;
    });
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getAllSectorsLabel(market, config) {
  const filters = config.labels?.filters || {};

  if (normalizeMarket(market) === "S") {
    return normalizeString(filters.allNomuMarketSectors) || "All Sectors";
  }

  return normalizeString(filters.allMainMarketSectors) || "All Sectors";
}

/* ==========================================================================
   Option Creation
   ========================================================================== */

function createOption({
  value,
  label,
  selected = false,
  defaultSelected = false,
}) {
  const option = document.createElement("option");

  option.value = normalizeString(value);

  option.textContent = normalizeString(label);

  option.selected = Boolean(selected);

  option.defaultSelected = Boolean(defaultSelected);

  return option;
}

function resolveSelectedValue(sectors, requestedValue) {
  const normalizedRequestedValue = normalizeString(requestedValue);

  if (!normalizedRequestedValue) {
    return EMPTY_SECTOR_VALUE;
  }

  const exists = sectors.some(
    (sector) => sector.value === normalizedRequestedValue,
  );

  return exists ? normalizedRequestedValue : EMPTY_SECTOR_VALUE;
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createFinancialCalendarSectors(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError(
      "createFinancialCalendarSectors requires an options object.",
    );
  }

  const root = options.root || document;

  const config = options.config || {};

  if (!isPlainObject(config)) {
    throw new TypeError(
      "Financial Calendar Sectors requires a configuration object.",
    );
  }

  const marketSelect = requireSelect(root, options.market, "Market control");

  const sectorSelect = requireSelect(root, options.sector, "Sector control");

  const customSelectRoot = sectorSelect.closest(SELECTORS.customSelect);

  /* ========================================================================
     Data Source
     ======================================================================== */

  const source = createDataSource({
    endpoint: config.endpoints?.sectors,

    method: "GET",

    dataType: "json",

    buildRequestData(state = {}) {
      return {
        marketsListId: normalizeMarket(state.market),
      };
    },

    normalizeResponse(response) {
      const rows = normalizeSectors(response);

      return {
        rows,

        meta: {
          count: rows.length,
        },
      };
    },
  });

  /* ========================================================================
     Internal State
     ======================================================================== */

  let destroyed = false;

  let loading = false;

  let requestId = 0;

  let sectors = [];

  let activeMarket = normalizeMarket(marketSelect.value);

  /* ========================================================================
     Custom Select Refresh
     ======================================================================== */

  /*
   * The non-bubbling change event lets the design-system CustomSelect refresh
   * its generated presentation without reaching the delegated filter listener
   * on the form.
   */

  function refreshCustomSelect() {
    sectorSelect.dispatchEvent(
      new Event("change", {
        bubbles: false,
      }),
    );

    customSelectRoot?.dispatchEvent(
      new CustomEvent("custom-select:refresh", {
        bubbles: false,

        detail: Object.freeze({
          select: sectorSelect,

          source: "financial-calendar-sectors",
        }),
      }),
    );
  }

  /* ========================================================================
     Loading State
     ======================================================================== */

  function setLoading(nextLoading) {
    loading = Boolean(nextLoading);

    sectorSelect.disabled = loading;

    sectorSelect.setAttribute("aria-busy", String(loading));

    customSelectRoot?.classList.toggle("is-loading", loading);

    customSelectRoot?.setAttribute("aria-busy", String(loading));

    refreshCustomSelect();
  }

  /* ========================================================================
     Option Rendering
     ======================================================================== */

  function renderOptions({ market, rows, selectedValue }) {
    const normalizedRows = Array.isArray(rows) ? rows : [];

    const resolvedSelectedValue = resolveSelectedValue(
      normalizedRows,
      selectedValue,
    );

    const fragment = document.createDocumentFragment();

    fragment.append(
      createOption({
        value: EMPTY_SECTOR_VALUE,

        label: getAllSectorsLabel(market, config),

        selected: resolvedSelectedValue === EMPTY_SECTOR_VALUE,

        /*
         * Reset always returns Sector to All.
         */

        defaultSelected: true,
      }),
    );

    normalizedRows.forEach((sector) => {
      fragment.append(
        createOption({
          value: sector.value,

          label: sector.label,

          selected: sector.value === resolvedSelectedValue,

          defaultSelected: false,
        }),
      );
    });

    sectorSelect.replaceChildren(fragment);

    sectorSelect.value = resolvedSelectedValue;

    /*
     * Store the actual synchronized value for filter modules that initialize
     * after the dependency request completes.
     */

    sectorSelect.dataset.selectedValue = resolvedSelectedValue;

    refreshCustomSelect();

    return resolvedSelectedValue;
  }

  function clearOptions(market) {
    sectors = [];

    return renderOptions({
      market,

      rows: [],

      selectedValue: EMPTY_SECTOR_VALUE,
    });
  }

  /* ========================================================================
     Error Event
     ======================================================================== */

  function dispatchError(error, market) {
    root.dispatchEvent(
      new CustomEvent("issuer-financial-calendars:sector-error", {
        bubbles: true,

        detail: Object.freeze({
          error,

          market,

          marketSelect,

          sectorSelect,
        }),
      }),
    );
  }

  /* ========================================================================
     Load
     ======================================================================== */

  async function load(market = marketSelect.value, settings = {}) {
    if (destroyed) {
      return Object.freeze({
        stale: true,

        rows: [],

        selectedValue: EMPTY_SECTOR_VALUE,
      });
    }

    /*
     * Cancel the transport first, then establish the new local request ID.
     */

    source.cancel();

    const currentRequestId = ++requestId;

    const normalizedMarket = normalizeMarket(market);

    const requestedSelectedValue = normalizeString(
      settings.selectedValue ??
        sectorSelect.dataset.initialValue ??
        sectorSelect.value,
    );

    activeMarket = normalizedMarket;

    setLoading(true);

    try {
      const response = await source.load({
        market: normalizedMarket,
      });

      if (destroyed || currentRequestId !== requestId) {
        return Object.freeze({
          stale: true,

          rows: [],

          selectedValue: EMPTY_SECTOR_VALUE,
        });
      }

      sectors = Array.isArray(response?.rows) ? response.rows : [];

      const selectedValue = renderOptions({
        market: normalizedMarket,

        rows: sectors,

        selectedValue: requestedSelectedValue,
      });

      delete sectorSelect.dataset.initialValue;

      return Object.freeze({
        stale: false,

        market: normalizedMarket,

        rows: [...sectors],

        selectedValue,
      });
    } catch (error) {
      if (destroyed || currentRequestId !== requestId || isAbortError(error)) {
        return Object.freeze({
          stale: true,

          rows: [],

          selectedValue: EMPTY_SECTOR_VALUE,
        });
      }

      const selectedValue = clearOptions(normalizedMarket);

      dispatchError(error, normalizedMarket);

      /*
       * Re-throw so the owning tab can decide whether to continue its result
       * request with Sector=All.
       */

      throw Object.assign(
        error instanceof Error ? error : new Error("Unable to load sectors."),
        {
          selectedValue,
        },
      );
    } finally {
      if (!destroyed && currentRequestId === requestId) {
        setLoading(false);
      }
    }
  }

  /* ========================================================================
     Cancellation
     ======================================================================== */

  function cancel() {
    if (destroyed) {
      return false;
    }

    requestId += 1;

    const cancelled = source.cancel();

    setLoading(false);

    return cancelled;
  }

  /* ========================================================================
     Selection
     ======================================================================== */

  function setSelectedValue(value) {
    if (destroyed) {
      return EMPTY_SECTOR_VALUE;
    }

    const selectedValue = resolveSelectedValue(sectors, value);

    sectorSelect.value = selectedValue;

    sectorSelect.dataset.selectedValue = selectedValue;

    refreshCustomSelect();

    return selectedValue;
  }

  function getSelectedValue() {
    return normalizeString(sectorSelect.value);
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    requestId += 1;

    source.cancel();

    /*
     * Restore the native control before marking the instance destroyed.
     */

    setLoading(false);

    source.destroy?.();

    sectors = [];

    destroyed = true;
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    load,

    cancel,

    destroy,

    clear() {
      return clearOptions(activeMarket);
    },

    setSelectedValue,

    getSelectedValue,

    getRows() {
      return [...sectors];
    },

    getMarket() {
      return activeMarket;
    },

    isLoading() {
      return loading;
    },

    isDestroyed() {
      return destroyed;
    },
  });
}
