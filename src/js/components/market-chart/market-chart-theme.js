/* ==========================================================================
   Market Chart Theme
   ========================================================================== */

const MARKET_CHART_MODES = new Set(["trend", "line", "candlestick"]);

const MARKET_DIRECTIONS = new Set(["up", "down", "neutral"]);

const DEFAULT_THEME = Object.freeze({
  background: "transparent",

  text: "#001f33",
  heading: "#001f33",
  muted: "#64707a",

  border: "#d7dde3",
  borderStrong: "#9ca8b3",
  grid: "#d7dde3",
  crosshair: "#9ca8b3",

  line: "#0044e3",
  success: "#15803d",
  danger: "#dc2626",
  warning: "#f59e0b",
  neutral: "#0044e3",

  candleUp: "#15803d",
  candleUpLine: "#15803d",
  candleDown: "#dc2626",
  candleDownLine: "#dc2626",

  surface: "#ffffff",
  tooltipBackground: "#ffffff",
  tooltipBorder: "#9ca8b3",

  focus: "#0044e3",

  areaStartOpacity: 0.2,
  areaEndOpacity: 0,

  navigatorLineOpacity: 0.72,
  navigatorFillStartOpacity: 0.1,
  navigatorFillEndOpacity: 0.015,
  navigatorMaskOpacity: 0.06,
  navigatorOutlineOpacity: 0.22,
  navigatorHandleBorderOpacity: 0.52,
  navigatorHandleBackground: "#ffffff",
});

/* ==========================================================================
   General Helpers
   ========================================================================== */

function clamp(value, minimum, maximum, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, number));
}

function clampOpacity(value, fallback = 1) {
  return clamp(value, 0, 1, fallback);
}

function isElement(value) {
  return Boolean(value && value.nodeType === 1 && value.ownerDocument);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function readProperty(styles, property, fallback) {
  const value = normalizeString(styles.getPropertyValue(property));

  return value || fallback;
}

function readPropertyChain(styles, properties, fallback) {
  for (const property of properties) {
    const value = normalizeString(styles.getPropertyValue(property));

    if (value) {
      return value;
    }
  }

  return fallback;
}

function readOpacity(styles, property, fallback) {
  const value = Number.parseFloat(styles.getPropertyValue(property));

  return clampOpacity(value, fallback);
}

function normalizeMode(mode) {
  const normalized = normalizeString(mode).toLowerCase();

  return MARKET_CHART_MODES.has(normalized) ? normalized : "trend";
}

function normalizeDirection(direction) {
  const normalized = normalizeString(direction).toLowerCase();

  return MARKET_DIRECTIONS.has(normalized) ? normalized : "neutral";
}

function getComputedStyles(element) {
  const browserWindow = element.ownerDocument?.defaultView || globalThis.window;

  if (!browserWindow || typeof browserWindow.getComputedStyle !== "function") {
    throw new Error(
      "Market chart theme requires a browser with getComputedStyle().",
    );
  }

  return browserWindow.getComputedStyle(element);
}

/* ==========================================================================
   Theme Reader
   ========================================================================== */

export function getMarketChartTheme(element) {
  if (!isElement(element)) {
    throw new TypeError(
      "getMarketChartTheme() requires a valid chart element.",
    );
  }

  const styles = getComputedStyles(element);

  const background = readProperty(
    styles,
    "--chart-bg",
    DEFAULT_THEME.background,
  );

  const text = readPropertyChain(
    styles,
    ["--chart-text", "--color-text"],
    DEFAULT_THEME.text,
  );

  const heading = readPropertyChain(
    styles,
    ["--chart-heading", "--color-heading"],
    text || DEFAULT_THEME.heading,
  );

  const muted = readPropertyChain(
    styles,
    ["--chart-muted", "--color-text-muted"],
    DEFAULT_THEME.muted,
  );

  const border = readPropertyChain(
    styles,
    ["--chart-border", "--color-border"],
    DEFAULT_THEME.border,
  );

  const borderStrong = readPropertyChain(
    styles,
    ["--chart-border-strong", "--color-border-strong"],
    border || DEFAULT_THEME.borderStrong,
  );

  const grid = readProperty(
    styles,
    "--chart-grid",
    border || DEFAULT_THEME.grid,
  );

  const crosshair = readProperty(
    styles,
    "--chart-crosshair",
    borderStrong || DEFAULT_THEME.crosshair,
  );

  const line = readPropertyChain(
    styles,
    ["--chart-line", "--color-primary"],
    DEFAULT_THEME.line,
  );

  const success = readPropertyChain(
    styles,
    ["--chart-success", "--color-success"],
    DEFAULT_THEME.success,
  );

  const danger = readPropertyChain(
    styles,
    ["--chart-danger", "--color-danger"],
    DEFAULT_THEME.danger,
  );

  const warning = readPropertyChain(
    styles,
    ["--chart-warning", "--color-warning"],
    DEFAULT_THEME.warning,
  );

  const neutral = readProperty(
    styles,
    "--chart-neutral",
    line || DEFAULT_THEME.neutral,
  );

  const surface = readProperty(
    styles,
    "--color-surface",
    DEFAULT_THEME.surface,
  );

  const tooltipBackground = readProperty(
    styles,
    "--chart-tooltip-bg",
    surface || DEFAULT_THEME.tooltipBackground,
  );

  const tooltipBorder = readProperty(
    styles,
    "--chart-tooltip-border",
    borderStrong || DEFAULT_THEME.tooltipBorder,
  );

  const theme = {
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

    candleUp: readProperty(
      styles,
      "--chart-candle-up",
      success || DEFAULT_THEME.candleUp,
    ),

    candleUpLine: readProperty(
      styles,
      "--chart-candle-up-line",
      success || DEFAULT_THEME.candleUpLine,
    ),

    candleDown: readProperty(
      styles,
      "--chart-candle-down",
      danger || DEFAULT_THEME.candleDown,
    ),

    candleDownLine: readProperty(
      styles,
      "--chart-candle-down-line",
      danger || DEFAULT_THEME.candleDownLine,
    ),

    surface,
    tooltipBackground,
    tooltipBorder,

    focus: readPropertyChain(
      styles,
      ["--chart-focus", "--focus-ring"],
      line || DEFAULT_THEME.focus,
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

    navigatorOutlineOpacity: readOpacity(
      styles,
      "--chart-navigator-outline-opacity",
      DEFAULT_THEME.navigatorOutlineOpacity,
    ),

    navigatorHandleBorderOpacity: readOpacity(
      styles,
      "--chart-navigator-handle-border-opacity",
      DEFAULT_THEME.navigatorHandleBorderOpacity,
    ),

    navigatorHandleBackground: readProperty(
      styles,
      "--chart-navigator-handle-bg",
      tooltipBackground || DEFAULT_THEME.navigatorHandleBackground,
    ),
  };

  return Object.freeze(theme);
}
/* ==========================================================================
   Color Helpers
   ========================================================================== */

export function createColorWithOpacity(Highcharts, color, opacity = 1) {
  const normalizedColor = normalizeString(color) || DEFAULT_THEME.line;

  if (!Highcharts || typeof Highcharts.color !== "function") {
    return normalizedColor;
  }

  const safeOpacity = clampOpacity(opacity, 1);

  try {
    const parsedColor = Highcharts.color(normalizedColor);

    if (
      !parsedColor ||
      typeof parsedColor.setOpacity !== "function" ||
      typeof parsedColor.get !== "function"
    ) {
      return normalizedColor;
    }

    return parsedColor.setOpacity(safeOpacity).get("rgba");
  } catch {
    return normalizedColor;
  }
}

/* ==========================================================================
   Area Fill
   ========================================================================== */

export function createAreaFill(
  Highcharts,
  color,
  startOpacity = DEFAULT_THEME.areaStartOpacity,
  endOpacity = DEFAULT_THEME.areaEndOpacity,
) {
  const normalizedColor = normalizeString(color) || DEFAULT_THEME.line;

  return {
    linearGradient: {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 1,
    },

    stops: [
      [
        0,
        createColorWithOpacity(
          Highcharts,
          normalizedColor,
          clampOpacity(startOpacity, DEFAULT_THEME.areaStartOpacity),
        ),
      ],
      [
        1,
        createColorWithOpacity(
          Highcharts,
          normalizedColor,
          clampOpacity(endOpacity, DEFAULT_THEME.areaEndOpacity),
        ),
      ],
    ],
  };
}

/* ==========================================================================
   Direction Colors
   ========================================================================== */

export function getMarketChartDirectionColor(theme, direction = "neutral") {
  const normalizedDirection = normalizeDirection(direction);

  if (!theme) {
    switch (normalizedDirection) {
      case "up":
        return DEFAULT_THEME.success;

      case "down":
        return DEFAULT_THEME.danger;

      default:
        return DEFAULT_THEME.neutral;
    }
  }

  switch (normalizedDirection) {
    case "up":
      return theme.success || theme.line || DEFAULT_THEME.success;

    case "down":
      return theme.danger || theme.line || DEFAULT_THEME.danger;

    default:
      return theme.neutral || theme.line || DEFAULT_THEME.neutral;
  }
}

/* ==========================================================================
   Marker Options
   ========================================================================== */

function createMarkerOptions(color) {
  return {
    enabled: false,

    radius: 0,
    lineWidth: 0,

    fillColor: color,
    lineColor: color,

    states: {
      hover: {
        enabled: true,

        radius: 3.5,
        radiusPlus: 0,

        lineWidth: 2,
        lineWidthPlus: 0,

        fillColor: color,
        lineColor: color,
      },

      select: {
        enabled: false,

        radius: 0,
        radiusPlus: 0,

        lineWidth: 0,
        lineWidthPlus: 0,
      },
    },
  };
}

/* ==========================================================================
   Series States
   ========================================================================== */

function createLineStates(lineWidth) {
  return {
    hover: {
      enabled: true,

      halo: {
        size: 0,
      },

      lineWidth,
      lineWidthPlus: 0,
    },

    inactive: {
      enabled: false,
      opacity: 1,
    },

    select: {
      enabled: false,

      lineWidth,
      lineWidthPlus: 0,
    },
  };
}

function createCandlestickStates() {
  return {
    hover: {
      enabled: true,
      lineWidth: 2,
    },

    inactive: {
      enabled: false,
      opacity: 1,
    },

    select: {
      enabled: false,
      lineWidth: 1,
    },
  };
}

/* ==========================================================================
   Main Series Theme
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
    const candleDown =
      theme.candleDown || theme.danger || DEFAULT_THEME.candleDown;

    const candleDownLine =
      theme.candleDownLine || candleDown || DEFAULT_THEME.candleDownLine;

    const candleUp = theme.candleUp || theme.success || DEFAULT_THEME.candleUp;

    const candleUpLine =
      theme.candleUpLine || candleUp || DEFAULT_THEME.candleUpLine;

    return {
      color: candleDown,
      lineColor: candleDownLine,

      upColor: candleUp,
      upLineColor: candleUpLine,

      lineWidth: 1,

      states: createCandlestickStates(),
    };
  }

  const seriesColor = getMarketChartDirectionColor(theme, direction);

  const lineWidth = 2;

  const commonTheme = {
    color: seriesColor,
    lineColor: seriesColor,

    lineWidth,

    marker: createMarkerOptions(seriesColor),

    states: createLineStates(lineWidth),
  };

  if (normalizedMode === "line") {
    return commonTheme;
  }

  return {
    ...commonTheme,

    fillColor: createAreaFill(
      Highcharts,
      seriesColor,
      theme.areaStartOpacity ?? DEFAULT_THEME.areaStartOpacity,
      theme.areaEndOpacity ?? DEFAULT_THEME.areaEndOpacity,
    ),

    threshold: null,
  };
}
/* ==========================================================================
   Navigator Helpers
   ========================================================================== */

function readNavigatorOpacity(value, themeValue, defaultValue) {
  return clampOpacity(value, clampOpacity(themeValue, defaultValue));
}

function readNavigatorLineWidth(value, fallback = 1.25) {
  return clamp(value, 0, 10, fallback);
}

/* ==========================================================================
   Navigator Theme
   ========================================================================== */

export function getMarketChartNavigatorTheme(
  Highcharts,
  theme,
  direction = "neutral",
  options = {},
) {
  if (!theme) {
    throw new TypeError(
      "getMarketChartNavigatorTheme() requires a chart theme.",
    );
  }

  const safeOptions =
    options && typeof options === "object" && !Array.isArray(options)
      ? options
      : {};

  const directionColor = getMarketChartDirectionColor(theme, direction);

  const lineOpacity = readNavigatorOpacity(
    safeOptions.lineOpacity,
    theme.navigatorLineOpacity,
    DEFAULT_THEME.navigatorLineOpacity,
  );

  const fillStartOpacity = readNavigatorOpacity(
    safeOptions.fillStartOpacity,
    theme.navigatorFillStartOpacity,
    DEFAULT_THEME.navigatorFillStartOpacity,
  );

  const fillEndOpacity = readNavigatorOpacity(
    safeOptions.fillEndOpacity,
    theme.navigatorFillEndOpacity,
    DEFAULT_THEME.navigatorFillEndOpacity,
  );

  const maskOpacity = readNavigatorOpacity(
    safeOptions.maskOpacity,
    theme.navigatorMaskOpacity,
    DEFAULT_THEME.navigatorMaskOpacity,
  );

  const outlineOpacity = readNavigatorOpacity(
    safeOptions.outlineOpacity,
    theme.navigatorOutlineOpacity,
    DEFAULT_THEME.navigatorOutlineOpacity,
  );

  const handleBorderOpacity = readNavigatorOpacity(
    safeOptions.handleBorderOpacity,
    theme.navigatorHandleBorderOpacity,
    DEFAULT_THEME.navigatorHandleBorderOpacity,
  );

  const lineWidth = readNavigatorLineWidth(safeOptions.lineWidth, 1.25);

  const lineColor = createColorWithOpacity(
    Highcharts,
    directionColor,
    lineOpacity,
  );

  const handleBackground =
    normalizeString(safeOptions.handleBackground) ||
    theme.navigatorHandleBackground ||
    theme.tooltipBackground ||
    theme.surface ||
    DEFAULT_THEME.navigatorHandleBackground;

  const handleBorderColor = createColorWithOpacity(
    Highcharts,
    directionColor,
    handleBorderOpacity,
  );

  return {
    /*
     * Supplying both color and lineColor prevents Highcharts from
     * restoring the full-strength main-series color internally.
     */
    color: lineColor,
    lineColor,

    lineWidth,

    fillColor: createAreaFill(
      Highcharts,
      directionColor,
      fillStartOpacity,
      fillEndOpacity,
    ),

    maskFill: createColorWithOpacity(Highcharts, directionColor, maskOpacity),

    outlineColor: createColorWithOpacity(
      Highcharts,
      directionColor,
      outlineOpacity,
    ),

    handles: {
      backgroundColor: handleBackground,
      borderColor: handleBorderColor,
    },
  };
}
