/* ==========================================================================
   Minimum Size View
   ========================================================================== */

/*
 * Desktop table and mobile matrix presentation for Main Market Minimum Size
 * Requirements.
 *
 * Responsibilities:
 *
 * - preserve the legacy three-row table header
 * - define the five-column desktop table schema
 * - render company cells using the shared Market Watch identity
 * - render every mobile row as a semantic four-position matrix
 *
 * This module intentionally has no:
 *
 * - request code
 * - filter handling
 * - response normalization
 * - DataTables initialization
 * - tab lifecycle code
 * - expand/collapse behavior
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { renderStandardCompanyCardIdentity } from "../../../../../common/data-view/index.js";

import {
  escapeHtml,
  normalizeString,
} from "../../../../shared/trading/trading-formatters.js";

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

const DEFAULT_RESULT_LABEL = "Result";

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTableElement(value) {
  return Boolean(value && value.nodeType === 1 && value.tagName === "TABLE");
}

function isTableRowElement(value) {
  return Boolean(value && value.nodeType === 1 && value.tagName === "TR");
}

function createSafeId(value, fallback = "minimum-size") {
  const normalized = normalizeString(value)
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized || fallback;
}

function renderLoadingCell() {
  return `
    <span
      class="table-skeleton table-skeleton-md"
      aria-hidden="true"
    ></span>
  `.trim();
}

/* ==========================================================================
   Header Labels
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
  return Object.freeze({
    result: normalizeString(config.labels?.results) || DEFAULT_RESULT_LABEL,

    emptyValue:
      normalizeString(config.labels?.emptyValue) || DEFAULT_EMPTY_VALUE,
  });
}

/* ==========================================================================
   Desktop Column Schema
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
   Desktop Complex Header
   ========================================================================== */

/*
 * Every header row resolves to the same five-column structure:
 *
 * - one requirement header
 * - four category headers
 */

function createHeaderCell(
  ownerDocument,
  { label, className = "", scope = "col" },
) {
  const cell = ownerDocument.createElement("th");

  cell.scope = scope;

  if (className) {
    cell.className = className;
  }

  const labelElement = ownerDocument.createElement("span");

  labelElement.className = "table-column-label";

  labelElement.textContent = normalizeString(label);

  cell.append(labelElement);

  return cell;
}

function createHeaderRenderer(headerRows) {
  return function renderHeader(input) {
    const table = isTableElement(input) ? input : input?.table;

    if (!isTableElement(table)) {
      throw new TypeError("Minimum Size header requires a table element.");
    }

    const ownerDocument = table.ownerDocument;

    const thead = ownerDocument.createElement("thead");

    const rows = headerRows.length ? headerRows : [normalizeHeaderRow()];

    rows.forEach((headerRow, rowIndex) => {
      const tableRow = ownerDocument.createElement("tr");

      tableRow.dataset.minimumSizeHeaderRow = String(rowIndex);

      tableRow.append(
        createHeaderCell(ownerDocument, {
          label: headerRow.label,

          className: "minimum-size__requirement-heading",

          scope: "row",
        }),
      );

      headerRow.columns.forEach((label, columnIndex) => {
        tableRow.append(
          createHeaderCell(ownerDocument, {
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

    const tbody = ownerDocument.createElement("tbody");

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
   Desktop Table Cells
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
   Desktop Table Rows
   ========================================================================== */

function createdRow(rowElement, row) {
  if (!isTableRowElement(rowElement)) {
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
   Mobile Matrix Labels
   ========================================================================== */

function createMobileMatrixLevels(headerRows, columnIndex) {
  const normalizedRows = [0, 1, 2].map(
    (rowIndex) => headerRows[rowIndex] || normalizeHeaderRow(),
  );

  return normalizedRows.map((headerRow, rowIndex) => {
    const rowLabel = normalizeString(headerRow.label);

    const columnLabel = normalizeString(headerRow.columns[columnIndex]);

    /*
     * The first level always has a useful fallback because it identifies
     * the logical matrix position.
     */

    const fallback = rowIndex === 0 ? String(columnIndex + 1) : "";

    const value = columnLabel || fallback;

    if (rowLabel && value) {
      return `${rowLabel}: ${value}`;
    }

    return rowLabel || value;
  });
}

/* ==========================================================================
   Mobile Company Value
   ========================================================================== */

function renderMobileCompany(company, config, labels) {
  if (!isObject(company)) {
    return `
      <span class="data-card__empty-value">
        ${escapeHtml(labels.emptyValue)}
      </span>
    `.trim();
  }

  return renderStandardCompanyCardIdentity(company, config);
}

/* ==========================================================================
   Mobile Matrix Item
   ========================================================================== */

function renderMobileMatrixItem({
  company,
  config,
  labels,
  levels,
  headingId,
  position,
}) {
  const levelMarkup = levels
    .map((level, index) => {
      if (!level) {
        return "";
      }

      return `
        <span
          class="trading-minimum-size-card__level trading-minimum-size-card__level--${
            index + 1
          }"
        >
          ${escapeHtml(level)}
        </span>
      `.trim();
    })
    .filter(Boolean)
    .join("");

  return `
    <section
      class="trading-minimum-size-card__item"
      role="listitem"
      aria-labelledby="${escapeHtml(headingId)}"
      data-minimum-size-position="${position}"
    >
      <h4
        class="trading-minimum-size-card__heading"
        id="${escapeHtml(headingId)}"
      >
        ${levelMarkup}
      </h4>

      <div class="trading-minimum-size-card__value">
        ${renderMobileCompany(company, config, labels)}
      </div>
    </section>
  `.trim();
}

/* ==========================================================================
   Mobile Matrix Card
   ========================================================================== */

function createCardRenderer({ config, headerRows, labels }) {
  const matrixLevels = COMPANY_COLUMN_KEYS.map((_columnKey, columnIndex) =>
    createMobileMatrixLevels(headerRows, columnIndex),
  );

  return function renderCard(row, context = {}) {
    const parsedIndex = Number(context.index);

    const rowIndex =
      Number.isInteger(parsedIndex) && parsedIndex >= 0 ? parsedIndex : 0;

    const rowNumber = rowIndex + 1;

    const resultLabel = [labels.result, rowNumber].filter(Boolean).join(" ");

    const cardId = createSafeId(
      row?.id || `minimum-size-${rowNumber}`,
      `minimum-size-${rowNumber}`,
    );

    const cardHeadingId = `${cardId}-heading`;

    const items = COMPANY_COLUMN_KEYS.map((columnKey, columnIndex) =>
      renderMobileMatrixItem({
        company: row?.[columnKey],

        config,
        labels,

        levels: matrixLevels[columnIndex],

        headingId: `${cardId}-position-${columnIndex + 1}`,

        position: columnIndex + 1,
      }),
    ).join("");

    /*
     * This card is intentionally not registered as a DataViewCard.
     *
     * It is a complete, non-expandable matrix and therefore has no toggle or
     * hidden details region.
     */

    return `
      <article
        class="data-card trading-minimum-size-card"
        aria-labelledby="${escapeHtml(cardHeadingId)}"
        data-minimum-size-card
      >
        <h3
          class="visually-hidden"
          id="${escapeHtml(cardHeadingId)}"
        >
          ${escapeHtml(resultLabel)}
        </h3>

        <div
          class="trading-minimum-size-card__grid"
          role="list"
        >
          ${items}
        </div>
      </article>
    `.trim();
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
