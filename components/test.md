Short answer: yes, all of it is configurable. The component itself is configured from JavaScript, and your page script is the bridge that reads data-\* attributes from the HTML and passes them in. Today the page script reads only a few attributes, but adding more takes a few lines, shown in section 4.

One correction first: "Index Value" is the y-axis title (the vertical, price axis). The x-axis title is "Time" on 1D and "Date" on historical ranges.

1. How configuration flows
   HTML (data-\* attributes, <html lang>, CSS tokens)
   ↓ read by
   Page script (main-market-performance.js)
   ↓ builds a config object
   SEMarketCharts.create(element, config)
   ↓
   Component (options, i18n, theme, live)

Anything not in the config falls back to the component's defaults. For example, axis titles fall back to the built-in Arabic/English strings, and date formats fall back to the built-in per-range formats.

2. What can already be set from HTML today

Read by your page script (main-market-performance.js):

HTML Controls
.chart-toolbar\_\_title text Chart name (tooltip header, messages, export filename)
data-chart-symbol / data-chart-company-symbol Symbol
data-chart-parameter API chart-parameter
data-chart-page-name API pageName
data-chart-intraday / data-chart-historical API chart types
data-chart-token JWT

<html lang="ar">	Language (all built-in strings, number and date formatting)

Read by the component directly:

HTML Controls
data-chart-context="overview|performance" on the chart element Layout preset (spacing, navigator size)
data-chart-range="1W" on buttons Range buttons
data-chart-type="candlestick" on buttons Mode buttons
data-market-chart-root on the wrapper Controls scope
dir="rtl" Y-axis side, when opposite isn't forced
CSS --chart-\* variables All colors and opacities 3. Everything configurable from script
Text and labels
Option Example Notes
name "Main Market Performance" Tooltip title, screen-reader text
xAxisTitle "Time", { "1D": "Time", default: "Date" }, false A string, a per-range object, or false to hide it
yAxisTitle "Index Value", false
currency "SAR" Shown in the tooltip; "" hides it
accessibilityDescription "…" Screen-reader description
strings.axis { time, date, value } Default axis titles
strings.tooltip { value, open, high, low, close } Tooltip row labels
strings.messages { loading, empty, error } Status messages
strings.highcharts { resetZoom, … } Highcharts UI text

Built-in defaults, if you don't set them:

    English	Arabic

x-axis title (1D) Time الوقت
x-axis title (historical) Date التاريخ
y-axis title Index Value قيمة المؤشر
Date formats

Formats use Intl.DateTimeFormat option objects, not pattern strings like "DD/MM/YYYY". This is how Arabic and English formatting come out correct automatically.

Option Applies to
dateFormats x-axis labels (also used by the navigator)
tooltipDateFormats Tooltip date line
navigator.formats Navigator labels only, if they should differ

Each is keyed by range, with default as the fallback:

js
dateFormats: {
"1D": { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, // 10:00
"1W": { weekday: "short", day: "2-digit" }, // Sun 28
"1M": { day: "2-digit", month: "short" }, // 28 Sep
"1Y": { month: "short", year: "numeric" }, // Sep 2026
default: { year: "numeric" }, // 2026
},

tooltipDateFormats: {
"1D": { day: "2-digit", month: "short", year: "numeric",
hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, // 28 Sep 2026, 10:05
default: { day: "2-digit", month: "long", year: "numeric" }, // 28 September 2026
},

The Intl options you can use:

weekday, month: "short", "long" or "narrow"
day, hour, minute, second: "numeric" or "2-digit"
year: "numeric" or "2-digit"
hourCycle: "h23" (24-hour) or "h12"

You only need to set the ranges you want to change; everything else keeps the built-in formats.

Arabic digits: language: "ar" renders Arabic-Indic digits (١٠:٠٠). To keep Arabic text with Latin digits (10:00), set language: "ar-SA-u-nu-latn".

Number formats
Option Example Notes
decimals 0 Tooltip values and the y-axis
yAxis.format { decimals: 0, useGrouping: true } Y-axis only. useGrouping controls the thousands separator (10,838).
X-axis (xAxis)
Option Example Notes
title { "1D": "Time", default: "Date" } Same as xAxisTitle
rotation { "1D": 0, default: -20 } Label angle, per range
labelOptions.style { fontSize: "12px" } Label styling
titleStyle, titleMargin Title styling
labels false Hide labels
showFirstLabel / showLastLabel false
tickInterval 30 _ 60_000 Fixed intraday step (for example every 30 minutes)
intradayTickPixelGap 88 Intraday label density
historicalTickCount { default: 6, "5Y": 5 } Historical label count
historicalTickPixelGap 108 Historical label density
minPadding / maxPadding { "1D": 0, default: 0.02 } Edge space
gridLineWidth 1 Vertical grid lines
crosshair false or { color }
Y-axis (yAxis)
Option Example Notes
title "Index Value" or false
opposite true Right side in both LTR and RTL
format { decimals, useGrouping }
labelOptions, titleOptions { style: {…} } Styling
tickPixelInterval 56 Gridline density
minPadding / maxPadding 0.06 Top and bottom space
gridLineWidth, gridLineDashStyle 1, "ShortDot"
crosshair false
Chart behavior
Option Example Notes
range, mode "1D", "trend" Initial view
context "performance" Layout preset
language, timeZone "ar", "Asia/Riyadh"
showEmptyState true Keep the chart frame visible while there's no data
animation { duration: 450 } or false
previousClose 10838.1 Tooltip change baseline
maxPoints, candleBucketSize 900, 60_000 Intraday limits
liveWindowDuration null or 2 _ 3600_000 null shows the full session; a duration follows a trailing window
tooltip { enabled, style, options } options passes raw Highcharts tooltip settings
navigator { height, margin, labels, handleWidth, handleHeight, showFirstLabel, … }
exporting { enabled, filename, scale, … }
controls { root, rangeSelector, typeSelector } Custom button selectors
live { interval, requestTimeout, retry, pauseWhenHidden, … } Polling behavior 4. Making labels and formats configurable from HTML

Keep this logic in the page script, not the component. It maps attributes onto the config options above. Simple values go in plain attributes, and structured values (per-range formats) go in JSON attributes.

HTML:

html

<section data-performance-chart
  data-chart-symbol="TASI"
  data-chart-name="أداء السوق الرئيسية"
  data-chart-x-title-intraday="الوقت"
  data-chart-x-title="التاريخ"
  data-chart-y-title="قيمة المؤشر"
  data-chart-decimals="0"
  data-chart-currency=""
  data-chart-date-formats='{"1M":{"day":"2-digit","month":"long"}}'
  data-chart-tooltip-date-formats='{"default":{"day":"2-digit","month":"long","year":"numeric"}}'>

Page script: add these helpers:

js
function readJSONAttribute(value) {
if (!renderedValue(value)) {
return undefined;
}

try {
const parsed = JSON.parse(value);

    return isPlainObject(parsed) ? parsed : undefined;

} catch {
console.warn("Invalid JSON in chart data attribute.", value);

    return undefined;

}
}

/\*

- Only attributes that are present override the component defaults.
  \*/
  function resolveDisplayConfiguration() {
  const { dataset } = dom.root;

const xIntraday = renderedValue(dataset.chartXTitleIntraday);
const xHistorical = renderedValue(dataset.chartXTitle);
const yTitle = renderedValue(dataset.chartYTitle);
const decimals = toFiniteNumber(dataset.chartDecimals);

return {
...(renderedValue(dataset.chartName) && { name: dataset.chartName.trim() }),

    ...((xIntraday || xHistorical) && {
      xAxisTitle: {
        ...(xIntraday && { "1D": xIntraday }),
        ...(xHistorical && { default: xHistorical }),
      },
    }),

    ...(yTitle && { yAxisTitle: yTitle }),

    ...(decimals !== null && { decimals }),

    ...(dataset.chartCurrency !== undefined && { currency: dataset.chartCurrency.trim() }),

    ...(readJSONAttribute(dataset.chartDateFormats) && {
      dateFormats: readJSONAttribute(dataset.chartDateFormats),
    }),

    ...(readJSONAttribute(dataset.chartTooltipDateFormats) && {
      tooltipDateFormats: readJSONAttribute(dataset.chartTooltipDateFormats),
    }),

};
}

Merge it last in createChartConfiguration(), so the HTML wins over the page defaults:

js
function createChartConfiguration(ranges) {
const display = resolveDisplayConfiguration();

return {
// …existing config…

    ...display,

    yAxis: {
      opposite: true,
      format: { decimals: display.decimals ?? 0, useGrouping: true },
    },

};
}

Also let getChartName() prefer data-chart-name before the toolbar title text, so the tooltip, messages and export filename all use the same name.

5. Recommendations
   Leave text attributes empty unless you need custom wording. The built-in i18n already switches between Arabic and English from <html lang>. Use attributes only for page-specific wording like the chart name.
   Per-language values come from the server. Your JSP renders the attribute in the page's language, the same way it renders the title today.
   Formats belong in JSON attributes, or in window.marketPerformanceConfig if several charts share them. Don't create one attribute per range.
   Colors stay in CSS (--chart-\* tokens), never in data attributes. That's what keeps dark mode and themes working.

Want me to fold section 4 into the complete page script, so data-chart-name, the titles, decimals, currency and formats all work out of the box?
