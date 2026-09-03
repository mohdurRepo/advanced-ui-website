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

function numericSortValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function textSortValue(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase();
}

function displayNumber(value, locale, fractionDigits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat(locale || "en", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function displayQuantity(value, locale) {
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

function renderCompany(row, type, config) {
  if (isSortType(type)) {
    return textSortValue(row?.companyName || row?.companyCode);
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
    return numericSortValue(value);
  }

  if (isFilterType(type)) {
    return value ?? "";
  }

  return displayNumber(value, config.locale, fractionDigits);
}

function renderQuantity(value, type, config) {
  if (isSortType(type)) {
    return numericSortValue(value);
  }

  if (isFilterType(type)) {
    return value ?? "";
  }

  return displayQuantity(value, config.locale);
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

function getChangeIcon(value) {
  if (value > 0) {
    return `
			<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20" aria-hidden="true">
				<use xlink:href="#custom-arrow-up-right"></use>
			</svg>
		`.trim();
  }

  if (value < 0) {
    return `
			<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20" aria-hidden="true">
				<use xlink:href="#custom-arrow-down-right"></use>
			</svg>
		`.trim();
  }

  return "";
}

function renderChangeValue(row, type, config) {
  const value = row?.changeValue;

  if (isSortType(type)) {
    return numericSortValue(value);
  }

  if (isFilterType(type)) {
    return value ?? "";
  }

  return `
		<div class="${getChangeClass(value)}">
			${displayNumber(value, config.locale, 2)}
			<i aria-hidden="true"></i>
		</div>
	`.trim();
}

function renderChangePercent(row, type, config) {
  const value = row?.changePercent;
  const changeValue = row?.changeValue;

  if (isSortType(type)) {
    return numericSortValue(value);
  }

  if (isFilterType(type)) {
    return value ?? "";
  }

  return `
		<div class="${getChangeClass(changeValue)}">
			${getChangeIcon(changeValue)}
			${displayNumber(value, config.locale, 2)}
			<i aria-hidden="true"></i>
		</div>
	`.trim();
}

function createColumns(config) {
  return [
    {
      key: COLUMN_KEYS.company,
      label: config.labels.table.company,
      className: "market-performance__company-cell",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.open,
      label: config.labels.table.open,
      className: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.high,
      label: config.labels.table.high,
      className: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.low,
      label: config.labels.table.low,
      className: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.close,
      label: config.labels.table.close,
      className: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.change,
      label: config.labels.table.change,
      className: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.changePercent,
      label: config.labels.table.changePercent,
      className: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.volume,
      label: config.labels.table.volume,
      className: "text-end",
      orderable: true,
      searchable: false,
    },
    {
      key: COLUMN_KEYS.value,
      label: config.labels.table.value,
      className: "text-end",
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

function getGroupLabel(group, config) {
  if (group === "gainers") {
    return config.labels.gainers;
  }

  if (group === "losers") {
    return config.labels.losers;
  }

  return "";
}

function renderRowGroupStart({ groupName }, config) {
  const label = getGroupLabel(groupName, config);

  if (!label) {
    return null;
  }

  return label;
}

export function createMarketPerformanceTable(config) {
  const columns = createColumns(config);

  return Object.freeze({
    getColumns() {
      return columns;
    },

    renderCell: createCellRenderer(config),

    getRowGroup(row) {
      return row?.resultGroup || "active";
    },

    renderRowGroupStart(context) {
      return renderRowGroupStart(context, config);
    },

    tableOptions: Object.freeze({
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
      rowGroup: {},
      responsive: true,
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
