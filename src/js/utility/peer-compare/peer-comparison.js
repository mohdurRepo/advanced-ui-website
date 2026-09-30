/* ==========================================================================
   Peer Comparison
   ========================================================================== */

/**
 * Peer comparison feature controller.
 *
 * Owns:
 *
 * - peer selection state;
 * - search filtering;
 * - minimum / maximum selection rules;
 * - selection count;
 * - restoring selection when the modal opens;
 * - result-shell rendering;
 * - selected-peer removal;
 * - peer-summary API request lifecycle;
 * - loading / ready / error feature states;
 * - coordination events consumed by table / graph modules;
 * - request cancellation and stale-response protection.
 *
 * Does not own:
 *
 * - generic modal behavior;
 * - generic tabs behavior;
 * - table rendering;
 * - chart rendering;
 * - chart historical/intraday requests;
 * - API-response field normalization beyond the summary envelope.
 */

(() => {
  "use strict";

  /* ==========================================================================
     Dependencies
     ========================================================================== */

  const U = window.PeerComparisonUtils;

  if (!U) {
    console.error("PeerComparison requires window.PeerComparisonUtils.");

    return;
  }

  /* ==========================================================================
     Configuration
     ========================================================================== */

  const CONFIG = window.peerComparisonConfig ?? {};

  const MIN_SELECTION = Number.isInteger(CONFIG.limits?.min)
    ? CONFIG.limits.min
    : 2;

  const MAX_SELECTION = Number.isInteger(CONFIG.limits?.max)
    ? CONFIG.limits.max
    : 5;

  const IDS = Object.freeze({
    tablePanel: "peerComparisonTablePanel",

    graphPanel: "peerComparisonGraphPanel",
  });

  const SELECTORS = Object.freeze({
    modal: "#peerComparisonModal",

    selection: "[data-peer-selection]",

    searchForm: "#peerComparisonSearchForm",

    search: "[data-peer-search]",

    option: "[data-peer-option]",

    checkbox: "[data-peer-checkbox]",

    empty: "[data-peer-empty]",

    error: "[data-peer-error]",

    count: "[data-peer-count]",

    submit: "[data-peer-submit]",

    result: "[data-peer-result]",

    resultInner: "[data-peer-result-inner]",

    resultClose: "[data-peer-result-close]",

    peerRemove: "[data-peer-remove]",
  });

  const EVENTS = Object.freeze({
    loading: "peercomparison:loading",

    render: "peercomparison:render",

    error: "peercomparison:error",

    clear: "peercomparison:clear",
  });

  /* ==========================================================================
     State
     ========================================================================== */

  const selectedPeerCodes = new Set();

  let modalWasOpen = false;

  let requestController = null;

  let requestId = 0;

  /* ==========================================================================
     DOM
     ========================================================================== */

  const dom = {
    modal: null,

    selection: null,

    searchForm: null,

    search: null,

    empty: null,

    error: null,

    count: null,

    submit: null,

    result: null,

    resultInner: null,
  };

  /* ==========================================================================
     Labels
     ========================================================================== */

  function getLabels() {
    return CONFIG.labels ?? {};
  }

  function getLabel(key, fallback) {
    const value = getLabels()[key];

    return String(value || fallback);
  }

  /* ==========================================================================
     General Helpers
     ========================================================================== */

  function isElement(value) {
    return value instanceof Element;
  }

  function normalizeText(value) {
    const text = String(value ?? "").trim();

    try {
      return text.toLocaleLowerCase(document.documentElement.lang || undefined);
    } catch {
      return text.toLowerCase();
    }
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function prefersReducedMotion() {
    return document.documentElement.dataset.motionPreference === "reduce";
  }

  function isAbortError(error) {
    return error?.name === "AbortError";
  }

  /* ==========================================================================
     Peer Collection
     ========================================================================== */

  function getOptions() {
    if (!dom.selection) {
      return [];
    }

    return Array.from(dom.selection.querySelectorAll(SELECTORS.option));
  }

  function getCheckboxes() {
    if (!dom.selection) {
      return [];
    }

    return Array.from(dom.selection.querySelectorAll(SELECTORS.checkbox));
  }

  function getCheckedCheckboxes() {
    return getCheckboxes().filter((checkbox) => checkbox.checked);
  }

  function getOptionFromCheckbox(checkbox) {
    return checkbox.closest(SELECTORS.option);
  }

  function getPeerFromCheckbox(checkbox) {
    const option = getOptionFromCheckbox(checkbox);

    if (!option) {
      return null;
    }

    const code = String(checkbox.value ?? "").trim();

    if (!code) {
      return null;
    }

    const name =
      option
        .querySelector(".peer-comparison__option-name")
        ?.textContent?.trim() || code;

    return {
      code,
      name,
    };
  }

  function getSelectedPeers() {
    return getCheckedCheckboxes().map(getPeerFromCheckbox).filter(Boolean);
  }

  function getStoredPeers() {
    return getCheckboxes()
      .filter((checkbox) => selectedPeerCodes.has(checkbox.value))
      .map(getPeerFromCheckbox)
      .filter(Boolean);
  }

  /* ==========================================================================
     Stored Selection
     ========================================================================== */

  function storeCurrentSelection() {
    selectedPeerCodes.clear();

    for (const checkbox of getCheckedCheckboxes()) {
      selectedPeerCodes.add(checkbox.value);
    }
  }

  function restoreStoredSelection() {
    for (const checkbox of getCheckboxes()) {
      checkbox.checked = selectedPeerCodes.has(checkbox.value);
    }
  }

  function clearStoredSelection() {
    selectedPeerCodes.clear();

    for (const checkbox of getCheckboxes()) {
      checkbox.checked = false;
      checkbox.disabled = false;
    }
  }

  function removeStoredPeer(code) {
    selectedPeerCodes.delete(code);

    const checkbox = getCheckboxes().find(
      (item) => String(item.value) === String(code),
    );

    if (checkbox) {
      checkbox.checked = false;
      checkbox.disabled = false;
    }
  }

  /* ==========================================================================
     Selection UI
     ========================================================================== */

  function hideSelectionError() {
    if (dom.error) {
      dom.error.hidden = true;
    }
  }

  function showSelectionError() {
    if (dom.error) {
      dom.error.hidden = false;
    }
  }

  function updateCount() {
    if (!dom.count) {
      return;
    }

    const total = getCheckedCheckboxes().length;

    const ofLabel = getLabel("of", "of");

    const selectedLabel = getLabel("selected", "selected");

    dom.count.textContent = `${total} ${ofLabel} ${MAX_SELECTION} ${selectedLabel}`;
  }

  function updateSubmitState() {
    if (!dom.submit) {
      return;
    }

    const total = getCheckedCheckboxes().length;

    dom.submit.disabled = total < MIN_SELECTION || total > MAX_SELECTION;
  }

  function updateDisabledCheckboxes() {
    const total = getCheckedCheckboxes().length;

    const full = total >= MAX_SELECTION;

    for (const checkbox of getCheckboxes()) {
      checkbox.disabled = full && !checkbox.checked;
    }
  }

  function updateSelectionUI() {
    updateCount();
    updateSubmitState();
    updateDisabledCheckboxes();
  }

  /* ==========================================================================
     Search
     ========================================================================== */

  function resetSearch() {
    if (!dom.search) {
      return;
    }

    dom.search.value = "";

    filterOptions();
  }

  function filterOptions() {
    if (!dom.search) {
      return;
    }

    const query = normalizeText(dom.search.value);

    let visibleCount = 0;

    for (const option of getOptions()) {
      const searchableText = normalizeText(option.textContent);

      const visible = !query || searchableText.includes(query);

      option.hidden = !visible;

      if (visible) {
        visibleCount += 1;
      }
    }

    if (dom.empty) {
      dom.empty.hidden = visibleCount !== 0;
    }
  }

  /* ==========================================================================
     Modal Preparation
     ========================================================================== */

  function prepareModal() {
    restoreStoredSelection();

    hideSelectionError();
    resetSearch();
    updateSelectionUI();
  }

  function observeModalState() {
    if (!dom.modal) {
      return;
    }

    const update = () => {
      const open =
        dom.modal.getAttribute("aria-hidden") === "false" ||
        dom.modal.classList.contains("is-open");

      if (open && !modalWasOpen) {
        prepareModal();
      }

      modalWasOpen = open;
    };

    const observer = new MutationObserver(update);

    observer.observe(dom.modal, {
      attributes: true,

      attributeFilter: ["aria-hidden", "class"],
    });

    update();
  }

  /* ==========================================================================
     Selection Change
     ========================================================================== */

  function handleSelectionChange(event) {
    if (!isElement(event.target)) {
      return;
    }

    const checkbox = event.target.closest(SELECTORS.checkbox);

    if (!checkbox) {
      return;
    }

    const checked = getCheckedCheckboxes();

    if (checked.length > MAX_SELECTION) {
      checkbox.checked = false;

      showSelectionError();
    } else {
      hideSelectionError();
    }

    storeCurrentSelection();
    updateSelectionUI();
  }

  /* ==========================================================================
     Result Peer Markup
     ========================================================================== */

  function getSelectedPeerMarkup(peers) {
    return peers
      .map(
        (peer) => `
          <li
            class="peer-comparison-result__peer"
            data-peer-result-peer="${escapeHTML(peer.code)}"
          >
            <span class="peer-comparison-result__peer-name">
              ${escapeHTML(peer.name)}
            </span>

            <span class="peer-comparison-result__peer-code">
              ${escapeHTML(peer.code)}
            </span>

            <button
              type="button"
              class="peer-comparison-result__peer-remove"
              data-peer-remove="${escapeHTML(peer.code)}"
              aria-label="Remove ${escapeHTML(peer.name)} from comparison"
              title="Remove ${escapeHTML(peer.name)}"
            >
              <span aria-hidden="true">
                ×
              </span>
            </button>
          </li>
        `,
      )
      .join("");
  }

  /* ==========================================================================
     Result Shell
     ========================================================================== */

  function getResultShell(peers) {
    const tableLabel = getLabel("table", "Table");

    const graphLabel = getLabel("graph", "Graph");

    const loadingLabel = getLabel("loading", "Loading");

    return `
      <div class="peer-comparison-result__content">
        <!-- ===============================================================
             Header
             =============================================================== -->

        <header class="peer-comparison-result__header">
          <div class="peer-comparison-result__heading">
            <p class="peer-comparison-result__eyebrow">
              ${escapeHTML(getLabel("peerCompare", "Peer Comparison"))}
            </p>

            <h2 class="peer-comparison-result__title">
              Market index comparison
            </h2>

            <p class="peer-comparison-result__description">
              Compare the selected indices with the Main Market.
            </p>
          </div>

          <button
            type="button"
            class="btn btn-outline-primary"
            data-peer-result-close
          >
            Close comparison
          </button>
        </header>

        <!-- ===============================================================
             Selected Peers
             =============================================================== -->

        <div class="peer-comparison-result__selection">
          <p class="peer-comparison-result__selection-label">
            Selected indices
          </p>

          <ul
            class="peer-comparison-result__peers"
            aria-label="Selected comparison indices"
          >
            ${getSelectedPeerMarkup(peers)}
          </ul>
        </div>

        <!-- ===============================================================
             Views
             =============================================================== -->

        <div
          class="tabs tabs--contained"
          data-tabs
        >
          <div
            class="tabs-nav"
            role="tablist"
            aria-label="Peer comparison view"
          >
            <button
              class="tab-link active"
              type="button"
              role="tab"
              aria-selected="true"
              data-tab="table"
              data-tab-target="${IDS.tablePanel}"
            >
              ${escapeHTML(tableLabel)}
            </button>

            <button
              class="tab-link"
              type="button"
              role="tab"
              aria-selected="false"
              data-tab="graph"
              data-tab-target="${IDS.graphPanel}"
            >
              ${escapeHTML(graphLabel)}
            </button>
          </div>

          <div class="tabs-content">
            <!-- ===========================================================
                 Table
                 =========================================================== -->

            <div
              id="${IDS.tablePanel}"
              class="tab-pane active"
              role="tabpanel"
            >
              <div
                class="peer-comparison-result__table"
                data-peer-table
                aria-busy="true"
              >
                <div class="peer-comparison-result__placeholder">
                  ${escapeHTML(loadingLabel)}...
                </div>
              </div>
            </div>

            <!-- ===========================================================
                 Graph
                 =========================================================== -->

            <div
              id="${IDS.graphPanel}"
              class="tab-pane"
              role="tabpanel"
              hidden
            >
              <div
                class="peer-comparison-result__graph"
                data-peer-graph
                aria-busy="true"
              >
                <div class="peer-comparison-result__placeholder">
                  ${escapeHTML(loadingLabel)}...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================================
     Feature Events
     ========================================================================== */

  function dispatchFeatureEvent(name, detail = {}) {
    if (!dom.result) {
      return;
    }

    dom.result.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,

        detail: Object.freeze({
          ...detail,
        }),
      }),
    );
  }

  function dispatchLoading(peers) {
    dispatchFeatureEvent(EVENTS.loading, {
      peers,
    });
  }

  function dispatchRender(peers, rows) {
    dispatchFeatureEvent(EVENTS.render, {
      peers,

      rows,
    });
  }

  function dispatchError(peers, error) {
    dispatchFeatureEvent(EVENTS.error, {
      peers,

      error,
    });
  }

  function dispatchClear() {
    dispatchFeatureEvent(EVENTS.clear, {
      peers: [],
      rows: [],
    });
  }

  /* ==========================================================================
     API Configuration
     ========================================================================== */

  function getEndpoint() {
    return String(CONFIG.endpoint ?? CONFIG.apiUrl ?? "").trim();
  }

  function getAjaxMethod() {
    return String(CONFIG.ajaxMethod ?? "GET")
      .trim()
      .toUpperCase();
  }

  function getBaseSymbol() {
    return String(CONFIG.companySymbol ?? "").trim();
  }

  /* ==========================================================================
     Summary Response Envelope
     ========================================================================== */

  /**
   * Keep this intentionally narrow.
   *
   * Legacy API supported:
   *
   *   [...]
   *
   * or:
   *
   *   { data: [...] }
   *
   * Field-level normalization belongs in PeerComparisonUtils.
   */

  function unwrapSummaryRows(response) {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.data)) {
      return response.data;
    }

    return [];
  }

  /* ==========================================================================
     Summary Request
     ========================================================================== */

  function cancelSummaryRequest() {
    requestController?.abort();

    requestController = null;
  }

  function createSummaryParameters(peers) {
    return {
      companySymbol: getBaseSymbol(),

      peerID: peers.map((peer) => peer.code).join(","),
    };
  }

  async function fetchPeerSummary(peers) {
    const endpoint = getEndpoint();

    if (!endpoint) {
      throw new Error("Peer comparison endpoint is missing.");
    }

    cancelSummaryRequest();

    const controller = new AbortController();

    requestController = controller;

    const currentRequestId = ++requestId;

    const method = getAjaxMethod();

    const parameters = createSummaryParameters(peers);

    const options = {
      method,

      headers: {
        Accept: "application/json",
      },

      credentials: "same-origin",

      signal: controller.signal,
    };

    let url = new URL(endpoint, window.location.href);

    if (method === "GET" || method === "HEAD") {
      for (const [key, value] of Object.entries(parameters)) {
        url.searchParams.set(key, value);
      }
    } else {
      options.headers["Content-Type"] =
        "application/x-www-form-urlencoded; charset=UTF-8";

      options.body = new URLSearchParams(parameters).toString();
    }

    const response = await fetch(url.toString(), options);

    if (currentRequestId !== requestId) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `Peer comparison request failed with HTTP ${response.status}.`,
      );
    }

    const contentType = response.headers.get("content-type") || "";

    let payload;

    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      const text = await response.text();

      if (!text.trim()) {
        payload = [];
      } else {
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error(
            "Peer comparison API returned an invalid JSON response.",
          );
        }
      }
    }

    if (currentRequestId !== requestId) {
      return null;
    }

    return unwrapSummaryRows(payload);
  }

  /* ==========================================================================
     Result State
     ========================================================================== */

  function setResultBusy(busy) {
    if (!dom.result) {
      return;
    }

    dom.result.setAttribute("aria-busy", String(Boolean(busy)));

    const table = dom.result.querySelector("[data-peer-table]");

    const graph = dom.result.querySelector("[data-peer-graph]");

    table?.setAttribute("aria-busy", String(Boolean(busy)));

    graph?.setAttribute("aria-busy", String(Boolean(busy)));
  }

  /* ==========================================================================
     Result Rendering
     ========================================================================== */

  async function showResult(peers, { scroll = true } = {}) {
    if (!dom.result || !dom.resultInner) {
      return;
    }

    if (!Array.isArray(peers) || peers.length < MIN_SELECTION) {
      clearResult({
        clearSelection: false,
      });

      return;
    }

    /*
     * Build the UI first so the user receives immediate loading feedback.
     */

    dom.resultInner.innerHTML = getResultShell(peers);

    dom.result.hidden = false;

    setResultBusy(true);

    dispatchLoading(peers);

    if (scroll) {
      window.requestAnimationFrame(() => {
        dom.result?.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",

          block: "start",
        });
      });
    }

    try {
      const rows = await fetchPeerSummary(peers);

      /*
       * Null means the request was superseded by a newer selection.
       */

      if (rows === null) {
        return;
      }

      setResultBusy(false);

      dispatchRender(peers, rows);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      console.error("Peer comparison summary request failed.", error);

      setResultBusy(false);

      dispatchError(peers, error);
    }
  }

  function clearResult({ clearSelection = true } = {}) {
    cancelSummaryRequest();

    /*
     * Invalidate any request that might have completed immediately before
     * AbortController was observed.
     */

    requestId += 1;

    if (!dom.result || !dom.resultInner) {
      return;
    }

    if (clearSelection) {
      clearStoredSelection();

      updateSelectionUI();
    }

    dom.result.hidden = true;

    dom.result.removeAttribute("aria-busy");

    dom.resultInner.replaceChildren();

    dispatchClear();
  }

  /* ==========================================================================
     Modal Submit
     ========================================================================== */

  function closeModalThroughRuntime() {
    const closeButton = dom.modal?.querySelector("[data-modal-close]");

    closeButton?.click();
  }

  function handleSubmit() {
    const peers = getSelectedPeers();

    if (peers.length < MIN_SELECTION) {
      updateSelectionUI();

      return;
    }

    if (peers.length > MAX_SELECTION) {
      showSelectionError();

      return;
    }

    storeCurrentSelection();

    hideSelectionError();

    void showResult(peers);

    closeModalThroughRuntime();
  }

  /* ==========================================================================
     Peer Removal
     ========================================================================== */

  function removePeer(code) {
    const normalizedCode = String(code ?? "").trim();

    if (!normalizedCode) {
      return;
    }

    removeStoredPeer(normalizedCode);

    restoreStoredSelection();

    hideSelectionError();
    updateSelectionUI();

    const remainingPeers = getStoredPeers();

    /*
     * A comparison requires at least two selected peers.
     *
     * Preserve the remaining single selection in the modal so the user can
     * reopen it and add another peer.
     */

    if (remainingPeers.length < MIN_SELECTION) {
      clearResult({
        clearSelection: false,
      });

      return;
    }

    /*
     * A changed selection requires a fresh summary response.
     */

    void showResult(remainingPeers, {
      scroll: false,
    });
  }

  /* ==========================================================================
     Result Actions
     ========================================================================== */

  function handleResultClick(event) {
    if (!isElement(event.target)) {
      return;
    }

    const removeButton = event.target.closest(SELECTORS.peerRemove);

    if (removeButton) {
      removePeer(removeButton.dataset.peerRemove);

      return;
    }

    const closeButton = event.target.closest(SELECTORS.resultClose);

    if (!closeButton) {
      return;
    }

    clearResult({
      clearSelection: true,
    });
  }

  /* ==========================================================================
     Search Form
     ========================================================================== */

  function handleSearchSubmit(event) {
    event.preventDefault();

    filterOptions();
  }

  /* ==========================================================================
     Event Binding
     ========================================================================== */

  function bindEvents() {
    dom.selection?.addEventListener("change", handleSelectionChange);

    dom.search?.addEventListener("input", filterOptions);

    dom.searchForm?.addEventListener("submit", handleSearchSubmit);

    dom.submit?.addEventListener("click", handleSubmit);

    dom.result?.addEventListener("click", handleResultClick);

    window.addEventListener("pagehide", () => {
      cancelSummaryRequest();
    });
  }

  /* ==========================================================================
     DOM Resolution
     ========================================================================== */

  function resolveDOM() {
    dom.modal = document.querySelector(SELECTORS.modal);

    if (!dom.modal) {
      return false;
    }

    dom.selection = dom.modal.querySelector(SELECTORS.selection);

    if (!dom.selection) {
      return false;
    }

    dom.searchForm = dom.modal.querySelector(SELECTORS.searchForm);

    dom.search = dom.selection.querySelector(SELECTORS.search);

    dom.empty = dom.selection.querySelector(SELECTORS.empty);

    dom.error = dom.selection.querySelector(SELECTORS.error);

    dom.count = dom.selection.querySelector(SELECTORS.count);

    dom.submit = dom.selection.querySelector(SELECTORS.submit);

    dom.result = document.querySelector(SELECTORS.result);

    dom.resultInner = document.querySelector(SELECTORS.resultInner);

    return Boolean(dom.result && dom.resultInner);
  }

  /* ==========================================================================
     Configuration Validation
     ========================================================================== */

  function validateConfiguration() {
    if (!getEndpoint()) {
      console.warn("Peer comparison endpoint is not configured.");
    }

    if (!getBaseSymbol()) {
      console.warn("Peer comparison base company symbol is not configured.");
    }

    if (MIN_SELECTION < 1 || MAX_SELECTION < MIN_SELECTION) {
      console.error("Peer comparison selection limits are invalid.", {
        min: MIN_SELECTION,

        max: MAX_SELECTION,
      });

      return false;
    }

    return true;
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  function initialize() {
    if (!resolveDOM()) {
      return;
    }

    if (!validateConfiguration()) {
      return;
    }

    clearStoredSelection();

    hideSelectionError();
    resetSearch();
    updateSelectionUI();

    bindEvents();
    observeModalState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {
      once: true,
    });
  } else {
    initialize();
  }
})();
