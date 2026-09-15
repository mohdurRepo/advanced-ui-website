/* ======================================================
Historical Rules Engine
Centralized business logic for historical reports
====================================================== */
 
(function (window) {
  "use strict";
 
  const ONE_TAB_MARKETS = ["ETFS", "SUKUK", "INDICES", "MF", "TR"];
 
  const NO_SECTOR_MARKETS =
    window.HistoricalConfig?.constants?.MARKETS_WITHOUT_SECTOR || [];
 
  const SPECIAL_INDICES = ["TLCIC", "TMCIC", "TSCIC", "TIPOC", "TT50CI"];
 
  function getFilters() {
    if (window.HistoricalManager) {
      return window.HistoricalManager.getFilters();
    }
 
    return {
      market: "-1",
      sector: "0",
      entity: "0",
      tradeType: "OB",
      startDate: "",
      endDate: "",
      activeTab: "performance"
    };
  }
 
  function getI18n(key, fallback) {
    return (
      window.HistoricalI18n?.labels?.[key] ||
      window.HistoricalI18n?.[key] ||
      fallback ||
      key
    );
  }
 
  function parseDDMMYYYY(value) {
    if (!value || typeof value !== "string") return null;
 
    const parts = value.split("-");
    if (parts.length !== 3) return null;
 
    const day = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const year = Number(parts[2]);
 
    if (!day || month < 0 || !year) return null;
 
    const date = new Date(year, month, day);
 
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }
 
    return Number.isNaN(date.getTime()) ? null : date;
  }
 
  function getEntityParts(entity) {
    const parts = String(entity || "").split(":");
 
    return {
      marketCode: parts[0] || "",
      symbol: parts[1] || "",
      type: parts[2] || ""
    };
  }
 
  function isNoSectorMarket(market) {
    return NO_SECTOR_MARKETS.includes(market);
  }
 
  function isIndexTypeEntity(filters) {
    if (filters.market !== "INDICES") return false;
 
    return getEntityParts(filters.entity).type === "I";
  }
 
  function isMainMarketTasi(filters) {
    if (filters.market !== "INDICES") return false;
 
    const entity = getEntityParts(filters.entity);
 
    return entity.marketCode === "M" && entity.symbol === "TASI";
  }
 
  function isSpecialIndex(filters) {
    if (filters.market !== "INDICES") return false;
 
    return SPECIAL_INDICES.includes(getEntityParts(filters.entity).symbol);
  }
 
  function validate(filters) {
    const market = filters.market;
    const sector = filters.sector;
    const entity = filters.entity;
    const startDate = filters.startDate;
    const endDate = filters.endDate;
 
    if (!market || market === "-1" || market === "0") {
        return {
            valid: false,
            message: getI18n("validationMarket", "Please select market")
        };
    }
     
    if (!entity || entity === "0") {
        return {
            valid: false,
            message: getI18n("validationEntity", "Please select entity")
        };
    }
     
    if (!startDate || !endDate) {
        return {
            valid: false,
            message: getI18n("validationDateRange", "Please select date range")
        };
    }
 
    const start = parseDDMMYYYY(startDate);
    const end = parseDDMMYYYY(endDate);
 
    if (!start || !end) {
      return {
        valid: false,
        message: getI18n("validationDateRange", "Please select valid date range")
      };
    }
 
    if (start > end) {
      return {
        valid: false,
        message: getI18n("validationDateOrder", "Start date must be before end date")
      };
    }
 
    return { valid: true, message: null };
  }
 
  function resolveUnadjustedVisibility(filters) {
    const market = filters.market;
    const sector = filters.sector;
 
    if (market === "DERIVATIVE") {
      return sector !== "I" && sector !== "OS";
    }
 
    return !ONE_TAB_MARKETS.includes(market);
  }
 
  function resolveProfileType(filters, rules) {
    if (rules.isDerivativeUnderlying) {
      return "derivativesUnderlying";
    }
 
    if (rules.noTable) {
      return "none";
    }
 
    if (filters.activeTab === "unadjusted" && rules.showUnadjustedTab) {
      return "unadjusted";
    }
 
    return "performance";
  }
 
  function resolveNote(filters, rules) {
    if (!rules.ready) return null;
 
    if (isIndexTypeEntity(filters)) {
      return {
        visible: true,
        target: "default",
        message: getI18n("note1", "")
      };
    }
 
    if (isMainMarketTasi(filters)) {
      return {
        visible: true,
        target: "default",
        message: getI18n("main.market.indices.tasi.note1", "")
      };
    }
 
    if (filters.market === "DERIVATIVE") {
      return {
        visible: true,
        target: rules.isDerivativeUnderlying ? "derivatives" : "default",
        message: getI18n("derivative.performance.foonote.change.points", "")
      };
    }
 
    if (filters.market === "MF") {
      return {
        visible: true,
        target: "default",
        message: getI18n("mf.performance.foonote.nav", "")
      };
    }
 
    return {
      visible: false,
      target: "default",
      message: ""
    };
  }
 
  function resolve() {
    const filters = getFilters();
    const validation = validate(filters);
 
    const rules = {
      filters: filters,
 
      ready: validation.valid,
      message: validation.message,
 
      showTradeType:
        filters.market === "SUKUK" &&
        (filters.sector === "G" || filters.sector === "S"),
 
      isDerivativeUnderlying:
        filters.market === "DERIVATIVE" && filters.sector === "OS",
 
      isIndexTypeEntity: isIndexTypeEntity(filters),
      isMainMarketTasi: isMainMarketTasi(filters),
      isSpecialIndex: isSpecialIndex(filters),
 
      noTable: false,
 
      showUnadjustedTab: false,
      profileType: "performance",
 
      note: null
    };
 
    rules.noTable = rules.ready && rules.isIndexTypeEntity;
    rules.showUnadjustedTab = validation.valid
      ? resolveUnadjustedVisibility(filters)
      : false;
 
    rules.profileType = resolveProfileType(filters, rules);
    rules.note = resolveNote(filters, rules);
 
    return rules;
  }
 
  window.HistoricalRules = {
    resolve: resolve,
    parseDDMMYYYY: parseDDMMYYYY
  };
})(window);