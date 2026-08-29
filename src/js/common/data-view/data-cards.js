/* ==========================================================================
   Data Cards
   ========================================================================== */

/*
 * Generic card collection renderer for reusable data-view modules.
 *
 * Responsibilities:
 *
 * - store row collections
 * - support loading, empty, and error states
 * - support optional grouping
 * - render large collections progressively
 * - pause rendering while the card presentation is hidden
 * - enhance only newly inserted card batches
 * - support delegated events
 * - expose lifecycle methods
 *
 * This module intentionally has no:
 *
 * - DataTables code
 * - AJAX code
 * - page-specific business logic
 * - design-system component implementation details
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const STATES = Object.freeze({
  loading: "loading",

  empty: "empty",

  error: "error",
});

const DEFAULT_BATCH_SIZE = 40;

const DEFAULT_PRELOAD_DISTANCE = 600;

const DEFAULT_ROOT_MARGIN = "600px 0px";

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

  if (typeof value === "string" && typeof root?.querySelector === "function") {
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

function normalizePositiveInteger(value, fallback) {
  const normalized = Number(value);

  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function normalizePositiveNumber(value, fallback) {
  const normalized = Number(value);

  return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

function toText(value) {
  return value == null ? "" : String(value);
}

function isElementVisible(element) {
  if (!(element instanceof Element)) {
    return false;
  }

  if (!element.isConnected) {
    return false;
  }

  return element.getClientRects().length > 0;
}

function createMarkupFragment(markup) {
  const template = document.createElement("template");

  template.innerHTML = String(markup ?? "").trim();

  return template.content;
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
      <article
        class="data-card data-card--loading"
      >
        <div class="data-card__main">
          <span
            class="table-skeleton table-skeleton-lg"
          ></span>
        </div>
      </article>

      <article
        class="data-card data-card--loading"
      >
        <div class="data-card__main">
          <span
            class="table-skeleton table-skeleton-lg"
          ></span>
        </div>
      </article>

      <article
        class="data-card data-card--loading"
      >
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

  const container = resolveElement(
    root,

    options.container,
  );

  if (!container) {
    throw new Error(
      "Data cards require a valid container element or selector.",
    );
  }

  if (typeof options.renderCard !== "function") {
    throw new TypeError("Data cards require renderCard().");
  }

  /* ========================================================================
     Configuration
     ======================================================================== */

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

  const progressive = options.progressive === true;

  const batchSize = normalizePositiveInteger(
    options.batchSize,

    DEFAULT_BATCH_SIZE,
  );

  const preloadDistance = normalizePositiveNumber(
    options.preloadDistance,

    DEFAULT_PRELOAD_DISTANCE,
  );

  const rootMargin =
    String(options.rootMargin || DEFAULT_ROOT_MARGIN).trim() ||
    DEFAULT_ROOT_MARGIN;

  const autoActivate = options.autoActivate !== false;

  /* ========================================================================
     State
     ======================================================================== */

  let currentView = normalizeView(options.initialView);

  let rows = [];

  let renderState = null;

  let active =
    typeof options.active === "boolean"
      ? options.active
      : isElementVisible(container);

  let needsRender = true;

  let renderVersion = 0;

  let progressiveState = null;

  let intersectionObserver = null;

  let firstPaintFrame = 0;

  let secondPaintFrame = 0;

  let batchFrame = 0;

  let idleHandle = 0;

  let visibilityFrame = 0;

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

      active,

      progressive,

      renderedRowCount:
        progressiveState?.renderedRowCount ?? (needsRender ? 0 : rows.length),

      renderState: renderState
        ? {
            ...renderState,
          }
        : null,
    });
  }

  function getBatchContext() {
    return Object.freeze({
      container,

      view: currentView,

      rowCount: rows.length,

      renderedRowCount: progressiveState?.renderedRowCount || 0,

      active,

      progressive: true,
    });
  }

  /* ========================================================================
     Design-system Enhancement
     ======================================================================== */

  function refreshDesignSystem(target) {
    const refresh = window.Theme?.dataView?.refresh;

    if (typeof refresh !== "function") {
      return;
    }

    refresh(target);
  }

  function enhanceCompleteRender() {
    if (destroyed) {
      return;
    }

    enhance?.(container, getContext());

    refreshDesignSystem(container);

    options.afterRender?.(getContext());
  }

  function enhanceBatch(fragment) {
    if (destroyed) {
      return;
    }

    /*
     * A DocumentFragment contains only the newly created cards.
     *
     * Enhancing the fragment prevents every progressive batch from rescanning
     * all cards already present in the container.
     */

    refreshDesignSystem(fragment);
  }

  /* ========================================================================
     Scheduling
     ======================================================================== */

  function cancelPaintSchedule() {
    if (firstPaintFrame) {
      window.cancelAnimationFrame(firstPaintFrame);

      firstPaintFrame = 0;
    }

    if (secondPaintFrame) {
      window.cancelAnimationFrame(secondPaintFrame);

      secondPaintFrame = 0;
    }
  }

  function cancelBatchSchedule() {
    if (batchFrame) {
      window.cancelAnimationFrame(batchFrame);

      batchFrame = 0;
    }

    if (idleHandle && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleHandle);

      idleHandle = 0;
    }

    if (progressiveState) {
      progressiveState.batchScheduled = false;
    }
  }

  function scheduleAfterPaint(callback) {
    cancelPaintSchedule();

    /*
     * Two animation frames guarantee that the browser has an opportunity to
     * paint the skeleton before card construction begins.
     */

    firstPaintFrame = window.requestAnimationFrame(() => {
      firstPaintFrame = 0;

      secondPaintFrame = window.requestAnimationFrame(() => {
        secondPaintFrame = 0;

        callback();
      });
    });
  }

  /* ========================================================================
     Progressive Observer
     ======================================================================== */

  function disconnectIntersectionObserver() {
    intersectionObserver?.disconnect();

    intersectionObserver = null;
  }

  function isSentinelNearViewport() {
    const sentinel = progressiveState?.sentinel;

    if (!(sentinel instanceof Element) || !isElementVisible(container)) {
      return false;
    }

    const bounds = sentinel.getBoundingClientRect();

    return bounds.top <= window.innerHeight + preloadDistance;
  }

  function observeProgressiveSentinel() {
    const sentinel = progressiveState?.sentinel;

    if (
      !(sentinel instanceof Element) ||
      typeof window.IntersectionObserver !== "function"
    ) {
      return;
    }

    disconnectIntersectionObserver();

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);

        if (isVisible) {
          scheduleNextBatch();
        }
      },

      {
        root: null,

        rootMargin,

        threshold: 0,
      },
    );

    intersectionObserver.observe(sentinel);
  }

  /* ========================================================================
     Progressive Cancellation
     ======================================================================== */

  function invalidateProgressiveRender() {
    renderVersion += 1;

    cancelPaintSchedule();

    cancelBatchSchedule();

    disconnectIntersectionObserver();

    progressiveState?.sentinel?.remove();

    progressiveState = null;
  }

  function pauseProgressiveRender() {
    cancelPaintSchedule();

    cancelBatchSchedule();

    disconnectIntersectionObserver();

    if (progressiveState) {
      progressiveState.paused = true;
    }

    container.setAttribute(
      "aria-busy",

      "false",
    );
  }

  /* ========================================================================
     Grouping
     ======================================================================== */

  function createRenderGroups(sourceRows) {
    if (!getGroupKey) {
      return [
        {
          key: "",

          grouped: false,

          records: sourceRows.map((row, index) => ({
            row,

            index,
          })),
        },
      ];
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
        groups.set(normalizedKey, {
          key: normalizedKey,

          grouped: true,

          records: [],
        });
      }

      groups.get(normalizedKey).records.push({
        row,

        index,
      });
    });

    return [...groups.values()];
  }

  function getGroupRows(group) {
    return group.records.map((record) => record.row);
  }

  function getGroupDisplayLabel(group, groupIndex) {
    return getGroupLabel(
      group.key,

      getGroupRows(group),

      {
        groupIndex,

        view: currentView,
      },
    );
  }

  /* ========================================================================
     Standard Full Rendering
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
    const groups = createRenderGroups(sourceRows);

    if (!getGroupKey) {
      return renderCards(sourceRows);
    }

    return groups
      .map((group, groupIndex) => {
        const groupRows = getGroupRows(group);

        const groupLabel = getGroupDisplayLabel(
          group,

          groupIndex,
        );

        const cardsMarkup = group.records
          .map((record, indexInGroup) =>
            renderCard(record.row, {
              index: record.index,

              indexInGroup,

              groupIndex,

              groupKey: group.key,

              groupLabel,

              view: currentView,

              container,
            }),
          )
          .join("");

        if (renderGroup) {
          return renderGroup({
            groupKey: group.key,

            groupLabel,

            rows: groupRows,

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
     Progressive Group Shell
     ======================================================================== */

  function insertBeforeSentinel(fragment) {
    const sentinel = progressiveState?.sentinel;

    if (sentinel && sentinel.parentNode === container) {
      container.insertBefore(
        fragment,

        sentinel,
      );

      return;
    }

    container.append(fragment);
  }

  function createDefaultGroupShell(group, groupIndex, groupLabel) {
    const section = document.createElement("section");

    section.className = "data-card-group";

    section.dataset.dataCardGroup = "";

    const heading = document.createElement("h3");

    heading.className = "data-card-group__title";

    heading.textContent = toText(groupLabel);

    const items = document.createElement("div");

    items.className = "data-card-group__items";

    section.append(heading, items);

    insertBeforeSentinel(section);

    return items;
  }

  function createCustomGroupShell(group, groupIndex, groupLabel) {
    const markup = renderGroup({
      groupKey: group.key,

      groupLabel,

      rows: getGroupRows(group),

      cards: "",

      groupIndex,

      view: currentView,
    });

    const fragment = createMarkupFragment(markup);

    const section =
      fragment.querySelector("[data-data-card-group]") ||
      fragment.querySelector(".data-card-group");

    const items = section?.querySelector(".data-card-group__items");

    if (!(items instanceof Element)) {
      throw new Error(
        "Progressive card groups require a .data-card-group__items element.",
      );
    }

    insertBeforeSentinel(fragment);

    return items;
  }

  function getProgressiveGroupTarget(group, groupIndex, groupLabel) {
    if (!group.grouped) {
      return container;
    }

    if (renderGroup) {
      return createCustomGroupShell(
        group,

        groupIndex,

        groupLabel,
      );
    }

    return createDefaultGroupShell(
      group,

      groupIndex,

      groupLabel,
    );
  }

  /* ========================================================================
     Progressive Sentinel
     ======================================================================== */

  function createProgressiveSentinel() {
    const sentinel = document.createElement("div");

    sentinel.className = "data-view__cards-sentinel";

    sentinel.dataset.dataCardsSentinel = "";

    sentinel.setAttribute(
      "aria-hidden",

      "true",
    );

    sentinel.innerHTML = renderLoading(getContext());

    return sentinel;
  }

  /* ========================================================================
     Progressive Batch
     ======================================================================== */

  function appendCardBatch(
    target,
    group,
    groupIndex,
    groupLabel,
    startIndex,
    endIndex,
  ) {
    const markup = group.records
      .slice(startIndex, endIndex)
      .map((record, offset) =>
        renderCard(record.row, {
          index: record.index,

          indexInGroup: startIndex + offset,

          groupIndex,

          groupKey: group.key,

          groupLabel,

          view: currentView,

          container,
        }),
      )
      .join("");

    if (!markup) {
      return;
    }

    const fragment = createMarkupFragment(markup);

    enhanceBatch(fragment);

    if (target === container && progressiveState?.sentinel) {
      insertBeforeSentinel(fragment);

      return;
    }

    target.append(fragment);
  }

  function completeProgressiveRender() {
    const completedState = progressiveState;

    if (!completedState) {
      return;
    }

    cancelBatchSchedule();

    disconnectIntersectionObserver();

    completedState.sentinel?.remove();

    progressiveState = null;

    needsRender = false;

    container.setAttribute(
      "aria-busy",

      "false",
    );

    /*
     * Page-specific enhancement is intentionally delayed until completion.
     * Design-system card enhancement already occurred per batch.
     */

    enhance?.(container, getContext());

    options.afterRender?.(getContext());
  }

  function renderNextBatch(version) {
    const state = progressiveState;

    if (
      destroyed ||
      !active ||
      !state ||
      state.version !== version ||
      version !== renderVersion
    ) {
      return;
    }

    if (!isElementVisible(container)) {
      pauseProgressiveRender();

      return;
    }

    state.batchScheduled = false;

    state.paused = false;

    container.setAttribute(
      "aria-busy",

      "true",
    );

    let remaining = batchSize;

    while (remaining > 0 && state.groupIndex < state.groups.length) {
      const group = state.groups[state.groupIndex];

      if (!state.groupTarget) {
        state.groupLabel = getGroupDisplayLabel(
          group,

          state.groupIndex,
        );

        state.groupTarget = getProgressiveGroupTarget(
          group,

          state.groupIndex,

          state.groupLabel,
        );
      }

      const available = group.records.length - state.indexInGroup;

      const count = Math.min(
        available,

        remaining,
      );

      const endIndex = state.indexInGroup + count;

      appendCardBatch(
        state.groupTarget,

        group,

        state.groupIndex,

        state.groupLabel,

        state.indexInGroup,

        endIndex,
      );

      state.indexInGroup = endIndex;

      state.renderedRowCount += count;

      remaining -= count;

      if (state.indexInGroup >= group.records.length) {
        state.groupIndex += 1;

        state.indexInGroup = 0;

        state.groupTarget = null;

        state.groupLabel = "";
      }
    }

    container.setAttribute(
      "aria-busy",

      "false",
    );

    options.afterBatchRender?.(getBatchContext());

    if (state.groupIndex >= state.groups.length) {
      completeProgressiveRender();

      return;
    }

    observeProgressiveSentinel();

    /*
     * Continue automatically only while the sentinel remains near the
     * viewport. Otherwise IntersectionObserver resumes rendering when the
     * user approaches the remaining results.
     */

    if (
      typeof window.IntersectionObserver !== "function" ||
      isSentinelNearViewport()
    ) {
      scheduleNextBatch();
    }
  }

  function scheduleNextBatch() {
    const state = progressiveState;

    if (destroyed || !active || !state || state.batchScheduled) {
      return;
    }

    state.batchScheduled = true;

    const version = state.version;

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(
        () => {
          idleHandle = 0;

          renderNextBatch(version);
        },

        {
          timeout: 150,
        },
      );

      return;
    }

    batchFrame = window.requestAnimationFrame(() => {
      batchFrame = 0;

      renderNextBatch(version);
    });
  }

  /* ========================================================================
     Progressive Start
     ======================================================================== */

  function startProgressiveRender() {
    invalidateProgressiveRender();

    const version = renderVersion;

    needsRender = false;

    container.setAttribute(
      "aria-busy",

      "true",
    );

    /*
     * Paint the standard card skeleton immediately.
     */

    container.innerHTML = renderLoading(getContext());

    scheduleAfterPaint(() => {
      if (destroyed || !active || version !== renderVersion) {
        return;
      }

      if (!isElementVisible(container)) {
        needsRender = true;

        container.setAttribute(
          "aria-busy",

          "false",
        );

        return;
      }

      const groups = createRenderGroups(rows);

      container.replaceChildren();

      const sentinel = createProgressiveSentinel();

      container.append(sentinel);

      progressiveState = {
        version,

        groups,

        sentinel,

        groupIndex: 0,

        indexInGroup: 0,

        groupTarget: null,

        groupLabel: "",

        renderedRowCount: 0,

        batchScheduled: false,

        paused: false,
      };

      renderNextBatch(version);
    });
  }

  function resumeProgressiveRender() {
    const state = progressiveState;

    if (!state) {
      if (needsRender) {
        render();
      }

      return;
    }

    state.paused = false;

    observeProgressiveSentinel();

    if (isSentinelNearViewport()) {
      scheduleNextBatch();
    }
  }

  /* ========================================================================
     Static State Rendering
     ======================================================================== */

  function renderMarkup(markup, { loading = false } = {}) {
    invalidateProgressiveRender();

    needsRender = false;

    container.setAttribute(
      "aria-busy",

      String(loading),
    );

    container.innerHTML = markup;

    enhanceCompleteRender();
  }

  /* ========================================================================
     Rendering
     ======================================================================== */

  function render() {
    if (destroyed) {
      return;
    }

    if (!active) {
      invalidateProgressiveRender();

      needsRender = true;

      return;
    }

    const isLoading = renderState?.type === STATES.loading;

    if (isLoading) {
      renderMarkup(
        renderLoading(getContext()),

        {
          loading: true,
        },
      );

      return;
    }

    if (renderState?.type === STATES.empty) {
      renderMarkup(
        renderEmpty(
          renderState.message,

          getContext(),
        ),
      );

      return;
    }

    if (renderState?.type === STATES.error) {
      renderMarkup(
        renderError(
          renderState.message,

          getContext(),
        ),
      );

      return;
    }

    if (!rows.length) {
      renderMarkup(
        renderEmpty(
          options.emptyMessage || "No data available",

          getContext(),
        ),
      );

      return;
    }

    if (progressive) {
      startProgressiveRender();

      return;
    }

    renderMarkup(renderGroupedCards(rows));
  }

  /* ========================================================================
     Active Presentation
     ======================================================================== */

  function setActive(nextActive) {
    if (destroyed) {
      return false;
    }

    const normalizedActive = Boolean(nextActive);

    if (normalizedActive === active) {
      if (active && progressiveState?.paused) {
        resumeProgressiveRender();
      }

      return false;
    }

    active = normalizedActive;

    if (!active) {
      pauseProgressiveRender();
    } else if (progressiveState) {
      resumeProgressiveRender();
    } else if (needsRender) {
      render();
    }

    options.onActiveChange?.(
      active,

      getContext(),
    );

    return true;
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

    options.onViewChange?.(
      currentView,

      getContext(),
    );

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
     Automatic Visibility Synchronization
     ======================================================================== */

  function synchronizeVisibility() {
    if (destroyed || !autoActivate) {
      return;
    }

    setActive(isElementVisible(container));
  }

  function handleWindowResize() {
    if (destroyed || !autoActivate || visibilityFrame) {
      return;
    }

    visibilityFrame = window.requestAnimationFrame(() => {
      visibilityFrame = 0;

      synchronizeVisibility();
    });
  }

  /* ========================================================================
     Delegated Events
     ======================================================================== */

  function handleClick(event) {
    if (destroyed) {
      return;
    }

    options.onClick?.(
      event,

      getContext(),
    );
  }

  function handleChange(event) {
    if (destroyed) {
      return;
    }

    options.onChange?.(
      event,

      getContext(),
    );
  }

  function handleInput(event) {
    if (destroyed) {
      return;
    }

    options.onInput?.(
      event,

      getContext(),
    );
  }

  function handleError(event) {
    if (destroyed) {
      return;
    }

    options.onError?.(
      event,

      getContext(),
    );
  }

  /* ========================================================================
     Lifecycle
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    invalidateProgressiveRender();

    if (visibilityFrame) {
      window.cancelAnimationFrame(visibilityFrame);

      visibilityFrame = 0;
    }

    abortController.abort();

    container.setAttribute(
      "aria-busy",

      "false",
    );
  }

  /* ========================================================================
     Events
     ======================================================================== */

  const eventOptions = {
    signal: abortController.signal,
  };

  if (typeof options.onClick === "function") {
    container.addEventListener(
      "click",

      handleClick,

      eventOptions,
    );
  }

  if (typeof options.onChange === "function") {
    container.addEventListener(
      "change",

      handleChange,

      eventOptions,
    );
  }

  if (typeof options.onInput === "function") {
    container.addEventListener(
      "input",

      handleInput,

      eventOptions,
    );
  }

  if (typeof options.onError === "function") {
    container.addEventListener(
      "error",

      handleError,

      {
        ...eventOptions,

        capture: true,
      },
    );
  }

  if (autoActivate) {
    window.addEventListener(
      "resize",

      handleWindowResize,

      eventOptions,
    );
  }

  /* ========================================================================
     Initialization
     ======================================================================== */

  if (options.autoRender !== false) {
    render();
  }

  /* ========================================================================
     Public Instance
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

        renderedRowCount:
          progressiveState?.renderedRowCount ?? (needsRender ? 0 : rows.length),

        renderState: renderState
          ? {
              ...renderState,
            }
          : null,

        active,

        progressive,
      });
    },

    getView() {
      return currentView;
    },

    isActive() {
      return active;
    },

    isProgressiveRendering() {
      return Boolean(progressiveState);
    },

    refresh,

    setActive,

    setRows,

    setView,

    showEmpty,

    showError,

    showLoading,
  });
}
