(function (window) {
  "use strict";
 
    
// common-util.js
 
var CommonUtil = (function () {
 
    function postText(resourceUrl, data, successCallback, errorCallback) {
 
        if (!resourceUrl) {
            alert("Resource URL is missing");
            return;
        }
 
        $.ajax({
            url: resourceUrl,
            type: "POST",
            data: data || {},
            dataType: "text",
            cache: false,
 
            success: function (response) {
                if (typeof successCallback === "function") {
                    successCallback(response);
                }
            },
 
            error: function (xhr, status, error) {
                var message = "Request failed";
 
                if (xhr && xhr.responseText) {
                    message = xhr.responseText;
                } else if (error) {
                    message = error;
                }
 
                if (typeof errorCallback === "function") {
                    errorCallback(message, xhr);
                } else {
                    alert(message);
                }
            }
        });
    }
 
    function alertTest(resourceUrl) {
 
        postText(
            resourceUrl,
            {
                randomText: "Hello from common JS"
            },
            function (response) {
                alert(response);
            }
        );
    }
 
    return {
        postText: postText,
        alertTest: alertTest
    };
 
})();

  function getConfig() {
    return window.peerComparisonConfig || {};
  }
 
  function getLabels() {
    return getConfig().labels || {};
  }
 
  function getBaseCompanySymbol() {
    return getConfig().companySymbol || "";
  }
 
  function getBaseCompanyName() {
	  const config = getConfig();
	 
	  return (
	    config.companyName ||
	    config.baseCompanyName ||
	    config.companyDisplayName ||
	    config.companySymbol ||
	    "-"
	  );
	}
  function getPeerName(item) {
    return (
      item.name ||
      item.companyName ||
      item.indexName ||
      item.company_name ||
      "-"
    );
  }
 
  function getPeerSymbol(item) {
    return item.symbol || item.companySymbol || item.indexSymbol || "";
  }
 
  function isBaseCompany(item) {
    return (
      item.isBase === true ||
      String(getPeerSymbol(item)) === String(getBaseCompanySymbol())
    );
  }
 
  function findRowBySymbol(rows, symbol) {
    return rows.find(function (item) {
      return String(getPeerSymbol(item)) === String(symbol);
    });
  }
 
  function formatNumber(value, digits) {
    if (value === null || value === undefined || value === "") return "-";
 
    const number = Number(value);
    if (Number.isNaN(number)) return "-";
 
    const decimals = typeof digits === "number" ? digits : 2;
 
    return number.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }
 
  function formatReturn(value) {
    if (value === null || value === undefined || value === "") return "-";
 
    const number = Number(value);
    if (Number.isNaN(number)) return "-";
 
    const sign = number > 0 ? "+" : "";
 
    return `${sign}${number.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`;
  }
 
  function getReturnClass(value) {
    const number = Number(value);
 
    if (Number.isNaN(number)) return "";
    if (number > 0) return "is-positive";
    if (number < 0) return "is-negative";
 
    return "";
  }
 
  function getPeerChartColors() {
	  const css = getComputedStyle(document.documentElement);
	 
	  return [
	    css.getPropertyValue("--peer-chart-color-1").trim(),
	    css.getPropertyValue("--peer-chart-color-2").trim(),
	    css.getPropertyValue("--peer-chart-color-3").trim(),
	    css.getPropertyValue("--peer-chart-color-4").trim(),
	    css.getPropertyValue("--peer-chart-color-5").trim(),
	    css.getPropertyValue("--peer-chart-color-6").trim()
	  ];
	}
  
  function getPeerChartColor(index) {
	  const colors = getPeerChartColors();
	  return colors[index % colors.length];
	}
  
  window.PeerComparisonUtils = {
    getConfig,
    getLabels,
    getBaseCompanySymbol,
    getBaseCompanyName,
    getPeerName,
    getPeerSymbol,
    isBaseCompany,
    findRowBySymbol,
    formatNumber,
    formatReturn,
    getReturnClass,
    getPeerChartColors,
    getPeerChartColor
  };
})(window);