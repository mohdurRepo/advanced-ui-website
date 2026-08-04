/* =========================================================
Chart Module
========================================================= */
const DEFAULT_RANGE = "1W";
let isApplyingRange = false;
let chartInstance = null;
let companies = [];
let chartInitState = null;
let seriesOptions = [];
let seriesOptionsMore = [];
let seriesOptionsIntraday = [];
const MARKET_TIME_OFFSET_MS = 3 * 60 * 60 * 1000; // +3 hours
let chartTrend = "neutral";
let xAxisLabel = "";
let yAxisLabel = "";
let tAxisLabel = "";
let emptyLabel = "";
/* ======================= On Load ======================= */
 
$(window).on("load", () => {
  const chartRoot = document.querySelector("[data-chart]");
  if (!chartRoot) return;
 
  const company = {
    name: chartRoot.dataset.chartCompanyName,
    symbol: chartRoot.dataset.chartCompanySymbol,
  };
 
  companies.push(company);
 
  const pageName = chartRoot.dataset.chartPageName;
  const getToken = chartRoot.dataset.chartToken;
  const chartChange = parseFloat(chartRoot.dataset.chartChange || "0");
  xAxisLabel = chartRoot?.dataset.chartXLabel || "Date";
  yAxisLabel = chartRoot?.dataset.chartYLabel || "Price";
  tAxisLabel = chartRoot?.dataset.chartTLabel || "Time";
  emptyLabel = chartRoot?.dataset.chartEmptyLabel || "No data available";
  
  chartTrend = chartChange >= 0 ? "up" : "down";
  
  initChart("SQL_CI_CV_COM", "SQL_CI_DV", company.symbol, pageName, getToken);
  bindRangeControls();
 
  var activeBtn = document.querySelector(".chart-range.is-active");
  if (activeBtn) moveRangeIndicator(activeBtn);
});
 
/* ======================= Init Chart ======================= */
 
async function initChart(
  chartTypeCom,
  chartTypeDv,
  symbol,
  pageName,
  getToken,
) {
  try {
    console.log("Initializing chart for:", symbol);
 
    /*
	 * ===================================================== STEP 1: Load all
	 * data ONCE =====================================================
	 */
    await getFullSeries(chartTypeDv, pageName, getToken); // intraday
    await getFullSeries(chartTypeCom, pageName, getToken); // historical
 
    /*
	 * ===================================================== STEP 2: Select
	 * initial active dataset
	 * =====================================================
	 */
    const activeRange = DEFAULT_RANGE;
    setActiveSeriesByRange(activeRange);
 
    /*
	 * ===================================================== STEP 3: Check if
	 * ANY data exists for default range
	 * =====================================================
	 */
    const hasData = seriesOptions.some(
      (s) => Array.isArray(s.data) && s.data.length > 0,
    );
 
    /*
	 * ===================================================== STEP 4: Determine
	 * logical endTime =====================================================
	 */
    let endTime = 0;
    seriesOptions.forEach((series) => {
      if (!Array.isArray(series.data) || !series.data.length) return;
      endTime = Math.max(endTime, series.data[series.data.length - 1][0]);
    });
 
    if (!endTime) {
      endTime = Date.now();
    }
 
    /*
	 * ===================================================== STEP 5: Resolve
	 * X-axis window for default range
	 * =====================================================
	 */
    const selectedRange = getSelectedRange(activeRange, endTime);
 
    /*
	 * ===================================================== STEP 6: Compute
	 * Y-axis bounds =====================================================
	 */
    const yAxis = hasData
    ? calculateYAxisBounds(seriesOptions, activeRange, selectedRange)
    : { min: 0, max: 1, tickInterval: 0.2 };
 
    /*
	 * ===================================================== STEP 7: Freeze
	 * chart initialization state
	 * =====================================================
	 */
    chartInitState = {
      range: activeRange,
      endTime: endTime,
      selectedRange: selectedRange,
      yAxis: yAxis,
      empty: !hasData,
    };
 
    /*
	 * ===================================================== STEP 8: Draw chart
	 * ONCE =====================================================
	 */
    drawChart();
 
    /*
	 * ===================================================== STEP 9: Apply
	 * default range after chart exists
	 * =====================================================
	 */
    applyRange(activeRange);
 
    var btn = document.querySelector(
      '.chart-range[data-range="' + activeRange + '"]',
    );
    if (btn) {
      setActiveRangeButton(btn);
      moveRangeIndicator(btn);
    }
  } catch (error) {
    console.error("Chart initialization failed:", error);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_X_AXIS_TICKS = 7;

function getVisibleUniqueTradingDates(min, max) {
  const seen = new Set();
  const dates = [];

  seriesOptions.forEach((series) => {
    if (!Array.isArray(series.data)) return;

    series.data.forEach(([ts]) => {
      if (ts < min || ts > max) return;

      // Stable key instead of toLocaleDateString()
      const key = Highcharts.dateFormat("%Y-%m-%d", ts);

      if (!seen.has(key)) {
        seen.add(key);
        dates.push(ts);
      }
    });
  });

  return dates.sort((a, b) => a - b);
}

function buildTickPositions(min, max, maxTicks = MAX_X_AXIS_TICKS) {
  const visibleDates = getVisibleUniqueTradingDates(min, max);

  if (!visibleDates.length) return undefined;

  // If visible trading dates are already few, use them directly
  if (visibleDates.length <= maxTicks) {
    return visibleDates;
  }

  // Evenly sample visible trading dates so max tick count stays <= 7
  const positions = [];
  const lastIndex = visibleDates.length - 1;

  for (let i = 0; i < maxTicks; i++) {
    const index = Math.round((i * lastIndex) / (maxTicks - 1));
    const ts = visibleDates[index];

    if (positions[positions.length - 1] !== ts) {
      positions.push(ts);
    }
  }

  return positions;
}

 
/*
* ========================================================= DRAW CHART - Pure
* rendering - NO business logic
* =========================================================
*/
 
function drawChart() {
	  const styles = getChartStyles();
	 
	  chartInstance = Highcharts.stockChart("drawGraph", {
	    chart: {
	      height: 420,
	      backgroundColor: "transparent",
	      spacing: [12, 8, 12, 8],
	      marginLeft: 60,
	    },
	 
	    credits: {
	      enabled: false,
	    },
	 
	    accessibility: {
	      enabled: false,
	    },
	 
	    rangeSelector: {
	      enabled: false,
	    },
	 
	    exporting: {
	      enabled: true,
	      local: false,
	      sourceWidth: 1200,
	      sourceHeight: 850,
	      scale: 1,
	      buttons: {
	        contextButton: {
	          enabled: false,
	        },
	      },
	    },
	 
	    xAxis: {
	      title: {
	        text: getCurrentXAxisLabel(
	          chartInitState?.range || DEFAULT_RANGE,
	        ),
	        style: {
	          color: styles.axisText,
	          fontSize: "12px",
	          fontWeight: "normal",
	        },
	      },
	 
	      type: "datetime",
	      ordinal: true,
	      reversed: false,
	 
	      lineColor: styles.gridLine,
	      tickColor: styles.gridLine,
	 
	      labels: {
	        rotation: -40,
	        align: "right",
	 
	        style: {
	          color: styles.axisText,
	          fontSize: "11px",
	          whiteSpace: "nowrap",
	        },
	 
	        formatter: function () {
	          const span = this.axis.max - this.axis.min;
	 
	          if (span <= 2 * DAY_MS) {
	            return Highcharts.dateFormat("%H:%M", this.value);
	          }
	 
	          return Highcharts.dateFormat("%d-%m-%y", this.value);
	        },
	      },
	 
	      tickPositioner: function () {
	        if (this.min == null || this.max == null) {
	          return undefined;
	        }
	 
	        const span = this.max - this.min;
	        const isIntraday = span <= 2 * DAY_MS;
	 
	        // Let Highcharts calculate intraday/hourly ticks.
	        if (isIntraday) {
	          return undefined;
	        }
	 
	        return buildTickPositions(
	          this.min,
	          this.max,
	          MAX_X_AXIS_TICKS,
	        );
	      },
	 
	      events: {
	        afterSetExtremes: function (event) {
	          if (event.min == null || event.max == null) {
	            return;
	          }
	 
	          if (isApplyingRange) {
	            return;
	          }
	 
	          applyVisibleTrendStyle(event.min, event.max);
	          updateYAxisForVisibleRange(event.min, event.max);
	          syncActiveRangeButtonFromNavigator(
	            event.min,
	            event.max,
	          );
	        },
	      },
	    },
	 
	    yAxis: {
	      title: {
	        text: yAxisLabel,
	        style: {
	          color: styles.axisText,
	          fontSize: "12px",
	          fontWeight: "normal",
	        },
	      },
	 
	      min: chartInitState.yAxis.min,
	      max: chartInitState.yAxis.max,
	      tickInterval: chartInitState.yAxis.tickInterval,
	 
	      allowDecimals: true,
	      opposite: true,
	 
	      lineColor: styles.gridLine,
	      tickColor: styles.gridLine,
	      gridLineColor: styles.gridLine,
	      gridLineWidth: 1,
	 
	      labels: {
	        reserveSpace: true,
	        align: "right",
	 
	        style: {
	          color: styles.axisText,
	          fontSize: "12px",
	          whiteSpace: "nowrap",
	        },
	 
	        formatter: function () {
	          return Highcharts.numberFormat(
	            this.value,
	            2,
	            ".",
	            ",",
	          );
	        },
	      },
	    },
	 
	    tooltip: {
	      split: true,
	      backgroundColor: styles.tooltipBg,
	      borderColor: styles.tooltipBorder,
	 
	      style: {
	        color: styles.tooltipText,
	        fontSize: "12px",
	      },
	 
	      shadow: false,
	 
	      formatter: function () {
	        const axis =
	          this.points && this.points[0]
	            ? this.points[0].series.xAxis
	            : this.series.xAxis;
	 
	        const span = axis.max - axis.min;
	        const isIntraday = span <= 2 * DAY_MS;
	 
	        const header = isIntraday
	          ? Highcharts.dateFormat(
	              "%A, %b %e, %H:%M",
	              this.x,
	            )
	          : Highcharts.dateFormat(
	              "%A, %b %e, %Y",
	              this.x,
	            );
	 
	        const points = this.points || [this.point];
	 
	        const rows = points.map(function (point) {
	          return (
	            '<span style="color:' +
	            point.color +
	            '">●</span> ' +
	            point.series.name +
	            ": <b>" +
	            Highcharts.numberFormat(
	              point.y,
	              2,
	              ".",
	              ",",
	            ) +
	            "</b>"
	          );
	        });
	 
	        return [header].concat(rows);
	      },
	    },
	 
	    plotOptions: {
	      series: {
	        animation: {
	          duration: 350,
	          easing: "easeOutCubic",
	        },
	      },
	 
	      area: {
	        lineWidth: 2,
	        color: styles.seriesLine,
	        lineColor: styles.seriesLine,
	 
	        marker: {
	          enabled: false,
	        },
	 
	        threshold: null,
	 
	        fillColor: {
	          linearGradient: [0, 0, 0, 300],
	 
	          stops: [
	            [0, styles.seriesFillStart],
	            [1, styles.seriesFillEnd],
	          ],
	        },
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
	        ordinal: true,
	        reversed: false,
	 
	            dateTimeLabelFormats: {
	                minute: '%H:%M',
	                hour: '%H:%M',
	                day: '%e %b' // Keeps the date clean when zooming out
	            },
	    
	        labels: {
	          style: {
	        	  textOutline: 'none', // Removes the text shadow
                
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
	 
	  bindExportButton();
	 
	  if (chartInitState.empty) {
	    setEmptyState(
	      true,
	      emptyLabel
	    );
	  } else {
	    setEmptyState(false);
	  }
	}
	 
	 
	 
	 
	
 
document.addEventListener("theme:changed", () => {
  if (!chartInstance) return;
 
  const styles = getChartStyles();
 
  chartInstance.update(
		  
		  
    {
      xAxis: {
    	  title: { 
			  style: {
				  
				  color: styles.axisText,
				  textOutline: 'none' // Removes the text shadow
                
			  }
		  },
        labels: { style: { color: styles.axisText } },
        lineColor: styles.gridLine,
        tickColor: styles.gridLine,
      },
      yAxis: {
    	  title: { 
			  style: { color: styles.axisText }
		  },
        labels: { style: { color: styles.axisText } },
        gridLineColor: styles.gridLine,
      },
      tooltip: {
        backgroundColor: styles.tooltipBg,
        borderColor: styles.tooltipBorder,
        style: { color: styles.tooltipText },
      },
      plotOptions: {
        area: {
          lineColor: styles.seriesLine,
          fillColor: {
            linearGradient: [0, 0, 0, 300],
            stops: [
              [0, styles.seriesFillStart],
              [1, styles.seriesFillEnd],
            ],
          },
        },
      },
      navigator: {
        maskFill: "rgba(44, 129, 255, 0.16)",
        xAxis: {
          labels: { style: { color: styles.mutedText } },
        },
      },
    },
    true,
  );
  const axis = chartInstance.xAxis[0];
  
  if (axis && axis.min != null && axis.max != null) {
    applyVisibleTrendStyle(axis.min, axis.max);
    chartInstance.redraw();
  }
  
});
 
function updateYAxisForVisibleRange(min, max) {
	  if (!chartInstance) return;
	 
	  const yAxis = calculateYAxisBounds(
	    seriesOptions,
	    chartInitState.range,
	    { start: min, end: max }
	  );
	 
	  if (!yAxis) return;
	 
	  chartInstance.yAxis[0].update({
	    min: yAxis.min,
	    max: yAxis.max,
	    tickInterval: yAxis.tickInterval
	  }, true);
	}
/*
* ========================================================= Y-AXIS CALCULATION
* RULE: - ALL => full historical Y range - Other ranges => visible window only
* =========================================================
*/
 
function calculateYAxisBounds(series, range, selectedRange) {
	  let minValue = Infinity;
	  let maxValue = -Infinity;
	 
	  series.forEach((s) => {
	    if (!Array.isArray(s.data)) return;
	 
	    s.data.forEach(([time, value]) => {
	      const include =
	        range === "ALL" ||
	        (time >= selectedRange.start && time <= selectedRange.end);
	 
	      if (include) {
	        if (value < minValue) minValue = value;
	        if (value > maxValue) maxValue = value;
	      }
	    });
	  });
	 
	  if (!isFinite(minValue) || !isFinite(maxValue)) {
	    return null;
	  }
	 
	  /*
		 * ===================================================== Legacy exact
		 * behavior: min = actual min max = actual max tickInterval = (max -
		 * min) / 5 =====================================================
		 */
	  let tickInterval = (maxValue - minValue) / 5;
	 
	  /*
		 * Prevent invalid tick interval when all values are equal
		 */
	  if (!isFinite(tickInterval) || tickInterval <= 0) {
	    tickInterval = 1;
	  }
	 
	  return {
	    min: minValue,
	    max: maxValue,
	    tickInterval: tickInterval
	  };
	}
 
/* ======================= Data Fetch ======================= */
 
async function getFullSeries(chartType, pageName, getToken) {
  const tokenResponse = await $.ajax({
    url: getToken,
    type: "GET",
    data: { pageName },
  });
 
  const { jwtToken } = JSON.parse(tokenResponse);
 
  const requests = companies.map((company) =>
    ajaxCall(chartType, jwtToken, company, pageName),
  );
 
  const responses = await Promise.all(requests);
 
  return buildSeries(chartType, responses);
}
 
/* ======================= Ajax Call ======================= */
 
function ajaxCall(chartType, jwtToken, company, pageName) {
  return $.ajax({
    url:
        "/" +
      chartType +
      "&chart-parameter=" +
      company.symbol +
      "&pageName=" +
      pageName +
      "&jwtToken=" +
      jwtToken,
    type: "GET",
    dataType: "json",
  });
}
 
/* ======================= Build Series ======================= */
 
function buildSeries(chartType, responses) {
  const target =
    chartType === "SQL_CI_DV"
      ? (seriesOptionsIntraday = [])
      : (seriesOptionsMore = []);
 
  responses.forEach((data, index) => {
    target.push({
    	data: getFormattedGraphJson(data, chartType === "SQL_CI_DV"),
    	name: companies[index].name,
      type: "area",
    });
  });
 
  return target;
}
 
/* ======================= Slide Range on Select ======================= */
 
function moveRangeIndicator(activeBtn) {
  var container = activeBtn.parentElement;
  var indicator = container.querySelector(".chart-range-indicator");
 
  if (!indicator) return;
 
  var btnRect = activeBtn.getBoundingClientRect();
  var containerRect = container.getBoundingClientRect();
 
  var offsetX = btnRect.left - containerRect.left;
  indicator.style.inlineSize = btnRect.width + "px";
  indicator.style.transform = "translateX(" + offsetX + "px)";
}
 
/* ======================= Range Controls ======================= */
 
function bindRangeControls() {
  document.querySelectorAll(".chart-range").forEach((btn) => {
    btn.addEventListener("click", function () {
      const range = this.dataset.range;
      setActiveRangeButton(this);
      moveRangeIndicator(this);
      applyRange(range);
    });
  });
}
 
/* ======================= Select which series to use ======================= */
 
function setActiveSeriesByRange(range) {
  const useIntraday = range === "1D";
  seriesOptions = useIntraday ? seriesOptionsIntraday : seriesOptionsMore;
  return seriesOptions;
}
 
/* ======================= Apply Range ======================= */
 
function getRangeFromVisibleSpan(start, end) {
	  const DAY = 24 * 3600 * 1000;
	  const span = end - start;
	 
	  if (span <= 1.5 * DAY) return "1D";
	  if (span <= 5.5 * DAY) return "5D";
	  if (span <= 8 * DAY) return "1W";
	  if (span <= 35 * DAY) return "1M";
	  if (span <= 100 * DAY) return "3M";
	  if (span <= 400 * DAY) return "1Y";
	  if (span <= 3.3 * 365 * DAY) return "3Y";
	 
	  return "ALL";
	}
 
function syncActiveRangeButtonFromNavigator(start, end) {
	  const range = getRangeFromVisibleSpan(start, end);
	 
	  chartInitState.range = range;
	 
	  const btn = document.querySelector(
	    '.chart-range[data-range="' + range + '"]'
	  );
	 
	  if (!btn) return;
	 
	  setActiveRangeButton(btn);
	  moveRangeIndicator(btn);
	}
 
function applyRange(range) {
	  if (!chartInstance) return;
	 
	  chartInitState.range = range;
	 
	  const styles = getChartStyles();
	 
	  chartInstance.xAxis[0].update(
	    {
	      title: {
	        text: getCurrentXAxisLabel(range),
	        style: {
	          color: styles.axisText,
	          fontSize: "12px",
	          fontWeight: "normal",
	        },
	      },
	    },
	    false,
	  );
	 
	  setActiveSeriesByRange(range);
	 
	  const hasData = seriesOptions.some(function (series) {
	    return (
	      series &&
	      Array.isArray(series.data) &&
	      series.data.length > 0
	    );
	  });
	 
	  if (!hasData) {
	    setEmptyState(
	      true,
	      emptyLabel
	    );
	    return;
	  }
	 
	  setEmptyState(false);
	 
	  const bounds = getSeriesBounds(seriesOptions);
	 
	  if (!bounds) {
	    setEmptyState(
	      true,
	      emptyLabel
	    );
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
	 
	  const yAxis = calculateYAxisBounds(
	    seriesOptions,
	    range,
	    {
	      start,
	      end,
	    },
	  );
	 
	  if (!yAxis) {
	    setEmptyState(
	      true,
	      emptyLabel
	    );
	    return;
	  }
	 
	  while (chartInstance.series.length) {
	    chartInstance.series[0].remove(false);
	  }
	 
	  seriesOptions.forEach(function (series) {
	    chartInstance.addSeries(series, false);
	  });
	 
	  chartInstance.yAxis[0].update(
	    {
	      min: yAxis.min,
	      max: yAxis.max,
	      tickInterval: yAxis.tickInterval,
	    },
	    false,
	  );
	 
	  setTimeout(function () {
	    if (
	      !chartInstance ||
	      !chartInstance.xAxis ||
	      !chartInstance.xAxis[0]
	    ) {
	      return;
	    }
	 
	    isApplyingRange = true;
	 
	    chartInstance.xAxis[0].setExtremes(
	      start,
	      end,
	      false,
	      false,
	    );
	 
	    isApplyingRange = false;
	 
	    updateYAxisForVisibleRange(start, end);
	    applyVisibleTrendStyle(start, end);
	 
	    chartInstance.redraw();
	    chartInstance.reflow();
	  }, 0);
	}
 
function applyVisibleTrendStyle(start, end) {
	  if (!chartInstance) return;
	 
	  const points = seriesOptions
	    .flatMap(function (s) {
	      return Array.isArray(s.data) ? s.data : [];
	    })
	    .filter(function (point) {
	      return point[0] >= start && point[0] <= end;
	    })
	    .sort(function (a, b) {
	      return a[0] - b[0];
	    });
	 
	  if (points.length < 2) return;
	 
	  chartTrend = points[points.length - 1][1] >= points[0][1] ? "up" : "down";
	 
	  const styles = getChartStyles();
	 
	  chartInstance.series.forEach(function (series) {
	    series.update({
	      color: styles.seriesLine,
	      lineColor: styles.seriesLine,
	      fillColor: {
	        linearGradient: [0, 0, 0, 300],
	        stops: [
	          [0, styles.seriesFillStart],
	          [1, styles.seriesFillEnd],
	        ],
	      },
	    }, false);
	  });
	}
 
/* ======================= Active Button ======================= */
 
function setActiveRangeButton(activeBtn) {
  document.querySelectorAll(".chart-range").forEach((btn) => {
    btn.classList.remove("is-active");
    btn.setAttribute("aria-selected", "false");
  });
 
  activeBtn.classList.add("is-active");
  activeBtn.setAttribute("aria-selected", "true");
}
 
/* ======================= Data Formatter ======================= */
 
function parseChartDateTime(dateTimeString, isIntraday) {
	  if (!dateTimeString) return NaN;
	 
	  const raw = String(dateTimeString).trim();
	 
	  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
	    const dateParts = raw.split("-");
	    const year = parseInt(dateParts[0], 10);
	    const month = parseInt(dateParts[1], 10) - 1;
	    const day = parseInt(dateParts[2], 10);
	 
	    return new Date(year, month, day, 12, 0, 0).getTime();
	    
	  }
	 
	  const parts = raw.split(" ");
	  if (parts.length === 2) {
	    const dateParts = parts[0].split("-");
	    const timeParts = parts[1].split(":");
	 
	    if (dateParts.length === 3 && timeParts.length >= 2) {
	      const year = parseInt(dateParts[0], 10);
	      const month = parseInt(dateParts[1], 10) - 1;
	      const day = parseInt(dateParts[2], 10);
	      const hour = parseInt(timeParts[0], 10);
	      const minute = parseInt(timeParts[1], 10);
	      const second = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;
	 
	      let timestamp;
	      
	      if (isIntraday) {
	        timestamp =
	          new Date(year, month, day, hour, minute, second).getTime() +
	          MARKET_TIME_OFFSET_MS;
	      } else {
	        timestamp = new Date(year, month, day, 12, 0, 0).getTime();
	      }
	       
	      return timestamp;
	    }
	  }
	 
	  return NaN;
	}
 
function getFormattedGraphJson(data, isIntraday) {
	  if (!Array.isArray(data)) return [];
	 
	  return data
	    .map((point) => {
	      const timestamp = parseChartDateTime(point.dateTime, isIntraday);
	      const value = parseFloat(point.indexPrice);
	 
	      return !isNaN(timestamp) && !isNaN(value) && value!==0 ? [timestamp, value] : null;
	    })
	    .filter(Boolean)
	    .sort((a, b) => a[0] - b[0]);
	}
 
function getSelectedRange(range, endTime) {
  const DAY = 24 * 3600 * 1000;
  let start;
  const end = endTime;
 
  switch (range) {
    case "1D":
      start = end - 1 * DAY;
      break;
    case "5D":
      start = end - 5 * DAY;
      break;
    case "1W":
      start = end - 6 * DAY;
      break;
    case "1M":
      start = end - 30 * DAY;
      break;
    case "3M":
      start = end - 90 * DAY;
      break;
    case "1Y":
      start = end - 365 * DAY;
      break;
    case "3Y":
      start = end - 3 * 365 * DAY;
      break;
    case "ALL":
    default:
      start = 0;
  }
 
  return { start, end };
}
 
/* ======================= Chart Styles ======================= */
 
function getChartStyles() {
  const css = getComputedStyle(document.documentElement);
  const read = (v) => css.getPropertyValue(v).trim();
 
  return {
    bg: read("--chart-bg"),
    surface: read("--chart-surface"),
    border: read("--chart-border"),
 
    text: read("--chart-text"),
    mutedText: read("--chart-muted-text"),
 
    axisText: read("--chart-axis-text"),
    gridLine: read("--chart-grid-line"),
 
    seriesLine:
	  chartTrend === "down"
	    ? read("--chart-series-negative")
	    : read("--chart-series-positive"),
	 
	seriesFillStart:
	  chartTrend === "down"
	    ? read("--chart-series-negative-fill-start")
	    : read("--chart-series-positive-fill-start"),
	 
	seriesFillEnd:
	  chartTrend === "down"
	    ? read("--chart-series-negative-fill-end")
	    : read("--chart-series-positive-fill-end"),
 
    tooltipBg: read("--chart-tooltip-bg"),
    tooltipText: read("--chart-tooltip-text"),
    tooltipBorder: read("--chart-border"),
  };
}
 
function toggleChartAxes(showAxes) {
	  if (!chartInstance) return;
	 
	  const styles = getChartStyles();
	  const currentRange = chartInitState?.range || DEFAULT_RANGE;
	  const currentXAxisLabel =
	    currentRange === "1D" ? tAxisLabel : xAxisLabel;
	 
	  chartInstance.xAxis[0].update(
	    {
	      title: {
	        text: showAxes ? currentXAxisLabel : null,
	        style: {
	          color: styles.axisText,
	          fontSize: "12px",
	          fontWeight: "normal",
	        },
	      },
	      labels: {
	        enabled: showAxes,
	        rotation: -40,
	        align: "right",
	        style: {
	          color: styles.axisText,
	          fontSize: "11px",
	          whiteSpace: "nowrap",
	        },
	      },
	      lineColor: styles.gridLine,
	      tickColor: styles.gridLine,
	      lineWidth: showAxes ? 1 : 0,
	      tickLength: showAxes ? 5 : 0,
	    },
	    false,
	  );
	 
	  chartInstance.yAxis[0].update(
	    {
	      title: {
	        text: showAxes ? yAxisLabel : null,
	        margin: 16,
	        style: {
	          color: styles.axisText,
	          fontSize: "12px",
	          fontWeight: "normal",
	        },
	      },
	      labels: {
	        enabled: showAxes,
	        reserveSpace: true,
	        align: "right",
	        style: {
	          color: styles.axisText,
	          fontSize: "12px",
	          whiteSpace: "nowrap",
	        },
	        formatter: function () {
	          return Highcharts.numberFormat(this.value, 2, ".", ",");
	        },
	      },
	      lineColor: styles.gridLine,
	      tickColor: styles.gridLine,
	      gridLineColor: styles.gridLine,
	      gridLineWidth: showAxes ? 1 : 0,
	      lineWidth: showAxes ? 1 : 0,
	      tickLength: showAxes ? 5 : 0,
	    },
	    false,
	  );
	}
 
function setEmptyState(isEmpty, message) {
  if (!chartInstance) return;
 
  if (isEmpty) {
    chartInstance.showLoading(
      message || "No data available for selected range",
    );
 
    // Remove existing series so no stale chart remains
    while (chartInstance.series.length) {
      chartInstance.series[0].remove(false);
    }
 
    // Hide X and Y axes when there is no data
    toggleChartAxes(false);
 
    chartInstance.redraw();
    chartInstance.reflow();
  } else {
    chartInstance.hideLoading();
 
    // Restore X and Y axes when data exists
    toggleChartAxes(true);
 
    chartInstance.redraw();
    chartInstance.reflow();
  }
}
 
function getSeriesBounds(seriesArr) {
  var min = Infinity;
  var max = -Infinity;
 
  seriesArr.forEach(function (s) {
    if (!s || !Array.isArray(s.data) || !s.data.length) return;
    min = Math.min(min, s.data[0][0]);
    max = Math.max(max, s.data[s.data.length - 1][0]);
  });
 
  if (!isFinite(min) || !isFinite(max)) return null;
  return { min: min, max: max };
}

function bindExportButton() {
	  const exportBtn = document.getElementById("exportBtn");
	  const exportMenu = document.getElementById("exportMenu");
	 
	  if (!exportBtn || !exportMenu || !chartInstance) return;
	 
	  exportBtn.onclick = function (event) {
	    event.preventDefault();
	    event.stopPropagation();
	 
	    const isHidden = exportMenu.hasAttribute("hidden");
	 
	    if (isHidden) {
	      exportMenu.removeAttribute("hidden");
	      exportBtn.setAttribute("aria-expanded", "true");
	    } else {
	      exportMenu.setAttribute("hidden", "");
	      exportBtn.setAttribute("aria-expanded", "false");
	    }
	  };
	 
	  exportMenu.addEventListener("click", function (event) {
	    const actionBtn = event.target.closest("[data-export-action]");
	    if (!actionBtn || !chartInstance) return;
	 
	    const action = actionBtn.dataset.exportAction;
	 
	    exportMenu.setAttribute("hidden", "");
	    exportBtn.setAttribute("aria-expanded", "false");
	 
	    if (action === "fullscreen") {
	      chartInstance.fullscreen.toggle();
	      return;
	    }
	 
	    if (action === "print") {
	      chartInstance.print();
	      return;
	    }
	 
	    const fileName = getChartExportFileName();
	 
	    if (action === "png") {
	      chartInstance.exportChart({ type: "image/png", filename: fileName });
	    }
	 
	    if (action === "jpeg") {
	      chartInstance.exportChart({ type: "image/jpeg", filename: fileName });
	    }
	 
	    if (action === "pdf") {
	      chartInstance.exportChart({ type: "application/pdf", filename: fileName });
	    }
	 
	    if (action === "svg") {
	      chartInstance.exportChart({ type: "image/svg+xml", filename: fileName });
	    }
	  });
	 
	  document.addEventListener("click", function () {
	    exportMenu.setAttribute("hidden", "");
	    exportBtn.setAttribute("aria-expanded", "false");
	  });
	}
function getChartExportFileName() {
  const chartRoot = document.querySelector("[data-chart]");
  const companyName = chartRoot?.dataset.chartCompanyName || "company";
 
  return companyName
    .toString()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9-_]/g, "")
    .toLowerCase() + "-performance-chart";
}


function getCurrentXAxisLabel(range){
	return range === "1D" ? tAxisLabel : xAxisLabel;
}


<script type="text/javascript">

/**
 * Renders financial charts using Highcharts
 * Compatible with JSP environments (avoids EL conflicts)
 */

// Language translations
const chartTranslations = {
  en: {
    time: "Time",
    index: "Index",
    chartError: " Chart Loading Error",
    noData: "Empty chart for {CHART} index (no data available)",
    priceChart: "Price chart for {CHART} index",
    tasi: "Tadawul All Share Index (TASI)",
    nomuc: "Parallel Market Capped Index (NomuC)",
    sukuk: "Sukuk/Bonds Market Index",
    reits: "REITs", 
    mt30: "MT30"
  },
  ar: {
    time: "الوقت",
    index: "المؤشر",
    chartError: " خطأ في تحميل الرسم البياني",
    noData: "مخطط فارغ لمؤشر {CHART} (لا توجد بيانات متاحة)",
    priceChart: "الرسم البياني للسعر لمؤشر {CHART}",
    tasi: "مؤشر السوق الرئيسية (تاسي)",
    nomuc: "مؤشر السوق الموازية (نمو حد أعلى)",
    sukuk: "مؤشر سوق الصكوك / السندات",
    reits: "صناديق الإستثمار العقارية",
     mt30: "إم تي 30"
  }
};


// Detect language (from <html lang="..."> or fallback to English)
let chartLang = document.documentElement.lang === "ar" ? "ar" : "en";

function renderChart(chartId, targetElement) {
  const safeId = String(chartId || 'tasi').trim().toLowerCase();
  if (!safeId) {
    console.error('Invalid chartId received');
    renderErrorState(targetElement, chartTranslations[chartLang].chartError);
    return;
  }

  const apiUrl = buildApiUrl(safeId);
  if (!apiUrl) {
    console.warn('Failed to build API URL, rendering empty chart');
    drawEmptyChart(safeId, targetElement);
    return;
  }

  console.log('Fetching data for:', safeId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  fetch(apiUrl, { signal: controller.signal })
    .then(response => {
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(data => {
      if (!isValidData(data)) {
        console.warn('Invalid data structure, rendering empty chart');
        drawEmptyChart(safeId, targetElement);
      } else {
        drawChart(data, safeId, targetElement);
      }
    })
    .catch(error => {
      console.error('Fetch failed:', error.message);
      drawEmptyChart(safeId, targetElement);
    });
}

// Helper Functions ============================================

function buildApiUrl(safeId) {
  try {
    const params = new URLSearchParams();
    params.append('methodType', 'parsingMethod');

    const sid = safeId.toLowerCase();
    let chartType = "SQL_MI_MSPV";
    if (sid === "nomuc") {
      chartType = "SQL_MI_MSPV_SME";
    } else if (sid === "sukuk") {
      chartType = "SQL_MI_MSPV_SUKUK";
    }
    params.append('chart-type', chartType);

    let chartParam;
    if (sid === "sukuk") {
      chartParam = "tsbi";
    } else if (sid === "reits") {
      chartParam = "trti";
    } else {
      chartParam = safeId;
    }
    params.append('chart-parameter', chartParam);

    params.append('format', 'json');
    params.append('pageName', 'MarketSummaryHomePageGraph');
    params.append('jwtToken', '<%=JwtBean.getJwtToken("marketStatusHomeGraph")%>');

    return '/tadawul.eportal.charts.v2/ChartGenerator?' + params.toString();
  } catch (e) {
    console.error('URL build failed:', e);
    return null;
  }
}

function isValidData(data) {
  return Array.isArray(data) && data.length > 0 && 
         data.every(item => item.dateTime && item.indexPrice !== undefined);
}

function renderErrorState(element, message) {
  element.innerHTML = '<div class="chart-error">' +
    '<p>' + chartTranslations[chartLang].chartError + '</p>' +
    '<small>' + message + '</small>' +
    '</div>';
}

// Empty Chart Rendering ======================================
function drawEmptyChart(chartId, targetElement) {
  try {
    Highcharts.chart(targetElement, getEmptyChartConfig(chartId));
  } catch (e) {
    console.error('Empty chart render failed:', e);
    renderErrorState(targetElement, 'Technical error in chart rendering');
  }
}

function getEmptyChartConfig(chartId) {
  const style = getChartStyles();
  const t = chartTranslations[chartLang];
  
  const now = new Date();
  const categories = [];
  for (let i = 6; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 3600000);
    categories.push(formatTime(time));
  }
  var chartName = t[chartId] || chartId.toUpperCase();
  
  return {
    chart: {
      type: 'area',
      backgroundColor: 'transparent',
      spacing: [10, 10, 10, 10]
    },
    exporting: {
	  enabled: false
	},
	navigation: {
	  buttonOptions: {
	    enabled: false
	  }
	},
    title: { text: null },
    xAxis: {
      categories: categories,
      labels: {
        style: { color: style.axisText },
        step: 1
      },
      lineColor: style.axisLine,
      title: {
        text: t.time, 
        style: { color: style.axisText }
      }
    },
    yAxis: {
      min: 0,
      max: 100,
      opposite: true,
      title: { 
        text: t.index,
        style: { color: style.axisText } 
      },
      labels: {
        style: { color: style.axisText },
        formatter: function() {
          return Highcharts.numberFormat(this.value, 0, '.', ',');
        }
      },
      gridLineColor: style.gridLine
    },
    tooltip: { enabled: false },
    plotOptions: {
      area: {
        fillOpacity: 0,
        lineWidth: 0
      }
    },
    
    series: [{
    
      name: chartName,
      data: []
    }],
    legend: {
      itemStyle: {
        color: 'rgb(156, 179, 201)',
        fontWeight: 'normal'
      },
      itemHoverStyle: {
        color: 'rgb(156, 179, 201)',
        cursor: 'pointer'
      }
    },
    credits: { enabled: false },
    accessibility: {
      enabled: true,
      description: t.noData.replace("{CHART}", chartId.toUpperCase())
    },
    rangeSelector: {
      buttonSpacing: 70
    },
    responsive: {
      rules: [{
        condition: { maxWidth: 1400 },
        chartOptions: {
          rangeSelector: {
            dropdown: "always",
            buttonSpacing: 50
          }
        }
      }]
    }
  };
}

// Chart Rendering ============================================
function drawChart(data, chartId, targetElement) {
  try {
    const formattedData = data.map(item => ({
      x: new Date(item.dateTime).getTime(), // timestamp
      y: item.indexPrice,
      //name: chartId.toUpperCase()
    }));
    
    Highcharts.setOptions({
	  time: {
	    useUTC: false
	  }
	});

    Highcharts.chart(targetElement, getChartConfig(formattedData, chartId));
    
  } catch (e) {
    console.error('Chart render failed:', e);
    renderErrorState(targetElement, 'Technical error in chart rendering');
  }
}

function getChartConfig(data, chartId) {
  const range = calculateAxisRange(data.map(item => item.y));
  const style = getChartStyles();
  const t = chartTranslations[chartLang];
  var chartName = t[chartId] || chartId.toUpperCase();

  return {
    chart: {
      type: 'area',
      backgroundColor: 'transparent',
      spacing: [10, 10, 10, 10]
    },
    exporting: {
  enabled: false
},
navigation: {
  buttonOptions: {
    enabled: false
  }
},
    title: { text: null },
    xAxis: {
  type: 'datetime',
  labels: {
    style: { color: style.axisText },
    formatter: function () {
      const date = new Date(this.value);
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
  },
  lineColor: style.axisLine,
  title: {
    text: t.time,
    style: { color: style.axisText }
  },
  crosshair: {
    width: 1,
    color: style.gridLine,
    label: {
      enabled: true,
      backgroundColor: style.tooltipBackground,
      borderColor: style.lineColor,
      borderRadius: 3,
      padding: 5,
      style: {
        color: '#ffffff',
        fontSize: '11px'
      },
      format: '{value:%A, %b %e, %H:%M}'
    }
  }
},
      yAxis: {
      min: range.min,
      max: range.max,
      opposite: true,
      title: {
        text: t.index,
        style: { color: style.axisText }
      },
      labels: {
        style: { color: style.axisText },
        formatter: function () {
          // Automatically sets 2 decimal places if the axis value is a fraction
          const decimals = (this.value % 1 !== 0) ? 2 : 0;
          return Highcharts.numberFormat(this.value, decimals, '.', ',');
        }
      },
      gridLineColor: style.gridLine
    },
  
tooltip: {
  split: true,
  useHTML: true,
  backgroundColor: style.tooltipBackground,
  borderColor: style.lineColor,
  style: { color: '#ffffff' },
  
  headerFormat: '<span style="font-size:11px;">{point.key:%A, %b %e, %H:%M}</span><br/>',
  
  pointFormatter: function () {
  
    return '<b>' + this.series.name  + ':</b> ' + Highcharts.numberFormat(this.y, 2);
  }
},
    plotOptions: {
      area: {
        fillOpacity: 0.3,
        lineColor: style.lineColor,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, style.fillColor],
            [1, style.fillColorEnd]
          ]
        },
        marker: { radius: 0 },
        lineWidth: 2
      }
    },
    series: [{
   
      name: chartName,
      data: data
    }],
    legend: {
      itemStyle: {
        color: 'rgb(156, 179, 201)',
        fontWeight: 'normal'
      },
      itemHoverStyle: {
        color: 'rgb(156, 179, 201)',
        cursor: 'pointer'
      }
    },
    credits: { enabled: false },
    accessibility: {
      enabled: true,
      description: t.priceChart.replace("{CHART}", chartId.toUpperCase())
    },
    navigator: {
      enabled: true,
      adaptToUpdatedData: false,
     backgroundColor: '#f0f0f0',  
      maskFill: 'rgba(0, 0, 0, 0.1)',
     outlineColor: '#677985',
     
     xAxis: {
            labels: {
                style: {
                    textOutline: 'none', // Removes the text shadow
                    color: '#ffffff'     // Optional: Set a clean text color
                }
            }
        }
     
    },
    rangeSelector: {
      buttonSpacing: 70
    },
    responsive: {
      rules: [{
        condition: { maxWidth: 1400 },
        chartOptions: {
          rangeSelector: {
            dropdown: "always",
            buttonSpacing: 50
          }
        }
      }]
    }
  };
}


function getChartStyles() {
  const css = getComputedStyle(document.documentElement);
  return {
    lineColor: css.getPropertyValue('--highcharts-line-color') || '#00e0b5',
    fillColor: css.getPropertyValue('--highcharts-fill-color') || 'rgba(0, 224, 181, 0.35)',
    fillColorEnd: 'rgba(0, 224, 181, 0)',
    axisText: '#9cb3c9',
    axisLine: '#435c72',
    gridLine: '#2f3e4e',
    tooltipBackground: '#1a3c5f'
  };
}

function formatTime(date) {
  return isNaN(date) ? '' : date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true
  });
}

function calculateAxisRange(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const delta = max - min;
  const padding = delta * 0.05;

  // If the total variation is less than 2 points, preserve exact decimal ranges
  if (delta < 2) {
    return {
      min: Number((min - (padding || 0.01)).toFixed(4)),
      max: Number((max + (padding || 0.01)).toFixed(4))
    };
  }

  // Otherwise, safely continue using whole numbers for large-scale charts
  return {
    min: Math.floor(min - padding),
    max: Math.ceil(max + padding)
  };
}




function showTab(targetId, dataKey) {
    console.log('inside showTab');
 
    const allCharts = ['tasi', 'nomuc', 'mt30', 'sukuk', 'reits'];
 
    allCharts.forEach(function(id) {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = (id === targetId) ? 'block' : 'none';
        }
    });
    const targetElement = document.getElementById(targetId);
 renderChart(dataKey, targetElement);
    console.log("after allCharts.forEach(id)");
    
    console.log('targetElement: ' + targetElement);
 
 
}

document.addEventListener('DOMContentLoaded', () => {
  // Default to first tab
  showTab('tasi', 'tasi');
 
  document.querySelectorAll('.tab-button').forEach(button => {
  console.log('before button.addEventListener');
    button.addEventListener('click', () => {
    console.log('after button.addEventListener');
      const key = button.getAttribute('data-key');
      const target = button.getAttribute('data-target');
      showTab(target, key);
    });
  });
});



</script>