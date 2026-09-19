/* ==========================================================================
   Historical Reports Cards View
   ========================================================================== */

/*
 * Mobile/card presentation for Historical Reports.
 *
 * Net new: legacy has no mobile card presentation at all. Everything in
 * this file is new design, not a port -- flagged inline where a genuine
 * choice was made rather than an obvious mechanical translation.
 *
 * Responsibilities:
 *
 * - resolve mobile-visible columns per market/sector (Performance /
 *   Unadjusted) or the fixed column set (Underlying)
 * - render the Report card (date-row summary + detail fields)
 * - render the Underlying card (contract-identity summary + detail fields)
 *
 * This module intentionally has no:
 *
 * - request logic
 * - response normalization
 * - filter state
 * - DataTables lifecycle
 * - desktop table rendering
 * - page lifecycle
 *
 * Neither card view fetches its own data. historical.js forwards each
 * table's already-fetched rows to the matching cards instance here, the
 * same division of responsibility market-watch.cards.js uses.
 */

import {
  getHistoricalPerformanceAvailableGroups,
  getHistoricalPerformanceColumns,
  getHistoricalUnadjustedAvailableGroups,
  getHistoricalUnadjustedColumns,
  getHistoricalUnderlyingColumns,
} from "../historical.columns.js";

import { renderHistoricalCell, escapeHtml } from "../historical.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

/*
 * Columns shown in the Underlying card's identity/metadata line.
 *
 * instrument-type is already excluded via its own `mobile: false` flag in
 * historical.columns.js, matching how the desktop table treats it as
 * context rather than a per-row value.
 */
const UNDERLYING_SUMMARY_KEYS = Object.freeze(
  new Set(["symbol", "underlying", "type"]),
);

/* ==========================================================================
   Shared Helpers
   ========================================================================== */

function findColumn(columns, key) {
  return columns.find((column) => column.key === key) || null;
}

/* ==========================================================================
   Report Columns
   ========================================================================== */

function getReportColumns(view, filters, config) {
  if (view === "unadjusted") {
    const columns = getHistoricalUnadjustedColumns(config);

    const available = new Set(getHistoricalUnadjustedAvailableGroups(filters));

    return columns.filter(
      (column) =>
        !column.visibilityGroup || available.has(column.visibilityGroup),
    );
  }

  const columns = getHistoricalPerformanceColumns(config, filters);

  const available = new Set(getHistoricalPerformanceAvailableGroups(filters));

  return columns.filter(
    (column) =>
      !column.visibilityGroup || available.has(column.visibilityGroup),
  );
}

function getReportMobileColumns(view, filters, config) {
  return getReportColumns(view, filters, config).filter(
    (column) => column.mobile !== false,
  );
}

/* ==========================================================================
   Report Summary Columns
   ========================================================================== */

/*
 * Report cards always reserve these values for the compact summary:
 *
 * - Date
 * - Change
 * - % Change, when available
 *
 * The primary quote value is profile-dependent:
 *
 * - Close for normal Performance / Unadjusted profiles
 * - NAV when Close is not part of the active schema, notably Mutual Funds
 *
 * Keeping this schema-driven avoids hardcoding MF into the presentation
 * layer and naturally supports another future profile whose primary value
 * is NAV rather than Close.
 */

function getReportPrimaryValueColumn(columns) {
  return findColumn(columns, "close") || findColumn(columns, "nav");
}

function getReportSummaryKeys(columns) {
  const keys = new Set(["date", "change", "change-percent"]);

  const primaryValueColumn = getReportPrimaryValueColumn(columns);

  if (primaryValueColumn) {
    keys.add(primaryValueColumn.key);
  }

  return keys;
}

function getReportDetailColumns(view, filters, config) {
  const columns = getReportMobileColumns(view, filters, config);

  const summaryKeys = getReportSummaryKeys(columns);

  return columns.filter((column) => !summaryKeys.has(column.key));
}

/* ==========================================================================
   Report Card Summary
   ========================================================================== */

function renderReportSummary({ row, columns, config }) {
  const dateColumn = findColumn(columns, "date");

  const primaryValueColumn = getReportPrimaryValueColumn(columns);

  const changeColumn = findColumn(columns, "change");

  const changePercentColumn = findColumn(columns, "change-percent");

  const dateValue = dateColumn
    ? renderHistoricalCell({
        row,

        column: dateColumn,

        type: "display",

        config,
      })
    : "-";

  const primaryValue = primaryValueColumn
    ? renderHistoricalCell({
        row,

        column: primaryValueColumn,

        type: "display",

        config,
      })
    : "-";

  const changeMarkup = changeColumn
    ? renderHistoricalCell({
        row,

        column: changeColumn,

        type: "display",

        config,
      })
    : "";

  const changePercentMarkup = changePercentColumn
    ? renderHistoricalCell({
        row,

        column: changePercentColumn,

        type: "display",

        config,
      })
    : "";

  return `
    <div class="data-card__identity">
      <div class="data-card__identity-content">
        <h3 class="data-card__title">
          ${dateValue}
        </h3>
      </div>
    </div>

    <div class="data-card__quote">
      <span class="data-card__price">
        ${primaryValue}
      </span>

      <span class="data-card__change">
        ${changeMarkup}
        ${changePercentMarkup}
      </span>
    </div>
  `.trim();
}

/* ==========================================================================
   Report Card Fields
   ========================================================================== */

function renderReportFields({ row, view, filters, config }) {
  return getReportDetailColumns(view, filters, config).map((column) => ({
    label: column.label,

    value: renderHistoricalCell({
      row,

      column,

      type: "display",

      config,
    }),

    fullWidth: false,

    /*
     * Every non-summary Report column is a financial figure:
     *
     * - Open
     * - High
     * - Low
     * - Volume Traded
     * - Turnover
     * - No. of Trades
     * - NAV when it is not the summary value
     * - Last Yield
     * - AUM
     *
     * .data-card__value--numeric applies tabular-nums and LTR isolation
     * consistently with the desktop financial presentation.
     */
    numeric: true,
  }));
}

/* ==========================================================================
   Report Card
   ========================================================================== */

/*
 * `view` is fixed per card-view instance.
 *
 * Performance and Unadjusted each have their own JSP container and their own
 * card instance rather than one runtime-swappable card collection.
 */

export function renderHistoricalReportCard({
  row,
  context = {},
  view,
  filters,
  config = {},
  renderStandardDataCard,
}) {
  if (typeof renderStandardDataCard !== "function") {
    throw new TypeError(
      "renderHistoricalReportCard requires renderStandardDataCard.",
    );
  }

  const columns = getReportMobileColumns(view, filters, config);

  const dateColumn = findColumn(columns, "date");

  const dateText = dateColumn ? row?.[dateColumn.data] : "";

  const summary = renderReportSummary({
    row,
    columns,
    config,
  });

  const fields = renderReportFields({
    row,
    view,
    filters,
    config,
  });

  const showDetailsLabel = config.labels?.mobile?.showDetails || "Show details";

  const hideDetailsLabel = config.labels?.mobile?.hideDetails || "Hide details";

  const rowId = String(dateText || context.index || 0);

  return renderStandardDataCard({
    idPrefix: `historical-${view}-card-details`,

    rowId,

    summary,

    fields,

    moreLabel: `${showDetailsLabel} ${escapeHtml(dateText)}`.trim(),

    lessLabel: `${hideDetailsLabel} ${escapeHtml(dateText)}`.trim(),
  });
}

/* ==========================================================================
   Underlying Columns
   ========================================================================== */

function getUnderlyingMobileColumns(config) {
  return getHistoricalUnderlyingColumns(config).filter(
    (column) => column.mobile !== false,
  );
}

function getUnderlyingDetailColumns(config) {
  return getUnderlyingMobileColumns(config).filter(
    (column) => !UNDERLYING_SUMMARY_KEYS.has(column.key),
  );
}

/* ==========================================================================
   Underlying Card Summary
   ========================================================================== */

function renderUnderlyingSummary({ row, columns, config }) {
  const symbolColumn = findColumn(columns, "symbol");

  const underlyingColumn = findColumn(columns, "underlying");

  const typeColumn = findColumn(columns, "type");

  const symbolMarkup = symbolColumn
    ? renderHistoricalCell({
        row,

        column: symbolColumn,

        type: "display",

        config,
      })
    : "-";

  const underlyingMarkup = underlyingColumn
    ? renderHistoricalCell({
        row,

        column: underlyingColumn,

        type: "display",

        config,
      })
    : "-";

  const typeValue = typeColumn
    ? renderHistoricalCell({
        row,

        column: typeColumn,

        type: "display",

        config,
      })
    : "-";

  return `
    <div class="data-card__identity">
      <div class="data-card__identity-content">
        <h3 class="data-card__title">
          ${symbolMarkup}
        </h3>

        <span class="data-card__identity-code">
          ${underlyingMarkup}

          <span aria-hidden="true">
            &middot;
          </span>

          ${typeValue}
        </span>
      </div>
    </div>
  `.trim();
}

/* ==========================================================================
   Underlying Card Fields
   ========================================================================== */

function renderUnderlyingFields({ row, config }) {
  return getUnderlyingDetailColumns(config).map((column) => ({
    label: column.label,

    value: renderHistoricalCell({
      row,

      column,

      type: "display",

      config,
    }),

    fullWidth: false,

    /*
     * Expiry Date is the one non-numeric field in this list.
     *
     * The remaining values are financial/numeric:
     *
     * - Strike Price
     * - Reference Price
     * - Last Traded Price
     * - Volume
     * - Open Interest
     * - Underlying Price
     */
    numeric: column.type !== "text",
  }));
}

/* ==========================================================================
   Underlying Card
   ========================================================================== */

export function renderHistoricalUnderlyingCard({
  row,
  context = {},
  config = {},
  renderStandardDataCard,
}) {
  if (typeof renderStandardDataCard !== "function") {
    throw new TypeError(
      "renderHistoricalUnderlyingCard requires renderStandardDataCard.",
    );
  }

  const columns = getUnderlyingMobileColumns(config);

  const symbolColumn = findColumn(columns, "symbol");

  const symbolText = symbolColumn ? row?.[symbolColumn.data] : "";

  const summary = renderUnderlyingSummary({
    row,
    columns,
    config,
  });

  const fields = renderUnderlyingFields({
    row,
    config,
  });

  const showDetailsLabel = config.labels?.mobile?.showDetails || "Show details";

  const hideDetailsLabel = config.labels?.mobile?.hideDetails || "Hide details";

  const rowId = `${symbolText || "contract"}-${context.index ?? 0}`;

  return renderStandardDataCard({
    idPrefix: "historical-underlying-card-details",

    rowId,

    summary,

    fields,

    moreLabel: `${showDetailsLabel} ${escapeHtml(symbolText)}`.trim(),

    lessLabel: `${hideDetailsLabel} ${escapeHtml(symbolText)}`.trim(),
  });
}

/* ==========================================================================
   Report Cards Factory
   ========================================================================== */

/*
 * One instance per container.
 *
 * Performance and Unadjusted each have their own separate
 * [data-historical-mobile-cards] element.
 *
 * historical.js forwards the current server page here after the matching
 * report table request resolves. This factory never fetches data itself.
 */

export function createHistoricalReportCardsView({
  root,
  config,
  createDataCards,
  renderStandardDataCard,
  view,
  container,
  getFilters,
} = {}) {
  if (typeof createDataCards !== "function") {
    throw new TypeError(
      "createHistoricalReportCardsView requires createDataCards.",
    );
  }

  if (typeof renderStandardDataCard !== "function") {
    throw new TypeError(
      "createHistoricalReportCardsView requires renderStandardDataCard.",
    );
  }

  if (!root) {
    throw new TypeError("createHistoricalReportCardsView requires a root.");
  }

  if (!config) {
    throw new TypeError("createHistoricalReportCardsView requires config.");
  }

  if (typeof getFilters !== "function") {
    throw new TypeError(
      "createHistoricalReportCardsView requires getFilters().",
    );
  }

  return createDataCards({
    root,

    container,

    renderCard(row, context) {
      return renderHistoricalReportCard({
        row,

        context,

        view,

        filters: getFilters(),

        config,

        renderStandardDataCard,
      });
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.noData || "Unable to load data.",
  });
}

/* ==========================================================================
   Underlying Cards Factory
   ========================================================================== */

export function createHistoricalUnderlyingCardsView({
  root,
  config,
  createDataCards,
  renderStandardDataCard,
  container,
} = {}) {
  if (typeof createDataCards !== "function") {
    throw new TypeError(
      "createHistoricalUnderlyingCardsView requires createDataCards.",
    );
  }

  if (typeof renderStandardDataCard !== "function") {
    throw new TypeError(
      "createHistoricalUnderlyingCardsView requires renderStandardDataCard.",
    );
  }

  if (!root) {
    throw new TypeError("createHistoricalUnderlyingCardsView requires a root.");
  }

  if (!config) {
    throw new TypeError("createHistoricalUnderlyingCardsView requires config.");
  }

  return createDataCards({
    root,

    container,

    renderCard(row, context) {
      return renderHistoricalUnderlyingCard({
        row,

        context,

        config,

        renderStandardDataCard,
      });
    },

    emptyMessage: config.labels?.noData || "No data available",

    errorMessage: config.labels?.noData || "Unable to load data.",
  });
}
