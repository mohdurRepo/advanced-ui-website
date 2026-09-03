import { renderStandardCompanyCardIdentity } from "../../../common/data-view/index.js";

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

function getChangeIcon(value) {
  if (value > 0) {
    return `
			<svg class="pc-icon link-icon" width="18" height="18" aria-hidden="true">
				<use xlink:href="#custom-arrow-up-right"></use>
			</svg>
		`.trim();
  }

  if (value < 0) {
    return `
			<svg class="pc-icon link-icon" width="18" height="18" aria-hidden="true">
				<use xlink:href="#custom-arrow-down-right"></use>
			</svg>
		`.trim();
  }

  return "";
}

function renderMetric(label, value) {
  return `
		<div class="data-card__metric">
			<span class="data-card__metric-label">${escapeHtml(label)}</span>
			<span class="data-card__metric-value">${escapeHtml(value)}</span>
		</div>
	`.trim();
}

function renderChange(row, config) {
  const className = getChangeClass(row?.changeValue);
  const change = formatNumber(row?.changeValue, config.locale);
  const percent = formatNumber(row?.changePercent, config.locale);

  return `
		<div class="data-card__change ${className}">
			${getChangeIcon(row?.changeValue)}
			<span>${escapeHtml(change)} (${escapeHtml(percent)}%)</span>
		</div>
	`.trim();
}

function renderCard(row, config) {
  const labels = config.labels.table;

  return `
		<article class="data-card market-performance-card">
			<header class="data-card__header market-performance-card__header">
				${renderStandardCompanyCardIdentity(row, {
          logoUrlTemplate: config.assets.companyLogoUrlTemplate,
          logoFallbackUrl: config.assets.companyLogoFallbackUrl,
        })}

				${renderChange(row, config)}
			</header>

			<div class="data-card__body">
				<div class="data-card__metrics">
					${renderMetric(labels.open, formatNumber(row?.openPrice, config.locale))}
					${renderMetric(labels.high, formatNumber(row?.highPrice, config.locale))}
					${renderMetric(labels.low, formatNumber(row?.lowPrice, config.locale))}
					${renderMetric(labels.close, formatNumber(row?.closePrice, config.locale))}
					${renderMetric(labels.volume, formatQuantity(row?.volumeTraded, config.locale))}
					${renderMetric(labels.value, formatNumber(row?.value, config.locale))}
				</div>
			</div>
		</article>
	`.trim();
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
		<section class="data-card-group" data-data-card-group>
			<h3 class="data-card-group__title">${escapeHtml(groupLabel)}</h3>
			<div class="data-card-group__items">
				${cards}
			</div>
		</section>
	`.trim();
}

export function createMarketPerformanceCards(config) {
  return Object.freeze({
    renderCard(row) {
      return renderCard(row, config);
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
