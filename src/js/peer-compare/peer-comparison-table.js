/* ==========================================================================
   Peer Comparison Table
   ========================================================================== */

/**
 * Peer comparison summary table.
 *
 * Owns:
 *
 * - loading state;
 * - real API summary-row rendering;
 * - empty state;
 * - error state;
 * - financial movement presentation;
 * - base-company / selected-peer ordering.
 *
 * Does not own:
 *
 * - peer selection;
 * - modal behavior;
 * - tabs;
 * - network requests;
 * - chart rendering;
 * - backend-field normalization.
 */

(() => {
  "use strict";

  /* ==========================================================================
     Dependencies
     ========================================================================== */

  const U = window.PeerComparisonUtils;

  if (!U) {
    console.error("PeerComparisonTable requires window.PeerComparisonUtils.");

    return;
  }

  /* ==========================================================================
     Selectors
     ========================================================================== */

  const SELECTORS = Object.freeze({
    table: "[data-peer-table]",
  });

  const EVENTS = Object.freeze({
    loading: "peercomparison:loading",

    render: "peercomparison:render",

    error: "peercomparison:error",

    clear: "peercomparison:clear",
  });

  /* ==========================================================================
     General Helpers
     ========================================================================== */

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getRoot() {
    return document.querySelector(SELECTORS.table);
  }

  function getLabel(key, fallback) {
    return U.getLabel(key, fallback);
  }

  /* ==========================================================================
     Peer Name Resolution
     ========================================================================== */

  /**
   * The summary API may not always return the display label used by the
   * selection list.
   *
   * Prefer:
   *
   * 1. configured base-company name;
   * 2. selected modal label;
   * 3. API-provided name;
   * 4. symbol.
   */

  function buildNameMap(peers) {
    const map = new Map();

    for (const peer of U.normalizePeers(peers)) {
      map.set(peer.code, peer.name);
    }

    const baseSymbol = U.getBaseCompanySymbol();

    const baseName = U.getBaseCompanyName();

    if (baseSymbol) {
      map.set(baseSymbol, baseName || baseSymbol);
    }

    return map;
  }

  function resolveRecordName(record, names) {
    return names.get(record.symbol) || record.name || record.symbol;
  }

  /* ==========================================================================
     Row Ordering
     ========================================================================== */

  /**
   * Backend summary results may not arrive in UI order.
   *
   * Desired order:
   *
   * - base company first when returned;
   * - selected peers in their selected order;
   * - any unexpected extra rows last.
   */

  function orderRecords(records, peers) {
    const selectedOrder = U.normalizePeers(peers).map((peer) => peer.code);

    const baseSymbol = U.getBaseCompanySymbol();

    const rank = new Map();

    let position = 0;

    if (baseSymbol) {
      rank.set(baseSymbol, position);

      position += 1;
    }

    for (const code of selectedOrder) {
      if (rank.has(code)) {
        continue;
      }

      rank.set(code, position);

      position += 1;
    }

    return [...records].sort((a, b) => {
      const aRank = rank.has(a.symbol)
        ? rank.get(a.symbol)
        : Number.MAX_SAFE_INTEGER;

      const bRank = rank.has(b.symbol)
        ? rank.get(b.symbol)
        : Number.MAX_SAFE_INTEGER;

      return aRank - bRank;
    });
  }

  /* ==========================================================================
     Financial Movement
     ========================================================================== */

  function getMovementMarkup(value) {
    const number = U.toFiniteNumber(value);

    if (number === null) {
      return `
        <span class="price-neutral">
          —
        </span>
      `;
    }

    const className = U.getPriceStateClass(number);

    const symbol = U.getDirectionSymbol(number);

    const formatted = U.formatPercent(Math.abs(number), {
      absolute: true,
    });

    return `
      <span
        class="
          peer-comparison-table__change
          ${className}
        "
      >
        ${
          symbol
            ? `
              <span
                class="peer-comparison-table__direction"
                aria-hidden="true"
              >
                ${symbol}
              </span>
            `
            : ""
        }

        <span class="peer-comparison-table__change-value">
          ${escapeHTML(formatted)}
        </span>
      </span>
    `;
  }

  /* ==========================================================================
     Market Cap
     ========================================================================== */

  /**
   * The legacy config exposes a "market cap million" label.
   *
   * Preserve the API value as supplied here instead of silently dividing it.
   * If the endpoint already returns millions, the label remains correct.
   *
   * If production confirms the raw API is in full currency units, conversion
   * belongs in the normalization boundary rather than this renderer.
   */

  function formatMarketCap(value) {
    return U.formatNumber(value, {
      maximumFractionDigits: 2,

      minimumFractionDigits: 2,
    });
  }

  /* ==========================================================================
     Instrument Markup
     ========================================================================== */

  function getInstrumentMarkup(record, names) {
    const name = resolveRecordName(record, names);

    return `
      <div class="peer-comparison-table__instrument">
        <span class="peer-comparison-table__name">
          ${escapeHTML(name)}
        </span>

        <span class="peer-comparison-table__code">
          ${escapeHTML(record.symbol)}
        </span>
      </div>
    `;
  }

  /* ==========================================================================
     Row Markup
     ========================================================================== */

  function getRowMarkup(record, names) {
    return `
      <tr
        data-peer-row="${escapeHTML(record.symbol)}"
      >
        <th scope="row">
          ${getInstrumentMarkup(record, names)}
        </th>

        <td class="table-market__number">
          ${escapeHTML(U.formatNumber(record.sharePrice))}
        </td>

        <td class="table-market__number">
          ${getMovementMarkup(record.return)}
        </td>

        <td class="table-market__number">
          ${escapeHTML(formatMarketCap(record.marketCap))}
        </td>

        <td class="table-market__number">
          ${escapeHTML(U.formatNumber(record.peRatio))}
        </td>
      </tr>
    `;
  }

  /* ==========================================================================
     Table Markup
     ========================================================================== */

  function getTableMarkup(records, peers) {
    const names = buildNameMap(peers);

    const rows = records.map((record) => getRowMarkup(record, names)).join("");

    return `
      <div class="peer-comparison-table">
        <div class="table-responsive">
          <table
            class="
              table
              table-market
              table-market--results
            "
          >
            <caption class="visually-hidden">
              ${escapeHTML(getLabel("peerCompare", "Peer comparison"))}
            </caption>

            <thead>
              <tr>
                <th scope="col">
                  ${escapeHTML(getLabel("indexName", "Index name"))}
                </th>

                <th
                  scope="col"
                  class="table-market__number"
                >
                  ${escapeHTML(getLabel("sharePrice", "Share price"))}
                </th>

                <th
                  scope="col"
                  class="table-market__number"
                >
                  ${escapeHTML(getLabel("return1D", "Return"))}
                </th>

                <th
                  scope="col"
                  class="table-market__number"
                >
                  ${escapeHTML(getLabel("marketCapMillion", "Market cap"))}
                </th>

                <th
                  scope="col"
                  class="table-market__number"
                >
                  ${escapeHTML(getLabel("peRatio", "P/E ratio"))}
                </th>
              </tr>
            </thead>

            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* ==========================================================================
     Loading State
     ========================================================================== */

  function renderLoading() {
    const root = getRoot();

    if (!root) {
      return;
    }

    root.setAttribute("aria-busy", "true");

    root.innerHTML = `
      <div class="peer-comparison-result__placeholder">
        ${escapeHTML(getLabel("loading", "Loading"))}...
      </div>
    `;
  }

  /* ==========================================================================
     Empty State
     ========================================================================== */

  function renderEmpty() {
    const root = getRoot();

    if (!root) {
      return;
    }

    root.setAttribute("aria-busy", "false");

    root.innerHTML = `
      <p class="peer-comparison-table__empty">
        ${escapeHTML(getLabel("noResults", "No data available."))}
      </p>
    `;
  }

  /* ==========================================================================
     Error State
     ========================================================================== */

  function renderError() {
    const root = getRoot();

    if (!root) {
      return;
    }

    root.setAttribute("aria-busy", "false");

    root.innerHTML = `
      <div
        class="peer-comparison-table__error"
        role="alert"
      >
        Unable to load peer comparison data.
      </div>
    `;
  }

  /* ==========================================================================
     Real Data Rendering
     ========================================================================== */

  function render(rows, peers) {
    const root = getRoot();

    if (!root) {
      return;
    }

    const normalized = U.normalizeSummaryRows(rows);

    const ordered = orderRecords(normalized, peers);

    root.setAttribute("aria-busy", "false");

    if (!ordered.length) {
      renderEmpty();

      return;
    }

    root.innerHTML = getTableMarkup(ordered, peers);
  }

  /* ==========================================================================
     Clear
     ========================================================================== */

  function clear() {
    const root = getRoot();

    if (!root) {
      return;
    }

    root.removeAttribute("aria-busy");

    root.replaceChildren();
  }

  /* ==========================================================================
     Events
     ========================================================================== */

  function handleLoading() {
    renderLoading();
  }

  function handleRender(event) {
    render(
      event.detail?.rows ?? [],

      event.detail?.peers ?? [],
    );
  }

  function handleError() {
    renderError();
  }

  function bindEvents() {
    document.addEventListener(EVENTS.loading, handleLoading);

    document.addEventListener(EVENTS.render, handleRender);

    document.addEventListener(EVENTS.error, handleError);

    document.addEventListener(EVENTS.clear, clear);
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  function initialize() {
    bindEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {
      once: true,
    });
  } else {
    initialize();
  }
})();
