/* ==========================================================================
   Market Chart Theme
   ==========================================================================

   Bridges the *actual* design-system tokens (see market-chart.scss) into the
   shape market-chart-options.js needs. CSS is the source of truth:

   - `--chart-direction-color` / `--chart-line` are already resolved by CSS
     itself via `.market-chart[data-chart-direction="up|down|neutral"]`
     selectors. This module does NOT re-implement that switch — it just
     reads the already-resolved value. The controller is responsible for
     setting `data-chart-direction` on the element *before* this module
     reads computed styles, or the value will be one step stale.

   - Several navigator tokens are *opacity fractions* meant to be blended
     with a base color (`--chart-navigator-line-opacity`,
     `--chart-navigator-fill-start/end-opacity`,
     `--chart-navigator-mask-opacity`, `--chart-navigator-outline-opacity`,
     `--chart-navigator-handle-border-opacity`), not literal colors. This
     module does that blending; nothing upstream needs to.

   - Candlesticks get four literal colors directly (`--chart-candle-up`,
     `--chart-candle-up-line`, `--chart-candle-down`,
     `--chart-candle-down-line`) — no opacity math, no derivation from
     positive/negative. If a consumer's stylesheet doesn't define these,
     this module falls back to deriving them from success/danger.

   Note on `color-mix()`: several tokens (e.g. `--chart-grid`) are defined
   in SCSS using `color-mix()`. Whether `getComputedStyle` returns a fully
   resolved color or the raw function string depends on the browser engine
   and whether the property is registered via `@property`. `colorWithOpacity()`
   below degrades gracefully either way: if the string can't be parsed for
   further opacity blending, it's passed through unchanged rather than
   breaking — worst case a token doesn't get an extra opacity multiplier
   applied on top, it never renders broken.
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

  /* Already-resolved direction color, mirrors CSS's --chart-line. */
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
   Direction (fallback only — CSS resolves this first via --chart-line)
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
  /*
   * Preferred path: CSS already resolved --chart-line based on the
   * data-chart-direction attribute. Only fall back to picking a color by
   * hand if that token is missing (e.g. an older stylesheet).
   */
  if (theme.line) {
    return theme.line;
  }

  const normalizedDirection = normalizeDirection(direction);

  if (normalizedDirection === "up") {
    return theme.success;
  }

  if (normalizedDirection === "down") {
    return theme.danger;
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

function colorWithOpacity(Highcharts, color, opacity) {
  const alpha = clamp(toFiniteNumber(opacity, 1), 0, 1);

  if (typeof Highcharts?.color === "function") {
    try {
      const parsed = Highcharts.color(color);

      /*
       * Highcharts.color() never throws on an unparseable string — it
       * returns an object whose internal rgba defaults to black. Detect
       * that failure mode explicitly rather than silently returning a
       * wrong color.
       */
      if (parsed && Array.isArray(parsed.rgba) && parsed.input !== undefined) {
        return parsed.setOpacity(alpha).get();
      }
    } catch {
      // Fall through to the manual parser.
    }
  }

  const parsed = parseHexColor(color) || parseRGBColor(color);

  if (!parsed) {
    /*
     * Unparseable (e.g. an unresolved color-mix() string, or a named
     * color). Pass it through unchanged rather than breaking — the
     * opacity multiplier is lost, but nothing renders broken.
     */
    return color;
  }

  return `rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)}, ${alpha})`;
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
     * Already resolved by CSS based on data-chart-direction. null if the
     * stylesheet doesn't define it — callers fall back to success/danger.
     */
    line: readCSSVariableAny(
      styles,
      ["--chart-line", "--chart-direction-color"],
      DEFAULT_THEME.line,
    ),

    /* Literal candle colors — no opacity math intended by the design system. */
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

    navigatorLineOpacity: readCSSNumber(
      styles,
      ["--chart-navigator-line-opacity"],
      DEFAULT_THEME.navigatorLineOpacity,
      { minimum: 0, maximum: 1 },
    ),

    navigatorFillStartOpacity: readCSSNumber(
      styles,
      ["--chart-navigator-fill-start-opacity"],
      DEFAULT_THEME.navigatorFillStartOpacity,
      { minimum: 0, maximum: 1 },
    ),

    navigatorFillEndOpacity: readCSSNumber(
      styles,
      ["--chart-navigator-fill-end-opacity"],
      DEFAULT_THEME.navigatorFillEndOpacity,
      { minimum: 0, maximum: 1 },
    ),

    navigatorMaskOpacity: readCSSNumber(
      styles,
      ["--chart-navigator-mask-opacity"],
      DEFAULT_THEME.navigatorMaskOpacity,
      { minimum: 0, maximum: 1 },
    ),

    navigatorOutlineOpacity: readCSSNumber(
      styles,
      ["--chart-navigator-outline-opacity"],
      DEFAULT_THEME.navigatorOutlineOpacity,
      { minimum: 0, maximum: 1 },
    ),

    navigatorHandleBorderOpacity: readCSSNumber(
      styles,
      ["--chart-navigator-handle-border-opacity"],
      DEFAULT_THEME.navigatorHandleBorderOpacity,
      { minimum: 0, maximum: 1 },
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
     Candlestick — literal colors, no opacity blending, with a graceful
     fallback to success/danger if the stylesheet doesn't define them.
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
      /* Down candle. */
      color: downFill,
      lineColor: downLine,

      /* Up candle. */
      upColor: upFill,
      upLineColor: upLine,

      lineWidth: 1,
    };
  }

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

export function getMarketChartNavigatorTheme(
  Highcharts,
  theme,
  direction = "neutral",
) {
  const source = theme || DEFAULT_THEME;
  const color = resolveDirectionColor(source, direction);

  /*
   * The mask/outline/handle-border are neutral UI chrome, not tinted by
   * market direction — only the line and fill (the actual data) follow
   * up/down/neutral. Using borderStrong as the neutral base matches the
   * "dimmed chrome" look these opacity tokens are meant for.
   */
  const neutralBase =
    source.borderStrong || source.border || DEFAULT_THEME.borderStrong;

  return {
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
