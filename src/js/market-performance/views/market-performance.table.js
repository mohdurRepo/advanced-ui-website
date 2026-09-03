import { renderStandardCompanyCell } from "../../../common/data-view/index.js";

const COLUMN_KEYS = Object.freeze({
  company: "company",
  open: "open",
  high: "high",
  low: "low",
  close: "close",
  change: "change",
  changePercent: "changePercent",
  volume: "volume",
  value: "value",
});

const DATA_TABLE_TYPES = Object.freeze({
  display: "display",
  filter: "filter",
  sort: "sort",
  type: "type",
});

function isSortType(type) {
  return type === DATA_TABLE_TYPES.sort || type === DATA_TABLE_TYPES.type;
}

function isFilterType(type) {
  return type === DATA_TABLE_TYPES.filter;
}

function getNumericSortValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function getTextSortValue(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase();
}

function formatNumber(value, locale, fractionDigits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat(locale || "en", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatQuantity(value, locale) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat(locale || "en", {
    maximumFractionDigits: 0,
  }).format(value);
}

function renderLoadingCell(size = "md") {
  return `<span class="table-skeleton table-skeleton-${size}" aria-hidden="true"></span>`;
}

function getChangeClass(value) {
  if (value > 0) {
    return "price-up";
  }

  if (value < 0) {
    return "price-down";
  }

  return "priceEqual";
}

function renderTrendIcon(value) {
  if (value > 0) {
    return `
			<span
				class="has-icon icon-trending-up icon-2xl"
				aria-hidden="true">
			</span>
		`.trim();
  }

  if (value < 0) {
    return `
			<span
				class="has-icon icon-trending-down icon-2xl"
				aria-hidden="true">
			</span>
		`.trim();
  }

  return "";
}

function renderCompany(row, type, config) {
  if (isSortType(type)) {
    return getTextSortValue(row?.companyName || row?.companyCode);
  }

  if (isFilterType(type)) {
    return [row?.companyName, row?.companyCode].filter(Boolean).join(" ");
  }

  return renderStandardCompanyCell(row, {
    logoUrlTemplate: config.assets.companyLogoUrlTemplate,
    logoFallbackUrl: config.assets.companyLogoFallbackUrl,
  });
}

function renderNumber(value, type, config, fractionDigits = 2) {
  if (isSortType(type)) {
    return getNumericSortValue(value);
  }

  if (isFilterType(type)) {
    return value ?? "";
  }

  return formatNumber(value, config.locale, fractionDigits);
}

function renderQuantity(value, type, config) {
  if (isSortType(type)) {
    return getNumericSortValue(value);
  }

  if (isFilterType(type)) {
    return value ?? "";
  }

  return formatQuantity(value, config.locale);
}

function renderChangeValue(row, type, config) {
  const value = row?.changeValue;

  if (isSortType(type)) {
    return getNumericSortValue(value);
  }

  if (isFilterType(type)) {
    return value ?? "";
  }

  return `
		<div class="market-performance__change ${getChangeClass(value)} d-flex align-items-center justify-content-end gap-1">
			<span class="market-performance__change-value">
				${formatNumber(value, config.locale)}
			</span>

			${renderTrendIcon(value)}
		</div>
	`.trim();
}

function renderChangePercent(row, type, config) {
  const value = row?.changePercent;
  const directionValue = row?.changeValue;

  if (isSortType(type)) {
    return getNumericSortValue(value);
  }

  if (isFilterType(type)) {
    return value ?? "";
  }

  return `
		<div class="market-performance__change-percent ${getChangeClass(directionValue)}">
			${formatNumber(value, config.locale)}
		</div>
	`.trim();
}

function createColumns(config) {
  const labels = config.labels.table;

  return [
    {
      key: COLUMN_KEYS.company,
      label: labels.company,
      width: "18%",
      className: "market-performance__company-cell",
      headerClassName: "market-performance__company-heading",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.open,
      label: labels.open,
      width: "8%",
      className: "market-performance__number text-end",
      headerClassName: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.high,
      label: labels.high,
      width: "8%",
      className: "market-performance__number text-end",
      headerClassName: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.low,
      label: labels.low,
      width: "8%",
      className: "market-performance__number text-end",
      headerClassName: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.close,
      label: labels.close,
      width: "8%",
      className: "market-performance__number text-end",
      headerClassName: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.change,
      label: labels.change,
      width: "9%",
      className:
        "market-performance__number market-performance__change-cell text-end",
      headerClassName: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.changePercent,
      label: labels.changePercent,
      width: "9%",
      className:
        "market-performance__number market-performance__change-percent-cell text-end",
      headerClassName: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.volume,
      label: labels.volume,
      width: "15%",
      className: "market-performance__number text-end",
      headerClassName: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.value,
      label: labels.value,
      width: "17%",
      className:
        "market-performance__number market-performance__value-cell text-end",
      headerClassName: "text-end",
      orderable: true,
      searchable: false,
    },
  ];
}

function createCellRenderer(config) {
  return function renderCell({ row, column, type }) {
    if (row?.__dataViewState === "loading") {
      return renderLoadingCell(
        column.key === COLUMN_KEYS.company ? "lg" : "md",
      );
    }

    switch (column.key) {
      case COLUMN_KEYS.company:
        return renderCompany(row, type, config);

      case COLUMN_KEYS.open:
        return renderNumber(row?.openPrice, type, config);

      case COLUMN_KEYS.high:
        return renderNumber(row?.highPrice, type, config);

      case COLUMN_KEYS.low:
        return renderNumber(row?.lowPrice, type, config);

      case COLUMN_KEYS.close:
        return renderNumber(row?.closePrice, type, config);

      case COLUMN_KEYS.change:
        return renderChangeValue(row, type, config);

      case COLUMN_KEYS.changePercent:
        return renderChangePercent(row, type, config);

      case COLUMN_KEYS.volume:
        return renderQuantity(row?.volumeTraded, type, config);

      case COLUMN_KEYS.value:
        return renderNumber(row?.value, type, config);

      default:
        return "";
    }
  };
}

export function createMarketPerformanceTable(config) {
  const columns = createColumns(config);

  return Object.freeze({
    getColumns() {
      return columns;
    },

    renderCell: createCellRenderer(config),

    tableOptions: Object.freeze({
      autoWidth: false,
      paging: false,
      searching: false,
      ordering: true,
      order: [],
      info: false,
      lengthChange: false,
      scrollX: true,
      scrollCollapse: true,
      fixedHeader: true,
      fixedColumns: false,
      rowGroup: false,
      responsive: false,
      language: {
        emptyTable: config.labels.noData,
        zeroRecords: config.labels.noData,
        loadingRecords: config.labels.loading,
        processing: config.labels.loading,
      },
    }),
  });
}

export { COLUMN_KEYS as MARKET_PERFORMANCE_COLUMN_KEYS };
