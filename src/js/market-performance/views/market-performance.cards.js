import {
  renderStandardCompanyCardIdentity,
  renderStandardDataCard,
} from "../../../common/data-view/index.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
				class="has-icon icon-trending-up icon-2xl icon-accent"
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

function renderSummary(row, config) {
  const changeClass = getChangeClass(row?.changeValue);
  const changeValue = formatNumber(row?.changeValue, config.locale);
  const changePercent = formatNumber(row?.changePercent, config.locale);

  return `
		<div class="data-card__summary">
			${renderStandardCompanyCardIdentity(row, {
        logoUrlTemplate: config.assets.companyLogoUrlTemplate,
        logoFallbackUrl: config.assets.companyLogoFallbackUrl,
      })}

			<div class="data-card__quote">
				<div class="data-card__change ${changeClass}">
					${renderTrendIcon(row?.changeValue)}

					<span class="data-card__change-value">
						${escapeHtml(changeValue)}
					</span>

					<span class="data-card__change-percent">
						(${escapeHtml(changePercent)}%)
					</span>
				</div>
			</div>
		</div>
	`.trim();
}

function createFields(row, config) {
  const labels = config.labels.table;

  return [
    {
      label: labels.open,
      value: escapeHtml(formatNumber(row?.openPrice, config.locale)),
      numeric: true,
    },
    {
      label: labels.high,
      value: escapeHtml(formatNumber(row?.highPrice, config.locale)),
      numeric: true,
    },
    {
      label: labels.low,
      value: escapeHtml(formatNumber(row?.lowPrice, config.locale)),
      numeric: true,
    },
    {
      label: labels.close,
      value: escapeHtml(formatNumber(row?.closePrice, config.locale)),
      numeric: true,
    },
    {
      label: labels.volume,
      value: escapeHtml(formatQuantity(row?.volumeTraded, config.locale)),
      numeric: true,
    },
    {
      label: labels.value,
      value: escapeHtml(formatNumber(row?.value, config.locale)),
      numeric: true,
    },
  ];
}

function getRowId(row, index) {
  const companyCode = String(row?.companyCode ?? "").trim();

  return companyCode
    ? `${companyCode}-${index}`
    : `market-performance-${index}`;
}

function renderCard(row, context, config) {
  const companyName =
    String(row?.companyName ?? "").trim() ||
    String(row?.companyCode ?? "").trim() ||
    "Company";

  return renderStandardDataCard({
    idPrefix: "market-performance-card-details",
    rowId: getRowId(row, context?.index ?? 0),
    className: "data-card--market-performance",
    summary: renderSummary(row, config),
    fields: createFields(row, config),
    moreLabel: `Show details ${companyName}`,
    lessLabel: `Hide details ${companyName}`,
  });
}

function getGroupLabel(groupKey, config) {
  if (groupKey === "gainers") {
    return config.labels.gainers;
  }

  if (groupKey === "losers") {
    return config.labels.losers;
  }

  return "";
}

function renderGroup({ groupKey, groupLabel, cards }) {
  if (groupKey === "active") {
    return cards;
  }

  return `
		<section
			class="data-card-group market-performance__card-group"
			data-data-card-group
			data-market-performance-card-group="${escapeHtml(groupKey)}"
		>
			<header class="data-card-group__header">
				<h3 class="data-card-group__title">
					${escapeHtml(groupLabel)}
				</h3>
			</header>

			<div class="data-card-group__items">
				${cards}
			</div>
		</section>
	`.trim();
}

export function createMarketPerformanceCards(config) {
  return Object.freeze({
    renderCard(row, context = {}) {
      return renderCard(row, context, config);
    },

    getGroupKey(row) {
      return row?.resultGroup || "active";
    },

    getGroupLabel(groupKey) {
      return getGroupLabel(groupKey, config);
    },

    renderGroup,
  });
}
