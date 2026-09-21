/* ==========================================================================
   Market Overview Configuration
   ========================================================================== */

window.marketConfig = {
  /* ==========================================================================
     API
     ========================================================================== */

  endpoints: {
    marketData: "/api",
    timing: "/api",
  },

  /* ==========================================================================
     Refresh
     ========================================================================== */

  refresh: {
    /*
     * Fallback polling interval.
     *
     * Existing rendered values remain visible while a refresh is in flight.
     * Refreshing must never introduce an initial-loading/skeleton state.
     */

    fallbackInterval: 30000,

    /*
     * Duration of the directional live-update feedback applied only when a
     * rendered numeric value actually changes.
     */

    liveUpdateDuration: 900,
  },

  /* ==========================================================================
     Instrument / Company Destinations
     ========================================================================== */

  domains: {
    mainCompany: companyDetailsURL + "?companySymbol=",

    nomuCompany: companyDetailsSMEURL + "?companySymbol=",

    sukukCompany: sukukURL + "?SukukBondsSymbol=",

    reitsCompany: companyDetailsURL + "?companySymbol=",

    etfCompany: companyDetailsETFURL + "?etfSymbolParameter=",

    cefCompany: companyDetailsURL + "?companySymbol=",
  },

  /* ==========================================================================
     Markets
     ========================================================================== */

  markets: {
    /* ========================================================================
       Main Market — TASI
       ======================================================================== */

    tasi: {
      code: "M",

      summary: {
        value: "tasiValue",
        netChange: "tasiNetChange",
        percentChange: "tasiPercentageChange",
        statusCode: "marketStatusCode",
      },

      details: {
        activeResults: "mainMarketActiveResultsBean",

        todaysSummary: "tasiBean.tasiTodaysSummaryBean",

        yearToDate: "tasiBean.tasiYearToDateBean",

        marketBean: "marketBean",

        marketCapBean: "marketCapBean",

        companyDomain: "mainCompany",

        stats: {
          turnOver: "turnOver",
          volumeTraded: "volumeTraded",

          symbolsListed: "noOfSymbolsListedMain",
          symbolsDown: "noOfDowns",
          symbolsUp: "noOfUps",

          dailyChange: "change",
          dailyPercentChange: "percentChange",
        },
      },
    },

    /* ========================================================================
       Parallel Market — Nomu
       ======================================================================== */

    nomu: {
      code: "N",

      summary: {
        value: "smeSasiValue",
        netChange: "smeSasiNetChange",
        percentChange: "smeSasiPercentageChange",
        statusCode: "smeMarketStatusCode",
      },

      details: {
        activeResults: "nomuMarketActiveResultBean",

        todaysSummary: "smeSasiBean.smeSASITodaysSummaryBean",

        yearToDate: "smeSasiBean.smeSASIYearToDateBean",

        marketBean: "smeMarketBean",

        marketCapBean: "marketCapBean",

        companyDomain: "nomuCompany",

        stats: {
          turnOver: "turnOver",
          volumeTraded: "volumeTraded",

          symbolsListed: "noOfSymbolsListedNomu",
          symbolsDown: "noOfDowns",
          symbolsUp: "noOfUps",

          dailyChange: "change",
          dailyPercentChange: "percentChange",
        },
      },
    },

    /* ========================================================================
       Sukuk & Bonds
       ======================================================================== */

    sukuk: {
      code: "S",

      summary: {
        value: "sukukValue",
        netChange: "sukukNetChange",
        percentChange: "sukukPercentageChange",
        statusCode: "sukukmarketStatusCode",
      },

      details: {
        activeResults: "sokukMarketActiveResultBean",

        todaysSummary: "sukukIndicesBean.tasiTodaysSummaryBean",

        yearToDate: "sukukIndicesBean.tasiYearToDateBean",

        marketBean: "sukukMarketBean",

        marketCapBean: "marketCapBean",

        companyDomain: "sukukCompany",

        stats: {
          turnOver: "turnOver",
          volumeTraded: "volumeTraded",

          symbolsListed: "noOfSymbolsListedSukuk",
          symbolsDown: "noOfDowns",
          symbolsUp: "noOfUps",

          dailyChange: "change",
          dailyPercentChange: "percentChange",
        },
      },
    },

    /* ========================================================================
       Funds
       ======================================================================== */

    funds: {
      code: "F",

      /*
       * The legacy response does not expose the Funds summary card through
       * the same index-value contract used by TASI / Nomu / Sukuk / MT30.
       *
       * We therefore keep Funds category data below and resolve the summary
       * card independently in the renderer when a reliable source is present.
       */

      summary: {
        value: null,
        netChange: null,
        percentChange: null,
        statusCode: "marketStatusCode",
      },
    },

    /* ========================================================================
       Derivatives — MT30
       ======================================================================== */

    derivatives: {
      code: "D",

      summary: {
        value: "mt30IndexValue",
        netChange: "mt30IndexNetChange",
        percentChange: "mt30IndexPercentageChange",
        statusCode: "derivativeMarketStatus",
      },
    },
  },

  /* ==========================================================================
     Funds
     ========================================================================== */

  funds: {
    /* ========================================================================
       REITs
       ======================================================================== */

    reits: {
      activeResults: "reitMarketActiveResultBean",

      statsSource: "reitMarketBean",

      watchSource: null,

      companyDomain: "reitsCompany",

      stats: {
        turnOver: "turnover",
        volumeTraded: "volume",
        noOfTrades: "noOfTrades",
        listedFunds: "listedFundsREITs",
      },
    },

    /* ========================================================================
       ETFs
       ======================================================================== */

    etfs: {
      activeResults: "etfMarketActiveResultBean",

      statsSource: "etfMarketBean",

      watchSource: "marketWatchETFsBeans",

      companyDomain: "etfCompany",

      stats: {
        turnOver: "turnover",
        volumeTraded: "volume",
        noOfTrades: "noOfTrades",
        listedFunds: "listedFundsETFs",
      },
    },

    /* ========================================================================
       Closed-End Funds
       ======================================================================== */

    cefs: {
      activeResults: null,

      statsSource: "cefMarketBean",

      watchSource: "marketWatchCEFsBeans",

      companyDomain: "cefCompany",

      stats: {
        turnOver: "turnover",
        volumeTraded: "volume",
        noOfTrades: "noOfTrades",
        listedFunds: "listedFundsCEFs",
      },
    },
  },

  /* ==========================================================================
     Timing API Mapping
     ========================================================================== */

  timing: {
    /*
     * These codes preserve the timing-service behavior used by the legacy
     * implementation.
     *
     * "M" drives both the Main Market and Parallel Market countdowns.
     * "B" is the Funds / REIT timing response.
     */

    marketCodes: {
      M: ["tasi", "nomu"],
      S: ["sukuk"],
      B: ["funds"],
      D: ["derivatives"],
    },
  },
};
==================
/* ==========================================================================
   Market Overview — Common Utilities
   ========================================================================== */

(function (window, document) {
  "use strict";

  const config = window.marketConfig || {};

  const DEFAULT_LIVE_UPDATE_DURATION = 900;

  const PRICE_STATE_CLASSES = [
    "price-up",
    "price-down",
    "price-neutral",
  ];

  const LIVE_UPDATE_CLASSES = [
    "is-updating-up",
    "is-updating-down",
    "is-updating-neutral",
  ];

  /*
   * Per-element runtime state.
   *
   * WeakMap keeps refresh state tied to the actual DOM node and allows
   * removed/reconciled elements to be garbage-collected naturally.
   */

  const liveUpdateTimers = new WeakMap();
  const rawValueStore = new WeakMap();

  /*
   * NumberFormat construction is relatively expensive, so formatters are
   * cached by locale + options.
   */

  const formatterCache = new Map();

  /* ==========================================================================
     Locale
     ========================================================================== */

  function getLocale() {
    return (
      document.documentElement.lang ||
      window.navigator.language ||
      "en-US"
    );
  }

  function isArabic() {
    return getLocale()
      .toLowerCase()
      .startsWith("ar");
  }

  /* ==========================================================================
     Object Access
     ========================================================================== */

  function getPath(
    object,
    path,
    fallback = null,
  ) {
    if (
      object === null ||
      object === undefined ||
      !path
    ) {
      return fallback;
    }

    const keys = String(path).split(".");

    let current = object;

    for (const key of keys) {
      if (
        current === null ||
        current === undefined ||
        !Object.prototype.hasOwnProperty.call(
          current,
          key,
        )
      ) {
        return fallback;
      }

      current = current[key];
    }

    return current === undefined
      ? fallback
      : current;
  }

  function firstDefined(...values) {
    for (const value of values) {
      if (
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        return value;
      }
    }

    return null;
  }

  /* ==========================================================================
     Numeric Parsing
     ========================================================================== */

  function normalizeDigits(value) {
    const arabicIndicDigits =
      "٠١٢٣٤٥٦٧٨٩";

    const easternArabicDigits =
      "۰۱۲۳۴۵۶۷۸۹";

    return String(value)
      .replace(
        /[٠-٩]/g,
        (digit) =>
          String(
            arabicIndicDigits.indexOf(
              digit,
            ),
          ),
      )
      .replace(
        /[۰-۹]/g,
        (digit) =>
          String(
            easternArabicDigits.indexOf(
              digit,
            ),
          ),
      );
  }

  function toNumber(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value)
        ? value
        : null;
    }

    const normalized = normalizeDigits(
      value,
    )
      .trim()

      /*
       * Unicode minus.
       */

      .replace(/\u2212/g, "-")

      /*
       * Arabic decimal separator.
       */

      .replace(/\u066b/g, ".")

      /*
       * Thousands separators / spaces.
       */

      .replace(
        /[,\u066c\u00a0\s]/g,
        "",
      )

      /*
       * Allow callers to pass simple percentage text.
       */

      .replace(/%$/, "");

    if (!normalized) {
      return null;
    }

    const number = Number(normalized);

    return Number.isFinite(number)
      ? number
      : null;
  }

  function toInteger(
    value,
    fallback = null,
  ) {
    const number = toNumber(value);

    if (number === null) {
      return fallback;
    }

    return Math.trunc(number);
  }

  function isNumeric(value) {
    return toNumber(value) !== null;
  }

  /* ==========================================================================
     Number Formatting
     ========================================================================== */

  function getNumberFormatter(
    options = {},
  ) {
    const locale = getLocale();

    const cacheKey = JSON.stringify([
      locale,
      options,
    ]);

    if (
      !formatterCache.has(cacheKey)
    ) {
      formatterCache.set(
        cacheKey,
        new Intl.NumberFormat(
          locale,
          options,
        ),
      );
    }

    return formatterCache.get(
      cacheKey,
    );
  }

  function formatNumber(
    value,
    decimals = 0,
    options = {},
  ) {
    const number = toNumber(value);

    if (number === null) {
      return options.fallback ?? "—";
    }

    return getNumberFormatter({
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      ...options,
    }).format(number);
  }

  function formatInteger(
    value,
    options = {},
  ) {
    return formatNumber(
      value,
      0,
      options,
    );
  }

  function formatDecimal(
    value,
    decimals = 2,
    options = {},
  ) {
    return formatNumber(
      value,
      decimals,
      options,
    );
  }

  function formatSignedNumber(
    value,
    decimals = 2,
    options = {},
  ) {
    return formatNumber(
      value,
      decimals,
      {
        signDisplay: "exceptZero",
        ...options,
      },
    );
  }

  function formatPercent(
    value,
    {
      decimals = 2,
      signed = false,
      parentheses = false,
      fallback = "—",
    } = {},
  ) {
    const number = toNumber(value);

    if (number === null) {
      return fallback;
    }

    const formatted = formatNumber(
      number,
      decimals,
      signed
        ? {
            signDisplay: "exceptZero",
          }
        : {},
    );

    const result = `${formatted}%`;

    return parentheses
      ? `(${result})`
      : result;
  }

  function formatCompact(
    value,
    options = {},
  ) {
    const number = toNumber(value);

    if (number === null) {
      return options.fallback ?? "—";
    }

    return getNumberFormatter({
      notation: "compact",
      maximumFractionDigits: 2,
      ...options,
    }).format(number);
  }

  /* ==========================================================================
     Direction
     ========================================================================== */

  /*
   * Persistent market state.
   *
   * This answers:
   *
   *   Is the daily/current market value positive, negative or neutral?
   */

  function getDirection(value) {
    const number = toNumber(value);

    if (number === null) {
      return null;
    }

    if (number > 0) {
      return "up";
    }

    if (number < 0) {
      return "down";
    }

    return "neutral";
  }

  /*
   * Temporary refresh direction.
   *
   * This answers:
   *
   *   Did the latest snapshot move higher or lower than the previous one?
   *
   * It is deliberately independent from the persistent price state.
   */

  function getUpdateDirection(
    previousValue,
    nextValue,
  ) {
    const previous =
      toNumber(previousValue);

    const next =
      toNumber(nextValue);

    if (
      previous === null ||
      next === null
    ) {
      return null;
    }

    if (next > previous) {
      return "up";
    }

    if (next < previous) {
      return "down";
    }

    return "neutral";
  }

  /* ==========================================================================
     Price State
     ========================================================================== */

  function getPriceClass(value) {
    const direction =
      getDirection(value);

    if (!direction) {
      return null;
    }

    return `price-${direction}`;
  }

  function clearPriceState(element) {
    if (!element) {
      return;
    }

    element.classList.remove(
      ...PRICE_STATE_CLASSES,
    );
  }

  function applyPriceState(
    element,
    value,
  ) {
    if (!element) {
      return;
    }

    clearPriceState(element);

    const className =
      getPriceClass(value);

    if (className) {
      element.classList.add(
        className,
      );
    }
  }

  /* ==========================================================================
     Motion Preference
     ========================================================================== */

  function prefersReducedMotion() {
    if (
      document.documentElement
        .dataset.motion === "reduce"
    ) {
      return true;
    }

    return Boolean(
      window.matchMedia &&
        window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches,
    );
  }

  /* ==========================================================================
     Live Update Feedback
     ========================================================================== */

  function clearLiveUpdate(element) {
    if (!element) {
      return;
    }

    const timer =
      liveUpdateTimers.get(element);

    if (timer) {
      window.clearTimeout(timer);

      liveUpdateTimers.delete(
        element,
      );
    }

    element.classList.remove(
      ...LIVE_UPDATE_CLASSES,
    );
  }

  function triggerLiveUpdate(
    element,
    previousValue,
    nextValue,
    {
      duration =
        config.refresh
          ?.liveUpdateDuration ??
        DEFAULT_LIVE_UPDATE_DURATION,
    } = {},
  ) {
    if (!element) {
      return false;
    }

    const direction =
      getUpdateDirection(
        previousValue,
        nextValue,
      );

    /*
     * No valid previous value means there is no trustworthy comparison.
     *
     * Equal numeric values remain completely visually quiet.
     */

    if (
      direction === null ||
      direction === "neutral"
    ) {
      return false;
    }

    /*
     * Connect the element to the existing shared live-update SCSS utility.
     *
     * This is intentionally applied lazily so the server-rendered Overview
     * markup does not need presentation-only live-update classes everywhere.
     */

    element.classList.add(
      "market-live-update",
    );

    /*
     * Cancel an existing update state before starting the new one.
     */

    clearLiveUpdate(element);

    /*
     * Values still update normally for reduced-motion users, but temporary
     * animation/highlighting is suppressed.
     */

    if (prefersReducedMotion()) {
      return true;
    }

    /*
     * Force a style boundary so repeated updates in the same direction can
     * restart the transition cleanly.
     */

    void element.offsetWidth;

    element.classList.add(
      `is-updating-${direction}`,
    );

    const timer =
      window.setTimeout(() => {
        element.classList.remove(
          ...LIVE_UPDATE_CLASSES,
        );

        liveUpdateTimers.delete(
          element,
        );
      }, duration);

    liveUpdateTimers.set(
      element,
      timer,
    );

    return true;
  }

  /* ==========================================================================
     Raw Element Values
     ========================================================================== */

  function readElementRawValue(
    element,
  ) {
    if (!element) {
      return null;
    }

    /*
     * Runtime value takes precedence after the first update.
     */

    if (
      rawValueStore.has(element)
    ) {
      return rawValueStore.get(
        element,
      );
    }

    /*
     * Server-rendered <data value=""> is the preferred initial baseline.
     */

    if (
      element.tagName === "DATA" &&
      element.hasAttribute("value")
    ) {
      return toNumber(
        element.getAttribute("value"),
      );
    }

    /*
     * Non-<data> elements may expose a baseline through a data attribute.
     */

    if (
      element.dataset &&
      element.dataset
        .marketRawValue !== undefined
    ) {
      return toNumber(
        element.dataset
          .marketRawValue,
      );
    }

    return null;
  }

  function storeElementRawValue(
    element,
    value,
  ) {
    if (!element) {
      return;
    }

    const number = toNumber(value);

    rawValueStore.set(
      element,
      number,
    );

    /*
     * Keep semantic <data> markup synchronized with the displayed value.
     */

    if (
      element.tagName === "DATA"
    ) {
      if (number === null) {
        element.removeAttribute(
          "value",
        );
      } else {
        element.setAttribute(
          "value",
          String(number),
        );
      }
    }
  }

  /* ==========================================================================
     Numeric DOM Updates
     ========================================================================== */

  function setDataValue(
    element,
    rawValue,
    formattedValue,
    {
      animate = true,
      preserveOnNull = true,
      updateTarget = null,
    } = {},
  ) {
    if (!element) {
      return {
        updated: false,
        changed: false,
      };
    }

    const nextValue =
      toNumber(rawValue);

    /*
     * A missing API value must never replace an already-rendered legitimate
     * value with zero, an empty string or a placeholder.
     */

    if (
      nextValue === null &&
      preserveOnNull
    ) {
      return {
        updated: false,
        changed: false,
      };
    }

    const previousValue =
      readElementRawValue(
        element,
      );

    const changed =
      previousValue !== null &&
      nextValue !== null &&
      previousValue !== nextValue;

    /*
     * Update visible content only when the caller supplied formatted output.
     */

    if (
      formattedValue !== undefined
    ) {
      element.textContent =
        String(formattedValue);
    }

    storeElementRawValue(
      element,
      nextValue,
    );

    /*
     * `updateTarget` lets a child <data> hold the numeric baseline while a
     * wrapping visual component receives the temporary live-update feedback.
     *
     * Example:
     *
     *   <span class="market-change price-up">
     *     <span class="market-change__icon"></span>
     *     <data>...</data>
     *   </span>
     */

    if (
      animate &&
      changed
    ) {
      triggerLiveUpdate(
        updateTarget || element,
        previousValue,
        nextValue,
      );
    }

    return {
      updated: true,
      changed,
      previousValue,
      nextValue,
    };
  }

  /* ==========================================================================
     Text DOM Updates
     ========================================================================== */

  function setText(
    element,
    value,
    {
      preserveOnNull = true,
    } = {},
  ) {
    if (!element) {
      return false;
    }

    if (
      preserveOnNull &&
      (
        value === null ||
        value === undefined
      )
    ) {
      return false;
    }

    const nextText =
      value === null ||
      value === undefined
        ? ""
        : String(value);

    if (
      element.textContent === nextText
    ) {
      return false;
    }

    element.textContent =
      nextText;

    return true;
  }

  /* ==========================================================================
     URLs
     ========================================================================== */

  function getDomain(domainKey) {
    if (!domainKey) {
      return "";
    }

    return String(
      config.domains?.[
        domainKey
      ] || "",
    );
  }

  function buildCompanyUrl(
    domainKey,
    symbol,
  ) {
    const domain =
      getDomain(domainKey);

    if (
      !domain ||
      symbol === null ||
      symbol === undefined ||
      symbol === ""
    ) {
      return "";
    }

    return (
      domain +
      encodeURIComponent(
        String(symbol),
      )
    );
  }

  /* ==========================================================================
     Timer Utilities
     ========================================================================== */

  function pad(value) {
    return String(
      Math.max(
        0,
        toInteger(value, 0),
      ),
    ).padStart(2, "0");
  }

  function buildTargetDate(
    nextEventTimer,
  ) {
    if (
      !nextEventTimer ||
      !nextEventTimer.date ||
      !nextEventTimer.time
    ) {
      return null;
    }

    const date =
      nextEventTimer.date;

    const time =
      nextEventTimer.time;

    const year =
      toInteger(date.year);

    const month =
      toInteger(date.month);

    const day =
      toInteger(date.day);

    const hour =
      toInteger(
        time.hour,
        0,
      );

    const minute =
      toInteger(
        time.minute,
        0,
      );

    const second =
      toInteger(
        time.second,
        0,
      );

    if (
      year === null ||
      month === null ||
      day === null
    ) {
      return null;
    }

    const milliseconds =
      time.nano
        ? Math.floor(
            toInteger(
              time.nano,
              0,
            ) / 1000000,
          )
        : 0;

    const target =
      new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second,
        milliseconds,
      );

    return Number.isNaN(
      target.getTime(),
    )
      ? null
      : target;
  }

  function getRemainingSeconds(
    nextEventTimer,
    now = Date.now(),
  ) {
    const target =
      buildTargetDate(
        nextEventTimer,
      );

    if (!target) {
      return null;
    }

    return Math.max(
      0,
      Math.floor(
        (
          target.getTime() -
          now
        ) / 1000,
      ),
    );
  }

  function formatTimer(seconds) {
    const value =
      toNumber(seconds);

    if (value === null) {
      return "";
    }

    const safeSeconds =
      Math.max(
        0,
        Math.floor(value),
      );

    const days =
      Math.floor(
        safeSeconds / 86400,
      );

    const hours =
      Math.floor(
        (
          safeSeconds %
          86400
        ) / 3600,
      );

    const minutes =
      Math.floor(
        (
          safeSeconds %
          3600
        ) / 60,
      );

    const remainingSeconds =
      safeSeconds % 60;

    if (days > 0) {
      if (isArabic()) {
        return `${days} يوم`;
      }

      return `${days} ${
        days === 1
          ? "day"
          : "days"
      }`;
    }

    return [
      pad(hours),
      pad(minutes),
      pad(remainingSeconds),
    ].join(":");
  }

  function getTimerLabel(status) {
    const normalized =
      String(status || "")
        .trim()
        .toUpperCase();

    if (isArabic()) {
      return normalized === "OPEN"
        ? "يغلق خلال "
        : "يفتح خلال ";
    }

    return normalized === "OPEN"
      ? "Closes in "
      : "Opens in ";
  }

  function toIsoDuration(seconds) {
    const value =
      toNumber(seconds);

    if (value === null) {
      return "";
    }

    let remaining =
      Math.max(
        0,
        Math.floor(value),
      );

    const days =
      Math.floor(
        remaining / 86400,
      );

    remaining %= 86400;

    const hours =
      Math.floor(
        remaining / 3600,
      );

    remaining %= 3600;

    const minutes =
      Math.floor(
        remaining / 60,
      );

    const secs =
      remaining % 60;

    let duration = "P";

    if (days) {
      duration += `${days}D`;
    }

    duration += "T";

    if (hours) {
      duration += `${hours}H`;
    }

    if (minutes) {
      duration += `${minutes}M`;
    }

    duration += `${secs}S`;

    return duration;
  }

  /* ==========================================================================
     Public API
     ========================================================================== */

  window.MarketCommon =
    Object.freeze({
      /* Locale */

      getLocale,
      isArabic,

      /* Objects */

      getPath,
      firstDefined,

      /* Numbers */

      toNumber,
      toInteger,
      isNumeric,

      formatNumber,
      formatInteger,
      formatDecimal,
      formatSignedNumber,
      formatPercent,
      formatCompact,

      /* Direction */

      getDirection,
      getUpdateDirection,

      /* Persistent Price State */

      getPriceClass,
      clearPriceState,
      applyPriceState,

      /* Temporary Live Updates */

      prefersReducedMotion,
      clearLiveUpdate,
      triggerLiveUpdate,

      /* DOM */

      readElementRawValue,
      setDataValue,
      setText,

      /* URLs */

      getDomain,
      buildCompanyUrl,

      /* Timers */

      pad,
      buildTargetDate,
      getRemainingSeconds,
      formatTimer,
      getTimerLabel,
      toIsoDuration,
    });
})(window, document);
/* ==========================================================================
   Market Overview — Details Renderer
   ========================================================================== */

(function (window, document) {
  "use strict";

  const config = window.marketConfig || {};
  const common = window.MarketCommon;

  if (!common) {
    return;
  }

  /* ==========================================================================
     DOM / Market Contract
     ========================================================================== */

  const MARKET_VIEWS = {
    tasi: {
      panel: "#market-panel-tasi",
      moversPrefix: "tasi",
      config: () => config.markets?.tasi,
    },

    nomu: {
      panel: "#market-panel-nomu",
      moversPrefix: "nomu",
      config: () => config.markets?.nomu,
    },

    sukuk: {
      panel: "#market-panel-sukuk",
      moversPrefix: "sukuk",
      config: () => config.markets?.sukuk,
    },
  };

  const FUND_VIEWS = {
    reits: {
      panel: "#funds-reits",
      moversPrefix: "reits",
      config: () => config.funds?.reits,
    },

    etfs: {
      panel: "#funds-etfs",
      moversPrefix: "etfs",
      config: () => config.funds?.etfs,
    },

    cefs: {
      panel: "#funds-cefs",
      moversPrefix: "cefs",
      config: () => config.funds?.cefs,
    },
  };

  const COMPANY_INDICATOR_CLASSES = [
    "market-movers__indicator--success",
    "market-movers__indicator--caution",
    "market-movers__indicator--warning",
    "market-movers__indicator--danger",
  ];

  /* ==========================================================================
     Generic Helpers
     ========================================================================== */

  function getPanel(selector) {
    return selector ? document.querySelector(selector) : null;
  }

  function normalizeIdentity(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase(common.getLocale());
  }

  function setBusyState(element, busy) {
    if (!element) {
      return;
    }

    element.setAttribute("aria-busy", String(Boolean(busy)));
  }

  function getMarketList(data, rootPath, listName) {
    const beans = common.getPath(data, rootPath, null);

    /*
     * `null` means the refresh payload did not provide a trustworthy source.
     * Callers must preserve the last good rendered list in that case.
     *
     * An actual empty array means the API explicitly returned an empty list
     * and may therefore render the component's empty state.
     */

    if (!Array.isArray(beans)) {
      return null;
    }

    for (const bean of beans) {
      if (
        !bean ||
        !Object.prototype.hasOwnProperty.call(bean, listName)
      ) {
        continue;
      }

      return Array.isArray(bean[listName])
        ? bean[listName]
        : null;
    }

    return null;
  }

  function getSymbol(item) {
    return String(
      common.firstDefined(
        item?.szSymbol,
        item?.symbol,
        item?.companySymbol,
        item?.companyRef,
      ) || "",
    ).trim();
  }

  function getCompanyName(item) {
    if (!item) {
      return "";
    }

    if (common.isArabic()) {
      return String(
        common.firstDefined(
          item.companyAr,
          item.companyNameAr,
          item.companyNameAR,
          item.issuerNameAr,
          item.issuerName,
          item.companyName,
          item.szCompany,
          item.companyEn,
          item.companyNameEn,
        ) || "",
      ).trim();
    }

    return String(
      common.firstDefined(
        item.companyEn,
        item.companyNameEn,
        item.companyNameEN,
        item.issuerNameEn,
        item.issuerName,
        item.companyName,
        item.szCompany,
        item.companyAr,
        item.companyNameAr,
      ) || "",
    ).trim();
  }

  function getLastPrice(item) {
    return common.firstDefined(
      item?.bdLastPrice,
      item?.lastTradedPrice,
      item?.lastTradePrice,
      item?.lastTradePriceModified,
      item?.closePrice,
    );
  }

  function getNetChange(item) {
    return common.firstDefined(
      item?.bdNetChange,
      item?.netChange,
      item?.change,
    );
  }

  function getPercentChange(item) {
    return common.firstDefined(
      item?.bdPercnetChange,
      item?.netPercentChange,
      item?.percentChange,
      item?.precentChange,
      item?.percentChangeDoubleModified,
    );
  }

  function getVolume(item) {
    return common.firstDefined(
      item?.bdVolume,
      item?.volumeTraded,
      item?.volume,
    );
  }

  function getTurnover(item) {
    return common.firstDefined(
      item?.bdTurnover,
      item?.turnover,
      item?.tradedValue,
      item?.valueTraded,
      item?.tradedValueModified,
    );
  }

  function getPanelMarketLabel(panel) {
    if (!panel) {
      return "";
    }

    /*
     * Nested Funds / Derivatives views are labelled by their own tab. This is
     * the cleanest source for labels such as REITs and ETFs.
     */

    if (panel.classList.contains("market-view-panel")) {
      const labelId = panel.getAttribute("aria-labelledby");
      const label = labelId ? document.getElementById(labelId) : null;

      if (label) {
        return String(label.textContent || "").trim();
      }
    }

    const marketPanel = panel.closest("[data-market-detail-panel]");
    const marketCode = marketPanel?.dataset.market;

    if (!marketCode) {
      return "";
    }

    const cardLabel = document.querySelector(
      `[data-market-card][data-market="${CSS.escape(marketCode)}"] .market-card__market`,
    );

    return String(cardLabel?.textContent || "").trim();
  }

  /* ==========================================================================
     Company Indicator
     ========================================================================== */

  function getCompanyIndicatorClass(status) {
    switch (String(status ?? "")) {
      case "1":
        return "market-movers__indicator--caution";

      case "2":
        return "market-movers__indicator--warning";

      case "3":
        return "market-movers__indicator--danger";

      default:
        return "";
    }
  }

  function updateCompanyIndicator(element, status) {
    if (!element) {
      return;
    }

    element.classList.remove(...COMPANY_INDICATOR_CLASSES);

    const className = getCompanyIndicatorClass(status);

    if (className) {
      element.classList.add(className);
    }
  }

  /* ==========================================================================
     Statistics
     ========================================================================== */

  function getStatItems(panel) {
    return panel
      ? Array.from(panel.querySelectorAll(".market-stats > .market-stats__item"))
      : [];
  }

  function getStatValueElement(item) {
    return item?.querySelector(".market-stats__value data") || null;
  }

  function updateStat(
    panel,
    index,
    rawValue,
    formattedValue,
    { priceState = false } = {},
  ) {
    const item = getStatItems(panel)[index];
    const valueElement = getStatValueElement(item);

    if (!item || !valueElement) {
      return;
    }

    const valueContainer = item.querySelector(".market-stats__value");

    common.setDataValue(valueElement, rawValue, formattedValue, {
      updateTarget: valueContainer || valueElement,
    });

    if (priceState && common.toNumber(rawValue) !== null) {
      common.applyPriceState(valueContainer, rawValue);
    }
  }

  function getMobileMetricValues(panel) {
    return panel
      ? Array.from(
          panel.querySelectorAll(
            ".market-details-panel__mobile-summary .market-details-panel__mobile-metric-value",
          ),
        )
      : [];
  }

  function updateMobileMetric(panel, index, rawValue, formattedValue) {
    const element = getMobileMetricValues(panel)[index];

    if (!element) {
      return;
    }

    common.setDataValue(element, rawValue, formattedValue);
  }

  function updateIndexMarketStats(data, marketKey) {
    const view = MARKET_VIEWS[marketKey];
    const marketConfig = view?.config();
    const details = marketConfig?.details;
    const stats = details?.stats;
    const panel = getPanel(view?.panel);

    if (!panel || !details || !stats) {
      return;
    }

    const summary = common.getPath(data, details.todaysSummary, {}) || {};
    const yearToDate = common.getPath(data, details.yearToDate, {}) || {};
    const marketBean = common.getPath(data, details.marketBean, {}) || {};

    const turnOver = summary[stats.turnOver];
    const volumeTraded = summary[stats.volumeTraded];

    const symbolsListed = common.getPath(data, stats.symbolsListed, null);
    const symbolsDown = marketBean[stats.symbolsDown];
    const symbolsUp = marketBean[stats.symbolsUp];

    const dailyChange = yearToDate[stats.dailyChange];
    const dailyPercentChange = yearToDate[stats.dailyPercentChange];

    updateStat(panel, 0, turnOver, common.formatDecimal(turnOver, 2));
    updateStat(panel, 1, volumeTraded, common.formatInteger(volumeTraded));

    /*
     * Statistic index 2 is Market Cap. The legacy implementation did not
     * actively refresh that field, so preserve the server-rendered value until
     * its live API contract is verified.
     */

    updateStat(panel, 3, symbolsListed, common.formatInteger(symbolsListed));
    updateStat(panel, 4, symbolsDown, common.formatInteger(symbolsDown));
    updateStat(panel, 5, symbolsUp, common.formatInteger(symbolsUp));

    updateStat(panel, 6, dailyChange, common.formatDecimal(dailyChange, 2), {
      priceState: true,
    });

    updateStat(
      panel,
      7,
      dailyPercentChange,
      common.formatPercent(dailyPercentChange, { decimals: 2 }),
      { priceState: true },
    );

    updateMobileMetric(panel, 0, turnOver, common.formatDecimal(turnOver, 2));
    updateMobileMetric(panel, 1, volumeTraded, common.formatInteger(volumeTraded));

    setBusyState(panel, false);
  }

  function getFundStatsSource(data, fundConfig) {
    if (!fundConfig?.statsSource) {
      return {};
    }

    return common.getPath(data, fundConfig.statsSource, {}) || {};
  }

  function getListedFunds(data, source, fieldName) {
    if (!fieldName) {
      return null;
    }

    return common.firstDefined(
      common.getPath(data, fieldName, null),
      source?.[fieldName],
    );
  }

  function updateFundStats(data, fundKey) {
    const view = FUND_VIEWS[fundKey];
    const fundConfig = view?.config();
    const panel = getPanel(view?.panel);
    const stats = fundConfig?.stats;

    if (!panel || !fundConfig || !stats) {
      return;
    }

    const source = getFundStatsSource(data, fundConfig);

    const turnOver = source[stats.turnOver];
    const volumeTraded = source[stats.volumeTraded];
    const listedFunds = getListedFunds(data, source, stats.listedFunds);

    updateStat(panel, 0, turnOver, common.formatDecimal(turnOver, 2));
    updateStat(panel, 1, volumeTraded, common.formatInteger(volumeTraded));

    /*
     * The legacy contract provides a listed-funds field but does not establish
     * reliable sources for every additional statistic in the new layouts
     * (for example Funds up/down). Those server-rendered values are therefore
     * preserved rather than guessed or overwritten with zero.
     */

    updateStat(panel, 2, listedFunds, common.formatInteger(listedFunds));

    updateMobileMetric(panel, 0, turnOver, common.formatDecimal(turnOver, 2));
    updateMobileMetric(panel, 1, volumeTraded, common.formatInteger(volumeTraded));

    setBusyState(panel, false);
  }

  /* ==========================================================================
     Movers — Row Creation
     ========================================================================== */

  function createMoverRow() {
    const row = document.createElement("li");
    const info = document.createElement("div");
    const link = document.createElement("a");
    const name = document.createElement("span");
    const indicator = document.createElement("span");
    const market = document.createElement("span");
    const numbers = document.createElement("div");
    const price = document.createElement("data");

    row.className = "market-movers__row";

    info.className = "market-movers__info";

    link.className = "market-movers__name";
    link.href = "#";

    name.className = "market-movers__company-name";

    indicator.className = "market-movers__indicator";
    indicator.setAttribute("aria-hidden", "true");

    market.className = "market-movers__market";

    numbers.className = "market-movers__numbers";

    price.className = "market-movers__price numeric";

    link.append(name, indicator);
    info.append(link, market);
    numbers.append(price);
    row.append(info, numbers);

    return row;
  }

  function ensureChangeValue(row) {
    const numbers = row.querySelector(".market-movers__numbers");

    if (!numbers) {
      return null;
    }

    let change = numbers.querySelector(".market-movers__change");

    if (!change) {
      change = document.createElement("span");
      change.className = "market-movers__change";
      numbers.append(change);
    }

    return change;
  }

  function ensureDirectionalChange(row) {
    const change = ensureChangeValue(row);

    if (!change) {
      return null;
    }

    change.classList.add("market-change");

    let icon = change.querySelector(".market-change__icon");
    let value = change.querySelector("data.numeric");

    if (!icon) {
      icon = document.createElement("span");
      icon.className = "market-change__icon";
      icon.setAttribute("aria-hidden", "true");
      change.prepend(icon);
    }

    if (!value) {
      const existingNumeric = change.querySelector(".numeric");

      if (existingNumeric && existingNumeric.tagName === "DATA") {
        value = existingNumeric;
      } else {
        if (existingNumeric) {
          existingNumeric.remove();
        }

        value = document.createElement("data");
        value.className = "numeric";
        change.append(value);
      }
    }

    return {
      container: change,
      value,
    };
  }

  function ensureSimpleMoverValue(row, mode) {
    const change = ensureChangeValue(row);

    if (!change) {
      return null;
    }

    change.classList.remove(
      "market-change",
      "price-up",
      "price-down",
      "price-neutral",
    );

    /*
     * Legacy/JSP volume rows already use the .market-movers__change element
     * itself as <data>. Reusing that node is important: appending another
     * <data> inside it duplicates the rendered volume.
     */

    if (change.tagName === "DATA") {
      change.querySelectorAll(".market-change__icon").forEach((icon) => {
        icon.remove();
      });

      return change;
    }

    const directionIcon = change.querySelector(
      ".market-change__icon:not(.icon-riyal)",
    );

    directionIcon?.remove();

    let value = change.querySelector("data.numeric, data");

    if (!value) {
      const existingNumeric = change.querySelector(".numeric");

      if (existingNumeric && existingNumeric.tagName === "DATA") {
        value = existingNumeric;
      } else {
        existingNumeric?.remove();

        value = document.createElement("data");
        value.className = "numeric";
        change.append(value);
      }
    }

    let riyal = change.querySelector(".icon-riyal");

    if (mode === "value") {
      if (!riyal) {
        riyal = document.createElement("span");
        riyal.className = "has-icon icon-riyal market-change__icon";
        riyal.setAttribute("aria-hidden", "true");
        change.prepend(riyal);
      }
    } else {
      riyal?.remove();
    }

    return value;
  }

  /* ==========================================================================
     Movers — Row Reconciliation
     ========================================================================== */

  function getExistingMoverRows(list) {
    const bySymbol = new Map();
    const byName = new Map();

    if (!list) {
      return { bySymbol, byName };
    }

    list.querySelectorAll(".market-movers__row").forEach((row) => {
      const symbol = String(row.dataset.marketSymbol || "").trim();

      const nameElement = row.querySelector(
        ".market-movers__company-name, .market-movers__name > span:not(.market-movers__indicator)",
      );

      const name = normalizeIdentity(nameElement?.textContent);

      if (symbol) {
        bySymbol.set(symbol, row);
      }

      if (name) {
        byName.set(name, row);
      }
    });

    return { bySymbol, byName };
  }

  function getMoverPanel(prefix, listKey) {
    return document.getElementById(`${prefix}-${listKey}`);
  }

  function ensureMoverList(panel) {
    if (!panel) {
      return null;
    }

    let list = panel.querySelector(".market-movers__list");

    if (!list) {
      list = document.createElement("ul");
      list.className = "market-movers__list";
      panel.append(list);
    }

    panel.querySelectorAll(".market-movers__empty").forEach((empty) => {
      empty.remove();
    });

    return list;
  }

  function renderMoverEmpty(panel, message) {
    if (!panel) {
      return;
    }

    panel.querySelector(".market-movers__list")?.remove();

    let empty = panel.querySelector(".market-movers__empty");

    if (!empty) {
      empty = document.createElement("p");
      empty.className = "market-movers__empty";
      panel.append(empty);
    }

    empty.textContent = message;
  }

  function updateMoverIdentity(row, item, panel, companyDomain) {
    const symbol = getSymbol(item);
    const companyName = getCompanyName(item);

    const link = row.querySelector(".market-movers__name");

    let name = row.querySelector(".market-movers__company-name");

    if (!name && link) {
      name = link.querySelector("span:not(.market-movers__indicator)");

      if (name) {
        name.classList.add("market-movers__company-name");
      }
    }

    const indicator = row.querySelector(".market-movers__indicator");
    const market = row.querySelector(".market-movers__market");

    if (symbol) {
      row.dataset.marketSymbol = symbol;
    }

    if (name && companyName) {
      common.setText(name, companyName);
    }

    if (link && symbol) {
      const href = common.buildCompanyUrl(companyDomain, symbol);

      if (href) {
        link.href = href;
      }
    }

    updateCompanyIndicator(indicator, item?.companyStatus);

    if (market) {
      common.setText(market, getPanelMarketLabel(panel));
    }
  }

  function updateMoverPrice(row, item) {
    const price = row.querySelector(".market-movers__price");
    const rawPrice = getLastPrice(item);

    if (!price) {
      return;
    }

    common.setDataValue(
      price,
      rawPrice,
      common.formatDecimal(rawPrice, 2),
    );
  }

  function formatMoverChange(
    netChange,
    percentChange,
    { percentOnly = false } = {},
  ) {
    const net = common.toNumber(netChange);
    const percent = common.toNumber(percentChange);

    if (percentOnly) {
      return percent === null
        ? null
        : common.formatPercent(percent, { decimals: 2 });
    }

    if (net === null && percent === null) {
      return null;
    }

    if (net === null) {
      return common.formatPercent(percent, { decimals: 2 });
    }

    if (percent === null) {
      return common.formatDecimal(net, 2);
    }

    return `${common.formatDecimal(net, 2)} (${common.formatPercent(percent, {
      decimals: 2,
    })})`;
  }

  function updateMoverChange(row, item, { percentOnly = false } = {}) {
    const parts = ensureDirectionalChange(row);

    if (!parts) {
      return;
    }

    const netChange = getNetChange(item);
    const percentChange = getPercentChange(item);

    const stateValue = common.firstDefined(percentChange, netChange);

    const updateValue = percentOnly
      ? percentChange
      : common.firstDefined(netChange, percentChange);

    const formatted = formatMoverChange(netChange, percentChange, {
      percentOnly,
    });

    if (formatted !== null) {
      common.setDataValue(parts.value, updateValue, formatted, {
        updateTarget: parts.container,
      });
    }

    if (common.toNumber(stateValue) !== null) {
      common.applyPriceState(parts.container, stateValue);
    }
  }

  function updateMoverVolume(row, item) {
    const value = ensureSimpleMoverValue(row, "volume");
    const rawValue = getVolume(item);

    if (!value) {
      return;
    }

    common.setDataValue(
      value,
      rawValue,
      common.formatInteger(rawValue),
    );
  }

  function updateMoverTurnover(row, item) {
    const value = ensureSimpleMoverValue(row, "value");
    const rawValue = getTurnover(item);

    if (!value) {
      return;
    }

    common.setDataValue(
      value,
      rawValue,
      common.formatDecimal(rawValue, 2),
    );
  }

  function updateMoverRow(
    row,
    item,
    mode,
    panel,
    companyDomain,
    { percentOnly = false } = {},
  ) {
    updateMoverIdentity(row, item, panel, companyDomain);
    updateMoverPrice(row, item);

    if (mode === "change") {
      updateMoverChange(row, item, { percentOnly });
      return;
    }

    if (mode === "volume") {
      updateMoverVolume(row, item);
      return;
    }

    if (mode === "value") {
      updateMoverTurnover(row, item);
    }
  }

  function reconcileMoverPanel(
    panel,
    items,
    mode,
    companyDomain,
    options = {},
  ) {
    if (!panel || !Array.isArray(items)) {
      return;
    }

    const visibleItems = items
      .filter((item) => {
        if (mode === "volume") {
          const value = common.toNumber(getVolume(item));

          return value === null || value !== 0;
        }

        if (mode === "value") {
          const value = common.toNumber(getTurnover(item));

          return value === null || value !== 0;
        }

        return true;
      })
      .slice(0, 5);

    if (visibleItems.length === 0) {
      renderMoverEmpty(
        panel,
        options.emptyMessage || "Data is currently unavailable.",
      );

      return;
    }

    const list = ensureMoverList(panel);
    const existing = getExistingMoverRows(list);
    const usedRows = new Set();

    visibleItems.forEach((item) => {
      const symbol = getSymbol(item);
      const nameKey = normalizeIdentity(getCompanyName(item));

      let row =
        (symbol && existing.bySymbol.get(symbol)) ||
        (nameKey && existing.byName.get(nameKey)) ||
        null;

      if (!row) {
        row = createMoverRow();
      }

      updateMoverRow(
        row,
        item,
        mode,
        panel,
        companyDomain,
        options,
      );

      usedRows.add(row);
      list.append(row);
    });

    list.querySelectorAll(".market-movers__row").forEach((row) => {
      if (!usedRows.has(row)) {
        row.remove();
      }
    });
  }

  function updateMovers(data, view, marketConfig, options = {}) {
    const details = marketConfig?.details || marketConfig;
    const activeResults = details?.activeResults;
    const companyDomain = details?.companyDomain;

    if (!view || !activeResults) {
      return;
    }

    const groups = [
      ["gainers", "change"],
      ["losers", "change"],
      ["volume", "volume"],
      ["value", "value"],
    ];

    groups.forEach(([listKey, mode]) => {
      const panel = getMoverPanel(view.moversPrefix, listKey);
      const items = getMarketList(data, activeResults, listKey);

      /*
       * Missing list data is treated as a partial refresh, not as an empty
       * market. Keep the last good DOM until the API supplies this list again.
       */

      if (items === null) {
        return;
      }

      reconcileMoverPanel(panel, items, mode, companyDomain, {
        ...options,

        emptyMessage:
          mode === "volume"
            ? "Volume data is currently unavailable."
            : mode === "value"
              ? "Value data is currently unavailable."
              : "Market mover data is currently unavailable.",
      });
    });
  }
    /* ==========================================================================
     Funds Watch Tables
     ========================================================================== */

  function getTableRowsByIdentity(tbody) {
    const bySymbol = new Map();
    const byName = new Map();

    tbody?.querySelectorAll("tr").forEach((row) => {
      const symbol = String(row.dataset.marketSymbol || "").trim();

      const name = normalizeIdentity(
        row.querySelector("th a, td a")?.textContent,
      );

      if (symbol) {
        bySymbol.set(symbol, row);
      }

      if (name) {
        byName.set(name, row);
      }
    });

    return { bySymbol, byName };
  }

  function createWatchRow(columnCount = 4) {
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    const link = document.createElement("a");

    heading.scope = "row";
    heading.append(link);
    row.append(heading);

    for (let index = 1; index < columnCount; index += 1) {
      const cell = document.createElement("td");
      cell.className = index === 2 ? "numeric market-change" : "numeric";
      row.append(cell);
    }

    return row;
  }

  function ensureCellData(cell) {
    if (!cell) {
      return null;
    }

    let value = cell.querySelector("data");

    if (!value) {
      value = document.createElement("data");
      value.className = "numeric";
      cell.append(value);
    }

    return value;
  }

  function normalizePercentCell(cell, directional) {
    if (!cell) {
      return null;
    }

    const dataElements = Array.from(cell.querySelectorAll("data"));

    let value =
      dataElements.find((element) => element.parentElement === cell) ||
      dataElements[0] ||
      null;

    if (!value) {
      value = document.createElement("data");
      value.className = "numeric";
    }

    if (value.parentElement !== cell) {
      cell.append(value);
    }

    dataElements.forEach((element) => {
      if (element !== value) {
        element.remove();
      }
    });

    cell.querySelectorAll(".market-change").forEach((element) => {
      if (element !== cell) {
        element.remove();
      }
    });

    cell.querySelectorAll(".market-change__icon").forEach((icon) => {
      icon.remove();
    });

    common.clearPriceState(cell);

    if (!directional) {
      cell.classList.remove("market-change");

      return {
        container: cell,
        value,
      };
    }

    cell.classList.add("market-change");

    const icon = document.createElement("span");
    icon.className = "market-change__icon";
    icon.setAttribute("aria-hidden", "true");
    cell.insertBefore(icon, value);

    return {
      container: cell,
      value,
    };
  }

  function updateWatchIdentity(row, item, domainKey) {
    const symbol = getSymbol(item);
    const name = getCompanyName(item);

    const link = row.querySelector("th a, td a");

    if (symbol) {
      row.dataset.marketSymbol = symbol;
    }

    if (link && name) {
      common.setText(link, name);
    }

    if (link && symbol) {
      const href = common.buildCompanyUrl(domainKey, symbol);

      if (href) {
        link.href = href;
      }
    }
  }

  function updateWatchPrice(row, item) {
    const cell = row.cells[1];
    const value = ensureCellData(cell);
    const rawValue = getLastPrice(item);

    if (!value) {
      return;
    }

    common.setDataValue(
      value,
      rawValue,
      common.formatDecimal(rawValue, 2),
    );
  }

  function getWatchPercentValue(item, fundKey) {
    if (fundKey === "etfs") {
      return common.firstDefined(
        item?.percentChangeDoubleModified,
        item?.precentChange,
        item?.unformatedPrecentChange,
        item?.percentChange,
      );
    }

    if (fundKey === "cefs") {
      return common.firstDefined(
        item?.unformatedPrecentChange,
        item?.precentChange,
        item?.percentChangeDoubleModified,
        item?.percentChange,
      );
    }

    return getPercentChange(item);
  }

  function updateWatchPercent(row, item, fundKey) {
    const cell = row.cells[2];
    const rawValue = getWatchPercentValue(item, fundKey);
    const numericValue = common.toNumber(rawValue);

    if (!cell || numericValue === null) {
      return;
    }

    /*
     * Zero-change rows in the JSP are plain numeric cells. Normalize the
     * existing cell instead of appending a second change component; otherwise
     * values such as "0.0%" and "0.00%" are rendered side-by-side.
     */

    const parts = normalizePercentCell(cell, numericValue !== 0);

    if (!parts) {
      return;
    }

    common.setDataValue(
      parts.value,
      numericValue,
      common.formatPercent(numericValue, { decimals: 2 }),
      {
        updateTarget: parts.container,
      },
    );

    if (numericValue !== 0) {
      common.applyPriceState(parts.container, numericValue);
    }
  }

  function updateWatchInav(row, item, cellIndex) {
    const cell = row.cells[cellIndex];
    const rawValue = common.firstDefined(
      item?.INAV,
      item?.INAVModified,
    );

    const numericValue = common.toNumber(rawValue);

    if (!cell || numericValue === null) {
      return;
    }

    cell.querySelectorAll(".icon-riyal").forEach((icon) => {
      icon.remove();
    });

    const value = ensureCellData(cell);

    if (!value) {
      return;
    }

    common.setDataValue(
      value,
      numericValue,
      numericValue === 0
        ? "-"
        : common.formatDecimal(numericValue, 2),
    );
  }

  function updateWatchVolume(row, item, cellIndex) {
    const rawValue = common.firstDefined(
      item?.volumeTraded,
      item?.volume,
      item?.bdVolume,
    );

    const numericValue = common.toNumber(rawValue);

    if (numericValue === null) {
      return;
    }

    const cell = row.cells[cellIndex];

    if (!cell) {
      return;
    }

    cell.querySelectorAll(".icon-riyal").forEach((icon) => {
      icon.remove();
    });

    const value = ensureCellData(cell);

    if (!value) {
      return;
    }

    common.setDataValue(
      value,
      numericValue,
      common.formatDecimal(numericValue, 2),
    );
  }

  function reconcileWatchTable(data, fundKey) {
    const view = FUND_VIEWS[fundKey];
    const fundConfig = view?.config();
    const panel = getPanel(view?.panel);
    const sourcePath = fundConfig?.watchSource;

    if (!panel || !sourcePath) {
      return;
    }

    const list = common.getPath(data, sourcePath, null);

    if (!Array.isArray(list)) {
      return;
    }

    const tbody = panel.querySelector("table tbody");

    if (!tbody) {
      return;
    }

    /*
     * Current JSP contract:
     *
     * ETF: Fund | Price | Change | INAV
     * CEF: Fund | Price | Change | Volume
     */

    const columnCount = 4;
    const existing = getTableRowsByIdentity(tbody);
    const usedRows = new Set();

    list.forEach((item) => {
      const symbol = getSymbol(item);
      const nameKey = normalizeIdentity(getCompanyName(item));

      let row =
        (symbol && existing.bySymbol.get(symbol)) ||
        (nameKey && existing.byName.get(nameKey)) ||
        null;

      if (!row) {
        row = createWatchRow(columnCount);
      }

      updateWatchIdentity(
        row,
        item,
        fundConfig.companyDomain,
      );

      updateWatchPrice(row, item);
      updateWatchPercent(row, item, fundKey);

      if (fundKey === "etfs") {
        updateWatchInav(row, item, 3);
      } else if (fundKey === "cefs") {
        updateWatchVolume(row, item, 3);
      }

      usedRows.add(row);
      tbody.append(row);
    });

    tbody.querySelectorAll("tr").forEach((row) => {
      if (!usedRows.has(row)) {
        row.remove();
      }
    });
  }

  /* ==========================================================================
     Derivatives — MT30
     ========================================================================== */

  function getObjectAtPath(data, path) {
    const value = common.getPath(data, path, null);

    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : null;
  }

  function getMt30IndexItem(data) {
    const indices = common.getPath(data, "indicesList", null);

    if (!Array.isArray(indices)) {
      return null;
    }

    return (
      indices.find((item) => {
        const symbol = String(
          common.firstDefined(
            item?.symbol,
            item?.szSymbol,
            item?.indexSymbol,
            item?.code,
          ) || "",
        )
          .trim()
          .toUpperCase();

        return symbol === "MT30" || symbol.includes("MT30");
      }) || null
    );
  }

  function getMt30Sources(data) {
    return [
      getObjectAtPath(data, "mt30Bean.tasiTodaysSummaryBean"),
      getObjectAtPath(data, "mt30IndicesBean.tasiTodaysSummaryBean"),
      getObjectAtPath(data, "mt30IndexBean.tasiTodaysSummaryBean"),
      getObjectAtPath(data, "timt30Info.tasiTodaysSummaryBean"),
      getObjectAtPath(data, "TIMT30Info.tasiTodaysSummaryBean"),
      getObjectAtPath(data, "mt30Info.tasiTodaysSummaryBean"),
      getMt30IndexItem(data),
    ].filter(Boolean);
  }

  function getFirstNumericField(sources, fieldNames) {
    let zeroValue = null;

    for (const source of sources) {
      for (const fieldName of fieldNames) {
        if (!Object.prototype.hasOwnProperty.call(source, fieldName)) {
          continue;
        }

        const numericValue = common.toNumber(source[fieldName]);

        if (numericValue === null) {
          continue;
        }

        if (numericValue !== 0) {
          return numericValue;
        }

        zeroValue = 0;
      }
    }

    return zeroValue;
  }

  function updateMt30Metric(element, rawValue) {
    if (!element || rawValue === null) {
      return;
    }

    const previousValue = common.readElementRawValue(element);

    /*
     * Do not replace a valid SSR/live value with a zero placeholder.
     * A non-zero API value will still replace an SSR 0.00 immediately.
     */

    if (
      rawValue === 0 &&
      previousValue !== null &&
      previousValue !== 0
    ) {
      return;
    }

    common.setDataValue(
      element,
      rawValue,
      common.formatDecimal(rawValue, 2),
    );
  }

  function updateMt30(data) {
    const panel = getPanel("#derivatives-mt30");

    if (!panel) {
      return;
    }

    const sources = getMt30Sources(data);

    const directOpenPrice = getFirstNumericField(
      [data],
      [
        "mt30OpenPrice",
        "mt30IndexOpenPrice",
        "mt30Open",
      ],
    );

    const nestedOpenPrice = getFirstNumericField(
      sources,
      [
        "openPrice",
        "open",
      ],
    );

    const openPrice = getFirstNumericField(
      [
        { value: directOpenPrice },
        { value: nestedOpenPrice },
      ],
      ["value"],
    );

    const directPreviousClose = getFirstNumericField(
      [data],
      [
        "mt30PreviousClose",
        "mt30PrevClose",
        "mt30PreviousIndexPrice",
        "mt30PreviouseIndexPrice",
        "mt30IndexPreviousClose",
      ],
    );

    const nestedPreviousClose = getFirstNumericField(
      sources,
      [
        "previouseIndexPrice",
        "previousIndexPrice",
        "previousClose",
        "prevClose",
      ],
    );

    const previousClose = getFirstNumericField(
      [
        { value: directPreviousClose },
        { value: nestedPreviousClose },
      ],
      ["value"],
    );

    const mobileValues = getMobileMetricValues(panel);
    const statItems = getStatItems(panel);

    updateMt30Metric(mobileValues[0], openPrice);
    updateMt30Metric(mobileValues[1], previousClose);

    updateMt30Metric(
      getStatValueElement(statItems[0]),
      openPrice,
    );

    updateMt30Metric(
      getStatValueElement(statItems[1]),
      previousClose,
    );

    if (
      openPrice !== null ||
      previousClose !== null
    ) {
      setBusyState(panel, false);
    }
  }

  /* ==========================================================================
     Market Updates
     ========================================================================== */

  function updateMarket(data, marketKey) {
    const view = MARKET_VIEWS[marketKey];
    const marketConfig = view?.config();

    if (!view || !marketConfig) {
      return;
    }

    updateIndexMarketStats(data, marketKey);
    updateMovers(data, view, marketConfig);
  }

  function updateFunds(data) {
    Object.keys(FUND_VIEWS).forEach((fundKey) => {
      updateFundStats(data, fundKey);
    });

    updateMovers(
      data,
      FUND_VIEWS.reits,
      config.funds?.reits || {},
    );

    updateMovers(
      data,
      FUND_VIEWS.etfs,
      config.funds?.etfs || {},
      {
        percentOnly: true,
      },
    );

    reconcileWatchTable(data, "etfs");
    reconcileWatchTable(data, "cefs");
  }

  function update(data) {
    if (!data || typeof data !== "object") {
      return;
    }

    updateMarket(data, "tasi");
    updateMarket(data, "nomu");
    updateMarket(data, "sukuk");

    updateFunds(data);
    updateMt30(data);

    /*
     * The Derivatives dashboard tables remain server-rendered because the
     * supplied legacy refresh contract does not define live table mappings.
     */
  }

  /* ==========================================================================
     Public API
     ========================================================================== */

  window.MarketHomeDetails = Object.freeze({
    update,

    updateTasi(data) {
      updateMarket(data, "tasi");
    },

    updateNomu(data) {
      updateMarket(data, "nomu");
    },

    updateSukuk(data) {
      updateMarket(data, "sukuk");
    },

    updateFunds,
    updateMt30,
  });
})(window, document);
======
/* ==========================================================================
   Market Overview — Refresh Controller
   ========================================================================== */

(function (window, document, $) {
  "use strict";

  const config = window.marketConfig || {};
  const common = window.MarketCommon;

  if (!common) {
    return;
  }

  let root = null;

  function getRoot() {
    if (!root || !root.isConnected) {
      root = document.querySelector("[data-market-overview]");
    }

    return root;
  }

  /* ==========================================================================
     Constants
     ========================================================================== */

  const MARKET_KEYS = [
    "tasi",
    "nomu",
    "sukuk",
    "funds",
    "derivatives",
  ];

  const MARKET_STATUS_CLASSES = [
    "market-status--open",
    "market-status--closed",
    "market-status--pre-open",
    "market-status--auction",
    "market-status--halted",
  ];

  const DEFAULT_REFRESH_INTERVAL = 30000;

  /* ==========================================================================
     Runtime State
     ========================================================================== */

  const state = {
    started: false,
    generation: 0,

    refreshPromise: null,
    fallbackTimer: null,
    countdownTimer: null,
    countdownRefreshQueued: false,

    abortControllers: new Set(),

    timingByMarket: new Map(),
    timingSignatures: new Map(),
    expiredTimerKeys: new Set(),

    lastMarketData: null,
    lastTimingData: null,
  };

  /* ==========================================================================
     Market / Card Access
     ========================================================================== */

  function getMarketConfig(marketKey) {
    return config.markets?.[marketKey] || null;
  }

  function getCard(marketKey) {
    const marketCode = getMarketConfig(marketKey)?.code;
    const currentRoot = getRoot();

    if (!marketCode || !currentRoot) {
      return null;
    }

    return currentRoot.querySelector(
      `[data-market-card][data-market="${CSS.escape(String(marketCode))}"]`,
    );
  }

  function getCardParts(card) {
    if (!card) {
      return {};
    }

    return {
      status: card.querySelector(".market-status"),
      statusLabel: card.querySelector(".market-card__status"),
      value: card.querySelector(".market-card__value"),
      change: card.querySelector(".market-card__change"),
      changeValue: card.querySelector(".market-change__value"),
      timer: card.querySelector("[data-market-countdown]"),
    };
  }

  /* ==========================================================================
     Generic Helpers
     ========================================================================== */

  function emit(name, detail = {}) {
    const currentRoot = getRoot();

    if (!currentRoot) {
      return;
    }

    currentRoot.dispatchEvent(
      new CustomEvent(name, {
        detail,
      }),
    );
  }

  function normalizeStatus(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
  }

  function extractFirstNumber(text) {
    const match = String(text || "")
      .replace(/\u2212/g, "-")
      .match(
        /[-+]?\s*[\d٠-٩۰-۹][\d٠-٩۰-۹.,٬٫\s]*/,
      );

    return match ? common.toNumber(match[0]) : null;
  }

  function seedRawValueFromText(element) {
    if (!element) {
      return;
    }

    if (common.readElementRawValue(element) !== null) {
      return;
    }

    const value = extractFirstNumber(element.textContent);

    if (value !== null) {
      element.dataset.marketRawValue = String(value);
    }
  }

  function getRefreshInterval() {
    const interval = common.toInteger(
      config.refresh?.fallbackInterval,
      DEFAULT_REFRESH_INTERVAL,
    );

    return Math.max(1000, interval || DEFAULT_REFRESH_INTERVAL);
  }

  /* ==========================================================================
     Summary Cards — Values
     ========================================================================== */

  function formatCardChange(netChange, percentChange) {
    const net = common.toNumber(netChange);
    const percent = common.toNumber(percentChange);

    if (net === null && percent === null) {
      return null;
    }

    if (net === null) {
      return common.formatPercent(percent, {
        decimals: 2,
        signed: true,
      });
    }

    if (percent === null) {
      return common.formatSignedNumber(net, 2);
    }

    return `${common.formatSignedNumber(net, 2)} ${common.formatPercent(
      percent,
      {
        decimals: 2,
        signed: true,
        parentheses: true,
      },
    )}`;
  }

  function updateCardStatusCode(card, statusCode) {
    if (
      !card ||
      statusCode === null ||
      statusCode === undefined ||
      statusCode === ""
    ) {
      return;
    }

    card.dataset.marketStatusCode = String(statusCode);
  }

  function updateCard(marketKey, marketData) {
    const marketConfig = getMarketConfig(marketKey);
    const summary = marketConfig?.summary;
    const card = getCard(marketKey);

    if (!summary || !card) {
      return;
    }

    const parts = getCardParts(card);

    const statusCode = summary.statusCode
      ? common.getPath(marketData, summary.statusCode, null)
      : null;

    updateCardStatusCode(card, statusCode);

    if (summary.value && parts.value) {
      const rawValue = common.getPath(
        marketData,
        summary.value,
        null,
      );

      common.setDataValue(
        parts.value,
        rawValue,
        common.formatDecimal(rawValue, 2),
      );
    }

    if (
      !parts.change ||
      !parts.changeValue ||
      (!summary.netChange && !summary.percentChange)
    ) {
      return;
    }

    const netChange = summary.netChange
      ? common.getPath(marketData, summary.netChange, null)
      : null;

    const percentChange = summary.percentChange
      ? common.getPath(
          marketData,
          summary.percentChange,
          null,
        )
      : null;

    const formattedChange = formatCardChange(
      netChange,
      percentChange,
    );

    if (formattedChange === null) {
      return;
    }

    const stateValue = common.firstDefined(
      netChange,
      percentChange,
    );

    seedRawValueFromText(parts.changeValue);

    common.setDataValue(
      parts.changeValue,
      stateValue,
      formattedChange,
      {
        updateTarget: parts.change,
      },
    );

    if (common.toNumber(stateValue) !== null) {
      common.applyPriceState(
        parts.change,
        stateValue,
      );
    }
  }

  function updateCards(marketData) {
    if (!marketData || typeof marketData !== "object") {
      return;
    }

    MARKET_KEYS.forEach((marketKey) => {
      updateCard(marketKey, marketData);
    });
  }

  /* ==========================================================================
     Summary Cards — Session Status
     ========================================================================== */

  function getStatusPresentation(status) {
    const normalized = normalizeStatus(status);

    if (!normalized) {
      return null;
    }

    if (
      normalized === "OPEN" ||
      normalized === "TRADING" ||
      normalized === "CONTINUOUS_TRADING"
    ) {
      return {
        state: "open",
        className: "market-status--open",
        label: "Open",
      };
    }

    if (
      normalized === "PREOPEN" ||
      normalized === "PRE_OPEN" ||
      normalized === "PRE_OPENING"
    ) {
      return {
        state: "pre-open",
        className: "market-status--pre-open",
        label: "Pre-open",
      };
    }

    if (normalized.includes("AUCTION")) {
      return {
        state: "auction",
        className: "market-status--auction",
        label: "Auction",
      };
    }

    if (
      normalized.includes("HALT") ||
      normalized.includes("SUSPEND")
    ) {
      return {
        state: "halted",
        className: "market-status--halted",
        label: normalized.includes("SUSPEND")
          ? "Suspended"
          : "Halted",
      };
    }

    if (
      normalized === "CLOSED" ||
      normalized === "CLOSE" ||
      normalized === "POST_CLOSE" ||
      normalized === "POST_CLOSING"
    ) {
      return {
        state: "closed",
        className: "market-status--closed",
        label: "Closed",
      };
    }

    return null;
  }

  function getExplicitStatusLabel(timingItem) {
    return common.firstDefined(
      timingItem?.statusLabel,
      timingItem?.statusName,
      timingItem?.localizedStatus,
      timingItem?.statusDescription,
    );
  }

  function updateCardSessionStatus(marketKey, timingItem) {
    const card = getCard(marketKey);

    if (!card || !timingItem) {
      return;
    }

    const parts = getCardParts(card);
    const presentation = getStatusPresentation(
      timingItem.status,
    );

    if (!presentation) {
      return;
    }

    card.dataset.marketSession = presentation.state;

    if (parts.status) {
      parts.status.classList.remove(
        ...MARKET_STATUS_CLASSES,
      );

      parts.status.classList.add(
        presentation.className,
      );
    }

    if (parts.statusLabel) {
      const explicitLabel =
        getExplicitStatusLabel(timingItem);

      /*
       * On Arabic pages, preserve the server-rendered localized label unless
       * the timing service explicitly supplies one. This avoids replacing a
       * localized label with an inferred English string.
       */

      if (explicitLabel) {
        common.setText(
          parts.statusLabel,
          explicitLabel,
        );
      } else if (!common.isArabic()) {
        common.setText(
          parts.statusLabel,
          presentation.label,
        );
      }
    }
  }

  /* ==========================================================================
     Countdown Labels
     ========================================================================== */

  function getCountdownPrefix(timingItem) {
    const explicit = common.firstDefined(
      timingItem?.timerLabel,
      timingItem?.nextEventLabel,
    );

    if (explicit) {
      const text = String(explicit).trim();

      return text ? `${text} ` : "";
    }

    const normalized = normalizeStatus(
      timingItem?.status,
    );

    if (common.isArabic()) {
      if (normalized.includes("AUCTION")) {
        return "ينتهي المزاد خلال ";
      }

      if (
        normalized === "OPEN" ||
        normalized === "TRADING" ||
        normalized === "CONTINUOUS_TRADING"
      ) {
        return "يغلق خلال ";
      }

      return "يفتح خلال ";
    }

    if (normalized.includes("AUCTION")) {
      return "Auction ends in ";
    }

    if (
      normalized === "OPEN" ||
      normalized === "TRADING" ||
      normalized === "CONTINUOUS_TRADING"
    ) {
      return "Closes in ";
    }

    return "Opens in ";
  }

  function getEndedTimerLabel() {
    return common.isArabic()
      ? "بانتظار التحديث"
      : "Awaiting update";
  }
    /* ==========================================================================
     Countdown Rendering
     ========================================================================== */

  function getTimingSignature(timingItem) {
    const timer = timingItem?.nextEventTimer;

    if (!timer) {
      return "";
    }

    return JSON.stringify({
      status: normalizeStatus(timingItem.status),
      date: timer.date || null,
      time: timer.time || null,
    });
  }

  function renderCountdown(
    marketKey,
    timingItem,
    {
      allowExpiryRefresh = false,
    } = {},
  ) {
    const card = getCard(marketKey);
    const timerElement = getCardParts(card).timer;

    if (!timerElement || !timingItem) {
      return;
    }

    const seconds = common.getRemainingSeconds(
      timingItem.nextEventTimer,
    );

    if (seconds === null) {
      return;
    }

    timerElement.classList.toggle(
      "timer-warning",
      seconds > 0 && seconds <= 10,
    );

    timerElement.classList.toggle(
      "timer-ended",
      seconds <= 0,
    );

    timerElement.setAttribute(
      "datetime",
      common.toIsoDuration(seconds),
    );

    if (seconds <= 0) {
      timerElement.textContent =
        getEndedTimerLabel();

      if (
        allowExpiryRefresh &&
        !state.expiredTimerKeys.has(marketKey)
      ) {
        state.expiredTimerKeys.add(marketKey);
        queueRefreshFromCountdown();
      }

      return;
    }

    state.expiredTimerKeys.delete(marketKey);

    timerElement.textContent =
      getCountdownPrefix(timingItem) +
      common.formatTimer(seconds);
  }

  function renderAllCountdowns({
    allowExpiryRefresh = false,
  } = {}) {
    state.timingByMarket.forEach(
      (timingItem, marketKey) => {
        renderCountdown(
          marketKey,
          timingItem,
          {
            allowExpiryRefresh,
          },
        );
      },
    );
  }

  function clearCountdownTimer() {
    if (!state.countdownTimer) {
      return;
    }

    window.clearInterval(
      state.countdownTimer,
    );

    state.countdownTimer = null;
  }

  function startCountdownTimer() {
    clearCountdownTimer();

    if (
      !state.started ||
      document.hidden ||
      state.timingByMarket.size === 0
    ) {
      return;
    }

    state.countdownTimer =
      window.setInterval(() => {
        renderAllCountdowns({
          allowExpiryRefresh: true,
        });
      }, 1000);
  }

  /* ==========================================================================
     Timing Response
     ========================================================================== */

  function updateTimers(timingData) {
    if (!Array.isArray(timingData)) {
      return;
    }

    const nextTiming = new Map();
    const seenKeys = new Set();

    timingData.forEach((timingItem) => {
      if (!timingItem) {
        return;
      }

      const marketCode = String(
        timingItem.marketCode || "",
      )
        .trim()
        .toUpperCase();

      const marketKeys =
        config.timing?.marketCodes?.[
          marketCode
        ];

      if (!Array.isArray(marketKeys)) {
        return;
      }

      marketKeys.forEach((marketKey) => {
        if (!getMarketConfig(marketKey)) {
          return;
        }

        seenKeys.add(marketKey);

        nextTiming.set(
          marketKey,
          timingItem,
        );

        const nextSignature =
          getTimingSignature(timingItem);

        const previousSignature =
          state.timingSignatures.get(
            marketKey,
          );

        if (
          nextSignature !==
          previousSignature
        ) {
          state.expiredTimerKeys.delete(
            marketKey,
          );

          state.timingSignatures.set(
            marketKey,
            nextSignature,
          );
        }

        updateCardSessionStatus(
          marketKey,
          timingItem,
        );

        renderCountdown(
          marketKey,
          timingItem,
          {
            allowExpiryRefresh: false,
          },
        );
      });
    });

    state.timingByMarket.forEach(
      (_timingItem, marketKey) => {
        if (!seenKeys.has(marketKey)) {
          state.timingSignatures.delete(
            marketKey,
          );

          state.expiredTimerKeys.delete(
            marketKey,
          );
        }
      },
    );

    state.timingByMarket = nextTiming;

    startCountdownTimer();
  }

  /* ==========================================================================
     Requests
     ========================================================================== */

  function createAbortController() {
    if (!("AbortController" in window)) {
      return null;
    }

    const controller =
      new AbortController();

    state.abortControllers.add(
      controller,
    );

    return controller;
  }

  function releaseAbortController(
    controller,
  ) {
    if (controller) {
      state.abortControllers.delete(
        controller,
      );
    }
  }

  async function fetchJson(
    url,
    controller,
  ) {
    if (!url) {
      throw new Error(
        "Market endpoint is not configured.",
      );
    }

    const response = await window.fetch(
      url,
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",

        headers: {
          Accept: "application/json",
        },

        signal: controller?.signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Market request failed with HTTP ${response.status}.`,
      );
    }

    return response.json();
  }

  function isAbortError(error) {
    return error?.name === "AbortError";
  }

  function reportRequestError(
    source,
    error,
  ) {
    if (isAbortError(error)) {
      return;
    }

    emit("marketoverview:error", {
      source,
      error,
    });

    if (
      window.console &&
      typeof window.console.warn ===
        "function"
    ) {
      window.console.warn(
        `[Market Overview] ${source} refresh failed.`,
        error,
      );
    }
  }

  /* ==========================================================================
     Market Data Request
     ========================================================================== */

  async function refreshMarketData(
    generation,
  ) {
    const controller =
      createAbortController();

    try {
      const data = await fetchJson(
        config.endpoints?.marketData,
        controller,
      );

      if (
        generation !== state.generation
      ) {
        return null;
      }

      state.lastMarketData = data;

      updateCards(data);

      if (
        window.MarketHomeDetails &&
        typeof window.MarketHomeDetails
          .update === "function"
      ) {
        window.MarketHomeDetails.update(
          data,
        );
      }

      emit("marketoverview:data", {
        data,
      });

      return data;
    } catch (error) {
      reportRequestError(
        "market-data",
        error,
      );

      throw error;
    } finally {
      releaseAbortController(
        controller,
      );
    }
  }

  /* ==========================================================================
     Timing Request
     ========================================================================== */

  async function refreshTimingData(
    generation,
  ) {
    const controller =
      createAbortController();

    try {
      const data = await fetchJson(
        config.endpoints?.timing,
        controller,
      );

      if (
        generation !== state.generation
      ) {
        return null;
      }

      state.lastTimingData = data;

      updateTimers(data);

      emit("marketoverview:timing", {
        data,
      });

      return data;
    } catch (error) {
      reportRequestError(
        "timing",
        error,
      );

      throw error;
    } finally {
      releaseAbortController(
        controller,
      );
    }
  }

  /* ==========================================================================
     Main Refresh
     ========================================================================== */

  function refreshNow() {
    if (state.refreshPromise) {
      return state.refreshPromise;
    }

    const currentRoot = getRoot();

    if (!currentRoot) {
      return Promise.resolve([]);
    }

    const generation = state.generation;

    currentRoot.dataset.marketRefreshing =
      "true";

    const marketRequest =
      refreshMarketData(generation);

    const timingRequest =
      refreshTimingData(generation);

    const refreshPromise =
      Promise.allSettled([
        marketRequest,
        timingRequest,
      ])
        .then((results) => {
          if (
            generation !==
            state.generation
          ) {
            return results;
          }

          emit(
            "marketoverview:refresh",
            {
              marketData:
                results[0].status ===
                "fulfilled",

              timing:
                results[1].status ===
                "fulfilled",
            },
          );

          return results;
        })
        .finally(() => {
          if (
            state.refreshPromise ===
            refreshPromise
          ) {
            state.refreshPromise =
              null;
          }

          if (
            generation ===
            state.generation
          ) {
            delete currentRoot.dataset
              .marketRefreshing;
          }
        });

    state.refreshPromise =
      refreshPromise;

    return refreshPromise;
  }

  /* ==========================================================================
     Fallback Refresh Scheduling
     ========================================================================== */

  function clearFallbackTimer() {
    if (!state.fallbackTimer) {
      return;
    }

    window.clearTimeout(
      state.fallbackTimer,
    );

    state.fallbackTimer = null;
  }

  function scheduleFallbackRefresh() {
    clearFallbackTimer();

    if (
      !state.started ||
      document.hidden
    ) {
      return;
    }

    state.fallbackTimer =
      window.setTimeout(() => {
        state.fallbackTimer = null;

        refreshNow().finally(() => {
          scheduleFallbackRefresh();
        });
      }, getRefreshInterval());
  }
    /* ==========================================================================
     Countdown-triggered Refresh
     ========================================================================== */

  function queueRefreshFromCountdown() {
    if (
      state.countdownRefreshQueued ||
      !state.started
    ) {
      return;
    }

    state.countdownRefreshQueued =
      true;

    clearFallbackTimer();

    Promise.resolve()
      .then(() => refreshNow())
      .finally(() => {
        state.countdownRefreshQueued =
          false;

        scheduleFallbackRefresh();
      });
  }

  /* ==========================================================================
     Page Visibility
     ========================================================================== */

  function handleVisibilityChange() {
    if (!state.started) {
      return;
    }

    if (document.hidden) {
      clearFallbackTimer();
      clearCountdownTimer();

      return;
    }

    renderAllCountdowns({
      allowExpiryRefresh: false,
    });

    startCountdownTimer();

    /*
     * Market data may have changed substantially while the document was
     * backgrounded, so refresh immediately when the page becomes visible.
     */

    clearFallbackTimer();

    refreshNow().finally(() => {
      scheduleFallbackRefresh();
    });
  }

  /* ==========================================================================
     Lifecycle
     ========================================================================== */

  function abortAllRequests() {
    state.abortControllers.forEach(
      (controller) => {
        controller.abort();
      },
    );

    state.abortControllers.clear();
  }

  function start() {
    if (state.started) {
      return;
    }

    /*
     * Resolve the Overview only after jQuery DOM-ready.
     *
     * The previous implementation queried for the root when this file was
     * evaluated. On pages where this script loads before the Overview markup,
     * that returned null and permanently stopped the refresh controller before
     * its ready handler could ever run.
     */

    const currentRoot = getRoot();

    if (!currentRoot) {
      return;
    }

    state.started = true;
    state.generation += 1;

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    /*
     * Do not replace or hide SSR content while the initial request is running.
     *
     * The first API result simply reconciles the currently rendered snapshot.
     */

    refreshNow().finally(() => {
      scheduleFallbackRefresh();
    });
  }

  function stop() {
    if (!state.started) {
      return;
    }

    state.started = false;
    state.generation += 1;

    clearFallbackTimer();
    clearCountdownTimer();

    abortAllRequests();

    state.refreshPromise = null;

    state.countdownRefreshQueued =
      false;

    const currentRoot = getRoot();

    if (currentRoot) {
      delete currentRoot.dataset
        .marketRefreshing;
    }

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
  }

  /* ==========================================================================
     Public API
     ========================================================================== */

  window.MarketHomeRefresh =
    Object.freeze({
      start,
      stop,

      refreshNow,

      updateCards,
      updateTimers,
    });

  /* ==========================================================================
     Auto Start — jQuery 4
     ========================================================================== */

  /*
   * jQuery owns DOM-ready for this site.
   *
   * The refresh controller itself remains framework-independent after startup:
   * requests use native fetch, timers use browser APIs and DOM updates are
   * handled by MarketCommon / MarketHomeDetails.
   */

  $(start);
})(window, document, jQuery);