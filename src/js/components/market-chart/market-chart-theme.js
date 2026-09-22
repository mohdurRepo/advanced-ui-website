/* ==========================================================================
   Market Chart Theme
   ==========================================================================
   Bridges Market Chart design-system CSS custom properties into the plain
   values required by Highcharts.

   Ownership rules:

   1. JavaScript owns semantic market direction:
        "up" | "down" | "neutral"

   2. CSS owns the actual design-system colors:
        --chart-success
        --chart-danger
        --chart-neutral

   3. The same resolved semantic direction color is used by:
        - trend / area series
        - line series
        - navigator data series

   4. Navigator chrome remains neutral:
        - mask
        - outline
        - handles

      Only navigator data presentation follows market direction:
        - line
        - fill

   5. Candlestick colors are literal design-system tokens and do not depend
      on the overall chart direction.

   `--chart-line` / `--chart-direction-color` are retained as compatibility
   values in the returned theme object, but they are NOT authoritative for
   direction resolution. This prevents computed CSS state from becoming
   stale relative to controller state during live updates.

   Several navigator values are opacity fractions rather than literal colors.
   This module combines those opacity values with the appropriate base color.

   `color-mix()` note:
   Some CSS custom properties can be returned by getComputedStyle() as a
   modern CSS color expression rather than a legacy rgb()/hex value.
   colorWithOpacity() therefore attempts Highcharts parsing first, falls back
   to simple hex/rgb parsing, and finally passes an unsupported CSS color
   expression through unchanged rather than producing an invalid color.
   ========================================================================== */

/* ==========================================================================
   Defaults
   ========================================================================== */

const DEFAULT_THEME = Object.freeze({
  background: "#ffffff",

  text: "#1f2933",
  heading: "#101828",
  muted: "#667085",

  border: "#d0d5dd",
  borderStrong: "#98a2b3",
  grid: "#eaecf0",
  crosshair: "#98a2b3",

  success: "#16865c",
  danger: "#c53b3b",
  warning: "#b54708",
  neutral: "#667085",

  /*
   * Compatibility token only.
   *
   * Direction selection does not use this value as the source of truth.
   * It remains exposed because older consumers may still inspect it.
   */
  line: null,

  candleUp: null,
  candleUpLine: null,
  candleDown: null,
  candleDownLine: null,

  tooltipBackground: "#ffffff",
  tooltipBorder: "#d0d5dd",

  focus: "#2563eb",

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

/**
 * Converts supported direction aliases into the controller's canonical
 * semantic direction.
 *
 * @param {*} direction
 * @returns {"up"|"down"|"neutral"}
 */
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

/**
 * Resolves the actual series color for a semantic market direction.
 *
 * Direction is intentionally authoritative here. We do NOT first read the
 * computed `--chart-line` value because that makes Highcharts presentation
 * dependent on DOM/CSS synchronization timing.
 *
 * CSS still owns the design-system color values themselves through:
 *
 *   --chart-success
 *   --chart-danger
 *   --chart-neutral
 *
 * `theme.line` is retained only as a compatibility fallback for callers that
 * provide a custom theme object without the semantic colors.
 *
 * @param {object} theme
 * @param {*} direction
 * @returns {string}
 */
function resolveDirectionColor(theme, direction) {
  const source = theme || DEFAULT_THEME;
  const normalizedDirection = normalizeDirection(direction);

  switch (normalizedDirection) {
    case "up":
      return source.success || source.line || DEFAULT_THEME.success;

    case "down":
      return source.danger || source.line || DEFAULT_THEME.danger;

    default:
      return source.neutral || source.line || DEFAULT_THEME.neutral;
  }
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

    return { r, g, b };
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

function hasFiniteRGB(value) {
  return Boolean(
    Array.isArray(value) &&
    value.length >= 3 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1])) &&
    Number.isFinite(Number(value[2])),
  );
}

/**
 * Applies an opacity multiplier to a color.
 *
 * Highcharts is allowed to parse modern color formats first. If that is not
 * possible, basic hex/rgb colors are handled manually. Unsupported modern CSS
 * expressions are returned unchanged rather than converted to an incorrect
 * fallback color.
 */
function colorWithOpacity(Highcharts, color, opacity) {
  const resolvedColor = normalizeCSSValue(color) || DEFAULT_THEME.neutral;

  const alpha = clamp(toFiniteNumber(opacity, 1), 0, 1);

  if (typeof Highcharts?.color === "function") {
    try {
      const parsed = Highcharts.color(resolvedColor);

      if (
        parsed &&
        typeof parsed.setOpacity === "function" &&
        typeof parsed.get === "function" &&
        (hasFiniteRGB(parsed.rgba) || parsed.input === resolvedColor)
      ) {
        const result = parsed.setOpacity(alpha).get();

        if (normalizeCSSValue(result)) {
          return result;
        }
      }
    } catch {
      /*
       * Fall through to the lightweight parser.
       */
    }
  }

  const parsed = parseHexColor(resolvedColor) || parseRGBColor(resolvedColor);

  if (!parsed) {
    /*
     * Examples:
     *   color-mix(...)
     *   oklch(...)
     *   var(...)
     *
     * Keep the original CSS-compatible value. We lose only the additional
     * opacity multiplication rather than returning a broken color.
     */
    return resolvedColor;
  }

  return `rgba(${Math.round(parsed.r)}, ${Math.round(
    parsed.g,
  )}, ${Math.round(parsed.b)}, ${alpha})`;
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

/**
 * Reads all Market Chart design-system values from the chart host.
 *
 * The returned object deliberately contains only plain values suitable for
 * passing into Highcharts configuration.
 */
export function getMarketChartTheme(element) {
  const styles = getComputedStyles(element);

  const background = readCSSVariableAny(
    styles,
    ["--chart-bg", "--chart-background"],
    DEFAULT_THEME.background,
  );

  const text = readCSSVariableAny(styles, ["--chart-text"], DEFAULT_THEME.text);

  const heading = readCSSVariableAny(
    styles,
    ["--chart-heading"],
    text || DEFAULT_THEME.heading,
  );

  const muted = readCSSVariableAny(
    styles,
    ["--chart-muted"],
    DEFAULT_THEME.muted,
  );

  const border = readCSSVariableAny(
    styles,
    ["--chart-border"],
    DEFAULT_THEME.border,
  );

  const borderStrong = readCSSVariableAny(
    styles,
    ["--chart-border-strong"],
    border || DEFAULT_THEME.borderStrong,
  );

  const grid = readCSSVariableAny(styles, ["--chart-grid"], DEFAULT_THEME.grid);

  const success = readCSSVariableAny(
    styles,
    ["--chart-success", "--chart-positive"],
    DEFAULT_THEME.success,
  );

  const danger = readCSSVariableAny(
    styles,
    ["--chart-danger", "--chart-negative"],
    DEFAULT_THEME.danger,
  );

  const warning = readCSSVariableAny(
    styles,
    ["--chart-warning"],
    DEFAULT_THEME.warning,
  );

  const neutral = readCSSVariableAny(
    styles,
    ["--chart-neutral"],
    DEFAULT_THEME.neutral,
  );

  return {
    background,

    text,
    heading,
    muted,

    border,
    borderStrong,
    grid,

    crosshair: readCSSVariableAny(
      styles,
      ["--chart-crosshair"],
      DEFAULT_THEME.crosshair,
    ),

    success,
    danger,
    warning,
    neutral,

    /*
     * Compatibility / inspection value.
     *
     * The controller's explicit direction remains authoritative when series
     * and navigator colors are resolved.
     */
    line: readCSSVariableAny(
      styles,
      ["--chart-line", "--chart-direction-color"],
      DEFAULT_THEME.line,
    ),

    /* ----------------------------------------------------------------------
       Candlestick
       ---------------------------------------------------------------------- */

    candleUp: readCSSVariableAny(
      styles,
      ["--chart-candle-up"],
      DEFAULT_THEME.candleUp,
    ),

    candleUpLine: readCSSVariableAny(
      styles,
      ["--chart-candle-up-line"],
      DEFAULT_THEME.candleUpLine,
    ),

    candleDown: readCSSVariableAny(
      styles,
      ["--chart-candle-down"],
      DEFAULT_THEME.candleDown,
    ),

    candleDownLine: readCSSVariableAny(
      styles,
      ["--chart-candle-down-line"],
      DEFAULT_THEME.candleDownLine,
    ),

    /* ----------------------------------------------------------------------
       Tooltip
       ---------------------------------------------------------------------- */

    tooltipBackground: readCSSVariableAny(
      styles,
      ["--chart-tooltip-bg", "--chart-tooltip-background"],
      background || DEFAULT_THEME.tooltipBackground,
    ),

    tooltipBorder: readCSSVariableAny(
      styles,
      ["--chart-tooltip-border"],
      border || DEFAULT_THEME.tooltipBorder,
    ),

    focus: readCSSVariableAny(styles, ["--chart-focus"], DEFAULT_THEME.focus),

    /* ----------------------------------------------------------------------
       Area
       ---------------------------------------------------------------------- */

    areaStartOpacity: readCSSNumber(
      styles,
      ["--chart-area-start-opacity"],
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

    /* ----------------------------------------------------------------------
       Navigator
       ---------------------------------------------------------------------- */

    navigatorLineOpacity: readCSSNumber(
      styles,
      ["--chart-navigator-line-opacity"],
      DEFAULT_THEME.navigatorLineOpacity,
      {
        minimum: 0,
        maximum: 1,
      },
    ),

    navigatorFillStartOpacity: readCSSNumber(
      styles,
      ["--chart-navigator-fill-start-opacity"],
      DEFAULT_THEME.navigatorFillStartOpacity,
      {
        minimum: 0,
        maximum: 1,
      },
    ),

    navigatorFillEndOpacity: readCSSNumber(
      styles,
      ["--chart-navigator-fill-end-opacity"],
      DEFAULT_THEME.navigatorFillEndOpacity,
      {
        minimum: 0,
        maximum: 1,
      },
    ),

    navigatorMaskOpacity: readCSSNumber(
      styles,
      ["--chart-navigator-mask-opacity"],
      DEFAULT_THEME.navigatorMaskOpacity,
      {
        minimum: 0,
        maximum: 1,
      },
    ),

    navigatorOutlineOpacity: readCSSNumber(
      styles,
      ["--chart-navigator-outline-opacity"],
      DEFAULT_THEME.navigatorOutlineOpacity,
      {
        minimum: 0,
        maximum: 1,
      },
    ),

    navigatorHandleBorderOpacity: readCSSNumber(
      styles,
      ["--chart-navigator-handle-border-opacity"],
      DEFAULT_THEME.navigatorHandleBorderOpacity,
      {
        minimum: 0,
        maximum: 1,
      },
    ),

    navigatorHandleBackground: readCSSVariableAny(
      styles,
      ["--chart-navigator-handle-bg"],
      background || DEFAULT_THEME.navigatorHandleBackground,
    ),
  };
}

/* ==========================================================================
   Series Theme
   ========================================================================== */

/**
 * Creates Highcharts presentation values for the primary Market Chart series.
 *
 * Trend and line modes are semantically directional.
 * Candlesticks retain independent up/down point colors.
 */
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

  /* ------------------------------------------------------------------------
     Candlestick
     ------------------------------------------------------------------------ */

  if (normalizedMode === "candlestick") {
    const downFill = source.candleDown || source.danger || DEFAULT_THEME.danger;

    const downLine =
      source.candleDownLine ||
      source.candleDown ||
      source.danger ||
      DEFAULT_THEME.danger;

    const upFill = source.candleUp || source.success || DEFAULT_THEME.success;

    const upLine =
      source.candleUpLine ||
      source.candleUp ||
      source.success ||
      DEFAULT_THEME.success;

    return {
      /*
       * Highcharts candlestick terminology:
       *
       * `color`     = falling candle fill
       * `lineColor` = falling candle outline/wick
       * `upColor`   = rising candle fill
       * `upLineColor` = rising candle outline/wick
       */
      color: downFill,
      lineColor: downLine,

      upColor: upFill,
      upLineColor: upLine,

      lineWidth: 1,
    };
  }

  /*
   * One semantic color resolver is intentionally shared by trend, line and
   * navigator presentation.
   */
  const directionColor = resolveDirectionColor(source, direction);

  /* ------------------------------------------------------------------------
     Line
     ------------------------------------------------------------------------ */

  if (normalizedMode === "line") {
    return {
      color: directionColor,
      lineColor: directionColor,
      lineWidth: 2,
    };
  }

  /* ------------------------------------------------------------------------
     Trend / Area Spline
     ------------------------------------------------------------------------ */

  return {
    color: directionColor,
    lineColor: directionColor,
    lineWidth: 2,

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

/**
 * Creates the navigator presentation.
 *
 * IMPORTANT:
 *
 * Navigator data presentation:
 *   follows exactly the same semantic direction as the main trend/line chart.
 *
 * Navigator chrome:
 *   remains neutral and is based on border tokens.
 *
 * This separation prevents a falling/red chart from retaining an old
 * rising/green navigator while still keeping handles/masks visually neutral.
 */
export function getMarketChartNavigatorTheme(
  Highcharts,
  theme,
  direction = "neutral",
) {
  const source = theme || DEFAULT_THEME;

  /*
   * Same resolver as the primary series.
   *
   * This is the important contract:
   *
   *     direction
   *        ↓
   * resolveDirectionColor()
   *        ↓
   * main + navigator
   */
  const color = resolveDirectionColor(source, direction);

  /*
   * Mask / outline / handles are interface chrome, not market data.
   * They intentionally do not become green/red.
   */
  const neutralBase =
    source.borderStrong || source.border || DEFAULT_THEME.borderStrong;

  return {
    /* ----------------------------------------------------------------------
       Directional navigator data
       ---------------------------------------------------------------------- */

    color,

    lineColor: colorWithOpacity(
      Highcharts,
      color,
      source.navigatorLineOpacity ?? DEFAULT_THEME.navigatorLineOpacity,
    ),

    lineWidth: 1.5,

    fillColor: createVerticalGradient(
      Highcharts,
      color,
      source.navigatorFillStartOpacity ??
        DEFAULT_THEME.navigatorFillStartOpacity,
      source.navigatorFillEndOpacity ?? DEFAULT_THEME.navigatorFillEndOpacity,
    ),

    /* ----------------------------------------------------------------------
       Neutral navigator chrome
       ---------------------------------------------------------------------- */

    maskFill: colorWithOpacity(
      Highcharts,
      neutralBase,
      source.navigatorMaskOpacity ?? DEFAULT_THEME.navigatorMaskOpacity,
    ),

    outlineColor: colorWithOpacity(
      Highcharts,
      neutralBase,
      source.navigatorOutlineOpacity ?? DEFAULT_THEME.navigatorOutlineOpacity,
    ),

    handles: {
      backgroundColor:
        source.navigatorHandleBackground ||
        DEFAULT_THEME.navigatorHandleBackground,

      borderColor: colorWithOpacity(
        Highcharts,
        neutralBase,
        source.navigatorHandleBorderOpacity ??
          DEFAULT_THEME.navigatorHandleBorderOpacity,
      ),
    },
  };
}

/* ==========================================================================
   Public Constants
   ========================================================================== */

export { DEFAULT_THEME };
