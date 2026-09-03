const CONFIG_NAME = "MarketPerformanceConfig";

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`[Market Performance] Missing or invalid ${name}.`);
  }

  return value;
}

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`[Market Performance] Missing or invalid ${name}.`);
  }

  return value.trim();
}

function optionalString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readRawConfig() {
  const config = window[CONFIG_NAME];

  if (!config) {
    throw new Error(
      `[Market Performance] window.${CONFIG_NAME} was not found.`,
    );
  }

  return requireObject(config, CONFIG_NAME);
}

export function getMarketPerformanceConfig() {
  const raw = readRawConfig();

  const endpoints = requireObject(raw.endpoints, "endpoints");
  const request = requireObject(raw.request, "request");
  const report = requireObject(request.report, "request.report");
  const assets = requireObject(raw.assets, "assets");
  const labels = requireObject(raw.labels, "labels");
  const tableLabels = requireObject(labels.table, "labels.table");

  return Object.freeze({
    locale: requireString(raw.locale, "locale"),

    endpoints: Object.freeze({
      performance: requireString(
        endpoints.performance,
        "endpoints.performance",
      ),
      losers: requireString(endpoints.losers, "endpoints.losers"),
    }),

    request: Object.freeze({
      adjusted: requireString(request.adjusted, "request.adjusted"),
      nonAdjusted: requireString(request.nonAdjusted, "request.nonAdjusted"),
      allMarket: requireString(request.allMarket, "request.allMarket"),
      defaultPeriod: requireString(
        request.defaultPeriod,
        "request.defaultPeriod",
      ),

      report: Object.freeze({
        active: requireString(report.active, "request.report.active"),
        gainersLosersValue: requireString(
          report.gainersLosersValue,
          "request.report.gainersLosersValue",
        ),
        gainersLosersPercent: requireString(
          report.gainersLosersPercent,
          "request.report.gainersLosersPercent",
        ),
      }),
    }),

    assets: Object.freeze({
      companyLogoUrlTemplate: requireString(
        assets.companyLogoUrlTemplate,
        "assets.companyLogoUrlTemplate",
      ),
      companyLogoFallbackUrl: requireString(
        assets.companyLogoFallbackUrl,
        "assets.companyLogoFallbackUrl",
      ),
      noDataImageUrl: optionalString(assets.noDataImageUrl),
    }),

    labels: Object.freeze({
      loading: requireString(labels.loading, "labels.loading"),
      noData: requireString(labels.noData, "labels.noData"),
      error: requireString(labels.error, "labels.error"),
      gainers: requireString(labels.gainers, "labels.gainers"),
      losers: requireString(labels.losers, "labels.losers"),

      table: Object.freeze({
        company: requireString(tableLabels.company, "labels.table.company"),
        open: requireString(tableLabels.open, "labels.table.open"),
        high: requireString(tableLabels.high, "labels.table.high"),
        low: requireString(tableLabels.low, "labels.table.low"),
        close: requireString(tableLabels.close, "labels.table.close"),
        change: requireString(tableLabels.change, "labels.table.change"),
        changePercent: requireString(
          tableLabels.changePercent,
          "labels.table.changePercent",
        ),
        volume: requireString(tableLabels.volume, "labels.table.volume"),
        value: requireString(tableLabels.value, "labels.table.value"),
      }),
    }),
  });
}
