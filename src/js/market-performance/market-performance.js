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

const TAB_CHANGE_EVENT = "tabs:change";

const SELECTORS = Object.freeze({
  root: "[data-market-performance]",
  tabs: "[data-market-performance-tabs]",
  activeTab: '[role="tab"][data-market-performance-mode][aria-selected="true"]',
  feature: "[data-market-performance-feature]",
  view: "[data-market-performance-view]",
  table: "[data-market-performance-table]",
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

function isGainersLosersReport(reportFilter, config) {
  return (
    reportFilter === config.request.report.gainersLosersValue ||
    reportFilter === config.request.report.gainersLosersPercent
  );
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

function createModeFeature({ root, mode, config }) {
  if (!root) {
    throw new Error(`[Market Performance] Missing feature root for "${mode}".`);
  }

  const viewElement = root.querySelector(SELECTORS.view);
  const tableDefinition = createMarketPerformanceTable(config);
  const cardsDefinition = createMarketPerformanceCards(config);

  const state = createDataState({
    active: false,
    loading: false,
    rows: [],
    error: null,
  });

  const table = createDataTable({
    root,
    table: SELECTORS.table,
    headerMode: "existing",

    getColumns() {
      return tableDefinition.getColumns();
    },

    renderCell(context) {
      return tableDefinition.renderCell(context);
    },

    getRowGroup(row) {
      return tableDefinition.getRowGroup(row);
    },

    renderRowGroupStart(context) {
      return tableDefinition.renderRowGroupStart(context);
    },

    tableOptions: tableDefinition.tableOptions,
    loadingRowCount: 6,
    emptyMessage: config.labels.noData,
    errorMessage: config.labels.error,
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

  function syncBusyState(loading) {
    const value = String(Boolean(loading));

    root.setAttribute("aria-busy", value);
    viewElement?.setAttribute("aria-busy", value);
  }

  function cancelRequests() {
    activeSource.cancel();
    gainersSource.cancel();
    losersSource.cancel();
  }

  function renderLoading() {
    syncBusyState(true);
    table.showLoading();
    cards.showLoading();
    results.showLoading();
  }

  function renderRows(rows) {
    const normalizedRows = normalizeRows(rows);

    syncBusyState(false);

    if (!normalizedRows.length) {
      table.showEmpty(config.labels.noData);
      cards.showEmpty(config.labels.noData);
      results.showEmpty(config.labels.noData);
      return;
    }

    table.setRows(normalizedRows);
    cards.setRows(normalizedRows);
    results.showReady(normalizedRows.length);
    table.adjust();
  }

  function renderError(message) {
    syncBusyState(false);
    table.showError(message);
    cards.showError(message);
    results.showError(message);
  }

  async function loadActive(filters) {
    const response = await activeSource.load(filters);
    return normalizeRows(response?.rows);
  }

  async function loadGainersLosers(filters) {
    const [gainersResponse, losersResponse] = await Promise.all([
      gainersSource.load(filters),
      losersSource.load(filters),
    ]);

    return [
      ...normalizeRows(gainersResponse?.rows),
      ...normalizeRows(losersResponse?.rows),
    ];
  }

  async function reload(filters) {
    if (destroyed) {
      return null;
    }

    const currentLoadId = ++loadId;
    const currentFilters = { ...filters };

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

    renderLoading();

    try {
      const rows = isGainersLosersReport(currentFilters.reportFilter, config)
        ? await loadGainersLosers(currentFilters)
        : await loadActive(currentFilters);

      if (destroyed || currentLoadId !== loadId) {
        return null;
      }

      hasLoaded = true;
      dirty = false;

      renderRows(rows);

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

      renderError(message);

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

    table.adjust();

    if (!hasLoaded || dirty) {
      return reload(filters);
    }

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
    if (destroyed) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (!destroyed) {
        table.adjust();
      }
    });
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

    table.destroy();
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

function getEventMode(event, tabs) {
  const detail = event?.detail || {};

  const candidates = [
    detail.tab?.dataset?.marketPerformanceMode,
    detail.panel?.querySelector?.(SELECTORS.feature)?.dataset
      ?.marketPerformanceFeature,
    detail.tabKey,
    detail.targetId,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? "");

    if (
      value === MODES.adjusted ||
      (value.includes("adjusted") && !value.includes("non-adjusted"))
    ) {
      return MODES.adjusted;
    }

    if (value === MODES.nonAdjusted || value.includes("non-adjusted")) {
      return MODES.nonAdjusted;
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

      features.forEach((feature) => feature.markDirty());

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

    if (mode === activeMode) {
      const feature = features.get(mode);

      if (feature?.isActive()) {
        feature.adjust();
        return Promise.resolve(feature);
      }
    }

    const previousFeature = features.get(activeMode);

    if (previousFeature && activeMode !== mode) {
      previousFeature.deactivate();
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

      features.forEach((feature) => feature.destroy());
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
