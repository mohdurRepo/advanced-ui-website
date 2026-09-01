(function (window) {
  "use strict";
 
  function toNumber(value) {
    if (value == null || value === "") return null;
 
    var normalized = String(value).replace(/,/g, "").trim();
    var num = parseFloat(normalized);
 
    return Number.isNaN(num) ? null : num;
  }
 
  function isZeroLike(value) {
    var num = toNumber(value);
    return num !== null && num === 0;
  }
 
  function escapeHtml(value) {
    if (value == null) return "";
 
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
 
  function sanitizeLabel(value) {
    if (value == null) return "";
 
    return String(value)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
 
  function displayValue(value, fallback) {
    if (value == null || value === "") return fallback || "-";
    return String(value);
  }
 
  function formatPlainSafe(value, fallback) {
    return displayValue(value, fallback);
  }
 
  function formatQuantitySafe(value, fallback) {
    if (value == null || value === "") return fallback || "-";
 
    var num = toNumber(value);
    if (num === null) return String(value);
 
    if (typeof num.formatQuantity === "function") {
      return num.formatQuantity();
    }
 
    return num.toLocaleString();
  }
 
  function getChangeClass(value, classNames) {
    var classes = classNames || {};
    var num = toNumber(value) || 0;
 
    if (num > 0) return classes.up || "price-up";
    if (num < 0) return classes.down || "price-down";
 
    return classes.equal || "price-equal";
  }
 
  function renderChangeArrowIcon(value, options) {
    var opts = options || {};
    var num = toNumber(value) || 0;
 
    if (num === 0) return "";
 
    var iconId =
      num > 0
        ? opts.upIcon || "#custom-arrow-up-right"
        : opts.downIcon || "#custom-arrow-down-right";
 
    var className = opts.className || "pc-icon pr-3 link-icon change-icon";
    var width = opts.width || 20;
    var height = opts.height || 20;
 
    return (
      '<svg class="' +
      escapeHtml(className) +
      '" width="' +
      width +
      '" height="' +
      height +
      '" aria-hidden="true">' +
      '<use xlink:href="' +
      escapeHtml(iconId) +
      '"></use>' +
      "</svg>"
    );
  }
 
  function valueOrDashOnAuction(value, config) {
    if (config && config.openCloseAuction && isZeroLike(value)) return "-";
    return formatPlainSafe(value);
  }
 
  function quantityOrDashOnAuction(value, config) {
    if (config && config.openCloseAuction && isZeroLike(value)) return "-";
    return formatQuantitySafe(value);
  }
 
  function marketOrderOrValue(value, config) {
    if (config && config.openCloseAuction && isZeroLike(value)) {
      return config.labels && config.labels.marketOrder
        ? config.labels.marketOrder
        : "MO";
    }
 
    return formatQuantitySafe(value);
  }
 
  function volumeOrDash(value, config) {
    return quantityOrDashOnAuction(value, config);
  }
 
  function renderChangeBox(displayValueParam, numericValue, dashOnAuction, config) {
    if (
      dashOnAuction &&
      config &&
      config.openCloseAuction &&
      isZeroLike(numericValue)
    ) {
      return '<div class="priceTdBox"><div class="price-equal">-</div></div>';
    }
 
    var cls = getChangeClass(numericValue);
    var value = displayValue(displayValueParam);
 
    return (
      '<div class="priceTdBox">' +
      '<div class="' +
      escapeHtml(cls) +
      '">' +
      renderChangeArrowIcon(numericValue) +
      escapeHtml(value) +
      "</div>" +
      "</div>"
    );
  }
 
  function renderMobileChangeValue(changeValue, changePercent, numericValue, config) {
    if (config && config.openCloseAuction && isZeroLike(numericValue)) {
      return "-";
    }
 
    return (
      renderChangeArrowIcon(numericValue) +
      escapeHtml(displayValue(changeValue)) +
      " (" +
      escapeHtml(displayValue(changePercent)) +
      ")"
    );
  }
 
  window.FormatUtils = {
    toNumber: toNumber,
    isZeroLike: isZeroLike,
    escapeHtml: escapeHtml,
    sanitizeLabel: sanitizeLabel,
    displayValue: displayValue,
    formatPlainSafe: formatPlainSafe,
    formatQuantitySafe: formatQuantitySafe,
    getChangeClass: getChangeClass,
    renderChangeArrowIcon: renderChangeArrowIcon,
    valueOrDashOnAuction: valueOrDashOnAuction,
    quantityOrDashOnAuction: quantityOrDashOnAuction,
    marketOrderOrValue: marketOrderOrValue,
    volumeOrDash: volumeOrDash,
    renderChangeBox: renderChangeBox,
    renderMobileChangeValue: renderMobileChangeValue
  };
})(window);