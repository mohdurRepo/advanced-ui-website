/* ==========================================================================
   Dividends Tab
   ========================================================================== */

/*
 * Dividends calendar composition.
 *
 * Responsibilities:
 *
 * - compose Dividends filters, data source, table, and cards
 * - coordinate the Market -> Sector dependency
 * - synchronize Period with custom-date availability
 * - ensure one filter action produces one results request
 * - expose the shared financial-calendar tab lifecycle
 *
 * This module intentionally has no:
 *
 * - response field normalization
 * - table cell markup
 * - card markup
 * - generic tab behavior
 * - generic loading-state implementation
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createFinancialCalendarTab } from "../../shared/create-financial-calendar-tab.js";

import { createFinancialCalendarSectors } from "../../shared/financial-calendar-sectors.js";

import { createDividendsDataSourceDefinition } from "./dividends.data-source.js";

import {
  createDividendsFilterDefinitions,
  DIVIDENDS_FILTER_FIELDS,
  syncDividendsDateControls,
} from "./dividends.filters.js";

import { createDividendsCards } from "./views/dividends.cards.js";

import { createDividendsTable } from "./views/dividends.table.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const TAB_KEY = "dividends";

const SELECTORS = Object.freeze({
  form: "[data-dividends-filters]",

  view: "[data-dividends-view]",

  market: "[data-dividends-market]",

  sector: "[data-dividends-sector]",

  table: "[data-dividends-table]",

  cards: "[data-dividends-cards]",

  resultCount: "[data-dividends-result-count]",

  status: "[data-dividends-status]",
});

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function getChangedFields(detail = {}) {
  return Array.isArray(detail.changedFields) ? detail.changedFields : [];
}

function didFieldChange(detail, fieldName) {
  if (normalizeString(detail?.key) === fieldName) {
    return true;
  }

  if (getChangedFields(detail).includes(fieldName)) {
    return true;
  }

  const previousState = detail?.previousState;

  const nextState = detail?.state;

  if (!isObject(previousState) || !isObject(nextState)) {
    return false;
  }

  return previousState[fieldName] !== nextState[fieldName];
}

function getInitialSectorValue(root, filterState = {}) {
  const currentValue = normalizeString(filterState.sector);

  if (currentValue) {
    return currentValue;
  }

  const sectorElement = root.querySelector(SELECTORS.sector);

  return normalizeString(sectorElement?.dataset.initialValue);
}

function setSectorValue(filters, value) {
  const normalizedValue = normalizeString(value);

  const settings = {
    notify: false,

    notifyChange: false,

    source: "sector-dependency",
  };

  if (typeof filters.setSectorValue === "function") {
    filters.setSectorValue(normalizedValue, settings);
  } else {
    filters.setValue?.(
      DIVIDENDS_FILTER_FIELDS.sector,
      normalizedValue,
      settings,
    );
  }

  filters.sync?.();

  return normalizedValue;
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createDividendsTab(options = {}) {
  if (!isObject(options)) {
    throw new TypeError("createDividendsTab requires an options object.");
  }

  const root = options.root;

  if (!root || typeof root.querySelector !== "function") {
    throw new Error("Dividends tab requires a valid root element.");
  }

  const existing = instances.get(root);

  if (existing) {
    return existing;
  }

  const config = options.config;

  if (!isObject(config)) {
    throw new TypeError("Dividends tab requires page configuration.");
  }

  /* ========================================================================
     Definitions
     ======================================================================== */

  const filterDefinitions = createDividendsFilterDefinitions(config);

  const dataSourceDefinition = createDividendsDataSourceDefinition(config);

  const tableDefinition = createDividendsTable(config);

  const cardsDefinition = createDividendsCards(config);

  if (
    tableDefinition.initialView &&
    cardsDefinition.key &&
    tableDefinition.initialView !== cardsDefinition.key
  ) {
    throw new Error("Dividends table and cards must expose the same view key.");
  }

  /* ========================================================================
     Sector Dependency
     ======================================================================== */

  const sectors = createFinancialCalendarSectors({
    root,

    config,

    market: SELECTORS.market,

    sector: SELECTORS.sector,
  });

  let destroyed = false;

  async function loadSectors({
    market,
    selectedValue,
    filters,
    isCurrent = () => !destroyed,
  }) {
    try {
      const result = await sectors.load(market, {
        selectedValue,
      });

      if (destroyed || !isCurrent() || result?.stale) {
        return null;
      }

      setSectorValue(filters, result?.selectedValue || "");

      return result;
    } catch (error) {
      if (destroyed || !isCurrent() || isAbortError(error)) {
        return null;
      }

      /*
       * A Sector-option failure must not block Market-level Dividends data.
       * Continue safely with the All Sectors value.
       */

      setSectorValue(filters, "");

      return Object.freeze({
        rows: Object.freeze([]),

        selectedValue: "",

        failed: true,

        error,
      });
    }
  }

  /* ========================================================================
     Initial Dependency Preparation
     ======================================================================== */

  async function prepareInitialLoad(context) {
    const filterState = context.filters || {};

    syncDividendsDateControls(root, filterState.period);

    return loadSectors({
      market: filterState.market,

      selectedValue: getInitialSectorValue(root, filterState),

      filters: context.filtersInstance,

      isCurrent() {
        return !destroyed;
      },
    });
  }

  /* ========================================================================
     Filter Coordination
     ======================================================================== */

  async function handleFilterChange(detail, context) {
    const filterState = detail.state || context.filters || {};

    const marketChanged = didFieldChange(
      detail,
      DIVIDENDS_FILTER_FIELDS.market,
    );

    const periodChanged = didFieldChange(
      detail,
      DIVIDENDS_FILTER_FIELDS.period,
    );

    if (periodChanged || detail.type === "reset") {
      syncDividendsDateControls(root, filterState.period);
    }

    if (marketChanged) {
      const sectorResult = await loadSectors({
        market: filterState.market,

        /*
         * A Market change always resets the dependent Sector to All.
         */

        selectedValue: "",

        filters: context.filtersInstance,

        isCurrent: context.isCurrent,
      });

      if (!context.isCurrent() || sectorResult === null) {
        return null;
      }
    }

    if (!context.isCurrent()) {
      return null;
    }

    /*
     * This is the only Dividends results reload for the current filter action.
     */

    return context.reload();
  }

  /* ========================================================================
     Shared Tab Composition
     ======================================================================== */

  let tab;

  try {
    tab = createFinancialCalendarTab({
      root,

      config,

      key: TAB_KEY,

      selectors: SELECTORS,

      filters: filterDefinitions,

      ...dataSourceDefinition,

      initialView: tableDefinition.initialView || TAB_KEY,

      headerMode: "existing",

      getColumns: tableDefinition.getColumns,

      getColumnGroups: tableDefinition.getColumnGroups,

      renderCell: tableDefinition.renderCell,

      tableOptions: tableDefinition.tableOptions,

      renderCard: cardsDefinition.renderCard,

      cardOptions: cardsDefinition.cardOptions,

      prepareInitialLoad,

      handleFilterChange,

      reloadOnActivate: options.reloadOnActivate !== false,

      autoInit: options.autoInit,

      active: options.active,

      onInit(context) {
        syncDividendsDateControls(root, context.filters.period);

        options.onInit?.(context);
      },

      onActivate(context) {
        syncDividendsDateControls(root, context.filters.period);

        options.onActivate?.(context);
      },

      onDeactivate(context) {
        options.onDeactivate?.(context);
      },

      onDestroy() {
        destroyed = true;

        sectors.destroy();

        instances.delete(root);

        options.onDestroy?.();
      },
    });
  } catch (error) {
    destroyed = true;

    sectors.destroy();

    throw error;
  }

  instances.set(root, tab);

  return tab;
}
