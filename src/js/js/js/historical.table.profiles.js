/* ======================================================
Historical Table Profiles
Defines table schema, headers, ajax payload and rules
====================================================== */
 
(function (window, document) {
  "use strict";
 
  function getFilters() {
    return window.HistoricalManager ? window.HistoricalManager.getFilters() : {};
  }
 
  function getRules() {
    return window.HistoricalRules ? window.HistoricalRules.resolve() : {};
  }
 
  function getMessage(key, fallback) {
    return window.HistoricalI18n?.labels?.[key] || fallback || key;
  }
 
  function emptyDT(draw) {
    return {
      draw: Number(draw || 0),
      recordsTotal: 0,
      recordsFiltered: 0,
      data: []
    };
  }
 
  function normalizeResponse(response) {
    if (!response) return JSON.stringify(emptyDT());
 
    if (typeof response === "string") {
      const trimmed = response.trim();
 
      if (!trimmed) return JSON.stringify(emptyDT());
 
      try {
        const parsed = JSON.parse(trimmed);
 
        if (Array.isArray(parsed)) {
          return JSON.stringify({
            draw: 0,
            recordsTotal: parsed.length,
            recordsFiltered: parsed.length,
            data: parsed
          });
        }
 
        return JSON.stringify(parsed);
      } catch (e) {
        return JSON.stringify(emptyDT());
      }
    }
 
    if (typeof response === "object") {
      if (Array.isArray(response)) {
        return JSON.stringify({
          draw: 0,
          recordsTotal: response.length,
          recordsFiltered: response.length,
          data: response
        });
      }
 
      return JSON.stringify(response);
    }
 
    return JSON.stringify(emptyDT());
  }
 
  function getPerformanceHeaders(filters) {
    const headers = [
      getMessage("table.header.date", "Date"),
      getMessage("table.header.open", "Open"),
      getMessage("table.header.high", "High"),
      getMessage("table.header.low", "Low"),
      getMessage("table.header.close", "Close"),
      getMessage("table.header.change", "Change"),
      getMessage("table.header.percnt.change", "% Change"),
      getMessage("table.header.volume.traded", "Volume Traded"),
      getMessage("table.header.turn.over", "Turnover"),
      getMessage("table.header.no.of.trades", "No. of Trades"),
      getMessage("table.header.nav", "NAV"),
      getMessage("table.header.close.yeild", "Last Yield"),
      getMessage("table.header.aum", "AUM")
    ];
 
    if (filters.market === "MF") {
      headers[0] = getMessage("table.header.mf.date", "Date");
      headers[10] = getMessage("table.header.mf.nav", "NAV");
      headers[12] = getMessage("table.header.nav", "AUM");
    }
 
    if (filters.market === "SUKUK") {
      headers[7] = getMessage(
        "table.header.nominal.value.traded",
        "Nominal Value Traded"
      );
    }
 
    if (filters.market === "DERIVATIVE") {
      headers[5] = getMessage("table.header.change.points", "Change Points");
      headers[9] = getMessage(
        "table.header.daily.sett.price",
        "Daily Settlement Price"
      );
 
      if (filters.sector === "S" || filters.sector === "I") {
        headers[10] = getMessage("table.header.open.interest", "Open Interest");
      }
    }
 
    return headers;
  }
 
  function getUnadjustedHeaders() {
    return [
      getMessage("table.header.date", "Date"),
      getMessage("table.header.open", "Open"),
      getMessage("table.header.high", "High"),
      getMessage("table.header.low", "Low"),
      getMessage("table.header.close", "Close"),
      getMessage("table.header.change", "Change"),
      getMessage("table.header.percnt.change", "% Change"),
      getMessage("table.header.volume.traded", "Volume Traded"),
      getMessage("table.header.turn.over", "Turnover"),
      getMessage("table.header.no.of.trades", "No. of Trades")
    ];
  }
 
  function getUnderlyingHeaders() {
    return [
      getMessage(
        "derivatives.market.watch.underlying.table.instrumenttype",
        "Instrument Type"
      ),
      getMessage("derivatives.market.watch.underlying.table.symbol", "Symbol"),
      getMessage(
        "derivatives.market.watch.underlying.table.Underlying",
        "Underlying"
      ),
      getMessage(
        "derivatives.market.watch.underlying.table.ExpiryDate",
        "Expiry Date"
      ),
      getMessage("derivatives.market.watch.underlying.table.Type", "Type"),
      getMessage(
        "derivatives.market.watch.underlying.table.StrikePrice",
        "Strike Price"
      ),
      getMessage(
        "derivatives.market.watch.underlying.table.ReferencePrice",
        "Reference Price"
      ),
      getMessage(
        "derivatives.market.watch.underlying.table.LastTradedPrice",
        "Last Traded Price"
      ),
      getMessage("derivatives.market.watch.underlying.table.Volume", "Volume"),
      getMessage(
        "derivatives.market.watch.underlying.table.OpenInterest",
        "Open Interest"
      ),
      getMessage(
        "derivatives.market.watch.underlying.table.UnderlyingPrice",
        "Underlying Price"
      )
    ];
  }
 
  function buildHistoricalAjax(tabId) {
    return {
      url: window.HistoricalEndpoints.populateCompanyDetails,
      type: "POST",
 
      data: function (d) {
        const f = getFilters();
 
        d.selectedMarket = f.market;
        d.selectedSector = f.sector;
        d.selectedEntity = f.entity;
        d.selectedTypeOfTrade = f.tradeType;
        d.startDate = f.startDate;
        d.endDate = f.endDate;
        d.tableTabId = tabId;
 
        d.startIndex = Number(d.start || 0);
        d.endIndex = Number(d.start || 0) + Number(d.length || 100);
 
        return d;
      },
 
      dataFilter: normalizeResponse
    };
  }
 
  function buildUnderlyingAjax() {
    return {
      url: window.HistoricalEndpoints.getSingleStockOptionsTableCompanyData,
      type: "GET",
 
      data: function () {
        const f = getFilters();
 
        return {
          selectedMarket: f.market,
          selectedSector: f.sector,
          selectedEntity: f.entity,
          requestLocale:
            window.HistoricalConfig?.requestLocale ||
            document.documentElement.lang ||
            "en",
          startDate: f.startDate,
          endDate: f.endDate
        };
      },
 
      dataFilter: normalizeResponse
    };
  }
 
  function getPerformanceColumns(filters) {
    const base = window.HistoricalColumns.basePerformance();
    const visible =
      window.HistoricalColumns.resolvePerformanceVisibleIndexes(filters);
 
    return window.HistoricalColumns.applyVisibility(base, visible);
  }
 
  function getUnadjustedColumns(filters) {
    const base = window.HistoricalColumns.baseUnadjusted();
    const visible =
      window.HistoricalColumns.resolveUnadjustedVisibleIndexes(filters);
 
    return window.HistoricalColumns.applyVisibility(base, visible);
  }
 
  function getLifecycle() {
    return {
      onInit: function (instance) {
        let handledNoData = false;
 
        function checkNoData() {
          if (handledNoData) return;
 
          const json = instance.ajax?.json ? instance.ajax.json() : null;
          const info = instance.page?.info ? instance.page.info() : null;
 
          const total =
            Number(json?.recordsTotal ?? json?.recordsFiltered ?? info?.recordsTotal ?? 0);
 
          if (total === 0) {
            handledNoData = true;
            window.HistoricalManager?.showNoDataState?.();
          }
        }
 
        instance.on("xhr.historicalNoData", function () {
          setTimeout(checkNoData, 0);
        });
 
        instance.on("draw.historicalNoData", function () {
          checkNoData();
        });
      }
    };
  }
 
  function getDtOptions() {
    return {
      serverSide: true,
      processing: false,
      paging: true,
      pagingType: "simple",
      pageLength: 100,
      processing: false,
      searching: false,
      ordering: false,
      info: false,
      scrollX: true,
      scrollCollapse: true,
      autoWidth: true,
      deferRender: true,
      dom: "rt"
    };
  }
 
  function getFeatures() {
    return {
      fixedHeader: true,
      feedPagination: {
        container: ".feed__pagination"
      },
      loader: true
    };
  }
 
  function performanceProfile() {
    const f = getFilters();
 
    return {
      target: "#perfSummary",
      headers: getPerformanceHeaders(f),
      columns: getPerformanceColumns(f),
      ajax: buildHistoricalAjax("0"),
      dtOptions: getDtOptions(),
      features: getFeatures(),
      lifecycle: getLifecycle()
    };
  }
 
  function unadjustedProfile() {
    const f = getFilters();
 
    return {
      target: "#unadjustedPrice",
      headers: getUnadjustedHeaders(),
      columns: getUnadjustedColumns(f),
      ajax: buildHistoricalAjax("1"),
      dtOptions: getDtOptions(),
      features: getFeatures(),
      lifecycle: getLifecycle()
    };
  }
 
  function underlyingProfile() {
    return {
      target: "#SingleStockOptionsTable",
      headers: getUnderlyingHeaders(),
      columns: window.HistoricalColumns.derivativesUnderlying(),
      ajax: buildUnderlyingAjax(),
      dtOptions: {
    	  processing: false,
          paging: false,
          searching: false,
          ordering: false,
          info: false,
          scrollX: true,
          scrollCollapse: true,
          autoWidth: true,
          deferRender: true,
          dom: "rt"
      },
      features: {
        fixedHeader: true,
        loader: true
      },
      lifecycle: getLifecycle()
    };
  }
 
  function noneProfile() {
    return {
      target: null,
      headers: [],
      columns: [],
      ajax: null,
      dtOptions: {},
      features: {},
      lifecycle: {}
    };
  }
 
  function resolve() {
    const rules = getRules();
 
    if (rules.profileType === "none") {
      return noneProfile();
    }
 
    if (rules.isDerivativeUnderlying) {
      return underlyingProfile();
    }
 
    if (rules.profileType === "unadjusted") {
      return unadjustedProfile();
    }
 
    return performanceProfile();
  }
 
  window.HistoricalTableProfiles = {
    resolve: resolve,
    normalizeResponse: normalizeResponse
  };
})(window, document);