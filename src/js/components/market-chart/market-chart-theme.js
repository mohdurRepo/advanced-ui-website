import {
  clamp,
  isElement,
  toFiniteNumber,
  toKeyword,
} from "./market-chart-utils.js";

/* ==========================================================================
   Market Chart Theme
   ==========================================================================

   Bridges design-system CSS custom properties into the plain values
   Highcharts needs.

   Ownership:

   1. JavaScript owns semantic market direction: "up" | "down" | "neutral".
   2. CSS owns the actual colors (--chart-success / --chart-danger /
      --chart-neutral, …).
   3. One direction resolver colors the trend/area series, the line series
      and the navigator data series, so they can never disagree.
   4. Navigator chrome (mask, outline, handles) stays neutral; only its data
      line/fill follow market direction.
   5. Candlestick colors are literal tokens, independent of direction.

   Token fallbacks are expressed as CSS variable chains, e.g. the tooltip
   background reads --chart-tooltip-bg, then --chart-bg, then the default.

   Colors that cannot be parsed (color-mix(), oklch(), …) are passed through
   unchanged when an opacity must be applied: the opacity is lost, but the
   color stays valid.
   ========================================================================== */

/* ==========================================================================
   Defaults
   ========================================================================== */

export const DEFAULT_THEME = Object.freeze({
  background: "#ffffff",

  text: "#1f2933",
  muted: "#667085",

  border: "#d0d5dd",
  borderStrong: "#98a2b3",
  grid: "#eaecf0",
  crosshair: "#98a2b3",

  success: "#16865c",
  danger: "#c53b3b",
  neutral: "#667085",

  candleUp: null,
  candleUpLine: null,
  candleDown: null,
  candleDownLine: null,

  tooltipBackground: "#ffffff",
  tooltipBorder: "#d0d5dd",

  navigatorHandleBackground: "#ffffff",

  areaStartOpacity: 0.2,
  areaEndOpacity: 0,

  navigatorLineOpacity: 0.72,
  navigatorFillStartOpacity: 0.1,
  navigatorFillEndOpacity: 0.015,
  navigatorMaskOpacity: 0.06,
  navigatorOutlineOpacity: 0.22,
  navigatorHandleBorderOpacity: 0.52,
});

/* ==========================================================================
   Token Map
   ========================================================================== */

/*
 * [theme key, CSS variables in priority order]
 * The DEFAULT_THEME value is used when none of the variables is set.
 */
const COLOR_TOKENS = Object.freeze([
  ["background", ["--chart-bg", "--chart-background"]],

  ["text", ["--chart-text"]],
  ["muted", ["--chart-muted"]],

  ["border", ["--chart-border"]],
  ["borderStrong", ["--chart-border-strong", "--chart-border"]],
  ["grid", ["--chart-grid"]],
  ["crosshair", ["--chart-crosshair"]],

  ["success", ["--chart-success", "--chart-positive"]],
  ["danger", ["--chart-danger", "--chart-negative"]],
  ["neutral", ["--chart-neutral"]],

  ["candleUp", ["--chart-candle-up"]],
  ["candleUpLine", ["--chart-candle-up-line"]],
  ["candleDown", ["--chart-candle-down"]],
  ["candleDownLine", ["--chart-candle-down-line"]],

  [
    "tooltipBackground",
    [
      "--chart-tooltip-bg",
      "--chart-tooltip-background",
      "--chart-bg",
      "--chart-background",
    ],
  ],
  ["tooltipBorder", ["--chart-tooltip-border", "--chart-border"]],

  [
    "navigatorHandleBackground",
    ["--chart-navigator-handle-bg", "--chart-bg", "--chart-background"],
  ],
]);

const OPACITY_TOKENS = Object.freeze([
  ["areaStartOpacity", "--chart-area-start-opacity"],
  ["areaEndOpacity", "--chart-area-end-opacity"],

  ["navigatorLineOpacity", "--chart-navigator-line-opacity"],
  ["navigatorFillStartOpacity", "--chart-navigator-fill-start-opacity"],
  ["navigatorFillEndOpacity", "--chart-navigator-fill-end-opacity"],
  ["navigatorMaskOpacity", "--chart-navigator-mask-opacity"],
  ["navigatorOutlineOpacity", "--chart-navigator-outline-opacity"],
  ["navigatorHandleBorderOpacity", "--chart-navigator-handle-border-opacity"],
]);

/* ==========================================================================
   CSS Reading
   ========================================================================== */

function getComputedStyles(element) {
  if (!isElement(element)) {
    return null;
  }

  try {
    return element.ownerDocument.defaultView?.getComputedStyle(element) ?? null;
  } catch {
    return null;
  }
}

function readCSSVariable(styles, names) {
  if (!styles) {
    return null;
  }

  for (const name of names) {
    const value = styles.getPropertyValue(name).trim();

    if (value) {
      return value;
    }
  }

  return null;
}

/**
 * Reads an opacity token. Accepts "0.2" or "20%".
 */
function readOpacity(styles, name, fallback) {
  const raw = readCSSVariable(styles, [name]);

  if (raw === null) {
    return fallback;
  }

  const percent = raw.endsWith("%");

  const number = toFiniteNumber(percent ? raw.slice(0, -1) : raw);

  if (number === null) {
    return fallback;
  }

  return clamp(percent ? number / 100 : number, 0, 1);
}

/* ==========================================================================
   Direction
   ========================================================================== */

function normalizeDirection(direction) {
  switch (toKeyword(direction)) {
    case "up":
    case "positive":
    case "gain":
      return "up";

    case "down":
    case "negative":
    case "loss":
      return "down";

    default:
      return "neutral";
  }
}

/**
 * The single semantic color resolver shared by trend, line and navigator.
 */
function resolveDirectionColor(theme, direction) {
  switch (normalizeDirection(direction)) {
    case "up":
      return theme.success || DEFAULT_THEME.success;

    case "down":
      return theme.danger || DEFAULT_THEME.danger;

    default:
      return theme.neutral || DEFAULT_THEME.neutral;
  }
}

/* ==========================================================================
   Color
   ========================================================================== */

function parseHexColor(color) {
  const match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color);

  if (!match) {
    return null;
  }

  let hex = match[1];

  if (hex.length <= 4) {
    hex = [...hex].map((digit) => digit + digit).join("");
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

function parseRGBColor(color) {
  const match =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
      color,
    );

  if (!match) {
    return null;
  }

  return {
    r: clamp(Number(match[1]), 0, 255),
    g: clamp(Number(match[2]), 0, 255),
    b: clamp(Number(match[3]), 0, 255),
    a: match[4] === undefined ? 1 : clamp(Number(match[4]), 0, 1),
  };
}

function hasFiniteRGB(rgba) {
  return (
    Array.isArray(rgba) &&
    rgba.length >= 3 &&
    rgba.slice(0, 3).every((component) => Number.isFinite(component))
  );
}

/**
 * Multiplies a color's alpha by `opacity`.
 *
 * Order: Highcharts parser -> hex/rgb parser -> unchanged pass-through.
 */
function colorWithOpacity(Highcharts, color, opacity) {
  const source = String(color ?? "").trim() || DEFAULT_THEME.neutral;

  const alpha = clamp(toFiniteNumber(opacity) ?? 1, 0, 1);

  if (typeof Highcharts?.color === "function") {
    try {
      const parsed = Highcharts.color(source);

      if (hasFiniteRGB(parsed?.rgba)) {
        const baseAlpha = Number.isFinite(parsed.rgba[3]) ? parsed.rgba[3] : 1;

        return parsed.setOpacity(baseAlpha * alpha).get("rgba");
      }
    } catch {
      /* Fall through to the lightweight parsers. */
    }
  }

  const parsed = parseHexColor(source) || parseRGBColor(source);

  if (!parsed) {
    return source;
  }

  const { r, g, b, a } = parsed;

  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${
    Math.round(a * alpha * 1_000) / 1_000
  })`;
}

function createVerticalGradient(Highcharts, color, startOpacity, endOpacity) {
  return {
    linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
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
 * Reads every Market Chart token from the chart host.
 *
 * Returns plain values only, safe to pass into Highcharts options.
 * Without an element (or without CSS) the defaults are returned.
 *
 * @param {Element} [element]
 * @returns {typeof DEFAULT_THEME}
 */
export function getMarketChartTheme(element) {
  const styles = getComputedStyles(element);

  const theme = {};

  for (const [key, names] of COLOR_TOKENS) {
    theme[key] = readCSSVariable(styles, names) ?? DEFAULT_THEME[key];
  }

  for (const [key, name] of OPACITY_TOKENS) {
    theme[key] = readOpacity(styles, name, DEFAULT_THEME[key]);
  }

  return theme;
}

/* ==========================================================================
   Series Theme
   ========================================================================== */

/**
 * Presentation values for the primary series.
 *
 * - trend: directional line + vertical gradient fill
 * - line: directional line
 * - candlestick: independent up/down colors
 */
export function getMarketChartSeriesTheme(
  Highcharts,
  theme = DEFAULT_THEME,
  mode = "trend",
  direction = "neutral",
) {
  const source = theme || DEFAULT_THEME;

  const normalizedMode = toKeyword(mode);

  if (normalizedMode === "candlestick") {
    const downFill = source.candleDown || source.danger || DEFAULT_THEME.danger;
    const upFill = source.candleUp || source.success || DEFAULT_THEME.success;

    /*
     * Highcharts candlestick terminology:
     *   color / lineColor       falling candle fill / outline + wick
     *   upColor / upLineColor   rising candle fill / outline + wick
     */
    return {
      color: downFill,
      lineColor: source.candleDownLine || downFill,
      upColor: upFill,
      upLineColor: source.candleUpLine || upFill,
      lineWidth: 1,
    };
  }

  const color = resolveDirectionColor(source, direction);

  if (normalizedMode === "line") {
    return {
      color,
      lineColor: color,
      lineWidth: 2,
    };
  }

  return {
    color,
    lineColor: color,
    lineWidth: 2,
    fillColor: createVerticalGradient(
      Highcharts,
      color,
      source.areaStartOpacity ?? DEFAULT_THEME.areaStartOpacity,
      source.areaEndOpacity ?? DEFAULT_THEME.areaEndOpacity,
    ),
  };
}

/* ==========================================================================
   Navigator Theme
   ========================================================================== */

/**
 * Navigator presentation.
 *
 * Data (line + fill) follows the same direction color as the main series.
 * Chrome (mask, outline, handles) stays neutral.
 */
export function getMarketChartNavigatorTheme(
  Highcharts,
  theme = DEFAULT_THEME,
  direction = "neutral",
) {
  const source = theme || DEFAULT_THEME;

  const color = resolveDirectionColor(source, direction);

  const chrome =
    source.borderStrong || source.border || DEFAULT_THEME.borderStrong;

  const opacity = (key) => source[key] ?? DEFAULT_THEME[key];

  return {
    color,
    lineColor: colorWithOpacity(
      Highcharts,
      color,
      opacity("navigatorLineOpacity"),
    ),
    lineWidth: 1.5,
    fillColor: createVerticalGradient(
      Highcharts,
      color,
      opacity("navigatorFillStartOpacity"),
      opacity("navigatorFillEndOpacity"),
    ),

    maskFill: colorWithOpacity(
      Highcharts,
      chrome,
      opacity("navigatorMaskOpacity"),
    ),
    outlineColor: colorWithOpacity(
      Highcharts,
      chrome,
      opacity("navigatorOutlineOpacity"),
    ),

    handles: {
      backgroundColor:
        source.navigatorHandleBackground ||
        DEFAULT_THEME.navigatorHandleBackground,
      borderColor: colorWithOpacity(
        Highcharts,
        chrome,
        opacity("navigatorHandleBorderOpacity"),
      ),
    },
  };
}
