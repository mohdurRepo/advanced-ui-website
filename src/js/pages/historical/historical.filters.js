/* ==========================================================================
   Historical Reports Filters
   ========================================================================== */

/*
 * Historical Reports filter adapter and dependency coordinator.
 *
 * Responsibilities:
 *
 * - expose Historical's filter definitions to common/data-view/data-filters
 * - normalize native filter values
 * - adapt generic filter state into Historical's flat filter contract
 * - convert ISO dates to the legacy backend DD-MM-YYYY contract
 * - populate Market -> Sector -> Entity dependencies
 * - cancel stale dependency requests
 * - prevent stale responses from replacing newer selections
 * - preserve Reset dependency ordering
 * - expose only SETTLED filter notifications to historical.js
 *
 * Native controls remain the source of truth.
 *
 * CustomSelect and CustomDate are enhanced globally by main.js. This module
 * does not own those component instances. Option-list mutations are observed
 * by CustomSelect, while native "change" events are used when an existing
 * control value must be changed programmatically.
 *
 * Important:
 *
 * common/data-view/data-filters still owns raw DOM observation. Historical
 * adds a small settled-state facade on top because Market/Sector changes are
 * asynchronous transactions, not independent single-field changes.
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

  dateStart: "[data-historical-date-start]",

  dateEnd: "[data-historical-date-end]",

  tabsRoot: "[data-historical-tabs]",

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

function getDocument(root) {
  if (root?.nodeType === 9) {
    return root;
  }

  return root?.ownerDocument || document;
}

function getView(root) {
  return getDocument(root)?.defaultView || window;
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

  /*
   * Intentionally preserves the existing Historical behavior.
   */
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  return {
    start: formatIsoDate(oneMonthAgo),

    end: formatIsoDate(today),
  };
}

/* ==========================================================================
   Native Events
   ========================================================================== */

function dispatchNativeChange(element) {
  if (!element) {
    return;
  }

  const view = element.ownerDocument?.defaultView || window;

  element.dispatchEvent(
    new view.Event("change", {
      bubbles: true,
    }),
  );
}

/* ==========================================================================
   Native Value Synchronization
   ========================================================================== */

/*
 * Existing-value changes need a native event so already-enhanced
 * CustomSelect/CustomDate instances resynchronize their generated UI.
 *
 * Dependency option rebuilds do not need this helper because CustomSelect's
 * MutationObserver sees the option child-list changes directly.
 */
function setNativeValueAndNotify(element, value) {
  if (!element) {
    return false;
  }

  const normalizedValue = String(value ?? "");

  if (element.value === normalizedValue) {
    return false;
  }

  element.value = normalizedValue;

  dispatchNativeChange(element);

  return true;
}

/*
 * Both inputs are written before dispatching the event.
 *
 * CustomDate reads the entire range when its native change handler runs.
 */
function setNativeDateRangeAndNotify(
  startInput,
  endInput,
  startValue,
  endValue,
) {
  if (!startInput || !endInput) {
    return false;
  }

  const changed =
    startInput.value !== startValue || endInput.value !== endValue;

  startInput.value = startValue;

  endInput.value = endValue;

  if (changed) {
    dispatchNativeChange(endInput);
  }

  return changed;
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
 * CustomDate uses ISO YYYY-MM-DD internally.
 *
 * Historical's existing backend request contract expects DD-MM-YYYY.
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

export function getActiveHistoricalTab(root = document) {
  const tabsRoot = root.querySelector(HISTORICAL_FILTER_SELECTORS.tabsRoot);

  const activeTab = tabsRoot?.querySelector(
    HISTORICAL_FILTER_SELECTORS.activeTab,
  );

  return normalizeString(activeTab?.dataset?.tab) || DEFAULT_TAB;
}

/* ==========================================================================
   Filter State Adaptation
   ========================================================================== */

/*
 * common/data-view/data-filters keeps dateRange as one compound field.
 *
 * Historical rules/request builders use the established flat representation.
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

      read({ root }) {
        return getActiveHistoricalTab(root);
      },
    },
  };
}

/* ==========================================================================
   Request Payload Builders
   ========================================================================== */

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
   Dependency Response Normalization
   ========================================================================== */

function normalizeResponseItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

/* ==========================================================================
   Dependency Request Manager
   ========================================================================== */

/*
 * Instance-scoped Map, not WeakMap.
 *
 * Request names are strings ("sector" / "entity"), and string keys are not
 * valid WeakMap keys.
 */
function createDependencyRequestManager(root) {
  const documentReference = getDocument(root);

  const view = getView(root);

  const AbortControllerCtor =
    view.AbortController || globalThis.AbortController;

  const URLCtor = view.URL || globalThis.URL;

  const fetchRequest =
    typeof view.fetch === "function"
      ? view.fetch.bind(view)
      : globalThis.fetch?.bind(globalThis);

  const controllers = new Map();

  let destroyed = false;

  function abort(key) {
    const controller = controllers.get(key);

    if (!controller) {
      return;
    }

    controller.abort();

    controllers.delete(key);
  }

  function abortAll() {
    controllers.forEach((controller) => {
      controller.abort();
    });

    controllers.clear();
  }

  async function request(key, endpoint, params = {}) {
    if (destroyed) {
      return {
        status: "aborted",

        items: [],
      };
    }

    if (typeof fetchRequest !== "function") {
      return {
        status: "error",

        items: [],

        error: new Error("Fetch API is unavailable."),
      };
    }

    abort(key);

    const controller = new AbortControllerCtor();

    controllers.set(key, controller);

    try {
      const url = new URLCtor(endpoint, documentReference.baseURI);

      Object.entries(params).forEach(([paramKey, value]) => {
        if (value === null || value === undefined) {
          return;
        }

        url.searchParams.set(paramKey, String(value));
      });

      const response = await fetchRequest(url.toString(), {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}.`);
      }

      const payload = await response.json();

      return {
        status: "ok",

        items: normalizeResponseItems(payload),
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        return {
          status: "aborted",

          items: [],
        };
      }

      return {
        status: "error",

        items: [],

        error,
      };
    } finally {
      if (controllers.get(key) === controller) {
        controllers.delete(key);
      }
    }
  }

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    abortAll();
  }

  return Object.freeze({
    abort,
    abortAll,
    destroy,
    request,
  });
}

/* ==========================================================================
   Native Select Helpers
   ========================================================================== */

function hasOptionValue(select, value) {
  if (!select) {
    return false;
  }

  const target = String(value ?? "");

  return Array.from(select.options).some((option) => option.value === target);
}

function setSelectDisabled(select, disabled) {
  if (!select) {
    return;
  }

  select.disabled = Boolean(disabled);
}

/*
 * Replaces the native options in one operation.
 *
 * CustomSelect observes this child-list mutation and refreshes its generated
 * interface automatically.
 */
function applyDropdownOptions({
  select,
  placeholderLabel,
  items = [],
  getValue,
  getLabel,
  selectedValue = DEFAULT_SECTOR,
}) {
  if (!select) {
    return DEFAULT_SECTOR;
  }

  const documentReference = select.ownerDocument;

  const fragment = documentReference.createDocumentFragment();

  const placeholderOption = documentReference.createElement("option");

  placeholderOption.value = "0";

  placeholderOption.textContent = placeholderLabel || "";

  fragment.append(placeholderOption);

  const seenValues = new Set(["0"]);

  items.forEach((item) => {
    if (!item) {
      return;
    }

    const value = normalizeString(getValue(item));

    if (!value || seenValues.has(value)) {
      return;
    }

    seenValues.add(value);

    const option = documentReference.createElement("option");

    option.value = value;

    option.textContent = normalizeString(getLabel(item)) || "-";

    fragment.append(option);
  });

  select.replaceChildren(fragment);

  const requestedValue = normalizeString(selectedValue) || "0";

  const resolvedValue = hasOptionValue(select, requestedValue)
    ? requestedValue
    : "0";

  select.value = resolvedValue;

  return resolvedValue;
}

function clearDropdown({ select, placeholderLabel }) {
  return applyDropdownOptions({
    select,
    placeholderLabel,
    items: [],
    getValue: () => "",

    getLabel: () => "",

    selectedValue: "0",
  });
}

/* ==========================================================================
   Dependency Logging
   ========================================================================== */

function logDependencyError(dependency, result) {
  if (result?.status !== "error") {
    return;
  }

  console.error(
    `[Historical Reports] Unable to load ${dependency} options.`,
    result.error,
  );
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

  /* ========================================================================
     Raw Generic Filter Instance
     ======================================================================== */

  const rawFilters = createDataFilters({
    root,

    fields: createHistoricalFilterFields(),
  });

  /* ========================================================================
     DOM
     ======================================================================== */

  const marketSelect = root.querySelector(HISTORICAL_FILTER_SELECTORS.market);

  const sectorSelect = root.querySelector(HISTORICAL_FILTER_SELECTORS.sector);

  const entitySelect = root.querySelector(HISTORICAL_FILTER_SELECTORS.entity);

  const tradeTypeSelect = root.querySelector(
    HISTORICAL_FILTER_SELECTORS.tradeType,
  );

  const dateStartInput = root.querySelector(
    HISTORICAL_FILTER_SELECTORS.dateStart,
  );

  const dateEndInput = root.querySelector(HISTORICAL_FILTER_SELECTORS.dateEnd);

  /* ========================================================================
     Internal State
     ======================================================================== */

  const requestManager = createDependencyRequestManager(root);

  const listeners = new Set();

  let destroyed = false;

  let cascadeVersion = 0;

  let suppressRawNotifications = 0;

  let settling = false;

  /* ========================================================================
     Settled-State Notifications
     ======================================================================== */

  function getRawState() {
    return rawFilters.getState();
  }

  function getFilters() {
    return getHistoricalFilters(getRawState());
  }

  function publish(change) {
    if (destroyed) {
      return;
    }

    const event = Object.freeze({
      ...change,

      state: getRawState(),
    });

    listeners.forEach((listener) => {
      listener(event);
    });
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Historical filter listener must be a function.");
    }

    if (destroyed) {
      return () => {};
    }

    listeners.add(listener);

    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  /*
   * historical.js currently consumes filterView.filters.subscribe().
   *
   * Expose a settled-state facade rather than the raw createDataFilters
   * subscription. That prevents the page coordinator from rendering between
   * Market -> Sector -> Entity dependency steps.
   */
  const settledFilters = Object.freeze({
    getState: getRawState,

    getValue(key) {
      return rawFilters.getValue(key);
    },

    subscribe,
  });

  /* ========================================================================
     Cascade Lifecycle
     ======================================================================== */

  function beginCascade() {
    cascadeVersion += 1;

    settling = true;

    requestManager.abortAll();

    return cascadeVersion;
  }

  function isCurrentCascade(version) {
    return !destroyed && version === cascadeVersion;
  }

  function finishCascade(version) {
    if (isCurrentCascade(version)) {
      settling = false;
    }
  }

  /* ========================================================================
     Initial Native State
     ======================================================================== */

  function syncInitialDependencyState() {
    const market = normalizeHistoricalMarket(marketSelect?.value);

    const invalidMarket = !market || market === DEFAULT_MARKET;

    const sectorNotApplicable =
      config.constants.marketsWithoutSector.includes(market);

    setSelectDisabled(sectorSelect, invalidMarket || sectorNotApplicable);

    if (invalidMarket) {
      setSelectDisabled(entitySelect, true);
    }
  }

  syncInitialDependencyState();

  /* ========================================================================
     Market Cascade
     ======================================================================== */

  async function settleMarketChange(sourceEvent) {
    const version = beginCascade();

    const market = normalizeHistoricalMarket(sourceEvent.value);

    /*
     * Never allow the page to keep an Entity/Sector from the previous Market
     * while new dependency data is in flight.
     */
    clearDropdown({
      select: sectorSelect,

      placeholderLabel: config.labels.placeholders.sector,
    });

    clearDropdown({
      select: entitySelect,

      placeholderLabel: config.labels.placeholders.entity,
    });

    rawFilters.sync();

    const invalidMarket = !market || market === DEFAULT_MARKET;

    if (invalidMarket) {
      setSelectDisabled(sectorSelect, true);

      setSelectDisabled(entitySelect, true);

      rawFilters.sync();

      if (isCurrentCascade(version)) {
        publish({
          ...sourceEvent,

          value: market,
        });
      }

      finishCascade(version);

      return;
    }

    const sectorNotApplicable =
      config.constants.marketsWithoutSector.includes(market);

    /*
     * Lock dependent controls while their option sets are changing.
     */
    setSelectDisabled(sectorSelect, true);

    setSelectDisabled(entitySelect, true);

    /*
     * Legacy Market dependency populated Sector and Entity from Market in the
     * same dependency step. Preserve that behavior:
     *
     * - Sector options use selectedMarket
     * - Entity options use selectedMarket + selectedSector=0
     */
    const sectorPromise = sectorNotApplicable
      ? Promise.resolve({
          status: "ok",

          items: [],
        })
      : requestManager.request(
          "sector",

          config.endpoints.sectors,

          {
            selectedMarket: market,
          },
        );

    const entityPromise = requestManager.request(
      "entity",

      config.endpoints.entities,

      {
        selectedMarket: market,

        selectedSector: DEFAULT_SECTOR,
      },
    );

    const [sectorResult, entityResult] = await Promise.all([
      sectorPromise,
      entityPromise,
    ]);

    if (!isCurrentCascade(version)) {
      return;
    }

    if (sectorResult.status === "ok") {
      applyDropdownOptions({
        select: sectorSelect,

        placeholderLabel: config.labels.placeholders.sector,

        items: sectorResult.items,

        getValue: (item) => item.dropdownValue,

        getLabel: (item) => item.name,

        selectedValue: DEFAULT_SECTOR,
      });
    } else {
      logDependencyError("sector", sectorResult);
    }

    if (entityResult.status === "ok") {
      applyDropdownOptions({
        select: entitySelect,

        placeholderLabel: config.labels.placeholders.entity,

        items: entityResult.items,

        getValue: (item) => item.entitySymbol,

        getLabel: (item) => item.entityName,

        selectedValue: DEFAULT_ENTITY,
      });
    } else {
      logDependencyError("entity", entityResult);
    }

    /*
     * Sector remains unavailable for markets such as ETF / MF / TR.
     */
    setSelectDisabled(sectorSelect, sectorNotApplicable);

    setSelectDisabled(entitySelect, false);

    rawFilters.sync();

    publish({
      ...sourceEvent,

      value: market,
    });

    finishCascade(version);
  }

  /* ========================================================================
     Sector Cascade
     ======================================================================== */

  async function settleSectorChange(sourceEvent) {
    const version = beginCascade();

    const market = normalizeHistoricalMarket(marketSelect?.value);

    const sector = normalizeHistoricalSector(sourceEvent.value);

    clearDropdown({
      select: entitySelect,

      placeholderLabel: config.labels.placeholders.entity,
    });

    rawFilters.sync();

    if (!market || market === DEFAULT_MARKET) {
      setSelectDisabled(entitySelect, true);

      if (isCurrentCascade(version)) {
        publish({
          ...sourceEvent,

          value: sector,
        });
      }

      finishCascade(version);

      return;
    }

    setSelectDisabled(entitySelect, true);

    const entityResult = await requestManager.request(
      "entity",

      config.endpoints.entities,

      {
        selectedMarket: market,

        selectedSector: sector,
      },
    );

    if (!isCurrentCascade(version)) {
      return;
    }

    if (entityResult.status === "ok") {
      applyDropdownOptions({
        select: entitySelect,

        placeholderLabel: config.labels.placeholders.entity,

        items: entityResult.items,

        getValue: (item) => item.entitySymbol,

        getLabel: (item) => item.entityName,

        selectedValue: DEFAULT_ENTITY,
      });
    } else {
      logDependencyError("entity", entityResult);
    }

    setSelectDisabled(entitySelect, false);

    rawFilters.sync();

    publish({
      ...sourceEvent,

      value: sector,
    });

    finishCascade(version);
  }

  /* ========================================================================
     Raw Filter Changes
     ======================================================================== */

  function handleRawFilterChange(event) {
    if (destroyed || suppressRawNotifications > 0) {
      return;
    }

    if (event.key === "market") {
      void settleMarketChange(event);

      return;
    }

    if (event.key === "sector") {
      void settleSectorChange(event);

      return;
    }

    /*
     * Entity / Trade Type / Date / Tab have no async child dependency.
     */
    publish(event);
  }

  const unsubscribeRawFilters = rawFilters.subscribe(handleRawFilterChange);

  /* ========================================================================
     Reset
     ======================================================================== */

  /*
   * Reset preserves Historical's dependency ordering:
   *
   * 1. Market
   * 2. populate/select Sector
   * 3. Sector
   * 4. populate/select Entity
   * 5. Entity
   * 6. Trade Type
   * 7. Date range
   *
   * Unlike the previous implementation, this is one transaction. Intermediate
   * native events may update CustomSelect/CustomDate UI, but they are not
   * forwarded to historical.js until the complete Reset has settled.
   */
  async function resetToDefaults() {
    if (destroyed) {
      return null;
    }

    const previousState = getRawState();

    const version = beginCascade();

    const { market, sector, entity, tradeType } = config.defaults;

    suppressRawNotifications += 1;

    try {
      /* --------------------------------------------------------------------
         1. Market
         -------------------------------------------------------------------- */

      setNativeValueAndNotify(marketSelect, market);

      rawFilters.sync();

      const sectorNotApplicable =
        config.constants.marketsWithoutSector.includes(market);

      /* --------------------------------------------------------------------
         2. Populate / select Sector
         -------------------------------------------------------------------- */

      clearDropdown({
        select: sectorSelect,

        placeholderLabel: config.labels.placeholders.sector,
      });

      setSelectDisabled(sectorSelect, true);

      let resolvedSector = DEFAULT_SECTOR;

      if (!sectorNotApplicable) {
        const sectorResult = await requestManager.request(
          "sector",

          config.endpoints.sectors,

          {
            selectedMarket: market,
          },
        );

        if (!isCurrentCascade(version)) {
          return null;
        }

        if (sectorResult.status === "ok") {
          resolvedSector = applyDropdownOptions({
            select: sectorSelect,

            placeholderLabel: config.labels.placeholders.sector,

            items: sectorResult.items,

            getValue: (item) => item.dropdownValue,

            getLabel: (item) => item.name,

            selectedValue: sector,
          });
        } else {
          logDependencyError("sector", sectorResult);
        }

        setSelectDisabled(sectorSelect, false);
      } else {
        resolvedSector = DEFAULT_SECTOR;

        setSelectDisabled(sectorSelect, true);
      }

      rawFilters.sync();

      /* --------------------------------------------------------------------
         3 / 4. Sector -> populate/select Entity
         -------------------------------------------------------------------- */

      clearDropdown({
        select: entitySelect,

        placeholderLabel: config.labels.placeholders.entity,
      });

      setSelectDisabled(entitySelect, true);

      const entityResult = await requestManager.request(
        "entity",

        config.endpoints.entities,

        {
          selectedMarket: market,

          selectedSector: resolvedSector,
        },
      );

      if (!isCurrentCascade(version)) {
        return null;
      }

      if (entityResult.status === "ok") {
        applyDropdownOptions({
          select: entitySelect,

          placeholderLabel: config.labels.placeholders.entity,

          items: entityResult.items,

          getValue: (item) => item.entitySymbol,

          getLabel: (item) => item.entityName,

          selectedValue: entity,
        });
      } else {
        logDependencyError("entity", entityResult);
      }

      setSelectDisabled(entitySelect, false);

      rawFilters.sync();

      /* --------------------------------------------------------------------
         5 / 6. Entity is selected by the option rebuild above.
                Restore Trade Type.
         -------------------------------------------------------------------- */

      setNativeValueAndNotify(tradeTypeSelect, tradeType);

      /* --------------------------------------------------------------------
         7. Date range
         -------------------------------------------------------------------- */

      const { start, end } = getOneMonthRange();

      setNativeDateRangeAndNotify(dateStartInput, dateEndInput, start, end);

      /*
       * Sync createDataFilters' internal previous-value snapshots after every
       * transactional DOM mutation before publishing one final Reset event.
       */
      rawFilters.sync();
    } finally {
      suppressRawNotifications = Math.max(0, suppressRawNotifications - 1);
    }

    if (!isCurrentCascade(version)) {
      return null;
    }

    finishCascade(version);

    publish({
      type: "reset",

      key: null,

      value: null,

      previousValue: previousState,

      effect: "reload",

      source: "reset",
    });

    return getFilters();
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    cascadeVersion += 1;

    settling = false;

    requestManager.destroy();

    unsubscribeRawFilters?.();

    listeners.clear();

    rawFilters.destroy();
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    /*
     * Settled facade consumed by historical.js.
     *
     * Do not expose the raw dependency notifications to the page coordinator.
     */
    filters: settledFilters,

    getFilters,

    isSettling() {
      return settling;
    },

    resetToDefaults,

    destroy,
  });
}
