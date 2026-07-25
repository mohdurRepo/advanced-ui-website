/* ==========================================================================
   Market Clock
   ========================================================================== */

const SELECTORS = {
  root: "[data-market-clock]",
  ticks: "[data-clock-ticks]",
  hourHand: "[data-clock-hour-hand]",
  minuteHand: "[data-clock-minute-hand]",
  secondHand: "[data-clock-second-hand]",
  location: "[data-market-clock-location]",
  time: "[data-market-clock-time]",
  day: "[data-market-clock-day]",
  date: "[data-market-clock-date]",
};

const RIYADH_TIME_ZONE = "Asia/Riyadh";
const TICK_COUNT = 60;
const UPDATE_INTERVAL = 1000;

let timerId = null;
let initialized = false;

/* ==========================================================================
   Helpers
   ========================================================================== */

function getClockElements(root) {
  return {
    root,
    ticks: root.querySelector(SELECTORS.ticks),
    hourHand: root.querySelector(SELECTORS.hourHand),
    minuteHand: root.querySelector(SELECTORS.minuteHand),
    secondHand: root.querySelector(SELECTORS.secondHand),
    location: root.querySelector(SELECTORS.location),
    time: root.querySelector(SELECTORS.time),
    day: root.querySelector(SELECTORS.day),
    date: root.querySelector(SELECTORS.date),
  };
}

function getCurrentLanguage() {
  return document.documentElement.lang === "ar" ? "ar" : "en";
}

function getLocale() {
  return getCurrentLanguage() === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
}

function getLocationLabel() {
  return getCurrentLanguage() === "ar"
    ? "الرياض، المملكة العربية السعودية"
    : "Riyadh, Saudi Arabia";
}

function getTimeZoneParts(date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: RIYADH_TIME_ZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const values = {};

  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  });

  return {
    hours: values.hour ?? 0,
    minutes: values.minute ?? 0,
    seconds: values.second ?? 0,
  };
}

function getRiyadhIsoDate(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: RIYADH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const values = {};

  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  });

  return `${values.year}-${values.month}-${values.day}`;
}

function getRiyadhDateTime(date) {
  const { hours, minutes, seconds } = getTimeZoneParts(date);
  const datePart = getRiyadhIsoDate(date);

  return `${datePart}T${String(hours).padStart(2, "0")}:${String(
    minutes,
  ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}+03:00`;
}

/* ==========================================================================
   Clock Face
   ========================================================================== */

function buildTicks(container) {
  if (!container || container.childElementCount > 0) return;

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < TICK_COUNT; index += 1) {
    const tick = document.createElement("span");

    tick.className =
      index % 5 === 0 ? "clock-tick clock-tick--major" : "clock-tick";

    tick.style.setProperty("--clock-angle", `${index * 6}deg`);

    fragment.appendChild(tick);
  }

  container.appendChild(fragment);
}

function updateHands(elements, date) {
  const { hours, minutes, seconds } = getTimeZoneParts(date);

  const secondAngle = seconds * 6;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const hourAngle = (hours % 12) * 30 + minutes * 0.5;

  elements.hourHand?.style.setProperty(
    "transform",
    `translate(-50%, -100%) rotate(${hourAngle}deg)`,
  );

  elements.minuteHand?.style.setProperty(
    "transform",
    `translate(-50%, -100%) rotate(${minuteAngle}deg)`,
  );

  elements.secondHand?.style.setProperty(
    "transform",
    `translate(-50%, -100%) rotate(${secondAngle}deg)`,
  );
}

/* ==========================================================================
   Text Output
   ========================================================================== */

function updateClockText(elements, date) {
  const locale = getLocale();

  const timeText = new Intl.DateTimeFormat(locale, {
    timeZone: RIYADH_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  const dayText = new Intl.DateTimeFormat(locale, {
    timeZone: RIYADH_TIME_ZONE,
    weekday: "long",
  }).format(date);

  const dateText = new Intl.DateTimeFormat(locale, {
    timeZone: RIYADH_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

  if (elements.location) {
    elements.location.textContent = getLocationLabel();
  }

  if (elements.time) {
    elements.time.textContent = timeText;
    elements.time.dateTime = getRiyadhDateTime(date);
  }

  if (elements.day) {
    elements.day.textContent = dayText;
  }

  if (elements.date) {
    elements.date.textContent = dateText;
    elements.date.dateTime = getRiyadhIsoDate(date);
  }
}

/* ==========================================================================
   Updates
   ========================================================================== */

function updateClock(elements) {
  const now = new Date();

  updateHands(elements, now);
  updateClockText(elements, now);
}

function startClock(elements) {
  window.clearInterval(timerId);

  updateClock(elements);

  timerId = window.setInterval(() => {
    updateClock(elements);
  }, UPDATE_INTERVAL);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketClock() {
  if (initialized) return;

  const root = document.querySelector(SELECTORS.root);

  if (!root) return;

  initialized = true;

  const elements = getClockElements(root);

  buildTicks(elements.ticks);
  startClock(elements);

  document.addEventListener("preferencechange", (event) => {
    if (event.detail?.name === "lang") {
      updateClock(elements);
    }
  });

  document.addEventListener("languagechange", () => {
    updateClock(elements);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.clearInterval(timerId);
      return;
    }

    startClock(elements);
  });
}
