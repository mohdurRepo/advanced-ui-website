import {
  bindStandardCompanyLogoFallback,
  createDataCards,
  createDataResults,
  createDataSource,
  createDataState,
  createDataTable,
} from "../../common/data-view/index.js";

import { getMarketPerformanceConfig } from "./market-performance-config.js";
import { createMarketPerformanceFilters } from "./market-performance.filters.js";
import {
  MARKET_PERFORMANCE_GROUP,
  normalizeMarketPerformanceResponse,
} from "./market-performance.normalizer.js";
import { createMarketPerformanceTable } from "./views/market-performance.table.js";
import { createMarketPerformanceCards } from "./views/market-performance.cards.js";

const MODES = Object.freeze({
  adjusted: "adjusted",
  nonAdjusted: "non-adjusted",
});

const REPORT_VIEWS = Object.freeze({
  active: "active",
  split: "split",
});

const TAB_CHANGE_EVENT = "tabs:change";

const SELECTORS = Object.freeze({
  root: "[data-market-performance]",
  tabs: "[data-market-performance-tabs]",
  activeTab: '[role="tab"][data-market-performance-mode][aria-selected="true"]',
  feature: "[data-market-performance-feature]",
  view: "[data-market-performance-view]",

  activeRegion: "[data-market-performance-active-region]",
  splitRegion: "[data-market-performance-split-region]",

  activeTable: '[data-market-performance-table="active"]',
  gainersTable: '[data-market-performance-table="gainers"]',
  losersTable: '[data-market-performance-table="losers"]',

  cards: "[data-market-performance-cards]",
  resultCount: "[data-market-performance-result-count]",
  status: "[data-market-performance-status]",
});

const instances = new WeakMap();

function isAbortError(error) {
  return error?.name === "AbortError";
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function getErrorMessage(error, config) {
  return (
    String(error?.response?.message ?? "").trim() ||
    String(error?.message ?? "").trim() ||
    config.labels.error ||
    "Unable to load data."
  );
}

function getModeRequestValue(mode, config) {
  return mode === MODES.nonAdjusted
    ? config.request.nonAdjusted
    : config.request.adjusted;
}

function isSplitReport(reportFilter, config) {
  return (
    reportFilter === config.request.report.gainersLosersValue ||
    reportFilter === config.request.report.gainersLosersPercent
  );
}

function getReportView(reportFilter, config) {
  return isSplitReport(reportFilter, config)
    ? REPORT_VIEWS.split
    : REPORT_VIEWS.active;
}

function buildRequestData(filters, mode, config) {
  return {
    reportFilter: filters.reportFilter,
    sectorFilter: filters.sectorFilter,
    timeFrameFilter: filters.timeFrameFilter,
    isNonAdjusted: getModeRequestValue(mode, config),
    requestLocale: config.locale,
  };
}

function createSource({ endpoint, group, mode, config }) {
  return createDataSource({
    endpoint,
    method: "GET",

    buildRequestData(filters = {}) {
      return buildRequestData(filters, mode, config);
    },

    normalizeResponse(response) {
      const rows = normalizeMarketPerformanceResponse(response, group);

      return {
        rows,
        meta: {
          total: rows.length,
        },
      };
    },
  });
}

function createTable({ root, selector, definition, config }) {
  return createDataTable({
    root,
    table: selector,
    headerMode: "existing",

    getColumns() {
      return definition.getColumns();
    },

    renderCell(context) {
      return definition.renderCell(context);
    },

    tableOptions: definition.tableOptions,
    loadingRowCount: 6,
    emptyMessage: config.labels.noData,
    errorMessage: config.labels.error,
  });
}

function createModeFeature({ root, mode, config }) {
  if (!root) {
    throw new Error(`[Market Performance] Missing feature root for "${mode}".`);
  }

  const viewElement = root.querySelector(SELECTORS.view);
  const activeRegion = root.querySelector(SELECTORS.activeRegion);
  const splitRegion = root.querySelector(SELECTORS.splitRegion);

  if (!viewElement || !activeRegion || !splitRegion) {
    throw new Error(
      `[Market Performance] Incomplete result markup for "${mode}".`,
    );
  }

  const tableDefinition = createMarketPerformanceTable(config);
  const cardsDefinition = createMarketPerformanceCards(config);

  const state = createDataState({
    active: false,
    loading: false,
    rows: [],
    error: null,
  });

  const tables = Object.freeze({
    active: createTable({
      root,
      selector: SELECTORS.activeTable,
      definition: tableDefinition,
      config,
    }),

    gainers: createTable({
      root,
      selector: SELECTORS.gainersTable,
      definition: tableDefinition,
      config,
    }),

    losers: createTable({
      root,
      selector: SELECTORS.losersTable,
      definition: tableDefinition,
      config,
    }),
  });

  const cards = createDataCards({
    root,
    container: SELECTORS.cards,

    renderCard(row, context) {
      return cardsDefinition.renderCard(row, context);
    },

    getGroupKey(row, context) {
      return cardsDefinition.getGroupKey(row, context);
    },

    getGroupLabel(groupKey, rows, context) {
      return cardsDefinition.getGroupLabel(groupKey, rows, context);
    },

    renderGroup(context) {
      return cardsDefinition.renderGroup(context);
    },

    emptyMessage: config.labels.noData,
    errorMessage: config.labels.error,
  });

  const results = createDataResults({
    root,
    count: SELECTORS.resultCount,
    status: SELECTORS.status,
    initialCount: 0,

    labels: {
      results: "",
      loading: config.labels.loading,
      empty: config.labels.noData,
      error: config.labels.error,
    },
  });

  const activeSource = createSource({
    endpoint: config.endpoints.performance,
    group: MARKET_PERFORMANCE_GROUP.ACTIVE,
    mode,
    config,
  });

  const gainersSource = createSource({
    endpoint: config.endpoints.performance,
    group: MARKET_PERFORMANCE_GROUP.GAINERS,
    mode,
    config,
  });

  const losersSource = createSource({
    endpoint: config.endpoints.losers,
    group: MARKET_PERFORMANCE_GROUP.LOSERS,
    mode,
    config,
  });

  let active = false;
  let dirty = true;
  let hasLoaded = false;
  let destroyed = false;
  let loadId = 0;
  let currentReportView = REPORT_VIEWS.active;

  function syncBusyState(loading) {
    const value = String(Boolean(loading));

    root.setAttribute("aria-busy", value);
    viewElement.setAttribute("aria-busy", value);
  }

  function cancelRequests() {
    activeSource.cancel();
    gainersSource.cancel();
    losersSource.cancel();
  }

  function showReportView(reportView) {
    currentReportView = reportView;

    const split = reportView === REPORT_VIEWS.split;

    activeRegion.hidden = split;
    splitRegion.hidden = !split;
  }

  function adjustActiveTables() {
    window.requestAnimationFrame(() => {
      if (destroyed) {
        return;
      }

      if (currentReportView === REPORT_VIEWS.split) {
        tables.gainers.adjust();
        tables.losers.adjust();
      } else {
        tables.active.adjust();
      }
    });
  }

  function renderLoading(reportView) {
    syncBusyState(true);
    showReportView(reportView);
    results.showLoading();
    cards.showLoading();

    if (reportView === REPORT_VIEWS.split) {
      tables.gainers.showLoading();
      tables.losers.showLoading();
    } else {
      tables.active.showLoading();
    }

    adjustActiveTables();
  }

  function renderActive(rows) {
    const normalizedRows = normalizeRows(rows);

    syncBusyState(false);
    showReportView(REPORT_VIEWS.active);

    if (!normalizedRows.length) {
      tables.active.showEmpty(config.labels.noData);
      cards.showEmpty(config.labels.noData);
      results.showEmpty(config.labels.noData);
      adjustActiveTables();
      return;
    }

    tables.active.setRows(normalizedRows);
    cards.setRows(normalizedRows);
    results.showReady(normalizedRows.length);

    adjustActiveTables();
  }

  function renderSplit(gainers, losers) {
    const gainersRows = normalizeRows(gainers);
    const losersRows = normalizeRows(losers);
    const allRows = [...gainersRows, ...losersRows];

    syncBusyState(false);
    showReportView(REPORT_VIEWS.split);

    if (gainersRows.length) {
      tables.gainers.setRows(gainersRows);
    } else {
      tables.gainers.showEmpty(config.labels.noData);
    }

    if (losersRows.length) {
      tables.losers.setRows(losersRows);
    } else {
      tables.losers.showEmpty(config.labels.noData);
    }

    if (allRows.length) {
      cards.setRows(allRows);
      results.showReady(allRows.length);
    } else {
      cards.showEmpty(config.labels.noData);
      results.showEmpty(config.labels.noData);
    }

    adjustActiveTables();
  }

  function renderError(reportView, message) {
    syncBusyState(false);
    showReportView(reportView);

    cards.showError(message);
    results.showError(message);

    if (reportView === REPORT_VIEWS.split) {
      tables.gainers.showError(message);
      tables.losers.showError(message);
    } else {
      tables.active.showError(message);
    }

    adjustActiveTables();
  }

  async function loadActive(filters) {
    const response = await activeSource.load(filters);

    return normalizeRows(response?.rows);
  }

  async function loadSplit(filters) {
    const [gainersResponse, losersResponse] = await Promise.all([
      gainersSource.load(filters),
      losersSource.load(filters),
    ]);

    return {
      gainers: normalizeRows(gainersResponse?.rows),
      losers: normalizeRows(losersResponse?.rows),
    };
  }

  async function reload(filters) {
    if (destroyed) {
      return null;
    }

    const currentLoadId = ++loadId;
    const currentFilters = { ...filters };
    const reportView = getReportView(currentFilters.reportFilter, config);

    cancelRequests();

    state.setState(
      {
        loading: true,
        error: null,
      },
      {
        type: "loading",
        source: mode,
      },
    );

    renderLoading(reportView);

    try {
      if (reportView === REPORT_VIEWS.split) {
        const response = await loadSplit(currentFilters);

        if (destroyed || currentLoadId !== loadId) {
          return null;
        }

        const rows = [...response.gainers, ...response.losers];

        hasLoaded = true;
        dirty = false;

        renderSplit(response.gainers, response.losers);

        state.setState(
          {
            loading: false,
            rows,
            error: null,
          },
          {
            type: "loaded",
            source: mode,
          },
        );

        return rows;
      }

      const rows = await loadActive(currentFilters);

      if (destroyed || currentLoadId !== loadId) {
        return null;
      }

      hasLoaded = true;
      dirty = false;

      renderActive(rows);

      state.setState(
        {
          loading: false,
          rows,
          error: null,
        },
        {
          type: "loaded",
          source: mode,
        },
      );

      return rows;
    } catch (error) {
      if (destroyed || currentLoadId !== loadId || isAbortError(error)) {
        return null;
      }

      const message = getErrorMessage(error, config);

      renderError(reportView, message);

      state.setState(
        {
          loading: false,
          rows: [],
          error,
        },
        {
          type: "error",
          source: mode,
        },
      );

      return null;
    }
  }

  function activate(filters) {
    if (destroyed) {
      return Promise.resolve(null);
    }

    active = true;

    state.setState(
      {
        active: true,
      },
      {
        type: "activate",
        source: mode,
      },
    );

    if (!hasLoaded || dirty) {
      return reload(filters);
    }

    adjustActiveTables();

    return Promise.resolve(state.getState().rows || []);
  }

  function deactivate() {
    if (destroyed || !active) {
      return;
    }

    active = false;
    loadId += 1;

    cancelRequests();
    syncBusyState(false);

    state.setState(
      {
        active: false,
        loading: false,
      },
      {
        type: "deactivate",
        source: mode,
      },
    );
  }

  function markDirty() {
    dirty = true;
  }

  function adjust() {
    if (!destroyed) {
      adjustActiveTables();
    }
  }

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;
    active = false;
    loadId += 1;

    cancelRequests();

    activeSource.destroy?.();
    gainersSource.destroy?.();
    losersSource.destroy?.();

    tables.active.destroy();
    tables.gainers.destroy();
    tables.losers.destroy();

    cards.destroy();
    results.destroy();
    state.destroy();

    syncBusyState(false);
  }

  return Object.freeze({
    activate,
    deactivate,
    destroy,
    markDirty,
    reload,
    adjust,

    isActive() {
      return active;
    },

    hasLoaded() {
      return hasLoaded;
    },

    getState() {
      return state.getState();
    },
  });
}

function resolvePageRoot(root) {
  if (root instanceof Element && root.matches(SELECTORS.root)) {
    return root;
  }

  return root?.querySelector?.(SELECTORS.root) || null;
}

function getInitialMode(tabs) {
  const activeTab = tabs.querySelector(SELECTORS.activeTab);

  return activeTab?.dataset.marketPerformanceMode === MODES.nonAdjusted
    ? MODES.nonAdjusted
    : MODES.adjusted;
}

function normalizeMode(value) {
  const normalized = String(value ?? "")
    .replace(/^#/, "")
    .toLowerCase();

  if (normalized.includes("non-adjusted")) {
    return MODES.nonAdjusted;
  }

  if (
    normalized === MODES.adjusted ||
    normalized.includes("panel-adjusted") ||
    normalized.includes("tab-adjusted")
  ) {
    return MODES.adjusted;
  }

  return "";
}

function getEventMode(event, tabs) {
  const detail = event?.detail || {};

  const values = [
    detail.tab?.dataset?.marketPerformanceMode,
    detail.panel?.dataset?.marketPerformanceFeature,
    detail.panel?.querySelector?.(SELECTORS.feature)?.dataset
      ?.marketPerformanceFeature,
    detail.tabKey,
    detail.targetId,
    detail.tab?.getAttribute?.("aria-controls"),
  ];

  for (const value of values) {
    const mode = normalizeMode(value);

    if (mode) {
      return mode;
    }
  }

  return getInitialMode(tabs);
}

export function initMarketPerformance(root = document) {
  const pageRoot = resolvePageRoot(root);

  if (!pageRoot) {
    return null;
  }

  const existing = instances.get(pageRoot);

  if (existing) {
    return existing;
  }

  const config = getMarketPerformanceConfig();
  const tabs = pageRoot.querySelector(SELECTORS.tabs);

  if (!tabs) {
    throw new Error("[Market Performance] Tabs container was not found.");
  }

  const adjustedRoot = pageRoot.querySelector(
    `${SELECTORS.feature}[data-market-performance-feature="${MODES.adjusted}"]`,
  );

  const nonAdjustedRoot = pageRoot.querySelector(
    `${SELECTORS.feature}[data-market-performance-feature="${MODES.nonAdjusted}"]`,
  );

  const features = new Map([
    [
      MODES.adjusted,
      createModeFeature({
        root: adjustedRoot,
        mode: MODES.adjusted,
        config,
      }),
    ],
    [
      MODES.nonAdjusted,
      createModeFeature({
        root: nonAdjustedRoot,
        mode: MODES.nonAdjusted,
        config,
      }),
    ],
  ]);

  const abortController = new AbortController();

  let activeMode = getInitialMode(tabs);
  let destroyed = false;

  const filters = createMarketPerformanceFilters({
    root: pageRoot,
    config,

    onChange(values) {
      if (destroyed) {
        return;
      }

      features.forEach((feature) => {
        feature.markDirty();
      });

      const activeFeature = features.get(activeMode);

      if (activeFeature) {
        void activeFeature.reload(values);
      }
    },
  });

  const unbindLogoFallback = bindStandardCompanyLogoFallback(pageRoot);

  function activateMode(mode) {
    if (destroyed || !features.has(mode)) {
      return Promise.resolve(null);
    }

    const currentFeature = features.get(activeMode);

    if (mode === activeMode && currentFeature?.isActive()) {
      currentFeature.adjust();

      return Promise.resolve(currentFeature);
    }

    if (currentFeature && activeMode !== mode) {
      currentFeature.deactivate();
    }

    activeMode = mode;

    const nextFeature = features.get(activeMode);

    return Promise.resolve(nextFeature.activate(filters.getValues()))
      .then(() => {
        nextFeature.adjust();

        return nextFeature;
      })
      .catch((error) => {
        if (!isAbortError(error)) {
          console.error("[Market Performance]", error);
        }

        return null;
      });
  }

  function handleTabChange(event) {
    if (event.target !== tabs || destroyed) {
      return;
    }

    const mode = getEventMode(event, tabs);

    void activateMode(mode);
  }

  tabs.addEventListener(TAB_CHANGE_EVENT, handleTabChange, {
    signal: abortController.signal,
  });

  const instance = Object.freeze({
    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;

      abortController.abort();
      filters.destroy();
      unbindLogoFallback?.();

      features.forEach((feature) => {
        feature.destroy();
      });

      features.clear();
      instances.delete(pageRoot);
    },

    reload() {
      if (destroyed) {
        return Promise.resolve(null);
      }

      const feature = features.get(activeMode);

      return feature
        ? feature.reload(filters.getValues())
        : Promise.resolve(null);
    },

    getActiveMode() {
      return activeMode;
    },

    getFilters() {
      return filters.getValues();
    },

    getFeature(mode) {
      return features.get(mode) || null;
    },
  });

  instances.set(pageRoot, instance);

  void features.get(activeMode)?.activate(filters.getValues());

  return instance;
}

function start() {
  document.querySelectorAll(SELECTORS.root).forEach((pageRoot) => {
    initMarketPerformance(pageRoot);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
