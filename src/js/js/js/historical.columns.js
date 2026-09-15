/* ======================================================
Historical Columns
====================================================== */
 
(function (window) {
  "use strict";
 
  const SPECIAL_INDICES = ["TLCIC", "TMCIC", "TSCIC", "TIPOC", "TT50CI"];
 
  function col(data, extra) {
	    return Object.assign({
	        data: data,
	        orderable: false,
	        defaultContent: "-",
	        className: "text-center"
	    }, extra || {});
	}
	 
	function dateCol(data, extra) {
	    return col(data, Object.assign({
	        className: ""
	    }, extra || {}));
	}
	  function num(data, extra) {
		    return col(data, Object.assign({
		      className: "dt-cell dt-number",
		      render: renderNumber
		    }, extra || {}));
		  }
 
  function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(number) ? number : null;
  }
 
  function formatNumber(value, decimals) {
    const number = toNumber(value);
    if (number === null || number === 0) return "-";
 
    return number.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
 
  function renderNumber(data, type) {
    if (type !== "display") return data;
    return formatNumber(data, 2);
  }
 
  function renderInteger(data, type) {
    if (type !== "display") return data;
    return formatNumber(data, 0);
  }
 
  function renderThreeDecimals(data, type) {
    if (type !== "display") return data;
    return formatNumber(data, 3);
  }
 
  function directionSvg(direction) {
    if (direction === "price-up") {
      return (
        '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">' +
        '<use xlink:href="#custom-arrow-up-right"></use>' +
        "</svg>"
      );
    }
 
    if (direction === "price-down") {
      return (
        '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">' +
        '<use xlink:href="#custom-arrow-down-right"></use>' +
        "</svg>"
      );
    }
 
    return "";
  }
 
  function renderDirectionalNumber(data, type) {
	    if (type !== "display") {
	        return data;
	    }
	 
	    if (data === null || data === undefined || data === "" || data === "-") {
	        return "-";
	    }
	 
	    const value = parseFloat(data);
	 
	    if (isNaN(value)) {
	        return data;
	    }
	 
	    let directionClass = "";
	    let icon = "";
	 
	    if (value > 0) {
	        directionClass = "price-up";
	 
	        icon =
	            '<svg class="pc-icon link-icon me-1" width="16" height="16">' +
	                '<use xlink:href="#custom-arrow-up-right"></use>' +
	            '</svg>';
	    } else if (value < 0) {
	        directionClass = "price-down";
	 
	        icon =
	            '<svg class="pc-icon link-icon me-1" width="16" height="16">' +
	                '<use xlink:href="#custom-arrow-down-right"></use>' +
	            '</svg>';
	    }
	 
	    return (
	        '<div class="d-inline-flex align-items-center ' + directionClass + '">' +
	            icon +
	            '<span>' + data + '</span>' +
	        '</div>'
	    );
	}
 
  function renderExerciseType(data, type) {
    if (type !== "display") return data;
 
    if (data === "CALL") {
      return window.HistoricalI18n?.labels?.[
        "labels.company.profile.options.table.calls"
      ] || "Calls";
    }
 
    if (data === "PUT") {
      return window.HistoricalI18n?.labels?.[
        "labels.company.profile.options.table.puts"
      ] || "Puts";
    }
 
    return data || "-";
  }
 
  function renderLink(data, type, url) {
    if (type !== "display") return data;
    if (!data) return "-";
    if (!url) return data;
 
    return '<a class="ellipsis" href="' + url + '">' + data + "</a>";
  }
 
  function basePerformanceColumns() {
	    return [
	        dateCol("transactionDateStr"),
	        col("todaysOpen"),
	        col("highPrice"),
	        col("lowPrice"),
	        col("previousClosePrice"),
	        col("change", { render: renderDirectionalNumber }),
	        col("changePercent", { render: renderDirectionalNumber }),
	        col("volumeTraded"),
	        col("turnOver"),
	        col("noOfTrades"),
	        col("nav"),
	        col("lastYield"),
	        col("aum")
	    ];
	}
	 
	function baseUnadjustedColumns() {
	    return [
	        dateCol("transactionDateStr"),
	        col("todaysOpen"),
	        col("highPrice"),
	        col("lowPrice"),
	        col("previousClosePrice"),
	        col("change", { render: renderDirectionalNumber }),
	        col("changePercent", { render: renderDirectionalNumber }),
	        col("volumeTraded"),
	        col("turnOver"),
	        col("noOfTrades")
	    ];
	}
 
  function derivativesUnderlyingColumns() {
    return [
      col("instrumentType", {
        render: function () {
          return window.HistoricalI18n?.labels?.[
            "derivatives.market.watch.sso"
          ] || "SSO";
        }
      }),
      col("contractSymbol", {
        render: function (data, type, row) {
          return renderLink(data, type, row && row.contractUrl);
        }
      }),
      col("underlying", {
        render: function (data, type, row) {
          return renderLink(data, type, row && row.companyUrl);
        }
      }),
      col("expiryDate"),
      col("exerciseType", { render: renderExerciseType }),
      num("strikePrice"),
      num("referencePrice"),
      num("lastTraddedPrice"),
      num("volume", { render: renderInteger }),
      num("openInterest"),
      num("underlyingPrice")
    ];
  }
 
  function resolvePerformanceVisibleIndexes(filters) {
    const market = filters.market;
    const sector = filters.sector;
    const entity = filters.entity || "";
 
    switch (market) {
      case "MF":
        return [0, 5, 10, 12];
 
      case "ETFS":
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
 
      case "SUKUK":
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11];
 
      case "INDICES": {
        const entityParts = entity.split(":");
        const indexCode = entityParts[1];
        const indexType = entityParts[2];
 
        if (indexType === "I") return [];
        if (SPECIAL_INDICES.includes(indexCode)) return [0, 1, 2, 3, 4, 8, 9];
 
        return [0, 1, 2, 3, 4, 7, 8, 9];
      }
 
      case "DERIVATIVE": {
        const visible = [0, 1, 2, 3, 4, 5, 6, 7, 9];
 
        if (sector === "S" || sector === "I") {
          visible.push(8);
          visible.push(10);
        }
 
        return visible;
      }
 
      case "MAIN":
      case "NOMUC":
      case "REITS":
      case "CEFS":
      case "TR":
      default:
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    }
  }
 
  function resolveUnadjustedVisibleIndexes(filters) {
    if (filters.market === "INDICES") {
      return [0, 1, 2, 3, 4, 5, 6, 8, 9];
    }
 
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  }
 
  function applyVisibility(columns, visibleIndexes) {
    const visibleMap = {};
 
    (visibleIndexes || []).forEach(function (index) {
      visibleMap[index] = true;
    });
 
    return columns.map(function (column, index) {
      return Object.assign({}, column, {
        visible: !!visibleMap[index],
        defaultContent: "-"
      });
    });
  }
 
  window.HistoricalColumns = {
    basePerformance: basePerformanceColumns,
    baseUnadjusted: baseUnadjustedColumns,
    derivativesUnderlying: derivativesUnderlyingColumns,
    resolvePerformanceVisibleIndexes: resolvePerformanceVisibleIndexes,
    resolveUnadjustedVisibleIndexes: resolveUnadjustedVisibleIndexes,
    applyVisibility: applyVisibility,
    formatNumber: formatNumber
  };
})(window);