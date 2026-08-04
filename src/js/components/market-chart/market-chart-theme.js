/* ==========================================================================
   Market Chart Theme
   ========================================================================== */

/**
 * Reads a CSS custom property and returns the fallback when the property is
 * missing or empty.
 */
function readProperty(styles, property, fallback) {
  const value = styles.getPropertyValue(property).trim();

  return value || fallback;
}

/**
 * Reads a numeric CSS custom property.
 */
function readNumber(styles, property, fallback) {
  const value = Number.parseFloat(styles.getPropertyValue(property));

  return Number.isFinite(value) ? value : fallback;
}

/* ==========================================================================
   Theme Reader
   ========================================================================== */

/**
 * Builds a normalized theme object from the chart element's active CSS
 * context. This allows page themes, local dark surfaces, accents, and
 * high-contrast mode to update charts without page-specific JavaScript.
 */
export function getMarketChartTheme(element) {
  if (!(element instanceof Element)) {
    throw new TypeError(
      "getMarketChartTheme() requires a valid chart element.",
    );
  }

  const styles = window.getComputedStyle(element);

  const background = readProperty(styles, "--chart-bg", "transparent");

  const text = readProperty(
    styles,
    "--chart-text",
    readProperty(styles, "--color-text", "#001f33"),
  );

  const heading = readProperty(
    styles,
    "--chart-heading",
    readProperty(styles, "--color-heading", text),
  );

  const muted = readProperty(
    styles,
    "--chart-muted",
    readProperty(styles, "--color-text-muted", "#64707a"),
  );

  const border = readProperty(
    styles,
    "--chart-border",
    readProperty(styles, "--color-border", "#d7dde3"),
  );

  const borderStrong = readProperty(
    styles,
    "--chart-border-strong",
    readProperty(styles, "--color-border-strong", border),
  );

  const grid = readProperty(styles, "--chart-grid", border);

  const crosshair = readProperty(styles, "--chart-crosshair", borderStrong);

  const line = readProperty(
    styles,
    "--chart-line",
    readProperty(styles, "--color-primary", "#0044e3"),
  );

  const success = readProperty(
    styles,
    "--chart-success",
    readProperty(styles, "--color-success", "#15803d"),
  );

  const danger = readProperty(
    styles,
    "--chart-danger",
    readProperty(styles, "--color-danger", "#dc2626"),
  );

  const warning = readProperty(
    styles,
    "--chart-warning",
    readProperty(styles, "--color-warning", "#f59e0b"),
  );

  const neutral = readProperty(styles, "--chart-neutral", muted);

  const candleUp = readProperty(styles, "--chart-candle-up", success);

  const candleUpLine = readProperty(styles, "--chart-candle-up-line", candleUp);

  const candleDown = readProperty(styles, "--chart-candle-down", danger);

  const candleDownLine = readProperty(
    styles,
    "--chart-candle-down-line",
    candleDown,
  );

  const surface = readProperty(styles, "--color-surface", "#ffffff");

  const tooltipBackground = readProperty(styles, "--chart-tooltip-bg", surface);

  const tooltipBorder = readProperty(styles, "--chart-tooltip-border", border);

  const focus = readProperty(
    styles,
    "--chart-focus",
    readProperty(styles, "--focus-ring", line),
  );

  const areaStartOpacity = readNumber(
    styles,
    "--chart-area-start-opacity",
    0.22,
  );

  const areaEndOpacity = readNumber(styles, "--chart-area-end-opacity", 0);

  return {
    background,

    text,
    heading,
    muted,

    border,
    borderStrong,
    grid,
    crosshair,

    line,
    success,
    danger,
    warning,
    neutral,

    candleUp,
    candleUpLine,
    candleDown,
    candleDownLine,

    tooltipBackground,
    tooltipBorder,

    focus,

    areaStartOpacity,
    areaEndOpacity,
  };
}

/* ==========================================================================
   Color Helpers
   ========================================================================== */

/**
 * Converts a supported Highcharts color into an RGBA value.
 */
export function createColorWithOpacity(Highcharts, color, opacity) {
  if (!Highcharts?.color) {
    return color;
  }

  const parsedColor = Highcharts.color(color);

  if (!parsedColor) {
    return color;
  }

  return parsedColor.setOpacity(opacity).get("rgba");
}

/* ==========================================================================
   Area Fill
   ========================================================================== */

/**
 * Creates the subtle vertical gradient used by area charts.
 */
export function createAreaFill(
  Highcharts,
  color,
  startOpacity = 0.22,
  endOpacity = 0,
) {
  return {
    linearGradient: {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 1,
    },

    stops: [
      [0, createColorWithOpacity(Highcharts, color, startOpacity)],

      [1, createColorWithOpacity(Highcharts, color, endOpacity)],
    ],
  };
}

/* ==========================================================================
   Direction
   ========================================================================== */

/**
 * Chooses the semantic series color based on the visible price direction.
 */
export function getMarketChartDirectionColor(theme, direction = "neutral") {
  if (direction === "up") {
    return theme.success;
  }

  if (direction === "down") {
    return theme.danger;
  }

  return theme.line;
}

/* ==========================================================================
   Series Theme
   ========================================================================== */

/**
 * Produces the visual Highcharts series options for the selected chart mode.
 *
 * Supported modes:
 * - trend: area/spline chart
 * - line: line chart
 * - candlestick: OHLC candlestick chart
 */
export function getMarketChartSeriesTheme(
  Highcharts,
  theme,
  mode = "trend",
  direction = "neutral",
) {
  const seriesColor = getMarketChartDirectionColor(theme, direction);

  if (mode === "candlestick") {
    return {
      color: theme.candleDown,
      lineColor: theme.candleDownLine,

      upColor: theme.candleUp,
      upLineColor: theme.candleUpLine,

      lineWidth: 1,

      states: {
        hover: {
          lineWidth: 2,
        },
      },
    };
  }

  if (mode === "line") {
    return {
      color: seriesColor,

      lineWidth: 2,

      marker: {
        enabled: false,

        states: {
          hover: {
            enabled: true,
            radius: 3,
          },
        },
      },

      states: {
        hover: {
          lineWidthPlus: 0,
        },
      },
    };
  }

  return {
    color: seriesColor,

    lineColor: seriesColor,
    lineWidth: 2,

    fillColor: createAreaFill(
      Highcharts,
      seriesColor,
      theme.areaStartOpacity,
      theme.areaEndOpacity,
    ),

    threshold: null,

    marker: {
      enabled: false,

      states: {
        hover: {
          enabled: true,
          radius: 3,
        },
      },
    },

    states: {
      hover: {
        lineWidthPlus: 0,
      },
    },
  };
}
