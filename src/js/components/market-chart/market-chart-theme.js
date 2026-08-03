/* ==========================================================================
   Market Chart Theme
   ========================================================================== */

/**
 * Reads a CSS custom property and returns the provided fallback when the
 * property is missing or empty.
 */
function readProperty(styles, property, fallback) {
  const value = styles.getPropertyValue(property).trim();

  return value || fallback;
}

/* ==========================================================================
   Theme Reader
   ========================================================================== */

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

  const candleUp = readProperty(styles, "--chart-candle-up", success);

  const candleUpLine = readProperty(styles, "--chart-candle-up-line", success);

  const candleDown = readProperty(styles, "--chart-candle-down", danger);

  const candleDownLine = readProperty(
    styles,
    "--chart-candle-down-line",
    danger,
  );

  const surface = readProperty(styles, "--color-surface", "#ffffff");

  const tooltipBackground = readProperty(styles, "--chart-tooltip-bg", surface);

  const tooltipBorder = readProperty(styles, "--chart-tooltip-border", border);

  const focus = readProperty(styles, "--focus-ring", line);

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

    candleUp,
    candleUpLine,
    candleDown,
    candleDownLine,

    tooltipBackground,
    tooltipBorder,

    focus,
  };
}

/* ==========================================================================
   Color Helpers
   ========================================================================== */

/**
 * Returns a Highcharts-compatible color with the requested opacity.
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
 * Creates the vertical gradient used by Trend area charts.
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
   Series Theme
   ========================================================================== */

/**
 * Produces the presentational options for the active chart mode.
 */
export function getMarketChartSeriesTheme(Highcharts, theme, mode = "trend") {
  if (mode === "candlestick") {
    return {
      color: theme.candleDown,
      lineColor: theme.candleDownLine,

      upColor: theme.candleUp,
      upLineColor: theme.candleUpLine,
    };
  }

  if (mode === "line") {
    return {
      color: theme.line,
    };
  }

  return {
    color: theme.line,

    fillColor: createAreaFill(Highcharts, theme.line),
  };
}
