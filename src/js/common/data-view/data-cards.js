/* ==========================================================================
   Data Cards
   ========================================================================== */

/*
 * Generic card collection renderer for reusable data-view modules.
 *
 * Responsibilities:
 *
 * - render row collections
 * - support loading / empty / error states
 * - support optional grouping
 * - delegate card markup to page configuration
 * - enhance newly rendered markup through an optional callback
 * - support delegated events
 * - expose lifecycle methods
 *
 * This module intentionally has no:
 *
 * - breakpoint logic
 * - DataTables code
 * - AJAX code
 * - page-specific business logic
 * - design-system implementation details
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const STATES = Object.freeze({
  loading: "loading",
  empty: "empty",
  error: "error",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveElement(root, value) {
  if (value instanceof Element) {
    return value;
  }

  if (typeof value === "string") {
    return root.querySelector(value);
  }

  return null;
}

function normalizeView(value) {
  return String(value ?? "default");
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function toText(value) {
  return value == null ? "" : String(value);
}

/* ==========================================================================
   Default State Rendering
   ========================================================================== */

function defaultRenderLoading() {
  return `
    <div
      class="data-view__cards-loading"
      aria-hidden="true"
    >
      <article class="data-card data-card--loading">
        <div class="data-card__main">
          <span
            class="table-skeleton table-skeleton-lg"
          ></span>
        </div>
      </article>

      <article class="data-card data-card--loading">
        <div class="data-card__main">
          <span
            class="table-skeleton table-skeleton-lg"
          ></span>
        </div>
      </article>

      <article class="data-card data-card--loading">
        <div class="data-card__main">
          <span
            class="table-skeleton table-skeleton-lg"
          ></span>
        </div>
      </article>
    </div>
  `.trim();
}

function defaultRenderEmpty(message) {
  const element = document.createElement("div");

  element.className = "data-card__empty";

  element.textContent = toText(message);

  return element.outerHTML;
}

function defaultRenderError(message) {
  const element = document.createElement("div");

  element.className = "data-card__empty";

  element.textContent = toText(message);

  return element.outerHTML;
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createDataCards(options = {}) {
  if (!isObject(options)) {
    throw new TypeError("createDataCards requires an options object.");
  }

  const root = options.root || document;

  const container = resolveElement(root, options.container);

  if (!container) {
    throw new Error(
      "Data cards require a valid container element or selector.",
    );
  }

  if (typeof options.renderCard !== "function") {
    throw new TypeError("Data cards require renderCard().");
  }

  const renderCard = options.renderCard;

  const renderLoading =
    typeof options.renderLoading === "function"
      ? options.renderLoading
      : defaultRenderLoading;

  const renderEmpty =
    typeof options.renderEmpty === "function"
      ? options.renderEmpty
      : defaultRenderEmpty;

  const renderError =
    typeof options.renderError === "function"
      ? options.renderError
      : defaultRenderError;

  const getGroupKey =
    typeof options.getGroupKey === "function" ? options.getGroupKey : null;

  const getGroupLabel =
    typeof options.getGroupLabel === "function"
      ? options.getGroupLabel
      : (groupKey) => groupKey;

  const renderGroup =
    typeof options.renderGroup === "function" ? options.renderGroup : null;

  const enhance =
    typeof options.enhance === "function" ? options.enhance : null;

  let currentView = normalizeView(options.initialView);

  let rows = [];

  let renderState = null;

  let destroyed = false;

  const abortController = new AbortController();

  /* ========================================================================
     Context
     ======================================================================== */

  function getContext() {
    return Object.freeze({
      container,

      view: currentView,

      rows: [...rows],

      renderState: renderState
        ? {
            ...renderState,
          }
        : null,
    });
  }

  /* ========================================================================
     Enhancement
     ======================================================================== */

  function enhanceRenderedCards() {
    if (destroyed || !enhance) {
      return;
    }

    /*
     * Enhancement receives the card container rather than the entire page.
     *
     * Existing design-system initializers can therefore initialize only the
     * newly rendered cards.
     */

    enhance(container, getContext());
  }

  function completeRender() {
    if (destroyed) {
      return;
    }

    enhanceRenderedCards();

    options.afterRender?.(getContext());
  }

  /* ========================================================================
     Grouping
     ======================================================================== */

  function groupRows(sourceRows) {
    if (!getGroupKey) {
      return null;
    }

    const groups = new Map();

    sourceRows.forEach((row, index) => {
      const key = getGroupKey(row, {
        index,
        view: currentView,
        container,
      });

      const normalizedKey = key == null ? "" : String(key);

      if (!groups.has(normalizedKey)) {
        groups.set(normalizedKey, []);
      }

      groups.get(normalizedKey).push(row);
    });

    return groups;
  }

  /* ========================================================================
     Cards
     ======================================================================== */

  function renderCards(sourceRows) {
    return sourceRows
      .map((row, index) =>
        renderCard(row, {
          index,

          view: currentView,

          container,
        }),
      )
      .join("");
  }

  function renderGroupedCards(sourceRows) {
    const groups = groupRows(sourceRows);

    if (!groups) {
      return renderCards(sourceRows);
    }

    let globalIndex = 0;

    return [...groups.entries()]
      .map(([groupKey, groupedRows], groupIndex) => {
        const groupLabel = getGroupLabel(groupKey, groupedRows, {
          groupIndex,

          view: currentView,
        });

        const cardsMarkup = groupedRows
          .map((row, indexInGroup) => {
            const markup = renderCard(row, {
              index: globalIndex,

              indexInGroup,

              groupIndex,

              groupKey,

              groupLabel,

              view: currentView,

              container,
            });

            globalIndex += 1;

            return markup;
          })
          .join("");

        if (renderGroup) {
          return renderGroup({
            groupKey,
            groupLabel,

            rows: groupedRows,

            cards: cardsMarkup,

            groupIndex,

            view: currentView,
          });
        }

        const section = document.createElement("section");

        section.className = "data-card-group";

        section.dataset.dataCardGroup = "";

        const heading = document.createElement("h3");

        heading.className = "data-card-group__title";

        heading.textContent = toText(groupLabel);

        const items = document.createElement("div");

        items.className = "data-card-group__items";

        items.innerHTML = cardsMarkup;

        section.append(heading, items);

        return section.outerHTML;
      })
      .join("");
  }

  /* ========================================================================
     Rendering
     ======================================================================== */

  function render() {
    if (destroyed) {
      return;
    }

    const isLoading = renderState?.type === STATES.loading;

    container.setAttribute("aria-busy", String(isLoading));

    /* ----------------------------------------------------------------------
       Loading
       ---------------------------------------------------------------------- */

    if (isLoading) {
      container.innerHTML = renderLoading(getContext());

      completeRender();

      return;
    }

    /* ----------------------------------------------------------------------
       Empty
       ---------------------------------------------------------------------- */

    if (renderState?.type === STATES.empty) {
      container.innerHTML = renderEmpty(renderState.message, getContext());

      completeRender();

      return;
    }

    /* ----------------------------------------------------------------------
       Error
       ---------------------------------------------------------------------- */

    if (renderState?.type === STATES.error) {
      container.innerHTML = renderError(renderState.message, getContext());

      completeRender();

      return;
    }

    /* ----------------------------------------------------------------------
       No Rows
       ---------------------------------------------------------------------- */

    if (!rows.length) {
      container.innerHTML = renderEmpty(
        options.emptyMessage || "No data available",
        getContext(),
      );

      completeRender();

      return;
    }

    /* ----------------------------------------------------------------------
       Rows
       ---------------------------------------------------------------------- */

    container.innerHTML = renderGroupedCards(rows);

    completeRender();
  }

  /* ========================================================================
     Rows
     ======================================================================== */

  function setRows(nextRows = []) {
    if (destroyed) {
      return false;
    }

    rows = normalizeRows(nextRows);

    renderState = null;

    render();

    return true;
  }

  /* ========================================================================
     Loading
     ======================================================================== */

  function showLoading() {
    if (destroyed) {
      return;
    }

    renderState = {
      type: STATES.loading,

      message: "",
    };

    render();
  }

  /* ========================================================================
     Empty
     ======================================================================== */

  function showEmpty(message) {
    if (destroyed) {
      return;
    }

    rows = [];

    renderState = {
      type: STATES.empty,

      message: message || options.emptyMessage || "No data available",
    };

    render();
  }

  /* ========================================================================
     Error
     ======================================================================== */

  function showError(message) {
    if (destroyed) {
      return;
    }

    rows = [];

    renderState = {
      type: STATES.error,

      message:
        message ||
        options.errorMessage ||
        options.emptyMessage ||
        "Unable to load data.",
    };

    render();
  }

  /* ========================================================================
     View
     ======================================================================== */

  function setView(nextView) {
    if (destroyed) {
      return false;
    }

    const view = normalizeView(nextView);

    if (view === currentView) {
      return false;
    }

    currentView = view;

    render();

    options.onViewChange?.(currentView, getContext());

    return true;
  }

  /* ========================================================================
     Refresh
     ======================================================================== */

  function refresh() {
    if (destroyed) {
      return;
    }

    render();
  }

  /* ========================================================================
     Delegated Events
     ======================================================================== */

  function handleClick(event) {
    if (destroyed) {
      return;
    }

    options.onClick?.(event, getContext());
  }

  function handleChange(event) {
    if (destroyed) {
      return;
    }

    options.onChange?.(event, getContext());
  }

  function handleInput(event) {
    if (destroyed) {
      return;
    }

    options.onInput?.(event, getContext());
  }

  function handleError(event) {
    if (destroyed) {
      return;
    }

    options.onError?.(event, getContext());
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    abortController.abort();
  }

  /* ========================================================================
     Events
     ======================================================================== */

  const eventOptions = {
    signal: abortController.signal,
  };

  if (typeof options.onClick === "function") {
    container.addEventListener("click", handleClick, eventOptions);
  }

  if (typeof options.onChange === "function") {
    container.addEventListener("change", handleChange, eventOptions);
  }

  if (typeof options.onInput === "function") {
    container.addEventListener("input", handleInput, eventOptions);
  }

  if (typeof options.onError === "function") {
    container.addEventListener("error", handleError, {
      ...eventOptions,

      capture: true,
    });
  }

  /* ========================================================================
     Initialization
     ======================================================================== */

  if (options.autoRender !== false) {
    render();
  }

  /* ========================================================================
     Public API
     ======================================================================== */

  return Object.freeze({
    destroy,

    getRows() {
      return [...rows];
    },

    getState() {
      return Object.freeze({
        view: currentView,

        rowCount: rows.length,

        renderState: renderState
          ? {
              ...renderState,
            }
          : null,
      });
    },

    getView() {
      return currentView;
    },

    refresh,

    setRows,
    setView,

    showEmpty,
    showError,
    showLoading,
  });
}
