/* ==========================================================================
   Theoretical Opening Cards
   ========================================================================== */

import { createDataCards } from "../../common/data-view/index.js";

import {
  escapeHtml,
  formatTheoreticalPrice,
  formatTheoreticalQuantity,
} from "../shared/theoretical-opening.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const CARDS_SELECTOR = "[data-theoretical-opening-mobile-cards]";

const VIEW = "1";

const DEFAULT_SECTOR = "Other";

/* ==========================================================================
   Helpers
   ========================================================================== */

function getSectorName(row) {
  return String(row?.sectorName ?? "").trim() || DEFAULT_SECTOR;
}

function renderCompanyName(row) {
  const companyName = row?.companyName || "-";

  const companyUrl = row?.companyUrl || "";

  if (!companyUrl || companyUrl === "#") {
    return escapeHtml(companyName);
  }

  return (
    `<a href="${escapeHtml(companyUrl)}" ` +
    'class="stock-name-link">' +
    escapeHtml(companyName) +
    "</a>"
  );
}

/* ==========================================================================
   Card Fields
   ========================================================================== */

function renderDetailField(label, value) {
  return (
    '<div class="mobile-field-cell">' +
    "<label>" +
    escapeHtml(label) +
    "</label>" +
    "<label>" +
    escapeHtml(value) +
    "</label>" +
    "</div>"
  );
}

/* ==========================================================================
   Card
   ========================================================================== */

function renderCard(row, config) {
  const labels = config.labels?.table || {};

  const companyCode = row?.companyCode || "-";

  const top = formatTheoreticalPrice(row?.theoreticalOpeningPrice);

  const tov = formatTheoreticalQuantity(
    row?.theoreticalOpeningVolume,
    config.locale,
  );

  const previousClose = formatTheoreticalPrice(row?.previousClose);

  return (
    '<div class="company-wrapper">' +
    '<div class="company-card-box" data-company-card>' +
    /* ---------------------------------------------------------------
           Card Summary
           --------------------------------------------------------------- */

    '<div class="company-main" data-card-toggle>' +
    '<div class="company-name-value">' +
    '<label class="stock-number">' +
    escapeHtml(companyCode) +
    "</label>" +
    renderCompanyName(row) +
    "</div>" +
    '<div class="company-market-value">' +
    '<label class="current-market-value">' +
    escapeHtml(top) +
    "</label>" +
    '<label class="current-market-percent">' +
    escapeHtml(tov) +
    "</label>" +
    "</div>" +
    "</div>" +
    /* ---------------------------------------------------------------
           Expanded Details
           --------------------------------------------------------------- */

    '<div class="company-extra company-market-value">' +
    '<div class="mobile-field-group">' +
    '<div class="mobile-field-grid">' +
    renderDetailField(labels.previousClose || "Previous Close", previousClose) +
    renderDetailField(labels.top || "TOP", top) +
    renderDetailField(labels.tov || "TOV", tov) +
    "</div>" +
    "</div>" +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

/* ==========================================================================
   Sector Group
   ========================================================================== */

function renderSectorGroup({ groupKey, cards }) {
  return (
    '<div class="theoretical-opening-sector-group">' +
    '<div class="sector-title">' +
    escapeHtml(groupKey) +
    "</div>" +
    cards +
    "</div>"
  );
}

/* ==========================================================================
   Card Interaction
   ========================================================================== */

function createCardInteraction(container) {
  function handleClick(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    /*
     * Keep the same exclusions as the
     * existing implementation.
     */
    if (event.target.closest(".form-control-shell")) {
      return;
    }

    if (event.target.closest(".form-popover")) {
      return;
    }

    const toggle = event.target.closest("[data-card-toggle]");

    if (!toggle) {
      return;
    }

    /*
     * Do not expand/collapse when the
     * company link itself was clicked.
     */
    if (event.target.closest("a")) {
      return;
    }

    const card = toggle.closest("[data-company-card]");

    if (!card) {
      return;
    }

    const wasActive = card.classList.contains("active");

    /*
     * Only one card can be expanded
     * at a time.
     */
    container.querySelectorAll("[data-company-card].active").forEach((item) => {
      item.classList.remove("active");
    });

    if (!wasActive) {
      card.classList.add("active");
    }
  }

  container.addEventListener("click", handleClick);

  return function destroy() {
    container.removeEventListener("click", handleClick);
  };
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createTheoreticalOpeningCards({
  root = document,
  config = {},
} = {}) {
  const container = root.querySelector(CARDS_SELECTOR);

  const cards = createDataCards({
    root,

    container: CARDS_SELECTOR,

    initialView: VIEW,

    getGroupKey(row) {
      return getSectorName(row);
    },

    renderGroup(groupContext) {
      return renderSectorGroup(groupContext);
    },

    renderCard(row) {
      return renderCard(row, config);
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage:
      config.labels?.loadError ||
      config.labels?.noData ||
      "Unable to load data.",
  });

  /*
   * createDataCards owns data rendering.
   * This view owns card-specific interaction.
   */
  const destroyInteraction = container
    ? createCardInteraction(container)
    : null;

  return {
    ...cards,

    destroy() {
      destroyInteraction?.();

      cards.destroy();
    },
  };
}
