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
 * - service-row ordering;
 * - display-name resolution;
 * - empty state;
 * - error state;
 * - financial movement presentation.
 *
 * Does not own:
 *
 * - peer selection;
 * - modal behavior;
 * - network requests;
 * - chart rendering;
 * - comparison colors;
 * - backend-field normalization;
 * - synthetic/default comparison rows.
 *
 * Important:
 *
 * The comparison service is the only source of table rows.
 *
 * This module never creates a Main Market row or any other missing record.
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
     Comparison Identity
     ========================================================================== */

  /**
   * Build identity metadata only.
   *
   * This is useful for:
   *
   * - display names;
   * - service-row ordering.
   *
   * It does NOT create table rows.
   */

  function normalizeComparisonRoster(roster, peers) {
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
      roster.forEach(add);

      return result;
    }

    /*
     * Compatibility fallback.
     *
     * Identity only — still no financial record creation.
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
     Service Records
     ========================================================================== */

  /**
   * Only normalized records returned by the service are rendered.
   *
   * The comparison roster is used only to provide:
   *
   * - preferred display name;
   * - preferred ordering.
   */

  function prepareServiceRecords(rows, roster) {
    const records = U.normalizeSummaryRows(rows);

    if (!records.length) {
      return [];
    }

    const identityByCode = new Map(
      roster.map((instrument) => [instrument.code, instrument]),
    );

    const rankByCode = new Map(
      roster.map((instrument, index) => [instrument.code, index]),
    );

    return records
      .map((record) => {
        const identity = identityByCode.get(record.symbol);

        return {
          ...record,

          name: identity?.name || record.name || record.symbol,

          isBase: Boolean(identity?.isBase || record.isBase),
        };
      })
      .sort((a, b) => {
        const aRank = rankByCode.has(a.symbol)
          ? rankByCode.get(a.symbol)
          : Number.MAX_SAFE_INTEGER;

        const bRank = rankByCode.has(b.symbol)
          ? rankByCode.get(b.symbol)
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
     Instrument
     ========================================================================== */

  function getInstrumentMarkup(record) {
    return `
      <div class="peer-comparison-table__instrument">
        <span class="peer-comparison-table__name">
          ${escapeHTML(record.name || record.symbol)}
        </span>

        <span class="peer-comparison-table__code">
          ${escapeHTML(record.symbol)}
        </span>
      </div>
    `;
  }

  /* ==========================================================================
     Row
     ========================================================================== */

  function getRowMarkup(record) {
    return `
      <tr
        class="peer-comparison-table__row"
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
     Table
     ========================================================================== */

  function getTableMarkup(records) {
    const body = records.map(getRowMarkup).join("");

    return `
      <div
        class="
          table-responsive
          peer-comparison-table
        "
        role="region"
        aria-label="${escapeHTML(getLabel("peerCompare", "Peer comparison"))}"
        tabindex="0"
      >
        <table
          class="
            table
            table-hover
            table-market
            table-market--results
            peer-comparison-table__table
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
            ${body}
          </tbody>
        </table>
      </div>
    `;
  }

  /* ==========================================================================
     Loading
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
     Empty
     ========================================================================== */

  function renderEmpty() {
    const root = getRoot();

    if (!root) {
      return;
    }

    root.setAttribute("aria-busy", "false");

    root.innerHTML = `
      <div class="peer-comparison-table__empty">
        ${escapeHTML(getLabel("noResults", "No data available."))}
      </div>
    `;
  }

  /* ==========================================================================
     Error
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
     Render
     ========================================================================== */

  function render(rows, comparisonRoster, peers) {
    const root = getRoot();

    if (!root) {
      return;
    }

    const roster = normalizeComparisonRoster(comparisonRoster, peers);

    const records = prepareServiceRecords(rows, roster);

    root.setAttribute("aria-busy", "false");

    if (!records.length) {
      renderEmpty();

      return;
    }

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
     Event Handlers
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

  /* ==========================================================================
     Binding
     ========================================================================== */

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
