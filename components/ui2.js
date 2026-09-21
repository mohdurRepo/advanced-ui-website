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
   * Per-element state belongs to the element itself rather than to global
   * string keys.
   *
   * WeakMap also means removed DOM elements can be garbage-collected
   * naturally.
   */

  const liveUpdateTimers = new WeakMap();
  const rawValueStore = new WeakMap();

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
    return getLocale().toLowerCase().startsWith("ar");
  }

  /* ==========================================================================
     Object Access
     ========================================================================== */

  function getPath(object, path, fallback = null) {
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
        !Object.prototype.hasOwnProperty.call(current, key)
      ) {
        return fallback;
      }

      current = current[key];
    }

    return current === undefined ? fallback : current;
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
    const arabicIndicDigits = "٠١٢٣٤٥٦٧٨٩";
    const easternArabicDigits = "۰۱۲۳۴۵۶۷۸۹";

    return String(value)
      .replace(/[٠-٩]/g, (digit) =>
        String(arabicIndicDigits.indexOf(digit)),
      )
      .replace(/[۰-۹]/g, (digit) =>
        String(easternArabicDigits.indexOf(digit)),
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
      return Number.isFinite(value) ? value : null;
    }

    const normalized = normalizeDigits(value)
      .trim()
      .replace(/\u2212/g, "-")
      .replace(/\u066b/g, ".")
      .replace(/[,\u066c\u00a0\s]/g, "")
      .replace(/%$/, "");

    if (!normalized) {
      return null;
    }

    const number = Number(normalized);

    return Number.isFinite(number) ? number : null;
  }

  function toInteger(value, fallback = null) {
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

  function getNumberFormatter(options = {}) {
    const locale = getLocale();

    const cacheKey = JSON.stringify([
      locale,
      options,
    ]);

    if (!formatterCache.has(cacheKey)) {
      formatterCache.set(
        cacheKey,
        new Intl.NumberFormat(locale, options),
      );
    }

    return formatterCache.get(cacheKey);
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

  function formatInteger(value, options = {}) {
    return formatNumber(value, 0, options);
  }

  function formatDecimal(
    value,
    decimals = 2,
    options = {},
  ) {
    return formatNumber(value, decimals, options);
  }

  function formatSignedNumber(
    value,
    decimals = 2,
    options = {},
  ) {
    return formatNumber(value, decimals, {
      signDisplay: "exceptZero",
      ...options,
    });
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

    return parentheses ? `(${result})` : result;
  }

  function formatCompact(value, options = {}) {
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

  function getUpdateDirection(previousValue, nextValue) {
    const previous = toNumber(previousValue);
    const next = toNumber(nextValue);

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
    const direction = getDirection(value);

    if (!direction) {
      return null;
    }

    return `price-${direction}`;
  }

  function clearPriceState(element) {
    if (!element) {
      return;
    }

    element.classList.remove(...PRICE_STATE_CLASSES);
  }

  function applyPriceState(element, value) {
    if (!element) {
      return;
    }

    clearPriceState(element);

    const className = getPriceClass(value);

    if (className) {
      element.classList.add(className);
    }
  }

  /* ==========================================================================
     Motion Preference
     ========================================================================== */

  function prefersReducedMotion() {
    if (
      document.documentElement.dataset.motion === "reduce"
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

    const timer = liveUpdateTimers.get(element);

    if (timer) {
      window.clearTimeout(timer);
      liveUpdateTimers.delete(element);
    }

    element.classList.remove(...LIVE_UPDATE_CLASSES);
  }

  function triggerLiveUpdate(
    element,
    previousValue,
    nextValue,
    {
      duration =
        config.refresh?.liveUpdateDuration ??
        DEFAULT_LIVE_UPDATE_DURATION,
    } = {},
  ) {
    if (!element) {
      return false;
    }

    const direction = getUpdateDirection(
      previousValue,
      nextValue,
    );

    /*
     * No previous value means there is nothing meaningful to compare.
     *
     * An unchanged value must remain completely visually quiet.
     */

    if (
      direction === null ||
      direction === "neutral"
    ) {
      return false;
    }

    clearLiveUpdate(element);

    if (prefersReducedMotion()) {
      return true;
    }

    /*
     * Restart the animation when the same element receives another update
     * before its previous feedback has completed.
     */

    void element.offsetWidth;

    element.classList.add(
      `is-updating-${direction}`,
    );

    const timer = window.setTimeout(() => {
      element.classList.remove(
        ...LIVE_UPDATE_CLASSES,
      );

      liveUpdateTimers.delete(element);
    }, duration);

    liveUpdateTimers.set(element, timer);

    return true;
  }

  /* ==========================================================================
     Element Raw Values
     ========================================================================== */

  function readElementRawValue(element) {
    if (!element) {
      return null;
    }

    if (rawValueStore.has(element)) {
      return rawValueStore.get(element);
    }

    /*
     * <data value=""> is our preferred server-rendered baseline.
     */

    if (
      element.tagName === "DATA" &&
      element.hasAttribute("value")
    ) {
      return toNumber(
        element.getAttribute("value"),
      );
    }

    if (
      element.dataset &&
      element.dataset.marketRawValue !== undefined
    ) {
      return toNumber(
        element.dataset.marketRawValue,
      );
    }

    return null;
  }

  function storeElementRawValue(element, value) {
    if (!element) {
      return;
    }

    const number = toNumber(value);

    rawValueStore.set(element, number);

    if (element.tagName === "DATA") {
      if (number === null) {
        element.removeAttribute("value");
      } else {
        element.setAttribute(
          "value",
          String(number),
        );
      }
    }
  }

  /* ==========================================================================
     DOM Value Updates
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

    const nextValue = toNumber(rawValue);

    /*
     * API omissions must never turn an already-rendered legitimate value
     * into zero or an empty placeholder.
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
      readElementRawValue(element);

    const changed =
      previousValue !== null &&
      nextValue !== null &&
      previousValue !== nextValue;

    if (formattedValue !== undefined) {
      element.textContent = String(
        formattedValue,
      );
    }

    storeElementRawValue(
      element,
      nextValue,
    );

    if (animate && changed) {
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
      (value === null || value === undefined)
    ) {
      return false;
    }

    const nextText =
      value === null || value === undefined
        ? ""
        : String(value);

    if (element.textContent === nextText) {
      return false;
    }

    element.textContent = nextText;

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
      config.domains?.[domainKey] || "",
    );
  }

  function buildCompanyUrl(domainKey, symbol) {
    const domain = getDomain(domainKey);

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
      encodeURIComponent(String(symbol))
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

  function buildTargetDate(nextEventTimer) {
    if (
      !nextEventTimer ||
      !nextEventTimer.date ||
      !nextEventTimer.time
    ) {
      return null;
    }

    const date = nextEventTimer.date;
    const time = nextEventTimer.time;

    const year = toInteger(date.year);
    const month = toInteger(date.month);
    const day = toInteger(date.day);

    const hour = toInteger(time.hour, 0);
    const minute = toInteger(time.minute, 0);
    const second = toInteger(time.second, 0);

    if (
      year === null ||
      month === null ||
      day === null
    ) {
      return null;
    }

    const milliseconds = time.nano
      ? Math.floor(
          toInteger(time.nano, 0) /
            1000000,
        )
      : 0;

    const target = new Date(
      year,
      month - 1,
      day,
      hour,
      minute,
      second,
      milliseconds,
    );

    return Number.isNaN(target.getTime())
      ? null
      : target;
  }

  function getRemainingSeconds(
    nextEventTimer,
    now = Date.now(),
  ) {
    const target =
      buildTargetDate(nextEventTimer);

    if (!target) {
      return null;
    }

    return Math.max(
      0,
      Math.floor(
        (target.getTime() - now) / 1000,
      ),
    );
  }

  function formatTimer(seconds) {
    const value = toNumber(seconds);

    if (value === null) {
      return "";
    }

    const safeSeconds = Math.max(
      0,
      Math.floor(value),
    );

    const days = Math.floor(
      safeSeconds / 86400,
    );

    const hours = Math.floor(
      (safeSeconds % 86400) / 3600,
    );

    const minutes = Math.floor(
      (safeSeconds % 3600) / 60,
    );

    const remainingSeconds =
      safeSeconds % 60;

    if (days > 0) {
      if (isArabic()) {
        return `${days} يوم`;
      }

      return `${days} ${
        days === 1 ? "day" : "days"
      }`;
    }

    return [
      pad(hours),
      pad(minutes),
      pad(remainingSeconds),
    ].join(":");
  }

  function getTimerLabel(status) {
    const normalized = String(
      status || "",
    )
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
    const value = toNumber(seconds);

    if (value === null) {
      return "";
    }

    let remaining = Math.max(
      0,
      Math.floor(value),
    );

    const days = Math.floor(
      remaining / 86400,
    );

    remaining %= 86400;

    const hours = Math.floor(
      remaining / 3600,
    );

    remaining %= 3600;

    const minutes = Math.floor(
      remaining / 60,
    );

    const secs = remaining % 60;

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

  window.MarketCommon = Object.freeze({
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

    /* Price State */

    getPriceClass,
    clearPriceState,
    applyPriceState,

    /* Live Updates */

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