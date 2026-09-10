/* ==========================================================================
   Market Chart Theme
   ========================================================================== */

/**
 * Visual bridge between the application's CSS design tokens and Highcharts.
 *
 * CSS remains the source of truth for theme values. This module only resolves
 * those values into the small shape required by market-chart-options.js.
 *
 * Responsibilities:
 * - read chart design tokens from the rendered chart element;
 * - provide safe theme fallbacks when a token is missing;
 * - resolve directional colors (up / down / neutral);
 * - create main-series and navigator presentation options;
 * - build Highcharts-compatible alpha colors and gradients.
 *
 * This module deliberately does not own layout, data, ranges, polling,
 * navigator behavior, or viewport state.
 */

/* ==========================================================================
   Defaults
   ========================================================================== */

const DEFAULT_THEME = Object.freeze({
  background: "#ffffff",

  text: "#1f2933",
  muted: "#667085",

  border: "#d0d5dd",
  grid: "#eaecf0",
  crosshair: "#98a2b3",

  positive: "#16865c",
  negative: "#c53b3b",
  neutral: "#667085",

  tooltipBackground: "#ffffff",
  tooltipBorder: "#d0d5dd",

  navigatorMask: "rgba(102, 112, 133, 0.12)",
  navigatorHandleBackground: "#ffffff",
  navigatorHandleBorder: "#98a2b3",

  lineWidth: 2,
  navigatorLineWidth: 1.5,

  areaStartOpacity: 0.24,
  areaEndOpacity: 0.02,

  navigatorAreaStartOpacity: 0.18,
  navigatorAreaEndOpacity: 0.02,

  candleFillOpacity: 0.9,
});

/* ==========================================================================
   Generic Helpers
   ========================================================================== */

function isElement(value) {
  return Boolean(value && value.nodeType === 1 && value.ownerDocument);
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeCSSValue(value) {
  const resolved = String(value ?? "").trim();

  return resolved || null;
}

function readCSSVariable(styles, name, fallback) {
  if (!styles || typeof styles.getPropertyValue !== "function") {
    return fallback;
  }

  return normalizeCSSValue(styles.getPropertyValue(name)) ?? fallback;
}

function readCSSVariableAny(styles, names, fallback) {
  for (const name of names) {
    const value = readCSSVariable(styles, name, null);

    if (value !== null) {
      return value;
    }
  }

  return fallback;
}

function readCSSNumber(
  styles,
  names,
  fallback,
  { minimum = null, maximum = null } = {},
) {
  const raw = readCSSVariableAny(styles, names, null);

  if (raw === null) {
    return fallback;
  }

  let value = toFiniteNumber(String(raw).replace(/px$/i, "").trim(), fallback);

  if (minimum !== null) {
    value = Math.max(minimum, value);
  }

  if (maximum !== null) {
    value = Math.min(maximum, value);
  }

  return value;
}

function getComputedStyles(element) {
  if (!isElement(element)) {
    return null;
  }

  const window = element.ownerDocument?.defaultView;

  if (typeof window?.getComputedStyle !== "function") {
    return null;
  }

  try {
    return window.getComputedStyle(element);
  } catch {
    return null;
  }
}

/* ==========================================================================
   Direction
   ========================================================================== */

function normalizeDirection(direction) {
  const value = String(direction ?? "neutral")
    .trim()
    .toLowerCase();

  if (value === "up" || value === "positive" || value === "gain") {
    return "up";
  }

  if (value === "down" || value === "negative" || value === "loss") {
    return "down";
  }

  return "neutral";
}

function resolveDirectionColor(theme, direction) {
  const normalizedDirection = normalizeDirection(direction);

  if (normalizedDirection === "up") {
    return theme.positive;
  }

  if (normalizedDirection === "down") {
    return theme.negative;
  }

  return theme.neutral;
}

/* ==========================================================================
   Color Helpers
   ========================================================================== */

function parseHexColor(color) {
  const value = String(color ?? "").trim();

  const short = /^#([0-9a-f]{3})$/i.exec(value);

  if (short) {
    const [r, g, b] = short[1]
      .split("")
      .map((component) => Number.parseInt(component + component, 16));

    return {
      r,
      g,
      b,
    };
  }

  const full = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(value);

  if (!full) {
    return null;
  }

  return {
    r: Number.parseInt(full[1].slice(0, 2), 16),

    g: Number.parseInt(full[1].slice(2, 4), 16),

    b: Number.parseInt(full[1].slice(4, 6), 16),
  };
}

function parseRGBColor(color) {
  const match =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+\s*)?\)$/i.exec(
      String(color ?? "").trim(),
    );

  if (!match) {
    return null;
  }

  return {
    r: clamp(Number(match[1]), 0, 255),

    g: clamp(Number(match[2]), 0, 255),

    b: clamp(Number(match[3]), 0, 255),
  };
}

function colorWithOpacity(Highcharts, color, opacity) {
  const alpha = clamp(toFiniteNumber(opacity, 1), 0, 1);

  /*
   * Prefer Highcharts' own color parser.
   *
   * This supports theme colors beyond
   * simple hex/rgb values.
   */
  if (typeof Highcharts?.color === "function") {
    try {
      return Highcharts.color(color).setOpacity(alpha).get();
    } catch {
      // Fall through.
    }
  }

  const parsed = parseHexColor(color) || parseRGBColor(color);

  if (!parsed) {
    return color;
  }

  return `rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)}, ${alpha})`;
}

function createVerticalGradient(Highcharts, color, startOpacity, endOpacity) {
  return {
    linearGradient: {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 1,
    },

    stops: [
      [0, colorWithOpacity(Highcharts, color, startOpacity)],

      [1, colorWithOpacity(Highcharts, color, endOpacity)],
    ],
  };
}

/* ==========================================================================
   Theme Resolution
   ========================================================================== */

export function getMarketChartTheme(element) {
  const styles = getComputedStyles(element);

  const background = readCSSVariableAny(
    styles,

    ["--chart-background", "--chart-bg"],

    DEFAULT_THEME.background,
  );

  const text = readCSSVariableAny(
    styles,

    ["--chart-text", "--chart-foreground"],

    DEFAULT_THEME.text,
  );

  const muted = readCSSVariableAny(
    styles,

    ["--chart-muted", "--chart-text-muted"],

    DEFAULT_THEME.muted,
  );

  const border = readCSSVariableAny(
    styles,

    ["--chart-border", "--chart-axis"],

    DEFAULT_THEME.border,
  );

  const grid = readCSSVariableAny(
    styles,

    ["--chart-grid", "--chart-grid-line"],

    DEFAULT_THEME.grid,
  );

  const positive = readCSSVariableAny(
    styles,

    ["--chart-positive", "--chart-up", "--chart-success"],

    DEFAULT_THEME.positive,
  );

  const negative = readCSSVariableAny(
    styles,

    ["--chart-negative", "--chart-down", "--chart-danger"],

    DEFAULT_THEME.negative,
  );

  const neutral = readCSSVariableAny(
    styles,

    ["--chart-neutral", "--chart-series"],

    DEFAULT_THEME.neutral,
  );

  return {
    background,
    text,
    muted,
    border,
    grid,

    /*
     * Dedicated crosshair fallback.
     *
     * Do not fall back to border here.
     */
    crosshair: readCSSVariableAny(
      styles,

      ["--chart-crosshair"],

      DEFAULT_THEME.crosshair,
    ),

    positive,
    negative,
    neutral,

    tooltipBackground: readCSSVariableAny(
      styles,

      ["--chart-tooltip-background", "--chart-tooltip-bg"],

      background || DEFAULT_THEME.tooltipBackground,
    ),

    tooltipBorder: readCSSVariableAny(
      styles,

      ["--chart-tooltip-border"],

      border || DEFAULT_THEME.tooltipBorder,
    ),

    navigatorMask: readCSSVariableAny(
      styles,

      ["--chart-navigator-mask", "--chart-navigator-mask-fill"],

      DEFAULT_THEME.navigatorMask,
    ),

    navigatorHandleBackground: readCSSVariableAny(
      styles,

      ["--chart-navigator-handle-background", "--chart-navigator-handle-bg"],

      background || DEFAULT_THEME.navigatorHandleBackground,
    ),

    navigatorHandleBorder: readCSSVariableAny(
      styles,

      ["--chart-navigator-handle-border"],

      border || DEFAULT_THEME.navigatorHandleBorder,
    ),

    lineWidth: readCSSNumber(
      styles,

      ["--chart-line-width"],

      DEFAULT_THEME.lineWidth,

      {
        minimum: 0,
        maximum: 8,
      },
    ),

    navigatorLineWidth: readCSSNumber(
      styles,

      ["--chart-navigator-line-width"],

      DEFAULT_THEME.navigatorLineWidth,

      {
        minimum: 0,
        maximum: 8,
      },
    ),

    areaStartOpacity: readCSSNumber(
      styles,

      ["--chart-area-start-opacity", "--chart-area-opacity"],

      DEFAULT_THEME.areaStartOpacity,

      {
        minimum: 0,
        maximum: 1,
      },
    ),

    areaEndOpacity: readCSSNumber(
      styles,

      ["--chart-area-end-opacity"],

      DEFAULT_THEME.areaEndOpacity,

      {
        minimum: 0,
        maximum: 1,
      },
    ),

    navigatorAreaStartOpacity: readCSSNumber(
      styles,

      [
        "--chart-navigator-area-start-opacity",
        "--chart-navigator-area-opacity",
      ],

      DEFAULT_THEME.navigatorAreaStartOpacity,

      {
        minimum: 0,
        maximum: 1,
      },
    ),

    navigatorAreaEndOpacity: readCSSNumber(
      styles,

      ["--chart-navigator-area-end-opacity"],

      DEFAULT_THEME.navigatorAreaEndOpacity,

      {
        minimum: 0,
        maximum: 1,
      },
    ),

    candleFillOpacity: readCSSNumber(
      styles,

      ["--chart-candle-fill-opacity"],

      DEFAULT_THEME.candleFillOpacity,

      {
        minimum: 0,
        maximum: 1,
      },
    ),
  };
}

/* ==========================================================================
   Series Theme
   ========================================================================== */

export function getMarketChartSeriesTheme(
  Highcharts,
  theme,
  mode = "trend",
  direction = "neutral",
) {
  const source = theme || DEFAULT_THEME;

  const normalizedMode = String(mode ?? "trend")
    .trim()
    .toLowerCase();

  const directionColor = resolveDirectionColor(source, direction);

  /* ------------------------------------------------------------------------
     Candlestick
     ------------------------------------------------------------------------ */

  if (normalizedMode === "candlestick") {
    const positive = source.positive || DEFAULT_THEME.positive;

    const negative = source.negative || DEFAULT_THEME.negative;

    const fillOpacity =
      source.candleFillOpacity ?? DEFAULT_THEME.candleFillOpacity;

    return {
      /*
       * Down candle.
       */
      color: colorWithOpacity(Highcharts, negative, fillOpacity),

      lineColor: negative,

      /*
       * Up candle.
       */
      upColor: colorWithOpacity(Highcharts, positive, fillOpacity),

      upLineColor: positive,

      lineWidth: 1,
    };
  }

  const lineWidth = toFiniteNumber(source.lineWidth, DEFAULT_THEME.lineWidth);

  /* ------------------------------------------------------------------------
     Line
     ------------------------------------------------------------------------ */

  if (normalizedMode === "line") {
    return {
      color: directionColor,

      lineColor: directionColor,

      lineWidth,
    };
  }

  /* ------------------------------------------------------------------------
     Trend / Area Spline
     ------------------------------------------------------------------------ */

  return {
    color: directionColor,

    lineColor: directionColor,

    lineWidth,

    fillColor: createVerticalGradient(
      Highcharts,

      directionColor,

      source.areaStartOpacity ?? DEFAULT_THEME.areaStartOpacity,

      source.areaEndOpacity ?? DEFAULT_THEME.areaEndOpacity,
    ),
  };
}

/* ==========================================================================
   Navigator Theme
   ========================================================================== */

export function getMarketChartNavigatorTheme(
  Highcharts,
  theme,
  direction = "neutral",
) {
  const source = theme || DEFAULT_THEME;

  const color = resolveDirectionColor(source, direction);

  return {
    color,

    lineColor: color,

    lineWidth: toFiniteNumber(
      source.navigatorLineWidth,

      DEFAULT_THEME.navigatorLineWidth,
    ),

    fillColor: createVerticalGradient(
      Highcharts,

      color,

      source.navigatorAreaStartOpacity ??
        DEFAULT_THEME.navigatorAreaStartOpacity,

      source.navigatorAreaEndOpacity ?? DEFAULT_THEME.navigatorAreaEndOpacity,
    ),

    maskFill: source.navigatorMask || DEFAULT_THEME.navigatorMask,

    handles: {
      backgroundColor:
        source.navigatorHandleBackground ||
        DEFAULT_THEME.navigatorHandleBackground,

      borderColor:
        source.navigatorHandleBorder || DEFAULT_THEME.navigatorHandleBorder,
    },
  };
}

/* ==========================================================================
   Public Constants
   ========================================================================== */

export { DEFAULT_THEME };
