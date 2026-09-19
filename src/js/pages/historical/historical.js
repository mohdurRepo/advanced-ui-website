/* ==========================================================================
   Historical Reports
   ========================================================================== */

/*
 * Historical Reports page coordinator.
 *
 * Responsibilities:
 *
 * - initialize Historical configuration
 * - initialize settled Historical filters
 * - coordinate Performance / Unadjusted / Underlying profiles
 * - coordinate report tables and mobile cards
 * - coordinate shared pagination
 * - apply Trade Type visibility
 * - apply Unadjusted-tab availability
 * - render trusted JSP note templates
 * - render placeholder / note-only / report / underlying page states
 * - preserve legacy filter/tab reload behavior
 * - clean up all page-owned instances and listeners
 *
 * Historical intentionally does NOT use createDataViewController.
 *
 * This page has three independent table/card presentations:
 *
 * - Performance
 * - Unadjusted
 * - Derivatives Underlying
 *
 * plus business-profile selection deciding which presentation is active.
 *
 * Generic primitives remain in common/data-view while this file owns only
 * Historical-specific coordination.
 */

/* ==========================================================================
   Shared Data-View Imports
   ========================================================================== */

import {
  createDataCards,
  createDataFilters,
  createDataPagination,
  createDataTable,
  renderStandardDataCard,
} from "../../common/data-view/index.js";

/* ==========================================================================
   Historical Imports
   ========================================================================== */

import { getHistoricalConfig } from "./historical.config.js";

import { resolveHistoricalRules } from "./historical.rules.js";

import {
  applyDefaultHistoricalDateRangeIfEmpty,
  createHistoricalFilters,
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
  /* ----------------------------------------------------------------------
     Tabs
     ---------------------------------------------------------------------- */

  tabsRoot: "[data-historical-tabs]",

  tabButton: '[role="tab"][data-tab]',

  unadjustedTabButton: '[data-tab="unadjusted"]',

  unadjustedPanel: "#historical-panel-unadjusted",

  /* ----------------------------------------------------------------------
     Filters
     ---------------------------------------------------------------------- */

  tradeTypeFilterField: "#tradeTypeFilter",

  tradeTypeSelect: "[data-historical-trade-type]",

  resetButton: "[data-historical-reset]",

  /* ----------------------------------------------------------------------
     Tables
     ---------------------------------------------------------------------- */

  performanceTable: '[data-historical-table="performance"]',

  unadjustedTable: '[data-historical-table="unadjusted"]',

  underlyingTable: '[data-historical-table="underlying"]',

  /* ----------------------------------------------------------------------
     Underlying
     ---------------------------------------------------------------------- */

  underlyingSection: "[data-historical-underlying-section]",

  /* ----------------------------------------------------------------------
     Cards
     ---------------------------------------------------------------------- */

  performanceCards: '[data-historical-mobile-cards="performance"]',

  unadjustedCards: '[data-historical-mobile-cards="unadjusted"]',

  underlyingCards: '[data-historical-mobile-cards="underlying"]',

  /* ----------------------------------------------------------------------
     Placeholder
     ---------------------------------------------------------------------- */

  emptyState: "[data-historical-placeholder]",

  emptyImage: "[data-historical-placeholder-image]",

  placeholderMessage: "[data-historical-placeholder-message]",

  /* ----------------------------------------------------------------------
     Notes
     ---------------------------------------------------------------------- */

  defaultNote: '[data-historical-note="default"]',

  derivativesNote: '[data-historical-note="derivatives"]',

  noteContent: "[data-historical-note-content]",

  noteTemplate: "[data-historical-note-template]",

  /* ----------------------------------------------------------------------
     Pagination
     ---------------------------------------------------------------------- */

  pagination: "[data-historical-pagination]",
});

/* ==========================================================================
   Instances
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   DOM Helpers
   ========================================================================== */

function requireElement(root, selector, description) {
  const element = root.querySelector(selector);

  if (!element) {
    throw new Error(`Historical Reports requires ${description}.`);
  }

  return element;
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
   Notes
   ========================================================================== */

/*
 * JSP owns rich/localized Historical note content.
 *
 * Rules return only a semantic key such as:
 *
 *   indexType
 *   mainMarketTasi
 *   derivativeChangePoints
 *   mfNav
 *
 * This coordinator clones the corresponding inert <template> fragment.
 */

function collectNoteTemplates(root) {
  const templates = new Map();

  root.querySelectorAll(SELECTORS.noteTemplate).forEach((template) => {
    const key = String(template.dataset.historicalNoteTemplate ?? "").trim();

    if (!key || !template.content) {
      return;
    }

    templates.set(key, template);
  });

  return templates;
}

function clearNote(container, content) {
  if (content) {
    content.replaceChildren();
  }

  if (container) {
    container.hidden = true;
  }
}

function hideNotes(dom) {
  clearNote(dom.defaultNote, dom.defaultNoteContent);

  clearNote(dom.derivativesNote, dom.derivativesNoteContent);
}

function applyNote(dom, noteTemplates, note) {
  hideNotes(dom);

  if (!note?.visible || !note.key) {
    return false;
  }

  const template = noteTemplates.get(note.key);

  if (!template) {
    console.warn(`[Historical Reports] Missing note template "${note.key}".`);

    return false;
  }

  const useDerivativesTarget = note.target === "derivatives";

  const container = useDerivativesTarget
    ? dom.derivativesNote
    : dom.defaultNote;

  const content = useDerivativesTarget
    ? dom.derivativesNoteContent
    : dom.defaultNoteContent;

  content.replaceChildren(template.content.cloneNode(true));

  container.hidden = false;

  return true;
}

/* ==========================================================================
   Placeholder
   ========================================================================== */

function hidePlaceholder(dom) {
  dom.emptyState.hidden = true;

  dom.emptyImage.hidden = true;

  dom.placeholderMessage.textContent = "";
}

function showPlaceholder(dom, message, { showImage = false } = {}) {
  dom.placeholderMessage.textContent = String(message ?? "");

  dom.emptyImage.hidden = !showImage;

  dom.emptyState.hidden = false;

  dom.tabsRoot.hidden = true;

  dom.underlyingSection.hidden = true;

  hideNotes(dom);
}

/* ==========================================================================
   Page States
   ========================================================================== */

/*
 * Invalid / incomplete filters:
 *
 * - normal report views are hidden
 * - one page-level guidance message is shown inside the connected
 *   Historical placeholder surface
 * - no duplicate inline validation message is rendered beneath the filters
 * - pagination is managed/cleared separately by the coordinator
 */

function showInvalidState(dom, config) {
  showPlaceholder(dom, config.labels?.placeholderSelectFilters, {
    showImage: false,
  });
}

/*
 * Valid report / underlying state.
 *
 * Pagination is NOT made visible here.
 *
 * data-pagination.js owns its own visibility based on actual report paging
 * metadata. This prevents Underlying and zero-row responses from displaying
 * report pagination.
 */

function showDataState(dom) {
  hidePlaceholder(dom);
}

/*
 * Valid business state with deliberately no table.
 *
 * Current example:
 *
 *   INDICES + entity type I
 *
 * The contextual note itself is the result; do not display the page
 * placeholder for this state.
 */

function showNoteOnlyState(dom, noteTemplates, note) {
  hidePlaceholder(dom);

  dom.tabsRoot.hidden = true;

  dom.underlyingSection.hidden = true;

  applyNote(dom, noteTemplates, note);
}

/* ==========================================================================
   Trade Type Visibility
   ========================================================================== */

/*
 * Trade Type is visible only for the Historical business cases resolved by
 * historical.rules.js.
 *
 * When hidden, the native source-of-truth value is forced back to OB.
 */

function applyTradeTypeVisibility(dom, rules) {
  dom.tradeTypeFilterField.hidden = !rules.showTradeType;

  if (rules.showTradeType) {
    return;
  }

  if (dom.tradeTypeSelect.value === "OB") {
    return;
  }

  dom.tradeTypeSelect.value = "OB";

  dispatchNativeChange(dom.tradeTypeSelect);
}

/* ==========================================================================
   Unadjusted Tab Visibility
   ========================================================================== */

function applyUnadjustedTabVisibility(dom, rules) {
  const visible = rules.showUnadjustedTab;

  dom.unadjustedTabButton.hidden = !visible;

  dom.unadjustedTabButton.classList.toggle("is-disabled", !visible);

  dom.unadjustedTabButton.setAttribute("aria-disabled", String(!visible));

  /*
   * If the business rule removes this tab entirely, ensure its panel cannot
   * remain visible from an earlier state.
   *
   * When the tab becomes available again, the design-system tabs controller
   * remains responsible for deciding which panel is active.
   */

  if (!visible) {
    dom.unadjustedPanel.hidden = true;

    dom.unadjustedPanel.setAttribute("aria-hidden", "true");
  }
}

/* ==========================================================================
   Tab Activation
   ========================================================================== */

/*
 * Drive the actual design-system tabs component through the real button.
 *
 * Do not manually toggle:
 *
 * - .active
 * - aria-selected
 * - tabindex
 * - panel hidden state
 *
 * tabs.js owns those interactions and emits tabs:change.
 */

function activateTabByKey(dom, key) {
  const tab = dom.tabsRoot.querySelector(
    `${SELECTORS.tabButton}[data-tab="${key}"]`,
  );

  if (!tab) {
    return false;
  }

  if (tab.getAttribute("aria-selected") === "true") {
    return false;
  }

  tab.click();

  return true;
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

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  let destroyed = false;

  const documentReference =
    scope?.nodeType === 9 ? scope : scope.ownerDocument || document;

  const view = documentReference.defaultView || window;

  const AbortControllerCtor =
    view.AbortController || globalThis.AbortController;

  const lifecycleController = new AbortControllerCtor();

  /* ========================================================================
     DOM
     ======================================================================== */

  const dom = {
    /* ----------------------------------------------------------------------
       Tabs
       ---------------------------------------------------------------------- */

    tabsRoot: requireElement(
      scope,
      SELECTORS.tabsRoot,
      "the Historical tabs root",
    ),

    unadjustedTabButton: requireElement(
      scope,
      SELECTORS.unadjustedTabButton,
      "the Unadjusted tab",
    ),

    unadjustedPanel: requireElement(
      scope,
      SELECTORS.unadjustedPanel,
      "the Unadjusted tab panel",
    ),

    /* ----------------------------------------------------------------------
       Filters
       ---------------------------------------------------------------------- */

    tradeTypeFilterField: requireElement(
      scope,
      SELECTORS.tradeTypeFilterField,
      "the Trade Type filter field",
    ),

    tradeTypeSelect: requireElement(
      scope,
      SELECTORS.tradeTypeSelect,
      "the Trade Type select",
    ),

    resetButton: requireElement(
      scope,
      SELECTORS.resetButton,
      "the Reset button",
    ),

    /* ----------------------------------------------------------------------
       Underlying
       ---------------------------------------------------------------------- */

    underlyingSection: requireElement(
      scope,
      SELECTORS.underlyingSection,
      "the Underlying section",
    ),

    /* ----------------------------------------------------------------------
       Placeholder
       ---------------------------------------------------------------------- */

    emptyState: requireElement(
      scope,
      SELECTORS.emptyState,
      "the Historical placeholder",
    ),

    emptyImage: requireElement(
      scope,
      SELECTORS.emptyImage,
      "the Historical placeholder image",
    ),

    placeholderMessage: requireElement(
      scope,
      SELECTORS.placeholderMessage,
      "the Historical placeholder message",
    ),

    /* ----------------------------------------------------------------------
       Notes
       ---------------------------------------------------------------------- */

    defaultNote: requireElement(
      scope,
      SELECTORS.defaultNote,
      "the default Historical note",
    ),

    derivativesNote: requireElement(
      scope,
      SELECTORS.derivativesNote,
      "the derivatives Historical note",
    ),

    /* ----------------------------------------------------------------------
       Pagination
       ---------------------------------------------------------------------- */

    pagination: requireElement(
      scope,
      SELECTORS.pagination,
      "the Historical pagination container",
    ),
  };

  dom.defaultNoteContent = requireElement(
    dom.defaultNote,
    SELECTORS.noteContent,
    "the default Historical note content",
  );

  dom.derivativesNoteContent = requireElement(
    dom.derivativesNote,
    SELECTORS.noteContent,
    "the derivatives Historical note content",
  );

  /* ========================================================================
     Note Templates
     ======================================================================== */

  const noteTemplates = collectNoteTemplates(scope);

  /* ========================================================================
     Configuration
     ======================================================================== */

  const config = getHistoricalConfig();

  /* ========================================================================
     Initial Date Range
     ======================================================================== */

  /*
   * Apply the one-month default before createDataFilters binds its initial
   * state so generic filter snapshots begin with the correct values.
   */

  applyDefaultHistoricalDateRangeIfEmpty(scope);

  /* ========================================================================
     Filters
     ======================================================================== */

  const filterView = createHistoricalFilters({
    root: scope,

    config,

    createDataFilters,
  });

  /* ========================================================================
     Cards
     ======================================================================== */

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

  /* ========================================================================
     Active Views
     ======================================================================== */

  let activeReportTable = null;

  let activeReportCards = null;

  let activeUnderlyingTable = null;

  /* ========================================================================
     Pagination
     ======================================================================== */

  let pagination = null;

  pagination = createDataPagination({
    root: scope,

    container: dom.pagination,

    locale: config.locale,

    labels: config.labels?.pagination,

    /*
     * No report rows -> no report pagination.
     */
    hideWhenEmpty: true,

    /*
     * Preserve visible paging/status UI even when the result fits on one
     * server-side page.
     */
    hideSinglePage: false,

    /*
     * Clicking a page places the component into aria-busy immediately.
     * The next onPaginationChange() from historical.table.js clears it.
     */
    autoBusyOnChange: true,

    onPageChange(page) {
      if (destroyed) {
        return;
      }

      const api = activeReportTable?.getApi?.();

      if (!api) {
        pagination.setLoading(false);

        return;
      }

      const info = api.page?.info?.();

      const totalPages = Number(info?.pages ?? 0);

      if (totalPages <= 0 || page < 1 || page > totalPages) {
        pagination.setLoading(false);

        return;
      }

      /*
       * The shared server-side table lifecycle renders skeleton rows for the
       * request. Keep the matching mobile cards in the same loading state.
       */
      activeReportCards?.showLoading?.();

      /*
       * DataPagination is one-based for UI semantics.
       * DataTables uses zero-based page indexes.
       *
       * "page" requests a paging-only redraw and therefore keeps the normal
       * DataTables server-side lifecycle intact.
       */
      api.page(page - 1).draw("page");
    },
  });
  /* ========================================================================
     Active Report Lifecycle
     ======================================================================== */

  function destroyActiveReportTable({ clearPagination = true } = {}) {
    activeReportTable?.destroy();

    activeReportTable = null;

    activeReportCards = null;

    if (clearPagination) {
      pagination.clear();
    }
  }

  /* ========================================================================
     Active Underlying Lifecycle
     ======================================================================== */

  function destroyActiveUnderlyingTable() {
    activeUnderlyingTable?.destroy();

    activeUnderlyingTable = null;
  }

  /* ========================================================================
     Report Activation
     ======================================================================== */

  function activateReportTable(reportView) {
    destroyActiveReportTable();

    const tableSelector =
      reportView === "unadjusted"
        ? SELECTORS.unadjustedTable
        : SELECTORS.performanceTable;

    const cards =
      reportView === "unadjusted" ? unadjustedCards : performanceCards;

    activeReportCards = cards;

    /*
     * DataTables immediately begins its first server-side request.
     *
     * Put the matching mobile cards into loading state before constructing
     * the table so both presentations enter the same request lifecycle.
     */
    cards.showLoading();

    activeReportTable = createHistoricalTableView({
      root: scope,

      config,

      createDataTable,

      table: tableSelector,

      initialView: reportView,

      getFilters: filterView.getFilters,

      /* ------------------------------------------------------------------
           Desktop -> Cards
           ------------------------------------------------------------------ */

      onServerSideData(rows) {
        if (destroyed) {
          return;
        }

        cards.setRows(rows);
      },

      onServerSideError(message) {
        if (destroyed) {
          return;
        }

        cards.showError(message);
      },

      /* ------------------------------------------------------------------
           Table -> Shared Pagination
           ------------------------------------------------------------------ */

      onPaginationChange(state) {
        if (destroyed) {
          return;
        }

        pagination.setState(state);
      },
    });
  }

  /* ========================================================================
     Underlying Activation
     ======================================================================== */

  function activateUnderlyingTable() {
    destroyActiveUnderlyingTable();

    /*
     * Underlying has no pagination by contract.
     */
    pagination.clear();

    activeUnderlyingTable = createHistoricalUnderlyingTableView({
      root: scope,

      config,

      createDataTable,

      table: SELECTORS.underlyingTable,

      getFilters: filterView.getFilters,

      onLoading() {
        if (destroyed) {
          return;
        }

        underlyingCards.showLoading();
      },

      onData(rows) {
        if (destroyed) {
          return;
        }

        /*
         * setRows([]) naturally resolves to the card component's configured
         * empty state, so one callback handles both ready and empty results.
         */
        underlyingCards.setRows(rows);
      },

      onError(message) {
        if (destroyed) {
          return;
        }

        underlyingCards.showError(message);
      },
    });

    /*
     * Underlying owns a separate single-shot GET lifecycle.
     */
    void activeUnderlyingTable.load();
  }

  /* ========================================================================
     Resolve and Render
     ======================================================================== */

  function resolveAndRender() {
    if (destroyed) {
      return;
    }

    const filters = filterView.getFilters();

    const rules = resolveHistoricalRules(filters, config);

    /* ----------------------------------------------------------------------
       Filter / Tab Availability
       ---------------------------------------------------------------------- */

    applyTradeTypeVisibility(dom, rules);

    applyUnadjustedTabVisibility(dom, rules);

    /*
     * A filter change can make Unadjusted unavailable while it is active.
     *
     * Let tabs.js perform the actual transition, then resolve again from the
     * tabs:change notification rather than manually editing ARIA/panel state.
     */
    if (!rules.showUnadjustedTab && filters.activeTab === "unadjusted") {
      activateTabByKey(dom, "performance");

      return;
    }

    /* ----------------------------------------------------------------------
       Invalid / Incomplete Filters
       ----------------------------------------------------------------------

       The page-level connected placeholder is now the only validation /
       guidance surface.

       Do not render a second field-level message beneath Market, Entity, or
       the date controls.
       ---------------------------------------------------------------------- */

    if (!rules.ready) {
      destroyActiveReportTable();

      destroyActiveUnderlyingTable();

      pagination.clear();

      showInvalidState(dom, config);

      return;
    }

    /* ----------------------------------------------------------------------
       Note-Only Profile
       ---------------------------------------------------------------------- */

    if (rules.profileType === "none") {
      destroyActiveReportTable();

      destroyActiveUnderlyingTable();

      pagination.clear();

      showNoteOnlyState(dom, noteTemplates, rules.note);

      return;
    }

    /* ----------------------------------------------------------------------
       Normal Valid State
       ---------------------------------------------------------------------- */

    showDataState(dom);

    applyNote(dom, noteTemplates, rules.note);

    /* ----------------------------------------------------------------------
       Derivatives Underlying
       ---------------------------------------------------------------------- */

    if (rules.profileType === "derivativesUnderlying") {
      dom.tabsRoot.hidden = true;

      dom.underlyingSection.hidden = false;

      destroyActiveReportTable();

      activateUnderlyingTable();

      return;
    }

    /* ----------------------------------------------------------------------
       Performance / Unadjusted
       ---------------------------------------------------------------------- */

    dom.tabsRoot.hidden = false;

    dom.underlyingSection.hidden = true;

    destroyActiveUnderlyingTable();

    activateReportTable(rules.profileType);
  }

  /* ========================================================================
     Render Scheduling
     ======================================================================== */

  /*
   * historical.filters.js publishes settled dependency states, so this does
   * not compensate for Market -> Sector -> Entity intermediate values.
   *
   * A microtask remains useful for:
   *
   * - a forced tab correction emitting tabs:change synchronously
   * - Reset updating filters and the active tab as one logical action
   *
   * Multiple same-turn notifications therefore collapse into one final page
   * resolution.
   */

  let renderScheduled = false;

  function scheduleResolveAndRender() {
    if (destroyed || renderScheduled) {
      return;
    }

    renderScheduled = true;

    queueMicrotask(() => {
      renderScheduled = false;

      if (destroyed) {
        return;
      }

      resolveAndRender();
    });
  }

  /* ========================================================================
     Filter Events
     ======================================================================== */

  let resetInProgress = false;

  const unsubscribeFilters = filterView.filters.subscribe(() => {
    if (destroyed || resetInProgress) {
      return;
    }

    scheduleResolveAndRender();
  });

  /* ========================================================================
     Reset
     ======================================================================== */

  dom.resetButton.addEventListener(
    "click",

    async () => {
      if (destroyed || resetInProgress) {
        return;
      }

      resetInProgress = true;

      try {
        /*
         * resetToDefaults() is one settled:
         *
         * Market -> Sector -> Entity
         *
         * transaction.
         */
        await filterView.resetToDefaults();

        if (destroyed) {
          return;
        }

        /*
         * Filter Reset also restores the default Performance tab.
         *
         * tabs.js owns panel and ARIA state.
         */
        activateTabByKey(dom, "performance");
      } finally {
        resetInProgress = false;

        if (!destroyed) {
          /*
           * Exactly one final render from the complete Reset state.
           */
          scheduleResolveAndRender();
        }
      }
    },

    {
      signal: lifecycleController.signal,
    },
  );

  /* ========================================================================
     Initialization
     ======================================================================== */

  /*
   * data-pagination starts with an empty state and therefore remains hidden
   * until the first successful report response provides pagination metadata.
   */

  pagination.clear();

  resolveAndRender();

  /* ========================================================================
     Public Instance
     ======================================================================== */

  const instance = Object.freeze({
    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;

      /*
       * Remove page-owned DOM event listeners first.
       */
      lifecycleController.abort();

      unsubscribeFilters?.();

      destroyActiveReportTable({
        clearPagination: false,
      });

      destroyActiveUnderlyingTable();

      pagination.destroy();

      performanceCards.destroy();

      unadjustedCards.destroy();

      underlyingCards.destroy();

      filterView.destroy();

      hideNotes(dom);

      instances.delete(scope);
    },

    getFilters() {
      return filterView.getFilters();
    },

    getReportTableApi() {
      return activeReportTable?.getApi?.() ?? null;
    },

    getUnderlyingTableApi() {
      return activeUnderlyingTable?.getApi?.() ?? null;
    },

    getPaginationState() {
      return pagination.getState();
    },

    refresh() {
      scheduleResolveAndRender();
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
  document.addEventListener("DOMContentLoaded", start, {
    once: true,
  });
} else {
  start();
}
