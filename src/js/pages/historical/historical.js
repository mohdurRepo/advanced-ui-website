/* ==========================================================================
   Historical Reports
   ========================================================================== */

/*
 * Historical Reports page coordinator.
 *
 * No CustomSelect/CustomDate imports or main.js changes needed anywhere in
 * this page. Both components are already initialized globally by main.js
 * (module scripts execute in document order, so main.js's own top-level
 * initApp() call -- and therefore initCustomSelects()/initCustomDates() --
 * completes before this file's own top-level code runs) and this file
 * interacts with them purely through native DOM mutation + dispatched
 * "change" events, the same mechanism every other page's filters already
 * rely on. See the module comment in historical.filters.js for the
 * underlying mechanism.
 *
 * Unlike Market Watch, this page does NOT use createDataViewController.
 * That controller assumes one dataset fanning to one table + one card
 * view. Historical has three independent table/card pairs (Performance,
 * Unadjusted, Underlying) plus a profile-selection layer choosing which
 * one is active -- a genuinely different shape, so this file runs its own
 * small coordinator instead, mirroring legacy's HistoricalTableEngine +
 * HistoricalManager but built on the shared common/data-view primitives.
 *
 * Legacy behavior preserved deliberately: every filter or tab change
 * destroys whichever report table instance is currently live and creates
 * a fresh one for the resolved profile -- this always resets pagination to
 * page one, which is legacy's actual behavior today (traced through
 * rebuildTables() -> destroyAllTables() + reloadTables()), not an
 * oversight in this port.
 *
 * One deliberate deviation from a literal port: legacy's own
 * HistoricalManager.activateTab() only updates the tab BUTTON's attributes
 * and bypasses tabs.controller.js entirely -- ported literally, this would
 * leave the button and panel out of sync when forced. This uses
 * tab.click() instead, which drives the real tabs component correctly.
 * Termination is safe: forcing the tab re-fires tabs:change, which
 * re-resolves rules with the corrected activeTab, and the force-condition
 * no longer holds on that second pass.
 *
 * Filter-change notifications are coalesced via a microtask: because
 * setting a value now always dispatches a real "change" event (there is no
 * instance-level {emit:false} available without class access -- see
 * historical.filters.js), a single Reset click or a Market-driven
 * Sector/Entity reset can produce several synchronous notifications in a
 * row. scheduleResolveAndRender() below collapses any number of
 * same-tick notifications into exactly one resolveAndRender() call, always
 * reading the final settled state rather than an intermediate one.
 *
 * Not yet wired: the .feed__pagination range/page-select/prev-next UI has
 * no equivalent module yet (data-pagination.js). getApi() is exposed on
 * both table view instances so that module has something to bind against
 * once built; this file does not attempt a partial implementation of it.
 */

import {
  createDataCards,
  createDataTable,
  createDataFilters,
  renderStandardDataCard,
} from "../../common/data-view/index.js";

import { getHistoricalConfig } from "./historical.config.js";
import { resolveHistoricalRules } from "./historical.rules.js";

import {
  createHistoricalFilters,
  applyDefaultHistoricalDateRangeIfEmpty,
} from "./historical.filters.js";

import { createHistoricalTableView } from "./views/historical.table.js";
import { createHistoricalUnderlyingTableView } from "./views/historical.underlying.js";

import {
  createHistoricalReportCardsView,
  createHistoricalUnderlyingCardsView,
} from "./views/historical.cards.js";

/* ==========================================================================
   Selectors
   ========================================================================== */

const SELECTORS = Object.freeze({
  tabsRoot: ".tabs[data-tabs]",
  tabButton: '[role="tab"][data-tab]',

  unadjustedTabButton: '[data-tab="unadjusted"]',
  unadjustedPanel: "#historical-panel-unadjusted",

  tradeTypeFilterField: "#tradeTypeFilter",
  tradeTypeSelect: "[data-historical-trade-type]",

  performanceTable: '[data-historical-table="performance"]',
  unadjustedTable: '[data-historical-table="unadjusted"]',
  underlyingTable: '[data-historical-table="underlying"]',

  underlyingSection: "#historical-underlying-section",

  performanceCards: '[data-historical-mobile-cards="performance"]',
  unadjustedCards: '[data-historical-mobile-cards="unadjusted"]',
  underlyingCards: '[data-historical-mobile-cards="underlying"]',

  filterMessage: "#historicalFilterMessage",

  emptyState: "#historical-empty-state",
  emptyImage: "#historical-empty-image",
  placeholderMessage: "#historical-placeholder-message",

  note: "#historical-note",
  noteText: "#historical-note-text",
  noteDerivatives: "#historical-note-derivatives",
  noteDerivativesText: "#historical-note-derivatives-text",

  pagination: "[data-historical-pagination]",

  resetButton: "[data-historical-reset]",
});

/* ==========================================================================
   Instances
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   Notes
   ========================================================================== */

function hideNotes(dom) {
  dom.note.hidden = true;
  dom.noteText.innerHTML = "";
  dom.noteDerivatives.hidden = true;
  dom.noteDerivativesText.innerHTML = "";
}

function applyNote(dom, note) {
  hideNotes(dom);

  if (!note || !note.visible || !note.message) {
    return;
  }

  if (note.target === "derivatives") {
    dom.noteDerivatives.hidden = false;
    dom.noteDerivativesText.innerHTML = note.message;

    return;
  }

  dom.note.hidden = false;
  dom.noteText.innerHTML = note.message;
}

/* ==========================================================================
   Placeholder / Valid State
   ========================================================================== */

function showPlaceholder(dom, message, { showImage = false } = {}) {
  dom.filterMessage.hidden = true;

  dom.placeholderMessage.textContent = message || "";
  dom.emptyImage.hidden = !showImage;
  dom.emptyState.hidden = false;

  dom.tabsRoot.hidden = true;
  dom.underlyingSection.hidden = true;
  dom.pagination.hidden = true;

  hideNotes(dom);
}

function showValidState(dom) {
  dom.filterMessage.hidden = true;
  dom.emptyState.hidden = true;
  dom.pagination.hidden = false;
}

/* ==========================================================================
   Trade Type Field Visibility
   ========================================================================== */

/*
 * Setting .value + dispatching "change" here (rather than any class-based
 * setValue()) is consistent with everything else in this file -- see
 * historical.filters.js's module comment for why that is sufficient.
 */

function applyTradeTypeVisibility(dom, rules) {
  dom.tradeTypeFilterField.hidden = !rules.showTradeType;

  if (rules.showTradeType) {
    return;
  }

  const tradeTypeSelect = dom.tradeTypeFilterField.querySelector(
    SELECTORS.tradeTypeSelect,
  );

  if (tradeTypeSelect && tradeTypeSelect.value !== "OB") {
    tradeTypeSelect.value = "OB";
    tradeTypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

/* ==========================================================================
   Unadjusted Tab Visibility
   ========================================================================== */

function applyUnadjustedTabVisibility(dom, rules) {
  const visible = rules.showUnadjustedTab;

  dom.unadjustedTabButton.hidden = !visible;
  dom.unadjustedTabButton.classList.toggle("is-disabled", !visible);
  dom.unadjustedTabButton.setAttribute("aria-disabled", String(!visible));

  dom.unadjustedPanel.hidden = !visible ? true : dom.unadjustedPanel.hidden;
}

/* ==========================================================================
   Tab Forcing
   ========================================================================== */

function activateTabByKey(dom, key) {
  const tab = dom.tabsRoot.querySelector(`[data-tab="${key}"]`);

  tab?.click();
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function initHistorical(root = document) {
  const scope = root;

  const existing = instances.get(scope);

  if (existing) {
    return existing;
  }

  /* ------------------------------------------------------------------------
     DOM
     ------------------------------------------------------------------------ */

  const dom = {
    tabsRoot: scope.querySelector(SELECTORS.tabsRoot),
    unadjustedTabButton: scope.querySelector(SELECTORS.unadjustedTabButton),
    unadjustedPanel: scope.querySelector(SELECTORS.unadjustedPanel),

    tradeTypeFilterField: scope.querySelector(SELECTORS.tradeTypeFilterField),

    underlyingSection: scope.querySelector(SELECTORS.underlyingSection),

    filterMessage: scope.querySelector(SELECTORS.filterMessage),

    emptyState: scope.querySelector(SELECTORS.emptyState),
    emptyImage: scope.querySelector(SELECTORS.emptyImage),
    placeholderMessage: scope.querySelector(SELECTORS.placeholderMessage),

    note: scope.querySelector(SELECTORS.note),
    noteText: scope.querySelector(SELECTORS.noteText),
    noteDerivatives: scope.querySelector(SELECTORS.noteDerivatives),
    noteDerivativesText: scope.querySelector(SELECTORS.noteDerivativesText),

    pagination: scope.querySelector(SELECTORS.pagination),

    resetButton: scope.querySelector(SELECTORS.resetButton),
  };

  /* ------------------------------------------------------------------------
     Configuration
     ------------------------------------------------------------------------ */

  const config = getHistoricalConfig();

  /* ------------------------------------------------------------------------
     Date Range Default
     ------------------------------------------------------------------------ */

  applyDefaultHistoricalDateRangeIfEmpty(scope);

  /* ------------------------------------------------------------------------
     Filters
     ------------------------------------------------------------------------ */

  const filterView = createHistoricalFilters({
    root: scope,
    config,
    createDataFilters,
  });

  /* ------------------------------------------------------------------------
     Cards
     ------------------------------------------------------------------------ */

  const performanceCards = createHistoricalReportCardsView({
    root: scope,
    config,
    createDataCards,
    renderStandardDataCard,
    view: "performance",
    container: SELECTORS.performanceCards,
    getFilters: filterView.getFilters,
  });

  const unadjustedCards = createHistoricalReportCardsView({
    root: scope,
    config,
    createDataCards,
    renderStandardDataCard,
    view: "unadjusted",
    container: SELECTORS.unadjustedCards,
    getFilters: filterView.getFilters,
  });

  const underlyingCards = createHistoricalUnderlyingCardsView({
    root: scope,
    config,
    createDataCards,
    renderStandardDataCard,
    container: SELECTORS.underlyingCards,
  });

  /* ------------------------------------------------------------------------
     Report Table Engine
     ------------------------------------------------------------------------ */

  let activeReportTable = null;
  let activeUnderlyingTable = null;

  function destroyActiveReportTable() {
    activeReportTable?.destroy();
    activeReportTable = null;
  }

  function destroyActiveUnderlyingTable() {
    activeUnderlyingTable?.destroy();
    activeUnderlyingTable = null;
  }

  function activateReportTable(view) {
    destroyActiveReportTable();

    const tableSelector =
      view === "unadjusted"
        ? SELECTORS.unadjustedTable
        : SELECTORS.performanceTable;

    const cards = view === "unadjusted" ? unadjustedCards : performanceCards;

    activeReportTable = createHistoricalTableView({
      root: scope,
      config,
      createDataTable,
      table: tableSelector,
      initialView: view,
      getFilters: filterView.getFilters,

      onServerSideData(rows) {
        cards.setRows(rows);
      },

      onServerSideError(message) {
        cards.showError(message);
      },
    });
  }

  function activateUnderlyingTable() {
    destroyActiveUnderlyingTable();

    activeUnderlyingTable = createHistoricalUnderlyingTableView({
      root: scope,
      config,
      createDataTable,
      table: SELECTORS.underlyingTable,
      getFilters: filterView.getFilters,
    });

    underlyingCards.showLoading();

    activeUnderlyingTable.load().then(() => {
      underlyingCards.setRows(activeUnderlyingTable.getRows());
    });
  }

  /* ------------------------------------------------------------------------
     Resolve and Render
     ------------------------------------------------------------------------ */

  function resolveAndRender() {
    const filters = filterView.getFilters();
    const rules = resolveHistoricalRules(filters, config);

    applyTradeTypeVisibility(dom, rules);
    applyUnadjustedTabVisibility(dom, rules);

    if (!rules.showUnadjustedTab && filters.activeTab === "unadjusted") {
      activateTabByKey(dom, "performance");

      return;
    }

    if (!rules.ready) {
      showPlaceholder(dom, rules.message, { showImage: false });

      destroyActiveReportTable();
      destroyActiveUnderlyingTable();

      return;
    }

    if (rules.profileType === "none") {
      showPlaceholder(dom, rules.note?.message || rules.message, {
        showImage: true,
      });

      destroyActiveReportTable();
      destroyActiveUnderlyingTable();

      return;
    }

    showValidState(dom);
    applyNote(dom, rules.note);

    if (rules.profileType === "derivativesUnderlying") {
      dom.tabsRoot.hidden = true;
      dom.underlyingSection.hidden = false;

      destroyActiveReportTable();
      activateUnderlyingTable();

      return;
    }

    dom.tabsRoot.hidden = false;
    dom.underlyingSection.hidden = true;

    destroyActiveUnderlyingTable();
    activateReportTable(rules.profileType);
  }

  /* ------------------------------------------------------------------------
     Coalesced Scheduling

     Setting a native value now always dispatches a real "change" event, so
     several fields changing together (Reset, or Market's Sector/Entity
     cascade) can notify synchronously, back to back, within one tick. This
     collapses any number of same-tick notifications into exactly one
     resolveAndRender() call, deferred to the next microtask so it always
     reads the final settled state rather than an intermediate one.
     ------------------------------------------------------------------------ */

  let renderScheduled = false;

  function scheduleResolveAndRender() {
    if (renderScheduled) {
      return;
    }

    renderScheduled = true;

    queueMicrotask(() => {
      renderScheduled = false;

      resolveAndRender();
    });
  }

  /* ------------------------------------------------------------------------
     Events
     ------------------------------------------------------------------------ */

  filterView.filters.subscribe(() => {
    scheduleResolveAndRender();
  });

  dom.resetButton?.addEventListener("click", async () => {
    await filterView.resetToDefaults();
    activateTabByKey(dom, "performance");

    /*
     * Explicit and immediate rather than scheduled: this guarantees one
     * final, correct render reflecting the fully-settled reset state,
     * regardless of how many coalesced or uncoalesced renders happened
     * along the way (async sector/entity repopulation means some of
     * resetToDefaults()'s own notifications land in later ticks than
     * others, so they cannot all be coalesced into a single microtask).
     */
    resolveAndRender();
  });

  /* ------------------------------------------------------------------------
     Initialization
     ------------------------------------------------------------------------ */

  resolveAndRender();

  /* ------------------------------------------------------------------------
     Public Instance
     ------------------------------------------------------------------------ */

  const instance = Object.freeze({
    destroy() {
      destroyActiveReportTable();
      destroyActiveUnderlyingTable();

      performanceCards.destroy();
      unadjustedCards.destroy();
      underlyingCards.destroy();

      filterView.destroy();

      instances.delete(scope);
    },

    getFilters() {
      return filterView.getFilters();
    },

    getReportTableApi() {
      return activeReportTable?.getApi() ?? null;
    },

    getUnderlyingTableApi() {
      return activeUnderlyingTable?.getApi() ?? null;
    },
  });

  instances.set(scope, instance);

  return instance;
}

/* ==========================================================================
   Startup
   ========================================================================== */

function start() {
  initHistorical(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
