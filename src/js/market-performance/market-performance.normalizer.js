const GROUP = Object.freeze({
  ACTIVE: "active",
  GAINERS: "gainers",
  LOSERS: "losers",
});

function toText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function normalizeRow(row, group) {
  const source = row && typeof row === "object" ? row : {};

  return {
    companyName: toText(source.acrynomName),
    companyCode: toText(source.companyRef),
    companyUrl: toText(source.companyURL),

    openPrice: toNumber(source.beginPrice),
    highPrice: toNumber(source.highPrice),
    lowPrice: toNumber(source.lowPrice),
    closePrice: toNumber(source.endPrice),
    changeValue: toNumber(source.changeValue),
    changePercent: toNumber(source.ChangePrecent),
    volumeTraded: toNumber(source.volumeTraded),
    value: toNumber(source.value),

    resultGroup: group,
  };
}

export function normalizeMarketPerformanceRows(rows, group = GROUP.ACTIVE) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => normalizeRow(row, group));
}

export function normalizeMarketPerformanceResponse(
  response,
  group = GROUP.ACTIVE,
) {
  const rows = Array.isArray(response) ? response : response?.data;

  return normalizeMarketPerformanceRows(rows, group);
}

export function combineMarketPerformanceGroups(gainers, losers) {
  return [
    ...normalizeMarketPerformanceResponse(gainers, GROUP.GAINERS),
    ...normalizeMarketPerformanceResponse(losers, GROUP.LOSERS),
  ];
}

export const MARKET_PERFORMANCE_GROUP = GROUP;
