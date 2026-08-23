/* ==========================================================================
   Watchlists
   ========================================================================== */

const SELECTORS = {
  panel: '[role="tabpanel"][id][aria-labelledby]',
  table: "[data-watchlist-table]",
  cards: "[data-watchlist-cards]",

  company: "[data-watchlist-company]",

  select: "[data-watchlist-select]",
  selectAll: "[data-watchlist-select-all]",

  bulkActions: "[data-watchlist-bulk-actions]",
  selectionCount: "[data-watchlist-selection-count]",

  moveSelected: "[data-watchlist-move-selected]",
  removeSelected: "[data-watchlist-remove-selected]",

  removeCompany: "[data-watchlist-remove]",

  tab: '[role="tab"][data-tab-target]',
};

const CLASSES = {
  selected: "is-selected",
};

const instances = new WeakMap();

/* ==========================================================================
   Helpers
   ========================================================================== */

/**
 * Return the company identifier represented by an element.
 *
 * @param {Element} element
 * @returns {string | null}
 */
function getCompanyId(element) {
  const company = element.closest(SELECTORS.company);

  return company?.getAttribute("data-watchlist-company") || null;
}

/**
 * Return the watchlist identifier owned by one panel.
 *
 * The preferred source is the desktop table:
 *
 * data-watchlist-table="watchlist-1"
 *
 * @param {HTMLElement} panel
 * @returns {string | null}
 */
function getWatchlistId(panel) {
  const table = panel.querySelector(SELECTORS.table);

  if (table instanceof HTMLElement) {
    return table.dataset.watchlistTable || null;
  }

  const cards = panel.querySelector(SELECTORS.cards);

  if (cards instanceof HTMLElement) {
    return cards.dataset.watchlistCards || null;
  }

  return null;
}

/**
 * Return unique company IDs currently represented by a panel.
 *
 * Desktop and mobile markup may contain the same company, so a Set is required.
 *
 * @param {HTMLElement} panel
 * @returns {string[]}
 */
function getCompanyIds(panel) {
  const ids = new Set();

  panel.querySelectorAll(SELECTORS.company).forEach((company) => {
    const id = company.getAttribute("data-watchlist-company");

    if (id) {
      ids.add(id);
    }
  });

  return Array.from(ids);
}

/**
 * Return all selection checkboxes representing one company.
 *
 * @param {HTMLElement} panel
 * @param {string} companyId
 * @returns {HTMLInputElement[]}
 */
function getCompanyCheckboxes(panel, companyId) {
  return Array.from(
    panel.querySelectorAll(
      `${SELECTORS.company}[data-watchlist-company="${CSS.escape(
        companyId,
      )}"] ${SELECTORS.select}`,
    ),
  ).filter((element) => element instanceof HTMLInputElement);
}

/**
 * Return the first available display name for a company.
 *
 * @param {HTMLElement} panel
 * @param {string} companyId
 * @returns {string}
 */
function getCompanyName(panel, companyId) {
  const company = panel.querySelector(
    `${SELECTORS.company}[data-watchlist-company="${CSS.escape(companyId)}"]`,
  );

  if (!(company instanceof HTMLElement)) {
    return companyId;
  }

  const name = company.querySelector(".table-identity-name");

  if (name instanceof HTMLElement) {
    return name.textContent.trim() || companyId;
  }

  return companyId;
}

/**
 * Return the bulk-action region for the panel.
 *
 * @param {HTMLElement} panel
 * @returns {HTMLElement | null}
 */
function getBulkActions(panel) {
  const element = panel.querySelector(SELECTORS.bulkActions);

  return element instanceof HTMLElement ? element : null;
}

/* ==========================================================================
   Watchlist Controller
   ========================================================================== */

class Watchlist {
  /**
   * @param {HTMLElement} panel
   */
  constructor(panel) {
    this.panel = panel;

    this.watchlistId = getWatchlistId(panel);

    this.companyIds = new Set(getCompanyIds(panel));
    this.selectedIds = new Set();

    this.handleChange = this.handleChange.bind(this);
    this.handleClick = this.handleClick.bind(this);

    this.init();
  }

  /* ==========================================================================
     Public API
     ========================================================================== */

  static getInstance(panel) {
    return instances.get(panel) || null;
  }

  static getOrCreateInstance(panel) {
    const existing = Watchlist.getInstance(panel);

    if (existing) {
      existing.refresh();
      return existing;
    }

    return new Watchlist(panel);
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  init() {
    instances.set(this.panel, this);

    this.panel.addEventListener("change", this.handleChange);
    this.panel.addEventListener("click", this.handleClick);

    this.readInitialSelection();
    this.refresh();
  }

  /* ==========================================================================
     Initial State
     ========================================================================== */

  /**
   * Respect preselected checkboxes if the server rendered any.
   */
  readInitialSelection() {
    this.panel.querySelectorAll(SELECTORS.select).forEach((element) => {
      if (!(element instanceof HTMLInputElement)) {
        return;
      }

      if (!element.checked) {
        return;
      }

      const companyId = getCompanyId(element);

      if (companyId) {
        this.selectedIds.add(companyId);
      }
    });
  }

  /* ==========================================================================
     Selection
     ========================================================================== */

  /**
   * Select or deselect one company.
   *
   * Every desktop/mobile checkbox representing the same company is synchronized.
   *
   * @param {string} companyId
   * @param {boolean} selected
   */
  setCompanySelected(companyId, selected) {
    if (!this.companyIds.has(companyId)) {
      return;
    }

    if (selected) {
      this.selectedIds.add(companyId);
    } else {
      this.selectedIds.delete(companyId);
    }

    this.syncCompany(companyId);
    this.updateSelectionUI();
  }

  /**
   * Synchronize all representations of one company.
   *
   * @param {string} companyId
   */
  syncCompany(companyId) {
    const selected = this.selectedIds.has(companyId);

    getCompanyCheckboxes(this.panel, companyId).forEach((checkbox) => {
      checkbox.checked = selected;
    });

    this.panel
      .querySelectorAll(
        `${SELECTORS.company}[data-watchlist-company="${CSS.escape(
          companyId,
        )}"]`,
      )
      .forEach((company) => {
        company.classList.toggle(CLASSES.selected, selected);

        /*
         * aria-selected is useful on rows but not generic list items.
         */
        if (company.matches("tr")) {
          company.setAttribute("aria-selected", String(selected));
        }
      });
  }

  /**
   * Select every unique company in the watchlist.
   *
   * @param {boolean} selected
   */
  setAllSelected(selected) {
    if (selected) {
      this.companyIds.forEach((companyId) => {
        this.selectedIds.add(companyId);
      });
    } else {
      this.selectedIds.clear();
    }

    this.companyIds.forEach((companyId) => {
      this.syncCompany(companyId);
    });

    this.updateSelectionUI();
  }

  /**
   * Clear the current selection.
   */
  clearSelection() {
    this.setAllSelected(false);
  }

  /* ==========================================================================
     Selection UI
     ========================================================================== */

  updateSelectionUI() {
    const count = this.selectedIds.size;
    const total = this.companyIds.size;

    /*
     * Bulk action bar.
     */
    const bulkActions = getBulkActions(this.panel);

    if (bulkActions) {
      bulkActions.hidden = count === 0;

      const countElement = bulkActions.querySelector(SELECTORS.selectionCount);

      if (countElement instanceof HTMLElement) {
        countElement.textContent = String(count);
      }
    }

    /*
     * Select-all state.
     */
    this.panel.querySelectorAll(SELECTORS.selectAll).forEach((element) => {
      if (!(element instanceof HTMLInputElement)) {
        return;
      }

      element.checked = total > 0 && count === total;
      element.indeterminate = count > 0 && count < total;

      element.setAttribute(
        "aria-checked",
        element.indeterminate ? "mixed" : String(element.checked),
      );
    });
  }

  /* ==========================================================================
     Refresh
     ========================================================================== */

  /**
   * Refresh company IDs after DOM changes.
   *
   * Useful later when API operations add/remove companies without reloading.
   */
  refresh() {
    const nextIds = new Set(getCompanyIds(this.panel));

    /*
     * Remove stale selected IDs.
     */
    this.selectedIds.forEach((companyId) => {
      if (!nextIds.has(companyId)) {
        this.selectedIds.delete(companyId);
      }
    });

    this.companyIds = nextIds;

    this.companyIds.forEach((companyId) => {
      this.syncCompany(companyId);
    });

    this.updateSelectionUI();
  }

  /* ==========================================================================
     Events
     ========================================================================== */

  handleChange(event) {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    /*
     * Select all.
     */
    if (target.matches(SELECTORS.selectAll)) {
      this.setAllSelected(target.checked);
      return;
    }

    /*
     * Individual company.
     */
    if (target.matches(SELECTORS.select)) {
      const companyId = getCompanyId(target);

      if (!companyId) {
        return;
      }

      this.setCompanySelected(companyId, target.checked);
    }
  }

  handleClick(event) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    /*
     * Bulk move.
     */
    const moveSelected = target.closest(SELECTORS.moveSelected);

    if (moveSelected instanceof HTMLElement) {
      event.preventDefault();

      this.requestMove(Array.from(this.selectedIds));

      return;
    }

    /*
     * Bulk remove.
     */
    const removeSelected = target.closest(SELECTORS.removeSelected);

    if (removeSelected instanceof HTMLElement) {
      event.preventDefault();

      this.requestRemove(Array.from(this.selectedIds));

      return;
    }

    /*
     * Current single-company remove hook.
     *
     * This remains supported while the HTML is still using the direct trash
     * buttons. Once we replace those buttons with three-dot menus, the same
     * requestRemove() method will continue to be used.
     */
    const removeCompany = target.closest(SELECTORS.removeCompany);

    if (removeCompany instanceof HTMLElement) {
      event.preventDefault();

      const companyId =
        removeCompany.dataset.watchlistRemove || getCompanyId(removeCompany);

      if (!companyId) {
        return;
      }

      this.requestRemove([companyId]);
    }
  }

  /* ==========================================================================
     Move
     ========================================================================== */

  /**
   * Request moving one or more companies.
   *
   * UI implementation is intentionally decoupled from state management.
   * The page can listen for `watchlist:move-request` and open the move modal.
   *
   * @param {string[]} companyIds
   */
  requestMove(companyIds) {
    const ids = [...new Set(companyIds)].filter((id) =>
      this.companyIds.has(id),
    );

    if (!ids.length) {
      return;
    }

    this.panel.dispatchEvent(
      new CustomEvent("watchlist:move-request", {
        bubbles: true,
        detail: {
          watchlistId: this.watchlistId,
          companyIds: ids,
          companies: ids.map((id) => ({
            id,
            name: getCompanyName(this.panel, id),
          })),
        },
      }),
    );
  }

  /* ==========================================================================
     Remove
     ========================================================================== */

  /**
   * Request removing one or more companies.
   *
   * The actual API call / confirmation modal belongs outside the selection
   * controller.
   *
   * @param {string[]} companyIds
   */
  requestRemove(companyIds) {
    const ids = [...new Set(companyIds)].filter((id) =>
      this.companyIds.has(id),
    );

    if (!ids.length) {
      return;
    }

    this.panel.dispatchEvent(
      new CustomEvent("watchlist:remove-request", {
        bubbles: true,
        detail: {
          watchlistId: this.watchlistId,
          companyIds: ids,
          companies: ids.map((id) => ({
            id,
            name: getCompanyName(this.panel, id),
          })),
        },
      }),
    );
  }

  /* ==========================================================================
     DOM Mutation Helpers
     ========================================================================== */

  /**
   * Remove companies from the local DOM after a successful API request.
   *
   * Both desktop and mobile representations are removed.
   *
   * @param {string[]} companyIds
   */
  removeCompanies(companyIds) {
    const ids = [...new Set(companyIds)];

    ids.forEach((companyId) => {
      this.panel
        .querySelectorAll(
          `${SELECTORS.company}[data-watchlist-company="${CSS.escape(
            companyId,
          )}"]`,
        )
        .forEach((company) => {
          company.remove();
        });

      this.selectedIds.delete(companyId);
    });

    this.refresh();

    this.panel.dispatchEvent(
      new CustomEvent("watchlist:change", {
        bubbles: true,
        detail: {
          watchlistId: this.watchlistId,
          type: "remove",
          companyIds: ids,
          count: this.companyIds.size,
        },
      }),
    );
  }

  /* ==========================================================================
     Destroy
     ========================================================================== */

  destroy() {
    this.panel.removeEventListener("change", this.handleChange);
    this.panel.removeEventListener("click", this.handleClick);

    instances.delete(this.panel);
  }
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function getWatchlistPanels(scope = document) {
  const panels = new Set();

  scope.querySelectorAll?.(SELECTORS.table).forEach((table) => {
    const panel = table.closest(SELECTORS.panel);

    if (panel instanceof HTMLElement) {
      panels.add(panel);
    }
  });

  scope.querySelectorAll?.(SELECTORS.cards).forEach((cards) => {
    const panel = cards.closest(SELECTORS.panel);

    if (panel instanceof HTMLElement) {
      panels.add(panel);
    }
  });

  return Array.from(panels);
}

/**
 * Initialize all watchlists currently in the document.
 */
export function initWatchlists() {
  const panels = getWatchlistPanels(document);

  if (!panels.length) {
    return;
  }

  panels.forEach((panel) => {
    Watchlist.getOrCreateInstance(panel);
  });
}
