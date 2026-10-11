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
 * - Localize location / day / date when the language changes.
 * - Generate analog clock ticks once.
 * - Share one second-aligned scheduler across all clock instances, paused
 *   while the page is hidden.
 *
 * This module does NOT own:
 *
 * - Market countdown timers.
 * - Market status.
 * - Summary market selection.
 * - Market Details.
 * - Bridge geometry.
 */

import { getLanguage } from "./market-shared";

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
 * Riyadh is UTC+03:00 year-round. Intl is the source of truth for every
 * displayed value; this constant is used only for <time datetime>.
 */

const MARKET_UTC_OFFSET = "+03:00";

/* ==========================================================================
   Locale
   ========================================================================== */

/*
 * Latin numerals in both languages, matching the financial values and
 * avoiding bidi surprises inside the LTR-isolated time.
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

const rootStates = new WeakMap();

/*
 * Iterable set of live clocks. Disconnected roots are dropped on the next
 * tick.
 */

const roots = new Set();

let globalEventsInitialized = false;

let schedulerTimer = null;

function getState(root) {
  return rootStates.get(root) || null;
}

/* ==========================================================================
   Formatters
   ========================================================================== */

/*
 * Cached per language, so a language change simply resolves a different
 * cached set; no invalidation is needed.
 */

const formatterCache = new Map();

const FORMATTER_OPTIONS = {
  clockParts: {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  },

  digitalTime: {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  },

  day: {
    weekday: "long",
  },

  date: {
    day: "2-digit",
    month: "long",
    year: "numeric",
  },

  dateKey: {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  },
};

function getFormatter(key) {
  const language = getLanguage();

  const cacheKey = `${language}:${key}`;

  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(
      cacheKey,
      new Intl.DateTimeFormat(LOCALES[language], {
        timeZone: MARKET_TIME_ZONE,

        ...FORMATTER_OPTIONS[key],
      }),
    );
  }

  return formatterCache.get(cacheKey);
}

/*
 * formatToParts → { type: value } for the requested part types.
 */

function getParts(key, date, types) {
  const values = {};

  getFormatter(key)
    .formatToParts(date)
    .forEach((part) => {
      if (types.includes(part.type)) {
        values[part.type] = part.value;
      }
    });

  return values;
}

/* ==========================================================================
   Riyadh Time
   ========================================================================== */

function getTimeParts(date) {
  const {
    hour = "00",
    minute = "00",
    second = "00",
  } = getParts("clockParts", date, ["hour", "minute", "second"]);

  return {
    hour: hour.padStart(2, "0"),
    minute: minute.padStart(2, "0"),
    second: second.padStart(2, "0"),
  };
}

/*
 * YYYY-MM-DD without relying on locale-specific separators.
 */

function getDateKey(date) {
  const {
    year = "",
    month = "",
    day = "",
  } = getParts("dateKey", date, ["year", "month", "day"]);

  return `${year}-${month}-${day}`;
}

function getRiyadhDateTime(date, time) {
  return `${getDateKey(date)}T${time.hour}:${time.minute}:${time.second}${MARKET_UTC_OFFSET}`;
}

/* ==========================================================================
   Safe DOM Writes
   ========================================================================== */

/*
 * Write only real changes: no needless mutations or live-region noise.
 */

function setText(element, value) {
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function setAttribute(element, name, value) {
  if (element && element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

function setTransform(element, value) {
  if (element && element.style.transform !== value) {
    element.style.transform = value;
  }
}

/* ==========================================================================
   Elements
   ========================================================================== */

function collectElements(root) {
  return Object.fromEntries(
    Object.entries(SELECTORS)
      .filter(([key]) => key !== "root")
      .map(([key, selector]) => [key, root.querySelector(selector)]),
  );
}

/* ==========================================================================
   Clock Ticks
   ========================================================================== */

/*
 * Generated once; authored or previously generated ticks are kept.
 */

function initializeTicks(container) {
  if (!container || container.querySelector(".clock-tick")) {
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
   Analog Clock
   ========================================================================== */

/*
 * Parent hands include the smaller units, so they move continuously rather
 * than stepping once per minute / hour.
 */

function updateAnalogClock(elements, time) {
  const hour = Number(time.hour);
  const minute = Number(time.minute);
  const second = Number(time.second);

  const angles = {
    hourHand: (hour % 12) * 30 + minute * 0.5 + second / 120,

    minuteHand: minute * 6 + second * 0.1,

    secondHand: second * 6,
  };

  Object.entries(angles).forEach(([key, angle]) => {
    setTransform(elements[key], `translate(-50%, -100%) rotate(${angle}deg)`);
  });
}

/* ==========================================================================
   Digital Time / Calendar / Location
   ========================================================================== */

function updateDigitalTime(elements, date, time) {
  setText(elements.time, getFormatter("digitalTime").format(date));

  setAttribute(elements.time, "datetime", getRiyadhDateTime(date, time));
}

/*
 * Day and date are reformatted only when the Riyadh date or the language
 * changes.
 */

function updateCalendar(root, date, { force = false } = {}) {
  const state = getState(root);

  const dateKey = getDateKey(date);

  const language = getLanguage();

  if (!force && state.dateKey === dateKey && state.language === language) {
    return;
  }

  const { elements } = state;

  setText(elements.day, getFormatter("day").format(date));

  setText(elements.date, getFormatter("date").format(date));

  /*
   * The date element represents a calendar date, not an instant.
   */

  setAttribute(elements.date, "datetime", dateKey);

  state.dateKey = dateKey;

  state.language = language;
}

function updateLocation(root) {
  const labels = LABELS[getLanguage()];

  setText(getState(root).elements.location, labels.location);

  setAttribute(root, "aria-label", labels.aria);
}

/* ==========================================================================
   Clock Update
   ========================================================================== */

function updateClock(root, date, { forceCalendar = false } = {}) {
  const state = getState(root);

  if (!state) {
    return;
  }

  const time = getTimeParts(date);

  updateAnalogClock(state.elements, time);

  updateDigitalTime(state.elements, date, time);

  updateCalendar(root, date, {
    force: forceCalendar,
  });
}

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
  if (schedulerTimer !== null) {
    window.clearTimeout(schedulerTimer);

    schedulerTimer = null;
  }
}

/*
 * Aligned to the next real second (+10ms) instead of drifting from the
 * moment initialization happened to run.
 */

function scheduleNextTick() {
  clearScheduler();

  if (document.hidden || !roots.size) {
    return;
  }

  const delay = 1000 - (Date.now() % 1000) + 10;

  schedulerTimer = window.setTimeout(() => {
    schedulerTimer = null;

    updateAllClocks();

    scheduleNextTick();
  }, delay);
}

/* ==========================================================================
   Global Events
   ========================================================================== */

/*
 * Catch up immediately when the page returns from the background.
 */

function handleVisibilityChange() {
  if (document.hidden) {
    clearScheduler();

    return;
  }

  updateAllClocks({
    forceCalendar: true,
  });

  scheduleNextTick();
}

function refreshLocalizedContent() {
  roots.forEach(updateLocation);

  updateAllClocks({
    forceCalendar: true,
  });
}

function handlePreferenceChange(event) {
  if (event.detail?.name === "lang") {
    refreshLocalizedContent();
  }
}

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
   Root Initialization
   ========================================================================== */

function initializeRoot(root) {
  if (!root || rootStates.has(root)) {
    return;
  }

  const elements = collectElements(root);

  rootStates.set(root, {
    elements,

    dateKey: null,

    language: null,
  });

  roots.add(root);

  initializeTicks(elements.ticks);

  updateLocation(root);

  updateClock(root, new Date(), {
    forceCalendar: true,
  });
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

  clockRoots.forEach(initializeRoot);

  scheduleNextTick();
}
