(function (window, document, $) {
  "use strict";

  const U = window.PeerComparisonUtils;

  const DEFAULT_RANGE = "1W";
  const MARKET_TIME_OFFSET_MS = 3 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  let peerChartInstance = null;
  let peerCompanies = [];

  /*
   * Raw API price series.
   *
   * Each point is:
   * [timestamp, price]
   */
  let peerSeriesHistorical = [];
  let peerSeriesIntraday = [];

  /*
   * Percentage-change series currently displayed
   * inside Highcharts.
   */
  let peerSeriesOptions = [];

  let peerChartInitState = {
    range: DEFAULT_RANGE,
  };

  /*
   * Prevent an older AJAX request from replacing
   * data loaded by a newer renderChart call.
   */
  let chartRequestId = 0;

  function isRTL() {
    return document.dir === "rtl" || document.documentElement.dir === "rtl";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getGraphNameItems(selectedCompanies) {
    return [
      {
        code: U.getBaseCompanySymbol(),
        name: U.getBaseCompanyName(),
        isBase: true,
      },
    ].concat(
      (selectedCompanies || []).map(function (company) {
        return {
          code: company.code,
          name: company.name,
          isBase: false,
        };
      }),
    );
  }

  function getGraphCompanyName(item, headerItems) {
    const symbol = U.getPeerSymbol(item);

    const matched = headerItems.find(function (company) {
      return String(company.code) === String(symbol);
    });

    return matched ? matched.name : U.getPeerName(item);
  }

  function renderGraphSideTable(rows, selectedCompanies) {
    const body = document.querySelector("[data-peer-graph-table-body]");

    const labels = U.getLabels();

    if (!body) return;

    if (!Array.isArray(rows) || !rows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="4">
            ${escapeHtml(labels.noData || "No data available.")}
          </td>
        </tr>
      `;

      return;
    }

    const headerItems = getGraphNameItems(selectedCompanies);

    body.innerHTML = rows
      .map(function (item, index) {
        const symbol = U.getPeerSymbol(item);
        const name = getGraphCompanyName(item, headerItems);

        const isBase = U.isBaseCompany(item);

        return `
          <tr data-peer-row="${escapeHtml(symbol)}">
            <td>
              <div class="peer-graph-company">
                <span
                  class="peer-legend-dot"
                  style="--peer-legend-color: ${U.getPeerChartColor(index)}"
                  aria-hidden="true"
                ></span>
 
                <div class="peer-graph-company__content">
                  <strong class="peer-graph-company__name">
                    ${escapeHtml(name)}
                  </strong>
 
                  <span class="peer-table-symbol">
                    ${escapeHtml(symbol || "-")}
                  </span>
                </div>
              </div>
            </td>
 
            <td>
              ${U.formatNumber(item.sharePrice)}
            </td>
 
            <td>
              <span class="peer-table-return ${U.getReturnClass(item.return)}">
                ${U.formatReturn(item.return)}
              </span>
            </td>
 
            <td class="text-end">
              ${
                isBase
                  ? ""
                  : `
                    <button
                      type="button"
                      class="peer-remove-btn"
                      aria-label="Remove ${escapeHtml(name)}"
                      title="Remove"
                      data-peer-remove="${escapeHtml(symbol)}"
                    >
                      ×
                    </button>
                  `
              }
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderGraphPlaceholder() {
    const canvas = document.querySelector("[data-peer-chart-canvas]");

    if (!canvas) return;

    destroyPeerChart();
    canvas.innerHTML = "";
  }

  function renderGraphError() {
    const body = document.querySelector("[data-peer-graph-table-body]");

    const labels = U.getLabels();

    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="4">
          ${escapeHtml(labels.error || "Unable to load peer comparison data.")}
        </td>
      </tr>
    `;
  }

  function renderChart(rows, selectedCompanies) {
    const canvas = document.getElementById("peerComparisonChart");

    const config = U.getConfig();

    if (!canvas || typeof Highcharts === "undefined") {
      return;
    }

    const nameItems = getGraphNameItems(selectedCompanies);

    peerCompanies = (rows || [])
      .map(function (item) {
        const symbol = U.getPeerSymbol(item);

        return {
          name: getGraphCompanyName(item, nameItems),
          symbol: symbol,
          isBase: U.isBaseCompany(item),
        };
      })
      .filter(function (company) {
        return Boolean(company.symbol);
      });

    renderPeerChartLegend(peerCompanies);

    if (!peerCompanies.length) {
      showChartMessage("No data available.");
      return;
    }

    initPeerChart(
      config.chartTypeHistorical || "SQL_CI_CV_COM",

      config.chartTypeIntraday || "SQL_CI_DV",

      config.pageName || "",

      config.getTokenUrl || config.getToken || "",
    );
  }

  async function initPeerChart(
    chartTypeHistorical,
    chartTypeIntraday,
    pageName,
    getTokenUrl,
  ) {
    const currentRequestId = ++chartRequestId;

    try {
      if (!getTokenUrl) {
        console.warn("Peer chart token URL missing.");

        showChartMessage("Unable to load chart.");

        return;
      }

      /*
       * Clear previous data before loading
       * a new selection.
       */
      peerSeriesHistorical = [];
      peerSeriesIntraday = [];
      peerSeriesOptions = [];

      const tokenResponse = await $.ajax({
        url: getTokenUrl,
        type: "GET",
        data: {
          pageName: pageName,
        },
      });

      /*
       * Ignore this result if renderChart was called
       * again while the request was loading.
       */
      if (currentRequestId !== chartRequestId) {
        return;
      }

      const parsedToken =
        typeof tokenResponse === "string"
          ? JSON.parse(tokenResponse)
          : tokenResponse;

      const jwtToken = parsedToken && parsedToken.jwtToken;

      if (!jwtToken) {
        throw new Error("Chart JWT token is missing.");
      }

      /*
       * Load intraday and historical data
       * using the same token.
       */
      const results = await Promise.all([
        getPeerFullSeries(chartTypeIntraday, jwtToken, pageName),

        getPeerFullSeries(chartTypeHistorical, jwtToken, pageName),
      ]);

      if (currentRequestId !== chartRequestId) {
        return;
      }

      peerSeriesIntraday = results[0];
      peerSeriesHistorical = results[1];

      peerChartInitState = {
        range: DEFAULT_RANGE,
      };

      drawPeerChart();
      bindPeerRangeControls();
      activateRangeControl(DEFAULT_RANGE);
      applyPeerRange(DEFAULT_RANGE);
    } catch (error) {
      console.error("Peer chart initialization failed:", error);

      showChartMessage("Unable to load peer comparison data.");
    }
  }

  async function getPeerFullSeries(chartType, jwtToken, pageName) {
    const requests = peerCompanies.map(function (company) {
      return peerAjaxCall(chartType, jwtToken, company, pageName);
    });

    const responses = await Promise.all(requests);

    return buildPeerSeries(responses);
  }

  function peerAjaxCall(chartType, jwtToken, company, pageName) {
    return $.ajax({
      url:
        "/tadawul.eportal.charts.v2/ChartGenerator" +
        "?chart-type=" +
        encodeURIComponent(chartType) +
        "&chart-parameter=" +
        encodeURIComponent(company.symbol) +
        "&pageName=" +
        encodeURIComponent(pageName) +
        "&jwtToken=" +
        encodeURIComponent(jwtToken),

      type: "GET",
      dataType: "json",
    });
  }

  /*
   * Build raw price series.
   *
   * Percentage conversion happens later
   * inside buildNormalizedSeries.
   */

  function buildPeerSeries(responses) {
    return responses.map(function (data, index) {
      const company = peerCompanies[index];

      const color = U.getPeerChartColor(index);

      return {
        name: company.name,
        symbol: company.symbol,
        color: color,
        data: getFormattedGraphJson(data),
      };
    });
  }

  /*
   * Convert API data into sorted raw-price points.
   *
   * Result:
   * [
   *   [timestamp, price]
   * ]
   */
  function getFormattedGraphJson(data) {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map(function (point) {
        const timestamp = parseChartDateTime(point.dateTime);

        const price = Number.parseFloat(point.indexPrice);

        if (!Number.isFinite(timestamp) || !Number.isFinite(price)) {
          return null;
        }

        return [timestamp, price];
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return a[0] - b[0];
      });
  }

  /*
   * Convert raw prices into percentage change
   * for the selected date range.
   *
   * The first price available inside the selected
   * range becomes the baseline.
   *
   * Formula:
   *
   * ((price - baselinePrice) / baselinePrice) * 100
   *
   * Raw price remains available in:
   *
   * point.custom.price
   */
  function buildNormalizedSeries(rawSeries, start, end) {
    return rawSeries.map(function (series) {
      const visiblePoints = series.data.filter(function (point) {
        return point[0] >= start && point[0] <= end;
      });

      if (!visiblePoints.length) {
        return {
          name: series.name,
          symbol: series.symbol,
          color: series.color,
          data: [],
        };
      }

      const baselinePrice = visiblePoints[0][1];

      if (!Number.isFinite(baselinePrice) || baselinePrice === 0) {
        return {
          name: series.name,
          symbol: series.symbol,
          color: series.color,
          data: [],
        };
      }

      const normalizedData = visiblePoints.map(function (point) {
        const timestamp = point[0];

        const price = point[1];

        const change = ((price - baselinePrice) / baselinePrice) * 100;

        return {
          x: timestamp,
          y: change,

          custom: {
            price: price,
            change: change,
            baselinePrice: baselinePrice,
          },
        };
      });

      return {
        name: series.name,
        symbol: series.symbol,
        type: "area",
        color: series.color,
        lineColor: series.color,

        fillColor: getSeriesFill(series.color),

        data: normalizedData,
      };
    });
  }

  function drawPeerChart() {
    destroyPeerChart();

    const styles = getPeerChartStyles();

    peerChartInstance = Highcharts.stockChart("peerComparisonChart", {
      chart: {
        height: 420,
        backgroundColor: "transparent",
        spacing: [12, 8, 12, 8],
      },

      credits: {
        enabled: false,
      },

      accessibility: {
        enabled: true,
      },

      rangeSelector: {
        enabled: false,
      },

      xAxis: {
        type: "datetime",
        ordinal: false,
        reversed: isRTL(),
        lineColor: styles.gridLine,
        tickColor: styles.gridLine,

        labels: {
          rotation: -40,
          align: "right",

          style: {
            color: styles.axisText,
            fontSize: "11px",
          },

          formatter: function () {
            const span = this.axis.max - this.axis.min;

            if (span <= 2 * DAY_MS) {
              return Highcharts.dateFormat("%H:%M", this.value);
            }

            return Highcharts.dateFormat("%d-%m-%y", this.value);
          },
        },
      },

      yAxis: {
        allowDecimals: true,

        title: {
          text: null,
        },

        opposite: isRTL(),
        gridLineColor: styles.gridLine,
        gridLineWidth: 1,

        /*
         * Show a baseline at zero.
         */
        plotLines: [
          {
            value: 0,
            color: styles.axisText,
            width: 1,
            zIndex: 2,
          },
        ],

        labels: {
          reserveSpace: true,

          align: isRTL() ? "left" : "right",

          style: {
            color: styles.axisText,
            fontSize: "12px",
            whiteSpace: "nowrap",
          },

          
          formatter: function () {
            return formatAxisNumber(this.value);
          },
        },
      },

     
       
      tooltip: {
        shared: true,
        split: false,
        useHTML: true,

        backgroundColor: styles.tooltipBg,

        borderColor: styles.tooltipBorder,

        shadow: false,

        style: {
          color: styles.tooltipText,
          fontSize: "12px",
        },

        formatter: function () {
          const points = this.points || [];

          const range = peerChartInitState.range;

          const dateFormat = range === "1D" ? "%d-%m-%Y %H:%M" : "%d-%m-%Y";

          let html = '<div class="peer-chart-tooltip">';

          html +=
            '<div class="peer-chart-tooltip__date">' +
            Highcharts.dateFormat(dateFormat, this.x) +
            "</div>";

          points.forEach(function (tooltipPoint) {
            const point = tooltipPoint.point;

            const custom = point.custom || {};

            const price = Number(custom.price);

            const change = Number(custom.change);

            html +=
              '<div class="peer-chart-tooltip__item">' +
              '<span style="' +
              "display:inline-block;" +
              "width:8px;" +
              "height:8px;" +
              "border-radius:50%;" +
              "margin-inline-end:6px;" +
              "background:" +
              tooltipPoint.color +
              '"></span>' +
              "<strong>" +
              escapeHtml(tooltipPoint.series.name) +
              ":</strong> " +
              formatPrice(price) +
              " (" +
              formatSignedChange(change) +
              ")" +
              "</div>";
          });

          html += "</div>";

          return html;
        },
      },

      plotOptions: {
        series: {
          animation: {
            duration: 350,
          },

          marker: {
            enabled: false,
          },

          dataGrouping: {
            enabled: false,
          },

          turboThreshold: 0,
        },

        area: {
          lineWidth: 2,
          threshold: null,
        },
      },

      navigator: {
        enabled: true,
        height: 56,
        margin: 12,
        outlineWidth: 0,

        maskFill: "rgba(44, 129, 255, 0.16)",

        liveRedraw: true,

        xAxis: {
          reversed: isRTL(),

          labels: {
            style: {
              color: styles.mutedText,
              fontSize: "10px",
            },
          },
        },
      },

      scrollbar: {
        enabled: true,
        liveRedraw: true,
        height: 0,
      },

      series: [],
    });
  }

  function bindPeerRangeControls() {
    document
      .querySelectorAll('.peer-panel[data-peer-panel="graph"] .chart-range')
      .forEach(function (button) {
        
        button.onclick = function () {
          const range = this.dataset.range;

          setActiveRangeButton(this);
          applyPeerRange(range);
        };
      });
  }

  function activateRangeControl(range) {
    const button = document.querySelector(
      '.peer-panel[data-peer-panel="graph"] ' +
        '.chart-range[data-range="' +
        range +
        '"]',
    );

    if (button) {
      setActiveRangeButton(button);
    }
  }

  function setActiveRangeButton(activeButton) {
    const container = activeButton.closest(".chart-toolbar__ranges");

    if (!container) return;

    container.querySelectorAll(".chart-range").forEach(function (button) {
      button.classList.remove("is-active");

      button.setAttribute("aria-selected", "false");
    });

    activeButton.classList.add("is-active");

    activeButton.setAttribute("aria-selected", "true");
  }

  function getRawSeriesForRange(range) {
    return range === "1D" ? peerSeriesIntraday : peerSeriesHistorical;
  }

  function applyPeerRange(range) {
    if (!peerChartInstance) {
      return;
    }

    peerChartInitState.range = range;

    const rawSeries = getRawSeriesForRange(range);

    const bounds = getSeriesBounds(rawSeries);

    if (!bounds) {
      setPeerEmptyState(true, "No data available for selected range");

      return;
    }

    const end = bounds.max;
    let start;

    if (range === "ALL") {
      start = bounds.min;
    } else {
      const selectedRange = getSelectedRange(range, end);

      start = selectedRange.start;

      if (start < bounds.min) {
        start = bounds.min;
      }
    }

    /*
     * Build percentage-change series using
     * the selected range's first valid price.
     */
    peerSeriesOptions = buildNormalizedSeries(rawSeries, start, end);

    const hasData = peerSeriesOptions.some(function (series) {
      return Array.isArray(series.data) && series.data.length > 0;
    });

    if (!hasData) {
      setPeerEmptyState(true, "No data available for selected range");

      return;
    }

    const yAxis = calculateYAxisBounds(peerSeriesOptions);

    if (!yAxis) {
      setPeerEmptyState(true, "No data available for selected range");

      return;
    }

    setPeerEmptyState(false);

    /*
     * Remove currently displayed series.
     */
    while (peerChartInstance.series.length) {
      peerChartInstance.series[0].remove(false);
    }

    /*
     * Add normalized percentage series.
     */
    peerSeriesOptions.forEach(function (series) {
      peerChartInstance.addSeries(series, false);
    });

    /*
     * Update Y-axis from percentage-change
     * values, not raw prices.
     */
    peerChartInstance.yAxis[0].update(
      {
        min: yAxis.min,
        max: yAxis.max,
        tickInterval: yAxis.tickInterval,
        startOnTick: false,
        endOnTick: false,
      },
      false,
    );

    /*
     * Apply selected date range.
     */
    peerChartInstance.xAxis[0].setExtremes(start, end, false, false);

    peerChartInstance.redraw();
    peerChartInstance.reflow();
  }

  function calculateYAxisBounds(series) {
    let minValue = Infinity;
    let maxValue = -Infinity;

    series.forEach(function (item) {
      if (!Array.isArray(item.data)) {
        return;
      }

      item.data.forEach(function (point) {
        const value = Number(point.y);

        if (!Number.isFinite(value)) {
          return;
        }

        minValue = Math.min(minValue, value);

        maxValue = Math.max(maxValue, value);
      });
    });

    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      return null;
    }

    /*
     * Zero is the percentage comparison
     * baseline, so keep it visible.
     */
    minValue = Math.min(minValue, 0);

    maxValue = Math.max(maxValue, 0);

    if (minValue === maxValue) {
      const equalPadding = Math.abs(minValue) * 0.1 || 1;

      minValue -= equalPadding;
      maxValue += equalPadding;
    }

    const range = maxValue - minValue;

    const padding = Math.max(range * 0.1, 0.1);

    const paddedMin = minValue - padding;

    const paddedMax = maxValue + padding;

    return {
      min: paddedMin,
      max: paddedMax,

      tickInterval: getNiceTickInterval(paddedMax - paddedMin),
    };
  }

  function getNiceTickInterval(range) {
    if (!Number.isFinite(range) || range <= 0) {
      return 1;
    }

    const roughInterval = range / 5;

    const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));

    const normalized = roughInterval / magnitude;

    let niceNormalized;

    if (normalized <= 1) {
      niceNormalized = 1;
    } else if (normalized <= 2) {
      niceNormalized = 2;
    } else if (normalized <= 2.5) {
      niceNormalized = 2.5;
    } else if (normalized <= 5) {
      niceNormalized = 5;
    } else {
      niceNormalized = 10;
    }

    return niceNormalized * magnitude;
  }

  function parseChartDateTime(dateTimeString) {
    if (!dateTimeString) {
      return NaN;
    }

    const raw = String(dateTimeString).trim();

    /*
     * Date only:
     * YYYY-MM-DD
     */
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const dateParts = raw.split("-");

      return new Date(
        Number.parseInt(dateParts[0], 10),
        Number.parseInt(dateParts[1], 10) - 1,
        Number.parseInt(dateParts[2], 10),
      ).getTime();
    }

    /*
     * Date and time:
     * YYYY-MM-DD HH:mm:ss
     * or
     * YYYY-MM-DDTHH:mm:ss
     */

    const match = raw.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
    );

    if (!match) {
      return NaN;
    }

    const timestamp = new Date(
      Number.parseInt(match[1], 10),
      Number.parseInt(match[2], 10) - 1,
      Number.parseInt(match[3], 10),
      Number.parseInt(match[4], 10),
      Number.parseInt(match[5], 10),
      match[6] ? Number.parseInt(match[6], 10) : 0,
    ).getTime();

    return timestamp + MARKET_TIME_OFFSET_MS;
  }

  function getSelectedRange(range, endTime) {
    let start;

    switch (range) {
      case "1D":
        start = endTime - DAY_MS;
        break;

      case "5D":
        start = endTime - 5 * DAY_MS;
        break;

      case "1W":
        start = endTime - 7 * DAY_MS;
        break;

      case "1M":
        start = endTime - 30 * DAY_MS;
        break;

      case "3M":
        start = endTime - 90 * DAY_MS;
        break;

      case "1Y":
        start = endTime - 365 * DAY_MS;
        break;

      case "3Y":
        start = endTime - 3 * 365 * DAY_MS;
        break;

      case "ALL":
      default:
        start = 0;
        break;
    }

    return {
      start: start,
      end: endTime,
    };
  }

  function getSeriesBounds(seriesArray) {
    let min = Infinity;
    let max = -Infinity;

    seriesArray.forEach(function (series) {
      if (!series || !Array.isArray(series.data) || !series.data.length) {
        return;
      }

      series.data.forEach(function (point) {
        const timestamp = point[0];

        if (!Number.isFinite(timestamp)) {
          return;
        }

        min = Math.min(min, timestamp);

        max = Math.max(max, timestamp);
      });
    });

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return null;
    }

    return {
      min: min,
      max: max,
    };
  }

  function formatAxisNumber(value) {
    const absoluteValue = Math.abs(value);

    if (absoluteValue >= 10) {
      return Highcharts.numberFormat(value, 0, ".", ",");
    }

    if (absoluteValue >= 1) {
      return Highcharts.numberFormat(value, 1, ".", ",").replace(/\.0$/, "");
    }

    return Highcharts.numberFormat(value, 2, ".", ",")
      .replace(/0+$/, "")
      .replace(/\.$/, "");
  }

  function formatPrice(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }

    return Highcharts.numberFormat(value, 2, ".", ",");
  }

  function formatSignedChange(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }

    const sign = value > 0 ? "+" : "";

    return sign + Highcharts.numberFormat(value, 2, ".", ",") + "%";
  }

  function getPeerChartStyles() {
    const css = getComputedStyle(document.documentElement);

    function read(variableName, fallback) {
      return css.getPropertyValue(variableName).trim() || fallback || "";
    }

    return {
      axisText: read("--chart-axis-text", "#666666"),

      gridLine: read("--chart-grid-line", "#dddddd"),

      mutedText: read("--chart-muted-text", "#888888"),

      tooltipBg: read("--chart-tooltip-bg", "#ffffff"),

      tooltipText: read("--chart-tooltip-text", "#222222"),

      tooltipBorder: read("--chart-border", "#dddddd"),
    };
  }

  function getSeriesFill(color) {
    return {
      linearGradient: [0, 0, 0, 300],

      stops: [
        [0, setColorAlpha(color, 0.22)],
        [1, setColorAlpha(color, 0.02)],
      ],
    };
  }

  function setColorAlpha(color, alpha) {
    if (!color) {
      return color;
    }

    if (/^rgba?\(/i.test(color)) {
      const values = color
        .replace(/^rgba?\(/i, "")
        .replace(/\)$/, "")
        .split(",")
        .slice(0, 3)
        .map(function (value) {
          return value.trim();
        });

      if (values.length === 3) {
        return "rgba(" + values.join(", ") + ", " + alpha + ")";
      }
    }

    return color;
  }

  function togglePeerChartAxes(showAxes) {
    if (!peerChartInstance) {
      return;
    }

    const styles = getPeerChartStyles();

    peerChartInstance.xAxis[0].update(
      {
        reversed: isRTL(),

        labels: {
          enabled: showAxes,
          rotation: -40,
          align: "right",

          style: {
            color: styles.axisText,
            fontSize: "11px",
          },
        },

        lineWidth: showAxes ? 1 : 0,

        tickLength: showAxes ? 5 : 0,
      },
      false,
    );

    peerChartInstance.yAxis[0].update(
      {
        opposite: isRTL(),

        labels: {
          enabled: showAxes,
          reserveSpace: true,

          align: isRTL() ? "left" : "right",

          style: {
            color: styles.axisText,
            fontSize: "12px",
            whiteSpace: "nowrap",
          },
        },

        gridLineWidth: showAxes ? 1 : 0,

        lineWidth: showAxes ? 1 : 0,

        tickLength: showAxes ? 5 : 0,
      },
      false,
    );
  }

  function setPeerEmptyState(isEmpty, message) {
    if (!peerChartInstance) {
      return;
    }

    if (isEmpty) {
      peerChartInstance.showLoading(
        message || "No data available for selected range",
      );

      while (peerChartInstance.series.length) {
        peerChartInstance.series[0].remove(false);
      }

      togglePeerChartAxes(false);
    } else {
      peerChartInstance.hideLoading();
      togglePeerChartAxes(true);
    }

    peerChartInstance.redraw();
    peerChartInstance.reflow();
  }

  function showChartMessage(message) {
    const canvas = document.getElementById("peerComparisonChart");

    destroyPeerChart();

    if (!canvas) return;

    canvas.innerHTML =
      '<div class="peer-chart-message">' + escapeHtml(message) + "</div>";
  }

  function destroyPeerChart() {
    if (!peerChartInstance) {
      return;
    }

    peerChartInstance.destroy();
    peerChartInstance = null;
  }

  function renderPeerChartLegend(companies) {
    const legend = document.querySelector("[data-peer-chart-legend]");

    if (!legend) return;

    legend.innerHTML = companies
      .map(function (company, index) {
        return `
          <div class="peer-chart-legend__item">
            <span
              class="peer-legend-dot"
              style="--peer-legend-color: ${U.getPeerChartColor(index)}"
              aria-hidden="true"
            ></span>
 
            <span class="peer-chart-legend__name">
              ${escapeHtml(company.name || "-")}
            </span>
 
            ${
              company.isBase
                ? ""
                : `
                  <button
                    type="button"
                    class="peer-chart-legend__remove"
                    aria-label="Remove ${escapeHtml(company.name)}"
                    title="Remove"
                    data-peer-remove="${escapeHtml(company.symbol)}"
                  >
                    ×
                  </button>
                `
            }
          </div>
        `;
      })
      .join("");
  }

  document.addEventListener("theme:changed", function () {
    if (!peerChartInstance) {
      return;
    }

    const styles = getPeerChartStyles();

    peerChartInstance.update(
      {
        xAxis: {
          reversed: isRTL(),
          lineColor: styles.gridLine,
          tickColor: styles.gridLine,

          labels: {
            style: {
              color: styles.axisText,
              fontSize: "11px",
            },
          },
        },

        yAxis: {
          opposite: isRTL(),
          gridLineColor: styles.gridLine,

          labels: {
            align: isRTL() ? "left" : "right",

            style: {
              color: styles.axisText,
              fontSize: "12px",
              whiteSpace: "nowrap",
            },
          },

          plotLines: [
            {
              value: 0,
              color: styles.axisText,
              width: 1,
              zIndex: 2,
            },
          ],
        },

        tooltip: {
          backgroundColor: styles.tooltipBg,

          borderColor: styles.tooltipBorder,

          style: {
            color: styles.tooltipText,
            fontSize: "12px",
          },
        },

        navigator: {
          maskFill: "rgba(44, 129, 255, 0.16)",

          xAxis: {
            reversed: isRTL(),

            labels: {
              style: {
                color: styles.mutedText,
                fontSize: "10px",
              },
            },
          },
        },
      },
      true,
    );

    peerChartInstance.reflow();
  });

  window.PeerComparisonGraph = {
    renderGraphSideTable: renderGraphSideTable,

    renderGraphPlaceholder: renderGraphPlaceholder,

    renderGraphError: renderGraphError,

    renderChart: renderChart,
  };
})(window, document, jQuery);
