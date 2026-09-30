/* ==========================================================================
   Peer Comparison Table
   ========================================================================== */

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

  /* ==========================================================================
     Events
     ========================================================================== */

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
     Comparison Roster
     ========================================================================== */

  /**
   * Prefer the canonical comparison roster dispatched by peer-comparison.js.
   *
   * It already contains:
   *
   *   base/original index
   *   + selected peers
   *
   * The fallback exists only for defensive compatibility.
   */

  function normalizeRoster(roster, peers) {
    const result = [];

    const seen = new Set();

    const add = ({ code, name, isBase = false } = {}) => {
      const normalizedCode = U.normalizeCode(code);

      if (!normalizedCode || seen.has(normalizedCode)) {
        return;
      }

      result.push({
        code: normalizedCode,

        name: String(name || normalizedCode).trim(),

        isBase: Boolean(isBase),
      });

      seen.add(normalizedCode);
    };

    if (Array.isArray(roster) && roster.length) {
      for (const item of roster) {
        add(item);
      }

      return result;
    }

    /*
     * Defensive fallback.
     */

    const baseSymbol = U.getBaseCompanySymbol();

    if (baseSymbol) {
      add({
        code: baseSymbol,

        name: U.getBaseCompanyName() || baseSymbol,

        isBase: true,
      });
    }

    for (const peer of U.normalizePeers(peers)) {
      add({
        ...peer,

        isBase: false,
      });
    }

    return result;
  }

  /* ==========================================================================
     Summary Lookup
     ========================================================================== */

  function createSummaryMap(rows) {
    const records = U.normalizeSummaryRows(rows);

    return new Map(records.map((record) => [record.symbol, record]));
  }

  /**
   * The roster is authoritative for which instruments appear.
   *
   * The summary API is authoritative for values.
   *
   * If the API omits one roster member, we keep the instrument visible but
   * render unavailable values as "—". We never invent financial data.
   */

  function mergeRosterWithRows(roster, rows) {
    const summaries = createSummaryMap(rows);

    return roster.map((instrument) => {
      const record = summaries.get(instrument.code);

      if (record) {
        return {
          ...record,

          symbol: instrument.code,

          code: instrument.code,

          name: instrument.name || record.name || instrument.code,

          isBase: instrument.isBase || record.isBase,
        };
      }

      return {
        symbol: instrument.code,

        code: instrument.code,

        name: instrument.name || instrument.code,

        isBase: instrument.isBase,

        sharePrice: null,

        return: null,

        marketCap: null,

        peRatio: null,

        raw: null,

        unavailable: true,
      };
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
                ${escapeHTML(symbol)}
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
     Instrument Presentation
     ========================================================================== */

  function getInstrumentMarkup(record) {
    const baseBadge = record.isBase
      ? `
          <span class="peer-comparison-table__base-label">
            Main
          </span>
        `
      : "";

    return `
      <div class="peer-comparison-table__instrument">
        <div class="peer-comparison-table__instrument-main">
          <span class="peer-comparison-table__name">
            ${escapeHTML(record.name || record.symbol)}
          </span>

          ${baseBadge}
        </div>

        <span class="peer-comparison-table__code">
          ${escapeHTML(record.symbol)}
        </span>
      </div>
    `;
  }

  /* ==========================================================================
     Row Markup
     ========================================================================== */

  function getRowMarkup(record) {
    const baseClass = record.isBase ? " peer-comparison-table__row--base" : "";

    const unavailableClass = record.unavailable
      ? " peer-comparison-table__row--unavailable"
      : "";

    return `
      <tr
        class="peer-comparison-table__row${baseClass}${unavailableClass}"
        data-peer-row="${escapeHTML(record.symbol)}"
        data-peer-base="${record.isBase ? "true" : "false"}"
      >
        <th scope="row">
          ${getInstrumentMarkup(record)}
        </th>

        <td class="table-market__number">
          ${escapeHTML(U.formatNumber(record.sharePrice))}
        </td>

        <td class="table-market__number">
          ${getMovementMarkup(record.return)}
        </td>
      </tr>
    `;
  }

  /* ==========================================================================
     Table Markup
     ========================================================================== */

  function getTableMarkup(records) {
    const rows = records.map(getRowMarkup).join("");

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
                  ${escapeHTML(getLabel("indexName", "Index Name"))}
                </th>

                <th
                  scope="col"
                  class="table-market__number"
                >
                  ${escapeHTML(getLabel("value", "Index Value"))}
                </th>

                <th
                  scope="col"
                  class="table-market__number"
                >
                  ${escapeHTML(getLabel("return1D", "1D Return"))}
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
      <div
        class="peer-comparison-result__placeholder"
        role="status"
        aria-live="polite"
      >
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
      <div class="peer-comparison-table__empty">
        <p>
          ${escapeHTML(getLabel("noResults", "No comparison data available."))}
        </p>
      </div>
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

  function render(rows, comparisonRoster, peers) {
    const root = getRoot();

    if (!root) {
      return;
    }

    const roster = normalizeRoster(comparisonRoster, peers);

    root.setAttribute("aria-busy", "false");

    if (!roster.length) {
      renderEmpty();

      return;
    }

    const records = mergeRosterWithRows(roster, rows);

    root.innerHTML = getTableMarkup(records);
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

      event.detail?.comparisonRoster ?? [],

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
