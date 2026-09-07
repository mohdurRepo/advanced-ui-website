/* ==========================================================================
   Market Chart Theme
   ========================================================================== */

/*
 * Small bridge between our CSS design tokens and Highcharts.
 *
 * CSS owns the theme.
 * Highcharts receives only the values it needs.
 */

/* ==========================================================================
   Defaults
   ========================================================================== */

const DEFAULT_THEME = Object.freeze({
  background: "transparent",

  text: "#001f33",
  muted: "#64707a",

  border: "#d7dde3",
  grid: "#d7dde3",
  crosshair: "#9ca8b3",

  line: "#0044e3",

  success: "#15803d",
  danger: "#dc2626",
  neutral: "#0044e3",

  candleUp: "#15803d",
  candleUpLine: "#15803d",

  candleDown: "#dc2626",
  candleDownLine: "#dc2626",

  tooltipBackground: "#ffffff",
  tooltipBorder: "#9ca8b3",

  areaStartOpacity: 0.2,
  areaEndOpacity: 0,

  navigatorLineOpacity: 0.72,
  navigatorFillStartOpacity: 0.1,
  navigatorFillEndOpacity: 0.015,
  navigatorMaskOpacity: 0.06,
  navigatorHandleBorderOpacity: 0.52,

  navigatorHandleBackground: "#ffffff",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function isElement(value) {
  return Boolean(value && value.nodeType === 1 && value.ownerDocument);
}

function readCSSVariable(styles, names, fallback) {
  const variables = Array.isArray(names) ? names : [names];

  for (const name of variables) {
    const value = styles.getPropertyValue(name).trim();

    if (value) {
      return value;
    }
  }

  return fallback;
}

function readOpacity(styles, name, fallback) {
  const value = Number.parseFloat(styles.getPropertyValue(name));

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, value));
}

function normalizeMode(mode) {
  switch (
    String(mode ?? "")
      .trim()
      .toLowerCase()
  ) {
    case "line":
      return "line";

    case "candlestick":
      return "candlestick";

    default:
      return "trend";
  }
}

function normalizeDirection(direction) {
  switch (
    String(direction ?? "")
      .trim()
      .toLowerCase()
  ) {
    case "up":
      return "up";

    case "down":
      return "down";

    default:
      return "neutral";
  }
}

/* ==========================================================================
   Theme
   ========================================================================== */

export function getMarketChartTheme(element) {
  if (!isElement(element)) {
    throw new TypeError(
      "getMarketChartTheme() requires a valid chart element.",
    );
  }

  const view = element.ownerDocument?.defaultView;

  if (!view || typeof view.getComputedStyle !== "function") {
    throw new Error("Market chart theme requires getComputedStyle().");
  }

  const styles = view.getComputedStyle(element);

  const text = readCSSVariable(
    styles,
    ["--chart-text", "--color-text"],
    DEFAULT_THEME.text,
  );

  const border = readCSSVariable(
    styles,
    ["--chart-border", "--color-border"],
    DEFAULT_THEME.border,
  );

  const line = readCSSVariable(
    styles,
    ["--chart-line", "--color-primary"],
    DEFAULT_THEME.line,
  );

  const success = readCSSVariable(
    styles,
    ["--chart-success", "--color-success"],
    DEFAULT_THEME.success,
  );

  const danger = readCSSVariable(
    styles,
    ["--chart-danger", "--color-danger"],
    DEFAULT_THEME.danger,
  );

  const neutral = readCSSVariable(styles, "--chart-neutral", line);

  const tooltipBackground = readCSSVariable(
    styles,
    ["--chart-tooltip-bg", "--color-surface"],
    DEFAULT_THEME.tooltipBackground,
  );

  return Object.freeze({
    background: readCSSVariable(styles, "--chart-bg", DEFAULT_THEME.background),

    text,

    muted: readCSSVariable(
      styles,
      ["--chart-muted", "--color-text-muted"],
      DEFAULT_THEME.muted,
    ),

    border,

    grid: readCSSVariable(styles, "--chart-grid", border),

    crosshair: readCSSVariable(styles, "--chart-crosshair", border),

    line,

    success,
    danger,
    neutral,

    candleUp: readCSSVariable(styles, "--chart-candle-up", success),

    candleUpLine: readCSSVariable(styles, "--chart-candle-up-line", success),

    candleDown: readCSSVariable(styles, "--chart-candle-down", danger),

    candleDownLine: readCSSVariable(styles, "--chart-candle-down-line", danger),

    tooltipBackground,

    tooltipBorder: readCSSVariable(
      styles,
      [
        "--chart-tooltip-border",
        "--chart-border-strong",
        "--color-border-strong",
      ],
      DEFAULT_THEME.tooltipBorder,
    ),

    areaStartOpacity: readOpacity(
      styles,
      "--chart-area-start-opacity",
      DEFAULT_THEME.areaStartOpacity,
    ),

    areaEndOpacity: readOpacity(
      styles,
      "--chart-area-end-opacity",
      DEFAULT_THEME.areaEndOpacity,
    ),

    navigatorLineOpacity: readOpacity(
      styles,
      "--chart-navigator-line-opacity",
      DEFAULT_THEME.navigatorLineOpacity,
    ),

    navigatorFillStartOpacity: readOpacity(
      styles,
      "--chart-navigator-fill-start-opacity",
      DEFAULT_THEME.navigatorFillStartOpacity,
    ),

    navigatorFillEndOpacity: readOpacity(
      styles,
      "--chart-navigator-fill-end-opacity",
      DEFAULT_THEME.navigatorFillEndOpacity,
    ),

    navigatorMaskOpacity: readOpacity(
      styles,
      "--chart-navigator-mask-opacity",
      DEFAULT_THEME.navigatorMaskOpacity,
    ),

    navigatorHandleBorderOpacity: readOpacity(
      styles,
      "--chart-navigator-handle-border-opacity",
      DEFAULT_THEME.navigatorHandleBorderOpacity,
    ),

    navigatorHandleBackground: readCSSVariable(
      styles,
      "--chart-navigator-handle-bg",
      tooltipBackground,
    ),
  });
}

/* ==========================================================================
   Color
   ========================================================================== */

function withOpacity(Highcharts, color, opacity) {
  if (!Highcharts || typeof Highcharts.color !== "function") {
    return color;
  }

  try {
    return Highcharts.color(color).setOpacity(opacity).get();
  } catch {
    return color;
  }
}

function createGradient(Highcharts, color, startOpacity, endOpacity) {
  return {
    linearGradient: {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 1,
    },

    stops: [
      [0, withOpacity(Highcharts, color, startOpacity)],

      [1, withOpacity(Highcharts, color, endOpacity)],
    ],
  };
}

/* ==========================================================================
   Direction
   ========================================================================== */

function getDirectionColor(theme, direction) {
  switch (normalizeDirection(direction)) {
    case "up":
      return theme.success;

    case "down":
      return theme.danger;

    default:
      return theme.neutral || theme.line;
  }
}

/* ==========================================================================
   Main Series
   ========================================================================== */

export function getMarketChartSeriesTheme(
  Highcharts,
  theme,
  mode = "trend",
  direction = "neutral",
) {
  if (!theme) {
    throw new TypeError("getMarketChartSeriesTheme() requires a chart theme.");
  }

  const normalizedMode = normalizeMode(mode);

  if (normalizedMode === "candlestick") {
    return {
      color: theme.candleDown,

      lineColor: theme.candleDownLine,

      upColor: theme.candleUp,

      upLineColor: theme.candleUpLine,

      lineWidth: 1,

      states: {
        inactive: {
          opacity: 1,
        },
      },
    };
  }

  const color = getDirectionColor(theme, direction);

  const options = {
    color,

    lineColor: color,

    lineWidth: 2,

    marker: {
      enabled: false,
    },

    states: {
      hover: {
        lineWidthPlus: 0,
      },

      inactive: {
        opacity: 1,
      },
    },
  };

  if (normalizedMode === "line") {
    return options;
  }

  return {
    ...options,

    threshold: null,

    fillColor: createGradient(
      Highcharts,
      color,
      theme.areaStartOpacity,
      theme.areaEndOpacity,
    ),
  };
}

/* ==========================================================================
   Navigator
   ========================================================================== */

export function getMarketChartNavigatorTheme(
  Highcharts,
  theme,
  direction = "neutral",
) {
  if (!theme) {
    throw new TypeError(
      "getMarketChartNavigatorTheme() requires a chart theme.",
    );
  }

  const color = getDirectionColor(theme, direction);

  const lineColor = withOpacity(Highcharts, color, theme.navigatorLineOpacity);

  return {
    color: lineColor,

    lineColor,

    lineWidth: 1.25,

    fillColor: createGradient(
      Highcharts,
      color,
      theme.navigatorFillStartOpacity,
      theme.navigatorFillEndOpacity,
    ),

    maskFill: withOpacity(Highcharts, color, theme.navigatorMaskOpacity),

    handles: {
      backgroundColor: theme.navigatorHandleBackground,

      borderColor: withOpacity(
        Highcharts,
        color,
        theme.navigatorHandleBorderOpacity,
      ),
    },
  };
}
