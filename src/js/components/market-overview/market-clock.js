/* ==========================================================================
   Market Clock
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - Display Saudi Arabia market time in the Asia/Riyadh timezone.
 * - Drive the decorative analog clock.
 * - Update the accessible digital time.
 * - Update day / date only when the Riyadh calendar date changes.
 * - Localize the location / day / date when language changes.
 * - Generate analog clock ticks once.
 * - Share one second-aligned scheduler across all clock instances.
 *
 * This module does NOT own:
 *
 * - Market countdown timers.
 * - Market status.
 * - Summary market selection.
 * - Market Details.
 * - Bridge geometry.
 */

/* ==========================================================================
   Selectors
   ========================================================================== */

const SELECTORS = {
  root: "[data-market-clock]",

  ticks: "[data-clock-ticks]",

  hourHand: "[data-clock-hour-hand]",

  minuteHand: "[data-clock-minute-hand]",

  secondHand: "[data-clock-second-hand]",

  time: "[data-market-clock-time]",

  day: "[data-market-clock-day]",

  date: "[data-market-clock-date]",

  location: "[data-market-clock-location]",
};

/* ==========================================================================
   Timezone
   ========================================================================== */

const MARKET_TIME_ZONE = "Asia/Riyadh";

/*
 * Riyadh uses UTC+03:00 year-round.
 *
 * Intl remains the source of truth for displayed calendar/time values; this
 * constant is used only when constructing the <time datetime> value.
 */

const MARKET_UTC_OFFSET = "+03:00";

/* ==========================================================================
   Locale
   ========================================================================== */

/*
 * Keep Latin numerals in both language modes.
 *
 * This matches the existing financial-value / clock presentation and avoids
 * bidi surprises inside the LTR-isolated time value.
 */

const LOCALES = {
  en: "en-GB-u-nu-latn",

  ar: "ar-SA-u-nu-latn",
};

/* ==========================================================================
   Labels
   ========================================================================== */

const LABELS = {
  en: {
    location: "Riyadh, Saudi Arabia",

    aria: "Saudi Arabia market time",
  },

  ar: {
    location: "الرياض، المملكة العربية السعودية",

    aria: "توقيت السوق في المملكة العربية السعودية",
  },
};

/* ==========================================================================
   State
   ========================================================================== */

const initializedRoots = new WeakSet();

const rootStates = new WeakMap();

/*
 * Keep initialized roots iterable.
 *
 * WeakSet / WeakMap are still used for ownership/state without preventing
 * garbage collection.
 */

const roots = new Set();

let globalEventsInitialized = false;

let schedulerTimer = null;

/* ==========================================================================
   Formatter Cache
   ========================================================================== */

const formatterCache = new Map();

/* ==========================================================================
   Language
   ========================================================================== */

function getLanguage() {
  const language = document.documentElement.lang?.trim().toLowerCase() || "en";

  return language.startsWith("ar") ? "ar" : "en";
}

function getLocale() {
  return LOCALES[getLanguage()];
}

/* ==========================================================================
   Formatter Factory
   ========================================================================== */

function getFormatter(key, options) {
  const language = getLanguage();

  const cacheKey = `${language}:${key}`;

  if (formatterCache.has(cacheKey)) {
    return formatterCache.get(cacheKey);
  }

  const formatter = new Intl.DateTimeFormat(LOCALES[language], {
    timeZone: MARKET_TIME_ZONE,

    ...options,
  });

  formatterCache.set(cacheKey, formatter);

  return formatter;
}

/* ==========================================================================
   Formatters
   ========================================================================== */

function getClockPartsFormatter() {
  return getFormatter("clock-parts", {
    hour: "2-digit",

    minute: "2-digit",

    second: "2-digit",

    hourCycle: "h23",
  });
}

function getDigitalTimeFormatter() {
  return getFormatter("digital-time", {
    hour: "2-digit",

    minute: "2-digit",

    hourCycle: "h23",
  });
}

function getDayFormatter() {
  return getFormatter("day", {
    weekday: "long",
  });
}

function getDateFormatter() {
  return getFormatter("date", {
    day: "2-digit",

    month: "long",

    year: "numeric",
  });
}

function getDateKeyFormatter() {
  return getFormatter("date-key", {
    year: "numeric",

    month: "2-digit",

    day: "2-digit",
  });
}

/* ==========================================================================
   Elements
   ========================================================================== */

function collectElements(root) {
  if (!root) {
    return null;
  }

  return {
    root,

    ticks: root.querySelector(SELECTORS.ticks),

    hourHand: root.querySelector(SELECTORS.hourHand),

    minuteHand: root.querySelector(SELECTORS.minuteHand),

    secondHand: root.querySelector(SELECTORS.secondHand),

    time: root.querySelector(SELECTORS.time),

    day: root.querySelector(SELECTORS.day),

    date: root.querySelector(SELECTORS.date),

    location: root.querySelector(SELECTORS.location),
  };
}

function getState(root) {
  return rootStates.get(root) || null;
}

/* ==========================================================================
   Safe DOM Writes
   ========================================================================== */

function setText(element, value) {
  if (!element || element.textContent === value) {
    return;
  }

  element.textContent = value;
}

function setAttribute(element, name, value) {
  if (!element) {
    return;
  }

  if (element.getAttribute(name) === value) {
    return;
  }

  element.setAttribute(name, value);
}

function setTransform(element, value) {
  if (!element || element.style.transform === value) {
    return;
  }

  element.style.transform = value;
}

/* ==========================================================================
   Clock Ticks
   ========================================================================== */

function initializeTicks(elements) {
  const container = elements?.ticks;

  if (!container) {
    return;
  }

  /*
   * Do not recreate authored or previously generated ticks.
   */

  if (container.querySelector(".clock-tick")) {
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 60; index += 1) {
    const tick = document.createElement("span");

    tick.className =
      index % 5 === 0 ? "clock-tick clock-tick--major" : "clock-tick";

    tick.setAttribute("aria-hidden", "true");

    tick.style.setProperty("--clock-angle", `${index * 6}deg`);

    fragment.appendChild(tick);
  }

  container.appendChild(fragment);
}

/* ==========================================================================
   Riyadh Time Parts
   ========================================================================== */

function getTimeParts(date) {
  const parts = getClockPartsFormatter().formatToParts(date);

  const values = {
    hour: 0,

    minute: 0,

    second: 0,
  };

  parts.forEach((part) => {
    if (
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      values[part.type] = Number(part.value);
    }
  });

  return values;
}

/* ==========================================================================
   Analog Clock
   ========================================================================== */

function updateAnalogClock(elements, date) {
  if (!elements) {
    return;
  }

  const { hour, minute, second } = getTimeParts(date);

  /*
   * Include smaller units in the parent-hand positions so movement is
   * continuous rather than stepping only once per minute/hour.
   */

  const secondAngle = second * 6;

  const minuteAngle = minute * 6 + second * 0.1;

  const hourAngle = (hour % 12) * 30 + minute * 0.5 + second / 120;

  setTransform(
    elements.hourHand,
    `translate(-50%, -100%) rotate(${hourAngle}deg)`,
  );

  setTransform(
    elements.minuteHand,
    `translate(-50%, -100%) rotate(${minuteAngle}deg)`,
  );

  setTransform(
    elements.secondHand,
    `translate(-50%, -100%) rotate(${secondAngle}deg)`,
  );
}

/* ==========================================================================
   Digital Time
   ========================================================================== */

function updateDigitalTime(elements, date) {
  const time = elements?.time;

  if (!time) {
    return;
  }

  const formatted = getDigitalTimeFormatter().format(date);

  setText(time, formatted);
}

/* ==========================================================================
   Date Key
   ========================================================================== */

function getDateKey(date) {
  /*
   * formatToParts avoids relying on locale-specific separators.
   */

  const parts = getDateKeyFormatter().formatToParts(date);

  let year = "";
  let month = "";
  let day = "";

  parts.forEach((part) => {
    switch (part.type) {
      case "year":
        year = part.value;
        break;

      case "month":
        month = part.value;
        break;

      case "day":
        day = part.value;
        break;

      default:
        break;
    }
  });

  return `${year}-${month}-${day}`;
}

/* ==========================================================================
   ISO DateTime
   ========================================================================== */

function getRiyadhDateTime(date) {
  const parts = getClockPartsFormatter().formatToParts(date);

  const time = {
    hour: "00",

    minute: "00",

    second: "00",
  };

  parts.forEach((part) => {
    if (
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      time[part.type] = part.value.padStart(2, "0");
    }
  });

  const dateKey = getDateKey(date);

  return (
    `${dateKey}` +
    `T${time.hour}` +
    `:${time.minute}` +
    `:${time.second}` +
    MARKET_UTC_OFFSET
  );
}

/* ==========================================================================
   Digital Time Metadata
   ========================================================================== */

function updateTimeMetadata(elements, date) {
  setAttribute(elements?.time, "datetime", getRiyadhDateTime(date));
}

/* ==========================================================================
   Day / Date
   ========================================================================== */

function updateCalendar(elements, date, { force = false } = {}) {
  const state = getState(elements?.root);

  if (!state) {
    return;
  }

  const dateKey = getDateKey(date);

  const language = getLanguage();

  /*
   * Day and date do not need to be reformatted every second.
   */

  if (!force && state.dateKey === dateKey && state.language === language) {
    return;
  }

  const dayText = getDayFormatter().format(date);

  const dateText = getDateFormatter().format(date);

  setText(elements.day, dayText);

  setText(elements.date, dateText);

  /*
   * The date element represents a calendar date, not a full instant.
   */

  setAttribute(elements.date, "datetime", dateKey);

  state.dateKey = dateKey;

  state.language = language;
}

/* ==========================================================================
   Location
   ========================================================================== */

function updateLocation(elements) {
  if (!elements) {
    return;
  }

  const language = getLanguage();

  const labels = LABELS[language];

  setText(elements.location, labels.location);

  setAttribute(elements.root, "aria-label", labels.aria);
}

/* ==========================================================================
   Clock Update
   ========================================================================== */

function updateClock(root, date = new Date(), { forceCalendar = false } = {}) {
  const state = getState(root);

  if (!state) {
    return;
  }

  const { elements } = state;

  updateAnalogClock(elements, date);

  updateDigitalTime(elements, date);

  updateTimeMetadata(elements, date);

  updateCalendar(elements, date, {
    force: forceCalendar,
  });
}

/* ==========================================================================
   All Clocks
   ========================================================================== */

function updateAllClocks({ forceCalendar = false } = {}) {
  const now = new Date();

  roots.forEach((root) => {
    if (!root.isConnected) {
      roots.delete(root);

      return;
    }

    updateClock(root, now, {
      forceCalendar,
    });
  });
}

/* ==========================================================================
   Scheduler
   ========================================================================== */

function clearScheduler() {
  if (schedulerTimer === null) {
    return;
  }

  window.clearTimeout(schedulerTimer);

  schedulerTimer = null;
}

function scheduleNextTick() {
  clearScheduler();

  if (document.hidden || !roots.size) {
    return;
  }

  /*
   * Align updates to the next real second rather than drifting from the time
   * at which initMarketClock happened to execute.
   */

  const now = Date.now();

  const delay = 1000 - (now % 1000) + 10;

  schedulerTimer = window.setTimeout(() => {
    schedulerTimer = null;

    updateAllClocks();

    scheduleNextTick();
  }, delay);
}

function startScheduler() {
  if (document.hidden || !roots.size) {
    return;
  }

  updateAllClocks();

  scheduleNextTick();
}

/* ==========================================================================
   Visibility
   ========================================================================== */

function handleVisibilityChange() {
  if (document.hidden) {
    clearScheduler();

    return;
  }

  /*
   * Immediately catch up after the page returns from the background.
   */

  updateAllClocks({
    forceCalendar: true,
  });

  scheduleNextTick();
}

/* ==========================================================================
   Language
   ========================================================================== */

function refreshLocalizedContent() {
  /*
   * Cached formatters are keyed by language, so no cache invalidation is
   * required. The newly active language automatically resolves a different
   * cached formatter set.
   */

  roots.forEach((root) => {
    const state = getState(root);

    if (!state) {
      return;
    }

    updateLocation(state.elements);
  });

  updateAllClocks({
    forceCalendar: true,
  });
}

function handlePreferenceChange(event) {
  if (event.detail?.name !== "lang") {
    return;
  }

  refreshLocalizedContent();
}

/* ==========================================================================
   Root Initialization
   ========================================================================== */

function initializeRoot(root) {
  if (!root || initializedRoots.has(root)) {
    return;
  }

  const elements = collectElements(root);

  if (!elements) {
    return;
  }

  rootStates.set(root, {
    elements,

    dateKey: null,

    language: null,
  });

  initializedRoots.add(root);

  roots.add(root);

  initializeTicks(elements);

  updateLocation(elements);

  updateClock(root, new Date(), {
    forceCalendar: true,
  });
}

/* ==========================================================================
   Global Events
   ========================================================================== */

function initializeGlobalEvents() {
  if (globalEventsInitialized) {
    return;
  }

  globalEventsInitialized = true;

  document.addEventListener("visibilitychange", handleVisibilityChange);

  document.addEventListener("languagechange", refreshLocalizedContent);

  document.addEventListener("preferencechange", handlePreferenceChange);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketClock() {
  const clockRoots = document.querySelectorAll(SELECTORS.root);

  if (!clockRoots.length) {
    return;
  }

  initializeGlobalEvents();

  clockRoots.forEach((root) => {
    initializeRoot(root);
  });

  startScheduler();
}
