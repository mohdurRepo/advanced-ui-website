/* ==========================================================================
   Historical Reports Filters
   ========================================================================== */

/*
 * Filter coordination for Historical Reports.
 *
 * No CustomSelect/CustomDate class access anywhere in this file. Both
 * components are already initialized globally by main.js before this
 * module runs, and both already provide a way for external code to change
 * a value and keep the enhanced UI in sync WITHOUT touching their class
 * instances:
 *
 * - CustomSelect runs its own internal MutationObserver on the native
 *   <select>, watching childList/subtree changes -- rebuilding the
 *   <option> list with plain DOM APIs is enough for it to notice and
 *   re-render its own listbox/value automatically.
 *
 * - Both CustomSelect and CustomDate bind a plain native "change" listener
 *   on their underlying input(s) specifically so external code can signal
 *   a programmatic value change -- dispatching a real "change" event after
 *   setting .value triggers their internal resync exactly as user
 *   interaction would.
 *
 * createDataFilters ALSO binds its own "change" listener directly on the
 * native element (independent of CustomSelect/CustomDate), so one
 * dispatched "change" event satisfies both systems at once: the enhanced
 * UI resyncs, and the filter-change notification fires.
 *
 * Legacy reference: DROPDOWN_CONFIG (JSP script block) + DropdownManager
 * (removed) + HistoricalManager.resetFilters()/setDefaultDatesIfEmpty().
 */

/* ==========================================================================
   Selectors
   ========================================================================== */

export const HISTORICAL_FILTER_SELECTORS = Object.freeze({
  market: "[data-historical-market]",
  sector: "[data-historical-sector]",
  entity: "[data-historical-entity]",
  tradeType: "[data-historical-trade-type]",

  dateRangeComponent: "[data-custom-date-range]",
  dateStart: "[data-date-start]",
  dateEnd: "[data-date-end]",

  tabsRoot: ".tabs[data-tabs]",
  activeTab: '[role="tab"][aria-selected="true"]',
});

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_MARKET = "-1";
const DEFAULT_SECTOR = "0";
const DEFAULT_ENTITY = "0";
const DEFAULT_TRADE_TYPE = "OB";
const DEFAULT_TAB = "performance";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/* ==========================================================================
   General Helpers
   ========================================================================== */

function normalizeString(value) {
  return String(value ?? "").trim();
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getOneMonthRange() {
  const today = new Date();
  const oneMonthAgo = new Date(today);

  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  return {
    start: formatIsoDate(oneMonthAgo),
    end: formatIsoDate(today),
  };
}

/* ==========================================================================
   Native Value Synchronization
   ========================================================================== */

/*
 * The one mechanism this entire file relies on for "change a value
 * programmatically and keep everything in sync": set .value normally, then
 * dispatch a real "change" event -- both CustomSelect/CustomDate's own
 * internal resync and createDataFilters' own change detection listen for
 * exactly this. Skips the dispatch when the value is already correct, so a
 * no-op reset does not manufacture a spurious notification.
 */

function setNativeValueAndNotify(element, value) {
  if (!element || element.value === value) {
    return;
  }

  element.value = value;

  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/*
 * The date-range pair needs both native inputs set before any event
 * fires, since CustomDate's handleNativeChange() reads both inputs'
 * current values together regardless of which one changed. Dispatching
 * once (on the end input) after both are set produces exactly one
 * "form:date-change" notification for the pair.
 */

function setNativeDateRangeAndNotify(
  startInput,
  endInput,
  startValue,
  endValue,
) {
  if (!startInput || !endInput) {
    return;
  }

  const changed =
    startInput.value !== startValue || endInput.value !== endValue;

  startInput.value = startValue;
  endInput.value = endValue;

  if (changed) {
    endInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

/* ==========================================================================
   Filter Value Normalizers
   ========================================================================== */

export function normalizeHistoricalMarket(value) {
  return normalizeString(value) || DEFAULT_MARKET;
}

export function normalizeHistoricalSector(value) {
  return normalizeString(value) || DEFAULT_SECTOR;
}

export function normalizeHistoricalEntity(value) {
  return normalizeString(value) || DEFAULT_ENTITY;
}

export function normalizeHistoricalTradeType(value) {
  return normalizeString(value) || DEFAULT_TRADE_TYPE;
}

/* ==========================================================================
   Date Format Conversion
   ========================================================================== */

/*
 * The only place this conversion happens. custom-date-range's native
 * inputs always hold ISO (YYYY-MM-DD); the backend's existing contract
 * expects DD-MM-YYYY. Everywhere else in this module's filter state, dates
 * stay ISO.
 */

export function toLegacyDateFormat(isoValue) {
  const value = normalizeString(isoValue);

  if (!ISO_DATE_PATTERN.test(value)) {
    return "";
  }

  const [year, month, day] = value.split("-");

  return `${day}-${month}-${year}`;
}

/* ==========================================================================
   Initial Date Defaulting
   ========================================================================== */

/*
 * Must run AFTER main.js's global initCustomDates() has already enhanced
 * this component (guaranteed by module execution order -- see the module
 * comment in historical.js). Setting .value alone would leave the already-
 * built CustomDate UI showing its placeholder text even though the native
 * input now silently holds a real date underneath, so this dispatches a
 * real "change" event the same way every other reset in this file does.
 */

export function applyDefaultHistoricalDateRangeIfEmpty(root) {
  const startInput = root.querySelector(HISTORICAL_FILTER_SELECTORS.dateStart);
  const endInput = root.querySelector(HISTORICAL_FILTER_SELECTORS.dateEnd);

  if (!startInput || !endInput) {
    return;
  }

  if (startInput.value && endInput.value) {
    return;
  }

  const { start, end } = getOneMonthRange();

  setNativeDateRangeAndNotify(
    startInput,
    endInput,
    startInput.value || start,
    endInput.value || end,
  );
}

/* ==========================================================================
   Active Tab
   ========================================================================== */

/*
 * Pull-based read rather than reading the triggering event's detail:
 * tabs.controller.js updates aria-selected before dispatching tabs:change,
 * so querying current DOM state here is reliable independent of any
 * particular event.
 */

export function getActiveHistoricalTab(root = document) {
  const activeTab = root.querySelector(
    `${HISTORICAL_FILTER_SELECTORS.tabsRoot} ${HISTORICAL_FILTER_SELECTORS.activeTab}`,
  );

  return normalizeString(activeTab?.dataset?.tab) || DEFAULT_TAB;
}

/* ==========================================================================
   Filter State Adaptation
   ========================================================================== */

/*
 * createDataFilters' getState() returns one nested `dateRange:
 * {startDate, endDate}` object (see the dateRange field below -- registered
 * as a single field so a complete range pick produces one change
 * notification, not two). This adapter bridges to the flat shape
 * historical.rules.js and the request builders expect.
 */

export function getHistoricalFilters(filterState = {}) {
  return {
    market: normalizeHistoricalMarket(filterState.market),
    sector: normalizeHistoricalSector(filterState.sector),
    entity: normalizeHistoricalEntity(filterState.entity),
    tradeType: normalizeHistoricalTradeType(filterState.tradeType),

    startDate: normalizeString(filterState.dateRange?.startDate),
    endDate: normalizeString(filterState.dateRange?.endDate),

    activeTab: normalizeString(filterState.activeTab) || DEFAULT_TAB,
  };
}

/* ==========================================================================
   Filter Definitions
   ========================================================================== */

export function createHistoricalFilterFields() {
  return {
    market: {
      selector: HISTORICAL_FILTER_SELECTORS.market,
      effect: "reload",
      normalize: normalizeHistoricalMarket,
    },

    sector: {
      selector: HISTORICAL_FILTER_SELECTORS.sector,
      effect: "reload",
      normalize: normalizeHistoricalSector,
    },

    entity: {
      selector: HISTORICAL_FILTER_SELECTORS.entity,
      effect: "reload",
      normalize: normalizeHistoricalEntity,
    },

    tradeType: {
      selector: HISTORICAL_FILTER_SELECTORS.tradeType,
      effect: "reload",
      normalize: normalizeHistoricalTradeType,
    },

    dateRange: {
      selector: HISTORICAL_FILTER_SELECTORS.dateRangeComponent,
      events: ["form:date-change"],
      effect: "reload",
      read({ elements }) {
        const component = elements[0];

        const startInput = component?.querySelector(
          HISTORICAL_FILTER_SELECTORS.dateStart,
        );

        const endInput = component?.querySelector(
          HISTORICAL_FILTER_SELECTORS.dateEnd,
        );

        return {
          startDate: startInput?.value || "",
          endDate: endInput?.value || "",
        };
      },
    },

    activeTab: {
      selector: HISTORICAL_FILTER_SELECTORS.tabsRoot,
      events: ["tabs:change"],
      effect: "reload",
      read: () => getActiveHistoricalTab(),
    },
  };
}

/* ==========================================================================
   Request Payload Builders
   ========================================================================== */

/*
 * Mutates and returns DataTables' own request object -- called from inside
 * views/historical.table.js's function-form `ajax`, matching legacy's
 * buildHistoricalAjax(tabId) structure exactly.
 */

export function buildHistoricalReportRequestData(
  config,
  filters,
  dataTablesParams,
  tabId,
) {
  const requestParams = dataTablesParams;

  requestParams.selectedMarket = filters.market;
  requestParams.selectedSector = filters.sector;
  requestParams.selectedEntity = filters.entity;
  requestParams.selectedTypeOfTrade = filters.tradeType;
  requestParams.startDate = toLegacyDateFormat(filters.startDate);
  requestParams.endDate = toLegacyDateFormat(filters.endDate);
  requestParams.tableTabId = tabId;

  requestParams.startIndex = Number(requestParams.start || 0);
  requestParams.endIndex =
    Number(requestParams.start || 0) + Number(requestParams.length || 100);

  return requestParams;
}

export function buildHistoricalUnderlyingRequestData(config, filters) {
  return {
    selectedMarket: filters.market,
    selectedSector: filters.sector,
    selectedEntity: filters.entity,
    requestLocale: config.locale,
    startDate: toLegacyDateFormat(filters.startDate),
    endDate: toLegacyDateFormat(filters.endDate),
  };
}

/* ==========================================================================
   Cascading Dropdown Population
   ========================================================================== */

const pendingRequests = new WeakMap();

async function fetchDropdownOptions(endpoint, params, abortKey) {
  pendingRequests.get(abortKey)?.abort();

  const controller = new AbortController();

  pendingRequests.set(abortKey, controller);

  const url = new URL(endpoint, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }

    const payload = await response.json();

    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    if (error?.name === "AbortError") {
      return null;
    }

    throw error;
  } finally {
    if (pendingRequests.get(abortKey) === controller) {
      pendingRequests.delete(abortKey);
    }
  }
}

/*
 * Rebuilds a native <select>'s options from scratch, with the placeholder
 * marked `selected` in the freshly-created markup itself -- unambiguous,
 * since a just-created <option> element's initial selectedness is governed
 * directly by the presence of the "selected" attribute at creation time.
 * No event dispatch needed for CustomSelect's own visual resync (its
 * MutationObserver picks up the childList change automatically); dispatch
 * here is purely to inform createDataFilters that the field's value
 * changed.
 */

function applyDropdownOptions({
  select,
  placeholderLabel,
  items,
  getValue,
  getLabel,
}) {
  if (!select) {
    return;
  }

  const placeholderOption = document.createElement("option");

  placeholderOption.value = "0";
  placeholderOption.selected = true;
  placeholderOption.textContent = placeholderLabel;

  select.replaceChildren(placeholderOption);

  items.forEach((item) => {
    const option = document.createElement("option");

    option.value = getValue(item);
    option.textContent = getLabel(item);

    select.append(option);
  });

  select.dispatchEvent(new Event("change", { bubbles: true }));
}

async function populateSectorOptions({ root, config, market }) {
  const select = root.querySelector(HISTORICAL_FILTER_SELECTORS.sector);

  if (!select) {
    return;
  }

  const disabled = config.constants.marketsWithoutSector.includes(market);

  select.disabled = disabled;

  if (disabled) {
    applyDropdownOptions({
      select,
      placeholderLabel: config.labels.placeholders.sector,
      items: [],
      getValue: () => "",
      getLabel: () => "",
    });

    return;
  }

  const items = await fetchDropdownOptions(
    config.endpoints.sectors,
    { selectedMarket: market },
    "sector",
  );

  if (items === null) {
    return;
  }

  applyDropdownOptions({
    select,
    placeholderLabel: config.labels.placeholders.sector,
    items,
    getValue: (item) => item.dropdownValue ?? "0",
    getLabel: (item) => item.name ?? "-",
  });
}

async function populateEntityOptions({ root, config, market, sector }) {
  const select = root.querySelector(HISTORICAL_FILTER_SELECTORS.entity);

  if (!select) {
    return;
  }

  const items = await fetchDropdownOptions(
    config.endpoints.entities,
    { selectedMarket: market, selectedSector: sector },
    "entity",
  );

  if (items === null) {
    return;
  }

  applyDropdownOptions({
    select,
    placeholderLabel: config.labels.placeholders.entity,
    items,
    getValue: (item) => item.entitySymbol ?? "0",
    getLabel: (item) => item.entityName ?? "-",
  });
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createHistoricalFilters({
  root,
  config,
  createDataFilters,
} = {}) {
  if (!root) {
    throw new TypeError("createHistoricalFilters requires a root.");
  }

  if (!config) {
    throw new TypeError("createHistoricalFilters requires config.");
  }

  if (typeof createDataFilters !== "function") {
    throw new TypeError("createHistoricalFilters requires createDataFilters.");
  }

  const filters = createDataFilters({
    root,
    fields: createHistoricalFilterFields(),
  });

  /*
   * Subscribed before this factory returns, so this listener always runs
   * ahead of any listener historical.js adds afterwards -- Set iteration
   * follows subscription order.
   */
  filters.subscribe((event) => {
    if (event.key === "market") {
      const market = normalizeHistoricalMarket(event.value);

      populateSectorOptions({ root, config, market });
      populateEntityOptions({ root, config, market, sector: DEFAULT_SECTOR });

      return;
    }

    if (event.key === "sector") {
      const marketSelect = root.querySelector(
        HISTORICAL_FILTER_SELECTORS.market,
      );

      const market = normalizeHistoricalMarket(marketSelect?.value);
      const sector = normalizeHistoricalSector(event.value);

      populateEntityOptions({ root, config, market, sector });
    }
  });

  /* ------------------------------------------------------------------------
     Reset
     ------------------------------------------------------------------------ */

  async function resetToDefaults() {
    const marketSelect = root.querySelector(HISTORICAL_FILTER_SELECTORS.market);
    const tradeTypeSelect = root.querySelector(
      HISTORICAL_FILTER_SELECTORS.tradeType,
    );
    const dateStartInput = root.querySelector(
      HISTORICAL_FILTER_SELECTORS.dateStart,
    );
    const dateEndInput = root.querySelector(
      HISTORICAL_FILTER_SELECTORS.dateEnd,
    );

    const { market, sector, entity, tradeType } = config.defaults;

    setNativeValueAndNotify(marketSelect, market);

    /*
     * Wait for the real option lists before selecting the target
     * sector/entity values -- selecting a value that does not exist yet
     * in a freshly-emptied <select> would silently no-op.
     */
    await populateSectorOptions({ root, config, market });
    await populateEntityOptions({ root, config, market, sector });

    const sectorSelect = root.querySelector(HISTORICAL_FILTER_SELECTORS.sector);
    const entitySelect = root.querySelector(HISTORICAL_FILTER_SELECTORS.entity);

    setNativeValueAndNotify(sectorSelect, sector);
    setNativeValueAndNotify(entitySelect, entity);
    setNativeValueAndNotify(tradeTypeSelect, tradeType);

    const { start, end } = getOneMonthRange();

    setNativeDateRangeAndNotify(dateStartInput, dateEndInput, start, end);
  }

  return {
    filters,

    getFilters() {
      return getHistoricalFilters(filters.getState());
    },

    resetToDefaults,

    destroy() {
      filters.destroy?.();
    },
  };
}
