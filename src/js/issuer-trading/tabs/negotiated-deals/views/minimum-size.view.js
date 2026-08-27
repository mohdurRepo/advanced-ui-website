/* ==========================================================================
   Minimum Size View
   ========================================================================== */

/*
 * Desktop table and mobile card presentation for Main Market Minimum Size
 * Requirements.
 *
 * Responsibilities:
 *
 * - preserve the legacy three-row table header
 * - define the five-column table schema
 * - render company cells using the shared Market Watch identity
 * - render accessible mobile cards
 *
 * This module intentionally has no:
 *
 * - request code
 * - filter handling
 * - response normalization
 * - DataTables initialization
 * - tab lifecycle code
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import {
  renderStandardCompanyCardIdentity,
  renderStandardDataCard,
} from "../../../../../common/data-view/index.js";

import {
  escapeHtml,
  normalizeString,
} from "../../../shared/trading-formatters.js";

import { createNegotiatedDealsFormatters } from "../negotiated-deals.formatters.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const VIEW_KEY = "minimumSize";

const COLUMN_KEYS = Object.freeze({
  requirement: "requirement",

  first: "col1",
  second: "col2",
  third: "col3",
  fourth: "col4",
});

const COMPANY_COLUMN_KEYS = Object.freeze([
  COLUMN_KEYS.first,
  COLUMN_KEYS.second,
  COLUMN_KEYS.third,
  COLUMN_KEYS.fourth,
]);

const DEFAULT_EMPTY_VALUE = "—";

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getCompanyIdentityOptions(config = {}) {
  return Object.freeze({
    logoUrlTemplate: normalizeString(config.assets?.companyLogoUrlTemplate),

    logoFallbackUrl: normalizeString(config.assets?.companyLogoFallbackUrl),
  });
}

function renderLoadingCell() {
  return `
    <span
      class="table-skeleton table-skeleton-md"
      aria-hidden="true"
    ></span>
  `.trim();
}

function createHeaderCell({ label, className = "", scope = "col" }) {
  const cell = document.createElement("th");

  cell.scope = scope;

  if (className) {
    cell.className = className;
  }

  const labelElement = document.createElement("span");

  labelElement.className = "table-column-label";

  labelElement.textContent = normalizeString(label);

  cell.append(labelElement);

  return cell;
}

/* ==========================================================================
   Labels
   ========================================================================== */

function normalizeHeaderRow(row = {}) {
  const columns = Array.isArray(row.columns) ? row.columns : [];

  return Object.freeze({
    label: normalizeString(row.label),

    columns: Object.freeze(
      COMPANY_COLUMN_KEYS.map((_columnKey, index) =>
        normalizeString(columns[index]),
      ),
    ),
  });
}

function getHeaderRows(config = {}) {
  const configuredRows = config.labels?.minimumSize?.headerRows;

  if (!Array.isArray(configuredRows)) {
    return [];
  }

  return configuredRows.slice(0, 3).map(normalizeHeaderRow);
}

function getLabels(config = {}) {
  const mobile = config.labels?.mobile || {};

  return Object.freeze({
    result: normalizeString(config.labels?.results) || "Result",

    emptyValue:
      normalizeString(config.labels?.emptyValue) || DEFAULT_EMPTY_VALUE,

    showDetails: normalizeString(mobile.showDetails) || "More details",

    hideDetails: normalizeString(mobile.hideDetails) || "Less details",
  });
}

/* ==========================================================================
   Column Schema
   ========================================================================== */

function createColumns(headerRows) {
  const primaryHeader = headerRows[0] || normalizeHeaderRow();

  return [
    {
      key: COLUMN_KEYS.requirement,

      label: primaryHeader.label,

      className: "minimum-size__requirement-cell",

      headerClassName: "minimum-size__requirement-heading",

      orderable: false,
      searchable: false,

      defaultContent: "",
    },

    ...COMPANY_COLUMN_KEYS.map((key, index) => ({
      key,

      label: primaryHeader.columns[index] || "",

      className: "minimum-size__company-cell",

      headerClassName: "minimum-size__column-heading",

      orderable: false,
    })),
  ];
}

/* ==========================================================================
   Complex Header
   ========================================================================== */

/*
 * DataTables supports multiple complete header rows when every row resolves
 * to the same number of columns.
 *
 * Each Minimum Size header row contains:
 *
 * - one requirement heading
 * - four corresponding category headings
 */

function createHeaderRenderer(headerRows) {
  return function renderHeader(input) {
    const table = input instanceof HTMLTableElement ? input : input?.table;

    if (!(table instanceof HTMLTableElement)) {
      throw new TypeError("Minimum Size header requires a table element.");
    }

    const thead = document.createElement("thead");

    const rows = headerRows.length ? headerRows : [normalizeHeaderRow()];

    rows.forEach((headerRow, rowIndex) => {
      const tableRow = document.createElement("tr");

      tableRow.dataset.minimumSizeHeaderRow = String(rowIndex);

      tableRow.append(
        createHeaderCell({
          label: headerRow.label,

          className: "minimum-size__requirement-heading",

          scope: "row",
        }),
      );

      headerRow.columns.forEach((label, columnIndex) => {
        tableRow.append(
          createHeaderCell({
            label,

            className: [
              "minimum-size__column-heading",

              `minimum-size__column-heading--${columnIndex + 1}`,
            ].join(" "),

            scope: "col",
          }),
        );
      });

      thead.append(tableRow);
    });

    const tbody = document.createElement("tbody");

    const caption = table.caption;

    if (caption) {
      table.replaceChildren(caption, thead, tbody);
    } else {
      table.replaceChildren(thead, tbody);
    }

    return thead;
  };
}

/* ==========================================================================
   Table Cells
   ========================================================================== */

function createCellRenderer({ formatters }) {
  return function renderCell({ row, column, type }) {
    if (row?.__dataViewState === "loading") {
      return renderLoadingCell();
    }

    if (column.key === COLUMN_KEYS.requirement) {
      return "";
    }

    if (!COMPANY_COLUMN_KEYS.includes(column.key)) {
      return "";
    }

    return formatters.minimumSize.company(row?.[column.key], type);
  };
}

/* ==========================================================================
   Table Rows
   ========================================================================== */

function createdRow(rowElement, row) {
  if (!(rowElement instanceof HTMLTableRowElement)) {
    return;
  }

  if (row?.__dataViewState === "loading") {
    rowElement.classList.add("table-market__loading-row");

    return;
  }

  rowElement.dataset.rowType = "minimum-size";

  rowElement.classList.add("minimum-size__result-row");
}

/* ==========================================================================
   Mobile Field Labels
   ========================================================================== */

function createMobileFieldLabels(headerRows) {
  return COMPANY_COLUMN_KEYS.map((_columnKey, columnIndex) => {
    const parts = headerRows
      .map((headerRow) => {
        const rowLabel = normalizeString(headerRow.label);

        const columnLabel = normalizeString(headerRow.columns[columnIndex]);

        if (rowLabel && columnLabel) {
          return `${rowLabel}: ${columnLabel}`;
        }

        return rowLabel || columnLabel;
      })
      .filter(Boolean);

    return parts.join(" · ");
  });
}

/* ==========================================================================
   Mobile Company
   ========================================================================== */

function renderMobileCompany(company, config, labels) {
  if (!isObject(company)) {
    return `
      <span class="data-card__empty-value">
        ${escapeHtml(labels.emptyValue)}
      </span>
    `.trim();
  }

  return renderStandardCompanyCardIdentity(
    company,
    getCompanyIdentityOptions(config),
  );
}

/* ==========================================================================
   Mobile Card
   ========================================================================== */

function createCardRenderer({ config, headerRows, labels }) {
  const fieldLabels = createMobileFieldLabels(headerRows);

  return function renderCard(row, context = {}) {
    const rowNumber = Number(context.index || 0) + 1;

    const resultLabel = [labels.result, rowNumber].filter(Boolean).join(" ");

    const summary = `
      <div class="data-card__identity">
        <div class="data-card__identity-content">
          <h4 class="data-card__title">
            ${escapeHtml(resultLabel)}
          </h4>
        </div>
      </div>
    `.trim();

    const fields = COMPANY_COLUMN_KEYS.map((columnKey, index) => ({
      label: fieldLabels[index] || String(index + 1),

      value: renderMobileCompany(row?.[columnKey], config, labels),

      fullWidth: true,
    }));

    return renderStandardDataCard({
      rowId: row?.id || `minimum-size-${rowNumber}`,

      idPrefix: "minimum-size-details",

      className: "data-card--minimum-size",

      summary,
      fields,

      moreLabel: labels.showDetails,

      lessLabel: labels.hideDetails,
    });
  };
}

/* ==========================================================================
   Public View
   ========================================================================== */

export function createMinimumSizeView(config = {}) {
  if (!isObject(config)) {
    throw new TypeError(
      "createMinimumSizeView requires a configuration object.",
    );
  }

  const headerRows = getHeaderRows(config);

  const labels = getLabels(config);

  const formatters = createNegotiatedDealsFormatters(config);

  const columns = createColumns(headerRows);

  const renderHeader = createHeaderRenderer(headerRows);

  const renderCell = createCellRenderer({
    formatters,
  });

  const renderCard = createCardRenderer({
    config,
    headerRows,
    labels,
  });

  return Object.freeze({
    key: VIEW_KEY,

    columns,

    renderHeader,
    renderCell,
    renderCard,

    tableOptions: Object.freeze({
      paging: false,
      searching: false,
      ordering: false,
      info: false,

      rowGroup: false,

      createdRow,

      rowId(row) {
        return normalizeString(row?.id);
      },
    }),
  });
}
